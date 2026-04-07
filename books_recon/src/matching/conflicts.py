"""Conflict detection over match candidates."""

from __future__ import annotations

from dataclasses import dataclass

from core.hashing import stable_payload_hash
from db.models.workflow import MatchCandidate


@dataclass(frozen=True)
class ConflictGroup:
    conflict_group_id: str
    conflict_type: str
    candidates: list[MatchCandidate]


class MatchConflictDetector:
    def __init__(self, *, high_score_threshold: float = 0.9) -> None:
        self.high_score_threshold = high_score_threshold

    def detect(self, candidates: list[MatchCandidate]) -> list[ConflictGroup]:
        by_target_type: dict[str, list[MatchCandidate]] = {}
        for candidate in candidates:
            if float(candidate.score) < self.high_score_threshold:
                continue
            by_target_type.setdefault(candidate.to_object_type, []).append(candidate)

        conflicts: list[ConflictGroup] = []
        for target_type, grouped in by_target_type.items():
            if len(grouped) < 2:
                continue
            conflict_group_id = stable_payload_hash(
                {
                    "target_type": target_type,
                    "candidate_ids": sorted(str(candidate.id) for candidate in grouped if candidate.id),
                    "bundle_id": grouped[0].evidence_bundle_id,
                }
            )
            conflicts.append(
                ConflictGroup(
                    conflict_group_id=conflict_group_id,
                    conflict_type=f"multiple_high_score_{target_type}",
                    candidates=grouped,
                )
            )
        return conflicts
