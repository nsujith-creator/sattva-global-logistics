# Posting Policy

## Purpose

Posting policy governs how approved accounting intent becomes Zoho writes.

Non-negotiable principles:
- only `posting_service` may write to Zoho
- every write uses idempotency keys
- destructive edits are forbidden
- corrections use reversal plus replacement
- closed periods are protected

## Posting Modes

| Mode | Purpose | Writes to Zoho? | Receipt required? |
|---|---|---|---|
| `dry_run` | simulate exact posting payload and controls | no | yes, `posting_status=simulated` |
| `review_only` | generate proposal package without execution | no | optional simulated receipt or audit event |
| `approved_post` | perform approved live Zoho write | yes | yes |
| `reversal_post` | post reversing entry or reversing transaction sequence | yes | yes |

## Mode Rules

### dry_run

Requirements:
- full payload generated
- idempotency key computed
- no Zoho mutation
- receipt stored with request hash

### review_only

Use when:
- evidence is incomplete
- confidence is below threshold
- amount is material
- period is sensitive

### approved_post

Allowed only if:
- proposal status = `approved`
- final approval exists
- no blocking exception
- target period allowed by lock rules
- no successful receipt exists for the same idempotency key

### reversal_post

Required when:
- correcting previously posted data
- replacing a wrong proposal
- dealing with closed period changes

Rules:
- identify prior successful `zoho_posting_receipt`
- create explicit reversal proposal linked to prior receipt
- post reversal in allowed period
- optionally post replacement proposal after reversal approval

## Idempotency Keys

Key inputs:
- target system
- posting mode
- proposal fingerprint
- target object type
- semantic line content hash
- reversal parent id if reversal

Conceptual format:

`sha256(target_system|posting_mode|proposal_fingerprint|target_object_type|semantic_payload_hash|reversal_parent)`

Behavior:

| Scenario | Expected behavior |
|---|---|
| same proposal posted twice | second attempt returns `duplicate_suppressed` |
| retry after timeout with same key | safe to retry and reconcile to prior receipt |
| payload changed but same business case | new proposal fingerprint, new key |
| reversal of prior receipt | new key, with `reversal_of_receipt_id` set |

## Zoho Write Constraints

Allowed early write object types:
- vendor bills
- vendor payments / payment applications
- expenses
- journals

Writes must not:
- edit or delete an existing Zoho object destructively
- mutate objects outside approved proposal scope
- bypass receipt capture

Credential policy:
- read connector credentials should be separate from write credentials where possible
- write credential should have the narrowest feasible permissions

## Reversal Model

General rule:

Correction = `reverse prior accounting impact` + `post corrected replacement if needed`

Never:
- delete prior proposal
- delete prior receipt
- overwrite prior classification as if it never happened

Instead:
- supersede old classification/proposal
- link reversal receipt to original receipt
- preserve chain for audit

Example: wrong expense should be drawings
1. identify prior receipt
2. create reversal proposal for wrong expense impact
3. create replacement drawings proposal
4. approve and post both under correction workflow

Example: wrong vendor payment allocation
1. identify prior payment application receipt
2. create reversal or compensating reallocation proposal
3. create corrected allocation proposal

## Period Lock Enforcement

| State | Behavior |
|---|---|
| `open` | approved post allowed |
| `soft_locked` | approved post allowed only with elevated approval flag |
| `hard_locked` | direct post blocked; reversal workflow only |

Pre-write checks:
1. proposal approved
2. no blocking exception
3. fiscal year/month lock status
4. no existing successful receipt with same idempotency key
5. request hash matches approved proposal snapshot

If any check fails:
- no Zoho write
- receipt status = `failed` or audit event only
- exception raised where appropriate

## Proposal-to-Posting Contract

Before posting, the proposal must fully specify:
- target object type
- lines and amounts
- vendor/contact reference
- account references
- tax treatment
- evidence bundle refs
- narrative
- target period

Posting service must not invent missing accounting facts.
If a required Zoho field is unknown:
- proposal cannot proceed to approved post

## Receipts and Failure Handling

Every attempted post must leave:
- `zoho_posting_receipt`
- `audit_event`

Receipt minimum contents:
- idempotency key
- request hash
- target object type
- posting status
- response code
- sanitized response payload

Failure handling:

| Failure | Handling |
|---|---|
| network timeout before response | retry with same idempotency key after checking receipts and Zoho refs |
| Zoho validation error | mark failed, open exception, no auto-mutation |
| duplicate suppression hit | keep original receipt, mark retry as duplicate suppressed |
| partial application issue | fail proposal, require review; do not silently post remainder |
