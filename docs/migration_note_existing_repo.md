# Migration Note: Existing Repo to New System

## Migration Position

The current repo is not the target system.
It is source material and a live operations risk.

Treat it as:
- a reference implementation for narrow AP ingestion behavior
- a source of sample invoices and Zoho interaction patterns
- a system to be quarantined, not extended blindly

## What Will Be Reused

### Reuse conceptually

- Zoho OAuth refresh and request patterns
- Zoho snapshot fetch patterns for bills, contacts, chart of accounts, and taxes
- deterministic MBL/BL extraction logic
- real-world invoice corpus and MBL test cases
- watcher pattern only as an optional future ingest trigger
- logging categories: created, skipped, needs review, failed

### Reuse with refactor

| Existing element | Reuse approach |
|---|---|
| `extract_mbl.py` logic | move into extraction module with versioning and tests |
| Zoho `GET` helpers | refactor into read-only connector layer |
| duplicate-precheck idea | replace with true fingerprints and receipts |
| parsed cache idea | replace with extraction cache keyed by document hash + extractor version |

## What Will Be Discarded

- monolithic `zoho_bills.py`
- direct parse-to-post control flow
- hardcoded secrets
- hardcoded Zoho org/account/tax/vendor ids in source
- filename-based dedupe as primary control
- substring vendor matching as posting authority
- single hardcoded expense account for all bills
- ad hoc JSON files as system-of-record state
- full-folder reruns triggered by one new file event
- one-off posting scripts such as `create_kappal_bill.py`

## Immediate Security Remediation Steps

1. Revoke and rotate Zoho:
   - refresh token
   - access token
   - client secret
   - any grant token references
2. Rotate Anthropic API key.
3. Rotate Google OAuth client secret.
4. Remove secrets from old repo files, docs, logs, and accessible backups.
5. Move secrets to `.env` plus secure local token storage / OS keyring.
6. Separate read and write credentials if Zoho permissions allow it.
7. Freeze the old watcher-based unattended posting flow until remediation is complete.

## Safe Transition Strategy

### Stage 0: Quarantine

- treat old repo as read-only reference
- disable unattended watcher-based posting
- archive logs and PDFs as evidence source, not active operational state

### Stage 1: Rebuild read side first

- implement new evidence vault
- import old invoice PDFs as `source_document`
- pull Zoho snapshots into new snapshot tables
- import bank and GSTR-2B data into new system

### Stage 2: Reproduce useful AP knowledge as proposals

- port MBL extraction rules
- port vendor normalization aliases into `vendor_master`
- recreate AP bill candidate generation as dry-run proposals only

### Stage 3: Approval and controlled posting

- route all future vendor bill actions through proposals and approvals
- only then enable posting service

## Transition of Existing Operational Assets

### Invoice PDFs

Use as:
- source evidence
- parser fixtures
- vendor normalization seed material

Do not use as proof that a Zoho bill was correctly booked.

### Current JSON logs

Useful sources:
- `invoice_log.json`
- `failed_invoices.json`
- `run_log.json`

Use as:
- migration hints
- evidence of prior automation behavior
- candidate mapping references

Do not use as authoritative ledger.

### Existing Zoho data

Use as:
- one evidence source
- settlement/open balance source
- target posting system

Do not use as unquestioned truth for historical reconstruction.

## Mapping Old Flow to New Flow

Old flow:

`PDF -> AI parse -> duplicate precheck -> Zoho POST`

New flow:

`Evidence ingest -> extract -> normalize -> match -> classify -> proposal -> approval -> posting`

## Specific Migration Notes by Business Case

### Drawings

Old repo:
- no proprietor drawings handling

New system:
- bank transactions checked against personal fingerprints
- above/below INR 30,000 rule enforced
- proposal layer required

### Kotak settlements

Old repo:
- no payment allocation engine

New system:
- configurable settlement policy
- FIFO due-date allocation for Kotak
- explicit residual vendor advances

### GST reconstruction

Old repo:
- invoice PDF posting only

New system:
- GSTR-2B becomes first-class evidence source
- missing-bill candidates generated
- conflicts surfaced, not hidden

### Tax payments

Old repo:
- no tax payment classification system

New system:
- bank + challan + portal/manual evidence reconciliation
- exact classes for advance tax, self-assessment tax, GST liability, interest, and penalty

## Operational Cutover Recommendation

1. stop using old watcher for unattended posting
2. build new read-side system and import evidence
3. run both systems only for read comparison, not dual-posting
4. once proposal/approval/posting service is ready, cut over new bill handling to the new workflow
5. keep old repo archived for reference only

## Success Criteria for Migration

Migration is successful when:
- no live secrets remain in source
- historical evidence is loaded with lineage
- new proposals can explain prior and future postings
- Zoho writes occur only through approved, idempotent posting receipts
