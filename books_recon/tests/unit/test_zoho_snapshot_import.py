from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from db.base import Base
from db.models.evidence import SourceDocument, SourceRecord
from db.models.zoho import ZohoSnapshotBill
from db.repositories.source import SourceRecordRepository
from ingestion.zoho_snapshot_import import ZohoSnapshotImportService


def _session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    return Session(engine)


def test_bill_import_accepts_zoho_date_field_as_bill_date() -> None:
    session = _session()
    now = datetime.now(timezone.utc)
    source_document = SourceDocument(
        source_system="zoho_sandbox",
        document_type="zoho_snapshot_bills_json",
        original_filename="bills.json",
        storage_path="bills.json",
        mime_type="application/json",
        file_size_bytes=1,
        document_sha256="doc-1",
        ingest_batch_key="batch-1",
        captured_at=now,
        ingested_at=now,
        metadata_json={},
    )
    session.add(source_document)
    session.flush()

    service = ZohoSnapshotImportService(session, SourceRecordRepository(session))
    result = service.import_rows(
        "bill",
        [
            {
                "bill_id": "914109000001297003",
                "vendor_name": "TOTAL TRANSPORT SYSTEMS LIMITED",
                "vendor_id": "914109000000631001",
                "bill_number": "8527-260304006",
                "date": "2026-03-29",
                "due_date": "2026-05-13",
                "currency_code": "INR",
                "total": 325130.06,
                "balance": 325130.06,
                "status": "open",
                "reference_number": "FOLKINBOM008950",
            }
        ],
        snapshot_batch_key="batch-1",
        source_document=source_document,
    )
    session.commit()

    bill = session.scalar(select(ZohoSnapshotBill))
    assert result["rows_seen"] == 1
    assert bill is not None
    assert str(bill.bill_date) == "2026-03-29"
    assert session.scalar(select(SourceRecord)) is not None
