"""
books_recon explicit sandbox reconciliation runner.

Run from project root:
  cd C:\\sattva\\books_recon
  python -u .\\run_sandbox_reconcile.py --list
  python -u .\\run_sandbox_reconcile.py --attempt-id <attempt_uuid> --actor codex
"""

from __future__ import annotations

import argparse
import sys

sys.path.insert(0, "src")

from apps.cli.main import _build_reconciliation
from db.session import get_session_factory


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="run_sandbox_reconcile")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--list", action="store_true")
    group.add_argument("--attempt-id")
    parser.add_argument("--actor", default="sandbox_reconciler")
    return parser


def main() -> None:
    args = _build_parser().parse_args()
    session = get_session_factory()()
    try:
        reconciliation = _build_reconciliation(session)

        if args.list:
            print("=" * 60)
            print("UNRESOLVED SANDBOX UNKNOWN OUTCOMES")
            items = reconciliation.inspect_unresolved_unknown_outcomes()
            if not items:
                print("  none")
            for item in items:
                print("-" * 60)
                print(f"  attempt_id                  : {item.attempt_id}")
                print(f"  proposal_id                 : {item.proposal_id}")
                print(f"  target_module               : {item.target_module}")
                print(f"  idempotency_key             : {item.idempotency_key}")
                print(f"  request_hash                : {item.request_hash}")
                print(f"  latest_reconciliation_status: {item.latest_reconciliation_status}")
            print("=" * 60)
            print(f"TOTAL: {len(items)}")
            return

        print("=" * 60)
        print("STEP 1: reconcile sandbox attempt")
        result = reconciliation.reconcile_attempt(args.attempt_id, actor=args.actor)
        print(f"  attempt_id           : {result.attempt_id}")
        print(f"  reconciliation_status: {result.reconciliation_status}")
        print(f"  lookup_strategy      : {result.lookup_strategy}")
        print(f"  matched_external_id  : {result.matched_external_id}")
        print(f"  matched_external_no  : {result.matched_external_number}")
        print(f"  receipt_id           : {result.receipt_id}")
        print(f"  record_id            : {result.reconciliation_record_id}")

        session.commit()
        print("=" * 60)
        print("DONE")
        print(f"  attempt_id           : {result.attempt_id}")
        print(f"  reconciliation_status: {result.reconciliation_status}")
        print(f"  receipt_id           : {result.receipt_id}")
    except Exception:
        session.rollback()
        import traceback

        traceback.print_exc()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
