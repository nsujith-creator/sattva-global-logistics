"""Source document and record schemas."""

from __future__ import annotations

from pydantic import BaseModel


class SourceDocumentCreate(BaseModel):
    source_system: str
    document_type: str
    original_filename: str
    document_sha256: str
    ingest_batch_key: str
    storage_path: str


class SourceRecordCreate(BaseModel):
    source_document_id: str
    record_type: str
    record_fingerprint: str
    extraction_version: str
    parse_status: str
    raw_payload: dict

