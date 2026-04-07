r"""
Fetch real Zoho sandbox snapshots, register them as evidence, and import them into snapshot tables.

Run from project root:
  cd C:\sattva\books_recon
  . .\.venv\Scripts\Activate.ps1
  python -u .\sync_zoho_sandbox_snapshots.py
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, "src")

from connectors.zoho.snapshot_reader import ZohoSnapshotReadAdapter
from core.config import get_settings
from db.repositories.source import SourceDocumentRepository, SourceRecordRepository
from db.session import get_session_factory
from ingestion.file_ingestion import FileEvidenceIngestionService
from ingestion.zoho_snapshot_import import ZohoSnapshotImportService


SNAPSHOT_TARGETS = {
    "bills": {
        "snapshot_type": "bill",
        "document_type": "zoho_snapshot_bills_json",
        "fetch_method": "fetch_bills",
        "payload_key": "bills",
    },
    "contacts": {
        "snapshot_type": "contact",
        "document_type": "zoho_snapshot_contacts_json",
        "fetch_method": "fetch_contacts",
        "payload_key": "contacts",
    },
    "chart_accounts": {
        "snapshot_type": "chart_account",
        "document_type": "zoho_snapshot_chart_accounts_json",
        "fetch_method": "fetch_chart_of_accounts",
        "payload_key": "chartofaccounts",
    },
}


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="sync_zoho_sandbox_snapshots")
    parser.add_argument(
        "--targets",
        nargs="+",
        choices=sorted(SNAPSHOT_TARGETS.keys()),
        default=["bills", "contacts", "chart_accounts"],
    )
    parser.add_argument(
        "--batch-key",
        default=f"zoho-sandbox-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
    )
    return parser


def _write_snapshot_file(base_dir: Path, *, batch_key: str, target_name: str, payload_key: str, rows: list[dict]) -> Path:
    base_dir.mkdir(parents=True, exist_ok=True)
    path = base_dir / f"{batch_key}_{target_name}.json"
    with path.open("w", encoding="utf-8") as handle:
        json.dump({payload_key: rows}, handle, indent=2, sort_keys=True, default=str)
    return path


def main() -> None:
    args = _build_parser().parse_args()
    settings = get_settings()
    reader = ZohoSnapshotReadAdapter(settings)
    session = get_session_factory()()

    try:
        ingestion = FileEvidenceIngestionService(SourceDocumentRepository(session))
        importer = ZohoSnapshotImportService(session, SourceRecordRepository(session))
        out_dir = (settings.staged_root / "zoho_sandbox").resolve()

        print("=" * 60)
        print("ZOHO SANDBOX SNAPSHOT SYNC")
        print(f"  batch_key            : {args.batch_key}")
        print(f"  targets              : {', '.join(args.targets)}")
        print(f"  output_dir           : {out_dir}")

        for target_name in args.targets:
            target = SNAPSHOT_TARGETS[target_name]
            fetcher = getattr(reader, target["fetch_method"])

            print("-" * 60)
            print(f"FETCH {target_name}")
            rows = fetcher()
            print(f"  rows_fetched         : {len(rows)}")

            snapshot_file = _write_snapshot_file(
                out_dir,
                batch_key=args.batch_key,
                target_name=target_name,
                payload_key=target["payload_key"],
                rows=rows,
            )
            ingested = ingestion.ingest_file(
                snapshot_file,
                source_system="zoho_sandbox",
                document_type=target["document_type"],
                ingest_batch_key=args.batch_key,
                source_document_ref=f"zoho_sandbox:{target_name}",
            )
            loaded_rows = reader.load_snapshot_file(snapshot_file)
            result = importer.import_rows(
                target["snapshot_type"],
                loaded_rows,
                snapshot_batch_key=args.batch_key,
                source_document=ingested.source_document,
            )
            print(f"  file                 : {snapshot_file}")
            print(f"  source_document_id   : {ingested.source_document.id}")
            print(f"  source_duplicate     : {ingested.was_duplicate}")
            print(f"  rows_seen            : {result['rows_seen']}")
            print(f"  source_records       : {result['source_records_created']}")
            print(f"  snapshots_created    : {result['snapshots_created']}")

        session.commit()
        print("=" * 60)
        print("DONE")
    except Exception:
        session.rollback()
        import traceback

        traceback.print_exc()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
