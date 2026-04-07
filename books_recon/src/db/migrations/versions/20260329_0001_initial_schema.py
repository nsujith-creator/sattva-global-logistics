"""Initial schema foundation with explicit Alembic operations."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260329_0001"
down_revision = None
branch_labels = None
depends_on = None


def _id_col() -> sa.Column:
    return sa.Column("id", sa.Uuid(), primary_key=True, nullable=False)


def _audit_cols() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=100), nullable=False, server_default="system"),
        sa.Column("updated_by", sa.String(length=100), nullable=False, server_default="system"),
    ]


def upgrade() -> None:
    op.create_table(
        "fiscal_year",
        _id_col(),
        sa.Column("code", sa.String(length=9), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("assessment_year_code", sa.String(length=9)),
        sa.Column("is_closed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.Column("close_reason", sa.Text()),
        sa.Column("notes", sa.Text()),
        sa.CheckConstraint("start_date <= end_date", name="fy_date_order"),
        sa.UniqueConstraint("code", name="uq_fiscal_year_code"),
        *_audit_cols(),
    )
    op.create_table(
        "period_lock",
        _id_col(),
        sa.Column("fiscal_year_id", sa.Uuid(), sa.ForeignKey("fiscal_year.id"), nullable=False),
        sa.Column("period_code", sa.String(length=10), nullable=False),
        sa.Column("lock_state", sa.String(length=20), nullable=False),
        sa.Column("locked_at", sa.DateTime(timezone=True)),
        sa.Column("reason", sa.Text()),
        sa.UniqueConstraint("fiscal_year_id", "period_code", name="uq_period_lock_scope"),
        *_audit_cols(),
    )
    op.create_table(
        "vendor_master",
        _id_col(),
        sa.Column("canonical_name", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("vendor_type", sa.String(length=30), nullable=False),
        sa.Column("gstin", sa.String(length=15)),
        sa.Column("pan", sa.String(length=10)),
        sa.Column("is_personal_counterparty", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("personal_match_mode", sa.String(length=30)),
        sa.Column("beneficiary_fingerprints", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("narration_patterns", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("zoho_contact_id", sa.String(length=50)),
        sa.Column("default_settlement_policy", sa.String(length=30), nullable=False, server_default="bill_to_bill"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("canonical_name", name="uq_vendor_master_canonical_name"),
        *_audit_cols(),
    )
    op.create_table(
        "vendor_alias",
        _id_col(),
        sa.Column("vendor_master_id", sa.Uuid(), sa.ForeignKey("vendor_master.id"), nullable=False),
        sa.Column("alias_type", sa.String(length=30), nullable=False),
        sa.Column("alias_value", sa.Text(), nullable=False),
        sa.Column("normalized_alias_value", sa.String(length=255), nullable=False),
        sa.Column("source_system", sa.String(length=50)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("alias_type", "normalized_alias_value", name="uq_vendor_alias_identity"),
        *_audit_cols(),
    )
    op.create_table(
        "customer_master",
        _id_col(),
        sa.Column("canonical_name", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("gstin", sa.String(length=15)),
        sa.Column("pan", sa.String(length=10)),
        sa.Column("zoho_contact_id", sa.String(length=50)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("canonical_name", name="uq_customer_master_canonical_name"),
        *_audit_cols(),
    )
    op.create_table(
        "account_master",
        _id_col(),
        sa.Column("account_code", sa.String(length=50), nullable=False),
        sa.Column("account_name", sa.Text(), nullable=False),
        sa.Column("account_type", sa.String(length=30), nullable=False),
        sa.Column("subtype", sa.String(length=50)),
        sa.Column("normal_balance", sa.String(length=6), nullable=False),
        sa.Column("is_control_account", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("zoho_account_id", sa.String(length=50)),
        sa.Column("gst_treatment_hint", sa.String(length=30)),
        sa.Column("is_postable", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("account_code", name="uq_account_master_account_code"),
        *_audit_cols(),
    )
    op.create_table(
        "rule_version",
        _id_col(),
        sa.Column("rulebook_name", sa.String(length=50), nullable=False),
        sa.Column("version_code", sa.String(length=30), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("published_by", sa.String(length=100), nullable=False),
        sa.Column("change_summary", sa.Text(), nullable=False),
        sa.Column("rules_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("version_code", name="uq_rule_version_version_code"),
        *_audit_cols(),
    )
    op.create_table(
        "source_document",
        _id_col(),
        sa.Column("fiscal_year_id", sa.Uuid(), sa.ForeignKey("fiscal_year.id")),
        sa.Column("source_system", sa.String(length=50), nullable=False),
        sa.Column("document_type", sa.String(length=50), nullable=False),
        sa.Column("source_document_ref", sa.String(length=255)),
        sa.Column("original_filename", sa.Text(), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("document_sha256", sa.String(length=64), nullable=False),
        sa.Column("ingest_batch_key", sa.String(length=100), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_account_ref", sa.String(length=100)),
        sa.Column("confidentiality_level", sa.String(length=20), nullable=False, server_default="restricted"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("supersedes_document_id", sa.Uuid(), sa.ForeignKey("source_document.id")),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("document_sha256", name="uq_source_document_document_sha256"),
        *_audit_cols(),
    )
    op.create_table(
        "source_record",
        _id_col(),
        sa.Column("source_document_id", sa.Uuid(), sa.ForeignKey("source_document.id"), nullable=False),
        sa.Column("record_type", sa.String(length=50), nullable=False),
        sa.Column("source_row_number", sa.Integer()),
        sa.Column("record_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("extraction_version", sa.String(length=50), nullable=False),
        sa.Column("parse_status", sa.String(length=20), nullable=False),
        sa.Column("event_date", sa.Date()),
        sa.Column("amount", sa.Numeric(18, 2)),
        sa.Column("currency_code", sa.String(length=3), nullable=False, server_default="INR"),
        sa.Column("raw_payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("normalized_payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("quality_score", sa.Numeric(5, 4)),
        sa.Column("review_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("superseded_by_record_id", sa.Uuid(), sa.ForeignKey("source_record.id")),
        sa.UniqueConstraint("source_document_id", "record_fingerprint", "extraction_version", name="uq_source_record_lineage"),
        *_audit_cols(),
    )
    op.create_table(
        "bank_account",
        _id_col(),
        sa.Column("account_name", sa.Text(), nullable=False),
        sa.Column("account_mask", sa.String(length=50), nullable=False),
        sa.Column("bank_name", sa.String(length=100), nullable=False),
        sa.Column("ifsc_code", sa.String(length=20)),
        sa.Column("currency_code", sa.String(length=3), nullable=False, server_default="INR"),
        sa.Column("is_business_account", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("account_mask", name="uq_bank_account_account_mask"),
        *_audit_cols(),
    )
    op.create_table(
        "bank_transaction",
        _id_col(),
        sa.Column("source_record_id", sa.Uuid(), sa.ForeignKey("source_record.id"), nullable=False),
        sa.Column("bank_account_id", sa.Uuid(), sa.ForeignKey("bank_account.id"), nullable=False),
        sa.Column("bank_account_ref", sa.String(length=100), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("value_date", sa.Date()),
        sa.Column("direction", sa.String(length=6), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("signed_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency_code", sa.String(length=3), nullable=False, server_default="INR"),
        sa.Column("narration", sa.Text(), nullable=False),
        sa.Column("counterparty_name", sa.Text()),
        sa.Column("counterparty_fingerprint", sa.String(length=64)),
        sa.Column("bank_reference", sa.String(length=100)),
        sa.Column("channel", sa.String(length=30)),
        sa.Column("is_reconciled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("recon_status", sa.String(length=30), nullable=False, server_default="unmatched"),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("source_record_id", name="uq_bank_transaction_source_record_id"),
        sa.UniqueConstraint(
            "bank_account_ref",
            "transaction_date",
            "amount",
            "bank_reference",
            "counterparty_fingerprint",
            name="uq_bank_transaction_identity",
        ),
        *_audit_cols(),
    )
    op.create_table(
        "gst_purchase_line",
        _id_col(),
        sa.Column("source_record_id", sa.Uuid(), sa.ForeignKey("source_record.id"), nullable=False),
        sa.Column("supplier_gstin", sa.String(length=15), nullable=False),
        sa.Column("supplier_name", sa.String(), nullable=False),
        sa.Column("invoice_number", sa.String(length=100), nullable=False),
        sa.Column("invoice_date", sa.Date(), nullable=False),
        sa.Column("invoice_type", sa.String(length=30)),
        sa.Column("place_of_supply", sa.String(length=50)),
        sa.Column("taxable_value", sa.Numeric(18, 2), nullable=False),
        sa.Column("igst_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("cgst_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("sgst_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("cess_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("total_tax_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("itc_availability", sa.String(length=20)),
        sa.Column("filing_period", sa.String(length=7), nullable=False),
        sa.Column("vendor_master_id", sa.Uuid(), sa.ForeignKey("vendor_master.id")),
        sa.Column("match_status", sa.String(length=30), nullable=False, server_default="unmatched"),
        sa.UniqueConstraint("source_record_id", name="uq_gst_purchase_line_source_record_id"),
        sa.UniqueConstraint(
            "supplier_gstin", "invoice_number", "invoice_date", "taxable_value", "total_tax_amount", name="uq_gst_purchase"
        ),
        *_audit_cols(),
    )
    op.create_table(
        "tax_information_item",
        _id_col(),
        sa.Column("source_record_id", sa.Uuid(), sa.ForeignKey("source_record.id"), nullable=False),
        sa.Column("tax_system", sa.String(length=30), nullable=False),
        sa.Column("item_type", sa.String(length=40), nullable=False),
        sa.Column("authority_reference", sa.String(length=100)),
        sa.Column("item_date", sa.Date(), nullable=False),
        sa.Column("assessment_year_code", sa.String(length=9)),
        sa.Column("period_code", sa.String(length=20)),
        sa.Column("party_identifier", sa.String(length=50)),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("section_code", sa.String(length=20)),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("source_record_id", name="uq_tax_information_item_source_record_id"),
        sa.UniqueConstraint("tax_system", "item_type", "authority_reference", "item_date", "amount", name="uq_tax_item_identity"),
        *_audit_cols(),
    )
    for table_name, extra_cols in [
        (
            "zoho_snapshot_bill",
            [
                sa.Column("vendor_name", sa.Text(), nullable=False),
                sa.Column("vendor_id", sa.String(length=50), nullable=False),
                sa.Column("bill_number", sa.String(length=100), nullable=False),
                sa.Column("bill_date", sa.Date(), nullable=False),
                sa.Column("due_date", sa.Date()),
                sa.Column("currency_code", sa.String(length=3), nullable=False),
                sa.Column("total", sa.Numeric(18, 2), nullable=False),
                sa.Column("balance", sa.Numeric(18, 2), nullable=False),
                sa.Column("status", sa.String(length=30), nullable=False),
                sa.Column("reference_number", sa.String(length=100)),
            ],
        ),
        (
            "zoho_snapshot_vendor_payment",
            [
                sa.Column("payment_number", sa.String(length=100)),
                sa.Column("payment_date", sa.Date()),
                sa.Column("vendor_id", sa.String(length=50)),
                sa.Column("amount", sa.Numeric(18, 2)),
                sa.Column("unapplied_amount", sa.Numeric(18, 2)),
                sa.Column("reference_number", sa.String(length=100)),
            ],
        ),
        (
            "zoho_snapshot_expense",
            [
                sa.Column("expense_date", sa.Date()),
                sa.Column("paid_through_account_id", sa.String(length=50)),
                sa.Column("amount", sa.Numeric(18, 2)),
                sa.Column("reference_number", sa.String(length=100)),
                sa.Column("account_id", sa.String(length=50)),
            ],
        ),
        (
            "zoho_snapshot_journal",
            [
                sa.Column("journal_number", sa.String(length=100)),
                sa.Column("journal_date", sa.Date()),
                sa.Column("total", sa.Numeric(18, 2)),
                sa.Column("status", sa.String(length=30)),
            ],
        ),
        (
            "zoho_snapshot_contact",
            [
                sa.Column("contact_name", sa.Text()),
                sa.Column("contact_type", sa.String(length=20)),
                sa.Column("gstin", sa.String(length=15)),
                sa.Column("status", sa.String(length=20)),
            ],
        ),
        (
            "zoho_snapshot_chart_account",
            [
                sa.Column("account_name", sa.Text()),
                sa.Column("account_code", sa.String(length=50)),
                sa.Column("account_type", sa.String(length=30)),
                sa.Column("is_active", sa.Boolean()),
            ],
        ),
    ]:
        op.create_table(
            table_name,
            _id_col(),
            sa.Column("snapshot_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("snapshot_batch_key", sa.String(length=100), nullable=False),
            sa.Column("zoho_object_id", sa.String(length=50), nullable=False),
            sa.Column("is_deleted_in_zoho", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
            *extra_cols,
            *_audit_cols(),
        )
    op.create_table(
        "evidence_bundle",
        _id_col(),
        sa.Column("bundle_type", sa.String(length=40), nullable=False),
        sa.Column("bundle_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("primary_record_type", sa.String(length=50), nullable=False),
        sa.Column("primary_record_id", sa.String(length=36), nullable=False),
        sa.Column("evidence_summary", sa.Text(), nullable=False),
        sa.Column("confidence_score", sa.Numeric(5, 4)),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("bundle_fingerprint", name="uq_evidence_bundle_bundle_fingerprint"),
        *_audit_cols(),
    )
    op.create_table(
        "evidence_bundle_item",
        _id_col(),
        sa.Column("evidence_bundle_id", sa.Uuid(), sa.ForeignKey("evidence_bundle.id"), nullable=False),
        sa.Column("item_object_type", sa.String(length=50), nullable=False),
        sa.Column("item_object_id", sa.String(length=36), nullable=False),
        sa.Column("item_role", sa.String(length=30), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("notes", sa.Text()),
        sa.UniqueConstraint(
            "evidence_bundle_id", "item_object_type", "item_object_id", "item_role", name="uq_evidence_bundle_item_member"
        ),
        *_audit_cols(),
    )
    op.create_table(
        "match_candidate",
        _id_col(),
        sa.Column("evidence_bundle_id", sa.Uuid(), sa.ForeignKey("evidence_bundle.id"), nullable=False),
        sa.Column("from_object_type", sa.String(length=50), nullable=False),
        sa.Column("from_object_id", sa.String(length=36), nullable=False),
        sa.Column("to_object_type", sa.String(length=50), nullable=False),
        sa.Column("to_object_id", sa.String(length=36), nullable=False),
        sa.Column("match_layer", sa.String(length=20), nullable=False),
        sa.Column("rule_name", sa.String(length=100), nullable=False),
        sa.Column("score", sa.Numeric(5, 4), nullable=False),
        sa.Column("score_components", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("conflict_group_id", sa.String(length=64)),
        sa.Column("decision_status", sa.String(length=20), nullable=False, server_default="candidate"),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("evidence_refs", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint(
            "evidence_bundle_id",
            "from_object_type",
            "from_object_id",
            "to_object_type",
            "to_object_id",
            "rule_name",
            name="uq_match_candidate_identity",
        ),
        *_audit_cols(),
    )
    op.create_table(
        "classification_result",
        _id_col(),
        sa.Column("evidence_bundle_id", sa.Uuid(), sa.ForeignKey("evidence_bundle.id"), nullable=False),
        sa.Column("rule_version_id", sa.Uuid(), sa.ForeignKey("rule_version.id"), nullable=False),
        sa.Column("classification_type", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="proposed"),
        sa.Column("confidence_score", sa.Numeric(5, 4), nullable=False),
        sa.Column("materiality_amount", sa.Numeric(18, 2)),
        sa.Column("accounting_period_date", sa.Date(), nullable=False),
        sa.Column("decision_summary", sa.Text(), nullable=False),
        sa.Column("explanation_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("ai_assist_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("supersedes_classification_id", sa.Uuid(), sa.ForeignKey("classification_result.id")),
        *_audit_cols(),
    )
    op.create_table(
        "posting_proposal",
        _id_col(),
        sa.Column("classification_result_id", sa.Uuid(), sa.ForeignKey("classification_result.id"), nullable=False),
        sa.Column("generated_from_classification_id", sa.Uuid(), sa.ForeignKey("classification_result.id"), nullable=False),
        sa.Column("rule_version_id", sa.Uuid(), sa.ForeignKey("rule_version.id"), nullable=False),
        sa.Column("proposal_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("input_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("proposal_type", sa.String(length=40), nullable=False),
        sa.Column("proposal_mode", sa.String(length=20), nullable=False, server_default="review_only"),
        sa.Column("target_system", sa.String(length=20), nullable=False, server_default="zoho_books"),
        sa.Column("target_period_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("currency_code", sa.String(length=3), nullable=False, server_default="INR"),
        sa.Column("gross_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("narrative", sa.Text(), nullable=False),
        sa.Column("has_blocking_lines", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("unresolved_review_item_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("policy_flags", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("supersedes_proposal_id", sa.Uuid(), sa.ForeignKey("posting_proposal.id")),
        sa.Column("superseded_by_proposal_id", sa.Uuid(), sa.ForeignKey("posting_proposal.id")),
        sa.Column("supersession_reason", sa.Text()),
        sa.UniqueConstraint("proposal_fingerprint", name="uq_posting_proposal_proposal_fingerprint"),
        *_audit_cols(),
    )
    op.create_table(
        "posting_proposal_line",
        _id_col(),
        sa.Column("posting_proposal_id", sa.Uuid(), sa.ForeignKey("posting_proposal.id"), nullable=False),
        sa.Column("line_no", sa.Integer(), nullable=False),
        sa.Column("action_type", sa.String(length=40), nullable=False),
        sa.Column("account_master_id", sa.Uuid(), sa.ForeignKey("account_master.id")),
        sa.Column("vendor_master_id", sa.Uuid(), sa.ForeignKey("vendor_master.id")),
        sa.Column("zoho_target_object_type", sa.String(length=40)),
        sa.Column("zoho_target_object_ref", sa.String(length=100)),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 4)),
        sa.Column("rate", sa.Numeric(18, 2)),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("tax_code", sa.String(length=50)),
        sa.Column("review_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("review_reason_code", sa.String(length=50)),
        sa.Column("is_blocking", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("resolved_by_user", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("allocation_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("posting_proposal_id", "line_no", name="uq_posting_proposal_line_order"),
        *_audit_cols(),
    )
    op.create_table(
        "exception_case",
        _id_col(),
        sa.Column("exception_type", sa.String(length=50), nullable=False),
        sa.Column("conflict_type", sa.String(length=50)),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("bundle_id", sa.Uuid(), sa.ForeignKey("evidence_bundle.id")),
        sa.Column("classification_result_id", sa.Uuid(), sa.ForeignKey("classification_result.id")),
        sa.Column("posting_proposal_id", sa.Uuid(), sa.ForeignKey("posting_proposal.id")),
        # sa.Column("approval_decision_id", sa.Uuid(), sa.ForeignKey("approval_decision.id")),
        sa.Column("related_object_type", sa.String(length=50), nullable=False),
        sa.Column("related_object_id", sa.String(length=36), nullable=False),
        sa.Column("fiscal_year_id", sa.Uuid(), sa.ForeignKey("fiscal_year.id")),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("details_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("assigned_to", sa.String(length=100)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("resolution_note", sa.Text()),
        *_audit_cols(),
    )
    op.create_table(
        "approval_decision",
        _id_col(),
        sa.Column("posting_proposal_id", sa.Uuid(), sa.ForeignKey("posting_proposal.id"), nullable=False),
        sa.Column("classification_result_id", sa.Uuid(), sa.ForeignKey("classification_result.id")),
        sa.Column("exception_case_id", sa.Uuid(), sa.ForeignKey("exception_case.id")),
        sa.Column("decision", sa.String(length=25), nullable=False),
        sa.Column("decision_by", sa.String(length=100), nullable=False),
        sa.Column("decision_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason_code", sa.String(length=50)),
        sa.Column("comment_text", sa.Text()),
        sa.Column("edited_payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_final", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_audit_cols(),
    )
    op.create_table(
        "zoho_posting_receipt",
        _id_col(),
        sa.Column("posting_proposal_id", sa.Uuid(), sa.ForeignKey("posting_proposal.id"), nullable=False),
        sa.Column("approval_decision_id", sa.Uuid(), sa.ForeignKey("approval_decision.id")),
        sa.Column("posting_mode", sa.String(length=20), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("target_object_type", sa.String(length=40), nullable=False),
        sa.Column("target_external_id", sa.String(length=100)),
        sa.Column("target_external_number", sa.String(length=100)),
        sa.Column("posting_status", sa.String(length=20), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True)),
        sa.Column("response_code", sa.String(length=20)),
        sa.Column("response_payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("reversal_of_receipt_id", sa.Uuid(), sa.ForeignKey("zoho_posting_receipt.id")),
        sa.UniqueConstraint("idempotency_key", name="uq_zoho_posting_receipt_idempotency_key"),
        *_audit_cols(),
    )
    
    op.create_table(
        "audit_event",
        _id_col(),
        sa.Column("event_ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("actor_type", sa.String(length=20), nullable=False),
        sa.Column("actor_id", sa.String(length=100), nullable=False),
        sa.Column("object_type", sa.String(length=50), nullable=False),
        sa.Column("object_id", sa.String(length=36), nullable=False),
        sa.Column("correlation_id", sa.String(length=100), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128)),
        sa.Column("before_state_json", sa.JSON()),
        sa.Column("after_state_json", sa.JSON()),
        sa.Column("event_detail_json", sa.JSON(), nullable=False, server_default="{}"),
        *_audit_cols(),
    )

    _create_indexes()


def _create_indexes() -> None:
    op.create_index("ix_source_document_source_system", "source_document", ["source_system"])
    op.create_index("ix_source_document_document_type", "source_document", ["document_type"])
    op.create_index("ix_source_document_ingest_batch_key", "source_document", ["ingest_batch_key"])
    op.create_index("ix_source_record_record_type", "source_record", ["record_type"])
    op.create_index("ix_source_record_record_fingerprint", "source_record", ["record_fingerprint"])
    op.create_index("ix_bank_transaction_lookup", "bank_transaction", ["transaction_date", "amount", "bank_reference"])
    op.create_index("ix_gst_purchase_line_invoice", "gst_purchase_line", ["supplier_gstin", "invoice_number", "invoice_date"])
    op.create_index("ix_tax_information_item_ref_date", "tax_information_item", ["authority_reference", "item_date"])
    for table_name in (
        "zoho_snapshot_bill",
        "zoho_snapshot_vendor_payment",
        "zoho_snapshot_expense",
        "zoho_snapshot_journal",
        "zoho_snapshot_contact",
        "zoho_snapshot_chart_account",
    ):
        op.create_index(f"ix_{table_name}_batch_object", table_name, ["snapshot_batch_key", "zoho_object_id"], unique=True)
    op.create_index("ix_match_candidate_bundle_status", "match_candidate", ["evidence_bundle_id", "decision_status"])
    op.create_index("ix_classification_result_type_status", "classification_result", ["classification_type", "status"])
    op.create_index("ix_posting_proposal_status_period", "posting_proposal", ["status", "target_period_date"])
    op.create_index("ix_exception_case_queue", "exception_case", ["status", "severity", "exception_type"])
    op.create_index("ix_vendor_alias_lookup", "vendor_alias", ["alias_type", "normalized_alias_value"])
    op.create_index("ix_audit_event_correlation_ts", "audit_event", ["correlation_id", "event_ts"])


def downgrade() -> None:
    for index_name in (
        "ix_audit_event_correlation_ts",
        "ix_exception_case_queue",
        "ix_posting_proposal_status_period",
        "ix_classification_result_type_status",
        "ix_match_candidate_bundle_status",
        "ix_zoho_snapshot_chart_account_batch_object",
        "ix_zoho_snapshot_contact_batch_object",
        "ix_zoho_snapshot_journal_batch_object",
        "ix_zoho_snapshot_expense_batch_object",
        "ix_zoho_snapshot_vendor_payment_batch_object",
        "ix_zoho_snapshot_bill_batch_object",
        "ix_tax_information_item_ref_date",
        "ix_gst_purchase_line_invoice",
        "ix_bank_transaction_lookup",
        "ix_source_record_record_fingerprint",
        "ix_source_record_record_type",
        "ix_source_document_ingest_batch_key",
        "ix_source_document_document_type",
        "ix_source_document_source_system",
    ):
        op.drop_index(index_name)

    for table_name in (
        "audit_event",
        "exception_case",
        "zoho_posting_receipt",
        "approval_decision",
        "posting_proposal_line",
        "posting_proposal",
        "classification_result",
        "match_candidate",
        "evidence_bundle_item",
        "evidence_bundle",
        "vendor_alias",
        "zoho_snapshot_chart_account",
        "zoho_snapshot_contact",
        "zoho_snapshot_journal",
        "zoho_snapshot_expense",
        "zoho_snapshot_vendor_payment",
        "zoho_snapshot_bill",
        "tax_information_item",
        "gst_purchase_line",
        "bank_transaction",
        "bank_account",
        "source_record",
        "source_document",
        "rule_version",
        "account_master",
        "customer_master",
        "vendor_master",
        "period_lock",
        "fiscal_year",
    ):
        op.drop_table(table_name)
