"""Deterministic posting-readiness preflight and dry-run payload generation."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date
from typing import Any

from core.hashing import stable_payload_hash
from db.models.workflow import PostingProposal, PostingProposalLine
from db.repositories.proposals import ApprovalDecisionRepository, ProposalLineRepository, ProposalRepository, ProposalRevisionRepository
from db.repositories.reference import PeriodLockRepository
from db.repositories.workflow import ClassificationResultRepository
from db.repositories.zoho import ZohoSnapshotRepository
from master_data.service import MasterDataControlService


@dataclass(frozen=True)
class PreflightResult:
    proposal_id: str
    proposal_type: str
    eligible_for_posting: bool
    posting_block_reasons: list[str]
    preflight_status: str
    idempotency_key: str | None
    resolved_inputs: dict[str, Any]


@dataclass(frozen=True)
class DryRunPayload:
    proposal_id: str
    proposal_type: str
    target_system: str
    target_module: str
    payload_version: str
    idempotency_key: str | None
    preflight_status: str
    blocking_reasons: list[str]
    resolved_inputs: dict[str, Any]
    payload_body: dict[str, Any]


class PostingPreflightService:
    PAYLOAD_VERSION = "2026.03.d6.1"
    SUPPORTED_TYPES = {"vendor_payment_apply", "vendor_bill_create"}
    APPROVED_STATUSES = {"approved", "approved_with_edits"}

    def __init__(
        self,
        *,
        proposal_repository: ProposalRepository,
        proposal_line_repository: ProposalLineRepository,
        proposal_revision_repository: ProposalRevisionRepository,
        approval_decision_repository: ApprovalDecisionRepository,
        classification_repository: ClassificationResultRepository,
        period_lock_repository: PeriodLockRepository,
        master_data_service: MasterDataControlService,
        zoho_snapshot_repository: ZohoSnapshotRepository | None = None,
    ) -> None:
        self.proposal_repository = proposal_repository
        self.proposal_line_repository = proposal_line_repository
        self.proposal_revision_repository = proposal_revision_repository
        self.approval_decision_repository = approval_decision_repository
        self.classification_repository = classification_repository
        self.period_lock_repository = period_lock_repository
        self.master_data_service = master_data_service
        self.zoho_snapshot_repository = zoho_snapshot_repository or ZohoSnapshotRepository(proposal_repository.session)

    def evaluate_proposal(self, proposal_id) -> PreflightResult:
        proposal = self._require_proposal(proposal_id)
        lines = self.proposal_line_repository.list_for_proposal(proposal.id)
        classification = self.classification_repository.get(proposal.generated_from_classification_id)
        latest_approval = self.approval_decision_repository.latest_for_proposal(proposal.id)
        reasons: list[str] = []

        if proposal.status not in self.APPROVED_STATUSES:
            reasons.append("proposal not approved")
        if proposal.status == "invalidated":
            reasons.append("proposal invalidated")
        if proposal.proposal_type not in self.SUPPORTED_TYPES:
            reasons.append("unsupported proposal type")
        if proposal.superseded_by_proposal_id is not None or proposal.status == "superseded":
            reasons.append("proposal superseded")
        if classification is None:
            reasons.append("classification missing")
        else:
            if classification.supersedes_classification_id is not None:
                reasons.append("classification superseded or stale")
            if self.classification_repository.find_superseding(classification.id) is not None:
                reasons.append("classification superseded or stale")
            if str(proposal.rule_version_id) != str(classification.rule_version_id):
                reasons.append("fingerprint/rule/input mismatch")
        if proposal.has_blocking_lines or any(line.is_blocking or line.review_required for line in lines):
            reasons.append("unresolved blocking lines")
        if self._has_missing_master_data(lines):
            reasons.append("missing vendor/account/tax/master-data requirements")
        reasons.extend(self._target_eligibility_reasons(lines))
        if self._is_locked_period(proposal.target_period_date):
            reasons.append("locked period")
        if proposal.proposal_type == "vendor_payment_apply" and self._has_unresolved_residual(lines):
            reasons.append("residual unresolved")

        expected_input_fingerprint = self._recompute_input_fingerprint(proposal, lines)
        if proposal.input_fingerprint != expected_input_fingerprint:
            reasons.append("fingerprint/rule/input mismatch")

        idempotency_key = self._build_idempotency_key(proposal, latest_approval)
        if idempotency_key is None:
            reasons.append("missing idempotency seed")

        if latest_approval is None:
            reasons.append("approval state validity")
        else:
            for revision in self.proposal_revision_repository.list_for_proposal(proposal.id):
                if str(revision.approval_decision_id) == str(latest_approval.id) and revision.revision_type == "decision_recorded":
                    continue
                if revision.edited_at > latest_approval.decision_at:
                    reasons.append("proposal data changed since approval")
                    break

        reasons = list(dict.fromkeys(reasons))
        preflight_status = self._derive_status(reasons)
        return PreflightResult(
            proposal_id=str(proposal.id),
            proposal_type=proposal.proposal_type,
            eligible_for_posting=preflight_status == "ready",
            posting_block_reasons=reasons,
            preflight_status=preflight_status,
            idempotency_key=idempotency_key,
            resolved_inputs=self._resolved_inputs(proposal, lines, classification, latest_approval),
        )

    def build_dry_run_payload(self, proposal_id) -> DryRunPayload:
        proposal = self._require_proposal(proposal_id)
        lines = self.proposal_line_repository.list_for_proposal(proposal.id)
        preflight = self.evaluate_proposal(proposal.id)
        payload_body = self._build_payload_body(proposal, lines, preflight)
        return DryRunPayload(
            proposal_id=str(proposal.id),
            proposal_type=proposal.proposal_type,
            target_system=proposal.target_system,
            target_module=self._target_module(proposal.proposal_type),
            payload_version=self.PAYLOAD_VERSION,
            idempotency_key=preflight.idempotency_key,
            preflight_status=preflight.preflight_status,
            blocking_reasons=preflight.posting_block_reasons,
            resolved_inputs=preflight.resolved_inputs,
            payload_body=payload_body,
        )

    def list_eligible_proposals(self) -> list[PreflightResult]:
        eligible: list[PreflightResult] = []
        for proposal in self.proposal_repository.list_all():
            result = self.evaluate_proposal(proposal.id)
            if result.eligible_for_posting:
                eligible.append(result)
        return eligible

    def _build_payload_body(
        self,
        proposal: PostingProposal,
        lines: list[PostingProposalLine],
        preflight: PreflightResult,
    ) -> dict[str, Any]:
        if proposal.proposal_type == "vendor_payment_apply":
            apply_line = next((line for line in lines if line.action_type == "apply_bill"), None)
            residual_line = next((line for line in lines if line.action_type == "create_vendor_advance"), None)
            return {
                "posting_intent": "apply_vendor_payment",
                "bill_allocation": {
                    "bill_external_ref": apply_line.zoho_target_object_ref if apply_line else None,
                    "allocation_details": apply_line.allocation_json if apply_line else {},
                    "amount": str(apply_line.amount) if apply_line else None,
                },
                "residual_handling": {
                    "present": residual_line is not None,
                    "resolved": bool(residual_line and not residual_line.review_required),
                    "resolution_choice": residual_line.allocation_json.get("resolution_choice") if residual_line else None,
                    "details": residual_line.allocation_json if residual_line else {},
                },
                "review_state": {
                    "approved_status": proposal.status,
                    "preflight_status": preflight.preflight_status,
                },
            }
        if proposal.proposal_type == "vendor_bill_create":
            return {
                "posting_intent": "create_vendor_bill",
                "bill_header": {
                    "narrative": proposal.narrative,
                    "target_period_date": proposal.target_period_date.isoformat(),
                    "gross_amount": str(proposal.gross_amount),
                },
                "bill_lines": [
                    {
                        "line_no": line.line_no,
                        "action_type": line.action_type,
                        "description": line.description,
                        "amount": str(line.amount),
                        "vendor_master_id": str(line.vendor_master_id) if line.vendor_master_id else None,
                        "account_master_id": str(line.account_master_id) if line.account_master_id else None,
                        "tax_code": line.tax_code,
                        "review_required": line.review_required,
                        "allocation_json": line.allocation_json,
                    }
                    for line in lines
                ],
                "placeholder_state": {
                    "unresolved_placeholders": [
                        {
                            "line_no": line.line_no,
                            "action_type": line.action_type,
                            "review_reason_code": line.review_reason_code,
                        }
                        for line in lines
                        if line.review_required
                    ],
                    "final_accounting_certainty": "not_fabricated",
                },
            }
        return {
            "posting_intent": "unsupported",
            "details": {"proposal_type": proposal.proposal_type},
        }

    def _resolved_inputs(self, proposal, lines, classification, latest_approval) -> dict[str, Any]:
        return {
            "proposal_status": proposal.status,
            "rule_version_id": str(proposal.rule_version_id),
            "classification_result_id": str(proposal.generated_from_classification_id),
            "classification_superseded": bool(classification and self.classification_repository.find_superseding(classification.id)),
            "target_period_code": proposal.target_period_date.strftime("%Y-%m"),
            "latest_approval_id": str(latest_approval.id) if latest_approval else None,
            "line_resolutions": [
                {
                    "line_no": line.line_no,
                    "action_type": line.action_type,
                    "vendor_master_id": str(line.vendor_master_id) if line.vendor_master_id else None,
                    "account_master_id": str(line.account_master_id) if line.account_master_id else None,
                    "tax_code": line.tax_code,
                    "review_required": line.review_required,
                }
                for line in lines
            ],
        }

    def _target_module(self, proposal_type: str) -> str:
        mapping = {
            "vendor_payment_apply": "vendor_payments",
            "vendor_bill_create": "vendor_bills",
        }
        return mapping.get(proposal_type, "unsupported")

    def _target_eligibility_reasons(self, lines: list[PostingProposalLine]) -> list[str]:
        reasons: list[str] = []
        for line in lines:
            if not line.zoho_target_object_type or not line.zoho_target_object_ref:
                continue
            eligibility = self.zoho_snapshot_repository.evaluate_ref(
                str(line.zoho_target_object_type),
                str(line.zoho_target_object_ref),
            )
            if eligibility.is_eligible:
                continue
            reasons.append(
                f"line {line.line_no} zoho target ineligible: {', '.join(eligibility.reasons)}"
            )
        return reasons

    def _has_missing_master_data(self, lines: list[PostingProposalLine]) -> bool:
        for line in lines:
            if line.action_type == "create_vendor_bill":
                if line.vendor_master_id is None:
                    return True
                try:
                    self.master_data_service.require_active_vendor(line.vendor_master_id)
                except ValueError:
                    return True
            if line.action_type == "expense_placeholder":
                if line.account_master_id is None:
                    return True
                try:
                    self.master_data_service.require_account_for_action(str(line.account_master_id), action_type=line.action_type)
                except ValueError:
                    return True
            if line.action_type == "tax_placeholder":
                if line.account_master_id is None or not line.tax_code:
                    return True
                try:
                    self.master_data_service.require_account_for_action(
                        str(line.account_master_id),
                        action_type=line.action_type,
                        tax_code=line.tax_code,
                    )
                    self.master_data_service.validate_tax_code(line.tax_code)
                except ValueError:
                    return True
        return False

    def _has_unresolved_residual(self, lines: list[PostingProposalLine]) -> bool:
        residual_line = next((line for line in lines if line.action_type == "create_vendor_advance"), None)
        return bool(residual_line and residual_line.review_required)

    def _recompute_input_fingerprint(self, proposal: PostingProposal, lines: list[PostingProposalLine]) -> str:
        payload = {
            "classification_result_id": str(proposal.generated_from_classification_id),
            "rule_version_id": str(proposal.rule_version_id),
            "proposal_type": proposal.proposal_type,
            "gross_amount": str(proposal.gross_amount),
            "policy_flags": proposal.policy_flags,
            "lines": [self._line_fingerprint_payload(line) for line in lines],
        }
        return stable_payload_hash(payload)

    def _is_locked_period(self, target_period_date: date) -> bool:
        period_code = target_period_date.strftime("%Y-%m")
        return any(lock.lock_state.lower() in {"locked", "hard_locked", "closed"} for lock in self.period_lock_repository.get_for_period_code(period_code))

    def _build_idempotency_key(self, proposal: PostingProposal, latest_approval) -> str | None:
        if latest_approval is None or not proposal.proposal_fingerprint or not proposal.input_fingerprint:
            return None
        seed = {
            "proposal_id": str(proposal.id),
            "proposal_fingerprint": proposal.proposal_fingerprint,
            "input_fingerprint": proposal.input_fingerprint,
            "approval_decision_id": str(latest_approval.id),
            "proposal_type": proposal.proposal_type,
            "payload_version": self.PAYLOAD_VERSION,
        }
        return stable_payload_hash(seed)

    def _derive_status(self, reasons: list[str]) -> str:
        if not reasons:
            return "ready"
        if "unsupported proposal type" in reasons:
            return "unsupported"
        if "proposal not approved" in reasons or "approval state validity" in reasons:
            return "blocked"
        stale_reasons = {
            "proposal superseded",
            "classification superseded or stale",
            "proposal data changed since approval",
            "fingerprint/rule/input mismatch",
        }
        if any(reason in stale_reasons for reason in reasons):
            return "stale"
        return "blocked"

    def _require_proposal(self, proposal_id) -> PostingProposal:
        proposal = self.proposal_repository.get(proposal_id)
        if proposal is None:
            raise ValueError(f"Unknown proposal_id: {proposal_id}")
        return proposal

    def _line_fingerprint_payload(self, line: PostingProposalLine) -> dict[str, Any]:
        payload = {
            "line_no": line.line_no,
            "action_type": line.action_type,
            "description": line.description,
            "amount": str(line.amount),
            "zoho_target_object_type": line.zoho_target_object_type,
            "zoho_target_object_ref": line.zoho_target_object_ref,
            "quantity": str(line.quantity) if line.quantity is not None else None,
            "rate": str(line.rate) if line.rate is not None else None,
            "tax_code": line.tax_code,
            "review_required": line.review_required,
            "review_reason_code": line.review_reason_code,
            "is_blocking": line.is_blocking,
            "resolved_by_user": line.resolved_by_user,
            "allocation_json": line.allocation_json,
        }
        if line.quantity is None:
            payload.pop("quantity")
        if line.rate is None:
            payload.pop("rate")
        if line.tax_code is None:
            payload.pop("tax_code")
        if line.zoho_target_object_type is None:
            payload.pop("zoho_target_object_type")
        if line.zoho_target_object_ref is None:
            payload.pop("zoho_target_object_ref")
        if line.account_master_id is not None:
            payload["account_master_id"] = str(line.account_master_id)
        if line.vendor_master_id is not None:
            payload["vendor_master_id"] = str(line.vendor_master_id)
        return payload

    def as_payload_dict(self, payload: DryRunPayload) -> dict[str, Any]:
        return asdict(payload)
