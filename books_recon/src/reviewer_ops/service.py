"""Thin reviewer-facing operations over proposal and approval services."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from approvals.service import ProposalApprovalService
from db.models.evidence import EvidenceBundle
from db.models.workflow import PostingProposal
from dry_run_execution.service import DryRunExecutionService, ExecutionResult
from db.repositories.proposals import (
    ApprovalDecisionRepository,
    ProposalLineRepository,
    ProposalLineRevisionRepository,
    ProposalRepository,
    ProposalRevisionRepository,
)
from db.repositories.workflow import ClassificationResultRepository
from master_data.service import MasterDataControlService
from preflight.service import DryRunPayload, PostingPreflightService, PreflightResult
from revisions.service import ProposalRevisionService


@dataclass(frozen=True)
class ProposalQueueItem:
    proposal_id: str
    status: str
    proposal_type: str
    narrative: str
    target_period_date: str
    unresolved_review_item_count: int
    has_blocking_lines: bool


class ReviewerOperationsService:
    def __init__(
        self,
        session: Session,
        *,
        proposal_repository: ProposalRepository,
        proposal_line_repository: ProposalLineRepository,
        proposal_revision_repository: ProposalRevisionRepository,
        proposal_line_revision_repository: ProposalLineRevisionRepository,
        classification_repository: ClassificationResultRepository,
        approval_decision_repository: ApprovalDecisionRepository,
        approval_service: ProposalApprovalService,
        master_data_service: MasterDataControlService,
        preflight_service: PostingPreflightService | None = None,
        dry_run_execution_service: DryRunExecutionService | None = None,
    ) -> None:
        self.session = session
        self.proposal_repository = proposal_repository
        self.proposal_line_repository = proposal_line_repository
        self.proposal_revision_repository = proposal_revision_repository
        self.proposal_line_revision_repository = proposal_line_revision_repository
        self.classification_repository = classification_repository
        self.approval_decision_repository = approval_decision_repository
        self.approval_service = approval_service
        self.master_data_service = master_data_service
        self.revision_service = ProposalRevisionService(
            proposal_revision_repository=proposal_revision_repository,
            proposal_line_revision_repository=proposal_line_revision_repository,
        )
        self.preflight_service = preflight_service
        self.dry_run_execution_service = dry_run_execution_service

    def list_pending_review(self) -> list[ProposalQueueItem]:
        return self._queue_items("pending_review")

    def list_blocked(self) -> list[ProposalQueueItem]:
        return [
            self._to_queue_item(proposal)
            for proposal in self.proposal_repository.list_all()
            if proposal.has_blocking_lines and proposal.status in {"draft", "pending_review"}
        ]

    def inspect_proposal(self, proposal_id) -> dict[str, Any]:
        proposal = self._require_proposal(proposal_id)
        classification = self.classification_repository.get(proposal.generated_from_classification_id)
        bundle = self.session.get(EvidenceBundle, classification.evidence_bundle_id) if classification else None
        lines = self.proposal_line_repository.list_for_proposal(proposal.id)
        history = self.revision_service.list_history(proposal.id)
        return {
            "proposal": proposal,
            "lines": lines,
            "blockers": [line for line in lines if line.is_blocking],
            "evidence_summary": bundle.evidence_summary if bundle is not None else None,
            "history_summary": {
                "proposal_revision_count": len(history["proposal_revisions"]),
                "line_revision_count": len(history["line_revisions"]),
                "supersession_reason": proposal.supersession_reason,
            },
            "revisions": history,
        }

    def apply_reviewer_edit(
        self,
        proposal_id,
        *,
        line_no: int,
        reviewer: str,
        edits: dict[str, Any],
        comment: str | None = None,
    ):
        normalized = self._normalize_edit_payload(edits)
        line = self.approval_service.apply_reviewer_line_edit(
            proposal_id,
            line_no=line_no,
            reviewer=reviewer,
            edits=normalized,
            comment=comment,
        )
        self.session.flush()
        return line

    def resolve_blocking_placeholder(
        self,
        proposal_id,
        *,
        line_no: int,
        reviewer: str,
        vendor_reference: str | None = None,
        account_reference: str | None = None,
        tax_code: str | None = None,
        resolution_choice: str | None = None,
        comment: str | None = None,
    ):
        edits: dict[str, Any] = {}
        if vendor_reference:
            edits["vendor_master_id"] = self.master_data_service.resolve_vendor_reference(vendor_reference).vendor_master.id
        if account_reference:
            edits["account_master_id"] = account_reference
        if tax_code:
            edits["tax_code"] = tax_code
        if resolution_choice:
            edits["resolution_choice"] = resolution_choice
        if not edits:
            raise ValueError("At least one resolution field is required.")
        return self.apply_reviewer_edit(proposal_id, line_no=line_no, reviewer=reviewer, edits=edits, comment=comment)

    def submit_for_review(self, proposal_id, *, reviewer: str, comment: str | None = None):
        return self.approval_service.submit_for_review(proposal_id, reviewer=reviewer, comment=comment)

    def approve(
        self,
        proposal_id,
        *,
        reviewer: str,
        comment: str | None = None,
        edited_fields_payload: list[dict[str, Any]] | None = None,
    ):
        return self.approval_service.capture_decision(
            proposal_id,
            decision="approved_with_edits" if edited_fields_payload else "approved",
            reviewer=reviewer,
            comment=comment,
            edited_fields_payload=self._normalize_edited_payload(edited_fields_payload or []),
        )

    def reject(self, proposal_id, *, reviewer: str, comment: str | None = None):
        return self.approval_service.capture_decision(
            proposal_id,
            decision="rejected",
            reviewer=reviewer,
            comment=comment,
        )

    def invalidate(self, proposal_id, *, reviewer: str, comment: str | None = None):
        return self.approval_service.invalidate_proposal(
            proposal_id,
            reviewer=reviewer,
            comment=comment,
        )

    def run_preflight(self, proposal_id) -> PreflightResult:
        if self.preflight_service is None:
            raise ValueError("Preflight service is not configured.")
        return self.preflight_service.evaluate_proposal(proposal_id)

    def inspect_dry_run_payload(self, proposal_id) -> DryRunPayload:
        if self.preflight_service is None:
            raise ValueError("Preflight service is not configured.")
        return self.preflight_service.build_dry_run_payload(proposal_id)

    def list_eligible_for_dry_run(self) -> list[PreflightResult]:
        if self.preflight_service is None:
            raise ValueError("Preflight service is not configured.")
        return self.preflight_service.list_eligible_proposals()

    def run_dry_run_executor(self, proposal_id, *, actor: str = "reviewer_ops") -> ExecutionResult:
        if self.dry_run_execution_service is None:
            raise ValueError("Dry-run execution service is not configured.")
        return self.dry_run_execution_service.execute(proposal_id, actor=actor, mode="dry_run")

    def run_executor(self, proposal_id, *, actor: str = "reviewer_ops", mode: str = "dry_run") -> ExecutionResult:
        if self.dry_run_execution_service is None:
            raise ValueError("Dry-run execution service is not configured.")
        return self.dry_run_execution_service.execute(proposal_id, actor=actor, mode=mode)

    def inspect_latest_dry_run_artifact(self, proposal_id):
        if self.dry_run_execution_service is None:
            raise ValueError("Dry-run execution service is not configured.")
        return self.dry_run_execution_service.inspect_latest_artifact(proposal_id)

    def _normalize_edited_payload(self, payload: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {
                "line_no": int(item["line_no"]),
                "fields": self._normalize_edit_payload(item.get("fields", {})),
                "comment": item.get("comment"),
            }
            for item in payload
        ]

    def _normalize_edit_payload(self, edits: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(edits)
        if "vendor_master_id" in normalized:
            normalized["vendor_master_id"] = self.master_data_service.resolve_vendor_reference(str(normalized["vendor_master_id"])).vendor_master.id
        return normalized

    def _queue_items(self, status: str) -> list[ProposalQueueItem]:
        return [self._to_queue_item(proposal) for proposal in self.proposal_repository.list_all() if proposal.status == status]

    def _to_queue_item(self, proposal: PostingProposal) -> ProposalQueueItem:
        return ProposalQueueItem(
            proposal_id=str(proposal.id),
            status=proposal.status,
            proposal_type=proposal.proposal_type,
            narrative=proposal.narrative,
            target_period_date=proposal.target_period_date.isoformat(),
            unresolved_review_item_count=proposal.unresolved_review_item_count,
            has_blocking_lines=proposal.has_blocking_lines,
        )

    def _require_proposal(self, proposal_id) -> PostingProposal:
        proposal = self.proposal_repository.get(proposal_id)
        if proposal is None:
            raise ValueError(f"Unknown proposal_id: {proposal_id}")
        return proposal
