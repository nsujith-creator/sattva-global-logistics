"""Integration tests for posting-readiness preflight and dry-run payloads."""

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
from db.models.reference import AccountMaster, FiscalYear, PeriodLock, RuleVersion, VendorMaster
from db.models.tax import GstPurchaseLine
from db.models.workflow import PostingProposal
from db.models.zoho import ZohoSnapshotBill
from db.repositories.audit import AuditEventRepository
from db.repositories.proposals import (
    ApprovalDecisionRepository,
    ProposalLineRepository,
    ProposalLineRevisionRepository,
    ProposalRepository,
    ProposalRevisionRepository,
)
from db.repositories.reference import AccountMasterRepository, PeriodLockRepository, RuleVersionRepository, VendorAliasRepository, VendorMasterRepository
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
from preflight.service import PostingPreflightService
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
        change_summary="Phase D6 tests",
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


def _seed_account(session: Session, account_code: str, account_name: str, *, account_type: str, gst_treatment_hint: str | None = None) -> AccountMaster:
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


def _preflight_service(session: Session) -> PostingPreflightService:
    return PostingPreflightService(
        proposal_repository=ProposalRepository(session),
        proposal_line_repository=ProposalLineRepository(session),
        proposal_revision_repository=ProposalRevisionRepository(session),
        approval_decision_repository=ApprovalDecisionRepository(session),
        classification_repository=ClassificationResultRepository(session),
        period_lock_repository=PeriodLockRepository(session),
        master_data_service=_master_data_service(session),
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
        preflight_service=_preflight_service(session),
    )


def _build_vendor_payment_proposal(session: Session) -> PostingProposal:
    _seed_rule_version(session)
    vendor = _seed_vendor(session, "SAFE VENDOR PRIVATE LIMITED", "Safe Vendor", fingerprint="fp-safe")
    document = _seed_document(session, "d6-vendor")
    source_record = _seed_record(session, document, "d6-vendor", "bank_txn", date(2025, 4, 10), Decimal("1200.00"))
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
        suffix="preflight-vendor-bill",
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


def _build_missing_bill_proposal(session: Session) -> PostingProposal:
    _seed_rule_version(session)
    document = _seed_document(session, "d6-missing")
    source_record = _seed_record(session, document, "d6-missing", "gst_purchase_line", date(2025, 4, 6), Decimal("1180.00"))
    line = GstPurchaseLine(
        source_record_id=source_record.id,
        supplier_gstin="27BBBBB2222B1Z2",
        supplier_name="Unmapped Supplier",
        invoice_number="GST-D6-001",
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


def _approve_missing_bill(session: Session, proposal: PostingProposal) -> PostingProposal:
    vendor = _seed_vendor(session, "READY VENDOR PRIVATE LIMITED", "Ready Vendor", gstin="27AAAAA1111A1Z1")
    expense = _seed_account(session, "EXP-600", "Freight Expense", account_type="expense")
    tax = _seed_account(session, "GST-600", "Input GST", account_type="tax_asset", gst_treatment_hint="itc")
    ops = _reviewer_ops(session)
    ops.resolve_blocking_placeholder(proposal.id, line_no=1, reviewer="reviewer-1", vendor_reference=str(vendor.id))
    ops.resolve_blocking_placeholder(proposal.id, line_no=2, reviewer="reviewer-1", account_reference=str(expense.id))
    ops.resolve_blocking_placeholder(
        proposal.id,
        line_no=3,
        reviewer="reviewer-1",
        account_reference=str(tax.id),
        tax_code="eligible_itc",
    )
    ops.submit_for_review(proposal.id, reviewer="reviewer-1", comment="ready")
    ops.approve(proposal.id, reviewer="reviewer-1", comment="approved")
    return proposal


def test_approved_and_eligible_proposal_yields_ready_dry_run_payload() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session))
    preflight = _preflight_service(session).evaluate_proposal(proposal.id)
    payload = _preflight_service(session).build_dry_run_payload(proposal.id)

    assert preflight.eligible_for_posting is True
    assert preflight.preflight_status == "ready"
    assert payload.preflight_status == "ready"
    assert payload.idempotency_key


def test_blocked_unapproved_proposal_has_no_eligible_payload() -> None:
    session = _session()
    proposal = _build_missing_bill_proposal(session)
    preflight = _preflight_service(session).evaluate_proposal(proposal.id)
    payload = _preflight_service(session).build_dry_run_payload(proposal.id)

    assert preflight.eligible_for_posting is False
    assert "proposal not approved" in preflight.posting_block_reasons
    assert payload.preflight_status == "blocked"


def test_superseded_or_changed_proposal_is_stale() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session))
    proposal.policy_flags = {**proposal.policy_flags, "manual_note": "changed"}
    preflight = _preflight_service(session).evaluate_proposal(proposal.id)

    assert preflight.preflight_status == "stale"
    assert "proposal data changed since approval" in preflight.posting_block_reasons or "fingerprint/rule/input mismatch" in preflight.posting_block_reasons


def test_missing_master_data_blocks_preflight() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session))
    line = ProposalLineRepository(session).find_by_order(proposal.id, 2)
    assert line is not None
    line.account_master_id = None

    preflight = _preflight_service(session).evaluate_proposal(proposal.id)
    assert "missing vendor/account/tax/master-data requirements" in preflight.posting_block_reasons


def test_non_latest_zoho_target_blocks_preflight() -> None:
    session = _session()
    proposal = _build_vendor_payment_proposal(session)
    ops = _reviewer_ops(session)
    ops.approve(proposal.id, reviewer="reviewer-2", comment="approved")

    _seed_zoho_bill_snapshot(
        session,
        suffix="preflight-newer-batch",
        snapshot_batch_key="snap-safe-newer",
        vendor_name="Other Vendor",
        vendor_id="zoho-other",
        zoho_object_id="bill-other",
        bill_number="OTHER-001",
        bill_date=date(2025, 4, 9),
        total=Decimal("100.00"),
        balance=Decimal("100.00"),
        reference_number="OTHER-001",
    )

    preflight = _preflight_service(session).evaluate_proposal(proposal.id)

    assert preflight.eligible_for_posting is False
    assert preflight.preflight_status == "blocked"
    assert any("zoho target ineligible" in reason for reason in preflight.posting_block_reasons)


def test_locked_period_blocks_preflight() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session))
    fiscal_year = FiscalYear(code="FY25-26", start_date=date(2025, 4, 1), end_date=date(2026, 3, 31))
    session.add(fiscal_year)
    session.flush()
    session.add(
        PeriodLock(
            fiscal_year_id=fiscal_year.id,
            period_code="2025-04",
            lock_state="locked",
            locked_at=datetime.now(timezone.utc),
            reason="month close",
        )
    )
    session.flush()

    preflight = _preflight_service(session).evaluate_proposal(proposal.id)
    assert "locked period" in preflight.posting_block_reasons


def test_deterministic_idempotency_key_behavior() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session))
    service = _preflight_service(session)

    first = service.evaluate_proposal(proposal.id)
    second = service.evaluate_proposal(proposal.id)

    assert first.idempotency_key == second.idempotency_key


def test_vendor_payment_apply_payload_structure() -> None:
    session = _session()
    proposal = _build_vendor_payment_proposal(session)
    ops = _reviewer_ops(session)
    ops.reject(proposal.id, reviewer="reviewer-2", comment="for structure only")
    payload = _preflight_service(session).build_dry_run_payload(proposal.id)

    assert payload.proposal_type == "vendor_payment_apply"
    assert payload.payload_body["bill_allocation"]["allocation_details"]["bill_number"] == "SAFE-001"
    assert "residual_handling" in payload.payload_body


def test_vendor_bill_create_payload_structure() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session))
    payload = _preflight_service(session).build_dry_run_payload(proposal.id)

    assert payload.proposal_type == "vendor_bill_create"
    assert payload.payload_body["posting_intent"] == "create_vendor_bill"
    assert payload.payload_body["placeholder_state"]["final_accounting_certainty"] == "not_fabricated"
    assert len(payload.payload_body["bill_lines"]) == 3
