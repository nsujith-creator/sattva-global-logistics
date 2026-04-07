"""Reference, master data, and Zoho mapping registry models."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base
from db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, UserStampMixin


class FiscalYear(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "fiscal_year"

    code: Mapped[str] = mapped_column(String(9), nullable=False, unique=True)
    start_date: Mapped[Date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Date] = mapped_column(Date, nullable=False)
    assessment_year_code: Mapped[str | None] = mapped_column(String(9))
    is_closed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    close_reason: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (CheckConstraint("start_date <= end_date", name="fy_date_order"),)


class PeriodLock(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "period_lock"

    fiscal_year_id: Mapped[str] = mapped_column(ForeignKey("fiscal_year.id"), nullable=False, index=True)
    period_code: Mapped[str] = mapped_column(String(10), nullable=False)
    lock_state: Mapped[str] = mapped_column(String(20), nullable=False)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (UniqueConstraint("fiscal_year_id", "period_code", name="uq_period_lock_scope"),)


class VendorMaster(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "vendor_master"

    canonical_name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    vendor_type: Mapped[str] = mapped_column(String(30), nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(15), index=True)
    pan: Mapped[str | None] = mapped_column(String(10))
    is_personal_counterparty: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    personal_match_mode: Mapped[str | None] = mapped_column(String(30))
    beneficiary_fingerprints: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    narration_patterns: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    zoho_contact_id: Mapped[str | None] = mapped_column(String(50), index=True)
    default_settlement_policy: Mapped[str] = mapped_column(String(30), nullable=False, default="bill_to_bill")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (Index("ix_vendor_master_gstin_name", "gstin", "canonical_name"),)


class VendorAlias(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "vendor_alias"

    vendor_master_id: Mapped[str] = mapped_column(ForeignKey("vendor_master.id"), nullable=False, index=True)
    alias_type: Mapped[str] = mapped_column(String(30), nullable=False)
    alias_value: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_alias_value: Mapped[str] = mapped_column(String(255), nullable=False)
    source_system: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (
        UniqueConstraint("alias_type", "normalized_alias_value", name="uq_vendor_alias_identity"),
        Index("ix_vendor_alias_lookup", "alias_type", "normalized_alias_value"),
    )


class CustomerMaster(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "customer_master"

    canonical_name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(15), index=True)
    pan: Mapped[str | None] = mapped_column(String(10))
    zoho_contact_id: Mapped[str | None] = mapped_column(String(50), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class AccountMaster(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "account_master"

    account_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    account_name: Mapped[str] = mapped_column(Text, nullable=False)
    account_type: Mapped[str] = mapped_column(String(30), nullable=False)
    subtype: Mapped[str | None] = mapped_column(String(50))
    normal_balance: Mapped[str] = mapped_column(String(6), nullable=False)
    is_control_account: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    zoho_account_id: Mapped[str | None] = mapped_column(String(50), index=True)
    gst_treatment_hint: Mapped[str | None] = mapped_column(String(30))
    is_postable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ZohoAccountMapping(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "zoho_account_mapping"

    account_master_id: Mapped[str] = mapped_column(ForeignKey("account_master.id"), nullable=False, index=True)
    environment: Mapped[str] = mapped_column(String(20), nullable=False, default="sandbox", index=True)
    target_system: Mapped[str] = mapped_column(String(20), nullable=False, default="zoho_books")
    target_module: Mapped[str | None] = mapped_column(String(40))
    zoho_account_id: Mapped[str] = mapped_column(String(50), nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False, default="manual")
    source_ref: Mapped[str | None] = mapped_column(String(100))
    provenance_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint(
            "account_master_id",
            "environment",
            "target_system",
            "target_module",
            name="uq_zoho_account_mapping_scope",
        ),
    )


class ZohoTaxMapping(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "zoho_tax_mapping"

    environment: Mapped[str] = mapped_column(String(20), nullable=False, default="sandbox", index=True)
    target_system: Mapped[str] = mapped_column(String(20), nullable=False, default="zoho_books")
    target_module: Mapped[str | None] = mapped_column(String(40))
    tax_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    account_master_id: Mapped[str | None] = mapped_column(ForeignKey("account_master.id"), index=True)
    zoho_tax_id: Mapped[str] = mapped_column(String(50), nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False, default="manual")
    source_ref: Mapped[str | None] = mapped_column(String(100))
    provenance_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint(
            "environment",
            "target_system",
            "target_module",
            "tax_code",
            "account_master_id",
            name="uq_zoho_tax_mapping_scope",
        ),
    )


class RuleVersion(UUIDPrimaryKeyMixin, TimestampMixin, UserStampMixin, Base):
    __tablename__ = "rule_version"

    rulebook_name: Mapped[str] = mapped_column(String(50), nullable=False)
    version_code: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    effective_from: Mapped[Date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[Date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    published_by: Mapped[str] = mapped_column(String(100), nullable=False)
    change_summary: Mapped[str] = mapped_column(Text, nullable=False)
    rules_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
