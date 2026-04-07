"""Repository scaffolding for audit events."""

from __future__ import annotations

from sqlalchemy import select

from db.models.audit import AuditEvent
from db.repositories.base import BaseRepository


class AuditEventRepository(BaseRepository[AuditEvent]):
    model = AuditEvent

    def list_by_correlation(self, correlation_id: str) -> list[AuditEvent]:
        stmt = select(AuditEvent).where(AuditEvent.correlation_id == correlation_id)
        return list(self.session.scalars(stmt))

    def append_event(self, instance: AuditEvent) -> AuditEvent:
        return self.add(instance)
