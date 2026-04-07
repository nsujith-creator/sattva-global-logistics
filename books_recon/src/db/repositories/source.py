"""Repositories for source documents and records."""

from __future__ import annotations

from sqlalchemy import select

from db.models.evidence import SourceDocument, SourceRecord
from db.repositories.base import BaseRepository


class SourceDocumentRepository(BaseRepository[SourceDocument]):
    model = SourceDocument

    def get_by_sha256(self, document_sha256: str) -> SourceDocument | None:
        return self.session.scalar(select(SourceDocument).where(SourceDocument.document_sha256 == document_sha256))

    def upsert_by_sha256(self, instance: SourceDocument) -> SourceDocument:
        existing = self.get_by_sha256(instance.document_sha256)
        if existing:
            return existing
        return self.add(instance)


class SourceRecordRepository(BaseRepository[SourceRecord]):
    model = SourceRecord

    def get_by_fingerprint(self, source_document_id, record_fingerprint: str, extraction_version: str) -> SourceRecord | None:
        stmt = select(SourceRecord).where(
            SourceRecord.source_document_id == source_document_id,
            SourceRecord.record_fingerprint == record_fingerprint,
            SourceRecord.extraction_version == extraction_version,
        )
        return self.session.scalar(stmt)

    def upsert_by_lineage(self, instance: SourceRecord) -> SourceRecord:
        existing = self.get_by_fingerprint(
            instance.source_document_id,
            instance.record_fingerprint,
            instance.extraction_version,
        )
        if existing:
            return existing
        return self.add(instance)
