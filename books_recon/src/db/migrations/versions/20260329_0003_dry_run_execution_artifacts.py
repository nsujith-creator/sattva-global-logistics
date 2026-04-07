"""Dry-run execution artifacts for Zoho contract mapping scaffolding."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260329_0003"
down_revision = "20260329_0002"
branch_labels = None
depends_on = None


def _audit_cols() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=100), nullable=False, server_default="system"),
        sa.Column("updated_by", sa.String(length=100), nullable=False, server_default="system"),
    ]


def upgrade() -> None:
    op.create_table(
        "dry_run_execution_artifact",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("posting_proposal_id", sa.Uuid(), sa.ForeignKey("posting_proposal.id"), nullable=False),
        sa.Column("classification_result_id", sa.Uuid(), sa.ForeignKey("classification_result.id"), nullable=False),
        sa.Column("rule_version_id", sa.Uuid(), sa.ForeignKey("rule_version.id"), nullable=False),
        sa.Column("execution_mode", sa.String(length=20), nullable=False, server_default="dry_run"),
        sa.Column("execution_status", sa.String(length=20), nullable=False),
        sa.Column("target_system", sa.String(length=20), nullable=False),
        sa.Column("target_module", sa.String(length=40), nullable=False),
        sa.Column("contract_version", sa.String(length=30), nullable=False),
        sa.Column("preflight_status", sa.String(length=20), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128)),
        sa.Column("request_hash", sa.String(length=64)),
        sa.Column("block_reasons_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("execution_plan_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("prepared_request_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("simulated_receipt_json", sa.JSON(), nullable=False, server_default="{}"),
        *_audit_cols(),
    )
    op.create_index("ix_dry_run_execution_artifact_proposal", "dry_run_execution_artifact", ["posting_proposal_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_dry_run_execution_artifact_proposal", table_name="dry_run_execution_artifact")
    op.drop_table("dry_run_execution_artifact")
