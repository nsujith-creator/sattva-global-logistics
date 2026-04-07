"""Banking models."""

from __future__ import annotations

from sqlalchemy import Boolean, Date, ForeignKey, Index, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base
from db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, UserStampMixin


class BankAccount(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "bank_account"

    account_name: Mapped[str] = mapped_column(Text, nullable=False)
    account_mask: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    bank_name: Mapped[str] = mapped_column(String(100), nullable=False)
    ifsc_code: Mapped[str | None] = mapped_column(String(20))
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    is_business_account: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class BankTransaction(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "bank_transaction"

    source_record_id: Mapped[str] = mapped_column(ForeignKey("source_record.id"), nullable=False, unique=True)
    bank_account_id: Mapped[str] = mapped_column(ForeignKey("bank_account.id"), nullable=False, index=True)
    bank_account_ref: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    transaction_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    value_date: Mapped[Date | None] = mapped_column(Date)
    direction: Mapped[str] = mapped_column(String(6), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    signed_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    narration: Mapped[str] = mapped_column(Text, nullable=False)
    counterparty_name: Mapped[str | None] = mapped_column(Text)
    counterparty_fingerprint: Mapped[str | None] = mapped_column(String(64), index=True)
    bank_reference: Mapped[str | None] = mapped_column(String(100), index=True)
    channel: Mapped[str | None] = mapped_column(String(30))
    is_reconciled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recon_status: Mapped[str] = mapped_column(String(30), nullable=False, default="unmatched", index=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (
        UniqueConstraint(
            "bank_account_ref",
            "transaction_date",
            "amount",
            "bank_reference",
            "counterparty_fingerprint",
            name="uq_bank_transaction_identity",
        ),
        Index("ix_bank_transaction_lookup", "transaction_date", "amount", "bank_reference"),
    )
