"""Audit event model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base
from db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, UserStampMixin


class AuditEvent(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "audit_event"

    event_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    actor_type: Mapped[str] = mapped_column(String(20), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(100), nullable=False)
    object_type: Mapped[str] = mapped_column(String(50), nullable=False)
    object_id: Mapped[str] = mapped_column(String(36), nullable=False)
    correlation_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), index=True)
    before_state_json: Mapped[dict | None] = mapped_column(JSON)
    after_state_json: Mapped[dict | None] = mapped_column(JSON)
    event_detail_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (Index("ix_audit_event_correlation_ts", "correlation_id", "event_ts"),)
