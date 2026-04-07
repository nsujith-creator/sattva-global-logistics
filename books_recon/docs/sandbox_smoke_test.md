# Sandbox Smoke Test Guide

Use this only in a controlled Zoho sandbox. Do not point these steps at production.

These steps assume a dev environment with Python and `pytest` available.

## Preconditions

- `BOOKS_RECON_ZOHO_SANDBOX_ENABLED=true`
- sandbox org/client/secret/refresh token configured
- sandbox-paid-through account configured
- vendor master rows have `zoho_contact_id`
- active `zoho_account_mapping` rows exist for bill posting accounts
- active `zoho_tax_mapping` rows exist for bill tax codes

## Recommended Order

1. Create or load an approved proposal that already passes D6 preflight.
2. Run the existing dry-run path first and inspect the prepared request artifact.
3. Execute the same proposal with `mode=sandbox_execute`.
   Example:
   `python -m apps.cli.main execute-sandbox <proposal_id> --actor smoke_test`
4. Verify:
   - a new `dry_run_execution_artifact` row was appended
   - a new `external_execution_attempt` row was appended
   - `zoho_posting_receipt.environment == "sandbox"` on success
   - `external_execution_attempt.external_correlation_ids_json` captured request ids if returned
   - `sandbox_unknown_outcome` blocks re-execution until reconciliation
   - `external_execution_attempt.external_lookup_keys_json` contains stable lookup fields

## Reconciliation Drill

If sandbox execution ends in `sandbox_unknown_outcome`:

1. Inspect unresolved attempts:
   `python -m apps.cli.main list-sandbox-unknown`
2. Reconcile a specific attempt explicitly:
   `python -m apps.cli.main reconcile-sandbox-attempt <attempt_id> --actor smoke_test`
3. Confirm the result is one of:
   - `reconciled_success`
   - `reconciled_failure`
   - `still_unknown`
4. Re-run sandbox execution only after an explicit `reconciled_failure`.
5. Do not re-run automatically after `still_unknown`.

## What To Check In Zoho Sandbox

- the created `bill_id` or `payment_id`
- the request/reference number used
- account/tax mappings on the created bill
- whether the external request id matches the local attempt ledger
- whether reconciliation lookup keys actually find the created object

## Failure Drill

Repeat the smoke test with:

- a missing `zoho_tax_mapping`
- a missing `zoho_account_mapping`
- sandbox flag disabled

Expected result: no live call should proceed, and the artifact should show a blocked sandbox failure.
