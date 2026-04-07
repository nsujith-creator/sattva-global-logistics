"""Deterministic classification pipeline for Phase D2 foundation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone

from db.models.audit import AuditEvent
from db.models.banking import BankTransaction
from db.models.reference import RuleVersion
from db.models.tax import GstPurchaseLine
from db.models.workflow import ClassificationResult, ExceptionCase, MatchCandidate
from db.repositories.audit import AuditEventRepository
from db.repositories.reference import RuleVersionRepository
from db.repositories.workflow import ClassificationResultRepository, ExceptionCaseRepository, MatchCandidateRepository
from matching.bundles import BundleMember, EvidenceBundleService
from matching.candidate_engine import MatchCandidateEngine
from matching.conflicts import MatchConflictDetector


@dataclass(frozen=True)
class PipelineOutcome:
    bundle_id: str
    classification_result: ClassificationResult | None
    exception_case: ExceptionCase | None
    candidates: list[MatchCandidate]


class ClassificationPipeline:
    def __init__(
        self,
        *,
        rule_version_repository: RuleVersionRepository,
        bundle_service: EvidenceBundleService,
        candidate_engine: MatchCandidateEngine,
        match_candidate_repository: MatchCandidateRepository,
        classification_repository: ClassificationResultRepository,
        exception_repository: ExceptionCaseRepository,
        audit_repository: AuditEventRepository,
        conflict_detector: MatchConflictDetector | None = None,
    ) -> None:
        self.rule_version_repository = rule_version_repository
        self.bundle_service = bundle_service
        self.candidate_engine = candidate_engine
        self.match_candidate_repository = match_candidate_repository
        self.classification_repository = classification_repository
        self.exception_repository = exception_repository
        self.audit_repository = audit_repository
        self.conflict_detector = conflict_detector or MatchConflictDetector()

    def classify_bank_transaction(self, transaction: BankTransaction) -> PipelineOutcome:
        rule_version = self._require_rule_version(transaction.transaction_date)
        bundle = self.bundle_service.get_or_create_bundle(
            bundle_type="bank_transaction_case",
            primary_record_type="bank_transaction",
            primary_record_id=transaction.id,
            evidence_summary=f"Bank transaction {transaction.id} on {transaction.transaction_date.isoformat()}",
            rule_version=rule_version,
            members=[BundleMember("bank_transaction", transaction.id, "primary")],
            confidence_score=1.0,
            metadata_json={"direction": transaction.direction, "amount": str(transaction.amount)},
        )
        generated = self.candidate_engine.generate_for_bank_transaction(transaction, bundle.id, rule_version)
        self.bundle_service.attach_items(bundle.id, generated.bundle_members)
        candidates = self.match_candidate_repository.list_for_bundle(bundle.id)

        conflict = self._apply_conflicts(bundle.id, "bank_transaction", transaction.id, candidates)
        if conflict:
            return PipelineOutcome(bundle.id, None, conflict, candidates)

        classification_type, confidence, summary, explanation = self._bank_classification_decision(transaction, candidates)
        classification = self._get_or_create_classification(
            bundle_id=bundle.id,
            rule_version=rule_version,
            classification_type=classification_type,
            accounting_period_date=transaction.transaction_date,
            confidence_score=confidence,
            materiality_amount=transaction.amount,
            decision_summary=summary,
            explanation_json=explanation,
        )
        exception_case = None
        if classification_type == "unclassified_debit_exception":
            exception_case = self._get_or_create_exception(
                bundle_id=bundle.id,
                exception_type="unclassified_bank_transaction",
                conflict_type=None,
                severity="medium",
                related_object_type="bank_transaction",
                related_object_id=transaction.id,
                summary=summary,
                details_json=explanation,
            )
        self._append_audit("classification_created", "classification_result", classification.id, bundle.id, explanation)
        return PipelineOutcome(bundle.id, classification, exception_case, candidates)

    def classify_gst_purchase_line(self, purchase_line: GstPurchaseLine) -> PipelineOutcome:
        rule_version = self._require_rule_version(purchase_line.invoice_date)
        bundle = self.bundle_service.get_or_create_bundle(
            bundle_type="gst_purchase_case",
            primary_record_type="gst_purchase_line",
            primary_record_id=purchase_line.id,
            evidence_summary=f"GST purchase invoice {purchase_line.invoice_number}",
            rule_version=rule_version,
            members=[BundleMember("gst_purchase_line", purchase_line.id, "primary")],
            confidence_score=1.0,
            metadata_json={"invoice_number": purchase_line.invoice_number},
        )
        generated = self.candidate_engine.generate_for_gst_purchase_line(purchase_line, bundle.id, rule_version)
        self.bundle_service.attach_items(bundle.id, generated.bundle_members)
        candidates = self.match_candidate_repository.list_for_bundle(bundle.id)

        conflict = self._apply_conflicts(bundle.id, "gst_purchase_line", purchase_line.id, candidates)
        if conflict:
            return PipelineOutcome(bundle.id, None, conflict, candidates)

        high_bill_candidates = [candidate for candidate in candidates if candidate.to_object_type == "zoho_snapshot_bill" and float(candidate.score) >= 0.9]
        if high_bill_candidates:
            for candidate in high_bill_candidates:
                candidate.decision_status = "accepted"
            self._append_audit(
                "gst_bill_match_confirmed",
                "evidence_bundle",
                bundle.id,
                bundle.id,
                {"matched_bill_ids": [candidate.to_object_id for candidate in high_bill_candidates]},
            )
            return PipelineOutcome(bundle.id, None, None, candidates)

        classification = self._get_or_create_classification(
            bundle_id=bundle.id,
            rule_version=rule_version,
            classification_type="missing_bill_candidate",
            accounting_period_date=purchase_line.invoice_date,
            confidence_score=0.95,
            materiality_amount=purchase_line.taxable_value + purchase_line.total_tax_amount,
            decision_summary=f"GST invoice {purchase_line.invoice_number} is missing a matching Zoho bill.",
            explanation_json={
                "matched_candidates": [str(candidate.id) for candidate in candidates],
                "supplier_gstin": purchase_line.supplier_gstin,
                "invoice_number": purchase_line.invoice_number,
            },
        )
        self._append_audit("classification_created", "classification_result", classification.id, bundle.id, classification.explanation_json)
        return PipelineOutcome(bundle.id, classification, None, candidates)

    def _apply_conflicts(
        self,
        bundle_id: str,
        related_object_type: str,
        related_object_id: str,
        candidates: list[MatchCandidate],
    ) -> ExceptionCase | None:
        conflicts = self.conflict_detector.detect(candidates)
        if not conflicts:
            return None
        first = conflicts[0]
        self.bundle_service.attach_items(
            bundle_id,
            [BundleMember(candidate.to_object_type, candidate.to_object_id, "conflicting") for candidate in first.candidates],
        )
        for candidate in first.candidates:
            candidate.conflict_group_id = first.conflict_group_id
            candidate.decision_status = "candidate"
        return self._get_or_create_exception(
            bundle_id=bundle_id,
            exception_type="match_conflict",
            conflict_type=first.conflict_type,
            severity="high",
            related_object_type=related_object_type,
            related_object_id=related_object_id,
            summary=f"Multiple high-score {first.candidates[0].to_object_type} candidates remain unresolved.",
            details_json={
                "conflict_group_id": first.conflict_group_id,
                "candidate_ids": [str(candidate.id) for candidate in first.candidates],
            },
        )

    def _bank_classification_decision(
        self,
        transaction: BankTransaction,
        candidates: list[MatchCandidate],
    ) -> tuple[str, float, str, dict]:
        tax_candidates = [candidate for candidate in candidates if candidate.to_object_type == "tax_information_item" and float(candidate.score) >= 0.95]
        if tax_candidates:
            for candidate in tax_candidates:
                candidate.decision_status = "accepted"
            return (
                "tax_payment_candidate",
                max(float(candidate.score) for candidate in tax_candidates),
                "Bank debit has deterministic tax payment evidence.",
                {"accepted_candidate_ids": [str(candidate.id) for candidate in tax_candidates], "reason": "tax_reference_match"},
            )

        bill_candidates = [candidate for candidate in candidates if candidate.to_object_type == "zoho_snapshot_bill" and float(candidate.score) >= 0.9]
        if len(bill_candidates) == 1:
            bill_candidates[0].decision_status = "accepted"
            return (
                "vendor_payment",
                float(bill_candidates[0].score),
                "Bank debit matches a Zoho bill deterministically.",
                {"accepted_candidate_id": str(bill_candidates[0].id), "reason": bill_candidates[0].rule_name},
            )

        vendor_candidates = [candidate for candidate in candidates if candidate.to_object_type == "vendor_master" and float(candidate.score) >= 0.9]
        if len(vendor_candidates) == 1:
            vendor_candidates[0].decision_status = "accepted"
            return (
                "expense_candidate",
                float(vendor_candidates[0].score),
                "Bank debit has a single strong vendor identity but no deterministic bill settlement.",
                {"accepted_candidate_id": str(vendor_candidates[0].id), "reason": vendor_candidates[0].rule_name},
            )

        if transaction.direction == "debit":
            return (
                "unclassified_debit_exception",
                0.0,
                "Bank debit could not be classified deterministically.",
                {"candidate_ids": [str(candidate.id) for candidate in candidates], "reason": "no_clear_outcome"},
            )

        return (
            "expense_candidate",
            0.0,
            "Non-debit transaction left as expense candidate placeholder.",
            {"candidate_ids": [str(candidate.id) for candidate in candidates], "reason": "placeholder_non_debit"},
        )

    def _require_rule_version(self, effective_date: date) -> RuleVersion:
        rule_version = self.rule_version_repository.get_active_for_date(effective_date)
        if rule_version is None:
            raise ValueError(f"No active rule version found for {effective_date.isoformat()}.")
        return rule_version

    def _get_or_create_classification(
        self,
        *,
        bundle_id: str,
        rule_version: RuleVersion,
        classification_type: str,
        accounting_period_date: date,
        confidence_score: float,
        materiality_amount,
        decision_summary: str,
        explanation_json: dict,
    ) -> ClassificationResult:
        existing = self.classification_repository.find_existing(
            bundle_id,
            rule_version.id,
            classification_type,
            accounting_period_date,
            decision_summary,
            None,
        )
        if existing:
            return existing
        classification = ClassificationResult(
            evidence_bundle_id=bundle_id,
            rule_version_id=rule_version.id,
            classification_type=classification_type,
            status="proposed",
            confidence_score=confidence_score,
            materiality_amount=materiality_amount,
            accounting_period_date=accounting_period_date,
            decision_summary=decision_summary,
            explanation_json=explanation_json,
            ai_assist_json={},
            supersedes_classification_id=None,
        )
        self.classification_repository.add(classification)
        self.classification_repository.session.flush()
        return classification

    def _get_or_create_exception(
        self,
        *,
        bundle_id: str,
        exception_type: str,
        conflict_type: str | None,
        severity: str,
        related_object_type: str,
        related_object_id: str,
        summary: str,
        details_json: dict,
    ) -> ExceptionCase:
        existing = self.exception_repository.find_open_by_bundle(bundle_id, exception_type, conflict_type)
        if existing:
            return existing
        exception = ExceptionCase(
            exception_type=exception_type,
            conflict_type=conflict_type,
            severity=severity,
            status="open",
            bundle_id=bundle_id,
            related_object_type=related_object_type,
            related_object_id=str(related_object_id),
            summary=summary,
            details_json=details_json,
        )
        self.exception_repository.add(exception)
        self.exception_repository.session.flush()
        self._append_audit("exception_created", "exception_case", exception.id, bundle_id, details_json)
        return exception

    def _append_audit(self, event_type: str, object_type: str, object_id: str, correlation_id: str, detail: dict) -> None:
        self.audit_repository.append_event(
            AuditEvent(
                event_ts=datetime.now(timezone.utc),
                event_type=event_type,
                actor_type="system",
                actor_id="classification_pipeline",
                object_type=object_type,
                object_id=str(object_id),
                correlation_id=str(correlation_id),
                event_detail_json=detail,
            )
        )
