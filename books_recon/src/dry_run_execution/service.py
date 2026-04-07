"""Deterministic dry-run and hardened sandbox execution service."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from connectors.zoho.sandbox_adapter import ZohoNormalizedResponse, ZohoPreparedRequest, ZohoSandboxAdapter
from core.config import Settings
from core.hashing import stable_payload_hash
from db.models.workflow import DryRunExecutionArtifact, ExternalExecutionAttempt, ZohoPostingReceipt
from db.repositories.proposals import (
    ApprovalDecisionRepository,
    DryRunExecutionArtifactRepository,
    ExternalExecutionAttemptRepository,
    ProposalRepository,
    ZohoPostingReceiptRepository,
    SandboxReconciliationRecordRepository,
)
from preflight.service import PostingPreflightService
from zoho_contracts.service import ZohoContractMapperService


@dataclass(frozen=True)
class ExecutionResult:
    proposal_id: str
    execution_mode: str
    execution_status: str
    preflight_status: str
    execution_plan: dict[str, Any]
    prepared_request: dict[str, Any]
    simulated_receipt: dict[str, Any]
    external_response: dict[str, Any]
    normalized_response: dict[str, Any]
    request_hash: str | None
    idempotency_key: str | None
    retryable_flag: bool | None
    block_reasons: list[str]
    artifact_id: str
    attempt_id: str | None = None


class DryRunExecutionService:
    SUPPORTED_MODES = {"dry_run", "sandbox_execute", "production_execute"}
    SANDBOX_ENVIRONMENT = "sandbox"

    def __init__(
        self,
        *,
        proposal_repository: ProposalRepository,
        execution_artifact_repository: DryRunExecutionArtifactRepository,
        execution_attempt_repository: ExternalExecutionAttemptRepository,
        approval_decision_repository: ApprovalDecisionRepository,
        posting_receipt_repository: ZohoPostingReceiptRepository,
        reconciliation_record_repository: SandboxReconciliationRecordRepository | None = None,
        preflight_service: PostingPreflightService,
        contract_mapper_service: ZohoContractMapperService,
        sandbox_adapter: ZohoSandboxAdapter | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.proposal_repository = proposal_repository
        self.execution_artifact_repository = execution_artifact_repository
        self.execution_attempt_repository = execution_attempt_repository
        self.approval_decision_repository = approval_decision_repository
        self.posting_receipt_repository = posting_receipt_repository
        self.reconciliation_record_repository = reconciliation_record_repository
        self.preflight_service = preflight_service
        self.contract_mapper_service = contract_mapper_service
        self.sandbox_adapter = sandbox_adapter
        self.settings = settings

    def execute(self, proposal_id, *, actor: str = "dry_run_executor", mode: str = "dry_run") -> ExecutionResult:
        if mode not in self.SUPPORTED_MODES:
            raise ValueError(f"Unsupported execution mode: {mode}")
        if mode == "production_execute":
            raise NotImplementedError("production_execute is not implemented.")

        proposal = self._require_proposal(proposal_id)
        preflight = self.preflight_service.evaluate_proposal(proposal.id)
        dry_run_payload = self.preflight_service.build_dry_run_payload(proposal.id)
        contract = self.contract_mapper_service.map_dry_run_payload(dry_run_payload)

        if preflight.preflight_status != "ready":
            return self._persist_result(
                proposal=proposal,
                actor=actor,
                execution_mode=mode,
                execution_status="refused",
                preflight_status=preflight.preflight_status,
                block_reasons=preflight.posting_block_reasons,
                execution_plan={"mode": mode, "steps": ["preflight", "contract_mapping"], "outcome": "refused"},
                prepared_request={},
                simulated_receipt={},
                external_response={},
                normalized_response={},
                idempotency_key=preflight.idempotency_key,
                request_hash=None,
                environment=None,
                reconciliation_context={},
                retryable_flag=None,
            )

        if not contract.validation_result.is_valid:
            reasons = contract.validation_result.missing_fields + [
                item["placeholder"] if "placeholder" in item else item["reason"]
                for item in contract.unresolved_placeholders
            ]
            return self._persist_result(
                proposal=proposal,
                actor=actor,
                execution_mode=mode,
                execution_status="refused",
                preflight_status="blocked",
                block_reasons=reasons or contract.validation_result.validation_messages,
                execution_plan={"mode": mode, "steps": ["preflight", "contract_mapping"], "outcome": "refused"},
                prepared_request={},
                simulated_receipt={},
                external_response={},
                normalized_response={},
                idempotency_key=preflight.idempotency_key,
                request_hash=None,
                environment=None,
                reconciliation_context={},
                retryable_flag=None,
            )

        prepared_request = {
            "target_system": contract.target_system,
            "target_module": contract.target_module,
            "contract_version": contract.contract_version,
            "idempotency_key": preflight.idempotency_key,
            "body": contract.contract_payload,
        }
        request_hash = stable_payload_hash(prepared_request)

        if mode == "dry_run":
            return self._execute_dry_run(
                proposal=proposal,
                actor=actor,
                contract=contract,
                preflight_status=preflight.preflight_status,
                prepared_request=prepared_request,
                request_hash=request_hash,
                idempotency_key=preflight.idempotency_key,
                reconciliation_context={},
            )
        return self._execute_sandbox(
            proposal=proposal,
            actor=actor,
            contract=contract,
            preflight_status=preflight.preflight_status,
            prepared_request=prepared_request,
            request_hash=request_hash,
            idempotency_key=preflight.idempotency_key,
        )

    def inspect_latest_artifact(self, proposal_id) -> DryRunExecutionArtifact | None:
        return self.execution_artifact_repository.latest_for_proposal(proposal_id)

    def list_ready_for_execution(self) -> list[dict[str, Any]]:
        return [asdict(result) for result in self.preflight_service.list_eligible_proposals()]

    def _execute_dry_run(
        self,
        *,
        proposal,
        actor: str,
        contract,
        preflight_status: str,
        prepared_request: dict[str, Any],
        request_hash: str,
        idempotency_key: str | None,
        reconciliation_context: dict[str, Any],
    ) -> ExecutionResult:
        simulated_receipt = {
            "execution_status": "simulated",
            "proposal_id": str(proposal.id),
            "classification_result_id": str(proposal.generated_from_classification_id),
            "rule_version_id": str(proposal.rule_version_id),
            "target_system": contract.target_system,
            "target_module": contract.target_module,
            "request_hash": request_hash,
            "idempotency_key": idempotency_key,
            "block_reasons": [],
        }
        return self._persist_result(
            proposal=proposal,
            actor=actor,
            execution_mode="dry_run",
            execution_status="simulated",
            preflight_status=preflight_status,
            block_reasons=[],
            execution_plan={
                "mode": "dry_run",
                "steps": ["preflight", "contract_mapping", "prepare_request", "simulate_receipt"],
                "outcome": "simulated",
            },
            prepared_request=prepared_request,
            simulated_receipt=simulated_receipt,
            external_response={},
            normalized_response={},
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            environment=None,
            reconciliation_context=reconciliation_context,
            retryable_flag=None,
        )

    def _execute_sandbox(
        self,
        *,
        proposal,
        actor: str,
        contract,
        preflight_status: str,
        prepared_request: dict[str, Any],
        request_hash: str,
        idempotency_key: str | None,
    ) -> ExecutionResult:
        settings = self._require_settings()
        block_reason = self._blocking_sandbox_reason(
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            sandbox_enabled=settings.zoho_sandbox_enabled,
        )
        if block_reason is not None:
            result = self._persist_result(
                proposal=proposal,
                actor=actor,
                execution_mode="sandbox_execute",
                execution_status="sandbox_failure",
                preflight_status=preflight_status,
                block_reasons=[block_reason],
                execution_plan={
                    "mode": "sandbox_execute",
                    "steps": ["preflight", "contract_mapping", "sandbox_gate"],
                    "outcome": "refused",
                },
                prepared_request=prepared_request,
                simulated_receipt={},
                external_response={},
                normalized_response=self._normalized_failure_payload(
                    code="sandbox_blocked",
                    message=block_reason,
                    category="execution_guard",
                    retryable=False,
                ),
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                environment=self.SANDBOX_ENVIRONMENT,
                reconciliation_context={},
                retryable_flag=False,
            )
            attempt = self._record_attempt(
                proposal=proposal,
                actor=actor,
                result=result,
                normalized=self._normalized_response_from_payload(result.normalized_response),
                receipt=None,
                reconciliation_context={},
            )
            return ExecutionResult(**{**asdict(result), "attempt_id": str(attempt.id)})

        if self.sandbox_adapter is None:
            raise ValueError("Sandbox adapter is not configured.")

        adapter_request, normalized = self.sandbox_adapter.execute(
            proposal_id=proposal.id,
            contract=contract,
            idempotency_key=str(idempotency_key),
            request_hash=request_hash,
        )
        reconciliation_context = self._build_reconciliation_context(
            proposal=proposal,
            contract=contract,
            prepared_request=adapter_request,
            normalized=normalized,
            request_hash=request_hash,
            idempotency_key=idempotency_key,
        )
        execution_status = {
            "success": "sandbox_success",
            "failure": "sandbox_failure",
            "retryable_failure": "sandbox_retryable_failure",
            "unknown_outcome": "sandbox_unknown_outcome",
        }[normalized.status]
        result = self._persist_result(
            proposal=proposal,
            actor=actor,
            execution_mode="sandbox_execute",
            execution_status=execution_status,
            preflight_status=preflight_status,
            block_reasons=[item["message"] for item in normalized.normalized_errors],
            execution_plan={
                "mode": "sandbox_execute",
                "steps": ["preflight", "contract_mapping", "prepare_request", "sandbox_execute"],
                "outcome": normalized.status,
            },
            prepared_request={**prepared_request, "adapter_request": asdict(adapter_request)},
            simulated_receipt={},
            external_response=normalized.raw_response,
            normalized_response=asdict(normalized),
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            environment=self.SANDBOX_ENVIRONMENT,
            reconciliation_context=reconciliation_context,
            retryable_flag=normalized.retryable_flag,
        )
        receipt = None
        if normalized.status == "success" and idempotency_key is not None:
            receipt = self._record_success_receipt(
                proposal=proposal,
                actor=actor,
                contract=contract,
                normalized=normalized,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
            )
        attempt = self._record_attempt(
            proposal=proposal,
            actor=actor,
            result=result,
            normalized=normalized,
            receipt=receipt,
            reconciliation_context=reconciliation_context,
        )
        return ExecutionResult(**{**asdict(result), "attempt_id": str(attempt.id)})

    def _persist_result(
        self,
        *,
        proposal,
        actor: str,
        execution_mode: str,
        execution_status: str,
        preflight_status: str,
        block_reasons: list[str],
        execution_plan: dict[str, Any],
        prepared_request: dict[str, Any],
        simulated_receipt: dict[str, Any],
        external_response: dict[str, Any],
        normalized_response: dict[str, Any],
        idempotency_key: str | None,
        request_hash: str | None,
        environment: str | None,
        reconciliation_context: dict[str, Any],
        retryable_flag: bool | None,
    ) -> ExecutionResult:
        artifact_timestamp = datetime.now(timezone.utc)
        artifact = self.execution_artifact_repository.add(
            DryRunExecutionArtifact(
                posting_proposal_id=proposal.id,
                classification_result_id=proposal.generated_from_classification_id,
                rule_version_id=proposal.rule_version_id,
                execution_mode=execution_mode,
                execution_status=execution_status,
                target_system=proposal.target_system,
                target_module=self.preflight_service._target_module(proposal.proposal_type),
                contract_version=self.contract_mapper_service.CONTRACT_VERSION,
                preflight_status=preflight_status,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                environment=environment,
                block_reasons_json={"reasons": block_reasons},
                execution_plan_json=execution_plan,
                prepared_request_json=prepared_request,
                simulated_receipt_json=simulated_receipt,
                external_response_json=external_response,
                normalized_response_json=normalized_response,
                reconciliation_context_json=reconciliation_context,
                retryable_flag=retryable_flag,
                created_at=artifact_timestamp,
                updated_at=artifact_timestamp,
                created_by=actor,
                updated_by=actor,
            )
        )
        return ExecutionResult(
            proposal_id=str(proposal.id),
            execution_mode=execution_mode,
            execution_status=execution_status,
            preflight_status=preflight_status,
            execution_plan=execution_plan,
            prepared_request=prepared_request,
            simulated_receipt=simulated_receipt,
            external_response=external_response,
            normalized_response=normalized_response,
            request_hash=request_hash,
            idempotency_key=idempotency_key,
            retryable_flag=retryable_flag,
            block_reasons=block_reasons,
            artifact_id=str(artifact.id),
        )

    def _blocking_sandbox_reason(
        self,
        *,
        idempotency_key: str | None,
        request_hash: str,
        sandbox_enabled: bool,
    ) -> str | None:
        if not sandbox_enabled:
            return "zoho sandbox execution feature flag is disabled"
        if idempotency_key is None:
            return "missing idempotency seed"
        receipt = self.posting_receipt_repository.find_by_idempotency_key(
            idempotency_key,
            environment=self.SANDBOX_ENVIRONMENT,
        )
        if receipt is not None and receipt.posting_status == "sandbox_success":
            return f"sandbox execution already succeeded for idempotency key {idempotency_key}"
        latest_attempt = self.execution_attempt_repository.latest_for_idempotency_key(
            idempotency_key,
            environment=self.SANDBOX_ENVIRONMENT,
            execution_mode="sandbox_execute",
        )
        if latest_attempt is not None and latest_attempt.outcome_status == "sandbox_unknown_outcome":
            status = self._unknown_outcome_resolution_status(latest_attempt.id)
            if status in {None, "still_unknown"}:
                return f"sandbox execution is blocked pending reconciliation for idempotency key {idempotency_key}"
            if status == "reconciled_success":
                return f"sandbox execution already reconciled as success for idempotency key {idempotency_key}"
        latest_artifact = self.execution_artifact_repository.latest_for_idempotency_key(
            idempotency_key,
            execution_mode="sandbox_execute",
        )
        if latest_artifact is not None and latest_artifact.execution_status == "sandbox_success":
            return f"sandbox execution already recorded for idempotency key {idempotency_key}"
        if latest_artifact is not None and latest_artifact.execution_status == "sandbox_unknown_outcome":
            if latest_attempt is None:
                return f"sandbox execution is blocked pending reconciliation for request hash {request_hash}"
        return None

    def _record_success_receipt(
        self,
        *,
        proposal,
        actor: str,
        contract,
        normalized: ZohoNormalizedResponse,
        idempotency_key: str,
        request_hash: str,
    ) -> ZohoPostingReceipt:
        existing = self.posting_receipt_repository.find_by_idempotency_key(
            idempotency_key,
            environment=self.SANDBOX_ENVIRONMENT,
        )
        if existing is not None:
            return existing
        latest_approval = self.approval_decision_repository.latest_for_proposal(proposal.id)
        return self.posting_receipt_repository.add(
            ZohoPostingReceipt(
                posting_proposal_id=proposal.id,
                approval_decision_id=latest_approval.id if latest_approval is not None else None,
                environment=self.SANDBOX_ENVIRONMENT,
                posting_mode="sandbox_execute",
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                target_object_type=contract.target_module,
                target_external_id=normalized.external_id,
                target_external_number=None,
                posting_status="sandbox_success",
                posted_at=datetime.now(timezone.utc),
                response_code="0",
                response_payload=normalized.raw_response,
                created_by=actor,
                updated_by=actor,
            )
        )

    def _record_attempt(
        self,
        *,
        proposal,
        actor: str,
        result: ExecutionResult,
        normalized: ZohoNormalizedResponse,
        receipt: ZohoPostingReceipt | None,
        reconciliation_context: dict[str, Any],
    ) -> ExternalExecutionAttempt:
        prior_attempts = self.execution_attempt_repository.list_for_proposal(
            proposal.id,
            execution_mode="sandbox_execute",
        )
        dry_run_artifact = self._latest_dry_run_artifact(proposal.id, result.request_hash)
        reconciliation_preconditions = {
            "requires_reconciliation": result.execution_status == "sandbox_unknown_outcome",
            "request_hash": result.request_hash,
            "idempotency_key": result.idempotency_key,
            "external_correlation_ids": normalized.external_correlation_ids,
        }
        return self.execution_attempt_repository.add(
            ExternalExecutionAttempt(
                posting_proposal_id=proposal.id,
                execution_mode="sandbox_execute",
                environment=self.SANDBOX_ENVIRONMENT,
                attempt_number=len(prior_attempts) + 1,
                request_hash=result.request_hash,
                idempotency_key=result.idempotency_key,
                dispatched_at=datetime.now(timezone.utc) if normalized.request_dispatched else None,
                completed_at=datetime.now(timezone.utc),
                outcome_status=result.execution_status,
                retryable_flag=result.retryable_flag,
                target_system=proposal.target_system,
                target_module=reconciliation_context.get("target_module"),
                target_object_type_hint=reconciliation_context.get("target_object_type_hint"),
                external_lookup_keys_json=reconciliation_context.get("external_lookup_keys", {}),
                request_correlation_json=reconciliation_context.get("request_correlation", {}),
                external_correlation_ids_json=normalized.external_correlation_ids,
                reconciliation_preconditions_json=reconciliation_preconditions,
                dry_run_artifact_id=dry_run_artifact.id if dry_run_artifact is not None else None,
                prepared_request_artifact_id=self._coerce_uuid(result.artifact_id),
                receipt_id=receipt.id if receipt is not None else None,
                created_by=actor,
                updated_by=actor,
            )
        )

    def _latest_dry_run_artifact(self, proposal_id, request_hash: str | None) -> DryRunExecutionArtifact | None:
        if request_hash is None:
            return None
        artifacts = self.execution_artifact_repository.list_for_proposal(proposal_id)
        dry_run_artifacts = [
            artifact
            for artifact in artifacts
            if artifact.execution_mode == "dry_run" and artifact.request_hash == request_hash
        ]
        return dry_run_artifacts[-1] if dry_run_artifacts else None

    def _unknown_outcome_resolution_status(self, attempt_id) -> str | None:
        if self.reconciliation_record_repository is None:
            return None
        latest = self.reconciliation_record_repository.latest_for_attempt(attempt_id)
        return latest.reconciliation_status if latest is not None else None

    def _build_reconciliation_context(
        self,
        *,
        proposal,
        contract,
        prepared_request: ZohoPreparedRequest,
        normalized: ZohoNormalizedResponse,
        request_hash: str,
        idempotency_key: str | None,
    ) -> dict[str, Any]:
        external_lookup_keys = self.sandbox_adapter.build_lookup_keys(contract=contract, prepared_request=prepared_request)
        request_correlation = {
            "headers": prepared_request.headers,
            "request_hash": request_hash,
            "idempotency_key": idempotency_key,
            "external_correlation_ids": normalized.external_correlation_ids,
        }
        return {
            "environment": self.SANDBOX_ENVIRONMENT,
            "target_system": proposal.target_system,
            "target_module": contract.target_module,
            "target_object_type_hint": contract.target_module,
            "external_lookup_keys": external_lookup_keys,
            "request_correlation": request_correlation,
        }

    def _normalized_failure_payload(
        self,
        *,
        code: str,
        message: str,
        category: str,
        retryable: bool,
    ) -> dict[str, Any]:
        return asdict(
            ZohoNormalizedResponse(
                status="retryable_failure" if retryable else "failure",
                external_id=None,
                raw_response={},
                normalized_errors=[{"code": code, "message": message, "category": category, "field": None}],
                retryable_flag=retryable,
                request_dispatched=False,
                external_correlation_ids={},
            )
        )

    def _normalized_response_from_payload(self, payload: dict[str, Any]) -> ZohoNormalizedResponse:
        return ZohoNormalizedResponse(
            status=str(payload.get("status")),
            external_id=payload.get("external_id"),
            raw_response=payload.get("raw_response", {}),
            normalized_errors=payload.get("normalized_errors", []),
            retryable_flag=bool(payload.get("retryable_flag", False)),
            request_dispatched=bool(payload.get("request_dispatched", False)),
            external_correlation_ids=payload.get("external_correlation_ids", {}),
        )

    def _require_proposal(self, proposal_id):
        proposal = self.proposal_repository.get(proposal_id)
        if proposal is None:
            raise ValueError(f"Unknown proposal_id: {proposal_id}")
        return proposal

    def _require_settings(self) -> Settings:
        if self.settings is None:
            raise ValueError("Execution settings are not configured.")
        return self.settings

    def _coerce_uuid(self, value):
        if value is None:
            return None
        try:
            return UUID(str(value))
        except (TypeError, ValueError, AttributeError):
            return value
