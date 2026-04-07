"""Repositories for matching and classification workflow objects."""

from __future__ import annotations

from sqlalchemy import select

from db.models.evidence import EvidenceBundle, EvidenceBundleItem
from db.models.workflow import ClassificationResult, ExceptionCase, MatchCandidate
from db.repositories.base import BaseRepository


class EvidenceBundleRepository(BaseRepository[EvidenceBundle]):
    model = EvidenceBundle

    def get_by_fingerprint(self, bundle_fingerprint: str) -> EvidenceBundle | None:
        return self.session.scalar(select(EvidenceBundle).where(EvidenceBundle.bundle_fingerprint == bundle_fingerprint))

    def get_open_for_primary(self, primary_record_type: str, primary_record_id: str) -> EvidenceBundle | None:
        stmt = select(EvidenceBundle).where(
            EvidenceBundle.primary_record_type == primary_record_type,
            EvidenceBundle.primary_record_id == str(primary_record_id),
            EvidenceBundle.status == "open",
        )
        return self.session.scalar(stmt)


class EvidenceBundleItemRepository(BaseRepository[EvidenceBundleItem]):
    model = EvidenceBundleItem

    def find_member(
        self,
        evidence_bundle_id: str,
        item_object_type: str,
        item_object_id: str,
        item_role: str,
    ) -> EvidenceBundleItem | None:
        stmt = select(EvidenceBundleItem).where(
            EvidenceBundleItem.evidence_bundle_id == evidence_bundle_id,
            EvidenceBundleItem.item_object_type == item_object_type,
            EvidenceBundleItem.item_object_id == str(item_object_id),
            EvidenceBundleItem.item_role == item_role,
        )
        return self.session.scalar(stmt)

    def list_for_bundle(self, evidence_bundle_id: str) -> list[EvidenceBundleItem]:
        stmt = select(EvidenceBundleItem).where(EvidenceBundleItem.evidence_bundle_id == evidence_bundle_id)
        return list(self.session.scalars(stmt))


class MatchCandidateRepository(BaseRepository[MatchCandidate]):
    model = MatchCandidate

    def find_existing(
        self,
        evidence_bundle_id: str,
        from_object_type: str,
        from_object_id: str,
        to_object_type: str,
        to_object_id: str,
        rule_name: str,
    ) -> MatchCandidate | None:
        stmt = select(MatchCandidate).where(
            MatchCandidate.evidence_bundle_id == evidence_bundle_id,
            MatchCandidate.from_object_type == from_object_type,
            MatchCandidate.from_object_id == str(from_object_id),
            MatchCandidate.to_object_type == to_object_type,
            MatchCandidate.to_object_id == str(to_object_id),
            MatchCandidate.rule_name == rule_name,
        )
        return self.session.scalar(stmt)

    def list_for_bundle(self, evidence_bundle_id: str) -> list[MatchCandidate]:
        stmt = select(MatchCandidate).where(MatchCandidate.evidence_bundle_id == evidence_bundle_id)
        return list(self.session.scalars(stmt))


class ClassificationResultRepository(BaseRepository[ClassificationResult]):
    model = ClassificationResult

    def find_existing(
        self,
        evidence_bundle_id: str,
        rule_version_id: str,
        classification_type: str,
        accounting_period_date,
        decision_summary: str,
        supersedes_classification_id: str | None,
    ) -> ClassificationResult | None:
        stmt = select(ClassificationResult).where(
            ClassificationResult.evidence_bundle_id == evidence_bundle_id,
            ClassificationResult.rule_version_id == rule_version_id,
            ClassificationResult.classification_type == classification_type,
            ClassificationResult.accounting_period_date == accounting_period_date,
            ClassificationResult.decision_summary == decision_summary,
            ClassificationResult.supersedes_classification_id == supersedes_classification_id,
        )
        return self.session.scalar(stmt)

    def list_for_bundle(self, evidence_bundle_id: str) -> list[ClassificationResult]:
        stmt = select(ClassificationResult).where(ClassificationResult.evidence_bundle_id == evidence_bundle_id)
        return list(self.session.scalars(stmt))

    def find_superseding(self, classification_result_id: str) -> ClassificationResult | None:
        stmt = select(ClassificationResult).where(ClassificationResult.supersedes_classification_id == classification_result_id)
        return self.session.scalar(stmt)


class ExceptionCaseRepository(BaseRepository[ExceptionCase]):
    model = ExceptionCase

    def find_open_by_bundle(self, bundle_id: str, exception_type: str, conflict_type: str | None) -> ExceptionCase | None:
        stmt = select(ExceptionCase).where(
            ExceptionCase.bundle_id == bundle_id,
            ExceptionCase.exception_type == exception_type,
            ExceptionCase.conflict_type == conflict_type,
            ExceptionCase.status.in_(("open", "in_review")),
        )
        return self.session.scalar(stmt)

    def list_open_by_bundle(self, bundle_id: str) -> list[ExceptionCase]:
        stmt = select(ExceptionCase).where(
            ExceptionCase.bundle_id == bundle_id,
            ExceptionCase.status.in_(("open", "in_review")),
        )
        return list(self.session.scalars(stmt))

    def list_for_proposal(self, posting_proposal_id: str) -> list[ExceptionCase]:
        stmt = select(ExceptionCase).where(ExceptionCase.posting_proposal_id == posting_proposal_id)
        return list(self.session.scalars(stmt))
