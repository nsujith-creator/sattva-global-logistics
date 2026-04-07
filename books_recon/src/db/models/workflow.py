"""Matching, proposal, approval, posting-receipt, and exception models."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base
from db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, UserStampMixin


class MatchCandidate(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "match_candidate"

    evidence_bundle_id: Mapped[str] = mapped_column(ForeignKey("evidence_bundle.id"), nullable=False, index=True)
    from_object_type: Mapped[str] = mapped_column(String(50), nullable=False)
    from_object_id: Mapped[str] = mapped_column(String(36), nullable=False)
    to_object_type: Mapped[str] = mapped_column(String(50), nullable=False)
    to_object_id: Mapped[str] = mapped_column(String(36), nullable=False)
    match_layer: Mapped[str] = mapped_column(String(20), nullable=False)
    rule_name: Mapped[str] = mapped_column(String(100), nullable=False)
    score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    score_components: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    conflict_group_id: Mapped[str | None] = mapped_column(String(64), index=True)
    decision_status: Mapped[str] = mapped_column(String(20), nullable=False, default="candidate", index=True)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_refs: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (
        UniqueConstraint(
            "evidence_bundle_id",
            "from_object_type",
            "from_object_id",
            "to_object_type",
            "to_object_id",
            "rule_name",
            name="uq_match_candidate_identity",
        ),
    )


class ClassificationResult(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "classification_result"

    evidence_bundle_id: Mapped[str] = mapped_column(ForeignKey("evidence_bundle.id"), nullable=False, index=True)
    rule_version_id: Mapped[str] = mapped_column(ForeignKey("rule_version.id"), nullable=False, index=True)
    classification_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="proposed", index=True)
    confidence_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    materiality_amount: Mapped[float | None] = mapped_column(Numeric(18, 2))
    accounting_period_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    decision_summary: Mapped[str] = mapped_column(Text, nullable=False)
    explanation_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    ai_assist_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    supersedes_classification_id: Mapped[str | None] = mapped_column(ForeignKey("classification_result.id"))


class PostingProposal(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "posting_proposal"

    classification_result_id: Mapped[str] = mapped_column(ForeignKey("classification_result.id"), nullable=False, index=True)
    generated_from_classification_id: Mapped[str] = mapped_column(ForeignKey("classification_result.id"), nullable=False, index=True)
    rule_version_id: Mapped[str] = mapped_column(ForeignKey("rule_version.id"), nullable=False, index=True)
    proposal_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    input_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    proposal_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    proposal_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="review_only")
    target_system: Mapped[str] = mapped_column(String(20), nullable=False, default="zoho_books")
    target_period_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    gross_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    narrative: Mapped[str] = mapped_column(Text, nullable=False)
    has_blocking_lines: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    unresolved_review_item_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    policy_flags: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    supersedes_proposal_id: Mapped[str | None] = mapped_column(ForeignKey("posting_proposal.id"))
    superseded_by_proposal_id: Mapped[str | None] = mapped_column(ForeignKey("posting_proposal.id"))
    supersession_reason: Mapped[str | None] = mapped_column(Text)


class PostingProposalLine(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "posting_proposal_line"

    posting_proposal_id: Mapped[str] = mapped_column(ForeignKey("posting_proposal.id"), nullable=False, index=True)
    line_no: Mapped[int] = mapped_column(Integer, nullable=False)
    action_type: Mapped[str] = mapped_column(String(40), nullable=False)
    account_master_id: Mapped[str | None] = mapped_column(ForeignKey("account_master.id"))
    vendor_master_id: Mapped[str | None] = mapped_column(ForeignKey("vendor_master.id"))
    zoho_target_object_type: Mapped[str | None] = mapped_column(String(40))
    zoho_target_object_ref: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[float | None] = mapped_column(Numeric(18, 4))
    rate: Mapped[float | None] = mapped_column(Numeric(18, 2))
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    tax_code: Mapped[str | None] = mapped_column(String(50))
    review_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    review_reason_code: Mapped[str | None] = mapped_column(String(50))
    is_blocking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    resolved_by_user: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    allocation_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (UniqueConstraint("posting_proposal_id", "line_no", name="uq_posting_proposal_line_order"),)


class ProposalRevision(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "proposal_revision"

    posting_proposal_id: Mapped[str] = mapped_column(ForeignKey("posting_proposal.id"), nullable=False, index=True)
    approval_decision_id: Mapped[str | None] = mapped_column(ForeignKey("approval_decision.id"), index=True)
    revision_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    edited_by: Mapped[str] = mapped_column(String(100), nullable=False)
    edited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    edit_reason: Mapped[str | None] = mapped_column(Text)
    prior_values_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    new_values_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class ProposalLineRevision(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "proposal_line_revision"

    posting_proposal_id: Mapped[str] = mapped_column(ForeignKey("posting_proposal.id"), nullable=False, index=True)
    posting_proposal_line_id: Mapped[str] = mapped_column(ForeignKey("posting_proposal_line.id"), nullable=False, index=True)
    approval_decision_id: Mapped[str | None] = mapped_column(ForeignKey("approval_decision.id"), index=True)
    line_no: Mapped[int] = mapped_column(Integer, nullable=False)
    revision_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    edited_by: Mapped[str] = mapped_column(String(100), nullable=False)
    edited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    edit_reason: Mapped[str | None] = mapped_column(Text)
    prior_values_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    new_values_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class DryRunExecutionArtifact(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "dry_run_execution_artifact"

    posting_proposal_id: Mapped[str] = mapped_column(ForeignKey("posting_proposal.id"), nullable=False, index=True)
    classification_result_id: Mapped[str] = mapped_column(ForeignKey("classification_result.id"), nullable=False, index=True)
    rule_version_id: Mapped[str] = mapped_column(ForeignKey("rule_version.id"), nullable=False, index=True)
    execution_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="dry_run")
    execution_status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    target_system: Mapped[str] = mapped_column(String(20), nullable=False)
    target_module: Mapped[str] = mapped_column(String(40), nullable=False)
    contract_version: Mapped[str] = mapped_column(String(30), nullable=False)
    preflight_status: Mapped[str] = mapped_column(String(20), nullable=False)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), index=True)
    request_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    block_reasons_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    execution_plan_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    prepared_request_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    simulated_receipt_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    external_response_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    normalized_response_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    environment: Mapped[str | None] = mapped_column(String(20), index=True)
    reconciliation_context_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    retryable_flag: Mapped[bool | None] = mapped_column(Boolean)


class ApprovalDecision(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "approval_decision"

    posting_proposal_id: Mapped[str] = mapped_column(ForeignKey("posting_proposal.id"), nullable=False, index=True)
    classification_result_id: Mapped[str | None] = mapped_column(ForeignKey("classification_result.id"), index=True)
    exception_case_id: Mapped[str | None] = mapped_column(ForeignKey("exception_case.id"), index=True)
    decision: Mapped[str] = mapped_column(String(25), nullable=False, index=True)
    decision_by: Mapped[str] = mapped_column(String(100), nullable=False)
    decision_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason_code: Mapped[str | None] = mapped_column(String(50))
    comment_text: Mapped[str | None] = mapped_column(Text)
    edited_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_final: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ZohoPostingReceipt(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "zoho_posting_receipt"

    posting_proposal_id: Mapped[str] = mapped_column(ForeignKey("posting_proposal.id"), nullable=False, index=True)
    approval_decision_id: Mapped[str | None] = mapped_column(ForeignKey("approval_decision.id"))
    environment: Mapped[str] = mapped_column(String(20), nullable=False, default="sandbox", index=True)
    posting_mode: Mapped[str] = mapped_column(String(20), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    target_object_type: Mapped[str] = mapped_column(String(40), nullable=False)
    target_external_id: Mapped[str | None] = mapped_column(String(100), index=True)
    target_external_number: Mapped[str | None] = mapped_column(String(100), index=True)
    posting_status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response_code: Mapped[str | None] = mapped_column(String(20))
    response_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    reversal_of_receipt_id: Mapped[str | None] = mapped_column(ForeignKey("zoho_posting_receipt.id"))

    __table_args__ = (UniqueConstraint("environment", "idempotency_key", name="uq_zoho_posting_receipt_env_idempotency"),)


class ExternalExecutionAttempt(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "external_execution_attempt"

    posting_proposal_id: Mapped[str] = mapped_column(ForeignKey("posting_proposal.id"), nullable=False, index=True)
    execution_mode: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    environment: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    request_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), index=True)
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    outcome_status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    retryable_flag: Mapped[bool | None] = mapped_column(Boolean)
    target_system: Mapped[str] = mapped_column(String(20), nullable=False, default="zoho_books")
    target_module: Mapped[str | None] = mapped_column(String(40), index=True)
    target_object_type_hint: Mapped[str | None] = mapped_column(String(40))
    external_lookup_keys_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    request_correlation_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    external_correlation_ids_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    reconciliation_preconditions_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    dry_run_artifact_id: Mapped[str | None] = mapped_column(ForeignKey("dry_run_execution_artifact.id"))
    prepared_request_artifact_id: Mapped[str | None] = mapped_column(ForeignKey("dry_run_execution_artifact.id"))
    receipt_id: Mapped[str | None] = mapped_column(ForeignKey("zoho_posting_receipt.id"))

    __table_args__ = (
        UniqueConstraint(
            "posting_proposal_id",
            "execution_mode",
            "environment",
            "attempt_number",
            name="uq_external_execution_attempt_order",
        ),
    )


class SandboxReconciliationRecord(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "sandbox_reconciliation_record"

    external_execution_attempt_id: Mapped[str] = mapped_column(
        ForeignKey("external_execution_attempt.id"),
        nullable=False,
        index=True,
    )
    posting_proposal_id: Mapped[str] = mapped_column(ForeignKey("posting_proposal.id"), nullable=False, index=True)
    environment: Mapped[str] = mapped_column(String(20), nullable=False, default="sandbox", index=True)
    reconciliation_status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    lookup_strategy: Mapped[str] = mapped_column(String(50), nullable=False)
    target_system: Mapped[str] = mapped_column(String(20), nullable=False, default="zoho_books")
    target_module: Mapped[str | None] = mapped_column(String(40))
    request_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), index=True)
    lookup_context_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    external_lookup_response_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    matched_external_id: Mapped[str | None] = mapped_column(String(100), index=True)
    matched_external_number: Mapped[str | None] = mapped_column(String(100), index=True)
    receipt_id: Mapped[str | None] = mapped_column(ForeignKey("zoho_posting_receipt.id"))
    reconciled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


class ExceptionCase(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "exception_case"

    exception_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    conflict_type: Mapped[str | None] = mapped_column(String(50), index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    bundle_id: Mapped[str | None] = mapped_column(ForeignKey("evidence_bundle.id"), index=True)
    classification_result_id: Mapped[str | None] = mapped_column(ForeignKey("classification_result.id"), index=True)
    posting_proposal_id: Mapped[str | None] = mapped_column(ForeignKey("posting_proposal.id"), index=True)
    approval_decision_id: Mapped[str | None] = mapped_column(ForeignKey("approval_decision.id"), index=True)
    related_object_type: Mapped[str] = mapped_column(String(50), nullable=False)
    related_object_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    fiscal_year_id: Mapped[str | None] = mapped_column(ForeignKey("fiscal_year.id"), index=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    details_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    assigned_to: Mapped[str | None] = mapped_column(String(100))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_note: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (Index("ix_exception_case_queue", "status", "severity", "exception_type"),)
