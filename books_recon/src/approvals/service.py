"""Approval and reviewer-edit foundation for proposals."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from core.hashing import stable_json_dumps, stable_payload_hash
from db.models.audit import AuditEvent
from db.models.workflow import ApprovalDecision, ExceptionCase, PostingProposal, PostingProposalLine
from db.repositories.audit import AuditEventRepository
from db.repositories.proposals import (
    ApprovalDecisionRepository,
    ProposalLineRepository,
    ProposalLineRevisionRepository,
    ProposalRepository,
    ProposalRevisionRepository,
)
from db.repositories.reference import AccountMasterRepository, VendorAliasRepository, VendorMasterRepository
from db.repositories.workflow import ExceptionCaseRepository
from master_data.service import MasterDataControlService
from revisions.service import ProposalRevisionService


class ProposalApprovalService:
    def __init__(
        self,
        *,
        proposal_repository: ProposalRepository,
        proposal_line_repository: ProposalLineRepository,
        approval_decision_repository: ApprovalDecisionRepository,
        exception_repository: ExceptionCaseRepository,
        audit_repository: AuditEventRepository,
        proposal_revision_repository: ProposalRevisionRepository,
        proposal_line_revision_repository: ProposalLineRevisionRepository,
        vendor_repository: VendorMasterRepository,
        vendor_alias_repository: VendorAliasRepository,
        account_repository: AccountMasterRepository,
    ) -> None:
        self.proposal_repository = proposal_repository
        self.proposal_line_repository = proposal_line_repository
        self.approval_decision_repository = approval_decision_repository
        self.exception_repository = exception_repository
        self.audit_repository = audit_repository
        self.master_data_service = MasterDataControlService(
            vendor_repository=vendor_repository,
            vendor_alias_repository=vendor_alias_repository,
            account_repository=account_repository,
        )
        self.revision_service = ProposalRevisionService(
            proposal_revision_repository=proposal_revision_repository,
            proposal_line_revision_repository=proposal_line_revision_repository,
        )

    def submit_for_review(self, proposal_id, reviewer: str, comment: str | None = None) -> PostingProposal:
        proposal = self._require_proposal(proposal_id)
        if proposal.status != "draft":
            raise ValueError(f"Only draft proposals can be submitted for review. Current status: {proposal.status}")
        before_state = self._serialize_proposal(proposal)
        self._refresh_input_fingerprint(proposal)
        self.refresh_safety(proposal.id)
        proposal.status = "pending_review"
        proposal.updated_by = reviewer
        self.revision_service.append_proposal_revision(
            proposal,
            revision_type="submit_for_review",
            edited_by=reviewer,
            edit_reason=comment,
            prior_values=before_state,
            new_values=self._serialize_proposal(proposal),
        )
        self._append_audit(
            "proposal_submitted_for_review",
            "posting_proposal",
            proposal.id,
            proposal.id,
            {"reviewer": reviewer, "comment": comment},
        )
        return proposal

    def apply_reviewer_line_edit(
        self,
        proposal_id,
        *,
        line_no: int,
        reviewer: str,
        edits: dict[str, Any],
        comment: str | None = None,
    ) -> PostingProposalLine:
        proposal = self._require_proposal(proposal_id)
        line = self.proposal_line_repository.find_by_order(proposal.id, line_no)
        if line is None:
            raise ValueError(f"Unknown line {line_no} for proposal {proposal.id}")
        if not line.review_required:
            raise ValueError("Reviewer edits are only allowed for review-required proposal lines.")

        allowed_fields = self._allowed_edit_fields(line.action_type)
        unknown = sorted(set(edits) - allowed_fields)
        if unknown:
            raise ValueError(f"Unsupported edits for {line.action_type}: {', '.join(unknown)}")

        before_proposal_state = self._serialize_proposal(proposal)
        before_state = self._serialize_line(line)
        self._apply_line_fields(proposal, line, edits)
        is_resolved = self._line_is_resolved(line)
        line.resolved_by_user = is_resolved
        line.review_required = not is_resolved
        line.is_blocking = line.review_required
        line.updated_by = reviewer
        if not line.review_required:
            line.review_reason_code = None

        self._refresh_input_fingerprint(proposal)
        self.refresh_safety(proposal.id)
        proposal.updated_by = reviewer
        self.revision_service.append_line_revision(
            line,
            revision_type="reviewer_edit",
            edited_by=reviewer,
            edit_reason=comment,
            prior_values=before_state,
            new_values=self._serialize_line(line),
        )
        self.revision_service.append_proposal_revision(
            proposal,
            revision_type="reviewer_edit",
            edited_by=reviewer,
            edit_reason=comment,
            prior_values=before_proposal_state,
            new_values=self._serialize_proposal(proposal),
        )
        self._append_audit(
            "proposal_line_edited",
            "posting_proposal_line",
            line.id,
            proposal.id,
            {
                "reviewer": reviewer,
                "comment": comment,
                "before": before_state,
                "after": self._serialize_line(line),
            },
        )
        return line

    def capture_decision(
        self,
        proposal_id,
        *,
        decision: str,
        reviewer: str,
        comment: str | None = None,
        edited_fields_payload: list[dict[str, Any]] | None = None,
        exception_case_id=None,
    ) -> ApprovalDecision:
        proposal = self._require_proposal(proposal_id)
        if proposal.status != "pending_review":
            raise ValueError(f"Only pending_review proposals can receive decisions. Current status: {proposal.status}")
        if decision not in {"approved", "approved_with_edits", "rejected"}:
            raise ValueError(f"Unsupported decision: {decision}")
        if proposal.status == "blocked":
            raise ValueError("Blocked proposals cannot be approved.")

        edited_payload = {"line_edits": edited_fields_payload or []}
        if edited_fields_payload:
            for item in edited_fields_payload:
                self.apply_reviewer_line_edit(
                    proposal.id,
                    line_no=int(item["line_no"]),
                    reviewer=reviewer,
                    edits=item.get("fields", {}),
                    comment=item.get("comment"),
                )

        self.refresh_safety(proposal.id)
        if decision in {"approved", "approved_with_edits"} and proposal.has_blocking_lines:
            self._ensure_exception(
                proposal=proposal,
                exception_type="proposal_unresolved_review_items",
                severity="high",
                summary="Proposal cannot be approved while blocking review items remain unresolved.",
                details_json={"unresolved_review_item_count": proposal.unresolved_review_item_count},
            )
            raise ValueError(f"Proposal {proposal.id} still has blocking lines.")

        if decision == "approved" and edited_fields_payload:
            raise ValueError("Use approved_with_edits when reviewer edits are supplied.")
        if decision == "approved_with_edits" and not edited_fields_payload:
            raise ValueError("approved_with_edits requires a non-empty edited_fields_payload.")

        before_state = self._serialize_proposal(proposal)
        self._refresh_input_fingerprint(proposal)
        proposal.status = decision
        proposal.updated_by = reviewer
        approval = ApprovalDecision(
            posting_proposal_id=proposal.id,
            classification_result_id=proposal.generated_from_classification_id,
            exception_case_id=self._coerce_uuid(exception_case_id),
            decision=decision,
            decision_by=reviewer,
            decision_at=datetime.now(timezone.utc),
            comment_text=comment,
            edited_payload=self._json_safe(edited_payload),
            is_final=True,
            created_by=reviewer,
            updated_by=reviewer,
        )
        self.approval_decision_repository.add(approval)

        linked_exception = None
        if exception_case_id:
            linked_exception = self.exception_repository.get(exception_case_id)
            if linked_exception is not None:
                linked_exception.approval_decision_id = approval.id
                linked_exception.posting_proposal_id = proposal.id
                linked_exception.status = "resolved"
                linked_exception.resolved_at = datetime.now(timezone.utc)
                linked_exception.resolution_note = comment or decision

        if decision == "rejected":
            linked_exception = self._ensure_exception(
                proposal=proposal,
                exception_type="reviewer_rejected_proposal",
                severity="medium",
                summary="Reviewer rejected the proposal.",
                details_json={"comment": comment, "approval_decision_id": str(approval.id)},
            )
            linked_exception.approval_decision_id = approval.id

        self.revision_service.append_proposal_revision(
            proposal,
            revision_type="decision_recorded",
            edited_by=reviewer,
            edit_reason=comment or decision,
            prior_values=before_state,
            new_values=self._serialize_proposal(proposal),
            approval_decision_id=approval.id,
        )
        self._append_audit(
            "proposal_decision_recorded",
            "approval_decision",
            approval.id,
            proposal.id,
            {
                "decision": decision,
                "reviewer": reviewer,
                "comment": comment,
                "edited_fields_payload": edited_fields_payload or [],
                "linked_exception_id": str(linked_exception.id) if linked_exception else None,
            },
        )
        return approval

    def invalidate_proposal(self, proposal_id, *, reviewer: str, comment: str | None = None) -> PostingProposal:
        proposal = self._require_proposal(proposal_id)
        if proposal.status == "superseded":
            raise ValueError("Superseded proposals cannot be invalidated.")
        if proposal.status == "invalidated":
            return proposal

        before_state = self._serialize_proposal(proposal)
        proposal.status = "invalidated"
        proposal.updated_by = reviewer
        self.refresh_safety(proposal.id)

        exception = self._ensure_exception(
            proposal=proposal,
            exception_type="proposal_invalidated",
            severity="high",
            summary="Proposal was invalidated because its target is not eligible for execution.",
            details_json={"comment": comment},
        )
        exception.resolution_note = comment

        self.revision_service.append_proposal_revision(
            proposal,
            revision_type="proposal_invalidated",
            edited_by=reviewer,
            edit_reason=comment or "proposal_invalidated",
            prior_values=before_state,
            new_values=self._serialize_proposal(proposal),
        )
        self._append_audit(
            "proposal_invalidated",
            "posting_proposal",
            proposal.id,
            proposal.id,
            {"reviewer": reviewer, "comment": comment, "exception_case_id": str(exception.id)},
        )
        return proposal

    def refresh_safety(self, proposal_id) -> PostingProposal:
        proposal = self._require_proposal(proposal_id)
        lines = self.proposal_line_repository.list_for_proposal(proposal.id)
        proposal.has_blocking_lines = any(line.is_blocking for line in lines)
        proposal.unresolved_review_item_count = sum(1 for line in lines if line.review_required)
        return proposal

    def _allowed_edit_fields(self, action_type: str) -> set[str]:
        mapping = {
            "create_vendor_bill": {"vendor_master_id"},
            "expense_placeholder": {"account_master_id"},
            "tax_placeholder": {"account_master_id", "tax_code"},
            "create_vendor_advance": {"resolution_choice"},
        }
        return mapping.get(action_type, set())

    def _apply_line_fields(self, proposal: PostingProposal, line: PostingProposalLine, edits: dict[str, Any]) -> None:
        if "vendor_master_id" in edits:
            vendor_master_id = self.master_data_service.require_active_vendor(self._coerce_uuid(edits["vendor_master_id"])).id
            for sibling in self.proposal_line_repository.list_for_proposal(proposal.id):
                sibling.vendor_master_id = vendor_master_id
            proposal.policy_flags = {**proposal.policy_flags, "vendor_master_id": str(edits["vendor_master_id"])}
        if "account_master_id" in edits:
            tax_code = edits.get("tax_code", line.tax_code)
            account = self.master_data_service.require_account_for_action(
                str(edits["account_master_id"]),
                action_type=line.action_type,
                tax_code=tax_code,
            )
            line.account_master_id = account.id
        if "tax_code" in edits:
            line.tax_code = self.master_data_service.validate_tax_code(edits["tax_code"])
        if "resolution_choice" in edits:
            line.allocation_json = {
                **line.allocation_json,
                "resolution_choice": self.master_data_service.validate_resolution_choice(edits["resolution_choice"]),
            }

    def _line_is_resolved(self, line: PostingProposalLine) -> bool:
        if line.action_type == "create_vendor_bill":
            if line.vendor_master_id is None:
                return False
            self.master_data_service.require_active_vendor(line.vendor_master_id)
            return True
        if line.action_type == "expense_placeholder":
            if line.account_master_id is None:
                return False
            self.master_data_service.require_account_for_action(str(line.account_master_id), action_type=line.action_type)
            return True
        if line.action_type == "tax_placeholder":
            if line.account_master_id is None or not line.tax_code:
                return False
            self.master_data_service.validate_tax_code(line.tax_code)
            self.master_data_service.require_account_for_action(
                str(line.account_master_id),
                action_type=line.action_type,
                tax_code=line.tax_code,
            )
            return True
        if line.action_type == "create_vendor_advance":
            resolution_choice = line.allocation_json.get("resolution_choice")
            return bool(resolution_choice and self.master_data_service.validate_resolution_choice(resolution_choice))
        return True

    def _serialize_proposal(self, proposal: PostingProposal) -> dict[str, Any]:
        return {
            "status": proposal.status,
            "has_blocking_lines": proposal.has_blocking_lines,
            "unresolved_review_item_count": proposal.unresolved_review_item_count,
            "policy_flags": proposal.policy_flags,
            "supersedes_proposal_id": str(proposal.supersedes_proposal_id) if proposal.supersedes_proposal_id else None,
            "superseded_by_proposal_id": str(proposal.superseded_by_proposal_id) if proposal.superseded_by_proposal_id else None,
            "supersession_reason": proposal.supersession_reason,
        }

    def _refresh_input_fingerprint(self, proposal: PostingProposal) -> None:
        proposal.input_fingerprint = stable_payload_hash(
            {
                "classification_result_id": str(proposal.generated_from_classification_id),
                "rule_version_id": str(proposal.rule_version_id),
                "proposal_type": proposal.proposal_type,
                "gross_amount": str(proposal.gross_amount),
                "policy_flags": proposal.policy_flags,
                "lines": [self._serialize_line_for_fingerprint(line) for line in self.proposal_line_repository.list_for_proposal(proposal.id)],
            }
        )

    def _serialize_line_for_fingerprint(self, line: PostingProposalLine) -> dict[str, Any]:
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

    def _ensure_exception(
        self,
        *,
        proposal: PostingProposal,
        exception_type: str,
        severity: str,
        summary: str,
        details_json: dict[str, Any],
    ) -> ExceptionCase:
        for existing in self.exception_repository.list_for_proposal(proposal.id):
            if existing.exception_type == exception_type and existing.status in ("open", "in_review"):
                return existing
        exception = ExceptionCase(
            exception_type=exception_type,
            conflict_type=None,
            severity=severity,
            status="open",
            classification_result_id=proposal.generated_from_classification_id,
            posting_proposal_id=proposal.id,
            related_object_type="posting_proposal",
            related_object_id=str(proposal.id),
            summary=summary,
            details_json=self._json_safe(details_json),
        )
        self.exception_repository.add(exception)
        return exception

    def _require_proposal(self, proposal_id) -> PostingProposal:
        proposal = self.proposal_repository.get(proposal_id)
        if proposal is None:
            raise ValueError(f"Unknown proposal_id: {proposal_id}")
        return proposal

    def _serialize_line(self, line: PostingProposalLine) -> dict[str, Any]:
        return {
            "line_no": line.line_no,
            "action_type": line.action_type,
            "account_master_id": str(line.account_master_id) if line.account_master_id else None,
            "vendor_master_id": str(line.vendor_master_id) if line.vendor_master_id else None,
            "tax_code": line.tax_code,
            "review_required": line.review_required,
            "review_reason_code": line.review_reason_code,
            "is_blocking": line.is_blocking,
            "resolved_by_user": line.resolved_by_user,
            "allocation_json": line.allocation_json,
        }

    def _append_audit(self, event_type: str, object_type: str, object_id, correlation_id, detail: dict[str, Any]) -> None:
        self.audit_repository.append_event(
            AuditEvent(
                event_ts=datetime.now(timezone.utc),
                event_type=event_type,
                actor_type="system",
                actor_id="proposal_approval_service",
                object_type=object_type,
                object_id=str(object_id),
                correlation_id=str(correlation_id),
                event_detail_json=self._json_safe(detail),
            )
        )

    def _json_safe(self, value: Any) -> Any:
        import json

        return json.loads(stable_json_dumps(value))

    def _coerce_uuid(self, value):
        if value is None:
            return None
        try:
            return UUID(str(value))
        except (TypeError, ValueError, AttributeError):
            return value
