"""Repository scaffolding and eligibility controls for Zoho snapshot tables."""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any

from sqlalchemy import select

from db.models.evidence import SourceDocument, SourceRecord
from db.models.zoho import (
    ZohoSnapshotBill,
    ZohoSnapshotChartAccount,
    ZohoSnapshotContact,
    ZohoSnapshotExpense,
    ZohoSnapshotJournal,
    ZohoSnapshotVendorPayment,
)
from db.repositories.base import BaseRepository


SNAPSHOT_MODEL_MAP = {
    "bill": ZohoSnapshotBill,
    "vendor_payment": ZohoSnapshotVendorPayment,
    "expense": ZohoSnapshotExpense,
    "journal": ZohoSnapshotJournal,
    "contact": ZohoSnapshotContact,
    "chart_account": ZohoSnapshotChartAccount,
}

SNAPSHOT_DOCUMENT_TYPE_MAP = {
    "bill": "zoho_snapshot_bills_json",
    "vendor_payment": "zoho_snapshot_vendor_payments_json",
    "expense": "zoho_snapshot_expenses_json",
    "journal": "zoho_snapshot_journals_json",
    "contact": "zoho_snapshot_contacts_json",
    "chart_account": "zoho_snapshot_chart_accounts_json",
}

SNAPSHOT_RECORD_TYPE_MAP = {
    "bill": "zoho_snapshot_bill",
    "vendor_payment": "zoho_snapshot_vendor_payment",
    "expense": "zoho_snapshot_expense",
    "journal": "zoho_snapshot_journal",
    "contact": "zoho_snapshot_contact",
    "chart_account": "zoho_snapshot_chart_account",
}

SYNTHETIC_PATTERNS = (
    re.compile(r"phase2c", re.IGNORECASE),
    re.compile(r"bill-phase2c-", re.IGNORECASE),
    re.compile(r"zoho-vendor-phase2c-", re.IGNORECASE),
    re.compile(r"zoho-paid-phase2c-", re.IGNORECASE),
)


@dataclass(frozen=True)
class ZohoSnapshotEligibility:
    snapshot_type: str
    zoho_object_id: str
    snapshot_batch_key: str | None
    latest_batch_key: str | None
    has_lineage: bool
    is_latest_batch: bool
    is_deleted: bool
    is_synthetic: bool
    reasons: list[str]
    snapshot_row_id: str | None = None

    @property
    def is_eligible(self) -> bool:
        return not self.reasons


class ZohoSnapshotRepository(BaseRepository[ZohoSnapshotBill]):
    model = ZohoSnapshotBill

    def __init__(self, session) -> None:
        super().__init__(session)
        self._latest_batch_cache: dict[str, str | None] = {}
        self._lineage_cache: dict[tuple[str, str], set[str]] = {}

    def latest_bills_by_vendor(self, vendor_id: str) -> list[ZohoSnapshotBill]:
        stmt = select(ZohoSnapshotBill).where(ZohoSnapshotBill.vendor_id == vendor_id)
        return [
            bill
            for bill in self.session.scalars(stmt)
            if self.evaluate_instance("bill", bill).is_eligible
        ]

    def upsert_snapshot(self, instance: ZohoSnapshotBill) -> ZohoSnapshotBill:
        existing = self.session.scalar(
            select(ZohoSnapshotBill).where(
                ZohoSnapshotBill.snapshot_batch_key == instance.snapshot_batch_key,
                ZohoSnapshotBill.zoho_object_id == instance.zoho_object_id,
            )
        )
        if existing:
            return existing
        return self.add(instance)

    def latest_successful_batch_key(self, snapshot_type: str) -> str | None:
        if snapshot_type not in self._latest_batch_cache:
            document_type = SNAPSHOT_DOCUMENT_TYPE_MAP[snapshot_type]
            stmt = (
                select(SourceDocument.ingest_batch_key)
                .where(
                    SourceDocument.source_system == "zoho_sandbox",
                    SourceDocument.document_type == document_type,
                    SourceDocument.is_active.is_(True),
                )
                .order_by(SourceDocument.ingested_at.desc(), SourceDocument.created_at.desc())
            )
            self._latest_batch_cache[snapshot_type] = self.session.scalar(stmt)
        return self._latest_batch_cache[snapshot_type]

    def list_eligible(self, snapshot_type: str) -> list[Any]:
        latest_batch_key = self.latest_successful_batch_key(snapshot_type)
        if latest_batch_key is None:
            return []
        model = SNAPSHOT_MODEL_MAP[snapshot_type]
        stmt = (
            select(model)
            .where(model.snapshot_batch_key == latest_batch_key)
            .order_by(model.created_at.asc(), model.id.asc())
        )
        return [
            row
            for row in self.session.scalars(stmt)
            if self.evaluate_instance(snapshot_type, row, latest_batch_key=latest_batch_key).is_eligible
        ]

    def resolve_eligible(self, snapshot_type: str, zoho_object_id: str):
        latest_batch_key = self.latest_successful_batch_key(snapshot_type)
        if latest_batch_key is None:
            return None
        model = SNAPSHOT_MODEL_MAP[snapshot_type]
        stmt = (
            select(model)
            .where(
                model.snapshot_batch_key == latest_batch_key,
                model.zoho_object_id == str(zoho_object_id),
            )
            .order_by(model.created_at.desc(), model.id.desc())
        )
        row = self.session.scalar(stmt)
        if row is None:
            return None
        return row if self.evaluate_instance(snapshot_type, row, latest_batch_key=latest_batch_key).is_eligible else None

    def evaluate_ref(self, snapshot_type: str, zoho_object_id: str | None) -> ZohoSnapshotEligibility:
        if not zoho_object_id:
            return ZohoSnapshotEligibility(
                snapshot_type=snapshot_type,
                zoho_object_id="",
                snapshot_batch_key=None,
                latest_batch_key=self.latest_successful_batch_key(snapshot_type),
                has_lineage=False,
                is_latest_batch=False,
                is_deleted=False,
                is_synthetic=False,
                reasons=["missing zoho target object ref"],
            )
        model = SNAPSHOT_MODEL_MAP[snapshot_type]
        stmt = (
            select(model)
            .where(model.zoho_object_id == str(zoho_object_id))
            .order_by(model.snapshot_at.desc(), model.created_at.desc())
        )
        rows = list(self.session.scalars(stmt))
        if not rows:
            return ZohoSnapshotEligibility(
                snapshot_type=snapshot_type,
                zoho_object_id=str(zoho_object_id),
                snapshot_batch_key=None,
                latest_batch_key=self.latest_successful_batch_key(snapshot_type),
                has_lineage=False,
                is_latest_batch=False,
                is_deleted=False,
                is_synthetic=self.is_synthetic_identifier(str(zoho_object_id)),
                reasons=["zoho target object not found in snapshot table"],
            )

        latest_batch_key = self.latest_successful_batch_key(snapshot_type)
        preferred = next((row for row in rows if row.snapshot_batch_key == latest_batch_key), rows[0])
        return self.evaluate_instance(snapshot_type, preferred, latest_batch_key=latest_batch_key)

    def evaluate_instance(self, snapshot_type: str, row, *, latest_batch_key: str | None = None) -> ZohoSnapshotEligibility:
        latest_batch_key = latest_batch_key if latest_batch_key is not None else self.latest_successful_batch_key(snapshot_type)
        reasons: list[str] = []
        if latest_batch_key is None:
            reasons.append("no successful zoho snapshot batch available")

        row_batch_key = getattr(row, "snapshot_batch_key", None)
        if latest_batch_key is not None and row_batch_key != latest_batch_key:
            reasons.append(f"zoho target is not from latest successful batch {latest_batch_key}")

        is_deleted = bool(getattr(row, "is_deleted_in_zoho", False))
        if is_deleted:
            reasons.append("zoho target is marked deleted in zoho")

        is_synthetic = self._row_is_synthetic(row)
        if is_synthetic:
            reasons.append("zoho target matches synthetic id quarantine rules")

        has_lineage = False
        if row_batch_key:
            has_lineage = str(getattr(row, "zoho_object_id")) in self._lineage_object_ids(snapshot_type, row_batch_key)
        if not has_lineage:
            reasons.append("zoho target is missing evidence lineage")

        return ZohoSnapshotEligibility(
            snapshot_type=snapshot_type,
            zoho_object_id=str(getattr(row, "zoho_object_id")),
            snapshot_batch_key=row_batch_key,
            latest_batch_key=latest_batch_key,
            has_lineage=has_lineage,
            is_latest_batch=latest_batch_key is not None and row_batch_key == latest_batch_key,
            is_deleted=is_deleted,
            is_synthetic=is_synthetic,
            reasons=reasons,
            snapshot_row_id=str(getattr(row, "id", "")) or None,
        )

    def is_synthetic_identifier(self, value: str | None) -> bool:
        if not value:
            return False
        return any(pattern.search(str(value)) for pattern in SYNTHETIC_PATTERNS)

    def _lineage_object_ids(self, snapshot_type: str, batch_key: str) -> set[str]:
        cache_key = (snapshot_type, batch_key)
        if cache_key not in self._lineage_cache:
            record_type = SNAPSHOT_RECORD_TYPE_MAP[snapshot_type]
            document_type = SNAPSHOT_DOCUMENT_TYPE_MAP[snapshot_type]
            stmt = (
                select(SourceRecord.normalized_payload)
                .join(SourceDocument, SourceRecord.source_document_id == SourceDocument.id)
                .where(
                    SourceDocument.source_system == "zoho_sandbox",
                    SourceDocument.document_type == document_type,
                    SourceDocument.ingest_batch_key == batch_key,
                    SourceDocument.is_active.is_(True),
                    SourceRecord.record_type == record_type,
                )
            )
            object_ids: set[str] = set()
            for payload in self.session.scalars(stmt):
                if isinstance(payload, dict) and payload.get("zoho_object_id"):
                    object_ids.add(str(payload["zoho_object_id"]))
            self._lineage_cache[cache_key] = object_ids
        return self._lineage_cache[cache_key]

    def _row_is_synthetic(self, row) -> bool:
        fields = [
            getattr(row, "snapshot_batch_key", None),
            getattr(row, "zoho_object_id", None),
            getattr(row, "vendor_id", None),
            getattr(row, "reference_number", None),
            getattr(row, "bill_number", None),
            getattr(row, "contact_name", None),
            getattr(row, "account_name", None),
        ]
        return any(self.is_synthetic_identifier(value) for value in fields)
