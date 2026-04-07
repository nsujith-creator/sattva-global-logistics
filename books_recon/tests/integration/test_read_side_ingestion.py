"""Read-side ingestion tests using in-memory SQLite as the local harness."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from core.config import get_settings
from db.base import Base
from db.models.banking import BankTransaction
from db.models.evidence import SourceDocument, SourceRecord
from db.models.tax import GstPurchaseLine
from db.models.zoho import ZohoSnapshotBill
from db.repositories.bank import BankTransactionRepository
from db.repositories.gst import GstPurchaseLineRepository
from db.repositories.source import SourceDocumentRepository, SourceRecordRepository
from ingestion.bank_import import BankImportService
from ingestion.file_ingestion import FileEvidenceIngestionService
from ingestion.gstr2b_import import Gstr2BImportService
from ingestion.zoho_snapshot_import import ZohoSnapshotImportService
from connectors.bank.file_importer import BankFileImportAdapter
from connectors.gst.gstr2b_importer import Gstr2BManualImportAdapter
from connectors.zoho.snapshot_reader import ZohoSnapshotReadAdapter


def _session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    return Session(engine)


def test_file_ingestion_idempotency(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("BOOKS_RECON_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("BOOKS_RECON_EVIDENCE_ROOT", str(tmp_path / "raw"))
    monkeypatch.setenv("BOOKS_RECON_STAGED_ROOT", str(tmp_path / "staged"))
    monkeypatch.setenv("BOOKS_RECON_EXPORT_ROOT", str(tmp_path / "exports"))
    get_settings.cache_clear()

    sample = tmp_path / "bank.csv"
    sample.write_text("Date,Narration,Debit,Credit\n2025-04-01,Test,100,,\n", encoding="utf-8")

    session = _session()
    repo = SourceDocumentRepository(session)
    service = FileEvidenceIngestionService(repo)

    first = service.ingest_file(sample, source_system="bank", document_type="bank_csv", ingest_batch_key="batch-1")
    second = service.ingest_file(sample, source_system="bank", document_type="bank_csv", ingest_batch_key="batch-1")

    assert first.was_duplicate is False
    assert second.was_duplicate is True
    assert first.source_document.id == second.source_document.id


def test_bank_import_persistence() -> None:
    session = _session()
    fixture = Path(__file__).resolve().parents[1] / "fixtures" / "sample_bank_statement.csv"
    now = datetime.now(timezone.utc)

    source_document = SourceDocument(
        source_system="bank",
        document_type="bank_csv",
        original_filename=fixture.name,
        storage_path=str(fixture),
        mime_type="text/csv",
        file_size_bytes=fixture.stat().st_size,
        document_sha256="bank-doc-1",
        ingest_batch_key="batch-bank",
        captured_at=now,
        ingested_at=now,
        metadata_json={},
    )
    session.add(source_document)
    session.flush()

    rows = BankFileImportAdapter().import_file(fixture)
    result = BankImportService(session, SourceRecordRepository(session), BankTransactionRepository(session)).persist_rows(
        source_document, rows
    )
    session.commit()

    assert result["rows_seen"] == 2
    assert session.scalar(select(sa.func.count()).select_from(SourceRecord)) == 2
    assert session.scalar(select(sa.func.count()).select_from(BankTransaction)) == 2


def test_gstr2b_import_persistence() -> None:
    session = _session()
    fixture = Path(__file__).resolve().parents[1] / "fixtures" / "sample_gstr2b.csv"
    now = datetime.now(timezone.utc)

    source_document = SourceDocument(
        source_system="gst_2b",
        document_type="gstr2b_csv",
        original_filename=fixture.name,
        storage_path=str(fixture),
        mime_type="text/csv",
        file_size_bytes=fixture.stat().st_size,
        document_sha256="gst-doc-1",
        ingest_batch_key="batch-gst",
        captured_at=now,
        ingested_at=now,
        metadata_json={},
    )
    session.add(source_document)
    session.flush()

    rows = Gstr2BManualImportAdapter().import_file(fixture)
    result = Gstr2BImportService(SourceRecordRepository(session), GstPurchaseLineRepository(session)).persist_rows(
        source_document, rows
    )
    session.commit()

    assert result["rows_seen"] == 1
    assert session.scalar(select(sa.func.count()).select_from(GstPurchaseLine)) == 1


def test_zoho_snapshot_persistence() -> None:
    session = _session()
    fixture = Path(__file__).resolve().parents[1] / "fixtures" / "sample_zoho_bills.json"
    now = datetime.now(timezone.utc)

    source_document = SourceDocument(
        source_system="zoho",
        document_type="zoho_snapshot_json",
        original_filename=fixture.name,
        storage_path=str(fixture),
        mime_type="application/json",
        file_size_bytes=fixture.stat().st_size,
        document_sha256="zoho-doc-1",
        ingest_batch_key="batch-zoho",
        captured_at=now,
        ingested_at=now,
        metadata_json={},
    )
    session.add(source_document)
    session.flush()

    rows = ZohoSnapshotReadAdapter().load_snapshot_file(fixture)
    result = ZohoSnapshotImportService(session, SourceRecordRepository(session)).import_rows(
        "bill",
        rows,
        snapshot_batch_key="zoho-batch-1",
        source_document=source_document,
    )
    session.commit()

    assert result["rows_seen"] == 1
    assert session.scalar(select(sa.func.count()).select_from(ZohoSnapshotBill)) == 1
    assert session.scalar(select(sa.func.count()).select_from(SourceRecord)) == 1
