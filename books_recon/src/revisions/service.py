"""Append-only proposal revision history support."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from core.hashing import stable_json_dumps
from db.models.workflow import PostingProposal, PostingProposalLine, ProposalLineRevision, ProposalRevision
from db.repositories.proposals import ProposalLineRevisionRepository, ProposalRevisionRepository


class ProposalRevisionService:
    def __init__(
        self,
        *,
        proposal_revision_repository: ProposalRevisionRepository,
        proposal_line_revision_repository: ProposalLineRevisionRepository,
    ) -> None:
        self.proposal_revision_repository = proposal_revision_repository
        self.proposal_line_revision_repository = proposal_line_revision_repository

    def append_proposal_revision(
        self,
        proposal: PostingProposal,
        *,
        revision_type: str,
        edited_by: str,
        edit_reason: str | None,
        prior_values: dict[str, Any],
        new_values: dict[str, Any],
        approval_decision_id=None,
        edited_at: datetime | None = None,
    ) -> ProposalRevision:
        timestamp = edited_at or datetime.now(timezone.utc)
        return self.proposal_revision_repository.add(
            ProposalRevision(
                posting_proposal_id=proposal.id,
                approval_decision_id=approval_decision_id,
                revision_type=revision_type,
                edited_by=edited_by,
                edited_at=timestamp,
                edit_reason=edit_reason,
                prior_values_json=self._json_safe(prior_values),
                new_values_json=self._json_safe(new_values),
                created_by=edited_by,
                updated_by=edited_by,
            )
        )

    def append_line_revision(
        self,
        line: PostingProposalLine,
        *,
        revision_type: str,
        edited_by: str,
        edit_reason: str | None,
        prior_values: dict[str, Any],
        new_values: dict[str, Any],
        approval_decision_id=None,
        edited_at: datetime | None = None,
    ) -> ProposalLineRevision:
        timestamp = edited_at or datetime.now(timezone.utc)
        return self.proposal_line_revision_repository.add(
            ProposalLineRevision(
                posting_proposal_id=line.posting_proposal_id,
                posting_proposal_line_id=line.id,
                approval_decision_id=approval_decision_id,
                line_no=line.line_no,
                revision_type=revision_type,
                edited_by=edited_by,
                edited_at=timestamp,
                edit_reason=edit_reason,
                prior_values_json=self._json_safe(prior_values),
                new_values_json=self._json_safe(new_values),
                created_by=edited_by,
                updated_by=edited_by,
            )
        )

    def list_history(self, proposal_id) -> dict[str, list]:
        return {
            "proposal_revisions": self.proposal_revision_repository.list_for_proposal(proposal_id),
            "line_revisions": self.proposal_line_revision_repository.list_for_proposal(proposal_id),
        }

    def _json_safe(self, value: Any) -> Any:
        import json

        return json.loads(stable_json_dumps(value))
