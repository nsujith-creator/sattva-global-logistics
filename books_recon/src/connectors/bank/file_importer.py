"""Bank file import adapter with one working CSV parser."""

from __future__ import annotations

import csv
from pathlib import Path

from ingestion.bank_import import ParsedBankRow, _parse_date, _to_decimal


HEADER_ALIASES = {
    "date": "date",
    "transaction date": "date",
    "value date": "value_date",
    "narration": "narration",
    "description": "narration",
    "debit": "debit",
    "credit": "credit",
    "reference": "reference",
    "ref": "reference",
    "utr": "reference",
    "channel": "channel",
    "counterparty": "counterparty",
    "party": "counterparty",
    "account number": "account_number",
    "account": "account_number",
}


class BankFileImportAdapter:
    def import_file(self, source_path: Path) -> list[dict]:
        with source_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            normalized_rows: list[ParsedBankRow] = []
            for row_number, row in enumerate(reader, start=2):
                canonical = self._canonicalize_row(row)
                debit = _to_decimal(canonical.get("debit"))
                credit = _to_decimal(canonical.get("credit"))
                if debit and credit:
                    raise ValueError(f"Row {row_number} has both debit and credit populated.")
                direction = "credit" if credit > 0 else "debit"
                amount = credit if credit > 0 else debit
                normalized_rows.append(
                    ParsedBankRow(
                        row_number=row_number,
                        transaction_date=_parse_date(canonical["date"]),
                        value_date=_parse_date(canonical["value_date"]) if canonical.get("value_date") else None,
                        narration=canonical.get("narration", "").strip(),
                        direction=direction,
                        amount=amount,
                        signed_amount=amount if direction == "credit" else -amount,
                        bank_reference=canonical.get("reference") or None,
                        channel=canonical.get("channel") or None,
                        counterparty_name=canonical.get("counterparty") or None,
                        counterparty_fingerprint=(canonical.get("counterparty") or "").strip().lower() or None,
                        bank_account_ref=canonical.get("account_number", "UNKNOWN"),
                        raw_payload=dict(row),
                    )
                )
        return normalized_rows

    def _canonicalize_row(self, row: dict[str, str]) -> dict[str, str]:
        canonical: dict[str, str] = {}
        for header, value in row.items():
            if header is None:
                continue
            key = HEADER_ALIASES.get(header.strip().lower(), header.strip().lower())
            canonical[key] = value.strip() if isinstance(value, str) else value
        required = {"date", "narration", "debit", "credit"}
        missing = [field for field in required if field not in canonical]
        if missing:
            raise ValueError(f"Missing required bank CSV columns: {', '.join(sorted(missing))}")
        canonical.setdefault("account_number", "UNKNOWN")
        return canonical
