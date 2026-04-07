"""Controlled reviewer-facing master data operations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from db.models.reference import AccountMaster, VendorAlias, VendorMaster, ZohoAccountMapping, ZohoTaxMapping
from db.repositories.reference import (
    AccountMasterRepository,
    VendorAliasRepository,
    VendorMasterRepository,
    ZohoAccountMappingRepository,
    ZohoTaxMappingRepository,
)
from normalization.identity import VendorIdentityNormalizationService, normalize_lookup_text


@dataclass(frozen=True)
class VendorResolution:
    vendor_master: VendorMaster
    source: str


class MasterDataControlService:
    EXPENSE_ACCOUNT_TYPES = {"expense", "direct_expense", "cost_of_goods_sold", "asset"}
    TAX_ACCOUNT_TYPES = {"tax", "tax_asset", "tax_liability"}
    TAX_CODE_DOMAIN = {"eligible_itc", "ineligible_itc", "rcm_itc", "gst_paid_expense"}
    TAX_HINT_DOMAIN = {"input_tax", "output_tax", "gst", "itc"}
    ADVANCE_RESOLUTION_CHOICES = {"create_vendor_advance", "treat_as_drawings", "hold_unapplied"}

    def __init__(
        self,
        *,
        vendor_repository: VendorMasterRepository,
        vendor_alias_repository: VendorAliasRepository,
        account_repository: AccountMasterRepository,
        zoho_account_mapping_repository: ZohoAccountMappingRepository | None = None,
        zoho_tax_mapping_repository: ZohoTaxMappingRepository | None = None,
    ) -> None:
        self.vendor_repository = vendor_repository
        self.vendor_alias_repository = vendor_alias_repository
        self.account_repository = account_repository
        self.zoho_account_mapping_repository = zoho_account_mapping_repository
        self.zoho_tax_mapping_repository = zoho_tax_mapping_repository
        self.vendor_normalization = VendorIdentityNormalizationService(vendor_repository, vendor_alias_repository)

    def upsert_vendor_master(
        self,
        *,
        canonical_name: str,
        display_name: str,
        vendor_type: str,
        gstin: str | None = None,
        pan: str | None = None,
        zoho_contact_id: str | None = None,
        beneficiary_fingerprints: list[str] | None = None,
        metadata_json: dict[str, Any] | None = None,
        created_by: str = "system",
    ) -> VendorMaster:
        existing = None
        if gstin:
            existing = self.vendor_repository.find_by_gstin(gstin)
        if existing is None and zoho_contact_id:
            existing = self.vendor_repository.find_by_zoho_contact_id(zoho_contact_id)
        if existing is None:
            normalized_name = normalize_lookup_text(canonical_name)
            for candidate in self.vendor_repository.list_active():
                if normalize_lookup_text(candidate.canonical_name) == normalized_name:
                    existing = candidate
                    break

        if existing is None:
            return self.vendor_repository.add(
                VendorMaster(
                    canonical_name=canonical_name,
                    display_name=display_name,
                    vendor_type=vendor_type,
                    gstin=gstin,
                    pan=pan,
                    zoho_contact_id=zoho_contact_id,
                    beneficiary_fingerprints=beneficiary_fingerprints or [],
                    metadata_json=metadata_json or {},
                    created_by=created_by,
                    updated_by=created_by,
                )
            )

        existing.display_name = display_name
        existing.vendor_type = vendor_type
        existing.gstin = gstin or existing.gstin
        existing.pan = pan or existing.pan
        existing.zoho_contact_id = zoho_contact_id or existing.zoho_contact_id
        existing.beneficiary_fingerprints = sorted(set((existing.beneficiary_fingerprints or []) + (beneficiary_fingerprints or [])))
        existing.metadata_json = {**(existing.metadata_json or {}), **(metadata_json or {})}
        existing.updated_by = created_by
        return existing

    def upsert_vendor_alias(
        self,
        *,
        vendor_master_id,
        alias_value: str,
        alias_type: str = "name",
        source_system: str | None = None,
        created_by: str = "system",
    ) -> VendorAlias:
        vendor = self.require_active_vendor(vendor_master_id)
        normalized = normalize_lookup_text(alias_value)
        existing = self.vendor_alias_repository.find_active_alias(alias_type, normalized)
        if existing is not None:
            if str(existing.vendor_master_id) != str(vendor.id):
                raise ValueError(f"Alias {alias_value!r} is already attached to another vendor.")
            existing.alias_value = alias_value
            existing.source_system = source_system or existing.source_system
            existing.updated_by = created_by
            return existing

        return self.vendor_alias_repository.add(
            VendorAlias(
                vendor_master_id=vendor.id,
                alias_type=alias_type,
                alias_value=alias_value,
                normalized_alias_value=normalized,
                source_system=source_system,
                metadata_json={},
                created_by=created_by,
                updated_by=created_by,
            )
        )

    def resolve_vendor_reference(self, reference: str | None = None, *, gstin: str | None = None) -> VendorResolution:
        if gstin:
            vendor = self.vendor_repository.find_by_gstin(gstin)
            if vendor:
                return VendorResolution(vendor_master=vendor, source="gstin_exact")

        if reference:
            vendor_id = self._coerce_uuid(reference)
            if vendor_id is not None:
                vendor = self.vendor_repository.get(vendor_id)
                if vendor is not None and vendor.is_active:
                    return VendorResolution(vendor_master=vendor, source="vendor_id")

            resolution = self.vendor_normalization.resolve(alias_text=reference, gstin=gstin)
            if resolution.vendor_master_id is not None:
                vendor = self.vendor_repository.get(resolution.vendor_master_id)
                if vendor is not None and vendor.is_active:
                    return VendorResolution(vendor_master=vendor, source=resolution.match_method)

        raise ValueError(f"Could not resolve canonical vendor from reference: {reference!r}")

    def require_active_vendor(self, vendor_master_id) -> VendorMaster:
        vendor = self.vendor_repository.get(vendor_master_id)
        if vendor is None or not vendor.is_active:
            raise ValueError(f"Unknown or inactive vendor_master_id: {vendor_master_id}")
        return vendor

    def require_account_for_action(self, account_reference: str, *, action_type: str, tax_code: str | None = None) -> AccountMaster:
        account = self.account_repository.get_by_code(account_reference)
        if account is None:
            account = self.account_repository.get(self._coerce_uuid(account_reference))
        if account is None:
            raise ValueError(f"Unknown account reference: {account_reference}")
        if not account.is_active or not account.is_postable:
            raise ValueError(f"Account {account.account_code} is not active/postable.")

        allowed_types = self.EXPENSE_ACCOUNT_TYPES if action_type == "expense_placeholder" else self.TAX_ACCOUNT_TYPES
        if account.account_type not in allowed_types:
            raise ValueError(
                f"Account {account.account_code} with type {account.account_type!r} is not allowed for {action_type}."
            )

        if action_type == "tax_placeholder":
            hint = (account.gst_treatment_hint or "").lower()
            if hint and hint not in self.TAX_HINT_DOMAIN:
                raise ValueError(f"Account {account.account_code} has unsupported GST hint {account.gst_treatment_hint!r}.")
            if tax_code and tax_code not in self.TAX_CODE_DOMAIN:
                raise ValueError(f"Unsupported tax code: {tax_code}")
        return account

    def validate_tax_code(self, tax_code: str) -> str:
        if tax_code not in self.TAX_CODE_DOMAIN:
            raise ValueError(f"Unsupported tax code: {tax_code}")
        return tax_code

    def validate_resolution_choice(self, resolution_choice: str) -> str:
        if resolution_choice not in self.ADVANCE_RESOLUTION_CHOICES:
            raise ValueError(f"Unsupported resolution_choice: {resolution_choice}")
        return resolution_choice

    def lookup_accounts(self, *, account_type: str | None = None) -> list[AccountMaster]:
        accounts = self.account_repository.list_active_postable()
        if account_type is None:
            return accounts
        return [account for account in accounts if account.account_type == account_type]

    def upsert_zoho_account_mapping(
        self,
        *,
        account_reference: str,
        zoho_account_id: str,
        environment: str = "sandbox",
        target_system: str = "zoho_books",
        target_module: str | None = None,
        source_type: str = "manual",
        source_ref: str | None = None,
        provenance_json: dict[str, Any] | None = None,
        created_by: str = "system",
    ) -> ZohoAccountMapping:
        repository = self._require_zoho_account_mapping_repository()
        account = self.require_account_for_mapping(account_reference)
        existing = repository.find_active_mapping(
            account_master_id=str(account.id),
            environment=environment,
            target_system=target_system,
            target_module=target_module,
        )
        if existing is not None:
            existing.zoho_account_id = zoho_account_id
            existing.source_type = source_type
            existing.source_ref = source_ref
            existing.provenance_json = provenance_json or {}
            existing.updated_by = created_by
            return existing
        return repository.add(
            ZohoAccountMapping(
                account_master_id=account.id,
                environment=environment,
                target_system=target_system,
                target_module=target_module,
                zoho_account_id=zoho_account_id,
                source_type=source_type,
                source_ref=source_ref,
                provenance_json=provenance_json or {},
                is_active=True,
                created_by=created_by,
                updated_by=created_by,
            )
        )

    def upsert_zoho_tax_mapping(
        self,
        *,
        tax_code: str,
        zoho_tax_id: str,
        environment: str = "sandbox",
        target_system: str = "zoho_books",
        target_module: str | None = None,
        account_reference: str | None = None,
        source_type: str = "manual",
        source_ref: str | None = None,
        provenance_json: dict[str, Any] | None = None,
        created_by: str = "system",
    ) -> ZohoTaxMapping:
        repository = self._require_zoho_tax_mapping_repository()
        validated_tax_code = self.validate_tax_code(tax_code)
        account = self.require_account_for_action(account_reference, action_type="tax_placeholder", tax_code=validated_tax_code) if account_reference else None
        existing = repository.find_active_mapping(
            tax_code=validated_tax_code,
            environment=environment,
            target_system=target_system,
            target_module=target_module,
            account_master_id=str(account.id) if account is not None else None,
        )
        if existing is not None:
            existing.zoho_tax_id = zoho_tax_id
            existing.source_type = source_type
            existing.source_ref = source_ref
            existing.provenance_json = provenance_json or {}
            existing.updated_by = created_by
            return existing
        return repository.add(
            ZohoTaxMapping(
                environment=environment,
                target_system=target_system,
                target_module=target_module,
                tax_code=validated_tax_code,
                account_master_id=account.id if account is not None else None,
                zoho_tax_id=zoho_tax_id,
                source_type=source_type,
                source_ref=source_ref,
                provenance_json=provenance_json or {},
                is_active=True,
                created_by=created_by,
                updated_by=created_by,
            )
        )

    def require_zoho_account_mapping(
        self,
        *,
        account_master_id: str,
        environment: str = "sandbox",
        target_system: str = "zoho_books",
        target_module: str | None = None,
    ) -> ZohoAccountMapping:
        repository = self._require_zoho_account_mapping_repository()
        mapping = repository.find_active_mapping(
            account_master_id=str(account_master_id),
            environment=environment,
            target_system=target_system,
            target_module=target_module,
        )
        if mapping is None:
            raise ValueError(
                f"Missing active Zoho account mapping for account_master_id {account_master_id} in {environment}."
            )
        return mapping

    def require_zoho_tax_mapping(
        self,
        *,
        tax_code: str,
        environment: str = "sandbox",
        target_system: str = "zoho_books",
        target_module: str | None = None,
        account_master_id: str | None = None,
    ) -> ZohoTaxMapping:
        repository = self._require_zoho_tax_mapping_repository()
        validated_tax_code = self.validate_tax_code(tax_code)
        mapping = repository.find_active_mapping(
            tax_code=validated_tax_code,
            environment=environment,
            target_system=target_system,
            target_module=target_module,
            account_master_id=str(account_master_id) if account_master_id is not None else None,
        )
        if mapping is None:
            raise ValueError(
                f"Missing active Zoho tax mapping for tax_code {validated_tax_code!r} in {environment}."
            )
        return mapping

    def require_account_for_mapping(self, account_reference: str) -> AccountMaster:
        account = self.account_repository.get_by_code(account_reference)
        if account is None:
            account = self.account_repository.get(self._coerce_uuid(account_reference))
        if account is None:
            raise ValueError(f"Unknown account reference: {account_reference}")
        if not account.is_active:
            raise ValueError(f"Account {account.account_code} is inactive.")
        return account

    def _require_zoho_account_mapping_repository(self) -> ZohoAccountMappingRepository:
        if self.zoho_account_mapping_repository is None:
            raise ValueError("Zoho account mapping repository is not configured.")
        return self.zoho_account_mapping_repository

    def _require_zoho_tax_mapping_repository(self) -> ZohoTaxMappingRepository:
        if self.zoho_tax_mapping_repository is None:
            raise ValueError("Zoho tax mapping repository is not configured.")
        return self.zoho_tax_mapping_repository

    def _coerce_uuid(self, value):
        try:
            return UUID(str(value))
        except (TypeError, ValueError, AttributeError):
            return None
