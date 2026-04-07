"""Repositories for reference and normalization master data."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import or_, select

from db.models.reference import (
    AccountMaster,
    PeriodLock,
    RuleVersion,
    VendorAlias,
    VendorMaster,
    ZohoAccountMapping,
    ZohoTaxMapping,
)
from db.repositories.base import BaseRepository


class VendorMasterRepository(BaseRepository[VendorMaster]):
    model = VendorMaster

    def find_by_gstin(self, gstin: str) -> VendorMaster | None:
        return self.session.scalar(select(VendorMaster).where(VendorMaster.gstin == gstin, VendorMaster.is_active.is_(True)))

    def find_by_zoho_contact_id(self, zoho_contact_id: str) -> VendorMaster | None:
        stmt = select(VendorMaster).where(
            VendorMaster.zoho_contact_id == zoho_contact_id,
            VendorMaster.is_active.is_(True),
        )
        return self.session.scalar(stmt)

    def find_by_beneficiary_fingerprint(self, fingerprint: str) -> VendorMaster | None:
        candidates = self.session.scalars(select(VendorMaster).where(VendorMaster.is_active.is_(True)))
        for vendor in candidates:
            if fingerprint in (vendor.beneficiary_fingerprints or []):
                return vendor
        return None

    def list_active(self) -> list[VendorMaster]:
        return list(self.session.scalars(select(VendorMaster).where(VendorMaster.is_active.is_(True))))


class VendorAliasRepository(BaseRepository[VendorAlias]):
    model = VendorAlias

    def find_active_alias(self, alias_type: str, normalized_alias_value: str) -> VendorAlias | None:
        stmt = select(VendorAlias).where(
            VendorAlias.alias_type == alias_type,
            VendorAlias.normalized_alias_value == normalized_alias_value,
            VendorAlias.is_active.is_(True),
        )
        return self.session.scalar(stmt)

    def list_for_vendor(self, vendor_master_id: str) -> list[VendorAlias]:
        stmt = select(VendorAlias).where(VendorAlias.vendor_master_id == vendor_master_id).order_by(VendorAlias.alias_type.asc())
        return list(self.session.scalars(stmt))


class AccountMasterRepository(BaseRepository[AccountMaster]):
    model = AccountMaster

    def get_by_code(self, account_code: str) -> AccountMaster | None:
        return self.session.scalar(select(AccountMaster).where(AccountMaster.account_code == account_code))

    def list_active_postable(self) -> list[AccountMaster]:
        stmt = select(AccountMaster).where(
            AccountMaster.is_active.is_(True),
            AccountMaster.is_postable.is_(True),
        ).order_by(AccountMaster.account_code.asc())
        return list(self.session.scalars(stmt))


class ZohoAccountMappingRepository(BaseRepository[ZohoAccountMapping]):
    model = ZohoAccountMapping

    def _coerce_uuid(self, value):
        try:
            return UUID(str(value))
        except (TypeError, ValueError, AttributeError):
            return value

    def find_active_mapping(
        self,
        *,
        account_master_id: str,
        environment: str,
        target_system: str = "zoho_books",
        target_module: str | None = None,
    ) -> ZohoAccountMapping | None:
        stmt = select(ZohoAccountMapping).where(
            ZohoAccountMapping.account_master_id == self._coerce_uuid(account_master_id),
            ZohoAccountMapping.environment == environment,
            ZohoAccountMapping.target_system == target_system,
            ZohoAccountMapping.is_active.is_(True),
        )
        if target_module is None:
            stmt = stmt.where(ZohoAccountMapping.target_module.is_(None))
        else:
            stmt = stmt.where(
                or_(
                    ZohoAccountMapping.target_module == target_module,
                    ZohoAccountMapping.target_module.is_(None),
                )
            ).order_by(ZohoAccountMapping.target_module.desc(), ZohoAccountMapping.created_at.desc())
        return self.session.scalar(stmt)


class ZohoTaxMappingRepository(BaseRepository[ZohoTaxMapping]):
    model = ZohoTaxMapping

    def _coerce_uuid(self, value):
        try:
            return UUID(str(value))
        except (TypeError, ValueError, AttributeError):
            return value

    def find_active_mapping(
        self,
        *,
        tax_code: str,
        environment: str,
        target_system: str = "zoho_books",
        target_module: str | None = None,
        account_master_id: str | None = None,
    ) -> ZohoTaxMapping | None:
        stmt = select(ZohoTaxMapping).where(
            ZohoTaxMapping.tax_code == tax_code,
            ZohoTaxMapping.environment == environment,
            ZohoTaxMapping.target_system == target_system,
            ZohoTaxMapping.is_active.is_(True),
        )
        if account_master_id is None:
            stmt = stmt.where(ZohoTaxMapping.account_master_id.is_(None))
        else:
            stmt = stmt.where(
                or_(
                    ZohoTaxMapping.account_master_id == self._coerce_uuid(account_master_id),
                    ZohoTaxMapping.account_master_id.is_(None),
                )
            )
        if target_module is None:
            stmt = stmt.where(ZohoTaxMapping.target_module.is_(None))
        else:
            stmt = stmt.where(
                or_(
                    ZohoTaxMapping.target_module == target_module,
                    ZohoTaxMapping.target_module.is_(None),
                )
            )
        stmt = stmt.order_by(
            ZohoTaxMapping.account_master_id.desc(),
            ZohoTaxMapping.target_module.desc(),
            ZohoTaxMapping.created_at.desc(),
        )
        return self.session.scalar(stmt)


class PeriodLockRepository(BaseRepository[PeriodLock]):
    model = PeriodLock

    def get_for_period_code(self, period_code: str) -> list[PeriodLock]:
        stmt = select(PeriodLock).where(PeriodLock.period_code == period_code)
        return list(self.session.scalars(stmt))


class RuleVersionRepository(BaseRepository[RuleVersion]):
    model = RuleVersion

    def get_active_for_date(self, effective_date: date) -> RuleVersion | None:
        stmt = select(RuleVersion).where(
            RuleVersion.is_active.is_(True),
            RuleVersion.effective_from <= effective_date,
            or_(RuleVersion.effective_to.is_(None), RuleVersion.effective_to >= effective_date),
        ).order_by(RuleVersion.effective_from.desc(), RuleVersion.created_at.desc())
        return self.session.scalar(stmt)
