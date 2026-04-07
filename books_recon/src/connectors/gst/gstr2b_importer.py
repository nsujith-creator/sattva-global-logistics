"""GSTR-2B manual import adapter with one working CSV parser."""

from __future__ import annotations

import csv
from pathlib import Path

from ingestion.gstr2b_import import ParsedGstr2BRow, _gst_decimal, _parse_gst_date


HEADER_ALIASES = {
    "supplier gstin": "supplier_gstin",
    "gstin of supplier": "supplier_gstin",
    "supplier name": "supplier_name",
    "trade/legal name": "supplier_name",
    "invoice number": "invoice_number",
    "invoice no": "invoice_number",
    "invoice date": "invoice_date",
    "taxable value": "taxable_value",
    "igst": "igst_amount",
    "cgst": "cgst_amount",
    "sgst": "sgst_amount",
    "cess": "cess_amount",
    "total tax": "total_tax_amount",
    "filing period": "filing_period",
    "invoice type": "invoice_type",
    "place of supply": "place_of_supply",
    "itc availability": "itc_availability",
}


class Gstr2BManualImportAdapter:
    def import_file(self, source_path: Path) -> list[dict]:
        with source_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            rows: list[ParsedGstr2BRow] = []
            for row_number, row in enumerate(reader, start=2):
                canonical = self._canonicalize_row(row)
                igst = _gst_decimal(canonical.get("igst_amount"))
                cgst = _gst_decimal(canonical.get("cgst_amount"))
                sgst = _gst_decimal(canonical.get("sgst_amount"))
                cess = _gst_decimal(canonical.get("cess_amount"))
                total_tax = _gst_decimal(canonical.get("total_tax_amount")) or igst + cgst + sgst + cess
                rows.append(
                    ParsedGstr2BRow(
                        row_number=row_number,
                        supplier_gstin=canonical["supplier_gstin"],
                        supplier_name=canonical["supplier_name"],
                        invoice_number=canonical["invoice_number"],
                        invoice_date=_parse_gst_date(canonical["invoice_date"]),
                        taxable_value=_gst_decimal(canonical["taxable_value"]),
                        igst_amount=igst,
                        cgst_amount=cgst,
                        sgst_amount=sgst,
                        cess_amount=cess,
                        total_tax_amount=total_tax,
                        filing_period=canonical["filing_period"],
                        invoice_type=canonical.get("invoice_type") or None,
                        place_of_supply=canonical.get("place_of_supply") or None,
                        itc_availability=canonical.get("itc_availability") or None,
                        raw_payload=dict(row),
                    )
                )
        return rows

    def _canonicalize_row(self, row: dict[str, str]) -> dict[str, str]:
        canonical: dict[str, str] = {}
        for header, value in row.items():
            if header is None:
                continue
            key = HEADER_ALIASES.get(header.strip().lower(), header.strip().lower())
            canonical[key] = value.strip() if isinstance(value, str) else value
        required = {"supplier_gstin", "supplier_name", "invoice_number", "invoice_date", "taxable_value", "filing_period"}
        missing = [field for field in required if not canonical.get(field)]
        if missing:
            raise ValueError(f"Missing required GSTR-2B CSV columns: {', '.join(sorted(missing))}")
        return canonical
