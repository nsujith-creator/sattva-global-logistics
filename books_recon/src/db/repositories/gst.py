"""Repository scaffolding for GST purchase lines."""

from __future__ import annotations

from sqlalchemy import select

from db.models.tax import GstPurchaseLine
from db.repositories.base import BaseRepository


class GstPurchaseLineRepository(BaseRepository[GstPurchaseLine]):
    model = GstPurchaseLine

    def find_by_invoice(self, supplier_gstin: str, invoice_number: str) -> list[GstPurchaseLine]:
        stmt = select(GstPurchaseLine).where(
            GstPurchaseLine.supplier_gstin == supplier_gstin,
            GstPurchaseLine.invoice_number == invoice_number,
        )
        return list(self.session.scalars(stmt))

    def upsert_by_source_record(self, instance: GstPurchaseLine) -> GstPurchaseLine:
        existing = self.session.scalar(select(GstPurchaseLine).where(GstPurchaseLine.source_record_id == instance.source_record_id))
        if existing:
            return existing
        return self.add(instance)
