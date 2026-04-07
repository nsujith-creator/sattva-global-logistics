r"""
Create one minimal, preflight-ready proposal for Phase 2C sandbox validation.

Run from project root:
  cd C:\sattva\books_recon
  . .\.venv\Scripts\Activate.ps1
  python -u .\seed_phase2c_proposal.py
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select

sys.path.insert(0, "src")

from apps.cli.main import _build_reviewer_ops
from db.models.banking import BankAccount, BankTransaction
from db.models.evidence import SourceDocument, SourceRecord
from db.models.reference import RuleVersion
from db.models.workflow import PostingProposal
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
from db.session import get_session_factory
from matching.bundles import EvidenceBundleService
from matching.candidate_engine import MatchCandidateEngine
from normalization.identity import BankCounterpartyNormalizationService, VendorIdentityNormalizationService
from proposals.builder import ProposalBuilder
from rules.classification_pipeline import ClassificationPipeline


DEFAULT_TAG = "phase2c-vendor-payment-001"
TXN_DATE = date(2025, 4, 10)
TXN_AMOUNT = Decimal("1200.00")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="seed_phase2c_proposal")
    parser.add_argument("--tag", default=DEFAULT_TAG)
    parser.add_argument("--actor", default="codex")
    return parser


def _classification_pipeline(session) -> ClassificationPipeline:
    normalization_service = VendorIdentityNormalizationService(
        VendorMasterRepository(session),
        VendorAliasRepository(session),
    )
    candidate_engine = MatchCandidateEngine(
        session,
        MatchCandidateRepository(session),
        normalization_service,
        BankCounterpartyNormalizationService(normalization_service),
    )
    return ClassificationPipeline(
        rule_version_repository=RuleVersionRepository(session),
        bundle_service=EvidenceBundleService(
            EvidenceBundleRepository(session),
            EvidenceBundleItemRepository(session),
        ),
        candidate_engine=candidate_engine,
        match_candidate_repository=MatchCandidateRepository(session),
        classification_repository=ClassificationResultRepository(session),
        exception_repository=ExceptionCaseRepository(session),
        audit_repository=AuditEventRepository(session),
    )


def _proposal_builder(session) -> ProposalBuilder:
    return ProposalBuilder(
        session,
        proposal_repository=ProposalRepository(session),
        proposal_line_repository=ProposalLineRepository(session),
        classification_repository=ClassificationResultRepository(session),
        match_candidate_repository=MatchCandidateRepository(session),
        exception_repository=ExceptionCaseRepository(session),
        audit_repository=AuditEventRepository(session),
    )


def _get_or_create_rule_version(session) -> RuleVersion:
    existing = RuleVersionRepository(session).get_active_for_date(TXN_DATE)
    if existing is not None:
        return existing
    rule_version = RuleVersion(
        rulebook_name="core_accounting_rules",
        version_code="2026.03.29.1",
        effective_from=date(2025, 4, 1),
        is_active=True,
        published_by="phase2c",
        change_summary="Phase 2C proposal seed",
        rules_json={
            "matching": {
                "bank_date_window_days": 7,
                "gst_date_tolerance_days": 3,
                "gst_amount_tolerance": 1.0,
            }
        },
    )
    session.add(rule_version)
    session.flush()
    return rule_version


def _get_or_create_source_document(session, *, tag: str) -> SourceDocument:
    digest = hashlib.sha256(f"phase2c:{tag}:source_document".encode("utf-8")).hexdigest()
    existing = session.scalar(select(SourceDocument).where(SourceDocument.document_sha256 == digest))
    if existing is not None:
        return existing
    now = datetime.now(timezone.utc)
    document = SourceDocument(
        source_system="phase2c_seed",
        document_type="fixture",
        original_filename=f"{tag}.json",
        storage_path=f"/phase2c/{tag}.json",
        mime_type="application/json",
        file_size_bytes=1,
        document_sha256=digest,
        ingest_batch_key=tag,
        captured_at=now,
        ingested_at=now,
        metadata_json={"seed_tag": tag},
        created_by="phase2c_seed",
        updated_by="phase2c_seed",
    )
    session.add(document)
    session.flush()
    return document


def _get_or_create_source_record(session, *, document: SourceDocument, tag: str) -> SourceRecord:
    fingerprint = hashlib.sha256(f"phase2c:{tag}:source_record".encode("utf-8")).hexdigest()
    existing = session.scalar(
        select(SourceRecord).where(
            SourceRecord.source_document_id == document.id,
            SourceRecord.record_fingerprint == fingerprint,
            SourceRecord.extraction_version == "phase2c.v1",
        )
    )
    if existing is not None:
        return existing
    record = SourceRecord(
        source_document_id=document.id,
        record_type="bank_txn",
        source_row_number=1,
        record_fingerprint=fingerprint,
        extraction_version="phase2c.v1",
        parse_status="parsed",
        event_date=TXN_DATE,
        amount=TXN_AMOUNT,
        currency_code="INR",
        raw_payload={"seed_tag": tag},
        normalized_payload={"seed_tag": tag},
        quality_score=1,
        review_required=False,
        created_by="phase2c_seed",
        updated_by="phase2c_seed",
    )
    session.add(record)
    session.flush()
    return record


def _get_or_create_bank_account(session, *, tag: str) -> BankAccount:
    account_mask = f"PH2C-{tag[-8:].upper()}"
    existing = session.scalar(select(BankAccount).where(BankAccount.account_mask == account_mask))
    if existing is not None:
        metadata = dict(existing.metadata_json or {})
        if not metadata.get("zoho_paid_through_account_id"):
            metadata["zoho_paid_through_account_id"] = f"zoho-paid-{tag}"
            existing.metadata_json = metadata
        return existing
    account = BankAccount(
        account_name=f"Phase2C Seed {tag}",
        account_mask=account_mask,
        bank_name="Phase2C Test Bank",
        currency_code="INR",
        is_business_account=True,
        metadata_json={"zoho_paid_through_account_id": f"zoho-paid-{tag}"},
        created_by="phase2c_seed",
        updated_by="phase2c_seed",
    )
    session.add(account)
    session.flush()
    return account


def _get_or_create_bank_transaction(
    session,
    *,
    source_record: SourceRecord,
    bank_account: BankAccount,
    tag: str,
) -> BankTransaction:
    existing = session.scalar(select(BankTransaction).where(BankTransaction.source_record_id == source_record.id))
    if existing is not None:
        return existing
    bill_number = f"VP-{tag.upper()}"
    reference_number = f"REF-{tag.upper()}"
    transaction = BankTransaction(
        source_record_id=source_record.id,
        bank_account_id=bank_account.id,
        bank_account_ref=bank_account.account_mask,
        transaction_date=TXN_DATE,
        value_date=TXN_DATE,
        direction="debit",
        amount=TXN_AMOUNT,
        signed_amount=-TXN_AMOUNT,
        currency_code="INR",
        narration=f"Payment {bill_number}",
        counterparty_name="Phase2C Sandbox Vendor",
        counterparty_fingerprint=None,
        bank_reference=reference_number,
        channel="NEFT",
        metadata_json={"seed_tag": tag},
        created_by="phase2c_seed",
        updated_by="phase2c_seed",
    )
    session.add(transaction)
    session.flush()
    return transaction


def _get_or_create_snapshot_bill(session, *, tag: str) -> ZohoSnapshotBill:
    zoho_object_id = f"bill-{tag}"
    existing = session.scalar(select(ZohoSnapshotBill).where(ZohoSnapshotBill.zoho_object_id == zoho_object_id))
    if existing is not None:
        return existing
    bill_number = f"VP-{tag.upper()}"
    reference_number = f"REF-{tag.upper()}"
    bill = ZohoSnapshotBill(
        snapshot_at=datetime.now(timezone.utc),
        snapshot_batch_key=tag,
        zoho_object_id=zoho_object_id,
        payload={"seed_tag": tag},
        vendor_name="Phase2C Sandbox Vendor",
        vendor_id=f"zoho-vendor-{tag}",
        bill_number=bill_number,
        bill_date=date(2025, 4, 8),
        due_date=date(2025, 4, 10),
        currency_code="INR",
        total=TXN_AMOUNT,
        balance=TXN_AMOUNT,
        status="open",
        reference_number=reference_number,
        created_by="phase2c_seed",
        updated_by="phase2c_seed",
    )
    session.add(bill)
    session.flush()
    return bill


def _seed_prerequisites(session, *, tag: str) -> BankTransaction:
    _get_or_create_rule_version(session)
    document = _get_or_create_source_document(session, tag=tag)
    source_record = _get_or_create_source_record(session, document=document, tag=tag)
    bank_account = _get_or_create_bank_account(session, tag=tag)
    _get_or_create_snapshot_bill(session, tag=tag)
    return _get_or_create_bank_transaction(
        session,
        source_record=source_record,
        bank_account=bank_account,
        tag=tag,
    )


def main() -> None:
    args = _build_parser().parse_args()
    session = get_session_factory()()

    try:
        print("=" * 60)
        print("STEP 1: seed minimal vendor-payment evidence")
        transaction = _seed_prerequisites(session, tag=args.tag)
        print(f"  bank_transaction_id   : {transaction.id}")
        print(f"  bank_reference        : {transaction.bank_reference}")
        print(f"  amount                : {transaction.amount}")

        print("=" * 60)
        print("STEP 2: classify")
        pipeline = _classification_pipeline(session)
        pipeline_outcome = pipeline.classify_bank_transaction(transaction)
        if pipeline_outcome.classification_result is None:
            raise RuntimeError(
                f"Classification did not produce a result. exception_case={getattr(pipeline_outcome.exception_case, 'exception_type', None)}"
            )
        classification = pipeline_outcome.classification_result
        print(f"  classification_id     : {classification.id}")
        print(f"  classification_type   : {classification.classification_type}")
        print(f"  confidence_score      : {classification.confidence_score}")

        print("=" * 60)
        print("STEP 3: build proposal")
        outcome = _proposal_builder(session).build_for_classification(classification.id)
        if outcome.proposal is None:
            raise RuntimeError(
                f"ProposalBuilder returned no proposal. exception_case={getattr(outcome.exception_case, 'exception_type', None)}"
            )
        proposal = outcome.proposal
        print(f"  proposal_id           : {proposal.id}")
        print(f"  proposal_type         : {proposal.proposal_type}")
        print(f"  status                : {proposal.status}")
        print(f"  has_blocking_lines    : {proposal.has_blocking_lines}")
        print(f"  unresolved_items      : {proposal.unresolved_review_item_count}")

        print("=" * 60)
        print("STEP 4: approve and preflight")
        ops = _build_reviewer_ops(session)
        proposal = session.get(PostingProposal, proposal.id)
        if proposal is None:
            raise RuntimeError("Seeded proposal disappeared before approval.")
        if proposal.status == "pending_review":
            ops.approve(proposal.id, reviewer=args.actor, comment=f"Phase 2C seed {args.tag}")
        elif proposal.status not in {"approved", "approved_with_edits"}:
            raise RuntimeError(f"Unexpected proposal status before approval: {proposal.status}")

        preflight = ops.run_preflight(proposal.id)
        print(f"  preflight_status      : {preflight.preflight_status}")
        print(f"  eligible_for_posting  : {preflight.eligible_for_posting}")
        if preflight.posting_block_reasons:
            print(f"  block_reasons         : {preflight.posting_block_reasons}")
        if preflight.preflight_status != "ready":
            raise RuntimeError(f"Seeded proposal is not ready: {preflight.posting_block_reasons}")

        session.commit()
        print("=" * 60)
        print("DONE")
        print(f"  proposal_id           : {proposal.id}")
        print(f"  run_execute_command   : python -u .\\run_sandbox_execute.py --proposal-id {proposal.id} --actor codex")
    except Exception:
        session.rollback()
        import traceback

        traceback.print_exc()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
