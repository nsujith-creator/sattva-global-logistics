"""Evidence bundle service for matching and classification."""

from __future__ import annotations

from dataclasses import dataclass

from core.hashing import stable_payload_hash
from db.models.evidence import EvidenceBundle, EvidenceBundleItem
from db.models.reference import RuleVersion
from db.repositories.workflow import EvidenceBundleItemRepository, EvidenceBundleRepository


@dataclass(frozen=True)
class BundleMember:
    object_type: str
    object_id: str
    role: str
    ordinal: int = 1
    notes: str | None = None


class EvidenceBundleService:
    def __init__(
        self,
        bundle_repository: EvidenceBundleRepository,
        bundle_item_repository: EvidenceBundleItemRepository,
    ) -> None:
        self.bundle_repository = bundle_repository
        self.bundle_item_repository = bundle_item_repository

    def get_or_create_bundle(
        self,
        *,
        bundle_type: str,
        primary_record_type: str,
        primary_record_id: str,
        evidence_summary: str,
        rule_version: RuleVersion,
        members: list[BundleMember],
        confidence_score: float | None = None,
        metadata_json: dict | None = None,
    ) -> EvidenceBundle:
        bundle_fingerprint = self.compute_fingerprint(
            rule_version=rule_version,
            primary_record_type=primary_record_type,
            primary_record_id=primary_record_id,
            members=members,
        )
        existing = self.bundle_repository.get_by_fingerprint(bundle_fingerprint)
        if existing:
            self._ensure_members(existing.id, members)
            return existing

        bundle = EvidenceBundle(
            bundle_type=bundle_type,
            bundle_fingerprint=bundle_fingerprint,
            primary_record_type=primary_record_type,
            primary_record_id=str(primary_record_id),
            evidence_summary=evidence_summary,
            confidence_score=confidence_score,
            status="open",
            metadata_json=metadata_json or {},
        )
        self.bundle_repository.add(bundle)
        self.bundle_repository.session.flush()
        self._ensure_members(bundle.id, members)
        return bundle

    def attach_items(self, bundle_id: str, members: list[BundleMember]) -> None:
        self._ensure_members(bundle_id, members)

    def compute_fingerprint(
        self,
        *,
        rule_version: RuleVersion,
        primary_record_type: str,
        primary_record_id: str,
        members: list[BundleMember],
    ) -> str:
        ordered_members = sorted(
            (
                {
                    "object_type": member.object_type,
                    "object_id": str(member.object_id),
                    "role": member.role,
                }
                for member in members
            ),
            key=lambda item: (item["role"], item["object_type"], item["object_id"]),
        )
        return stable_payload_hash(
            {
                "rule_version": rule_version.version_code,
                "primary_record_type": primary_record_type,
                "primary_record_id": str(primary_record_id),
                "members": ordered_members,
            }
        )

    def _ensure_members(self, bundle_id: str, members: list[BundleMember]) -> None:
        for member in members:
            existing = self.bundle_item_repository.find_member(
                bundle_id,
                member.object_type,
                str(member.object_id),
                member.role,
            )
            if existing:
                continue
            self.bundle_item_repository.add(
                EvidenceBundleItem(
                    evidence_bundle_id=bundle_id,
                    item_object_type=member.object_type,
                    item_object_id=str(member.object_id),
                    item_role=member.role,
                    ordinal=member.ordinal,
                    notes=member.notes,
                )
            )
