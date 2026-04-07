"""Model import and metadata smoke tests."""

from db.base import Base
import db.models  # noqa: F401


def test_metadata_contains_key_tables() -> None:
    expected = {
        "fiscal_year",
        "period_lock",
        "source_document",
        "source_record",
        "bank_account",
        "bank_transaction",
        "gst_purchase_line",
        "tax_information_item",
        "vendor_alias",
        "evidence_bundle",
        "evidence_bundle_item",
        "match_candidate",
        "classification_result",
        "exception_case",
        "posting_proposal",
        "proposal_revision",
        "proposal_line_revision",
        "dry_run_execution_artifact",
        "zoho_posting_receipt",
    }
    assert expected.issubset(set(Base.metadata.tables))
