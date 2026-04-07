"""Settings smoke tests."""

from core.config import Settings


def test_settings_can_be_constructed() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://books_recon:change_me@localhost:5432/books_recon",
    )
    assert settings.app_name == "books-recon"

