"""Base repository helpers."""

from __future__ import annotations

from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session


ModelT = TypeVar("ModelT")


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, object_id):
        return self.session.get(self.model, object_id)

    def list_all(self) -> list[ModelT]:
        return list(self.session.scalars(select(self.model)))

    def add(self, instance: ModelT) -> ModelT:
        self.session.add(instance)
        self.session.flush()
        return instance

    def upsert_via_merge(self, instance: ModelT) -> ModelT:
        return self.session.merge(instance)
