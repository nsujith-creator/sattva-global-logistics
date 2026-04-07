"""Application settings loaded from environment and legacy Zoho config."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from core.constants import APP_ENV_LOCAL, DEFAULT_SECRET_PROVIDER, DEFAULT_TIMEZONE


LEGACY_ZOHO_CONFIG_PATH = Path(r"C:\temp\zoho\config.json")
LEGACY_ZOHO_API_DOMAIN = "https://www.zohoapis.in"
LEGACY_ZOHO_ACCOUNTS_URL = "https://accounts.zoho.in"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="BOOKS_RECON_",
        extra="ignore",
    )

    env: str = APP_ENV_LOCAL
    app_name: str = "books-recon"
    log_level: str = "INFO"
    timezone: str = DEFAULT_TIMEZONE
    database_url: str = Field(..., description="SQLAlchemy database URL")
    evidence_root: Path = Path("./data/raw")
    staged_root: Path = Path("./data/staged")
    export_root: Path = Path("./data/exports")
    secret_provider: str = DEFAULT_SECRET_PROVIDER

    zoho_read_client_id: str | None = None
    zoho_read_client_secret: str | None = None
    zoho_read_refresh_token: str | None = None
    zoho_org_id: str | None = None
    zoho_sandbox_enabled: bool = False
    zoho_sandbox_org_id: str | None = None
    zoho_sandbox_api_domain: str | None = None
    zoho_sandbox_accounts_url: str = "https://accounts.zoho.com"
    zoho_sandbox_client_id: str | None = None
    zoho_sandbox_client_secret: str | None = None
    zoho_sandbox_refresh_token: str | None = None
    zoho_sandbox_paid_through_account_id: str | None = None
    zoho_legacy_config_path: Path | None = LEGACY_ZOHO_CONFIG_PATH


def _load_legacy_zoho_config(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (FileNotFoundError, OSError, ValueError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _apply_legacy_zoho_defaults(settings: Settings) -> Settings:
    legacy = _load_legacy_zoho_config(settings.zoho_legacy_config_path)
    if not legacy:
        return settings

    organization_id = legacy.get("organization_id") or legacy.get("org_id")
    settings.zoho_sandbox_client_id = settings.zoho_sandbox_client_id or legacy.get("client_id")
    settings.zoho_sandbox_client_secret = settings.zoho_sandbox_client_secret or legacy.get("client_secret")
    settings.zoho_sandbox_refresh_token = settings.zoho_sandbox_refresh_token or legacy.get("refresh_token")
    settings.zoho_sandbox_org_id = settings.zoho_sandbox_org_id or organization_id
    settings.zoho_sandbox_api_domain = settings.zoho_sandbox_api_domain or legacy.get("api_domain") or LEGACY_ZOHO_API_DOMAIN

    if settings.zoho_sandbox_accounts_url == "https://accounts.zoho.com":
        settings.zoho_sandbox_accounts_url = legacy.get("accounts_url") or LEGACY_ZOHO_ACCOUNTS_URL

    settings.zoho_read_client_id = settings.zoho_read_client_id or legacy.get("client_id")
    settings.zoho_read_client_secret = settings.zoho_read_client_secret or legacy.get("client_secret")
    settings.zoho_read_refresh_token = settings.zoho_read_refresh_token or legacy.get("refresh_token")
    settings.zoho_org_id = settings.zoho_org_id or organization_id
    return settings


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return _apply_legacy_zoho_defaults(Settings())
