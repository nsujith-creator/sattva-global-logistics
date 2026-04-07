"""Reviewer controls, proposal revisions, and master-data hardening."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260329_0002"
down_revision = "20260329_0001"
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
        "proposal_revision",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("posting_proposal_id", sa.Uuid(), sa.ForeignKey("posting_proposal.id"), nullable=False),
        sa.Column("approval_decision_id", sa.Uuid(), sa.ForeignKey("approval_decision.id")),
        sa.Column("revision_type", sa.String(length=40), nullable=False),
        sa.Column("edited_by", sa.String(length=100), nullable=False),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("edit_reason", sa.Text()),
        sa.Column("prior_values_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("new_values_json", sa.JSON(), nullable=False, server_default="{}"),
        *_audit_cols(),
    )
    op.create_table(
        "proposal_line_revision",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("posting_proposal_id", sa.Uuid(), sa.ForeignKey("posting_proposal.id"), nullable=False),
        sa.Column("posting_proposal_line_id", sa.Uuid(), sa.ForeignKey("posting_proposal_line.id"), nullable=False),
        sa.Column("approval_decision_id", sa.Uuid(), sa.ForeignKey("approval_decision.id")),
        sa.Column("line_no", sa.Integer(), nullable=False),
        sa.Column("revision_type", sa.String(length=40), nullable=False),
        sa.Column("edited_by", sa.String(length=100), nullable=False),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("edit_reason", sa.Text()),
        sa.Column("prior_values_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("new_values_json", sa.JSON(), nullable=False, server_default="{}"),
        *_audit_cols(),
    )
    op.create_index("ix_proposal_revision_proposal_ts", "proposal_revision", ["posting_proposal_id", "edited_at"])
    op.create_index("ix_proposal_line_revision_proposal_ts", "proposal_line_revision", ["posting_proposal_id", "edited_at"])


def downgrade() -> None:
    op.drop_index("ix_proposal_line_revision_proposal_ts", table_name="proposal_line_revision")
    op.drop_index("ix_proposal_revision_proposal_ts", table_name="proposal_revision")
    op.drop_table("proposal_line_revision")
    op.drop_table("proposal_revision")
