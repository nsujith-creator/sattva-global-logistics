"""
books_recon explicit sandbox execution runner.

Run from project root:
  cd C:\\sattva\\books_recon
  python -u .\\run_sandbox_execute.py --proposal-id <proposal_uuid> --actor codex
"""

from __future__ import annotations

import argparse
import sys

sys.path.insert(0, "src")

from apps.cli.main import _build_reviewer_ops
from db.repositories.proposals import ExternalExecutionAttemptRepository, ZohoPostingReceiptRepository
from db.session import get_session_factory


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="run_sandbox_execute")
    parser.add_argument("--proposal-id", required=True)
    parser.add_argument("--actor", default="sandbox_runner")
    return parser


def main() -> None:
    args = _build_parser().parse_args()
    session = get_session_factory()()
    try:
        ops = _build_reviewer_ops(session)

        print("=" * 60)
        print("STEP 1: preflight")
        preflight = ops.run_preflight(args.proposal_id)
        print(f"  proposal_id          : {preflight.proposal_id}")
        print(f"  preflight_status     : {preflight.preflight_status}")
        print(f"  eligible_for_posting : {preflight.eligible_for_posting}")
        if preflight.posting_block_reasons:
            print(f"  block_reasons        : {preflight.posting_block_reasons}")

        print("=" * 60)
        print("STEP 2: sandbox execution")
        result = ops.run_executor(args.proposal_id, actor=args.actor, mode="sandbox_execute")
        print(f"  proposal_id          : {result.proposal_id}")
        print(f"  preflight_status     : {result.preflight_status}")
        print(f"  execution_status     : {result.execution_status}")
        print(f"  artifact_id          : {result.artifact_id}")
        print(f"  attempt_id           : {result.attempt_id}")
        if result.block_reasons:
            print(f"  block_reasons        : {result.block_reasons}")

        receipt = None
        if result.attempt_id is not None:
            attempt = ExternalExecutionAttemptRepository(session).get(result.attempt_id)
            if attempt is not None and attempt.receipt_id is not None:
                receipt = ZohoPostingReceiptRepository(session).get(attempt.receipt_id)
        if receipt is not None:
            print(f"  receipt_id           : {receipt.id}")
            print(f"  receipt_status       : {receipt.posting_status}")
            print(f"  receipt_external_id  : {receipt.target_external_id}")
        else:
            print("  receipt_status       : none")

        session.commit()
        print("=" * 60)
        print("DONE")
        print(f"  proposal_id          : {result.proposal_id}")
        print(f"  execution_status     : {result.execution_status}")
        print(f"  artifact_id          : {result.artifact_id}")
        print(f"  attempt_id           : {result.attempt_id}")
    except Exception:
        session.rollback()
        import traceback

        traceback.print_exc()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
