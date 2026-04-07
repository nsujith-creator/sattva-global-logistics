"""Integration tests for reviewer operations, revision history, and master-data control."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from approvals.service import ProposalApprovalService
from db.base import Base
from db.models.banking import BankAccount, BankTransaction
from db.models.evidence import SourceDocument, SourceRecord
from db.models.reference import AccountMaster, RuleVersion, VendorMaster
from db.models.tax import GstPurchaseLine
from db.models.workflow import ProposalLineRevision, ProposalRevision
from db.models.zoho import ZohoSnapshotBill
from db.repositories.audit import AuditEventRepository
from db.repositories.proposals import (
    ApprovalDecisionRepository,
    ProposalLineRepository,
    ProposalLineRevisionRepository,
    ProposalRepository,
    ProposalRevisionRepository,
)
from db.repositories.reference import AccountMasterRepository, RuleVersionRepository, VendorAliasRepository, VendorMasterRepository
from db.repositories.workflow import (
    ClassificationResultRepository,
    EvidenceBundleItemRepository,
    EvidenceBundleRepository,
    ExceptionCaseRepository,
    MatchCandidateRepository,
)
from master_data.service import MasterDataControlService
from matching.bundles import EvidenceBundleService
from matching.candidate_engine import MatchCandidateEngine
from normalization.identity import BankCounterpartyNormalizationService, VendorIdentityNormalizationService
from proposals.builder import ProposalBuilder
from reviewer_ops.service import ReviewerOperationsService
from rules.classification_pipeline import ClassificationPipeline


def _session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    return Session(engine)


def _seed_rule_version(session: Session, version_code: str = "2026.03.29.1") -> RuleVersion:
    existing = session.scalar(select(RuleVersion).where(RuleVersion.version_code == version_code))
    if existing is not None:
        return existing
    rule_version = RuleVersion(
        rulebook_name="core_accounting_rules",
        version_code=version_code,
        effective_from=date(2025, 4, 1),
        is_active=True,
        published_by="tests",
        change_summary="Phase D5 tests",
        rules_json={"matching": {"bank_date_window_days": 7, "gst_date_tolerance_days": 3, "gst_amount_tolerance": 1.0}},
    )
    session.add(rule_version)
    session.flush()
    return rule_version


def _seed_vendor(session: Session, canonical_name: str, display_name: str, *, gstin: str | None = None, fingerprint: str | None = None) -> VendorMaster:
    vendor = VendorMaster(
        canonical_name=canonical_name,
        display_name=display_name,
        vendor_type="freight_vendor",
        gstin=gstin,
        beneficiary_fingerprints=[fingerprint] if fingerprint else [],
    )
    session.add(vendor)
    session.flush()
    return vendor


def _seed_account(
    session: Session,
    account_code: str,
    account_name: str,
    *,
    account_type: str,
    gst_treatment_hint: str | None = None,
) -> AccountMaster:
    account = AccountMaster(
        account_code=account_code,
        account_name=account_name,
        account_type=account_type,
        normal_balance="debit",
        gst_treatment_hint=gst_treatment_hint,
    )
    session.add(account)
    session.flush()
    return account


def _seed_document(session: Session, suffix: str) -> SourceDocument:
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


def _seed_record(session: Session, document: SourceDocument, suffix: str, record_type: str, event_date: date, amount: Decimal) -> SourceRecord:
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


def _classification_pipeline(session: Session) -> ClassificationPipeline:
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


def _proposal_builder(session: Session) -> ProposalBuilder:
    return ProposalBuilder(
        session,
        proposal_repository=ProposalRepository(session),
        proposal_line_repository=ProposalLineRepository(session),
        classification_repository=ClassificationResultRepository(session),
        match_candidate_repository=MatchCandidateRepository(session),
        exception_repository=ExceptionCaseRepository(session),
        audit_repository=AuditEventRepository(session),
    )


def _approval_service(session: Session) -> ProposalApprovalService:
    return ProposalApprovalService(
        proposal_repository=ProposalRepository(session),
        proposal_line_repository=ProposalLineRepository(session),
        approval_decision_repository=ApprovalDecisionRepository(session),
        exception_repository=ExceptionCaseRepository(session),
        audit_repository=AuditEventRepository(session),
        proposal_revision_repository=ProposalRevisionRepository(session),
        proposal_line_revision_repository=ProposalLineRevisionRepository(session),
        vendor_repository=VendorMasterRepository(session),
        vendor_alias_repository=VendorAliasRepository(session),
        account_repository=AccountMasterRepository(session),
    )


def _master_data_service(session: Session) -> MasterDataControlService:
    return MasterDataControlService(
        vendor_repository=VendorMasterRepository(session),
        vendor_alias_repository=VendorAliasRepository(session),
        account_repository=AccountMasterRepository(session),
    )


def _reviewer_ops(session: Session) -> ReviewerOperationsService:
    return ReviewerOperationsService(
        session,
        proposal_repository=ProposalRepository(session),
        proposal_line_repository=ProposalLineRepository(session),
        proposal_revision_repository=ProposalRevisionRepository(session),
        proposal_line_revision_repository=ProposalLineRevisionRepository(session),
        classification_repository=ClassificationResultRepository(session),
        approval_decision_repository=ApprovalDecisionRepository(session),
        approval_service=_approval_service(session),
        master_data_service=_master_data_service(session),
    )


def _build_missing_bill_proposal(session: Session, *, unresolved_vendor: bool = True):
    _seed_rule_version(session)
    supplier_name = "Unmapped Supplier"
    supplier_gstin = "27BBBBB2222B1Z2"
    if not unresolved_vendor:
        _seed_vendor(session, "GST VENDOR PRIVATE LIMITED", "GST Vendor", gstin="27AAAAA1111A1Z1")
        supplier_name = "GST Vendor"
        supplier_gstin = "27AAAAA1111A1Z1"

    document = _seed_document(session, f"missing-{unresolved_vendor}")
    source_record = _seed_record(session, document, f"missing-{unresolved_vendor}", "gst_purchase_line", date(2025, 4, 6), Decimal("1180.00"))
    line = GstPurchaseLine(
        source_record_id=source_record.id,
        supplier_gstin=supplier_gstin,
        supplier_name=supplier_name,
        invoice_number="GST-D5-001",
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
    classification = _classification_pipeline(session).classify_gst_purchase_line(line).classification_result
    assert classification is not None
    proposal = _proposal_builder(session).build_for_classification(classification.id).proposal
    assert proposal is not None
    return proposal


def _build_vendor_payment_proposal(session: Session):
    _seed_rule_version(session)
    vendor = _seed_vendor(session, "SAFE VENDOR PRIVATE LIMITED", "Safe Vendor", fingerprint="fp-safe")
    document = _seed_document(session, "approval-vendor")
    source_record = _seed_record(session, document, "approval-vendor", "bank_txn", date(2025, 4, 10), Decimal("1200.00"))
    bank_account = BankAccount(account_name="Main", account_mask="XXXX7000", bank_name="Test Bank", metadata_json={})
    session.add(bank_account)
    session.flush()
    transaction = BankTransaction(
        source_record_id=source_record.id,
        bank_account_id=bank_account.id,
        bank_account_ref="XXXX7000",
        transaction_date=date(2025, 4, 10),
        direction="debit",
        amount=Decimal("1200.00"),
        signed_amount=Decimal("-1200.00"),
        narration="Payment SAFE-001",
        counterparty_name=vendor.display_name,
        counterparty_fingerprint="fp-safe",
        bank_reference="SAFE-001",
        metadata_json={},
    )
    session.add(transaction)
    _seed_zoho_bill_snapshot(
        session,
        suffix="reviewer-vendor-bill",
        snapshot_batch_key="snap-safe",
        vendor_name=vendor.display_name,
        vendor_id="zoho-safe",
        zoho_object_id="bill-safe",
        bill_number="SAFE-001",
        bill_date=date(2025, 4, 8),
        total=Decimal("1200.00"),
        balance=Decimal("1200.00"),
        reference_number="SAFE-001",
    )
    classification = _classification_pipeline(session).classify_bank_transaction(transaction).classification_result
    assert classification is not None
    proposal = _proposal_builder(session).build_for_classification(classification.id).proposal
    assert proposal is not None
    return proposal


def test_revision_history_is_append_only_for_reviewer_edits() -> None:
    session = _session()
    vendor = _seed_vendor(session, "RESOLVED VENDOR PRIVATE LIMITED", "Resolved Vendor", gstin="27AAAAA1111A1Z1")
    expense_account = _seed_account(session, "EXP-300", "Freight Expense", account_type="expense")
    tax_account = _seed_account(session, "GST-300", "Input GST", account_type="tax_asset", gst_treatment_hint="itc")
    proposal = _build_missing_bill_proposal(session)
    ops = _reviewer_ops(session)

    ops.resolve_blocking_placeholder(proposal.id, line_no=1, reviewer="reviewer-1", vendor_reference=str(vendor.id), comment="map vendor")
    ops.resolve_blocking_placeholder(proposal.id, line_no=2, reviewer="reviewer-1", account_reference=str(expense_account.id), comment="expense mapping")
    ops.resolve_blocking_placeholder(
        proposal.id,
        line_no=3,
        reviewer="reviewer-1",
        account_reference=str(tax_account.id),
        tax_code="eligible_itc",
        comment="tax mapping",
    )

    proposal_revisions = session.scalars(select(ProposalRevision).where(ProposalRevision.posting_proposal_id == proposal.id)).all()
    line_revisions = session.scalars(select(ProposalLineRevision).where(ProposalLineRevision.posting_proposal_id == proposal.id)).all()
    assert len(proposal_revisions) == 3
    assert len(line_revisions) == 3
    assert line_revisions[0].prior_values_json["vendor_master_id"] is None
    assert line_revisions[0].new_values_json["vendor_master_id"] == str(vendor.id)
    assert line_revisions[2].new_values_json["tax_code"] == "eligible_itc"


def test_master_data_alias_and_canonical_resolution_helpers() -> None:
    session = _session()
    master_data = _master_data_service(session)

    vendor = master_data.upsert_vendor_master(
        canonical_name="ALPHA ROADWAYS PRIVATE LIMITED",
        display_name="Alpha Roadways",
        vendor_type="freight_vendor",
        gstin="29ABCDE1234F1Z5",
        created_by="tester",
    )
    alias = master_data.upsert_vendor_alias(
        vendor_master_id=vendor.id,
        alias_value="ALPHA ROAD",
        source_system="bank",
        created_by="tester",
    )
    resolved = master_data.resolve_vendor_reference("ALPHA ROAD")

    assert alias.vendor_master_id == vendor.id
    assert resolved.vendor_master.id == vendor.id
    assert resolved.source == "alias_exact"


def test_pending_review_and_blocked_listing_and_inspect() -> None:
    session = _session()
    pending_proposal = _build_vendor_payment_proposal(session)
    blocked_proposal = _build_missing_bill_proposal(session)
    ops = _reviewer_ops(session)

    pending = ops.list_pending_review()
    blocked = ops.list_blocked()
    inspect_payload = ops.inspect_proposal(blocked_proposal.id)

    assert any(item.proposal_id == str(pending_proposal.id) for item in pending)
    assert any(item.proposal_id == str(blocked_proposal.id) for item in blocked)
    assert inspect_payload["blockers"]
    assert inspect_payload["evidence_summary"] is not None


def test_reviewer_edit_validation_rejects_invalid_account_domain() -> None:
    session = _session()
    _seed_account(session, "REV-400", "Sales Revenue", account_type="revenue")
    proposal = _build_missing_bill_proposal(session)
    ops = _reviewer_ops(session)

    with pytest.raises(ValueError):
        ops.resolve_blocking_placeholder(proposal.id, line_no=2, reviewer="reviewer-1", account_reference="REV-400")


def test_blocked_proposal_cannot_be_approved_until_valid_resolution_exists() -> None:
    session = _session()
    vendor = _seed_vendor(session, "MAP VENDOR PRIVATE LIMITED", "Map Vendor", gstin="27AAAAA1111A1Z1")
    expense_account = _seed_account(session, "EXP-500", "Expense", account_type="expense")
    tax_account = _seed_account(session, "GST-500", "GST Input", account_type="tax_asset", gst_treatment_hint="gst")
    proposal = _build_missing_bill_proposal(session)
    ops = _reviewer_ops(session)

    ops.submit_for_review(proposal.id, reviewer="reviewer-1", comment="ready")
    with pytest.raises(ValueError):
        ops.approve(proposal.id, reviewer="reviewer-1", comment="should fail")

    ops.resolve_blocking_placeholder(proposal.id, line_no=1, reviewer="reviewer-1", vendor_reference=str(vendor.id))
    ops.resolve_blocking_placeholder(proposal.id, line_no=2, reviewer="reviewer-1", account_reference=str(expense_account.id))
    ops.resolve_blocking_placeholder(
        proposal.id,
        line_no=3,
        reviewer="reviewer-1",
        account_reference=str(tax_account.id),
        tax_code="eligible_itc",
    )
    decision = ops.approve(proposal.id, reviewer="reviewer-1", comment="approved")

    assert decision.decision == "approved"


def test_reject_flow_through_reviewer_operations_layer() -> None:
    session = _session()
    proposal = _build_vendor_payment_proposal(session)
    ops = _reviewer_ops(session)

    decision = ops.reject(proposal.id, reviewer="reviewer-2", comment="evidence incomplete")
    proposal_revisions = session.scalars(select(ProposalRevision).where(ProposalRevision.posting_proposal_id == proposal.id)).all()

    assert decision.decision == "rejected"
    assert proposal_revisions[-1].approval_decision_id == decision.id
