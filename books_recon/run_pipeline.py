"""
books_recon one-record end-to-end pipeline runner.

Execution order:
  1. seed      → create minimum reference data (idempotent via fingerprint/sha256)
  2. propose   → ProposalBuilder.build_for_classification()
  3. approve   → ProposalApprovalService.capture_decision()
  4. preflight → PostingPreflightService.evaluate_proposal()
  5. dry_run   → DryRunExecutionService.execute(mode="dry_run")

Run from project root:
  cd C:\\sattva\\books_recon
  python -u run_pipeline.py
"""

import sys
sys.path.insert(0, "src")

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select

from core.config import get_settings
from db.session import get_session_factory

# ── models ──────────────────────────────────────────────────────────────────────
from db.models.banking import BankAccount, BankTransaction
from db.models.evidence import EvidenceBundle, EvidenceBundleItem, SourceDocument, SourceRecord
from db.models.reference import RuleVersion
from db.models.workflow import ClassificationResult, MatchCandidate
from db.models.zoho import ZohoSnapshotBill

# ── repositories ────────────────────────────────────────────────────────────────
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
)
from db.repositories.workflow import (
    ClassificationResultRepository,
    ExceptionCaseRepository,
    MatchCandidateRepository,
)

# ── services ────────────────────────────────────────────────────────────────────
from approvals.service import ProposalApprovalService
from dry_run_execution.service import DryRunExecutionService
from master_data.service import MasterDataControlService
from preflight.service import PostingPreflightService
from proposals.builder import ProposalBuilder
from zoho_contracts.service import ZohoContractMapperService

# ── seed constants ───────────────────────────────────────────────────────────────
# Change SEED_TAG to force a fresh seed run (old data will be ignored, not deleted)
SEED_TAG = "seed_pipeline_v1"
TXN_DATE = date(2024, 3, 15)
TXN_AMOUNT = Decimal("50000.00")
BILL_ZOHO_ID = "zoho-bill-seed-001"
BILL_NUMBER = "BILL-SEED-2024-001"


# ── seed helpers ─────────────────────────────────────────────────────────────────

def seed_data(session):
    """
    Create minimum data for one-record dry-run.
    Idempotent: checks for existing records before inserting.
    Returns the ClassificationResult to run through the pipeline.
    """
    print("[seed] creating reference data...")

    # 1. RuleVersion — required by ClassificationResult and ProposalBuilder
    rv_repo = RuleVersionRepository(session)
    rule_version = rv_repo.get_active_for_date(TXN_DATE)
    if rule_version is None:
        rule_version = RuleVersion(
            rulebook_name="books_recon_standard",
            version_code="v1.0.0",
            effective_from=date(2023, 4, 1),
            effective_to=None,
            is_active=True,
            published_by="system",
            change_summary="Initial seed rule version for pipeline test",
            rules_json={},
        )
        session.add(rule_version)
        session.flush()
        print(f"  + RuleVersion          : {rule_version.id} (v1.0.0)")
    else:
        print(f"  = RuleVersion          : {rule_version.id} ({rule_version.version_code})")

    # 2. SourceDocument — required by SourceRecord
    sha256 = ("deadbeef" + SEED_TAG.replace("_", "") + "0" * 64)[:64]
    source_doc = session.scalar(
        select(SourceDocument).where(SourceDocument.document_sha256 == sha256)
    )
    if source_doc is None:
        now = datetime.now(timezone.utc)
        source_doc = SourceDocument(
            source_system="bank_csv",
            document_type="bank_statement",
            original_filename=f"{SEED_TAG}_bank.csv",
            storage_path=f"./data/raw/de/{sha256}.csv",
            mime_type="text/csv",
            file_size_bytes=1024,
            document_sha256=sha256,
            ingest_batch_key=SEED_TAG,
            captured_at=now,
            ingested_at=now,
            source_account_ref=f"ACCT-{SEED_TAG}",
            metadata_json={"seed": True},
        )
        session.add(source_doc)
        session.flush()
        print(f"  + SourceDocument       : {source_doc.id}")
    else:
        print(f"  = SourceDocument       : {source_doc.id}")

    # 3. BankAccount — required by BankTransaction
    bank_account = session.scalar(
        select(BankAccount).where(BankAccount.account_mask == f"SEED-{SEED_TAG}")
    )
    if bank_account is None:
        bank_account = BankAccount(
            account_name="Seed Test Bank Account",
            account_mask=f"SEED-{SEED_TAG}",
            bank_name="TEST BANK",
            currency_code="INR",
            is_business_account=True,
            metadata_json={},
        )
        session.add(bank_account)
        session.flush()
        print(f"  + BankAccount          : {bank_account.id}")
    else:
        print(f"  = BankAccount          : {bank_account.id}")

    # 4. SourceRecord — required by BankTransaction.source_record_id (unique FK)
    rec_fingerprint = f"fp-{SEED_TAG}-txn-001"
    source_record = session.scalar(
        select(SourceRecord).where(
            SourceRecord.source_document_id == source_doc.id,
            SourceRecord.record_fingerprint == rec_fingerprint,
        )
    )
    if source_record is None:
        source_record = SourceRecord(
            source_document_id=source_doc.id,
            record_type="bank_txn",
            source_row_number=1,
            record_fingerprint=rec_fingerprint,
            extraction_version="bank_csv_v1",
            parse_status="parsed",
            event_date=TXN_DATE,
            amount=TXN_AMOUNT,
            currency_code="INR",
            raw_payload={"narration": f"seed-txn-{SEED_TAG}", "amount": str(TXN_AMOUNT)},
            normalized_payload={
                "bank_account_ref": f"SEED-{SEED_TAG}",
                "transaction_date": TXN_DATE.isoformat(),
                "direction": "debit",
                "amount": str(TXN_AMOUNT),
                "signed_amount": str(-TXN_AMOUNT),
            },
            quality_score=1,
            review_required=False,
        )
        session.add(source_record)
        session.flush()
        print(f"  + SourceRecord         : {source_record.id}")
    else:
        print(f"  = SourceRecord         : {source_record.id}")

    # 5. BankTransaction — the primary evidence unit
    bank_txn = session.scalar(
        select(BankTransaction).where(BankTransaction.source_record_id == source_record.id)
    )
    if bank_txn is None:
        bank_txn = BankTransaction(
            source_record_id=source_record.id,
            bank_account_id=bank_account.id,
            bank_account_ref=bank_account.account_mask,
            transaction_date=TXN_DATE,
            value_date=TXN_DATE,
            direction="debit",
            amount=TXN_AMOUNT,
            signed_amount=-TXN_AMOUNT,
            currency_code="INR",
            narration=f"seed-txn-{SEED_TAG}",
            counterparty_name="Test Vendor Ltd",
            counterparty_fingerprint=f"fp-vendor-{SEED_TAG}",
            bank_reference=f"REF-{SEED_TAG}",
            channel="NEFT",
            metadata_json={},
        )
        session.add(bank_txn)
        session.flush()
        print(f"  + BankTransaction      : {bank_txn.id}  amount={TXN_AMOUNT}")
    else:
        print(f"  = BankTransaction      : {bank_txn.id}  amount={bank_txn.amount}")

    # 6. ZohoSnapshotBill — bill.balance == transaction.amount → zero residual in proposal
    bill = session.scalar(
        select(ZohoSnapshotBill).where(
            ZohoSnapshotBill.snapshot_batch_key == SEED_TAG,
            ZohoSnapshotBill.zoho_object_id == BILL_ZOHO_ID,
        )
    )
    if bill is None:
        bill = ZohoSnapshotBill(
            snapshot_at=datetime.now(timezone.utc),
            snapshot_batch_key=SEED_TAG,
            zoho_object_id=BILL_ZOHO_ID,
            is_deleted_in_zoho=False,
            vendor_name="Test Vendor Ltd",
            vendor_id="zoho-vendor-seed-001",
            bill_number=BILL_NUMBER,
            bill_date=TXN_DATE,
            due_date=TXN_DATE,
            currency_code="INR",
            total=float(TXN_AMOUNT),
            balance=float(TXN_AMOUNT),  # equals transaction amount → zero residual
            status="open",
            reference_number=f"REF-BILL-{SEED_TAG}",
            payload={
                "bill_number": BILL_NUMBER,
                "vendor_id": "zoho-vendor-seed-001",
                "balance": str(TXN_AMOUNT),
            },
        )
        session.add(bill)
        session.flush()
        print(f"  + ZohoSnapshotBill     : {bill.id}  balance={TXN_AMOUNT}")
    else:
        print(f"  = ZohoSnapshotBill     : {bill.id}  balance={bill.balance}")

    # 7. EvidenceBundle — groups the bank transaction evidence
    bundle_fp = f"fp-bundle-{SEED_TAG}"
    bundle = session.scalar(
        select(EvidenceBundle).where(EvidenceBundle.bundle_fingerprint == bundle_fp)
    )
    if bundle is None:
        bundle = EvidenceBundle(
            bundle_type="bank_transaction_case",
            bundle_fingerprint=bundle_fp,
            primary_record_type="bank_transaction",
            primary_record_id=str(bank_txn.id),
            evidence_summary=f"Seeded bundle for pipeline test {SEED_TAG}",
            confidence_score=0.95,
            status="open",
            metadata_json={},
        )
        session.add(bundle)
        session.flush()
        print(f"  + EvidenceBundle       : {bundle.id}")
    else:
        print(f"  = EvidenceBundle       : {bundle.id}")

    # 8. EvidenceBundleItem — attaches bank transaction as primary member
    bundle_item = session.scalar(
        select(EvidenceBundleItem).where(
            EvidenceBundleItem.evidence_bundle_id == bundle.id,
            EvidenceBundleItem.item_object_type == "bank_transaction",
            EvidenceBundleItem.item_object_id == str(bank_txn.id),
            EvidenceBundleItem.item_role == "primary",
        )
    )
    if bundle_item is None:
        bundle_item = EvidenceBundleItem(
            evidence_bundle_id=bundle.id,
            item_object_type="bank_transaction",
            item_object_id=str(bank_txn.id),
            item_role="primary",
            ordinal=1,
            notes=None,
        )
        session.add(bundle_item)
        session.flush()
        print(f"  + EvidenceBundleItem   : {bundle_item.id}")
    else:
        print(f"  = EvidenceBundleItem   : {bundle_item.id}")

    # 9. MatchCandidate — links bank_transaction to zoho_snapshot_bill, decision accepted
    match_candidate = session.scalar(
        select(MatchCandidate).where(
            MatchCandidate.evidence_bundle_id == bundle.id,
            MatchCandidate.from_object_type == "bank_transaction",
            MatchCandidate.from_object_id == str(bank_txn.id),
            MatchCandidate.to_object_type == "zoho_snapshot_bill",
            MatchCandidate.to_object_id == str(bill.id),
            MatchCandidate.rule_name == "seed_exact_amount_match",
        )
    )
    if match_candidate is None:
        match_candidate = MatchCandidate(
            evidence_bundle_id=bundle.id,
            from_object_type="bank_transaction",
            from_object_id=str(bank_txn.id),
            to_object_type="zoho_snapshot_bill",
            to_object_id=str(bill.id),
            match_layer="amount",
            rule_name="seed_exact_amount_match",
            score=Decimal("0.9500"),
            score_components={"amount_match": 1.0},
            conflict_group_id=None,
            decision_status="accepted",
            explanation=f"Seeded accepted match: bank_txn→bill for {SEED_TAG}",
            evidence_refs={},
        )
        session.add(match_candidate)
        session.flush()
        print(f"  + MatchCandidate       : {match_candidate.id}  decision=accepted")
    else:
        print(f"  = MatchCandidate       : {match_candidate.id}  decision={match_candidate.decision_status}")

    # 10. ClassificationResult — vendor_payment with high confidence
    cr_repo = ClassificationResultRepository(session)
    decision_summary = f"Vendor payment seeded for {SEED_TAG}"
    classification = cr_repo.find_existing(
        evidence_bundle_id=str(bundle.id),
        rule_version_id=str(rule_version.id),
        classification_type="vendor_payment",
        accounting_period_date=TXN_DATE,
        decision_summary=decision_summary,
        supersedes_classification_id=None,
    )
    if classification is None:
        classification = ClassificationResult(
            evidence_bundle_id=bundle.id,
            rule_version_id=rule_version.id,
            classification_type="vendor_payment",
            status="proposed",
            confidence_score=Decimal("0.9500"),
            materiality_amount=float(TXN_AMOUNT),
            accounting_period_date=TXN_DATE,
            decision_summary=decision_summary,
            explanation_json={"seed": SEED_TAG, "rule": "seed_exact_amount_match"},
            ai_assist_json={},
            supersedes_classification_id=None,
        )
        session.add(classification)
        session.flush()
        print(f"  + ClassificationResult : {classification.id}  type=vendor_payment  confidence=0.95")
    else:
        print(f"  = ClassificationResult : {classification.id}  type=vendor_payment")

    session.flush()
    return classification


def build_services(session):
    """Wire all repositories and instantiate service objects."""
    proposal_repo              = ProposalRepository(session)
    proposal_line_repo         = ProposalLineRepository(session)
    proposal_revision_repo     = ProposalRevisionRepository(session)
    proposal_line_revision_repo = ProposalLineRevisionRepository(session)
    approval_decision_repo     = ApprovalDecisionRepository(session)
    dry_run_artifact_repo      = DryRunExecutionArtifactRepository(session)
    execution_attempt_repo     = ExternalExecutionAttemptRepository(session)
    posting_receipt_repo       = ZohoPostingReceiptRepository(session)
    reconciliation_repo        = SandboxReconciliationRecordRepository(session)
    exception_repo             = ExceptionCaseRepository(session)
    classification_repo        = ClassificationResultRepository(session)
    match_candidate_repo       = MatchCandidateRepository(session)
    vendor_repo                = VendorMasterRepository(session)
    vendor_alias_repo          = VendorAliasRepository(session)
    account_repo               = AccountMasterRepository(session)
    period_lock_repo           = PeriodLockRepository(session)
    audit_repo                 = AuditEventRepository(session)

    master_data_svc = MasterDataControlService(
        vendor_repository=vendor_repo,
        vendor_alias_repository=vendor_alias_repo,
        account_repository=account_repo,
    )

    preflight_svc = PostingPreflightService(
        proposal_repository=proposal_repo,
        proposal_line_repository=proposal_line_repo,
        proposal_revision_repository=proposal_revision_repo,
        approval_decision_repository=approval_decision_repo,
        classification_repository=classification_repo,
        period_lock_repository=period_lock_repo,
        master_data_service=master_data_svc,
    )

    proposal_builder = ProposalBuilder(
        session,
        proposal_repository=proposal_repo,
        proposal_line_repository=proposal_line_repo,
        classification_repository=classification_repo,
        match_candidate_repository=match_candidate_repo,
        exception_repository=exception_repo,
        audit_repository=audit_repo,
    )

    approval_svc = ProposalApprovalService(
        proposal_repository=proposal_repo,
        proposal_line_repository=proposal_line_repo,
        approval_decision_repository=approval_decision_repo,
        exception_repository=exception_repo,
        audit_repository=audit_repo,
        proposal_revision_repository=proposal_revision_repo,
        proposal_line_revision_repository=proposal_line_revision_repo,
        vendor_repository=vendor_repo,
        vendor_alias_repository=vendor_alias_repo,
        account_repository=account_repo,
    )

    dry_run_svc = DryRunExecutionService(
        proposal_repository=proposal_repo,
        execution_artifact_repository=dry_run_artifact_repo,
        execution_attempt_repository=execution_attempt_repo,
        approval_decision_repository=approval_decision_repo,
        posting_receipt_repository=posting_receipt_repo,
        reconciliation_record_repository=reconciliation_repo,
        preflight_service=preflight_svc,
        contract_mapper_service=ZohoContractMapperService(),
        sandbox_adapter=None,       # not needed for dry_run mode
        settings=get_settings(),
    )

    return proposal_builder, approval_svc, preflight_svc, dry_run_svc


def main():
    session_factory = get_session_factory()
    session = session_factory()

    try:
        # ── Step 1: seed ─────────────────────────────────────────────────────────
        print("=" * 60)
        print("STEP 1: seed")
        classification = seed_data(session)

        proposal_builder, approval_svc, preflight_svc, dry_run_svc = build_services(session)

        # ── Step 2: build proposal ───────────────────────────────────────────────
        print("=" * 60)
        print("STEP 2: build posting proposal")
        outcome = proposal_builder.build_for_classification(str(classification.id))

        if outcome.proposal is None:
            exc = outcome.exception_case
            if exc:
                print(f"  BLOCKED by exception: {exc.exception_type}")
                print(f"  summary : {exc.summary}")
                print(f"  details : {exc.details_json}")
            else:
                print("  BLOCKED: no proposal and no exception case returned")
            session.rollback()
            return

        proposal = outcome.proposal
        print(f"  proposal_id          : {proposal.id}")
        print(f"  proposal_type        : {proposal.proposal_type}")
        print(f"  status               : {proposal.status}")
        print(f"  has_blocking_lines   : {proposal.has_blocking_lines}")
        print(f"  unresolved_items     : {proposal.unresolved_review_item_count}")
        print(f"  lines                : {len(outcome.lines)}")
        session.flush()

        # ── Step 3: approve ──────────────────────────────────────────────────────
        print("=" * 60)
        print("STEP 3: approve proposal")

        if proposal.has_blocking_lines:
            print(f"  BLOCKED: proposal has {proposal.unresolved_review_item_count} unresolved blocking line(s)")
            print("  Reviewer must resolve all blocking lines before approval.")
            session.rollback()
            return

        approval = approval_svc.capture_decision(
            str(proposal.id),
            decision="approved",
            reviewer="system",
            comment="Auto-approved for pipeline test",
        )
        print(f"  approval_id          : {approval.id}")
        print(f"  decision             : {approval.decision}")
        session.flush()

        # ── Step 4: preflight ────────────────────────────────────────────────────
        print("=" * 60)
        print("STEP 4: preflight")
        result = preflight_svc.evaluate_proposal(str(proposal.id))
        print(f"  preflight_status     : {result.preflight_status}")
        print(f"  eligible_for_posting : {result.eligible_for_posting}")
        if result.posting_block_reasons:
            print(f"  block_reasons        : {result.posting_block_reasons}")

        if not result.eligible_for_posting:
            print("  BLOCKED: preflight did not pass. Stopping before dry run.")
            session.rollback()
            return

        # ── Step 5: dry run ──────────────────────────────────────────────────────
        print("=" * 60)
        print("STEP 5: dry-run execution")
        exec_result = dry_run_svc.execute(str(proposal.id), actor="system", mode="dry_run")
        print(f"  execution_status     : {exec_result.execution_status}")
        print(f"  preflight_status     : {exec_result.preflight_status}")
        print(f"  artifact_id          : {exec_result.artifact_id}")
        if exec_result.block_reasons:
            print(f"  block_reasons        : {exec_result.block_reasons}")

        # ── commit ───────────────────────────────────────────────────────────────
        session.commit()
        print("=" * 60)
        print("DONE")
        print(f"  classification_result_id : {classification.id}")
        print(f"  proposal_id              : {proposal.id}")
        print(f"  approval_decision_id     : {approval.id}")
        print(f"  dry_run_artifact_id      : {exec_result.artifact_id}")

    except Exception:
        session.rollback()
        import traceback
        traceback.print_exc()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
