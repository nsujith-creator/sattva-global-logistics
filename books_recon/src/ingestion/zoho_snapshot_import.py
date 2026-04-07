"""Zoho read-side snapshot persistence."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.hashing import stable_payload_hash
from db.models.evidence import SourceDocument, SourceRecord
from db.models.zoho import (
    ZohoSnapshotBill,
    ZohoSnapshotChartAccount,
    ZohoSnapshotContact,
    ZohoSnapshotExpense,
    ZohoSnapshotJournal,
    ZohoSnapshotVendorPayment,
)
from db.repositories.source import SourceRecordRepository


SNAPSHOT_MODEL_MAP = {
    "bill": ZohoSnapshotBill,
    "vendor_payment": ZohoSnapshotVendorPayment,
    "expense": ZohoSnapshotExpense,
    "journal": ZohoSnapshotJournal,
    "contact": ZohoSnapshotContact,
    "chart_account": ZohoSnapshotChartAccount,
}


class ZohoSnapshotImportService:
    extraction_version = "zoho_snapshot_v1"

    def __init__(self, session: Session, source_record_repository: SourceRecordRepository) -> None:
        self.session = session
        self.source_record_repository = source_record_repository

    def import_rows(
        self,
        snapshot_type: str,
        rows: list[dict],
        *,
        snapshot_batch_key: str,
        source_document: SourceDocument | None = None,
        snapshot_at: datetime | None = None,
    ) -> dict[str, int]:
        model = SNAPSHOT_MODEL_MAP[snapshot_type]
        snapshot_at = snapshot_at or datetime.now(timezone.utc)
        created_records = 0
        created_snapshots = 0

        for row_number, row in enumerate(rows, start=1):
            zoho_object_id = self._extract_object_id(row)
            record = None
            if source_document is not None:
                record = SourceRecord(
                    source_document_id=source_document.id,
                    record_type=f"zoho_snapshot_{snapshot_type}",
                    source_row_number=row_number,
                    record_fingerprint=stable_payload_hash({"snapshot_type": snapshot_type, "zoho_object_id": zoho_object_id}),
                    extraction_version=self.extraction_version,
                    parse_status="parsed",
                    raw_payload=row,
                    normalized_payload={"snapshot_type": snapshot_type, "zoho_object_id": zoho_object_id},
                    review_required=False,
                    quality_score=1,
                )
                persisted_record = self.source_record_repository.upsert_by_lineage(record)
                if persisted_record is record:
                    created_records += 1

            snapshot = self._build_snapshot(model, row, snapshot_batch_key=snapshot_batch_key, snapshot_at=snapshot_at)
            existing = self.session.scalar(
                select(model).where(model.snapshot_batch_key == snapshot_batch_key, model.zoho_object_id == snapshot.zoho_object_id)
            )
            if existing is None:
                self.session.add(snapshot)
                created_snapshots += 1

        return {
            "rows_seen": len(rows),
            "source_records_created": created_records,
            "snapshots_created": created_snapshots,
        }

    def _extract_object_id(self, row: dict) -> str:
        for candidate in ("bill_id", "vendor_payment_id", "expense_id", "journal_id", "contact_id", "account_id", "zoho_object_id"):
            if row.get(candidate):
                return str(row[candidate])
        raise ValueError("Zoho snapshot row does not contain a supported object id field.")

    def _build_snapshot(self, model, row: dict, *, snapshot_batch_key: str, snapshot_at: datetime):
        common = {
            "snapshot_at": snapshot_at,
            "snapshot_batch_key": snapshot_batch_key,
            "zoho_object_id": self._extract_object_id(row),
            "is_deleted_in_zoho": bool(row.get("is_deleted_in_zoho", False)),
            "payload": row,
        }
        if model is ZohoSnapshotBill:
            return model(
                **common,
                vendor_name=row.get("vendor_name", ""),
                vendor_id=str(row.get("vendor_id", "")),
                bill_number=row.get("bill_number", ""),
                bill_date=self._required_date(row.get("bill_date") or row.get("date"), field_name="bill_date"),
                due_date=self._optional_date(row.get("due_date")),
                currency_code=row.get("currency_code", "INR"),
                total=row.get("total", 0),
                balance=row.get("balance", 0),
                status=row.get("status", ""),
                reference_number=row.get("reference_number"),
            )
        if model is ZohoSnapshotVendorPayment:
            return model(
                **common,
                payment_number=row.get("payment_number"),
                payment_date=self._optional_date(row.get("payment_date")),
                vendor_id=str(row.get("vendor_id", "")) if row.get("vendor_id") else None,
                amount=row.get("amount"),
                unapplied_amount=row.get("unapplied_amount"),
                reference_number=row.get("reference_number"),
            )
        if model is ZohoSnapshotExpense:
            return model(
                **common,
                expense_date=self._optional_date(row.get("expense_date")),
                paid_through_account_id=row.get("paid_through_account_id"),
                amount=row.get("amount"),
                reference_number=row.get("reference_number"),
                account_id=row.get("account_id"),
            )
        if model is ZohoSnapshotJournal:
            return model(
                **common,
                journal_number=row.get("journal_number"),
                journal_date=self._optional_date(row.get("journal_date")),
                total=row.get("total"),
                status=row.get("status"),
            )
        if model is ZohoSnapshotContact:
            return model(
                **common,
                contact_name=row.get("contact_name"),
                contact_type=row.get("contact_type"),
                gstin=row.get("gstin"),
                status=row.get("status"),
            )
        if model is ZohoSnapshotChartAccount:
            return model(
                **common,
                account_name=row.get("account_name"),
                account_code=row.get("account_code"),
                account_type=row.get("account_type"),
                is_active=row.get("is_active"),
            )
        raise ValueError(f"Unsupported snapshot model: {model}")

    def _optional_date(self, value):
        if not value:
            return None
        if isinstance(value, datetime):
            return value.date()
        return datetime.fromisoformat(str(value)).date()

    def _required_date(self, value, *, field_name: str):
        parsed = self._optional_date(value)
        if parsed is None:
            raise ValueError(f"Zoho snapshot row is missing required date field {field_name}.")
        return parsed
