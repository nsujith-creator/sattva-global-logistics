"""Proposal supersession history helpers."""

from __future__ import annotations

from typing import Any

from core.hashing import stable_json_dumps
from db.models.workflow import ClassificationResult, PostingProposal, PostingProposalLine


class ProposalHistoryService:
    def summarize_changes(
        self,
        previous_proposal: PostingProposal,
        previous_lines: list[PostingProposalLine],
        replacement_proposal: PostingProposal,
        replacement_lines_payload: list[dict[str, Any]],
        replacement_classification: ClassificationResult,
    ) -> dict[str, Any]:
        previous_bill_refs = sorted(
            str(line.zoho_target_object_ref or line.allocation_json.get("bill_number"))
            for line in previous_lines
            if line.action_type in ("apply_bill", "create_vendor_bill")
        )
        replacement_bill_refs = sorted(
            str(line.get("zoho_target_object_ref") or line.get("allocation_json", {}).get("bill_number"))
            for line in replacement_lines_payload
            if line["action_type"] in ("apply_bill", "create_vendor_bill")
        )
        previous_allocations = [stable_json_dumps(line.allocation_json) for line in previous_lines]
        replacement_allocations = [stable_json_dumps(line.get("allocation_json", {})) for line in replacement_lines_payload]
        changes: list[str] = []
        if previous_bill_refs != replacement_bill_refs:
            changes.append("linked bill changed")
        if previous_allocations != replacement_allocations:
            changes.append("allocation changed")
        if str(previous_proposal.policy_flags.get("residual_amount")) != str(replacement_proposal.policy_flags.get("residual_amount")):
            changes.append("residual changed")
        if (
            str(previous_proposal.rule_version_id) != str(replacement_classification.rule_version_id)
            or str(previous_proposal.input_fingerprint) != str(replacement_proposal.input_fingerprint)
        ):
            changes.append("confidence/context changed")
        if len(previous_lines) != len(replacement_lines_payload) or any(
            previous_line.action_type != replacement_lines_payload[idx]["action_type"] for idx, previous_line in enumerate(previous_lines)
        ):
            changes.append("proposal lines changed")
        return {
            "changes": changes or ["proposal regenerated with no material semantic change"],
            "previous_bill_refs": previous_bill_refs,
            "replacement_bill_refs": replacement_bill_refs,
        }
