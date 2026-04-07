"""Explicit reconciliation workflow for sandbox unknown-outcome attempts."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any

from connectors.zoho.sandbox_adapter import ZohoLookupResult, ZohoSandboxAdapter
from db.models.workflow import ExternalExecutionAttempt, SandboxReconciliationRecord, ZohoPostingReceipt
from db.repositories.proposals import (
    ApprovalDecisionRepository,
    ExternalExecutionAttemptRepository,
    SandboxReconciliationRecordRepository,
    ZohoPostingReceiptRepository,
)


@dataclass(frozen=True)
class ReconciliationInspectionItem:
    attempt_id: str
    proposal_id: str
    environment: str
    target_module: str | None
    idempotency_key: str | None
    request_hash: str | None
    completed_at: str
    lookup_keys: dict[str, Any]
    request_correlation: dict[str, Any]
    latest_reconciliation_status: str | None


@dataclass(frozen=True)
class ReconciliationResult:
    attempt_id: str
    reconciliation_status: str
    lookup_strategy: str
    matched_external_id: str | None
    matched_external_number: str | None
    receipt_id: str | None
    latest_lookup_response: dict[str, Any]
    reconciliation_record_id: str


class SandboxReconciliationService:
    SANDBOX_ENVIRONMENT = "sandbox"

    def __init__(
        self,
        *,
        execution_attempt_repository: ExternalExecutionAttemptRepository,
        reconciliation_record_repository: SandboxReconciliationRecordRepository,
        posting_receipt_repository: ZohoPostingReceiptRepository,
        approval_decision_repository: ApprovalDecisionRepository,
        sandbox_adapter: ZohoSandboxAdapter,
    ) -> None:
        self.execution_attempt_repository = execution_attempt_repository
        self.reconciliation_record_repository = reconciliation_record_repository
        self.posting_receipt_repository = posting_receipt_repository
        self.approval_decision_repository = approval_decision_repository
        self.sandbox_adapter = sandbox_adapter

    def inspect_unresolved_unknown_outcomes(self) -> list[ReconciliationInspectionItem]:
        items: list[ReconciliationInspectionItem] = []
        for attempt in self.execution_attempt_repository.list_unknown_outcomes(environment=self.SANDBOX_ENVIRONMENT):
            latest = self.reconciliation_record_repository.latest_for_attempt(attempt.id)
            if latest is not None and latest.reconciliation_status in {"reconciled_success", "reconciled_failure"}:
                continue
            items.append(
                ReconciliationInspectionItem(
                    attempt_id=str(attempt.id),
                    proposal_id=str(attempt.posting_proposal_id),
                    environment=attempt.environment,
                    target_module=attempt.target_module,
                    idempotency_key=attempt.idempotency_key,
                    request_hash=attempt.request_hash,
                    completed_at=attempt.completed_at.isoformat(),
                    lookup_keys=attempt.external_lookup_keys_json or {},
                    request_correlation=attempt.request_correlation_json or {},
                    latest_reconciliation_status=latest.reconciliation_status if latest is not None else None,
                )
            )
        return items

    def reconcile_attempt(self, attempt_id, *, actor: str = "sandbox_reconciler") -> ReconciliationResult:
        attempt = self._require_attempt(attempt_id)
        if attempt.environment != self.SANDBOX_ENVIRONMENT:
            raise ValueError(f"Unsupported reconciliation environment: {attempt.environment}")
        if attempt.outcome_status != "sandbox_unknown_outcome":
            raise ValueError(f"Attempt {attempt.id} is not in sandbox_unknown_outcome.")

        lookup = self.sandbox_adapter.lookup_existing(
            target_module=str(attempt.target_module),
            environment=attempt.environment,
            lookup_keys=attempt.external_lookup_keys_json or {},
            request_correlation=attempt.request_correlation_json or {},
        )
        status = self._derive_reconciliation_status(lookup)
        receipt = None
        if status == "reconciled_success":
            receipt = self._record_reconciled_success_receipt(attempt=attempt, lookup=lookup, actor=actor)
        record = self.reconciliation_record_repository.add(
            SandboxReconciliationRecord(
                external_execution_attempt_id=attempt.id,
                posting_proposal_id=attempt.posting_proposal_id,
                environment=attempt.environment,
                reconciliation_status=status,
                lookup_strategy=lookup.lookup_strategy,
                target_system=attempt.target_system,
                target_module=attempt.target_module,
                request_hash=attempt.request_hash,
                idempotency_key=attempt.idempotency_key,
                lookup_context_json={
                    "external_lookup_keys": attempt.external_lookup_keys_json or {},
                    "request_correlation": attempt.request_correlation_json or {},
                    "external_correlation_ids": attempt.external_correlation_ids_json or {},
                },
                external_lookup_response_json=lookup.raw_response,
                matched_external_id=lookup.matched_external_id,
                matched_external_number=lookup.matched_external_number,
                receipt_id=receipt.id if receipt is not None else None,
                reconciled_at=datetime.now(timezone.utc),
                created_by=actor,
                updated_by=actor,
            )
        )
        return ReconciliationResult(
            attempt_id=str(attempt.id),
            reconciliation_status=status,
            lookup_strategy=lookup.lookup_strategy,
            matched_external_id=lookup.matched_external_id,
            matched_external_number=lookup.matched_external_number,
            receipt_id=str(receipt.id) if receipt is not None else None,
            latest_lookup_response=lookup.raw_response,
            reconciliation_record_id=str(record.id),
        )

    def _derive_reconciliation_status(self, lookup: ZohoLookupResult) -> str:
        if lookup.status == "matched":
            return "reconciled_success"
        if lookup.status == "not_found":
            return "reconciled_failure"
        return "still_unknown"

    def _record_reconciled_success_receipt(
        self,
        *,
        attempt: ExternalExecutionAttempt,
        lookup: ZohoLookupResult,
        actor: str,
    ) -> ZohoPostingReceipt:
        existing = None
        if attempt.idempotency_key is not None:
            existing = self.posting_receipt_repository.find_by_idempotency_key(
                attempt.idempotency_key,
                environment=attempt.environment,
            )
        if existing is not None:
            return existing
        latest_approval = self.approval_decision_repository.latest_for_proposal(attempt.posting_proposal_id)
        return self.posting_receipt_repository.add(
            ZohoPostingReceipt(
                posting_proposal_id=attempt.posting_proposal_id,
                approval_decision_id=latest_approval.id if latest_approval is not None else None,
                environment=attempt.environment,
                posting_mode="sandbox_reconciled",
                idempotency_key=str(attempt.idempotency_key),
                request_hash=str(attempt.request_hash),
                target_object_type=str(attempt.target_module),
                target_external_id=lookup.matched_external_id,
                target_external_number=lookup.matched_external_number,
                posting_status="sandbox_success",
                posted_at=datetime.now(timezone.utc),
                response_code="reconciled",
                response_payload=lookup.raw_response,
                created_by=actor,
                updated_by=actor,
            )
        )

    def _require_attempt(self, attempt_id) -> ExternalExecutionAttempt:
        attempt = self.execution_attempt_repository.get(attempt_id)
        if attempt is None:
            raise ValueError(f"Unknown external_execution_attempt_id: {attempt_id}")
        return attempt

    def as_dict(self, result: ReconciliationResult) -> dict[str, Any]:
        return asdict(result)
