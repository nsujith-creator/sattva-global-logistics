"""Migration file smoke tests."""

from pathlib import Path


def test_initial_migration_exists() -> None:
    migration = Path(__file__).resolve().parents[2] / "src" / "db" / "migrations" / "versions" / "20260329_0001_initial_schema.py"
    assert migration.exists()


def test_initial_migration_is_explicit() -> None:
    migration = Path(__file__).resolve().parents[2] / "src" / "db" / "migrations" / "versions" / "20260329_0001_initial_schema.py"
    text = migration.read_text(encoding="utf-8")
    assert "create_all" not in text
    assert "op.create_table" in text


def test_phase_d5_migration_exists() -> None:
    migration = Path(__file__).resolve().parents[2] / "src" / "db" / "migrations" / "versions" / "20260329_0002_reviewer_controls.py"
    assert migration.exists()


def test_phase_d7_migration_exists() -> None:
    migration = Path(__file__).resolve().parents[2] / "src" / "db" / "migrations" / "versions" / "20260329_0003_dry_run_execution_artifacts.py"
    assert migration.exists()


def test_phase_d9_migration_exists() -> None:
    migration = Path(__file__).resolve().parents[2] / "src" / "db" / "migrations" / "versions" / "20260329_0006_sandbox_reconciliation_and_mapping_registry.py"
    assert migration.exists()
