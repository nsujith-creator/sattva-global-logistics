"""Sandbox receipt environment and external execution attempt ledger."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260329_0005"
down_revision = "20260329_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_zoho_posting_receipt_idempotency_key", "zoho_posting_receipt", type_="unique")
    op.add_column(
        "zoho_posting_receipt",
        sa.Column("environment", sa.String(length=20), nullable=False, server_default="sandbox"),
    )
    op.create_index("ix_zoho_posting_receipt_environment", "zoho_posting_receipt", ["environment"])
    op.create_unique_constraint(
        "uq_zoho_posting_receipt_env_idempotency",
        "zoho_posting_receipt",
        ["environment", "idempotency_key"],
    )

    op.create_table(
        "external_execution_attempt",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("posting_proposal_id", sa.Uuid(), sa.ForeignKey("posting_proposal.id"), nullable=False),
        sa.Column("execution_mode", sa.String(length=20), nullable=False),
        sa.Column("environment", sa.String(length=20), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("request_hash", sa.String(length=64)),
        sa.Column("idempotency_key", sa.String(length=128)),
        sa.Column("dispatched_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("outcome_status", sa.String(length=30), nullable=False),
        sa.Column("retryable_flag", sa.Boolean()),
        sa.Column("external_correlation_ids_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("reconciliation_preconditions_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("dry_run_artifact_id", sa.Uuid(), sa.ForeignKey("dry_run_execution_artifact.id")),
        sa.Column("prepared_request_artifact_id", sa.Uuid(), sa.ForeignKey("dry_run_execution_artifact.id")),
        sa.Column("receipt_id", sa.Uuid(), sa.ForeignKey("zoho_posting_receipt.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=100), nullable=False, server_default="system"),
        sa.Column("updated_by", sa.String(length=100), nullable=False, server_default="system"),
        sa.UniqueConstraint(
            "posting_proposal_id",
            "execution_mode",
            "environment",
            "attempt_number",
            name="uq_external_execution_attempt_order",
        ),
    )
    op.create_index(
        "ix_external_execution_attempt_proposal",
        "external_execution_attempt",
        ["posting_proposal_id", "attempt_number"],
    )
    op.create_index(
        "ix_external_execution_attempt_idempotency",
        "external_execution_attempt",
        ["idempotency_key", "environment", "execution_mode"],
    )


def downgrade() -> None:
    op.drop_index("ix_external_execution_attempt_idempotency", table_name="external_execution_attempt")
    op.drop_index("ix_external_execution_attempt_proposal", table_name="external_execution_attempt")
    op.drop_table("external_execution_attempt")
    op.drop_constraint("uq_zoho_posting_receipt_env_idempotency", "zoho_posting_receipt", type_="unique")
    op.drop_index("ix_zoho_posting_receipt_environment", table_name="zoho_posting_receipt")
    op.drop_column("zoho_posting_receipt", "environment")
    op.create_unique_constraint("uq_zoho_posting_receipt_idempotency_key", "zoho_posting_receipt", ["idempotency_key"])
