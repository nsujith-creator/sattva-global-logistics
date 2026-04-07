"""Repository scaffolding for bank transactions."""

from __future__ import annotations

from sqlalchemy import select

from db.models.banking import BankTransaction
from db.repositories.base import BaseRepository


class BankTransactionRepository(BaseRepository[BankTransaction]):
    model = BankTransaction

    def find_by_reference(self, bank_reference: str) -> list[BankTransaction]:
        stmt = select(BankTransaction).where(BankTransaction.bank_reference == bank_reference)
        return list(self.session.scalars(stmt))

    def upsert_by_source_record(self, instance: BankTransaction) -> BankTransaction:
        existing = self.session.scalar(select(BankTransaction).where(BankTransaction.source_record_id == instance.source_record_id))
        if existing:
            return existing
        return self.add(instance)
