"""Sandbox execution artifact extensions."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260329_0004"
down_revision = "20260329_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "dry_run_execution_artifact",
        sa.Column("external_response_json", sa.JSON(), nullable=False, server_default="{}"),
    )
    op.add_column(
        "dry_run_execution_artifact",
        sa.Column("normalized_response_json", sa.JSON(), nullable=False, server_default="{}"),
    )
    op.add_column(
        "dry_run_execution_artifact",
        sa.Column("retryable_flag", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("dry_run_execution_artifact", "retryable_flag")
    op.drop_column("dry_run_execution_artifact", "normalized_response_json")
    op.drop_column("dry_run_execution_artifact", "external_response_json")
