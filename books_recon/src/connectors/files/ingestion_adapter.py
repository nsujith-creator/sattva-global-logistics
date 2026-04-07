"""File ingestion adapter."""

from __future__ import annotations

from pathlib import Path

from ingestion.file_ingestion import FileEvidenceIngestionService, IngestedFileResult


class FileIngestionAdapter:
    def __init__(self, service: FileEvidenceIngestionService) -> None:
        self.service = service

    def register_file(
        self,
        source_path: Path,
        *,
        source_system: str,
        document_type: str,
        ingest_batch_key: str,
        source_document_ref: str | None = None,
        source_account_ref: str | None = None,
    ) -> IngestedFileResult:
        return self.service.ingest_file(
            source_path,
            source_system=source_system,
            document_type=document_type,
            ingest_batch_key=ingest_batch_key,
            source_document_ref=source_document_ref,
            source_account_ref=source_account_ref,
        )
