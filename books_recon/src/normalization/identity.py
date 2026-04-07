"""Deterministic identity normalization services."""

from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

from db.models.banking import BankTransaction
from db.models.reference import VendorMaster
from db.repositories.reference import VendorAliasRepository, VendorMasterRepository


def normalize_lookup_text(value: str | None) -> str:
    if not value:
        return ""
    compact = re.sub(r"[^A-Z0-9]+", " ", value.upper()).strip()
    return re.sub(r"\s+", " ", compact)


@dataclass(frozen=True)
class NormalizationResult:
    vendor_master_id: str | None
    normalized_name: str | None
    match_method: str
    confidence: float
    score_components: dict
    matched_alias_value: str | None = None

    @property
    def is_resolved(self) -> bool:
        return self.vendor_master_id is not None


class VendorIdentityNormalizationService:
    def __init__(
        self,
        vendor_repository: VendorMasterRepository,
        vendor_alias_repository: VendorAliasRepository,
    ) -> None:
        self.vendor_repository = vendor_repository
        self.vendor_alias_repository = vendor_alias_repository

    def resolve(
        self,
        *,
        gstin: str | None = None,
        zoho_contact_id: str | None = None,
        beneficiary_fingerprint: str | None = None,
        alias_text: str | None = None,
    ) -> NormalizationResult:
        if gstin:
            vendor = self.vendor_repository.find_by_gstin(gstin)
            if vendor:
                return self._resolved(vendor, "gstin_exact", 1.0, {"gstin_exact": 1.0})

        if zoho_contact_id:
            vendor = self.vendor_repository.find_by_zoho_contact_id(zoho_contact_id)
            if vendor:
                return self._resolved(vendor, "zoho_contact_exact", 0.99, {"zoho_contact_exact": 0.99})

        if beneficiary_fingerprint:
            vendor = self.vendor_repository.find_by_beneficiary_fingerprint(beneficiary_fingerprint)
            if vendor:
                return self._resolved(vendor, "beneficiary_fingerprint_exact", 0.98, {"beneficiary_fingerprint_exact": 0.98})

        normalized_alias = normalize_lookup_text(alias_text)
        if normalized_alias:
            alias = self.vendor_alias_repository.find_active_alias("name", normalized_alias)
            if alias:
                vendor = self.vendor_repository.get(alias.vendor_master_id)
                if vendor:
                    return self._resolved(
                        vendor,
                        "alias_exact",
                        0.95,
                        {"alias_exact": 0.95},
                        matched_alias_value=alias.alias_value,
                    )

        fuzzy_match = self._fuzzy_match(normalized_alias)
        if fuzzy_match is not None:
            vendor, ratio = fuzzy_match
            return self._resolved(vendor, "name_fuzzy_low", min(ratio, 0.74), {"name_fuzzy_low": float(ratio)})

        return NormalizationResult(
            vendor_master_id=None,
            normalized_name=normalized_alias or None,
            match_method="unresolved",
            confidence=0.0,
            score_components={},
        )

    def _fuzzy_match(self, normalized_alias: str) -> tuple[VendorMaster, float] | None:
        if not normalized_alias:
            return None

        best_vendor: VendorMaster | None = None
        best_ratio = 0.0
        for vendor in self.vendor_repository.list_active():
            candidates = [
                normalize_lookup_text(vendor.canonical_name),
                normalize_lookup_text(vendor.display_name),
            ]
            for candidate in candidates:
                ratio = SequenceMatcher(a=normalized_alias, b=candidate).ratio()
                if ratio > best_ratio:
                    best_vendor = vendor
                    best_ratio = ratio
        if best_vendor is None or best_ratio < 0.65:
            return None
        return best_vendor, best_ratio

    def _resolved(
        self,
        vendor: VendorMaster,
        match_method: str,
        confidence: float,
        score_components: dict,
        *,
        matched_alias_value: str | None = None,
    ) -> NormalizationResult:
        return NormalizationResult(
            vendor_master_id=vendor.id,
            normalized_name=vendor.display_name,
            match_method=match_method,
            confidence=confidence,
            score_components=score_components,
            matched_alias_value=matched_alias_value,
        )


class BankCounterpartyNormalizationService:
    def __init__(self, vendor_normalization_service: VendorIdentityNormalizationService) -> None:
        self.vendor_normalization_service = vendor_normalization_service

    def resolve(self, transaction: BankTransaction) -> NormalizationResult:
        return self.vendor_normalization_service.resolve(
            beneficiary_fingerprint=transaction.counterparty_fingerprint,
            alias_text=transaction.counterparty_name or transaction.narration,
        )
