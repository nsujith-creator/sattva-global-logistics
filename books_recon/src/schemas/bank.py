"""Bank schemas."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class BankTransactionCreate(BaseModel):
    source_record_id: str
    bank_account_id: str
    bank_account_ref: str
    transaction_date: date
    direction: str
    amount: float
    signed_amount: float
    narration: str

