"""GST schemas."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class GstPurchaseLineCreate(BaseModel):
    source_record_id: str
    supplier_gstin: str
    supplier_name: str
    invoice_number: str
    invoice_date: date
    taxable_value: float
    total_tax_amount: float
    filing_period: str

