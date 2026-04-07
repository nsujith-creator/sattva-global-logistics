"""Sandbox reconciliation records and Zoho mapping registry."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260329_0006"
down_revision = "20260329_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "zoho_account_mapping",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("account_master_id", sa.Uuid(), sa.ForeignKey("account_master.id"), nullable=False),
        sa.Column("environment", sa.String(length=20), nullable=False, server_default="sandbox"),
        sa.Column("target_system", sa.String(length=20), nullable=False, server_default="zoho_books"),
        sa.Column("target_module", sa.String(length=40)),
        sa.Column("zoho_account_id", sa.String(length=50), nullable=False),
        sa.Column("source_type", sa.String(length=30), nullable=False, server_default="manual"),
        sa.Column("source_ref", sa.String(length=100)),
        sa.Column("provenance_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=100), nullable=False, server_default="system"),
        sa.Column("updated_by", sa.String(length=100), nullable=False, server_default="system"),
        sa.UniqueConstraint(
            "account_master_id",
            "environment",
            "target_system",
            "target_module",
            name="uq_zoho_account_mapping_scope",
        ),
    )
    op.create_index("ix_zoho_account_mapping_account_master", "zoho_account_mapping", ["account_master_id", "environment"])

    op.create_table(
        "zoho_tax_mapping",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("environment", sa.String(length=20), nullable=False, server_default="sandbox"),
        sa.Column("target_system", sa.String(length=20), nullable=False, server_default="zoho_books"),
        sa.Column("target_module", sa.String(length=40)),
        sa.Column("tax_code", sa.String(length=50), nullable=False),
        sa.Column("account_master_id", sa.Uuid(), sa.ForeignKey("account_master.id")),
        sa.Column("zoho_tax_id", sa.String(length=50), nullable=False),
        sa.Column("source_type", sa.String(length=30), nullable=False, server_default="manual"),
        sa.Column("source_ref", sa.String(length=100)),
        sa.Column("provenance_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=100), nullable=False, server_default="system"),
        sa.Column("updated_by", sa.String(length=100), nullable=False, server_default="system"),
        sa.UniqueConstraint(
            "environment",
            "target_system",
            "target_module",
            "tax_code",
            "account_master_id",
            name="uq_zoho_tax_mapping_scope",
        ),
    )
    op.create_index("ix_zoho_tax_mapping_lookup", "zoho_tax_mapping", ["tax_code", "environment", "account_master_id"])

    op.add_column(
        "dry_run_execution_artifact",
        sa.Column("environment", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "dry_run_execution_artifact",
        sa.Column("reconciliation_context_json", sa.JSON(), nullable=False, server_default="{}"),
    )
    op.create_index("ix_dry_run_execution_artifact_environment", "dry_run_execution_artifact", ["environment"])

    op.add_column(
        "external_execution_attempt",
        sa.Column("target_system", sa.String(length=20), nullable=False, server_default="zoho_books"),
    )
    op.add_column(
        "external_execution_attempt",
        sa.Column("target_module", sa.String(length=40), nullable=True),
    )
    op.add_column(
        "external_execution_attempt",
        sa.Column("target_object_type_hint", sa.String(length=40), nullable=True),
    )
    op.add_column(
        "external_execution_attempt",
        sa.Column("external_lookup_keys_json", sa.JSON(), nullable=False, server_default="{}"),
    )
    op.add_column(
        "external_execution_attempt",
        sa.Column("request_correlation_json", sa.JSON(), nullable=False, server_default="{}"),
    )
    op.create_index("ix_external_execution_attempt_target_module", "external_execution_attempt", ["target_module", "environment"])

    op.create_table(
        "sandbox_reconciliation_record",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("external_execution_attempt_id", sa.Uuid(), sa.ForeignKey("external_execution_attempt.id"), nullable=False),
        sa.Column("posting_proposal_id", sa.Uuid(), sa.ForeignKey("posting_proposal.id"), nullable=False),
        sa.Column("environment", sa.String(length=20), nullable=False, server_default="sandbox"),
        sa.Column("reconciliation_status", sa.String(length=30), nullable=False),
        sa.Column("lookup_strategy", sa.String(length=50), nullable=False),
        sa.Column("target_system", sa.String(length=20), nullable=False, server_default="zoho_books"),
        sa.Column("target_module", sa.String(length=40)),
        sa.Column("request_hash", sa.String(length=64)),
        sa.Column("idempotency_key", sa.String(length=128)),
        sa.Column("lookup_context_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("external_lookup_response_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("matched_external_id", sa.String(length=100)),
        sa.Column("matched_external_number", sa.String(length=100)),
        sa.Column("receipt_id", sa.Uuid(), sa.ForeignKey("zoho_posting_receipt.id")),
        sa.Column("reconciled_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=100), nullable=False, server_default="system"),
        sa.Column("updated_by", sa.String(length=100), nullable=False, server_default="system"),
    )
    op.create_index(
        "ix_sandbox_reconciliation_record_attempt",
        "sandbox_reconciliation_record",
        ["external_execution_attempt_id", "reconciled_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_sandbox_reconciliation_record_attempt", table_name="sandbox_reconciliation_record")
    op.drop_table("sandbox_reconciliation_record")
    op.drop_index("ix_external_execution_attempt_target_module", table_name="external_execution_attempt")
    op.drop_column("external_execution_attempt", "request_correlation_json")
    op.drop_column("external_execution_attempt", "external_lookup_keys_json")
    op.drop_column("external_execution_attempt", "target_object_type_hint")
    op.drop_column("external_execution_attempt", "target_module")
    op.drop_column("external_execution_attempt", "target_system")
    op.drop_index("ix_dry_run_execution_artifact_environment", table_name="dry_run_execution_artifact")
    op.drop_column("dry_run_execution_artifact", "reconciliation_context_json")
    op.drop_column("dry_run_execution_artifact", "environment")
    op.drop_index("ix_zoho_tax_mapping_lookup", table_name="zoho_tax_mapping")
    op.drop_table("zoho_tax_mapping")
    op.drop_index("ix_zoho_account_mapping_account_master", table_name="zoho_account_mapping")
    op.drop_table("zoho_account_mapping")
