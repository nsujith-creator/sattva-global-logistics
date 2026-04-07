"""Deterministic match candidate generation."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from db.models.banking import BankTransaction
from db.models.reference import RuleVersion
from db.models.tax import GstPurchaseLine, TaxInformationItem
from db.models.workflow import MatchCandidate
from db.models.zoho import ZohoSnapshotBill
from db.repositories.zoho import ZohoSnapshotRepository
from db.repositories.workflow import MatchCandidateRepository
from matching.bundles import BundleMember
from normalization.identity import (
    BankCounterpartyNormalizationService,
    VendorIdentityNormalizationService,
    normalize_lookup_text,
)


@dataclass(frozen=True)
class CandidateGenerationResult:
    candidates: list[MatchCandidate]
    bundle_members: list[BundleMember]


class MatchCandidateEngine:
    def __init__(
        self,
        session: Session,
        match_candidate_repository: MatchCandidateRepository,
        vendor_normalization_service: VendorIdentityNormalizationService,
        bank_counterparty_normalization_service: BankCounterpartyNormalizationService,
        zoho_snapshot_repository: ZohoSnapshotRepository | None = None,
    ) -> None:
        self.session = session
        self.match_candidate_repository = match_candidate_repository
        self.vendor_normalization_service = vendor_normalization_service
        self.bank_counterparty_normalization_service = bank_counterparty_normalization_service
        self.zoho_snapshot_repository = zoho_snapshot_repository or ZohoSnapshotRepository(session)

    def generate_for_bank_transaction(self, transaction: BankTransaction, bundle_id: str, rule_version: RuleVersion) -> CandidateGenerationResult:
        candidates: list[MatchCandidate] = []
        members: list[BundleMember] = []
        config = self._matching_config(rule_version)

        vendor_result = self.bank_counterparty_normalization_service.resolve(transaction)
        if vendor_result.is_resolved:
            candidate = self._upsert_candidate(
                bundle_id=bundle_id,
                from_object_type="bank_transaction",
                from_object_id=transaction.id,
                to_object_type="vendor_master",
                to_object_id=vendor_result.vendor_master_id,
                match_layer="deterministic" if vendor_result.confidence >= 0.95 else "heuristic",
                rule_name=f"vendor_identity.{vendor_result.match_method}",
                score=vendor_result.confidence,
                score_components=vendor_result.score_components,
                explanation=f"Vendor resolved via {vendor_result.match_method}.",
                evidence_refs={"counterparty_name": transaction.counterparty_name, "narration": transaction.narration},
            )
            candidates.append(candidate)
            members.append(BundleMember("vendor_master", vendor_result.vendor_master_id, "candidate_target"))

        if transaction.bank_reference:
            tax_items = self.session.scalars(
                select(TaxInformationItem).where(TaxInformationItem.authority_reference == transaction.bank_reference)
            )
            for tax_item in tax_items:
                candidate = self._upsert_candidate(
                    bundle_id=bundle_id,
                    from_object_type="bank_transaction",
                    from_object_id=transaction.id,
                    to_object_type="tax_information_item",
                    to_object_id=tax_item.id,
                    match_layer="deterministic",
                    rule_name="bank_tax.reference_exact",
                    score=0.99,
                    score_components={"reference_exact": 0.99},
                    explanation="Bank reference exactly matches tax authority reference.",
                    evidence_refs={"bank_reference": transaction.bank_reference},
                )
                candidates.append(candidate)
                members.append(BundleMember("tax_information_item", tax_item.id, "supporting"))

        candidates.extend(self._bank_bill_candidates(transaction, bundle_id, config, members))
        return CandidateGenerationResult(candidates=candidates, bundle_members=members)

    def generate_for_gst_purchase_line(self, purchase_line: GstPurchaseLine, bundle_id: str, rule_version: RuleVersion) -> CandidateGenerationResult:
        candidates: list[MatchCandidate] = []
        members: list[BundleMember] = []
        config = self._matching_config(rule_version)

        vendor_result = self.vendor_normalization_service.resolve(
            gstin=purchase_line.supplier_gstin,
            alias_text=purchase_line.supplier_name,
        )
        if vendor_result.is_resolved:
            candidate = self._upsert_candidate(
                bundle_id=bundle_id,
                from_object_type="gst_purchase_line",
                from_object_id=purchase_line.id,
                to_object_type="vendor_master",
                to_object_id=vendor_result.vendor_master_id,
                match_layer="deterministic" if vendor_result.confidence >= 0.95 else "heuristic",
                rule_name=f"gst_vendor_identity.{vendor_result.match_method}",
                score=vendor_result.confidence,
                score_components=vendor_result.score_components,
                explanation=f"GST supplier normalized via {vendor_result.match_method}.",
                evidence_refs={"supplier_gstin": purchase_line.supplier_gstin, "supplier_name": purchase_line.supplier_name},
            )
            candidates.append(candidate)
            members.append(BundleMember("vendor_master", vendor_result.vendor_master_id, "candidate_target"))

        eligible_bills = self.zoho_snapshot_repository.list_eligible("bill")
        targeted_bills = [
            bill
            for bill in eligible_bills
            if bill.bill_number == purchase_line.invoice_number
            or bill.reference_number == purchase_line.invoice_number
            or bill.vendor_name == purchase_line.supplier_name
        ]
        seen_bill_ids: set[str] = set()
        for bill in targeted_bills:
            seen_bill_ids.add(str(bill.id))
            score_components = self._gst_bill_score_components(purchase_line, bill, config)
            total_score = self._sum_score_components(score_components)
            if total_score <= 0:
                continue
            candidate = self._upsert_candidate(
                bundle_id=bundle_id,
                from_object_type="gst_purchase_line",
                from_object_id=purchase_line.id,
                to_object_type="zoho_snapshot_bill",
                to_object_id=bill.id,
                match_layer="deterministic",
                rule_name=score_components.pop("rule_name"),
                score=total_score,
                score_components=score_components,
                explanation="Candidate Zoho bill matched against GST purchase line.",
                evidence_refs={"invoice_number": purchase_line.invoice_number, "supplier_gstin": purchase_line.supplier_gstin},
            )
            candidates.append(candidate)
            members.append(BundleMember("zoho_snapshot_bill", bill.id, "candidate_target"))

        for bill in eligible_bills:
            if str(bill.id) in seen_bill_ids:
                continue
            score_components = self._gst_bill_score_components(purchase_line, bill, config)
            total_score = self._sum_score_components(score_components)
            if total_score < 0.2:
                continue
            candidate = self._upsert_candidate(
                bundle_id=bundle_id,
                from_object_type="gst_purchase_line",
                from_object_id=purchase_line.id,
                to_object_type="zoho_snapshot_bill",
                to_object_id=bill.id,
                match_layer="deterministic",
                rule_name=score_components.pop("rule_name"),
                score=total_score,
                score_components=score_components,
                explanation="Candidate Zoho bill matched against GST purchase line via amount/date tolerance.",
                evidence_refs={"invoice_number": purchase_line.invoice_number, "supplier_gstin": purchase_line.supplier_gstin},
            )
            candidates.append(candidate)
            members.append(BundleMember("zoho_snapshot_bill", bill.id, "candidate_target"))

        return CandidateGenerationResult(candidates=candidates, bundle_members=members)

    def _bank_bill_candidates(
        self,
        transaction: BankTransaction,
        bundle_id: str,
        config: dict,
        members: list[BundleMember],
    ) -> list[MatchCandidate]:
        candidates: list[MatchCandidate] = []
        normalized_narration = normalize_lookup_text(transaction.narration)
        normalized_reference = normalize_lookup_text(transaction.bank_reference)
        for bill in self.zoho_snapshot_repository.list_eligible("bill"):
            score_components: dict[str, float] = {}
            rule_name = "bank_bill.weak"
            if bill.reference_number and normalize_lookup_text(bill.reference_number) == normalized_reference:
                score_components["reference_number_match"] = 0.45
                rule_name = "bank_bill.reference_match"
            if normalize_lookup_text(bill.bill_number) and normalize_lookup_text(bill.bill_number) in normalized_narration:
                score_components["bill_number_match"] = 0.25
                rule_name = "bank_bill.bill_number_match"
            if Decimal(str(bill.balance or bill.total or 0)) == Decimal(str(transaction.amount)):
                score_components["exact_amount_match"] = 0.35
            if bill.bill_date and abs((bill.bill_date - transaction.transaction_date).days) <= config["bank_date_window_days"]:
                score_components["date_window_match"] = 0.15

            total_score = self._sum_score_components(score_components)
            if total_score <= 0:
                continue
            candidate = self._upsert_candidate(
                bundle_id=bundle_id,
                from_object_type="bank_transaction",
                from_object_id=transaction.id,
                to_object_type="zoho_snapshot_bill",
                to_object_id=bill.id,
                match_layer="deterministic",
                rule_name=rule_name,
                score=total_score,
                score_components=score_components,
                explanation="Candidate Zoho bill matched against bank transaction.",
                evidence_refs={
                    "bank_reference": transaction.bank_reference,
                    "bill_number": bill.bill_number,
                    "reference_number": bill.reference_number,
                },
            )
            candidates.append(candidate)
            members.append(BundleMember("zoho_snapshot_bill", bill.id, "candidate_target"))
        return candidates

    def _gst_bill_score_components(self, purchase_line: GstPurchaseLine, bill: ZohoSnapshotBill, config: dict) -> dict:
        invoice_exact = normalize_lookup_text(bill.bill_number) == normalize_lookup_text(purchase_line.invoice_number)
        vendor_exact = normalize_lookup_text(bill.vendor_name) == normalize_lookup_text(purchase_line.supplier_name)
        total_amount = Decimal(str(purchase_line.taxable_value + purchase_line.total_tax_amount))
        bill_amount = Decimal(str(bill.total))
        amount_diff = abs(total_amount - bill_amount)
        date_delta = abs((purchase_line.invoice_date - bill.bill_date).days)

        score_components: dict[str, float | str] = {"rule_name": "gst_bill.heuristic"}
        if invoice_exact and purchase_line.supplier_gstin:
            score_components["gstin_invoice_exact"] = 0.75
            score_components["rule_name"] = "gst_bill.gstin_invoice_exact"
        elif vendor_exact and invoice_exact:
            score_components["vendor_invoice_exact"] = 0.7
            score_components["rule_name"] = "gst_bill.vendor_invoice_exact"

        if amount_diff <= Decimal(str(config["gst_amount_tolerance"])):
            score_components["amount_tolerance_match"] = 0.15
        if date_delta <= config["gst_date_tolerance_days"]:
            score_components["date_tolerance_match"] = 0.1
        return score_components

    def _matching_config(self, rule_version: RuleVersion) -> dict:
        rules_json = rule_version.rules_json or {}
        matching = rules_json.get("matching", {})
        return {
            "bank_date_window_days": int(matching.get("bank_date_window_days", 7)),
            "gst_date_tolerance_days": int(matching.get("gst_date_tolerance_days", 3)),
            "gst_amount_tolerance": float(matching.get("gst_amount_tolerance", 1.0)),
        }

    def _sum_score_components(self, score_components: dict) -> float:
        total = 0.0
        for key, value in score_components.items():
            if key == "rule_name":
                continue
            total += float(value)
        return round(min(total, 0.9999), 4)

    def _upsert_candidate(
        self,
        *,
        bundle_id: str,
        from_object_type: str,
        from_object_id: str,
        to_object_type: str,
        to_object_id: str,
        match_layer: str,
        rule_name: str,
        score: float,
        score_components: dict,
        explanation: str,
        evidence_refs: dict,
    ) -> MatchCandidate:
        existing = self.match_candidate_repository.find_existing(
            bundle_id,
            from_object_type,
            str(from_object_id),
            to_object_type,
            str(to_object_id),
            rule_name,
        )
        if existing:
            return existing
        candidate = MatchCandidate(
            evidence_bundle_id=bundle_id,
            from_object_type=from_object_type,
            from_object_id=str(from_object_id),
            to_object_type=to_object_type,
            to_object_id=str(to_object_id),
            match_layer=match_layer,
            rule_name=rule_name,
            score=score,
            score_components=score_components,
            decision_status="candidate",
            explanation=explanation,
            evidence_refs=evidence_refs,
        )
        self.match_candidate_repository.add(candidate)
        return candidate
