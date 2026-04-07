"""Zoho snapshot read adapter."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx

from core.config import Settings


class ZohoSnapshotReadAdapter:
    def __init__(self, settings: Settings | None = None, client: httpx.Client | None = None) -> None:
        self.settings = settings
        self.client = client or httpx.Client(timeout=30.0)

    def fetch_bills(self) -> list[dict]:
        return self._fetch_collection(resource="bills", collection_key="bills")

    def fetch_vendor_payments(self) -> list[dict]:
        return self._fetch_collection(resource="vendorpayments", collection_key="vendorpayments")

    def fetch_expenses(self) -> list[dict]:
        return self._fetch_collection(resource="expenses", collection_key="expenses")

    def fetch_journals(self) -> list[dict]:
        return self._fetch_collection(resource="journals", collection_key="journals")

    def fetch_contacts(self) -> list[dict]:
        return self._fetch_collection(resource="contacts", collection_key="contacts")

    def fetch_chart_of_accounts(self) -> list[dict]:
        return self._fetch_collection(resource="chartofaccounts", collection_key="chartofaccounts")

    def load_snapshot_file(self, source_path: Path) -> list[dict]:
        with source_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict):
            for key in ("bills", "vendor_payments", "expenses", "journals", "contacts", "chartofaccounts", "items"):
                value = payload.get(key)
                if isinstance(value, list):
                    return value
        raise ValueError("Unsupported Zoho snapshot JSON payload structure.")

    def _fetch_collection(self, *, resource: str, collection_key: str) -> list[dict[str, Any]]:
        access_token, api_domain = self._refresh_access_token()
        base_url = f"{api_domain.rstrip('/')}/books/v3/{resource}"
        page = 1
        rows: list[dict[str, Any]] = []

        while True:
            response = self.client.get(
                base_url,
                headers={"Authorization": f"Zoho-oauthtoken {access_token}"},
                params={
                    "organization_id": self._require_org_id(),
                    "page": page,
                    "per_page": 200,
                },
            )
            response.raise_for_status()
            payload = response.json()
            items = payload.get(collection_key)
            if not isinstance(items, list):
                raise ValueError(f"Zoho response for {resource} does not contain list key {collection_key!r}.")
            rows.extend(item for item in items if isinstance(item, dict))

            page_context = payload.get("page_context") or {}
            has_more = bool(
                page_context.get("has_more_page")
                or page_context.get("has_more")
                or (page_context.get("page") and page_context.get("total_pages") and page_context["page"] < page_context["total_pages"])
            )
            if not has_more:
                break
            page += 1

        return rows

    def _refresh_access_token(self) -> tuple[str, str]:
        if self.settings is None:
            raise ValueError("Zoho snapshot reader settings are not configured.")
        if not self.settings.zoho_sandbox_client_id or not self.settings.zoho_sandbox_client_secret or not self.settings.zoho_sandbox_refresh_token:
            raise ValueError("Zoho sandbox credentials are incomplete.")
        response = self.client.post(
            f"{self.settings.zoho_sandbox_accounts_url.rstrip('/')}/oauth/v2/token",
            params={
                "grant_type": "refresh_token",
                "client_id": self.settings.zoho_sandbox_client_id,
                "client_secret": self.settings.zoho_sandbox_client_secret,
                "refresh_token": self.settings.zoho_sandbox_refresh_token,
            },
        )
        response.raise_for_status()
        payload = response.json()
        access_token = payload.get("access_token")
        api_domain = payload.get("api_domain") or self.settings.zoho_sandbox_api_domain
        if not access_token or not api_domain:
            raise ValueError("Zoho sandbox token response is missing access token or api_domain.")
        return str(access_token), str(api_domain)

    def _require_org_id(self) -> str:
        if self.settings is None:
            raise ValueError("Zoho snapshot reader settings are not configured.")
        if not self.settings.zoho_sandbox_org_id:
            raise ValueError("Zoho sandbox organization id is not configured.")
        return str(self.settings.zoho_sandbox_org_id)
