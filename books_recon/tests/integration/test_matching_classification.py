"""Integration tests for matching and classification foundation."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from db.base import Base
from db.models.banking import BankAccount, BankTransaction
from db.models.evidence import SourceDocument, SourceRecord
from db.models.reference import RuleVersion, VendorAlias, VendorMaster
from db.models.tax import GstPurchaseLine, TaxInformationItem
from db.models.workflow import ClassificationResult, MatchCandidate
from db.models.zoho import ZohoSnapshotBill
from db.repositories.audit import AuditEventRepository
from db.repositories.reference import RuleVersionRepository, VendorAliasRepository, VendorMasterRepository
from db.repositories.workflow import (
    ClassificationResultRepository,
    EvidenceBundleItemRepository,
    EvidenceBundleRepository,
    ExceptionCaseRepository,
    MatchCandidateRepository,
)
from matching.bundles import BundleMember, EvidenceBundleService
from matching.candidate_engine import MatchCandidateEngine
from normalization.identity import BankCounterpartyNormalizationService, VendorIdentityNormalizationService
from rules.classification_pipeline import ClassificationPipeline


def _session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    return Session(engine)


def _seed_rule_version(session: Session) -> RuleVersion:
    rule_version = RuleVersion(
        rulebook_name="core_accounting_rules",
        version_code="2026.03.29.1",
        effective_from=date(2025, 4, 1),
        is_active=True,
        published_by="tests",
        change_summary="Phase D2 foundation",
        rules_json={"matching": {"bank_date_window_days": 7, "gst_date_tolerance_days": 3, "gst_amount_tolerance": 1.0}},
    )
    session.add(rule_version)
    session.flush()
    return rule_version


def _seed_vendor(session: Session, *, canonical_name: str, display_name: str, **kwargs) -> VendorMaster:
    vendor = VendorMaster(
        canonical_name=canonical_name,
        display_name=display_name,
        vendor_type="freight_vendor",
        beneficiary_fingerprints=kwargs.pop("beneficiary_fingerprints", []),
        **kwargs,
    )
    session.add(vendor)
    session.flush()
    return vendor


def _seed_source_document(session: Session, suffix: str) -> SourceDocument:
    now = datetime.now(timezone.utc)
    document = SourceDocument(
        source_system="test",
        document_type="fixture",
        original_filename=f"fixture-{suffix}.json",
        storage_path=f"/tmp/fixture-{suffix}.json",
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
    vendor_name: str,
    vendor_id: str,
    zoho_object_id: str,
    bill_number: str,
    bill_date: date,
    total: Decimal,
    balance: Decimal,
    reference_number: str | None,
    snapshot_batch_key: str,
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


def _build_pipeline(session: Session) -> ClassificationPipeline:
    vendor_repo = VendorMasterRepository(session)
    alias_repo = VendorAliasRepository(session)
    normalization_service = VendorIdentityNormalizationService(vendor_repo, alias_repo)
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


def test_normalization_priority_correctness() -> None:
    session = _session()
    _seed_rule_version(session)
    primary_vendor = _seed_vendor(
        session,
        canonical_name="ALPHA LOGISTICS PRIVATE LIMITED",
        display_name="Alpha Logistics",
        gstin="29ABCDE1234F1Z5",
        zoho_contact_id="z-alpha",
        beneficiary_fingerprints=["fp-alpha"],
    )
    alias_vendor = _seed_vendor(session, canonical_name="BETA TRADERS PRIVATE LIMITED", display_name="Beta Traders")
    session.add(
        VendorAlias(
            vendor_master_id=alias_vendor.id,
            alias_type="name",
            alias_value="BETA TRDRS",
            normalized_alias_value="BETA TRDRS",
            source_system="bank",
            metadata_json={},
        )
    )
    session.flush()

    normalization_service = VendorIdentityNormalizationService(VendorMasterRepository(session), VendorAliasRepository(session))
    result = normalization_service.resolve(
        gstin="29ABCDE1234F1Z5",
        zoho_contact_id="wrong-contact",
        beneficiary_fingerprint="wrong-fp",
        alias_text="BETA TRDRS",
    )
    assert result.vendor_master_id == primary_vendor.id
    assert result.match_method == "gstin_exact"

    alias_result = normalization_service.resolve(alias_text="BETA TRDRS")
    assert alias_result.vendor_master_id == alias_vendor.id
    assert alias_result.match_method == "alias_exact"


def test_classifies_bank_transaction_as_vendor_payment() -> None:
    session = _session()
    _seed_rule_version(session)
    vendor = _seed_vendor(
        session,
        canonical_name="KOTAK MULTILINK LOGISTICS PRIVATE LIMITED",
        display_name="Kotak",
        beneficiary_fingerprints=["fp-kotak"],
    )
    document = _seed_source_document(session, "bank-vendor")
    source_record = _seed_source_record(session, document, "bank-vendor", "bank_txn", date(2025, 4, 10), Decimal("1200.00"))
    bank_account = BankAccount(account_name="Main", account_mask="XXXX1234", bank_name="Test Bank", metadata_json={})
    session.add(bank_account)
    session.flush()
    transaction = BankTransaction(
        source_record_id=source_record.id,
        bank_account_id=bank_account.id,
        bank_account_ref="XXXX1234",
        transaction_date=date(2025, 4, 10),
        direction="debit",
        amount=Decimal("1200.00"),
        signed_amount=Decimal("-1200.00"),
        narration="Payment BILL-001",
        counterparty_name="Kotak",
        counterparty_fingerprint="fp-kotak",
        bank_reference="BILL-001",
        metadata_json={},
    )
    session.add(transaction)
    _seed_zoho_bill_snapshot(
        session,
        suffix="bank-vendor-bill",
        snapshot_batch_key="snap-1",
        vendor_name=vendor.display_name,
        vendor_id="zv-1",
        zoho_object_id="bill-1",
        bill_number="BILL-001",
        bill_date=date(2025, 4, 8),
        total=Decimal("1200.00"),
        balance=Decimal("1200.00"),
        reference_number="BILL-001",
    )

    outcome = _build_pipeline(session).classify_bank_transaction(transaction)
    assert outcome.classification_result is not None
    assert outcome.classification_result.classification_type == "vendor_payment"
    assert session.scalar(select(func.count()).select_from(ClassificationResult)) == 1
    assert any(candidate.to_object_type == "zoho_snapshot_bill" for candidate in outcome.candidates)


def test_classifies_bank_transaction_as_tax_payment_candidate() -> None:
    session = _session()
    _seed_rule_version(session)
    document = _seed_source_document(session, "bank-tax")
    source_record = _seed_source_record(session, document, "bank-tax", "bank_txn", date(2025, 4, 15), Decimal("5000.00"))
    bank_account = BankAccount(account_name="Main", account_mask="XXXX5678", bank_name="Test Bank", metadata_json={})
    session.add(bank_account)
    session.flush()
    transaction = BankTransaction(
        source_record_id=source_record.id,
        bank_account_id=bank_account.id,
        bank_account_ref="XXXX5678",
        transaction_date=date(2025, 4, 15),
        direction="debit",
        amount=Decimal("5000.00"),
        signed_amount=Decimal("-5000.00"),
        narration="Income tax payment",
        bank_reference="CIN-123",
        metadata_json={},
    )
    tax_record = _seed_source_record(session, document, "tax-item", "tax_information_item", date(2025, 4, 15), Decimal("5000.00"))
    session.add(
        TaxInformationItem(
            source_record_id=tax_record.id,
            tax_system="income_tax",
            item_type="advance_tax",
            authority_reference="CIN-123",
            item_date=date(2025, 4, 15),
            amount=Decimal("5000.00"),
            metadata_json={},
        )
    )
    session.add(transaction)
    session.flush()

    outcome = _build_pipeline(session).classify_bank_transaction(transaction)
    assert outcome.classification_result is not None
    assert outcome.classification_result.classification_type == "tax_payment_candidate"


def test_detects_conflict_between_multiple_high_score_bills() -> None:
    session = _session()
    _seed_rule_version(session)
    document = _seed_source_document(session, "bank-conflict")
    source_record = _seed_source_record(session, document, "bank-conflict", "bank_txn", date(2025, 4, 10), Decimal("900.00"))
    bank_account = BankAccount(account_name="Main", account_mask="XXXX9999", bank_name="Test Bank", metadata_json={})
    session.add(bank_account)
    session.flush()
    transaction = BankTransaction(
        source_record_id=source_record.id,
        bank_account_id=bank_account.id,
        bank_account_ref="XXXX9999",
        transaction_date=date(2025, 4, 10),
        direction="debit",
        amount=Decimal("900.00"),
        signed_amount=Decimal("-900.00"),
        narration="Payment INV-900",
        bank_reference="INV-900",
        metadata_json={},
    )
    session.add(transaction)
    for suffix in ("1", "2"):
        _seed_zoho_bill_snapshot(
            session,
            suffix=f"bank-conflict-{suffix}",
            snapshot_batch_key="snap-conflict",
            vendor_name=f"Vendor {suffix}",
            vendor_id=f"vz-{suffix}",
            zoho_object_id=f"bill-conflict-{suffix}",
            bill_number=f"INV-900-{suffix}",
            bill_date=date(2025, 4, 9),
            total=Decimal("900.00"),
            balance=Decimal("900.00"),
            reference_number="INV-900",
        )

    outcome = _build_pipeline(session).classify_bank_transaction(transaction)
    assert outcome.classification_result is None
    assert outcome.exception_case is not None
    assert outcome.exception_case.exception_type == "match_conflict"
    bill_candidates = [candidate for candidate in outcome.candidates if candidate.to_object_type == "zoho_snapshot_bill"]
    assert len(bill_candidates) == 2
    assert all(candidate.conflict_group_id for candidate in bill_candidates)


def test_synthetic_bill_is_excluded_from_candidate_generation() -> None:
    session = _session()
    _seed_rule_version(session)
    vendor = _seed_vendor(
        session,
        canonical_name="SAFE VENDOR PRIVATE LIMITED",
        display_name="Safe Vendor",
        beneficiary_fingerprints=["fp-safe"],
    )
    document = _seed_source_document(session, "bank-synthetic-filter")
    source_record = _seed_source_record(session, document, "bank-synthetic-filter", "bank_txn", date(2025, 4, 10), Decimal("1200.00"))
    bank_account = BankAccount(account_name="Main", account_mask="XXXX1244", bank_name="Test Bank", metadata_json={})
    session.add(bank_account)
    session.flush()
    transaction = BankTransaction(
        source_record_id=source_record.id,
        bank_account_id=bank_account.id,
        bank_account_ref="XXXX1244",
        transaction_date=date(2025, 4, 10),
        direction="debit",
        amount=Decimal("1200.00"),
        signed_amount=Decimal("-1200.00"),
        narration="Payment SAFE-REAL",
        counterparty_name="Safe Vendor",
        counterparty_fingerprint="fp-safe",
        bank_reference="SAFE-REAL",
        metadata_json={},
    )
    session.add(transaction)
    toxic_bill = _seed_zoho_bill_snapshot(
        session,
        suffix="synthetic-filter-toxic",
        snapshot_batch_key="zoho-batch-filter",
        vendor_name="Phase2C Sandbox Vendor",
        vendor_id="zoho-vendor-phase2c-vendor-payment-001",
        zoho_object_id="bill-phase2c-vendor-payment-001",
        bill_number="SAFE-REAL",
        bill_date=date(2025, 4, 9),
        total=Decimal("1200.00"),
        balance=Decimal("1200.00"),
        reference_number="SAFE-REAL",
    )
    real_bill = _seed_zoho_bill_snapshot(
        session,
        suffix="synthetic-filter-real",
        snapshot_batch_key="zoho-batch-filter",
        vendor_name=vendor.display_name,
        vendor_id="zv-safe-real",
        zoho_object_id="bill-real-safe",
        bill_number="SAFE-REAL",
        bill_date=date(2025, 4, 9),
        total=Decimal("1200.00"),
        balance=Decimal("1200.00"),
        reference_number="SAFE-REAL",
    )

    outcome = _build_pipeline(session).classify_bank_transaction(transaction)
    bill_candidates = [candidate for candidate in outcome.candidates if candidate.to_object_type == "zoho_snapshot_bill"]

    assert bill_candidates
    assert all(candidate.to_object_id != str(toxic_bill.id) for candidate in bill_candidates)
    assert any(candidate.to_object_id == str(real_bill.id) for candidate in bill_candidates)


def test_classifies_unmatched_gst_line_as_missing_bill_candidate() -> None:
    session = _session()
    _seed_rule_version(session)
    vendor = _seed_vendor(
        session,
        canonical_name="GAMMA SUPPLIES PRIVATE LIMITED",
        display_name="Gamma Supplies",
        gstin="27AAAAA1111A1Z1",
    )
    document = _seed_source_document(session, "gst-missing")
    source_record = _seed_source_record(session, document, "gst-missing", "gst_purchase_line", date(2025, 4, 6), Decimal("1180.00"))
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

    outcome = _build_pipeline(session).classify_gst_purchase_line(line)
    assert outcome.classification_result is not None
    assert outcome.classification_result.classification_type == "missing_bill_candidate"


def test_rerun_is_idempotent_and_bundle_consistent() -> None:
    session = _session()
    rule_version = _seed_rule_version(session)
    bundle_service = EvidenceBundleService(EvidenceBundleRepository(session), EvidenceBundleItemRepository(session))

    first_bundle = bundle_service.get_or_create_bundle(
        bundle_type="bank_transaction_case",
        primary_record_type="bank_transaction",
        primary_record_id="txn-1",
        evidence_summary="bundle one",
        rule_version=rule_version,
        members=[BundleMember("bank_transaction", "txn-1", "primary"), BundleMember("vendor_master", "vendor-1", "candidate_target")],
    )
    second_bundle = bundle_service.get_or_create_bundle(
        bundle_type="bank_transaction_case",
        primary_record_type="bank_transaction",
        primary_record_id="txn-1",
        evidence_summary="bundle one",
        rule_version=rule_version,
        members=[BundleMember("vendor_master", "vendor-1", "candidate_target"), BundleMember("bank_transaction", "txn-1", "primary")],
    )
    assert first_bundle.id == second_bundle.id

    vendor = _seed_vendor(
        session,
        canonical_name="DELTA SERVICES PRIVATE LIMITED",
        display_name="Delta Services",
        beneficiary_fingerprints=["fp-delta"],
    )
    document = _seed_source_document(session, "bank-rerun")
    source_record = _seed_source_record(session, document, "bank-rerun", "bank_txn", date(2025, 4, 12), Decimal("400.00"))
    bank_account = BankAccount(account_name="Main", account_mask="XXXX0001", bank_name="Test Bank", metadata_json={})
    session.add(bank_account)
    session.flush()
    transaction = BankTransaction(
        source_record_id=source_record.id,
        bank_account_id=bank_account.id,
        bank_account_ref="XXXX0001",
        transaction_date=date(2025, 4, 12),
        direction="debit",
        amount=Decimal("400.00"),
        signed_amount=Decimal("-400.00"),
        narration="Delta subscription",
        counterparty_name=vendor.display_name,
        counterparty_fingerprint="fp-delta",
        metadata_json={},
    )
    session.add(transaction)
    session.flush()

    pipeline = _build_pipeline(session)
    first = pipeline.classify_bank_transaction(transaction)
    second = pipeline.classify_bank_transaction(transaction)

    assert first.bundle_id == second.bundle_id
    assert first.classification_result is not None
    assert second.classification_result is not None
    assert first.classification_result.id == second.classification_result.id
    assert session.scalar(select(func.count()).select_from(ClassificationResult)) == 1
    assert session.scalar(select(func.count()).select_from(MatchCandidate)) == len(first.candidates)
