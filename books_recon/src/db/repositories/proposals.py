"""Repository scaffolding for proposals."""

from __future__ import annotations

from sqlalchemy import select

from db.models.workflow import (
    ApprovalDecision,
    DryRunExecutionArtifact,
    ExternalExecutionAttempt,
    PostingProposal,
    PostingProposalLine,
    ProposalLineRevision,
    ProposalRevision,
    SandboxReconciliationRecord,
    ZohoPostingReceipt,
)
from db.repositories.base import BaseRepository


class ProposalRepository(BaseRepository[PostingProposal]):
    model = PostingProposal

    def get_by_fingerprint(self, proposal_fingerprint: str) -> PostingProposal | None:
        return self.session.scalar(
            select(PostingProposal).where(PostingProposal.proposal_fingerprint == proposal_fingerprint)
        )

    def upsert_by_fingerprint(self, instance: PostingProposal) -> PostingProposal:
        existing = self.get_by_fingerprint(instance.proposal_fingerprint)
        if existing:
            return existing
        return self.add(instance)

    def list_for_classification(self, classification_result_id: str) -> list[PostingProposal]:
        stmt = select(PostingProposal).where(PostingProposal.classification_result_id == classification_result_id)
        return list(self.session.scalars(stmt))

    def list_active_for_bundle(self, classification_result_ids: list[str]) -> list[PostingProposal]:
        if not classification_result_ids:
            return []
        stmt = select(PostingProposal).where(
            PostingProposal.classification_result_id.in_(classification_result_ids),
            PostingProposal.status.in_(("draft", "pending_review")),
        )
        return list(self.session.scalars(stmt))

    def list_for_generated_classification(self, generated_from_classification_id: str) -> list[PostingProposal]:
        stmt = select(PostingProposal).where(PostingProposal.generated_from_classification_id == generated_from_classification_id)
        return list(self.session.scalars(stmt))


class ProposalLineRepository(BaseRepository[PostingProposalLine]):
    model = PostingProposalLine

    def list_for_proposal(self, posting_proposal_id: str) -> list[PostingProposalLine]:
        stmt = (
            select(PostingProposalLine)
            .where(PostingProposalLine.posting_proposal_id == posting_proposal_id)
            .order_by(PostingProposalLine.line_no.asc())
        )
        return list(self.session.scalars(stmt))

    def find_by_order(self, posting_proposal_id: str, line_no: int) -> PostingProposalLine | None:
        stmt = select(PostingProposalLine).where(
            PostingProposalLine.posting_proposal_id == posting_proposal_id,
            PostingProposalLine.line_no == line_no,
        )
        return self.session.scalar(stmt)

    def list_blocking(self, posting_proposal_id: str) -> list[PostingProposalLine]:
        stmt = select(PostingProposalLine).where(
            PostingProposalLine.posting_proposal_id == posting_proposal_id,
            PostingProposalLine.is_blocking.is_(True),
        )
        return list(self.session.scalars(stmt))

    def list_review_required(self, posting_proposal_id: str) -> list[PostingProposalLine]:
        stmt = select(PostingProposalLine).where(
            PostingProposalLine.posting_proposal_id == posting_proposal_id,
            PostingProposalLine.review_required.is_(True),
        )
        return list(self.session.scalars(stmt))


class ProposalRevisionRepository(BaseRepository[ProposalRevision]):
    model = ProposalRevision

    def upsert_via_merge(self, instance: ProposalRevision) -> ProposalRevision:
        raise NotImplementedError("Proposal revisions are append-only.")

    def list_for_proposal(self, posting_proposal_id: str) -> list[ProposalRevision]:
        stmt = (
            select(ProposalRevision)
            .where(ProposalRevision.posting_proposal_id == posting_proposal_id)
            .order_by(ProposalRevision.edited_at.asc(), ProposalRevision.created_at.asc())
        )
        return list(self.session.scalars(stmt))


class ProposalLineRevisionRepository(BaseRepository[ProposalLineRevision]):
    model = ProposalLineRevision

    def upsert_via_merge(self, instance: ProposalLineRevision) -> ProposalLineRevision:
        raise NotImplementedError("Proposal line revisions are append-only.")

    def list_for_proposal(self, posting_proposal_id: str) -> list[ProposalLineRevision]:
        stmt = (
            select(ProposalLineRevision)
            .where(ProposalLineRevision.posting_proposal_id == posting_proposal_id)
            .order_by(ProposalLineRevision.edited_at.asc(), ProposalLineRevision.created_at.asc())
        )
        return list(self.session.scalars(stmt))

    def list_for_line(self, posting_proposal_line_id: str) -> list[ProposalLineRevision]:
        stmt = (
            select(ProposalLineRevision)
            .where(ProposalLineRevision.posting_proposal_line_id == posting_proposal_line_id)
            .order_by(ProposalLineRevision.edited_at.asc(), ProposalLineRevision.created_at.asc())
        )
        return list(self.session.scalars(stmt))


class ApprovalDecisionRepository(BaseRepository[ApprovalDecision]):
    model = ApprovalDecision

    def list_for_proposal(self, posting_proposal_id: str) -> list[ApprovalDecision]:
        stmt = select(ApprovalDecision).where(ApprovalDecision.posting_proposal_id == posting_proposal_id)
        return list(self.session.scalars(stmt))

    def latest_for_proposal(self, posting_proposal_id: str) -> ApprovalDecision | None:
        stmt = (
            select(ApprovalDecision)
            .where(ApprovalDecision.posting_proposal_id == posting_proposal_id)
            .order_by(ApprovalDecision.decision_at.desc(), ApprovalDecision.created_at.desc())
        )
        return self.session.scalar(stmt)


class DryRunExecutionArtifactRepository(BaseRepository[DryRunExecutionArtifact]):
    model = DryRunExecutionArtifact

    def upsert_via_merge(self, instance: DryRunExecutionArtifact) -> DryRunExecutionArtifact:
        raise NotImplementedError("Dry-run execution artifacts are append-only.")

    def list_for_proposal(self, posting_proposal_id: str) -> list[DryRunExecutionArtifact]:
        stmt = (
            select(DryRunExecutionArtifact)
            .where(DryRunExecutionArtifact.posting_proposal_id == posting_proposal_id)
            .order_by(DryRunExecutionArtifact.created_at.asc(), DryRunExecutionArtifact.id.asc())
        )
        return list(self.session.scalars(stmt))

    def latest_for_proposal(self, posting_proposal_id: str) -> DryRunExecutionArtifact | None:
        stmt = (
            select(DryRunExecutionArtifact)
            .where(DryRunExecutionArtifact.posting_proposal_id == posting_proposal_id)
            .order_by(DryRunExecutionArtifact.created_at.desc(), DryRunExecutionArtifact.id.desc())
        )
        return self.session.scalar(stmt)

    def latest_for_idempotency_key(self, idempotency_key: str, *, execution_mode: str | None = None) -> DryRunExecutionArtifact | None:
        stmt = select(DryRunExecutionArtifact).where(DryRunExecutionArtifact.idempotency_key == idempotency_key)
        if execution_mode is not None:
            stmt = stmt.where(DryRunExecutionArtifact.execution_mode == execution_mode)
        stmt = stmt.order_by(DryRunExecutionArtifact.created_at.desc(), DryRunExecutionArtifact.id.desc())
        return self.session.scalar(stmt)

    def list_for_idempotency_key(self, idempotency_key: str, *, execution_mode: str | None = None) -> list[DryRunExecutionArtifact]:
        stmt = select(DryRunExecutionArtifact).where(DryRunExecutionArtifact.idempotency_key == idempotency_key)
        if execution_mode is not None:
            stmt = stmt.where(DryRunExecutionArtifact.execution_mode == execution_mode)
        stmt = stmt.order_by(DryRunExecutionArtifact.created_at.asc(), DryRunExecutionArtifact.id.asc())
        return list(self.session.scalars(stmt))


class ZohoPostingReceiptRepository(BaseRepository[ZohoPostingReceipt]):
    model = ZohoPostingReceipt

    def find_by_idempotency_key(self, idempotency_key: str, *, environment: str | None = None) -> ZohoPostingReceipt | None:
        stmt = select(ZohoPostingReceipt).where(ZohoPostingReceipt.idempotency_key == idempotency_key)
        if environment is not None:
            stmt = stmt.where(ZohoPostingReceipt.environment == environment)
        return self.session.scalar(stmt)


class ExternalExecutionAttemptRepository(BaseRepository[ExternalExecutionAttempt]):
    model = ExternalExecutionAttempt

    def upsert_via_merge(self, instance: ExternalExecutionAttempt) -> ExternalExecutionAttempt:
        raise NotImplementedError("External execution attempts are append-only.")

    def list_for_proposal(self, posting_proposal_id: str, *, execution_mode: str | None = None) -> list[ExternalExecutionAttempt]:
        stmt = select(ExternalExecutionAttempt).where(ExternalExecutionAttempt.posting_proposal_id == posting_proposal_id)
        if execution_mode is not None:
            stmt = stmt.where(ExternalExecutionAttempt.execution_mode == execution_mode)
        stmt = stmt.order_by(ExternalExecutionAttempt.attempt_number.asc(), ExternalExecutionAttempt.created_at.asc())
        return list(self.session.scalars(stmt))

    def latest_for_idempotency_key(
        self,
        idempotency_key: str,
        *,
        environment: str | None = None,
        execution_mode: str | None = None,
    ) -> ExternalExecutionAttempt | None:
        stmt = select(ExternalExecutionAttempt).where(ExternalExecutionAttempt.idempotency_key == idempotency_key)
        if environment is not None:
            stmt = stmt.where(ExternalExecutionAttempt.environment == environment)
        if execution_mode is not None:
            stmt = stmt.where(ExternalExecutionAttempt.execution_mode == execution_mode)
        stmt = stmt.order_by(ExternalExecutionAttempt.completed_at.desc(), ExternalExecutionAttempt.attempt_number.desc())
        return self.session.scalar(stmt)

    def list_unknown_outcomes(self, *, environment: str | None = None) -> list[ExternalExecutionAttempt]:
        stmt = select(ExternalExecutionAttempt).where(
            ExternalExecutionAttempt.outcome_status == "sandbox_unknown_outcome"
        )
        if environment is not None:
            stmt = stmt.where(ExternalExecutionAttempt.environment == environment)
        stmt = stmt.order_by(ExternalExecutionAttempt.completed_at.asc(), ExternalExecutionAttempt.attempt_number.asc())
        return list(self.session.scalars(stmt))


class SandboxReconciliationRecordRepository(BaseRepository[SandboxReconciliationRecord]):
    model = SandboxReconciliationRecord

    def upsert_via_merge(self, instance: SandboxReconciliationRecord) -> SandboxReconciliationRecord:
        raise NotImplementedError("Sandbox reconciliation records are append-only.")

    def list_for_attempt(self, external_execution_attempt_id: str) -> list[SandboxReconciliationRecord]:
        stmt = (
            select(SandboxReconciliationRecord)
            .where(SandboxReconciliationRecord.external_execution_attempt_id == external_execution_attempt_id)
            .order_by(SandboxReconciliationRecord.reconciled_at.asc(), SandboxReconciliationRecord.created_at.asc())
        )
        return list(self.session.scalars(stmt))

    def latest_for_attempt(self, external_execution_attempt_id: str) -> SandboxReconciliationRecord | None:
        stmt = (
            select(SandboxReconciliationRecord)
            .where(SandboxReconciliationRecord.external_execution_attempt_id == external_execution_attempt_id)
            .order_by(SandboxReconciliationRecord.reconciled_at.desc(), SandboxReconciliationRecord.created_at.desc())
        )
        return self.session.scalar(stmt)
