"""Bank statement ingestion working slice."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.hashing import stable_payload_hash
from db.models.banking import BankAccount, BankTransaction
from db.models.evidence import SourceDocument, SourceRecord
from db.repositories.bank import BankTransactionRepository
from db.repositories.source import SourceRecordRepository


def _parse_date(value: str) -> datetime.date:
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unsupported date format: {value}")


def _to_decimal(value: str | None) -> Decimal:
    raw = (value or "").strip().replace(",", "")
    if raw == "":
        return Decimal("0")
    return Decimal(raw)


@dataclass(frozen=True)
class ParsedBankRow:
    row_number: int
    transaction_date: datetime.date
    value_date: datetime.date | None
    narration: str
    direction: str
    amount: Decimal
    signed_amount: Decimal
    bank_reference: str | None
    channel: str | None
    counterparty_name: str | None
    counterparty_fingerprint: str | None
    bank_account_ref: str
    raw_payload: dict

    def fingerprint(self) -> str:
        return stable_payload_hash(
            {
                "bank_account_ref": self.bank_account_ref,
                "transaction_date": self.transaction_date.isoformat(),
                "value_date": self.value_date.isoformat() if self.value_date else None,
                "amount": str(self.amount),
                "signed_amount": str(self.signed_amount),
                "bank_reference": self.bank_reference,
                "narration": self.narration.strip(),
                "counterparty_fingerprint": self.counterparty_fingerprint,
            }
        )


class BankImportService:
    extraction_version = "bank_csv_v1"

    def __init__(
        self,
        session: Session,
        source_record_repository: SourceRecordRepository,
        bank_transaction_repository: BankTransactionRepository,
    ) -> None:
        self.session = session
        self.source_record_repository = source_record_repository
        self.bank_transaction_repository = bank_transaction_repository

    def persist_rows(self, source_document: SourceDocument, rows: list[ParsedBankRow]) -> dict[str, int]:
        imported_records = 0
        imported_transactions = 0

        for row in rows:
            record = SourceRecord(
                source_document_id=source_document.id,
                record_type="bank_txn",
                source_row_number=row.row_number,
                record_fingerprint=row.fingerprint(),
                extraction_version=self.extraction_version,
                parse_status="parsed",
                event_date=row.transaction_date,
                amount=row.signed_amount,
                currency_code="INR",
                raw_payload=row.raw_payload,
                normalized_payload={
                    "bank_account_ref": row.bank_account_ref,
                    "transaction_date": row.transaction_date.isoformat(),
                    "value_date": row.value_date.isoformat() if row.value_date else None,
                    "direction": row.direction,
                    "amount": str(row.amount),
                    "signed_amount": str(row.signed_amount),
                    "narration": row.narration,
                    "bank_reference": row.bank_reference,
                    "channel": row.channel,
                    "counterparty_name": row.counterparty_name,
                    "counterparty_fingerprint": row.counterparty_fingerprint,
                },
                quality_score=1,
                review_required=False,
            )
            persisted_record = self.source_record_repository.upsert_by_lineage(record)
            if persisted_record is record:
                imported_records += 1

            bank_account = self._get_or_create_bank_account(row.bank_account_ref)
            transaction = BankTransaction(
                source_record_id=persisted_record.id,
                bank_account_id=bank_account.id,
                bank_account_ref=row.bank_account_ref,
                transaction_date=row.transaction_date,
                value_date=row.value_date,
                direction=row.direction,
                amount=row.amount,
                signed_amount=row.signed_amount,
                currency_code="INR",
                narration=row.narration,
                counterparty_name=row.counterparty_name,
                counterparty_fingerprint=row.counterparty_fingerprint,
                bank_reference=row.bank_reference,
                channel=row.channel,
                metadata_json={"source_document_id": str(source_document.id)},
            )
            persisted_txn = self.bank_transaction_repository.upsert_by_source_record(transaction)
            if persisted_txn is transaction:
                imported_transactions += 1

        return {
            "rows_seen": len(rows),
            "source_records_created": imported_records,
            "bank_transactions_created": imported_transactions,
        }

    def _get_or_create_bank_account(self, bank_account_ref: str) -> BankAccount:
        existing = self.session.scalar(select(BankAccount).where(BankAccount.account_mask == bank_account_ref))
        if existing:
            return existing
        bank_account = BankAccount(
            account_name=f"Imported Bank Account {bank_account_ref}",
            account_mask=bank_account_ref,
            bank_name="UNSPECIFIED",
            currency_code="INR",
            is_business_account=True,
            metadata_json={},
        )
        self.session.add(bank_account)
        self.session.flush()
        return bank_account
