"""Add missing approval_decision link to exception_case."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260330_0007"
down_revision = "20260329_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "exception_case",
        sa.Column("approval_decision_id", sa.Uuid(), sa.ForeignKey("approval_decision.id"), nullable=True),
    )
    op.create_index(
        "ix_exception_case_approval_decision_id",
        "exception_case",
        ["approval_decision_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_exception_case_approval_decision_id", table_name="exception_case")
    op.drop_column("exception_case", "approval_decision_id")
