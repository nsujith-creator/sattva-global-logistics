"""Evidence and lineage models."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Index, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base
from db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, UserStampMixin


class SourceDocument(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "source_document"

    fiscal_year_id: Mapped[str | None] = mapped_column(ForeignKey("fiscal_year.id"), index=True)
    source_system: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_document_ref: Mapped[str | None] = mapped_column(String(255))
    original_filename: Mapped[str] = mapped_column(Text, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    document_sha256: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    ingest_batch_key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_account_ref: Mapped[str | None] = mapped_column(String(100))
    confidentiality_level: Mapped[str] = mapped_column(String(20), nullable=False, default="restricted")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    supersedes_document_id: Mapped[str | None] = mapped_column(ForeignKey("source_document.id"))
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class SourceRecord(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "source_record"

    source_document_id: Mapped[str] = mapped_column(ForeignKey("source_document.id"), nullable=False, index=True)
    record_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_row_number: Mapped[int | None] = mapped_column(Integer)
    record_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    extraction_version: Mapped[str] = mapped_column(String(50), nullable=False)
    parse_status: Mapped[str] = mapped_column(String(20), nullable=False)
    event_date: Mapped[Date | None] = mapped_column(Date)
    amount: Mapped[float | None] = mapped_column(Numeric(18, 2))
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    raw_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    normalized_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    quality_score: Mapped[float | None] = mapped_column(nullable=True)
    review_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    superseded_by_record_id: Mapped[str | None] = mapped_column(ForeignKey("source_record.id"))

    __table_args__ = (
        UniqueConstraint("source_document_id", "record_fingerprint", "extraction_version", name="uq_source_record_lineage"),
        Index("ix_source_record_type_date", "record_type", "event_date"),
    )


class EvidenceBundle(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "evidence_bundle"

    bundle_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    bundle_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    primary_record_type: Mapped[str] = mapped_column(String(50), nullable=False)
    primary_record_id: Mapped[str] = mapped_column(String(36), nullable=False)
    evidence_summary: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open", index=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class EvidenceBundleItem(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "evidence_bundle_item"

    evidence_bundle_id: Mapped[str] = mapped_column(ForeignKey("evidence_bundle.id"), nullable=False, index=True)
    item_object_type: Mapped[str] = mapped_column(String(50), nullable=False)
    item_object_id: Mapped[str] = mapped_column(String(36), nullable=False)
    item_role: Mapped[str] = mapped_column(String(30), nullable=False)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        UniqueConstraint(
            "evidence_bundle_id", "item_object_type", "item_object_id", "item_role", name="uq_evidence_bundle_item_member"
        ),
    )
