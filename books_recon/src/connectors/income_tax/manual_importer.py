"""Manual income-tax evidence import stub."""

from __future__ import annotations

from pathlib import Path


class IncomeTaxManualImportAdapter:
    def import_file(self, source_path: Path) -> list[dict]:
        raise NotImplementedError("Income-tax manual import remains read-side only and unimplemented in this phase.")

