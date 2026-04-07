"""GSTR-2B ingestion working slice."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from db.models.evidence import SourceDocument, SourceRecord
from db.models.tax import GstPurchaseLine
from db.repositories.gst import GstPurchaseLineRepository
from db.repositories.source import SourceRecordRepository
from core.hashing import stable_payload_hash


def _parse_gst_date(value: str):
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unsupported GST date format: {value}")


def _gst_decimal(value: str | None) -> Decimal:
    raw = (value or "").strip().replace(",", "")
    if raw == "":
        return Decimal("0")
    return Decimal(raw)


@dataclass(frozen=True)
class ParsedGstr2BRow:
    row_number: int
    supplier_gstin: str
    supplier_name: str
    invoice_number: str
    invoice_date: datetime.date
    taxable_value: Decimal
    igst_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    cess_amount: Decimal
    total_tax_amount: Decimal
    filing_period: str
    invoice_type: str | None
    place_of_supply: str | None
    itc_availability: str | None
    raw_payload: dict

    def fingerprint(self) -> str:
        return stable_payload_hash(
            {
                "supplier_gstin": self.supplier_gstin,
                "invoice_number": self.invoice_number,
                "invoice_date": self.invoice_date.isoformat(),
                "taxable_value": str(self.taxable_value),
                "total_tax_amount": str(self.total_tax_amount),
            }
        )


class Gstr2BImportService:
    extraction_version = "gstr2b_csv_v1"

    def __init__(self, source_record_repository: SourceRecordRepository, gst_repository: GstPurchaseLineRepository) -> None:
        self.source_record_repository = source_record_repository
        self.gst_repository = gst_repository

    def persist_rows(self, source_document: SourceDocument, rows: list[ParsedGstr2BRow]) -> dict[str, int]:
        created_records = 0
        created_lines = 0
        for row in rows:
            record = SourceRecord(
                source_document_id=source_document.id,
                record_type="gst_purchase_line",
                source_row_number=row.row_number,
                record_fingerprint=row.fingerprint(),
                extraction_version=self.extraction_version,
                parse_status="parsed",
                event_date=row.invoice_date,
                amount=row.taxable_value + row.total_tax_amount,
                currency_code="INR",
                raw_payload=row.raw_payload,
                normalized_payload={
                    "supplier_gstin": row.supplier_gstin,
                    "supplier_name": row.supplier_name,
                    "invoice_number": row.invoice_number,
                    "invoice_date": row.invoice_date.isoformat(),
                    "taxable_value": str(row.taxable_value),
                    "total_tax_amount": str(row.total_tax_amount),
                    "filing_period": row.filing_period,
                },
                quality_score=1,
                review_required=False,
            )
            persisted_record = self.source_record_repository.upsert_by_lineage(record)
            if persisted_record is record:
                created_records += 1

            line = GstPurchaseLine(
                source_record_id=persisted_record.id,
                supplier_gstin=row.supplier_gstin,
                supplier_name=row.supplier_name,
                invoice_number=row.invoice_number,
                invoice_date=row.invoice_date,
                invoice_type=row.invoice_type,
                place_of_supply=row.place_of_supply,
                taxable_value=row.taxable_value,
                igst_amount=row.igst_amount,
                cgst_amount=row.cgst_amount,
                sgst_amount=row.sgst_amount,
                cess_amount=row.cess_amount,
                total_tax_amount=row.total_tax_amount,
                itc_availability=row.itc_availability,
                filing_period=row.filing_period,
                match_status="unmatched",
            )
            persisted_line = self.gst_repository.upsert_by_source_record(line)
            if persisted_line is line:
                created_lines += 1

        return {
            "rows_seen": len(rows),
            "source_records_created": created_records,
            "gst_purchase_lines_created": created_lines,
        }
