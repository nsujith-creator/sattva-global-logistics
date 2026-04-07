"""Repository upsert behavior tests."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from db.base import Base
from db.models.evidence import SourceDocument, SourceRecord
from db.repositories.source import SourceDocumentRepository, SourceRecordRepository


def _session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    return Session(engine)


def test_source_document_upsert_by_sha256() -> None:
    session = _session()
    repo = SourceDocumentRepository(session)
    now = datetime.now(timezone.utc)
    doc = SourceDocument(
        source_system="bank",
        document_type="bank_csv",
        original_filename="sample.csv",
        storage_path="/tmp/sample.csv",
        mime_type="text/csv",
        file_size_bytes=10,
        document_sha256="same-hash",
        ingest_batch_key="batch",
        captured_at=now,
        ingested_at=now,
        metadata_json={},
    )
    same = SourceDocument(
        source_system="bank",
        document_type="bank_csv",
        original_filename="sample-copy.csv",
        storage_path="/tmp/sample-copy.csv",
        mime_type="text/csv",
        file_size_bytes=10,
        document_sha256="same-hash",
        ingest_batch_key="batch",
        captured_at=now,
        ingested_at=now,
        metadata_json={},
    )
    first = repo.upsert_by_sha256(doc)
    session.flush()
    second = repo.upsert_by_sha256(same)
    assert first.id == second.id


def test_source_record_upsert_by_lineage() -> None:
    session = _session()
    doc_repo = SourceDocumentRepository(session)
    record_repo = SourceRecordRepository(session)
    now = datetime.now(timezone.utc)
    document = doc_repo.upsert_by_sha256(
        SourceDocument(
            source_system="bank",
            document_type="bank_csv",
            original_filename="sample.csv",
            storage_path="/tmp/sample.csv",
            mime_type="text/csv",
            file_size_bytes=10,
            document_sha256="doc-hash",
            ingest_batch_key="batch",
            captured_at=now,
            ingested_at=now,
            metadata_json={},
        )
    )
    session.flush()
    record = SourceRecord(
        source_document_id=document.id,
        record_type="bank_txn",
        record_fingerprint="row-hash",
        extraction_version="v1",
        parse_status="parsed",
        raw_payload={},
        normalized_payload={},
    )
    first = record_repo.upsert_by_lineage(record)
    session.flush()
    second = record_repo.upsert_by_lineage(
        SourceRecord(
            source_document_id=document.id,
            record_type="bank_txn",
            record_fingerprint="row-hash",
            extraction_version="v1",
            parse_status="parsed",
            raw_payload={},
            normalized_payload={},
        )
    )
    assert first.id == second.id

