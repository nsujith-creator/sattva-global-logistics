"""Proposal foundation for deterministic reviewable posting intents."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.hashing import stable_json_dumps, stable_payload_hash
from db.models.audit import AuditEvent
from db.models.banking import BankTransaction
from db.models.evidence import EvidenceBundle
from db.models.reference import VendorMaster
from db.models.tax import GstPurchaseLine
from db.models.workflow import ClassificationResult, ExceptionCase, MatchCandidate, PostingProposal, PostingProposalLine
from db.models.zoho import ZohoSnapshotBill
from db.repositories.audit import AuditEventRepository
from db.repositories.proposals import ProposalLineRepository, ProposalRepository
from db.repositories.zoho import ZohoSnapshotRepository
from db.repositories.workflow import ClassificationResultRepository, ExceptionCaseRepository, MatchCandidateRepository
from proposals.history import ProposalHistoryService


@dataclass(frozen=True)
class ProposalBuildOutcome:
    proposal: PostingProposal | None
    lines: list[PostingProposalLine]
    exception_case: ExceptionCase | None


class ProposalBuilder:
    def __init__(
        self,
        session: Session,
        *,
        proposal_repository: ProposalRepository,
        proposal_line_repository: ProposalLineRepository,
        classification_repository: ClassificationResultRepository,
        match_candidate_repository: MatchCandidateRepository,
        exception_repository: ExceptionCaseRepository,
        audit_repository: AuditEventRepository,
        zoho_snapshot_repository: ZohoSnapshotRepository | None = None,
        config: dict[str, Any] | None = None,
    ) -> None:
        self.session = session
        self.proposal_repository = proposal_repository
        self.proposal_line_repository = proposal_line_repository
        self.classification_repository = classification_repository
        self.match_candidate_repository = match_candidate_repository
        self.exception_repository = exception_repository
        self.audit_repository = audit_repository
        self.zoho_snapshot_repository = zoho_snapshot_repository or ZohoSnapshotRepository(session)
        self.history_service = ProposalHistoryService()
        self.config = {
            "minimum_confidence": Decimal("0.90"),
            "vendor_payment_max_bill_candidates": 1,
            **(config or {}),
        }

    def build_for_classification(self, classification_result_id: str) -> ProposalBuildOutcome:
        classification = self.classification_repository.get(classification_result_id)
        if classification is None:
            raise ValueError(f"Unknown classification_result_id: {classification_result_id}")

        bundle = self.session.get(EvidenceBundle, classification.evidence_bundle_id)
        if bundle is None:
            raise ValueError(f"Missing evidence bundle for classification {classification_result_id}")

        open_conflicts = self._open_exceptions_for_bundle(bundle.id)
        if open_conflicts:
            return ProposalBuildOutcome(
                proposal=None,
                lines=[],
                exception_case=self._ensure_exception(
                    bundle_id=bundle.id,
                    related_object_type="classification_result",
                    related_object_id=classification.id,
                    exception_type="proposal_blocked_conflict",
                    severity="high",
                    summary="Proposal generation blocked because the bundle still has open conflicts.",
                    details_json={"blocking_exception_ids": [str(item.id) for item in open_conflicts]},
                ),
            )

        if Decimal(str(classification.confidence_score)) < Decimal(str(self.config["minimum_confidence"])):
            return ProposalBuildOutcome(
                proposal=None,
                lines=[],
                exception_case=self._ensure_exception(
                    bundle_id=bundle.id,
                    related_object_type="classification_result",
                    related_object_id=classification.id,
                    exception_type="proposal_low_confidence",
                    severity="medium",
                    summary="Proposal generation blocked because classification confidence is below threshold.",
                    details_json={"confidence_score": str(classification.confidence_score)},
                ),
            )

        if classification.classification_type == "vendor_payment":
            return self._build_vendor_payment_proposal(classification, bundle)
        if classification.classification_type == "missing_bill_candidate":
            return self._build_missing_bill_proposal(classification, bundle)

        return ProposalBuildOutcome(
            proposal=None,
            lines=[],
            exception_case=self._ensure_exception(
                bundle_id=bundle.id,
                related_object_type="classification_result",
                related_object_id=classification.id,
                exception_type="proposal_unsupported_classification",
                severity="medium",
                summary=f"Proposal generation is not implemented for {classification.classification_type}.",
                details_json={"classification_type": classification.classification_type},
            ),
        )

    def _build_vendor_payment_proposal(
        self,
        classification: ClassificationResult,
        bundle: EvidenceBundle,
    ) -> ProposalBuildOutcome:
        transaction = self.session.get(BankTransaction, self._coerce_object_id(bundle.primary_record_id))
        if transaction is None:
            raise ValueError(f"Missing bank transaction for bundle {bundle.id}")

        candidates = self.match_candidate_repository.list_for_bundle(bundle.id)
        accepted_bills = [candidate for candidate in candidates if candidate.to_object_type == "zoho_snapshot_bill" and candidate.decision_status == "accepted"]
        if len(accepted_bills) != 1:
            return ProposalBuildOutcome(
                proposal=None,
                lines=[],
                exception_case=self._ensure_exception(
                    bundle_id=bundle.id,
                    related_object_type="classification_result",
                    related_object_id=classification.id,
                    exception_type="proposal_ambiguous_vendor_payment",
                    severity="high",
                    summary="Vendor payment proposal blocked because bill settlement is ambiguous.",
                    details_json={"candidate_ids": [str(candidate.id) for candidate in accepted_bills or candidates]},
                ),
            )

        bill_candidate = accepted_bills[0]
        bill = self.session.get(ZohoSnapshotBill, self._coerce_object_id(bill_candidate.to_object_id))
        if bill is None:
            raise ValueError(f"Missing bill {bill_candidate.to_object_id} for vendor payment proposal.")
        eligibility = self.zoho_snapshot_repository.evaluate_instance("bill", bill)
        if not eligibility.is_eligible:
            return ProposalBuildOutcome(
                proposal=None,
                lines=[],
                exception_case=self._ensure_exception(
                    bundle_id=bundle.id,
                    related_object_type="classification_result",
                    related_object_id=classification.id,
                    exception_type="proposal_ineligible_zoho_target",
                    severity="high",
                    summary="Vendor payment proposal blocked because the accepted Zoho bill target is not eligible.",
                    details_json={
                        "candidate_id": str(bill_candidate.id),
                        "zoho_object_id": bill.zoho_object_id,
                        "eligibility_reasons": eligibility.reasons,
                    },
                ),
            )

        settlement_amount = min(Decimal(str(transaction.amount)), Decimal(str(bill.balance)))
        residual_amount = Decimal(str(transaction.amount)) - settlement_amount
        if settlement_amount <= 0:
            return ProposalBuildOutcome(
                proposal=None,
                lines=[],
                exception_case=self._ensure_exception(
                    bundle_id=bundle.id,
                    related_object_type="classification_result",
                    related_object_id=classification.id,
                    exception_type="proposal_insufficient_evidence",
                    severity="high",
                    summary="Vendor payment proposal blocked because settlement amount could not be derived safely.",
                    details_json={"transaction_amount": str(transaction.amount), "bill_balance": str(bill.balance)},
                ),
            )

        payload = {
            "classification_result_id": str(classification.id),
            "proposal_type": "vendor_payment_apply",
            "target_period_date": classification.accounting_period_date.isoformat(),
            "gross_amount": str(transaction.amount),
            "settlement_amount": str(settlement_amount),
            "residual_amount": str(residual_amount),
            "bill_id": str(bill.id),
            "bill_number": bill.bill_number,
            "bank_transaction_id": str(transaction.id),
            "rule_version_id": str(classification.rule_version_id),
        }
        proposal_fingerprint = stable_payload_hash(payload)
        lines_payload = [
            {
                "line_no": 1,
                "action_type": "apply_bill",
                "description": f"Apply bank transaction {transaction.id} to bill {bill.bill_number}.",
                "amount": str(settlement_amount),
                "zoho_target_object_type": "bill",
                "zoho_target_object_ref": bill.zoho_object_id,
                "allocation_json": {
                    "bank_transaction_id": str(transaction.id),
                    "bill_id": str(bill.id),
                    "bill_number": bill.bill_number,
                    "settlement_amount": str(settlement_amount),
                },
                "review_required": False,
                "review_reason_code": None,
                "is_blocking": False,
                "resolved_by_user": False,
            }
        ]
        if residual_amount > 0:
            lines_payload.append(
                {
                    "line_no": 2,
                    "action_type": "create_vendor_advance",
                    "description": "Residual amount requires reviewer confirmation before vendor advance handling.",
                    "amount": str(residual_amount),
                    "zoho_target_object_type": None,
                    "zoho_target_object_ref": None,
                    "allocation_json": {
                        "bank_transaction_id": str(transaction.id),
                        "reason": "residual_amount_unallocated",
                    },
                    "review_required": True,
                    "review_reason_code": "residual_amount_unallocated",
                    "is_blocking": True,
                    "resolved_by_user": False,
                }
            )

        proposal = self._create_or_supersede_proposal(
            classification=classification,
            proposal_fingerprint=proposal_fingerprint,
            proposal_type="vendor_payment_apply",
            proposal_mode="review_only",
            status="pending_review",
            gross_amount=Decimal(str(transaction.amount)),
            narrative=f"Review vendor payment settlement for bill {bill.bill_number}.",
            policy_flags={
                "review_required": residual_amount > 0,
                "residual_amount": str(residual_amount),
                "source_bank_transaction_id": str(transaction.id),
            },
            lines_payload=lines_payload,
        )
        return ProposalBuildOutcome(proposal=proposal, lines=self.proposal_line_repository.list_for_proposal(proposal.id), exception_case=None)

    def _build_missing_bill_proposal(
        self,
        classification: ClassificationResult,
        bundle: EvidenceBundle,
    ) -> ProposalBuildOutcome:
        purchase_line = self.session.get(GstPurchaseLine, self._coerce_object_id(bundle.primary_record_id))
        if purchase_line is None:
            raise ValueError(f"Missing GST purchase line for bundle {bundle.id}")

        candidates = self.match_candidate_repository.list_for_bundle(bundle.id)
        vendor_candidates = [candidate for candidate in candidates if candidate.to_object_type == "vendor_master" and candidate.decision_status in ("accepted", "candidate")]
        vendor_master_id: str | None = None
        vendor_name = purchase_line.supplier_name
        if len(vendor_candidates) == 1:
            vendor_master_id = vendor_candidates[0].to_object_id
            vendor = self.session.get(VendorMaster, self._coerce_object_id(vendor_master_id))
            if vendor is not None:
                vendor_name = vendor.display_name
        elif len(vendor_candidates) > 1:
            return ProposalBuildOutcome(
                proposal=None,
                lines=[],
                exception_case=self._ensure_exception(
                    bundle_id=bundle.id,
                    related_object_type="classification_result",
                    related_object_id=classification.id,
                    exception_type="proposal_ambiguous_missing_bill_vendor",
                    severity="high",
                    summary="Missing-bill proposal blocked because vendor identity is ambiguous.",
                    details_json={"candidate_ids": [str(candidate.id) for candidate in vendor_candidates]},
                ),
            )

        total_amount = Decimal(str(purchase_line.taxable_value + purchase_line.total_tax_amount))
        payload = {
            "classification_result_id": str(classification.id),
            "proposal_type": "vendor_bill_create",
            "target_period_date": classification.accounting_period_date.isoformat(),
            "invoice_number": purchase_line.invoice_number,
            "invoice_date": purchase_line.invoice_date.isoformat(),
            "supplier_gstin": purchase_line.supplier_gstin,
            "gross_amount": str(total_amount),
            "vendor_master_id": vendor_master_id,
            "rule_version_id": str(classification.rule_version_id),
        }
        proposal_fingerprint = stable_payload_hash(payload)
        lines_payload = [
            {
                "line_no": 1,
                "action_type": "create_vendor_bill",
                "description": f"Create review-only bill for invoice {purchase_line.invoice_number}.",
                "amount": str(total_amount),
                "zoho_target_object_type": "bill",
                "zoho_target_object_ref": None,
                "allocation_json": {
                    "supplier_gstin": purchase_line.supplier_gstin,
                    "invoice_number": purchase_line.invoice_number,
                    "invoice_date": purchase_line.invoice_date.isoformat(),
                    "filing_period": purchase_line.filing_period,
                },
                "review_required": vendor_master_id is None,
                "review_reason_code": "vendor_unconfirmed" if vendor_master_id is None else None,
                "is_blocking": vendor_master_id is None,
                "resolved_by_user": False,
            },
            {
                "line_no": 2,
                "action_type": "expense_placeholder",
                "description": "Expense head not derivable from current evidence; reviewer must choose account.",
                "amount": str(purchase_line.taxable_value),
                "zoho_target_object_type": None,
                "zoho_target_object_ref": None,
                "allocation_json": {
                    "reason": "expense_head_not_deterministic",
                },
                "review_required": True,
                "review_reason_code": "expense_head_not_deterministic",
                "is_blocking": True,
                "resolved_by_user": False,
            },
            {
                "line_no": 3,
                "action_type": "tax_placeholder",
                "description": "GST tax treatment derived from portal evidence; final coding remains review-required.",
                "amount": str(purchase_line.total_tax_amount),
                "tax_code": purchase_line.itc_availability,
                "zoho_target_object_type": None,
                "zoho_target_object_ref": None,
                "allocation_json": {
                    "igst_amount": str(purchase_line.igst_amount),
                    "cgst_amount": str(purchase_line.cgst_amount),
                    "sgst_amount": str(purchase_line.sgst_amount),
                    "cess_amount": str(purchase_line.cess_amount),
                    "reason": "tax_account_mapping_not_finalized",
                },
                "review_required": True,
                "review_reason_code": "tax_account_mapping_not_finalized",
                "is_blocking": True,
                "resolved_by_user": False,
            },
        ]
        proposal = self._create_or_supersede_proposal(
            classification=classification,
            proposal_fingerprint=proposal_fingerprint,
            proposal_type="vendor_bill_create",
            proposal_mode="review_only",
            status="draft",
            gross_amount=total_amount,
            narrative=f"Review missing vendor bill for {vendor_name} invoice {purchase_line.invoice_number}.",
            policy_flags={
                "review_required": True,
                "vendor_master_id": vendor_master_id,
                "supplier_name": purchase_line.supplier_name,
            },
            lines_payload=lines_payload,
            vendor_master_id=vendor_master_id,
        )
        return ProposalBuildOutcome(proposal=proposal, lines=self.proposal_line_repository.list_for_proposal(proposal.id), exception_case=None)

    def _create_or_supersede_proposal(
        self,
        *,
        classification: ClassificationResult,
        proposal_fingerprint: str,
        proposal_type: str,
        proposal_mode: str,
        status: str,
        gross_amount: Decimal,
        narrative: str,
        policy_flags: dict[str, Any],
        lines_payload: list[dict[str, Any]],
        vendor_master_id: str | None = None,
    ) -> PostingProposal:
        existing = self.proposal_repository.get_by_fingerprint(proposal_fingerprint)
        if existing:
            return existing

        related_classifications = self.classification_repository.list_for_bundle(classification.evidence_bundle_id)
        prior_proposals = self.proposal_repository.list_active_for_bundle([item.id for item in related_classifications])
        active_prior = [proposal for proposal in prior_proposals if proposal.status in ("draft", "pending_review")]
        supersedes_proposal_id = active_prior[-1].id if active_prior else None
        for proposal in active_prior:
            proposal.status = "superseded"

        input_fingerprint = stable_payload_hash(
            {
                "classification_result_id": str(classification.id),
                "rule_version_id": str(classification.rule_version_id),
                "proposal_type": proposal_type,
                "gross_amount": str(gross_amount),
                "policy_flags": policy_flags,
                "lines": lines_payload,
            }
        )
        has_blocking_lines, unresolved_review_item_count = self._summarize_line_safety(lines_payload)
        proposal = PostingProposal(
            classification_result_id=classification.id,
            generated_from_classification_id=classification.id,
            rule_version_id=classification.rule_version_id,
            proposal_fingerprint=proposal_fingerprint,
            input_fingerprint=input_fingerprint,
            proposal_type=proposal_type,
            proposal_mode=proposal_mode,
            target_system="zoho_books",
            target_period_date=classification.accounting_period_date,
            status=status,
            currency_code="INR",
            gross_amount=gross_amount,
            narrative=narrative,
            has_blocking_lines=has_blocking_lines,
            unresolved_review_item_count=unresolved_review_item_count,
            policy_flags=policy_flags,
            supersedes_proposal_id=supersedes_proposal_id,
            supersession_reason=None,
        )
        self.proposal_repository.add(proposal)
        self.proposal_repository.session.flush()

        for line in lines_payload:
            self.proposal_line_repository.add(
                PostingProposalLine(
                    posting_proposal_id=proposal.id,
                    line_no=line["line_no"],
                    action_type=line["action_type"],
                    account_master_id=line.get("account_master_id"),
                    vendor_master_id=self._coerce_object_id(vendor_master_id),
                    zoho_target_object_type=line.get("zoho_target_object_type"),
                    zoho_target_object_ref=line.get("zoho_target_object_ref"),
                    description=line["description"],
                    quantity=line.get("quantity"),
                    rate=line.get("rate"),
                    amount=Decimal(str(line["amount"])),
                    tax_code=line.get("tax_code"),
                    review_required=line.get("review_required", False),
                    review_reason_code=line.get("review_reason_code"),
                    is_blocking=line.get("is_blocking", False),
                    resolved_by_user=line.get("resolved_by_user", False),
                    allocation_json=line.get("allocation_json", {}),
                )
            )

        supersession_reason = None
        if active_prior:
            prior = active_prior[-1]
            prior.superseded_by_proposal_id = proposal.id
            change_summary = self.history_service.summarize_changes(
                prior,
                self.proposal_line_repository.list_for_proposal(prior.id),
                proposal,
                lines_payload,
                classification,
            )
            supersession_reason = ", ".join(change_summary["changes"])
            proposal.supersession_reason = supersession_reason

        self._append_audit(
            "proposal_created",
            "posting_proposal",
            proposal.id,
            classification.evidence_bundle_id,
            {
                "proposal_type": proposal_type,
                "classification_result_id": str(classification.id),
                "supersedes_proposal_id": str(supersedes_proposal_id) if supersedes_proposal_id else None,
                "supersession_reason": supersession_reason,
            },
        )
        return proposal

    def _open_exceptions_for_bundle(self, bundle_id: str) -> list[ExceptionCase]:
        stmt = select(ExceptionCase).where(
            ExceptionCase.bundle_id == bundle_id,
            ExceptionCase.status.in_(("open", "in_review")),
        )
        return list(self.session.scalars(stmt))

    def _ensure_exception(
        self,
        *,
        bundle_id: str,
        related_object_type: str,
        related_object_id: str,
        exception_type: str,
        severity: str,
        summary: str,
        details_json: dict[str, Any],
    ) -> ExceptionCase:
        existing = self.exception_repository.find_open_by_bundle(bundle_id, exception_type, None)
        if existing:
            return existing
        exception = ExceptionCase(
            exception_type=exception_type,
            conflict_type=None,
            severity=severity,
            status="open",
            bundle_id=bundle_id,
            classification_result_id=self._coerce_object_id(related_object_id) if related_object_type == "classification_result" else None,
            related_object_type=related_object_type,
            related_object_id=str(related_object_id),
            summary=summary,
            details_json=details_json,
        )
        self.exception_repository.add(exception)
        self._append_audit("proposal_exception_created", "exception_case", exception.id, bundle_id, details_json)
        return exception

    def _append_audit(self, event_type: str, object_type: str, object_id: str, correlation_id: str, detail: dict[str, Any]) -> None:
        self.audit_repository.append_event(
            AuditEvent(
                event_ts=self._now(),
                event_type=event_type,
                actor_type="system",
                actor_id="proposal_builder",
                object_type=object_type,
                object_id=str(object_id),
                correlation_id=str(correlation_id),
                event_detail_json=self._json_safe(detail),
            )
        )

    def _now(self):
        from datetime import datetime, timezone

        return datetime.now(timezone.utc)

    def _coerce_object_id(self, value: str):
        try:
            return UUID(str(value))
        except (TypeError, ValueError, AttributeError):
            return value

    def _json_safe(self, value: dict[str, Any]) -> dict[str, Any]:
        import json

        return json.loads(stable_json_dumps(value))

    def _summarize_line_safety(self, lines_payload: list[dict[str, Any]]) -> tuple[bool, int]:
        has_blocking = any(bool(line.get("is_blocking")) for line in lines_payload)
        unresolved = sum(1 for line in lines_payload if bool(line.get("review_required")))
        return has_blocking, unresolved
