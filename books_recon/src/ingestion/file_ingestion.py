"""Local file evidence ingestion."""

from __future__ import annotations

import mimetypes
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from core.clock import utc_now
from core.config import get_settings
from core.hashing import sha256_file
from db.models.evidence import SourceDocument
from db.repositories.source import SourceDocumentRepository


@dataclass(frozen=True)
class IngestedFileResult:
    source_document: SourceDocument
    was_duplicate: bool


class FileEvidenceIngestionService:
    def __init__(self, source_document_repository: SourceDocumentRepository) -> None:
        self.source_document_repository = source_document_repository
        self.settings = get_settings()

    def ingest_file(
        self,
        source_path: Path,
        *,
        source_system: str,
        document_type: str,
        ingest_batch_key: str,
        source_document_ref: str | None = None,
        source_account_ref: str | None = None,
        confidentiality_level: str = "restricted",
        copy_to_vault: bool = True,
    ) -> IngestedFileResult:
        source_path = source_path.resolve()
        document_sha256 = sha256_file(source_path)
        existing = self.source_document_repository.get_by_sha256(document_sha256)
        if existing:
            return IngestedFileResult(source_document=existing, was_duplicate=True)

        storage_path = self._resolve_storage_path(source_path, document_sha256)
        storage_path.parent.mkdir(parents=True, exist_ok=True)
        if copy_to_vault and not storage_path.exists():
            shutil.copy2(source_path, storage_path)

        mime_type = mimetypes.guess_type(source_path.name)[0] or "application/octet-stream"
        captured_at = utc_now()
        try:
            captured_at = datetime.fromtimestamp(source_path.stat().st_mtime, tz=timezone.utc)
        except OSError:
            pass

        document = SourceDocument(
            source_system=source_system,
            document_type=document_type,
            source_document_ref=source_document_ref,
            original_filename=source_path.name,
            storage_path=str(storage_path),
            mime_type=mime_type,
            file_size_bytes=source_path.stat().st_size,
            document_sha256=document_sha256,
            ingest_batch_key=ingest_batch_key,
            captured_at=captured_at,
            ingested_at=utc_now(),
            source_account_ref=source_account_ref,
            confidentiality_level=confidentiality_level,
            metadata_json={
                "original_path": str(source_path),
                "suffix": source_path.suffix.lower(),
            },
        )
        persisted = self.source_document_repository.upsert_by_sha256(document)
        return IngestedFileResult(source_document=persisted, was_duplicate=False)

    def _resolve_storage_path(self, source_path: Path, document_sha256: str) -> Path:
        suffix = source_path.suffix.lower()
        shard = document_sha256[:2]
        return (self.settings.evidence_root / shard / f"{document_sha256}{suffix}").resolve()
