"""Integration tests for proposal foundation."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from db.base import Base
from db.models.banking import BankAccount, BankTransaction
from db.models.evidence import SourceDocument, SourceRecord
from db.models.reference import RuleVersion, VendorMaster
from db.models.tax import GstPurchaseLine
from db.models.workflow import ClassificationResult, ExceptionCase, PostingProposal, PostingProposalLine
from db.models.zoho import ZohoSnapshotBill
from db.repositories.audit import AuditEventRepository
from db.repositories.proposals import ProposalLineRepository, ProposalRepository
from db.repositories.reference import RuleVersionRepository, VendorAliasRepository, VendorMasterRepository
from db.repositories.workflow import (
    ClassificationResultRepository,
    EvidenceBundleItemRepository,
    EvidenceBundleRepository,
    ExceptionCaseRepository,
    MatchCandidateRepository,
)
from matching.bundles import EvidenceBundleService
from matching.candidate_engine import MatchCandidateEngine
from normalization.identity import BankCounterpartyNormalizationService, VendorIdentityNormalizationService
from proposals.builder import ProposalBuilder
from rules.classification_pipeline import ClassificationPipeline


def _session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    return Session(engine)


def _seed_rule_version(session: Session, version_code: str = "2026.03.29.1", minimum_confidence: float | None = None) -> RuleVersion:
    rules_json = {"matching": {"bank_date_window_days": 7, "gst_date_tolerance_days": 3, "gst_amount_tolerance": 1.0}}
    if minimum_confidence is not None:
        rules_json["proposal"] = {"minimum_confidence": minimum_confidence}
    rule_version = RuleVersion(
        rulebook_name="core_accounting_rules",
        version_code=version_code,
        effective_from=date(2025, 4, 1),
        is_active=True,
        published_by="tests",
        change_summary="proposal tests",
        rules_json=rules_json,
    )
    session.add(rule_version)
    session.flush()
    return rule_version


def _seed_vendor(session: Session, canonical_name: str, display_name: str, *, gstin: str | None = None, beneficiary_fingerprint: str | None = None) -> VendorMaster:
    vendor = VendorMaster(
        canonical_name=canonical_name,
        display_name=display_name,
        vendor_type="freight_vendor",
        gstin=gstin,
        beneficiary_fingerprints=[beneficiary_fingerprint] if beneficiary_fingerprint else [],
    )
    session.add(vendor)
    session.flush()
    return vendor


def _seed_source_document(session: Session, suffix: str) -> SourceDocument:
    now = datetime.now(timezone.utc)
    document = SourceDocument(
        source_system="test",
        document_type="fixture",
        original_filename=f"{suffix}.json",
        storage_path=f"/tmp/{suffix}.json",
        mime_type="application/json",
        file_size_bytes=1,
        document_sha256=f"doc-{suffix}",
        ingest_batch_key=f"batch-{suffix}",
        captured_at=now,
        ingested_at=now,
        metadata_json={},
    )
    session.add(document)
    session.flush()
    return document


def _seed_source_record(session: Session, document: SourceDocument, suffix: str, record_type: str, event_date: date, amount: Decimal) -> SourceRecord:
    record = SourceRecord(
        source_document_id=document.id,
        record_type=record_type,
        record_fingerprint=f"record-{suffix}",
        extraction_version="v1",
        parse_status="parsed",
        event_date=event_date,
        amount=amount,
        raw_payload={},
        normalized_payload={},
    )
    session.add(record)
    session.flush()
    return record


def _seed_zoho_bill_snapshot(
    session: Session,
    *,
    suffix: str,
    snapshot_batch_key: str,
    vendor_name: str,
    vendor_id: str,
    zoho_object_id: str,
    bill_number: str,
    bill_date: date,
    total: Decimal,
    balance: Decimal,
    reference_number: str | None,
) -> ZohoSnapshotBill:
    now = datetime.now(timezone.utc)
    document = SourceDocument(
        source_system="zoho_sandbox",
        document_type="zoho_snapshot_bills_json",
        original_filename=f"{suffix}.json",
        storage_path=f"/tmp/{suffix}.json",
        mime_type="application/json",
        file_size_bytes=1,
        document_sha256=f"zoho-doc-{suffix}",
        ingest_batch_key=snapshot_batch_key,
        captured_at=now,
        ingested_at=now,
        metadata_json={},
    )
    session.add(document)
    session.flush()
    bill = ZohoSnapshotBill(
        snapshot_at=now,
        snapshot_batch_key=snapshot_batch_key,
        zoho_object_id=zoho_object_id,
        payload={"bill_id": zoho_object_id},
        vendor_name=vendor_name,
        vendor_id=vendor_id,
        bill_number=bill_number,
        bill_date=bill_date,
        currency_code="INR",
        total=total,
        balance=balance,
        status="open",
        reference_number=reference_number,
    )
    session.add(bill)
    session.flush()
    session.add(
        SourceRecord(
            source_document_id=document.id,
            record_type="zoho_snapshot_bill",
            source_row_number=1,
            record_fingerprint=f"zoho-record-{suffix}",
            extraction_version="zoho_snapshot_v1",
            parse_status="parsed",
            raw_payload={"bill_id": zoho_object_id},
            normalized_payload={"snapshot_type": "bill", "zoho_object_id": zoho_object_id},
            quality_score=1,
            review_required=False,
        )
    )
    session.flush()
    return bill


def _build_classification_pipeline(session: Session) -> ClassificationPipeline:
    normalization_service = VendorIdentityNormalizationService(VendorMasterRepository(session), VendorAliasRepository(session))
    candidate_engine = MatchCandidateEngine(
        session,
        MatchCandidateRepository(session),
        normalization_service,
        BankCounterpartyNormalizationService(normalization_service),
    )
    return ClassificationPipeline(
        rule_version_repository=RuleVersionRepository(session),
        bundle_service=EvidenceBundleService(EvidenceBundleRepository(session), EvidenceBundleItemRepository(session)),
        candidate_engine=candidate_engine,
        match_candidate_repository=MatchCandidateRepository(session),
        classification_repository=ClassificationResultRepository(session),
        exception_repository=ExceptionCaseRepository(session),
        audit_repository=AuditEventRepository(session),
    )


def _build_proposal_builder(session: Session, *, minimum_confidence: str = "0.90") -> ProposalBuilder:
    return ProposalBuilder(
        session,
        proposal_repository=ProposalRepository(session),
        proposal_line_repository=ProposalLineRepository(session),
        classification_repository=ClassificationResultRepository(session),
        match_candidate_repository=MatchCandidateRepository(session),
        exception_repository=ExceptionCaseRepository(session),
        audit_repository=AuditEventRepository(session),
        config={"minimum_confidence": Decimal(minimum_confidence)},
    )


def test_vendor_payment_proposal_generation() -> None:
    session = _session()
    _seed_rule_version(session)
    vendor = _seed_vendor(session, "VENDOR ONE PRIVATE LIMITED", "Vendor One", beneficiary_fingerprint="fp-v1")
    document = _seed_source_document(session, "vendor-payment")
    source_record = _seed_source_record(session, document, "vendor-payment", "bank_txn", date(2025, 4, 10), Decimal("1200.00"))
    bank_account = BankAccount(account_name="Main", account_mask="XXXX1111", bank_name="Test Bank", metadata_json={})
    session.add(bank_account)
    session.flush()
    transaction = BankTransaction(
        source_record_id=source_record.id,
        bank_account_id=bank_account.id,
        bank_account_ref="XXXX1111",
        transaction_date=date(2025, 4, 10),
        direction="debit",
        amount=Decimal("1200.00"),
        signed_amount=Decimal("-1200.00"),
        narration="Payment VP-001",
        counterparty_name=vendor.display_name,
        counterparty_fingerprint="fp-v1",
        bank_reference="VP-001",
        metadata_json={},
    )
    session.add(transaction)
    _seed_zoho_bill_snapshot(
        session,
        suffix="proposal-vp-1",
        snapshot_batch_key="snap-vp",
        vendor_name=vendor.display_name,
        vendor_id="zoho-v1",
        zoho_object_id="bill-vp-1",
        bill_number="VP-001",
        bill_date=date(2025, 4, 8),
        total=Decimal("1200.00"),
        balance=Decimal("1200.00"),
        reference_number="VP-001",
    )

    classification = _build_classification_pipeline(session).classify_bank_transaction(transaction).classification_result
    assert classification is not None

    outcome = _build_proposal_builder(session).build_for_classification(classification.id)
    assert outcome.proposal is not None
    assert outcome.proposal.proposal_type == "vendor_payment_apply"
    assert outcome.proposal.status == "pending_review"
    assert outcome.exception_case is None
    assert len(outcome.lines) == 1
    assert outcome.lines[0].action_type == "apply_bill"
    assert outcome.lines[0].allocation_json["bill_number"] == "VP-001"


def test_missing_bill_proposal_generation() -> None:
    session = _session()
    _seed_rule_version(session)
    vendor = _seed_vendor(session, "GAMMA SUPPLIES PRIVATE LIMITED", "Gamma Supplies", gstin="27AAAAA1111A1Z1")
    document = _seed_source_document(session, "missing-bill")
    source_record = _seed_source_record(session, document, "missing-bill", "gst_purchase_line", date(2025, 4, 6), Decimal("1180.00"))
    line = GstPurchaseLine(
        source_record_id=source_record.id,
        supplier_gstin=vendor.gstin,
        supplier_name=vendor.display_name,
        invoice_number="GST-001",
        invoice_date=date(2025, 4, 6),
        taxable_value=Decimal("1000.00"),
        igst_amount=Decimal("180.00"),
        cgst_amount=Decimal("0.00"),
        sgst_amount=Decimal("0.00"),
        cess_amount=Decimal("0.00"),
        total_tax_amount=Decimal("180.00"),
        filing_period="2025-04",
        match_status="unmatched",
    )
    session.add(line)
    session.flush()

    classification = _build_classification_pipeline(session).classify_gst_purchase_line(line).classification_result
    assert classification is not None

    outcome = _build_proposal_builder(session).build_for_classification(classification.id)
    assert outcome.proposal is not None
    assert outcome.proposal.proposal_type == "vendor_bill_create"
    assert outcome.proposal.status == "draft"
    assert len(outcome.lines) == 3
    assert outcome.lines[1].review_required is True
    assert outcome.lines[1].is_blocking is True
    assert outcome.lines[2].review_required is True
    assert outcome.lines[2].is_blocking is True


def test_ambiguous_case_creates_exception_instead_of_proposal() -> None:
    session = _session()
    _seed_rule_version(session)
    document = _seed_source_document(session, "ambiguous-proposal")
    source_record = _seed_source_record(session, document, "ambiguous-proposal", "bank_txn", date(2025, 4, 10), Decimal("900.00"))
    bank_account = BankAccount(account_name="Main", account_mask="XXXX2222", bank_name="Test Bank", metadata_json={})
    session.add(bank_account)
    session.flush()
    transaction = BankTransaction(
        source_record_id=source_record.id,
        bank_account_id=bank_account.id,
        bank_account_ref="XXXX2222",
        transaction_date=date(2025, 4, 10),
        direction="debit",
        amount=Decimal("900.00"),
        signed_amount=Decimal("-900.00"),
        narration="Payment INV-900",
        bank_reference="INV-900",
        metadata_json={},
    )
    session.add(transaction)
    for idx in ("1", "2"):
        _seed_zoho_bill_snapshot(
            session,
            suffix=f"proposal-amb-{idx}",
            snapshot_batch_key="snap-amb",
            vendor_name=f"Vendor {idx}",
            vendor_id=f"vz-{idx}",
            zoho_object_id=f"bill-amb-{idx}",
            bill_number=f"INV-900-{idx}",
            bill_date=date(2025, 4, 9),
            total=Decimal("900.00"),
            balance=Decimal("900.00"),
            reference_number="INV-900",
        )

    pipeline_outcome = _build_classification_pipeline(session).classify_bank_transaction(transaction)
    assert pipeline_outcome.classification_result is None
    assert pipeline_outcome.exception_case is not None

    classification = ClassificationResult(
        evidence_bundle_id=pipeline_outcome.bundle_id,
        rule_version_id=_seed_rule_version(session, version_code="2026.03.29.2").id,
        classification_type="vendor_payment",
        status="proposed",
        confidence_score=Decimal("0.99"),
        accounting_period_date=date(2025, 4, 10),
        decision_summary="forced test classification",
        explanation_json={},
        ai_assist_json={},
    )
    session.add(classification)
    session.flush()

    outcome = _build_proposal_builder(session).build_for_classification(classification.id)
    assert outcome.proposal is None
    assert outcome.exception_case is not None
    assert outcome.exception_case.exception_type == "proposal_blocked_conflict"


def test_rerun_idempotency() -> None:
    session = _session()
    _seed_rule_version(session)
    vendor = _seed_vendor(session, "VENDOR TWO PRIVATE LIMITED", "Vendor Two", beneficiary_fingerprint="fp-v2")
    document = _seed_source_document(session, "rerun")
    source_record = _seed_source_record(session, document, "rerun", "bank_txn", date(2025, 4, 11), Decimal("500.00"))
    bank_account = BankAccount(account_name="Main", account_mask="XXXX3333", bank_name="Test Bank", metadata_json={})
    session.add(bank_account)
    session.flush()
    transaction = BankTransaction(
        source_record_id=source_record.id,
        bank_account_id=bank_account.id,
        bank_account_ref="XXXX3333",
        transaction_date=date(2025, 4, 11),
        direction="debit",
        amount=Decimal("500.00"),
        signed_amount=Decimal("-500.00"),
        narration="Payment VP-500",
        counterparty_name=vendor.display_name,
        counterparty_fingerprint="fp-v2",
        bank_reference="VP-500",
        metadata_json={},
    )
    session.add(transaction)
    _seed_zoho_bill_snapshot(
        session,
        suffix="proposal-rerun",
        snapshot_batch_key="snap-rerun",
        vendor_name=vendor.display_name,
        vendor_id="zoho-v2",
        zoho_object_id="bill-rerun",
        bill_number="VP-500",
        bill_date=date(2025, 4, 10),
        total=Decimal("500.00"),
        balance=Decimal("500.00"),
        reference_number="VP-500",
    )

    classification = _build_classification_pipeline(session).classify_bank_transaction(transaction).classification_result
    assert classification is not None
    builder = _build_proposal_builder(session)
    first = builder.build_for_classification(classification.id)
    second = builder.build_for_classification(classification.id)

    assert first.proposal is not None
    assert second.proposal is not None
    assert first.proposal.id == second.proposal.id
    assert session.scalar(select(func.count()).select_from(PostingProposal)) == 1
    assert session.scalar(select(func.count()).select_from(PostingProposalLine)) == len(first.lines)


def test_supersession_behavior_for_regenerated_proposals() -> None:
    session = _session()
    rule_one = _seed_rule_version(session, version_code="2026.03.29.1")
    vendor = _seed_vendor(session, "VENDOR THREE PRIVATE LIMITED", "Vendor Three", beneficiary_fingerprint="fp-v3")
    document = _seed_source_document(session, "supersede")
    source_record = _seed_source_record(session, document, "supersede", "bank_txn", date(2025, 4, 13), Decimal("1000.00"))
    bank_account = BankAccount(account_name="Main", account_mask="XXXX4444", bank_name="Test Bank", metadata_json={})
    session.add(bank_account)
    session.flush()
    transaction = BankTransaction(
        source_record_id=source_record.id,
        bank_account_id=bank_account.id,
        bank_account_ref="XXXX4444",
        transaction_date=date(2025, 4, 13),
        direction="debit",
        amount=Decimal("900.00"),
        signed_amount=Decimal("-900.00"),
        narration="Payment SUP-001",
        counterparty_name=vendor.display_name,
        counterparty_fingerprint="fp-v3",
        bank_reference="SUP-001",
        metadata_json={},
    )
    session.add(transaction)
    _seed_zoho_bill_snapshot(
        session,
        suffix="proposal-sup",
        snapshot_batch_key="snap-sup",
        vendor_name=vendor.display_name,
        vendor_id="zoho-v3",
        zoho_object_id="bill-sup",
        bill_number="SUP-001",
        bill_date=date(2025, 4, 12),
        total=Decimal("900.00"),
        balance=Decimal("900.00"),
        reference_number="SUP-001",
    )

    pipeline = _build_classification_pipeline(session)
    first_classification = pipeline.classify_bank_transaction(transaction).classification_result
    assert first_classification is not None
    first_proposal = _build_proposal_builder(session).build_for_classification(first_classification.id).proposal
    assert first_proposal is not None

    rule_one.is_active = False
    rule_two = _seed_rule_version(session, version_code="2026.03.30.1")
    second_classification = ClassificationResult(
        evidence_bundle_id=first_classification.evidence_bundle_id,
        rule_version_id=rule_two.id,
        classification_type="vendor_payment",
        status="proposed",
        confidence_score=Decimal("0.99"),
        materiality_amount=Decimal("900.00"),
        accounting_period_date=date(2025, 4, 13),
        decision_summary="Bank debit matches a Zoho bill deterministically.",
        explanation_json={"accepted_candidate_id": first_classification.explanation_json.get("accepted_candidate_id"), "reason": "rule_upgrade"},
        ai_assist_json={},
        supersedes_classification_id=first_classification.id,
    )
    session.add(second_classification)
    session.flush()

    second_proposal = _build_proposal_builder(session).build_for_classification(second_classification.id).proposal
    assert second_proposal is not None
    assert second_proposal.id != first_proposal.id
    assert second_proposal.supersedes_proposal_id == first_proposal.id
    assert first_proposal.status == "superseded"
    assert session.scalar(select(func.count()).select_from(PostingProposal)) == 2
