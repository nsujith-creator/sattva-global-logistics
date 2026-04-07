"""Integration tests for approval foundation and proposal safety hardening."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from approvals.service import ProposalApprovalService
from db.base import Base
from db.models.audit import AuditEvent
from db.models.banking import BankAccount, BankTransaction
from db.models.evidence import SourceDocument, SourceRecord
from db.models.reference import AccountMaster, RuleVersion, VendorMaster
from db.models.tax import GstPurchaseLine
from db.models.workflow import ExceptionCase, PostingProposal, ProposalLineRevision, ProposalRevision
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
from matching.bundles import EvidenceBundleService
from matching.candidate_engine import MatchCandidateEngine
from normalization.identity import BankCounterpartyNormalizationService, VendorIdentityNormalizationService
from proposals.builder import ProposalBuilder
from proposals.history import ProposalHistoryService
from rules.classification_pipeline import ClassificationPipeline


def _session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    return Session(engine)


def _seed_rule_version(session: Session, version_code: str = "2026.03.29.1") -> RuleVersion:
    rule_version = RuleVersion(
        rulebook_name="core_accounting_rules",
        version_code=version_code,
        effective_from=date(2025, 4, 1),
        is_active=True,
        published_by="tests",
        change_summary="approval tests",
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


def _build_vendor_payment_proposal(session: Session) -> PostingProposal:
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
        suffix="approval-vendor-bill",
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


def _build_missing_bill_proposal(session: Session, *, unresolved_vendor: bool = False) -> PostingProposal:
    _seed_rule_version(session)
    if not unresolved_vendor:
        _seed_vendor(session, "GST VENDOR PRIVATE LIMITED", "GST Vendor", gstin="27AAAAA1111A1Z1")
        supplier_name = "GST Vendor"
        supplier_gstin = "27AAAAA1111A1Z1"
    else:
        supplier_name = "Unmapped Supplier"
        supplier_gstin = "27BBBBB2222B1Z2"
    document = _seed_document(session, f"approval-missing-{unresolved_vendor}")
    source_record = _seed_record(session, document, f"approval-missing-{unresolved_vendor}", "gst_purchase_line", date(2025, 4, 6), Decimal("1180.00"))
    line = GstPurchaseLine(
        source_record_id=source_record.id,
        supplier_gstin=supplier_gstin,
        supplier_name=supplier_name,
        invoice_number="GST-AP-001",
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


def test_valid_and_invalid_status_transitions() -> None:
    session = _session()
    vendor = _seed_vendor(session, "TRANSITION VENDOR PRIVATE LIMITED", "Transition Vendor", gstin="27AAAAA1111A1Z1")
    expense_account = _seed_account(session, "EXP-100", "Freight Expense", account_type="expense")
    tax_account = _seed_account(session, "GST-100", "Input GST", account_type="tax_asset", gst_treatment_hint="itc")
    proposal = _build_missing_bill_proposal(session, unresolved_vendor=True)
    service = _approval_service(session)

    with pytest.raises(ValueError):
        service.capture_decision(proposal.id, decision="approved", reviewer="reviewer-1")

    service.apply_reviewer_line_edit(proposal.id, line_no=1, reviewer="reviewer-1", edits={"vendor_master_id": vendor.id})
    service.apply_reviewer_line_edit(proposal.id, line_no=2, reviewer="reviewer-1", edits={"account_master_id": expense_account.id})

    submitted = service.submit_for_review(proposal.id, reviewer="reviewer-1", comment="ready")
    assert submitted.status == "pending_review"

    with pytest.raises(ValueError):
        service.submit_for_review(proposal.id, reviewer="reviewer-1")

    approval = service.capture_decision(
        proposal.id,
        decision="approved_with_edits",
        reviewer="reviewer-1",
        comment="approved after edits",
        edited_fields_payload=[
            {
                "line_no": 3,
                "fields": {"tax_code": "eligible_itc", "account_master_id": tax_account.id},
                "comment": "confirm tax coding",
            }
        ],
    )
    assert approval.decision == "approved_with_edits"
    assert proposal.status == "approved_with_edits"


def test_blocked_proposal_cannot_be_approved() -> None:
    session = _session()
    proposal = _build_missing_bill_proposal(session, unresolved_vendor=True)
    service = _approval_service(session)
    service.submit_for_review(proposal.id, reviewer="reviewer-1")

    with pytest.raises(ValueError):
        service.capture_decision(proposal.id, decision="approved", reviewer="reviewer-1", comment="try approve")

    assert session.scalar(select(func.count()).select_from(ExceptionCase)) >= 1


def test_reviewer_edits_are_logged_and_traceable() -> None:
    session = _session()
    vendor = _seed_vendor(session, "MAPPED VENDOR PRIVATE LIMITED", "Mapped Vendor", gstin="27AAAAA1111A1Z1")
    expense_account = _seed_account(session, "EXP-200", "Office Expense", account_type="expense")
    tax_account = _seed_account(session, "GST-200", "Input CGST", account_type="tax_asset", gst_treatment_hint="gst")
    proposal = _build_missing_bill_proposal(session, unresolved_vendor=True)
    service = _approval_service(session)

    line1 = service.apply_reviewer_line_edit(
        proposal.id,
        line_no=1,
        reviewer="reviewer-1",
        edits={"vendor_master_id": vendor.id},
        comment="confirmed vendor",
    )
    line2 = service.apply_reviewer_line_edit(
        proposal.id,
        line_no=2,
        reviewer="reviewer-1",
        edits={"account_master_id": expense_account.id},
        comment="placeholder account",
    )
    line3 = service.apply_reviewer_line_edit(
        proposal.id,
        line_no=3,
        reviewer="reviewer-1",
        edits={"tax_code": "eligible_itc", "account_master_id": tax_account.id},
        comment="tax coding confirmed",
    )

    assert line1.resolved_by_user is True
    assert line1.review_required is False
    assert line2.resolved_by_user is True
    assert line2.review_required is False
    assert line3.resolved_by_user is True
    assert line3.review_required is False
    assert proposal.has_blocking_lines is False

    audit_events = session.scalars(select(AuditEvent).where(AuditEvent.event_type == "proposal_line_edited")).all()
    assert len(audit_events) == 3
    assert session.scalar(select(func.count()).select_from(ProposalRevision)) >= 3
    assert session.scalar(select(func.count()).select_from(ProposalLineRevision)) == 3


def test_exception_linkage_on_rejection() -> None:
    session = _session()
    proposal = _build_vendor_payment_proposal(session)
    service = _approval_service(session)

    decision = service.capture_decision(proposal.id, decision="rejected", reviewer="reviewer-1", comment="needs more evidence")
    exception = session.scalar(
        select(ExceptionCase).where(
            ExceptionCase.posting_proposal_id == proposal.id,
            ExceptionCase.approval_decision_id == decision.id,
            ExceptionCase.exception_type == "reviewer_rejected_proposal",
        )
    )
    assert exception is not None
    assert exception.classification_result_id == proposal.generated_from_classification_id


def test_invalidation_marks_proposal_non_executable() -> None:
    session = _session()
    proposal = _build_vendor_payment_proposal(session)
    service = _approval_service(session)
    service.capture_decision(proposal.id, decision="approved", reviewer="reviewer-1", comment="approve before invalidate")

    invalidated = service.invalidate_proposal(proposal.id, reviewer="reviewer-1", comment="synthetic target quarantined")

    assert invalidated.status == "invalidated"
    exception = session.scalar(
        select(ExceptionCase).where(
            ExceptionCase.posting_proposal_id == proposal.id,
            ExceptionCase.exception_type == "proposal_invalidated",
        )
    )
    assert exception is not None
    audit = session.scalar(select(AuditEvent).where(AuditEvent.event_type == "proposal_invalidated"))
    assert audit is not None


def test_supersession_chain_and_history_summary() -> None:
    session = _session()
    proposal_one = _build_vendor_payment_proposal(session)
    previous_lines = ProposalLineRepository(session).list_for_proposal(proposal_one.id)

    session.query(RuleVersion).update({"is_active": False})
    rule_two = _seed_rule_version(session, version_code="2026.03.30.1")
    proposal_one_classification = session.get(
        ClassificationResultRepository(session).model,
        proposal_one.generated_from_classification_id,
    )
    assert proposal_one_classification is not None
    replacement_classification = ClassificationResultRepository(session).add(
        ClassificationResultRepository(session).model(
            evidence_bundle_id=proposal_one_classification.evidence_bundle_id,
            rule_version_id=rule_two.id,
            classification_type="vendor_payment",
            status="proposed",
            confidence_score=Decimal("0.99"),
            materiality_amount=Decimal("1200.00"),
            accounting_period_date=proposal_one_classification.accounting_period_date,
            decision_summary=proposal_one_classification.decision_summary,
            explanation_json=proposal_one_classification.explanation_json,
            ai_assist_json={},
            supersedes_classification_id=proposal_one_classification.id,
        )
    )
    replacement_proposal = _proposal_builder(session).build_for_classification(replacement_classification.id).proposal
    assert replacement_proposal is not None
    assert replacement_proposal.supersedes_proposal_id == proposal_one.id
    assert proposal_one.superseded_by_proposal_id == replacement_proposal.id
    assert replacement_proposal.supersession_reason
    assert replacement_proposal.input_fingerprint
    assert replacement_proposal.rule_version_id == rule_two.id

    summary = ProposalHistoryService().summarize_changes(
        proposal_one,
        previous_lines,
        replacement_proposal,
        [
            {
                "action_type": line.action_type,
                "allocation_json": line.allocation_json,
                "zoho_target_object_ref": line.zoho_target_object_ref,
            }
            for line in ProposalLineRepository(session).list_for_proposal(replacement_proposal.id)
        ],
        replacement_classification,
    )
    assert summary["changes"]
