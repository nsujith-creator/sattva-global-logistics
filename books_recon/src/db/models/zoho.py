"""Read-only Zoho snapshot models."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Date, DateTime, Index, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base
from db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, UserStampMixin


class ZohoSnapshotBase(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __abstract__ = True

    snapshot_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    snapshot_batch_key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    zoho_object_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    is_deleted_in_zoho: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class ZohoSnapshotBill(ZohoSnapshotBase):
    __tablename__ = "zoho_snapshot_bill"

    vendor_name: Mapped[str] = mapped_column(Text, nullable=False)
    vendor_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    bill_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    bill_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    due_date: Mapped[Date | None] = mapped_column(Date)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False)
    total: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    balance: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    reference_number: Mapped[str | None] = mapped_column(String(100))

    __table_args__ = (Index("ix_zoho_snapshot_bill_batch_object", "snapshot_batch_key", "zoho_object_id", unique=True),)


class ZohoSnapshotVendorPayment(ZohoSnapshotBase):
    __tablename__ = "zoho_snapshot_vendor_payment"

    payment_number: Mapped[str | None] = mapped_column(String(100))
    payment_date: Mapped[Date | None] = mapped_column(Date, index=True)
    vendor_id: Mapped[str | None] = mapped_column(String(50), index=True)
    amount: Mapped[float | None] = mapped_column(Numeric(18, 2))
    unapplied_amount: Mapped[float | None] = mapped_column(Numeric(18, 2))
    reference_number: Mapped[str | None] = mapped_column(String(100))

    __table_args__ = (
        Index("ix_zoho_snapshot_vendor_payment_batch_object", "snapshot_batch_key", "zoho_object_id", unique=True),
    )


class ZohoSnapshotExpense(ZohoSnapshotBase):
    __tablename__ = "zoho_snapshot_expense"

    expense_date: Mapped[Date | None] = mapped_column(Date, index=True)
    paid_through_account_id: Mapped[str | None] = mapped_column(String(50))
    amount: Mapped[float | None] = mapped_column(Numeric(18, 2))
    reference_number: Mapped[str | None] = mapped_column(String(100))
    account_id: Mapped[str | None] = mapped_column(String(50))

    __table_args__ = (Index("ix_zoho_snapshot_expense_batch_object", "snapshot_batch_key", "zoho_object_id", unique=True),)


class ZohoSnapshotJournal(ZohoSnapshotBase):
    __tablename__ = "zoho_snapshot_journal"

    journal_number: Mapped[str | None] = mapped_column(String(100))
    journal_date: Mapped[Date | None] = mapped_column(Date, index=True)
    total: Mapped[float | None] = mapped_column(Numeric(18, 2))
    status: Mapped[str | None] = mapped_column(String(30))

    __table_args__ = (Index("ix_zoho_snapshot_journal_batch_object", "snapshot_batch_key", "zoho_object_id", unique=True),)


class ZohoSnapshotContact(ZohoSnapshotBase):
    __tablename__ = "zoho_snapshot_contact"

    contact_name: Mapped[str | None] = mapped_column(Text)
    contact_type: Mapped[str | None] = mapped_column(String(20))
    gstin: Mapped[str | None] = mapped_column(String(15), index=True)
    status: Mapped[str | None] = mapped_column(String(20))

    __table_args__ = (Index("ix_zoho_snapshot_contact_batch_object", "snapshot_batch_key", "zoho_object_id", unique=True),)


class ZohoSnapshotChartAccount(ZohoSnapshotBase):
    __tablename__ = "zoho_snapshot_chart_account"

    account_name: Mapped[str | None] = mapped_column(Text)
    account_code: Mapped[str | None] = mapped_column(String(50))
    account_type: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool | None] = mapped_column(Boolean)

    __table_args__ = (
        Index("ix_zoho_snapshot_chart_account_batch_object", "snapshot_batch_key", "zoho_object_id", unique=True),
    )
