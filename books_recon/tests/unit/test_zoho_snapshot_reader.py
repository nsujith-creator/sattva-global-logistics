from __future__ import annotations

import httpx

from connectors.zoho.snapshot_reader import ZohoSnapshotReadAdapter
from core.config import Settings


class _FakeClient:
    def __init__(self) -> None:
        self.get_calls: list[dict] = []

    def post(self, url: str, params: dict):
        return httpx.Response(
            200,
            json={"access_token": "token-1", "api_domain": "https://sandbox.zoho.test"},
            request=httpx.Request("POST", url),
        )

    def get(self, url: str, headers: dict, params: dict):
        self.get_calls.append({"url": url, "headers": headers, "params": params})
        page = int(params["page"])
        payload = {
            "bills": [{"bill_id": f"bill-{page}", "bill_number": f"BILL-{page}"}],
            "page_context": {"has_more_page": page == 1},
        }
        return httpx.Response(200, json=payload, request=httpx.Request("GET", url))


def _settings() -> Settings:
    return Settings.model_construct(
        database_url="sqlite+pysqlite:///:memory:",
        zoho_sandbox_org_id="org-1",
        zoho_sandbox_api_domain="https://sandbox.zoho.test",
        zoho_sandbox_accounts_url="https://accounts.zoho.test",
        zoho_sandbox_client_id="client-1",
        zoho_sandbox_client_secret="secret-1",
        zoho_sandbox_refresh_token="refresh-1",
    )


def test_fetch_bills_paginates_and_returns_real_object_ids() -> None:
    client = _FakeClient()
    reader = ZohoSnapshotReadAdapter(_settings(), client=client)

    rows = reader.fetch_bills()

    assert [row["bill_id"] for row in rows] == ["bill-1", "bill-2"]
    assert len(client.get_calls) == 2
    assert client.get_calls[0]["params"]["organization_id"] == "org-1"


def test_missing_org_id_fails_fast() -> None:
    settings = Settings.model_construct(
        database_url="sqlite+pysqlite:///:memory:",
        zoho_sandbox_api_domain="https://sandbox.zoho.test",
        zoho_sandbox_accounts_url="https://accounts.zoho.test",
        zoho_sandbox_client_id="client-1",
        zoho_sandbox_client_secret="secret-1",
        zoho_sandbox_refresh_token="refresh-1",
    )
    reader = ZohoSnapshotReadAdapter(settings, client=_FakeClient())

    try:
        reader.fetch_bills()
    except ValueError as exc:
        assert "organization id" in str(exc)
    else:
        raise AssertionError("Expected missing org id to raise ValueError")
