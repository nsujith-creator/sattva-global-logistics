"""Integration tests for Zoho contract mapping and dry-run execution scaffolding."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

import httpx
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from approvals.service import ProposalApprovalService
from connectors.zoho.sandbox_adapter import ZohoSandboxAdapter, ZohoTransportResponse, ZohoUnknownOutcomeError
from core.config import Settings
from db.base import Base
from db.models.banking import BankAccount, BankTransaction
from db.models.evidence import SourceDocument, SourceRecord
from db.models.reference import AccountMaster, RuleVersion, VendorMaster, ZohoAccountMapping, ZohoTaxMapping
from db.models.tax import GstPurchaseLine
from db.models.workflow import (
    DryRunExecutionArtifact,
    ExternalExecutionAttempt,
    PostingProposal,
    SandboxReconciliationRecord,
    ZohoPostingReceipt,
)
from db.models.zoho import ZohoSnapshotBill
from db.repositories.audit import AuditEventRepository
from db.repositories.proposals import (
    ApprovalDecisionRepository,
    DryRunExecutionArtifactRepository,
    ExternalExecutionAttemptRepository,
    ProposalLineRepository,
    ProposalLineRevisionRepository,
    ProposalRepository,
    ProposalRevisionRepository,
    SandboxReconciliationRecordRepository,
    ZohoPostingReceiptRepository,
)
from db.repositories.reference import (
    AccountMasterRepository,
    PeriodLockRepository,
    RuleVersionRepository,
    VendorAliasRepository,
    VendorMasterRepository,
    ZohoAccountMappingRepository,
    ZohoTaxMappingRepository,
)
from db.repositories.workflow import (
    ClassificationResultRepository,
    EvidenceBundleItemRepository,
    EvidenceBundleRepository,
    ExceptionCaseRepository,
    MatchCandidateRepository,
)
from dry_run_execution.service import DryRunExecutionService
from master_data.service import MasterDataControlService
from matching.bundles import EvidenceBundleService
from matching.candidate_engine import MatchCandidateEngine
from normalization.identity import BankCounterpartyNormalizationService, VendorIdentityNormalizationService
from preflight.service import PostingPreflightService
from proposals.builder import ProposalBuilder
from reconciliation.service import SandboxReconciliationService
from reviewer_ops.service import ReviewerOperationsService
from zoho_contracts.service import ZohoContractMapperService
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
        change_summary="Phase D7 tests",
        rules_json={"matching": {"bank_date_window_days": 7, "gst_date_tolerance_days": 3, "gst_amount_tolerance": 1.0}},
    )
    session.add(rule_version)
    session.flush()
    return rule_version


def _seed_vendor(session: Session, canonical_name: str, display_name: str, *, gstin: str | None = None, fingerprint: str | None = None) -> VendorMaster:
    existing = session.scalar(select(VendorMaster).where(VendorMaster.canonical_name == canonical_name))
    if existing is not None:
        return existing
    vendor = VendorMaster(
        canonical_name=canonical_name,
        display_name=display_name,
        vendor_type="freight_vendor",
        gstin=gstin,
        beneficiary_fingerprints=[fingerprint] if fingerprint else [],
        zoho_contact_id=f"zoho-{display_name.lower().replace(' ', '-')}",
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
        zoho_account_id=f"zoho-account-{account_code.lower()}",
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
        zoho_account_mapping_repository=ZohoAccountMappingRepository(session),
        zoho_tax_mapping_repository=ZohoTaxMappingRepository(session),
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


def _settings(**overrides) -> Settings:
    payload = {
        "database_url": "sqlite+pysqlite:///:memory:",
        "zoho_sandbox_enabled": False,
        "zoho_sandbox_org_id": "sandbox-org-1",
        "zoho_sandbox_api_domain": "https://sandbox.zoho.test",
        "zoho_sandbox_accounts_url": "https://accounts.zoho.test",
        "zoho_sandbox_client_id": "sandbox-client",
        "zoho_sandbox_client_secret": "sandbox-secret",
        "zoho_sandbox_refresh_token": "sandbox-refresh",
        "zoho_sandbox_paid_through_account_id": "sandbox-paid-through",
    }
    payload.update(overrides)
    return Settings.model_construct(**payload)


class _FakeZohoTransport:
    def __init__(
        self,
        *,
        response: ZohoTransportResponse | None = None,
        lookup_response: ZohoTransportResponse | None = None,
        refresh_error: Exception | None = None,
        send_error: Exception | None = None,
        lookup_error: Exception | None = None,
    ) -> None:
        self.response = response or ZohoTransportResponse(status_code=201, payload={}, headers={})
        self.lookup_response = lookup_response or ZohoTransportResponse(status_code=200, payload={}, headers={})
        self.refresh_error = refresh_error
        self.send_error = send_error
        self.lookup_error = lookup_error
        self.calls: list[dict] = []
        self.lookup_calls: list[dict] = []

    def refresh_access_token(self, settings: Settings) -> tuple[str, str]:
        if self.refresh_error is not None:
            raise self.refresh_error
        return "sandbox-access-token", settings.zoho_sandbox_api_domain or "https://sandbox.zoho.test"

    def send_json(self, *, method: str, url: str, headers: dict[str, str], json_body: dict) -> ZohoTransportResponse:
        if self.send_error is not None:
            raise self.send_error
        self.calls.append({"method": method, "url": url, "headers": headers, "json_body": json_body})
        return self.response

    def get_json(self, *, url: str, headers: dict[str, str], params: dict[str, str]) -> ZohoTransportResponse:
        if self.lookup_error is not None:
            raise self.lookup_error
        self.lookup_calls.append({"url": url, "headers": headers, "params": params})
        return self.lookup_response


def _execution_service(
    session: Session,
    *,
    settings: Settings | None = None,
    transport: _FakeZohoTransport | None = None,
) -> DryRunExecutionService:
    sandbox_adapter = None
    if settings is not None:
        sandbox_adapter = ZohoSandboxAdapter(
            settings=settings,
            proposal_repository=ProposalRepository(session),
            proposal_line_repository=ProposalLineRepository(session),
            zoho_account_mapping_repository=ZohoAccountMappingRepository(session),
            zoho_tax_mapping_repository=ZohoTaxMappingRepository(session),
            transport=transport,
        )
    return DryRunExecutionService(
        proposal_repository=ProposalRepository(session),
        execution_artifact_repository=DryRunExecutionArtifactRepository(session),
        execution_attempt_repository=ExternalExecutionAttemptRepository(session),
        approval_decision_repository=ApprovalDecisionRepository(session),
        posting_receipt_repository=ZohoPostingReceiptRepository(session),
        reconciliation_record_repository=SandboxReconciliationRecordRepository(session),
        preflight_service=_preflight_service(session),
        contract_mapper_service=ZohoContractMapperService(),
        sandbox_adapter=sandbox_adapter,
        settings=settings,
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
        dry_run_execution_service=_execution_service(session),
    )


def _build_vendor_payment_proposal(session: Session, *, suffix: str = "d7-vendor") -> PostingProposal:
    _seed_rule_version(session)
    vendor = _seed_vendor(session, "SAFE VENDOR PRIVATE LIMITED", "Safe Vendor", fingerprint="fp-safe")
    document = _seed_document(session, suffix)
    source_record = _seed_record(session, document, suffix, "bank_txn", date(2025, 4, 10), Decimal("1200.00"))
    account_mask = f"XXXX{suffix[-4:].upper()}" if len(suffix) >= 4 else f"XXXX{suffix.upper():0>4}"
    bank_account = BankAccount(account_name="Main", account_mask=account_mask, bank_name="Test Bank", metadata_json={})
    bank_account.metadata_json = {"zoho_paid_through_account_id": "zoho-bank-main"}
    session.add(bank_account)
    session.flush()
    transaction = BankTransaction(
        source_record_id=source_record.id,
        bank_account_id=bank_account.id,
        bank_account_ref=account_mask,
        transaction_date=date(2025, 4, 10),
        direction="debit",
        amount=Decimal("1200.00"),
        signed_amount=Decimal("-1200.00"),
        narration=f"Payment SAFE-001 {suffix}",
        counterparty_name=vendor.display_name,
        counterparty_fingerprint="fp-safe",
        bank_reference=f"SAFE-001-{suffix}",
        metadata_json={},
    )
    session.add(transaction)
    _seed_zoho_bill_snapshot(
        session,
        suffix=f"dryrun-vendor-bill-{suffix}",
        snapshot_batch_key=f"snap-safe-{suffix}",
        vendor_name=vendor.display_name,
        vendor_id="zoho-safe",
        zoho_object_id="bill-safe",
        bill_number="SAFE-001",
        bill_date=date(2025, 4, 8),
        total=Decimal("1200.00"),
        balance=Decimal("1200.00"),
        reference_number=f"SAFE-001-{suffix}",
    )
    classification = _classification_pipeline(session).classify_bank_transaction(transaction).classification_result
    assert classification is not None
    proposal = _proposal_builder(session).build_for_classification(classification.id).proposal
    assert proposal is not None
    return proposal


def _build_missing_bill_proposal(session: Session, *, suffix: str = "d7-missing") -> PostingProposal:
    _seed_rule_version(session)
    document = _seed_document(session, suffix)
    source_record = _seed_record(session, document, suffix, "gst_purchase_line", date(2025, 4, 6), Decimal("1180.00"))
    line = GstPurchaseLine(
        source_record_id=source_record.id,
        supplier_gstin="27BBBBB2222B1Z2",
        supplier_name="Unmapped Supplier",
        invoice_number=f"GST-{suffix}",
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


def _approve_missing_bill(session: Session, proposal: PostingProposal, *, zoho_tax_id: str | None = None) -> PostingProposal:
    vendor = _seed_vendor(session, "READY VENDOR PRIVATE LIMITED", "Ready Vendor", gstin="27AAAAA1111A1Z1")
    expense = _seed_account(session, "EXP-700", "Freight Expense", account_type="expense")
    tax = _seed_account(session, "GST-700", "Input GST", account_type="tax_asset", gst_treatment_hint="itc")
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
    if zoho_tax_id:
        _seed_zoho_bill_mappings(session, expense_account=expense, tax_account=tax, zoho_tax_id=zoho_tax_id)
    return proposal


def _approve_vendor_payment(session: Session, proposal: PostingProposal) -> PostingProposal:
    ops = _reviewer_ops(session)
    ops.approve(proposal.id, reviewer="reviewer-2", comment="approved payment apply")
    return proposal


def _seed_zoho_bill_mappings(
    session: Session,
    *,
    expense_account: AccountMaster,
    tax_account: AccountMaster,
    zoho_tax_id: str = "zoho-tax-1",
) -> None:
    session.add(
        ZohoAccountMapping(
            account_master_id=expense_account.id,
            environment="sandbox",
            target_system="zoho_books",
            target_module="bills",
            zoho_account_id="mapped-expense-account",
            source_type="tests",
            source_ref="fixture",
            provenance_json={},
            is_active=True,
        )
    )
    session.add(
        ZohoAccountMapping(
            account_master_id=tax_account.id,
            environment="sandbox",
            target_system="zoho_books",
            target_module="bills",
            zoho_account_id="mapped-tax-account",
            source_type="tests",
            source_ref="fixture",
            provenance_json={},
            is_active=True,
        )
    )
    session.add(
        ZohoTaxMapping(
            environment="sandbox",
            target_system="zoho_books",
            target_module="bills",
            tax_code="eligible_itc",
            account_master_id=tax_account.id,
            zoho_tax_id=zoho_tax_id,
            source_type="tests",
            source_ref="fixture",
            provenance_json={},
            is_active=True,
        )
    )
    session.flush()


def _reconciliation_service(
    session: Session,
    *,
    transport: _FakeZohoTransport,
    settings: Settings | None = None,
) -> SandboxReconciliationService:
    effective_settings = settings or _settings(zoho_sandbox_enabled=True)
    return SandboxReconciliationService(
        execution_attempt_repository=ExternalExecutionAttemptRepository(session),
        reconciliation_record_repository=SandboxReconciliationRecordRepository(session),
        posting_receipt_repository=ZohoPostingReceiptRepository(session),
        approval_decision_repository=ApprovalDecisionRepository(session),
        sandbox_adapter=ZohoSandboxAdapter(
            settings=effective_settings,
            proposal_repository=ProposalRepository(session),
            proposal_line_repository=ProposalLineRepository(session),
            zoho_account_mapping_repository=ZohoAccountMappingRepository(session),
            zoho_tax_mapping_repository=ZohoTaxMappingRepository(session),
            transport=transport,
        ),
    )


def _get_attempt(session: Session, attempt_id: str) -> ExternalExecutionAttempt:
    attempt = session.get(ExternalExecutionAttempt, UUID(str(attempt_id)))
    assert attempt is not None
    return attempt


def test_eligible_proposal_yields_deterministic_prepared_request_and_simulated_receipt() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session))
    service = _execution_service(session)

    first = service.execute(proposal.id, actor="tester")
    second = service.execute(proposal.id, actor="tester")

    assert first.execution_status == "simulated"
    assert first.prepared_request == second.prepared_request
    assert first.simulated_receipt["execution_status"] == "simulated"
    assert first.request_hash == second.request_hash
    assert first.idempotency_key == second.idempotency_key


def test_blocked_or_stale_proposal_is_refused() -> None:
    session = _session()
    proposal = _build_missing_bill_proposal(session)
    result = _execution_service(session).execute(proposal.id, actor="tester")

    assert result.execution_status == "refused"
    assert "proposal not approved" in result.block_reasons

    approved = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d7-missing-stale"))
    approved.policy_flags = {**approved.policy_flags, "mutated": "yes"}
    stale = _execution_service(session).execute(approved.id, actor="tester")
    assert stale.execution_status == "refused"
    assert stale.preflight_status == "stale"


def test_vendor_payment_apply_contract_mapping_structure() -> None:
    session = _session()
    proposal = _approve_vendor_payment(session, _build_vendor_payment_proposal(session))
    payload = _preflight_service(session).build_dry_run_payload(proposal.id)
    mapped = ZohoContractMapperService().map_dry_run_payload(payload)

    assert mapped.target_module == "vendorpayments"
    assert mapped.contract_payload["allocations"][0]["bill_number"] == "SAFE-001"
    assert mapped.validation_result.is_valid is True


def test_vendor_bill_create_contract_mapping_structure() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session))
    payload = _preflight_service(session).build_dry_run_payload(proposal.id)
    mapped = ZohoContractMapperService().map_dry_run_payload(payload)

    assert mapped.target_module == "bills"
    assert mapped.contract_payload["bill_header"]["gross_amount"] == "1180.00"
    assert mapped.validation_result.is_valid is True


def test_append_only_behavior_for_revisions_and_execution_artifacts() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session))
    ops = _reviewer_ops(session)
    first = ops.run_dry_run_executor(proposal.id, actor="tester")
    second = ops.run_dry_run_executor(proposal.id, actor="tester")

    artifacts = session.scalars(select(DryRunExecutionArtifact).where(DryRunExecutionArtifact.posting_proposal_id == proposal.id)).all()
    assert len(artifacts) == 2
    assert first.artifact_id != second.artifact_id

    with pytest.raises(NotImplementedError):
        ProposalRevisionRepository(session).upsert_via_merge(None)  # type: ignore[arg-type]
    with pytest.raises(NotImplementedError):
        ProposalLineRevisionRepository(session).upsert_via_merge(None)  # type: ignore[arg-type]
    with pytest.raises(NotImplementedError):
        DryRunExecutionArtifactRepository(session).upsert_via_merge(None)  # type: ignore[arg-type]


def test_sandbox_execution_success_path_persists_normalized_receipt() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d8-success"), zoho_tax_id="zoho-tax-1")
    transport = _FakeZohoTransport(
        response=ZohoTransportResponse(status_code=201, payload={
            "code": 0,
            "message": "Bill created.",
            "bill": {"bill_id": "sandbox-bill-1"},
        }, headers={"x-request-id": "req-bill-1"}),
    )
    service = _execution_service(session, settings=_settings(zoho_sandbox_enabled=True), transport=transport)

    result = service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    assert result.execution_mode == "sandbox_execute"
    assert result.execution_status == "sandbox_success"
    assert result.normalized_response["status"] == "success"
    assert result.normalized_response["external_id"] == "sandbox-bill-1"
    assert result.retryable_flag is False
    assert len(transport.calls) == 1
    assert transport.calls[0]["json_body"]["line_items"][0]["account_id"] == "mapped-expense-account"
    assert transport.calls[0]["json_body"]["line_items"][1]["account_id"] == "mapped-tax-account"
    assert transport.calls[0]["json_body"]["line_items"][1]["tax_id"] == "zoho-tax-1"
    receipt = session.scalar(select(ZohoPostingReceipt).where(ZohoPostingReceipt.posting_proposal_id == proposal.id))
    assert receipt is not None
    assert receipt.target_external_id == "sandbox-bill-1"
    assert receipt.environment == "sandbox"


def test_vendor_payment_sandbox_success_path_builds_supported_request() -> None:
    session = _session()
    proposal = _approve_vendor_payment(session, _build_vendor_payment_proposal(session))
    transport = _FakeZohoTransport(
        response=ZohoTransportResponse(
            status_code=201,
            payload={"code": 0, "message": "Payment recorded.", "payment_id": "sandbox-payment-1"},
            headers={"x-request-id": "req-pay-1"},
        ),
    )
    service = _execution_service(session, settings=_settings(zoho_sandbox_enabled=True), transport=transport)

    result = service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    assert result.execution_status == "sandbox_success"
    assert result.normalized_response["external_id"] == "sandbox-payment-1"
    assert transport.calls[0]["json_body"]["bills"][0]["bill_id"] == "bill-safe"
    assert transport.calls[0]["json_body"]["paid_through_account_id"] == "zoho-bank-main"


def test_sandbox_failure_path_is_normalized_without_raw_passthrough() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d8-failure"), zoho_tax_id="zoho-tax-1")
    transport = _FakeZohoTransport(
        response=ZohoTransportResponse(
            status_code=400,
            payload={"code": 1001, "message": "Invalid value passed for account_id"},
            headers={},
        ),
    )
    service = _execution_service(session, settings=_settings(zoho_sandbox_enabled=True), transport=transport)

    result = service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    assert result.execution_status == "sandbox_failure"
    assert result.normalized_response["status"] == "failure"
    assert result.normalized_response["retryable_flag"] is False
    assert result.normalized_response["normalized_errors"][0]["category"] == "validation_error"
    assert result.external_response["body"]["message"] == "Invalid value passed for account_id"


def test_retryable_vs_non_retryable_classification() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d8-retryable"), zoho_tax_id="zoho-tax-1")

    retryable_service = _execution_service(
        session,
        settings=_settings(zoho_sandbox_enabled=True),
        transport=_FakeZohoTransport(send_error=httpx.ConnectError("network down")),
    )
    retryable = retryable_service.execute(proposal.id, actor="tester", mode="sandbox_execute")
    assert retryable.execution_status == "sandbox_retryable_failure"
    assert retryable.retryable_flag is True

    non_retryable_service = _execution_service(
        session,
        settings=_settings(zoho_sandbox_enabled=True),
        transport=_FakeZohoTransport(
            response=ZohoTransportResponse(status_code=400, payload={"code": 422, "message": "Bad payload"}, headers={})
        ),
    )
    non_retryable = non_retryable_service.execute(proposal.id, actor="tester", mode="sandbox_execute")
    assert non_retryable.execution_status == "sandbox_failure"
    assert non_retryable.retryable_flag is False


def test_feature_flag_enforcement_blocks_external_call() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d8-flag"), zoho_tax_id="zoho-tax-1")
    transport = _FakeZohoTransport(
        response=ZohoTransportResponse(status_code=201, payload={"code": 0, "bill": {"bill_id": "ignored"}}, headers={})
    )
    service = _execution_service(session, settings=_settings(zoho_sandbox_enabled=False), transport=transport)

    result = service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    assert result.execution_status == "sandbox_failure"
    assert "feature flag" in result.normalized_response["normalized_errors"][0]["category"] or result.block_reasons
    assert transport.calls == []


def test_idempotency_protection_prevents_double_posting() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d8-idempotency"), zoho_tax_id="zoho-tax-1")
    transport = _FakeZohoTransport(
        response=ZohoTransportResponse(
            status_code=201,
            payload={"code": 0, "message": "Bill created.", "bill": {"bill_id": "sandbox-bill-2"}},
            headers={},
        ),
    )
    service = _execution_service(session, settings=_settings(zoho_sandbox_enabled=True), transport=transport)

    first = service.execute(proposal.id, actor="tester", mode="sandbox_execute")
    second = service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    assert first.execution_status == "sandbox_success"
    assert second.execution_status == "sandbox_failure"
    assert "already succeeded" in second.block_reasons[0]
    assert len(transport.calls) == 1


def test_dry_run_and_sandbox_modes_remain_separate() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d8-separation"), zoho_tax_id="zoho-tax-1")
    transport = _FakeZohoTransport(
        response=ZohoTransportResponse(
            status_code=201,
            payload={"code": 0, "message": "Bill created.", "bill": {"bill_id": "sandbox-bill-3"}},
            headers={},
        ),
    )
    service = _execution_service(session, settings=_settings(zoho_sandbox_enabled=True), transport=transport)

    dry = service.execute(proposal.id, actor="tester", mode="dry_run")
    live = service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    assert dry.execution_status == "simulated"
    assert dry.execution_mode == "dry_run"
    assert live.execution_status == "sandbox_success"
    artifacts = session.scalars(
        select(DryRunExecutionArtifact)
        .where(DryRunExecutionArtifact.posting_proposal_id == proposal.id)
        .order_by(DryRunExecutionArtifact.created_at.asc(), DryRunExecutionArtifact.id.asc())
    ).all()
    assert [artifact.execution_mode for artifact in artifacts[-2:]] == ["dry_run", "sandbox_execute"]


def test_sandbox_receipt_semantics_do_not_blur_with_production() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d85-receipt"), zoho_tax_id="zoho-tax-1")
    transport = _FakeZohoTransport(
        response=ZohoTransportResponse(
            status_code=201,
            payload={"code": 0, "message": "Bill created.", "bill": {"bill_id": "sandbox-bill-4"}},
            headers={},
        ),
    )
    service = _execution_service(session, settings=_settings(zoho_sandbox_enabled=True), transport=transport)

    service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    receipt = session.scalar(select(ZohoPostingReceipt).where(ZohoPostingReceipt.posting_proposal_id == proposal.id))
    assert receipt is not None
    assert receipt.environment == "sandbox"
    assert receipt.posting_mode == "sandbox_execute"
    assert receipt.posting_status == "sandbox_success"


def test_append_only_attempt_ledger_behavior() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d85-attempts"), zoho_tax_id="zoho-tax-1")
    service = _execution_service(
        session,
        settings=_settings(zoho_sandbox_enabled=True),
        transport=_FakeZohoTransport(
            response=ZohoTransportResponse(
                status_code=400,
                payload={"code": 1002, "message": "Validation failed"},
                headers={"x-request-id": "attempt-1"},
            )
        ),
    )

    first = service.execute(proposal.id, actor="tester", mode="sandbox_execute")
    second = service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    attempts = session.scalars(
        select(ExternalExecutionAttempt)
        .where(ExternalExecutionAttempt.posting_proposal_id == proposal.id)
        .order_by(ExternalExecutionAttempt.attempt_number.asc())
    ).all()
    assert len(attempts) == 2
    assert first.attempt_id != second.attempt_id
    assert [attempt.attempt_number for attempt in attempts] == [1, 2]


def test_unknown_outcome_blocks_reexecution_and_captures_reconciliation_metadata() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d85-unknown"), zoho_tax_id="zoho-tax-1")
    transport = _FakeZohoTransport(
        send_error=ZohoUnknownOutcomeError(
            "Sandbox request may have been dispatched but outcome is unknown.",
            raw_response={"partial": "timeout"},
            external_correlation_ids={"x-request-id": "unknown-1"},
        )
    )
    service = _execution_service(session, settings=_settings(zoho_sandbox_enabled=True), transport=transport)

    first = service.execute(proposal.id, actor="tester", mode="sandbox_execute")
    second = service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    assert first.execution_status == "sandbox_unknown_outcome"
    assert first.normalized_response["status"] == "unknown_outcome"
    assert second.execution_status == "sandbox_failure"
    assert "pending reconciliation" in second.block_reasons[0]
    attempt = session.scalar(
        select(ExternalExecutionAttempt)
        .where(ExternalExecutionAttempt.posting_proposal_id == proposal.id)
        .order_by(ExternalExecutionAttempt.attempt_number.asc())
    )
    assert attempt is not None
    assert attempt.external_correlation_ids_json["x-request-id"] == "unknown-1"
    assert attempt.reconciliation_preconditions_json["requires_reconciliation"] is True
    assert attempt.external_lookup_keys_json["reference_number"] == first.idempotency_key
    assert attempt.target_module == "bills"


def test_tax_account_mapping_guardrails_block_unsafe_bill_execution() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d85-tax-guard"))
    service = _execution_service(
        session,
        settings=_settings(zoho_sandbox_enabled=True),
        transport=_FakeZohoTransport(
            response=ZohoTransportResponse(status_code=201, payload={"code": 0, "bill": {"bill_id": "unused"}}, headers={})
        ),
    )

    result = service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    assert result.execution_status == "sandbox_failure"
    assert "mapping" in result.block_reasons[0].lower()


def test_unknown_outcome_reconciliation_success_creates_receipt_and_releases_block_to_success_state() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d9-reconcile-success"), zoho_tax_id="zoho-tax-1")
    transport = _FakeZohoTransport(
        send_error=ZohoUnknownOutcomeError(
            "Timeout after dispatch.",
            external_correlation_ids={"x-request-id": "lookup-success-1"},
        ),
        lookup_response=ZohoTransportResponse(
            status_code=200,
            payload={"bills": [{"bill_id": "reconciled-bill-1", "bill_number": "GST-d9-reconcile-success", "reference_number": None}]},
            headers={"x-request-id": "lookup-result-1"},
        ),
    )
    service = _execution_service(session, settings=_settings(zoho_sandbox_enabled=True), transport=transport)
    first = service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    attempt = _get_attempt(session, first.attempt_id)
    attempt.external_lookup_keys_json["reference_number"] = first.idempotency_key
    attempt.external_lookup_keys_json["bill_number"] = "GST-d9-reconcile-success"

    reconciliation = _reconciliation_service(session, transport=transport)
    result = reconciliation.reconcile_attempt(attempt.id, actor="reconciler")

    assert result.reconciliation_status == "reconciled_success"
    record = session.get(SandboxReconciliationRecord, UUID(result.reconciliation_record_id))
    assert record is not None
    assert record.lookup_context_json["external_lookup_keys"]["reference_number"] == first.idempotency_key
    receipt = session.get(ZohoPostingReceipt, UUID(result.receipt_id))
    assert receipt is not None
    assert receipt.target_external_id == "reconciled-bill-1"

    rerun = service.execute(proposal.id, actor="tester", mode="sandbox_execute")
    assert rerun.execution_status == "sandbox_failure"
    assert "already succeeded" in rerun.block_reasons[0] or "reconciled as success" in rerun.block_reasons[0]


def test_unknown_outcome_reconciliation_failure_releases_block_without_autoresume() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d9-reconcile-failure"), zoho_tax_id="zoho-tax-1")
    transport = _FakeZohoTransport(
        send_error=ZohoUnknownOutcomeError("Timeout after dispatch.", external_correlation_ids={"request_id": "unknown-fail-1"}),
        lookup_response=ZohoTransportResponse(status_code=200, payload={"bills": []}, headers={}),
    )
    service = _execution_service(session, settings=_settings(zoho_sandbox_enabled=True), transport=transport)
    first = service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    attempt = _get_attempt(session, first.attempt_id)
    attempt.external_lookup_keys_json["reference_number"] = first.idempotency_key
    attempt.external_lookup_keys_json["bill_number"] = "GST-d9-reconcile-failure"

    reconciliation = _reconciliation_service(session, transport=transport)
    result = reconciliation.reconcile_attempt(attempt.id, actor="reconciler")
    assert result.reconciliation_status == "reconciled_failure"

    retry_transport = _FakeZohoTransport(
        response=ZohoTransportResponse(
            status_code=201,
            payload={"code": 0, "message": "Bill created.", "bill": {"bill_id": "bill-after-reconcile-failure"}},
            headers={},
        )
    )
    retry_service = _execution_service(session, settings=_settings(zoho_sandbox_enabled=True), transport=retry_transport)
    rerun = retry_service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    assert rerun.execution_status == "sandbox_success"
    assert len(retry_transport.calls) == 1


def test_unknown_outcome_still_unknown_remains_blocked() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d9-still-unknown"), zoho_tax_id="zoho-tax-1")
    transport = _FakeZohoTransport(
        send_error=ZohoUnknownOutcomeError("Timeout after dispatch.", external_correlation_ids={"request_id": "unknown-still-1"}),
        lookup_response=ZohoTransportResponse(status_code=200, payload={"bills": [{}, {}]}, headers={}),
    )
    service = _execution_service(session, settings=_settings(zoho_sandbox_enabled=True), transport=transport)
    first = service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    attempt = _get_attempt(session, first.attempt_id)
    attempt.external_lookup_keys_json["reference_number"] = first.idempotency_key
    attempt.external_lookup_keys_json["bill_number"] = "GST-d9-still-unknown"

    reconciliation = _reconciliation_service(session, transport=transport)
    result = reconciliation.reconcile_attempt(attempt.id, actor="reconciler")
    assert result.reconciliation_status == "still_unknown"

    rerun = service.execute(proposal.id, actor="tester", mode="sandbox_execute")
    assert rerun.execution_status == "sandbox_failure"
    assert "pending reconciliation" in rerun.block_reasons[0]


def test_reconciliation_inspection_lists_unresolved_unknown_attempts() -> None:
    session = _session()
    proposal = _approve_missing_bill(session, _build_missing_bill_proposal(session, suffix="d9-inspect-unknown"), zoho_tax_id="zoho-tax-1")
    transport = _FakeZohoTransport(send_error=ZohoUnknownOutcomeError("Timeout after dispatch.", external_correlation_ids={"request_id": "inspect-1"}))
    service = _execution_service(session, settings=_settings(zoho_sandbox_enabled=True), transport=transport)
    first = service.execute(proposal.id, actor="tester", mode="sandbox_execute")

    attempt = _get_attempt(session, first.attempt_id)
    attempt.external_lookup_keys_json["reference_number"] = first.idempotency_key

    items = _reconciliation_service(session, transport=transport).inspect_unresolved_unknown_outcomes()
    assert len(items) == 1
    assert items[0].attempt_id == str(attempt.id)
    assert items[0].lookup_keys["reference_number"] == first.idempotency_key


def test_registry_backed_mapping_validation_helpers_resolve_registered_entries() -> None:
    session = _session()
    expense = _seed_account(session, "EXP-900", "Expense", account_type="expense")
    tax = _seed_account(session, "GST-900", "GST", account_type="tax_asset", gst_treatment_hint="itc")
    service = _master_data_service(session)

    account_mapping = service.upsert_zoho_account_mapping(
        account_reference=str(expense.id),
        zoho_account_id="mapped-exp-900",
        target_module="bills",
        created_by="tester",
    )
    tax_mapping = service.upsert_zoho_tax_mapping(
        tax_code="eligible_itc",
        zoho_tax_id="mapped-tax-900",
        target_module="bills",
        account_reference=str(tax.id),
        created_by="tester",
    )

    assert service.require_zoho_account_mapping(account_master_id=str(expense.id), target_module="bills").id == account_mapping.id
    assert service.require_zoho_tax_mapping(
        tax_code="eligible_itc",
        target_module="bills",
        account_master_id=str(tax.id),
    ).id == tax_mapping.id


def test_mocked_transport_timeout_and_success_paths_capture_attempt_metadata() -> None:
    session = _session()
    proposal = _approve_vendor_payment(session, _build_vendor_payment_proposal(session))
    timeout_service = _execution_service(
        session,
        settings=_settings(zoho_sandbox_enabled=True),
        transport=_FakeZohoTransport(send_error=ZohoUnknownOutcomeError("Timeout after dispatch.", external_correlation_ids={"request_id": "timeout-1"})),
    )
    timeout_result = timeout_service.execute(proposal.id, actor="tester", mode="sandbox_execute")
    assert timeout_result.execution_status == "sandbox_unknown_outcome"

    success_proposal = _approve_vendor_payment(session, _build_vendor_payment_proposal(session, suffix="d85-vendor-success"))
    success_service = _execution_service(
        session,
        settings=_settings(zoho_sandbox_enabled=True),
        transport=_FakeZohoTransport(
            response=ZohoTransportResponse(
                status_code=201,
                payload={"code": 0, "payment_id": "payment-verified"},
                headers={"x-request-id": "success-1"},
            )
        ),
    )
    success_result = success_service.execute(success_proposal.id, actor="tester", mode="sandbox_execute")
    assert success_result.execution_status == "sandbox_success"
    attempt = session.scalar(
        select(ExternalExecutionAttempt)
        .where(ExternalExecutionAttempt.posting_proposal_id == success_proposal.id)
        .order_by(ExternalExecutionAttempt.attempt_number.desc())
    )
    assert attempt is not None
    assert attempt.external_correlation_ids_json["x-request-id"] == "success-1"
    assert attempt.prepared_request_artifact_id is not None
