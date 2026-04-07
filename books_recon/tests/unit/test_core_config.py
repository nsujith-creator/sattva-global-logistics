from __future__ import annotations

from pathlib import Path

from core.config import get_settings


def test_legacy_zoho_config_populates_sandbox_fields(monkeypatch, tmp_path: Path) -> None:
    legacy = tmp_path / "zoho-config.json"
    legacy.write_text(
        """
{
  "client_id": "legacy-client",
  "client_secret": "legacy-secret",
  "refresh_token": "legacy-refresh",
  "organization_id": "org-123"
}
""".strip(),
        encoding="utf-8",
    )

    monkeypatch.setenv("BOOKS_RECON_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("BOOKS_RECON_ZOHO_LEGACY_CONFIG_PATH", str(legacy))
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.zoho_sandbox_client_id == "legacy-client"
    assert settings.zoho_sandbox_client_secret == "legacy-secret"
    assert settings.zoho_sandbox_refresh_token == "legacy-refresh"
    assert settings.zoho_sandbox_org_id == "org-123"
    assert settings.zoho_sandbox_api_domain == "https://www.zohoapis.in"
    assert settings.zoho_sandbox_accounts_url == "https://accounts.zoho.in"


def test_legacy_zoho_config_accepts_org_id_alias(monkeypatch, tmp_path: Path) -> None:
    legacy = tmp_path / "zoho-config.json"
    legacy.write_text(
        """
{
  "client_id": "legacy-client",
  "client_secret": "legacy-secret",
  "refresh_token": "legacy-refresh",
  "org_id": "org-456"
}
""".strip(),
        encoding="utf-8",
    )

    monkeypatch.setenv("BOOKS_RECON_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("BOOKS_RECON_ZOHO_LEGACY_CONFIG_PATH", str(legacy))
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.zoho_sandbox_org_id == "org-456"
    assert settings.zoho_org_id == "org-456"
