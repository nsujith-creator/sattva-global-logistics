"""Thin reviewer operations CLI."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, is_dataclass

from approvals.service import ProposalApprovalService
from connectors.zoho.sandbox_adapter import ZohoSandboxAdapter
from core.config import get_settings
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
    VendorAliasRepository,
    VendorMasterRepository,
    ZohoAccountMappingRepository,
    ZohoTaxMappingRepository,
)
from db.repositories.workflow import ClassificationResultRepository, ExceptionCaseRepository
from db.session import get_session_factory
from dry_run_execution.service import DryRunExecutionService
from master_data.service import MasterDataControlService
from preflight.service import PostingPreflightService
from reconciliation.service import SandboxReconciliationService
from reviewer_ops.service import ReviewerOperationsService
from zoho_contracts.service import ZohoContractMapperService


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    session = get_session_factory()()
    try:
        ops = _build_reviewer_ops(session)
        master_data = _build_master_data(session)

        if args.command == "list-pending-review":
            _print_payload([asdict(item) for item in ops.list_pending_review()])
        elif args.command == "list-blocked":
            _print_payload([asdict(item) for item in ops.list_blocked()])
        elif args.command == "list-dry-run-eligible":
            _print_payload([asdict(item) for item in ops.list_eligible_for_dry_run()])
        elif args.command == "inspect-proposal":
            _print_payload(_jsonable(ops.inspect_proposal(args.proposal_id)))
        elif args.command == "run-preflight":
            _print_payload(asdict(ops.run_preflight(args.proposal_id)))
        elif args.command == "inspect-dry-run":
            _print_payload(asdict(ops.inspect_dry_run_payload(args.proposal_id)))
        elif args.command == "execute-dry-run":
            _print_payload(asdict(ops.run_dry_run_executor(args.proposal_id, actor=args.actor)))
            session.commit()
        elif args.command == "execute-sandbox":
            _print_payload(asdict(ops.run_executor(args.proposal_id, actor=args.actor, mode="sandbox_execute")))
            session.commit()
        elif args.command == "inspect-dry-run-artifact":
            _print_payload(_jsonable(ops.inspect_latest_dry_run_artifact(args.proposal_id)))
        elif args.command == "list-sandbox-unknown":
            reconciliation = _build_reconciliation(session)
            _print_payload([asdict(item) for item in reconciliation.inspect_unresolved_unknown_outcomes()])
        elif args.command == "reconcile-sandbox-attempt":
            reconciliation = _build_reconciliation(session)
            _print_payload(asdict(reconciliation.reconcile_attempt(args.attempt_id, actor=args.actor)))
            session.commit()
        elif args.command == "resolve-line":
            line = ops.resolve_blocking_placeholder(
                args.proposal_id,
                line_no=args.line_no,
                reviewer=args.reviewer,
                vendor_reference=args.vendor_reference,
                account_reference=args.account_reference,
                tax_code=args.tax_code,
                resolution_choice=args.resolution_choice,
                comment=args.comment,
            )
            session.commit()
            _print_payload(_jsonable(line))
        elif args.command == "approve":
            decision = ops.approve(args.proposal_id, reviewer=args.reviewer, comment=args.comment)
            session.commit()
            _print_payload(_jsonable(decision))
        elif args.command == "reject":
            decision = ops.reject(args.proposal_id, reviewer=args.reviewer, comment=args.comment)
            session.commit()
            _print_payload(_jsonable(decision))
        elif args.command == "invalidate":
            proposal = ops.invalidate(args.proposal_id, reviewer=args.reviewer, comment=args.comment)
            session.commit()
            _print_payload(_jsonable(proposal))
        elif args.command == "upsert-vendor":
            vendor = master_data.upsert_vendor_master(
                canonical_name=args.canonical_name,
                display_name=args.display_name,
                vendor_type=args.vendor_type,
                gstin=args.gstin,
                pan=args.pan,
                zoho_contact_id=args.zoho_contact_id,
                beneficiary_fingerprints=args.beneficiary_fingerprint or [],
                created_by=args.actor,
            )
            session.commit()
            _print_payload(_jsonable(vendor))
        elif args.command == "add-vendor-alias":
            alias = master_data.upsert_vendor_alias(
                vendor_master_id=args.vendor_master_id,
                alias_value=args.alias_value,
                alias_type=args.alias_type,
                source_system=args.source_system,
                created_by=args.actor,
            )
            session.commit()
            _print_payload(_jsonable(alias))
        elif args.command == "lookup-accounts":
            _print_payload([_jsonable(account) for account in master_data.lookup_accounts(account_type=args.account_type)])
        elif args.command == "upsert-zoho-account-mapping":
            mapping = master_data.upsert_zoho_account_mapping(
                account_reference=args.account_reference,
                zoho_account_id=args.zoho_account_id,
                environment=args.environment,
                target_module=args.target_module,
                source_type=args.source_type,
                source_ref=args.source_ref,
                created_by=args.actor,
            )
            session.commit()
            _print_payload(_jsonable(mapping))
        elif args.command == "upsert-zoho-tax-mapping":
            mapping = master_data.upsert_zoho_tax_mapping(
                tax_code=args.tax_code,
                zoho_tax_id=args.zoho_tax_id,
                environment=args.environment,
                target_module=args.target_module,
                account_reference=args.account_reference,
                source_type=args.source_type,
                source_ref=args.source_ref,
                created_by=args.actor,
            )
            session.commit()
            _print_payload(_jsonable(mapping))
        else:
            raise SystemExit(f"Unsupported command: {args.command}")
    finally:
        session.close()


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="books-recon")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list-pending-review")
    sub.add_parser("list-blocked")
    sub.add_parser("list-dry-run-eligible")

    inspect_parser = sub.add_parser("inspect-proposal")
    inspect_parser.add_argument("proposal_id")

    preflight_parser = sub.add_parser("run-preflight")
    preflight_parser.add_argument("proposal_id")

    dry_run_parser = sub.add_parser("inspect-dry-run")
    dry_run_parser.add_argument("proposal_id")

    execute_parser = sub.add_parser("execute-dry-run")
    execute_parser.add_argument("proposal_id")
    execute_parser.add_argument("--actor", default="cli")

    sandbox_parser = sub.add_parser("execute-sandbox")
    sandbox_parser.add_argument("proposal_id")
    sandbox_parser.add_argument("--actor", default="cli")

    artifact_parser = sub.add_parser("inspect-dry-run-artifact")
    artifact_parser.add_argument("proposal_id")

    sub.add_parser("list-sandbox-unknown")

    reconcile_parser = sub.add_parser("reconcile-sandbox-attempt")
    reconcile_parser.add_argument("attempt_id")
    reconcile_parser.add_argument("--actor", default="cli")

    resolve_parser = sub.add_parser("resolve-line")
    resolve_parser.add_argument("proposal_id")
    resolve_parser.add_argument("line_no", type=int)
    resolve_parser.add_argument("--reviewer", required=True)
    resolve_parser.add_argument("--vendor-reference")
    resolve_parser.add_argument("--account-reference")
    resolve_parser.add_argument("--tax-code")
    resolve_parser.add_argument("--resolution-choice")
    resolve_parser.add_argument("--comment")

    approve_parser = sub.add_parser("approve")
    approve_parser.add_argument("proposal_id")
    approve_parser.add_argument("--reviewer", required=True)
    approve_parser.add_argument("--comment")

    reject_parser = sub.add_parser("reject")
    reject_parser.add_argument("proposal_id")
    reject_parser.add_argument("--reviewer", required=True)
    reject_parser.add_argument("--comment")

    invalidate_parser = sub.add_parser("invalidate")
    invalidate_parser.add_argument("proposal_id")
    invalidate_parser.add_argument("--reviewer", required=True)
    invalidate_parser.add_argument("--comment")

    vendor_parser = sub.add_parser("upsert-vendor")
    vendor_parser.add_argument("--canonical-name", required=True)
    vendor_parser.add_argument("--display-name", required=True)
    vendor_parser.add_argument("--vendor-type", required=True)
    vendor_parser.add_argument("--gstin")
    vendor_parser.add_argument("--pan")
    vendor_parser.add_argument("--zoho-contact-id")
    vendor_parser.add_argument("--beneficiary-fingerprint", action="append")
    vendor_parser.add_argument("--actor", default="cli")

    alias_parser = sub.add_parser("add-vendor-alias")
    alias_parser.add_argument("vendor_master_id")
    alias_parser.add_argument("alias_value")
    alias_parser.add_argument("--alias-type", default="name")
    alias_parser.add_argument("--source-system")
    alias_parser.add_argument("--actor", default="cli")

    account_parser = sub.add_parser("lookup-accounts")
    account_parser.add_argument("--account-type")

    account_mapping_parser = sub.add_parser("upsert-zoho-account-mapping")
    account_mapping_parser.add_argument("account_reference")
    account_mapping_parser.add_argument("zoho_account_id")
    account_mapping_parser.add_argument("--environment", default="sandbox")
    account_mapping_parser.add_argument("--target-module")
    account_mapping_parser.add_argument("--source-type", default="manual")
    account_mapping_parser.add_argument("--source-ref")
    account_mapping_parser.add_argument("--actor", default="cli")

    tax_mapping_parser = sub.add_parser("upsert-zoho-tax-mapping")
    tax_mapping_parser.add_argument("tax_code")
    tax_mapping_parser.add_argument("zoho_tax_id")
    tax_mapping_parser.add_argument("--account-reference")
    tax_mapping_parser.add_argument("--environment", default="sandbox")
    tax_mapping_parser.add_argument("--target-module")
    tax_mapping_parser.add_argument("--source-type", default="manual")
    tax_mapping_parser.add_argument("--source-ref")
    tax_mapping_parser.add_argument("--actor", default="cli")
    return parser


def _build_master_data(session):
    return MasterDataControlService(
        vendor_repository=VendorMasterRepository(session),
        vendor_alias_repository=VendorAliasRepository(session),
        account_repository=AccountMasterRepository(session),
        zoho_account_mapping_repository=ZohoAccountMappingRepository(session),
        zoho_tax_mapping_repository=ZohoTaxMappingRepository(session),
    )


def _build_reviewer_ops(session):
    settings = get_settings()
    preflight_service = PostingPreflightService(
        proposal_repository=ProposalRepository(session),
        proposal_line_repository=ProposalLineRepository(session),
        proposal_revision_repository=ProposalRevisionRepository(session),
        approval_decision_repository=ApprovalDecisionRepository(session),
        classification_repository=ClassificationResultRepository(session),
        period_lock_repository=PeriodLockRepository(session),
        master_data_service=_build_master_data(session),
    )
    dry_run_execution_service = DryRunExecutionService(
        proposal_repository=ProposalRepository(session),
        execution_artifact_repository=DryRunExecutionArtifactRepository(session),
        execution_attempt_repository=ExternalExecutionAttemptRepository(session),
        approval_decision_repository=ApprovalDecisionRepository(session),
        posting_receipt_repository=ZohoPostingReceiptRepository(session),
        reconciliation_record_repository=SandboxReconciliationRecordRepository(session),
        preflight_service=preflight_service,
        contract_mapper_service=ZohoContractMapperService(),
        sandbox_adapter=ZohoSandboxAdapter(
            settings=settings,
            proposal_repository=ProposalRepository(session),
            proposal_line_repository=ProposalLineRepository(session),
            zoho_account_mapping_repository=ZohoAccountMappingRepository(session),
            zoho_tax_mapping_repository=ZohoTaxMappingRepository(session),
        ),
        settings=settings,
    )
    approval_service = ProposalApprovalService(
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
    return ReviewerOperationsService(
        session,
        proposal_repository=ProposalRepository(session),
        proposal_line_repository=ProposalLineRepository(session),
        proposal_revision_repository=ProposalRevisionRepository(session),
        proposal_line_revision_repository=ProposalLineRevisionRepository(session),
        classification_repository=ClassificationResultRepository(session),
        approval_decision_repository=ApprovalDecisionRepository(session),
        approval_service=approval_service,
        master_data_service=_build_master_data(session),
        preflight_service=preflight_service,
        dry_run_execution_service=dry_run_execution_service,
    )


def _build_reconciliation(session):
    settings = get_settings()
    return SandboxReconciliationService(
        execution_attempt_repository=ExternalExecutionAttemptRepository(session),
        reconciliation_record_repository=SandboxReconciliationRecordRepository(session),
        posting_receipt_repository=ZohoPostingReceiptRepository(session),
        approval_decision_repository=ApprovalDecisionRepository(session),
        sandbox_adapter=ZohoSandboxAdapter(
            settings=settings,
            proposal_repository=ProposalRepository(session),
            proposal_line_repository=ProposalLineRepository(session),
            zoho_account_mapping_repository=ZohoAccountMappingRepository(session),
            zoho_tax_mapping_repository=ZohoTaxMappingRepository(session),
        ),
    )


def _jsonable(value):
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    if hasattr(value, "__table__"):
        payload = {}
        for column in value.__table__.columns:
            item = getattr(value, column.name)
            payload[column.name] = item.isoformat() if hasattr(item, "isoformat") else item
        return payload
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    return value


def _print_payload(payload) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True, default=str))


if __name__ == "__main__":
    main()
