"""Zoho snapshot schemas."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class ZohoSnapshotBillCreate(BaseModel):
    snapshot_at: datetime
    snapshot_batch_key: str
    zoho_object_id: str
    vendor_name: str
    vendor_id: str
    bill_number: str
    bill_date: date
    total: float
    balance: float
    status: str
    payload: dict

