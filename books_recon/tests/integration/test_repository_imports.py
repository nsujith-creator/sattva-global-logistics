"""Repository import smoke tests."""

from db.repositories import (
    ApprovalDecisionRepository,
    AuditEventRepository,
    BankTransactionRepository,
    ClassificationResultRepository,
    EvidenceBundleItemRepository,
    EvidenceBundleRepository,
    ExceptionCaseRepository,
    GstPurchaseLineRepository,
    MatchCandidateRepository,
    ProposalLineRepository,
    ProposalRepository,
    RuleVersionRepository,
    SourceDocumentRepository,
    SourceRecordRepository,
    VendorAliasRepository,
    VendorMasterRepository,
    ZohoSnapshotRepository,
)


def test_repository_classes_import() -> None:
    assert SourceDocumentRepository
    assert SourceRecordRepository
    assert BankTransactionRepository
    assert GstPurchaseLineRepository
    assert ZohoSnapshotRepository
    assert VendorMasterRepository
    assert VendorAliasRepository
    assert RuleVersionRepository
    assert EvidenceBundleRepository
    assert EvidenceBundleItemRepository
    assert MatchCandidateRepository
    assert ClassificationResultRepository
    assert ExceptionCaseRepository
    assert ProposalLineRepository
    assert ProposalRepository
    assert ApprovalDecisionRepository
    assert AuditEventRepository
