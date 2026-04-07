"""GST and tax information models."""

from __future__ import annotations

from sqlalchemy import Date, ForeignKey, Index, JSON, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base
from db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, UserStampMixin


class GstPurchaseLine(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "gst_purchase_line"

    source_record_id: Mapped[str] = mapped_column(ForeignKey("source_record.id"), nullable=False, unique=True)
    supplier_gstin: Mapped[str] = mapped_column(String(15), nullable=False, index=True)
    supplier_name: Mapped[str] = mapped_column(String, nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    invoice_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    invoice_type: Mapped[str | None] = mapped_column(String(30))
    place_of_supply: Mapped[str | None] = mapped_column(String(50))
    taxable_value: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    igst_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    cgst_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    sgst_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    cess_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    total_tax_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    itc_availability: Mapped[str | None] = mapped_column(String(20))
    filing_period: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    vendor_master_id: Mapped[str | None] = mapped_column(ForeignKey("vendor_master.id"), index=True)
    match_status: Mapped[str] = mapped_column(String(30), nullable=False, default="unmatched", index=True)

    __table_args__ = (
        UniqueConstraint(
            "supplier_gstin", "invoice_number", "invoice_date", "taxable_value", "total_tax_amount", name="uq_gst_purchase"
        ),
    )


class TaxInformationItem(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "tax_information_item"

    source_record_id: Mapped[str] = mapped_column(ForeignKey("source_record.id"), nullable=False, unique=True)
    tax_system: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    item_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    authority_reference: Mapped[str | None] = mapped_column(String(100), index=True)
    item_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    assessment_year_code: Mapped[str | None] = mapped_column(String(9))
    period_code: Mapped[str | None] = mapped_column(String(20))
    party_identifier: Mapped[str | None] = mapped_column(String(50))
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    section_code: Mapped[str | None] = mapped_column(String(20))
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (
        UniqueConstraint("tax_system", "item_type", "authority_reference", "item_date", "amount", name="uq_tax_item_identity"),
        Index("ix_tax_information_item_ref_date", "authority_reference", "item_date"),
    )
