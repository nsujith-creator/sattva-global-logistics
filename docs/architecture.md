# Books Reconstruction Architecture

## Scope

This system is for:
- historical bookkeeping reconstruction from FY 2022-23 onward
- controlled ongoing posting into Zoho Books

This system is not:
- an autonomous accounting bot
- a direct parse-to-post pipeline
- a system that treats Zoho as the source of truth

Core architectural principle:

`Evidence -> Match -> Classification -> Proposal -> Approval -> Posting`

Posting is the last step, not the first.

## Component Map

| Component | Responsibility | Writes to | Reads from | Notes |
|---|---|---|---|---|
| `ingest_service` | Registers incoming evidence files and portal/manual exports | `source_document`, `audit_event` | local vault, manual drops, connectors | No accounting decisions |
| `extract_service` | Extracts structured records from documents/files | `source_record`, `audit_event` | `source_document` | Versioned extraction |
| `normalize_service` | Standardizes vendor names, dates, money, references, GSTIN, account candidates | normalized `source_record`, `vendor_master`, `account_master`, `audit_event` | `source_record`, master tables | No posting |
| `match_service` | Creates candidate links between evidence and books objects | `match_candidate`, `evidence_bundle`, `audit_event` | normalized records, Zoho snapshots | Deterministic first |
| `rules_engine` | Applies deterministic accounting rules and bounded heuristics | `classification_result`, `exception_case`, `audit_event` | `match_candidate`, `evidence_bundle`, `rule_version` | AI cannot override rules silently |
| `ai_assist_service` | Suggests explanations, narration meaning, head suggestions | advisory payloads, `audit_event` | extracted records, normalized records | Never posts |
| `proposal_service` | Builds reviewable accounting proposals | `posting_proposal`, `posting_proposal_line`, `audit_event` | `classification_result`, evidence | Converts interpretation into action plan |
| `approval_service` | Captures reviewer decisions and escalations | `approval_decision`, `exception_case`, `audit_event` | proposals, evidence, classifications | Human control boundary |
| `posting_service` | Sole Zoho write authority | `zoho_posting_receipt`, `audit_event` | approved proposals, Zoho snapshots | Supports dry run and reversal |
| `audit_service` | Append-only event journal, lineage export, trace views | `audit_event` | all domain tables | Every decision becomes traceable |
| `reporting_service` | Trial balance, reconciliation, exception and comparison outputs | exports, `audit_event` | all domain tables | Must explain unresolved gaps |

## Logical Data Flow

### 1. Evidence intake

Examples:
- bank statement PDF/CSV/XLSX
- GSTR-2B JSON/Excel/PDF
- ITR acknowledgement PDF
- computation of income PDF
- AIS / 26AS / TIS export
- invoice PDF
- Zoho snapshot pull
- tax challan PDF

Flow:
1. `ingest_service` stores the raw file in an evidence vault.
2. A `source_document` row is created with content hash, source system, document type, ingest batch id, and capture date.
3. `audit_event` records the ingest action.

### 2. Record extraction

Flow:
1. `extract_service` selects a parser by `document_type`.
2. Each extracted row becomes a `source_record`.
3. Every `source_record` keeps source document id, record fingerprint, extraction version, raw payload, and parse status.
4. Low-quality or partial extraction creates `exception_case`.

### 3. Normalization

Examples:
- `KOTAK MULTILINK LOGYSYS`, `Kotak Multilink Logistix`, `KMLPL` -> one vendor master entity
- narration cleanup
- UPI handle normalization
- challan number normalization
- GSTIN canonical formatting

Outputs:
- canonical vendor/customer/account candidate references
- normalized invoice numbers, dates, amounts, and beneficiary fingerprints

### 4. Matching

Matching is layered.

Layer 1 deterministic:
- exact bill number
- exact invoice number
- exact GSTIN + invoice number
- exact challan number
- exact bank UTR/reference
- exact Zoho object reference
- exact beneficiary account fingerprint

Layer 2 bounded heuristics:
- narration/vendor fuzzy score
- date tolerance windows
- amount tolerance windows
- partial reference matches

Layer 3 AI assist:
- narration interpretation
- likely vendor normalization
- likely account-head suggestion

Output:
- `match_candidate` rows with score, rule name, explanation, evidence refs, and decision status

### 5. Classification

Examples:
- bank debit -> vendor payment
- bank debit -> drawings candidate
- GSTR-2B line -> missing bill candidate
- tax debit -> advance tax
- bank credit -> revenue candidate

Output:
- `classification_result` rows that state proposed accounting meaning
- unresolved ambiguity becomes `exception_case`

### 6. Proposal generation

Proposal examples:
- create vendor bill in Zoho
- apply vendor payment against oldest Kotak open bills FIFO
- classify bank transfer to proprietor drawings
- create tax payment journal
- create missing bill review case, not auto-post

Outputs:
- `posting_proposal`
- `posting_proposal_line`
- linked evidence bundles

### 7. Approval

Approval states:
- `pending_review`
- `approved`
- `rejected`
- `approved_with_edits`
- `superseded`

High-confidence rules may still stop at proposal if:
- amount exceeds materiality threshold
- closed period is involved
- evidence conflicts
- rule requires explicit reviewer sign-off

### 8. Posting

Only `posting_service` may write to Zoho.

Posting modes:
- `dry_run`
- `review_only`
- `approved_post`
- `reversal_post`

For each posted action:
- compute idempotency key
- check for existing `zoho_posting_receipt`
- post only if absent and approved
- save request/response receipt

### 9. Reporting

Outputs by fiscal year:
- trial balance
- P&L
- balance sheet
- GST purchase reconciliation
- revenue reconciliation
- tax payment reconciliation
- proprietor drawings report
- unresolved exceptions report
- books vs filed ITR comparison
- audit pack export

## Trust Boundaries

### Boundary A: Ingest/Extract vs Decisioning

Read-side components:
- ingest
- extract
- normalize
- match
- AI assist
- reporting

These components may read external systems and evidence, but must not post into Zoho.

### Boundary B: Proposal/Approval vs Posting

Proposal and approval produce intent.
Posting executes intent only after policy checks.

This boundary exists because:
- extraction can be wrong
- matching can be ambiguous
- evidence can conflict
- closed periods require stronger controls

Implementation decision:
- period lock state is represented by an explicit `period_lock` table so posting checks do not depend on implicit fiscal-year flags or JSON metadata.

### Boundary C: Snapshot reads vs Live writes

Zoho read operations populate snapshot tables:
- bills
- vendor payments
- expenses
- journals
- contacts
- chart of accounts

These snapshot tables are read-only historical captures inside this system.

Implementation decision:
- keep Zoho snapshots as a table family (`zoho_snapshot_bill`, `zoho_snapshot_vendor_payment`, `zoho_snapshot_expense`, `zoho_snapshot_journal`, `zoho_snapshot_contact`, `zoho_snapshot_chart_account`) because each object has distinct lookup paths and reconciliation needs.

Zoho writes must:
- originate from approved proposals only
- use a lower-scope dedicated posting credential if possible
- store receipts and external ids

## Failure Modes and Handling

| Failure mode | Example | Handling |
|---|---|---|
| Bad or partial extraction | scanned PDF missing table rows | mark `parse_status=partial`, raise `exception_case`, allow manual enrich |
| Duplicate ingest | same bank statement uploaded twice | dedupe on document content hash and source fingerprint |
| Duplicate record extract | same statement line extracted twice | dedupe on `record_fingerprint` scoped to source system |
| Conflicting evidence | GSTR-2B line exists but Zoho bill amount differs | create conflict exception, do not auto-post |
| Weak vendor match | narration matches two vendors | keep multiple `match_candidate` rows, require review |
| Missing supporting document | payment appears but bill absent | classify as vendor advance candidate or expense exception based on rules |
| Zoho write failure | timeout or 429 | retry only for safe idempotent operations; never create a second proposal |
| Closed period write | approved proposal targets locked FY/month | reject posting and require reversal in open period |
| Rule drift | rulebook changes after prior classifications | version rules and support superseding proposals without destructive edits |
| External API unavailable | Zoho/GST portal unavailable | continue read-side staging; queue posting or rely on manual file ingest |

## Replay and Idempotency Model

### Fingerprints

Required fingerprints:
- `document_sha256`: file-level content hash
- `record_fingerprint`: deterministic hash of normalized source record
- `bundle_fingerprint`: deterministic hash of evidence set used for a classification
- `proposal_fingerprint`: deterministic hash of proposal semantics
- `posting_idempotency_key`: deterministic hash of posting target + proposal action + line content + mode

### Re-run behavior

| Stage | Re-run behavior |
|---|---|
| ingest | same document hash reuses existing `source_document` unless explicitly versioned as a replacement copy |
| extract | same document + same extractor version must not create duplicate `source_record` rows |
| normalize | re-run may refresh normalized projections but preserves prior raw extract |
| match | new rules may create new candidates; old candidates remain with status history |
| classify | new rule version creates a new `classification_result`, prior one becomes superseded, not deleted |
| proposal | same effective accounting action reuses or supersedes proposal by fingerprint |
| posting | same idempotency key must not post twice |

### Why this model exists

Historical cleanup will require repeated imports and improved rules.
Without replay-safe fingerprints:
- duplicates will proliferate
- old reasoning will be overwritten
- reviewer trust will degrade

## Deployment Model

### Local-first baseline

Acceptable initial deployment:
- Python worker/CLI on a trusted local machine
- PostgreSQL local or single-tenant hosted database
- local evidence vault with hashed file paths
- optional minimal FastAPI service for reviewer and operational endpoints

### Recommended runtime split

| Runtime | Purpose |
|---|---|
| CLI | batch ingest, snapshot pulls, report export |
| Worker | extraction, matching, proposal generation |
| API | review and approval endpoints |
| Reviewer UI | thin internal UI or terminal-first review surface |

### Security posture

Local-first is acceptable because:
- source data is confidential
- manual portal exports are expected
- reviewer workflows are internal

But even local-first must enforce:
- secret isolation
- audit logs
- posting credential separation
- evidence immutability

## Example End-to-End Flows

### Example A: Bank debit becomes drawings

1. Bank CSV imported as `source_document`.
2. Debit line extracted as `source_record`.
3. Beneficiary fingerprint matches proprietor personal whitelist.
4. Amount is INR 72,000.
5. `rules_engine` emits `classification_result=drawings`.
6. `proposal_service` creates journal proposal to Drawings / Proprietor Withdrawals.
7. Reviewer approves.
8. `posting_service` posts approved journal with idempotency key.
9. `zoho_posting_receipt` saved.

### Example B: GSTR-2B line becomes missing bill candidate

1. GSTR-2B manual file imported.
2. Purchase line extracted with supplier GSTIN, invoice no, invoice date, taxable value, and tax.
3. No matching Zoho snapshot bill found.
4. `match_service` links line to vendor master with high confidence.
5. `rules_engine` classifies as `missing_bill_candidate`.
6. `proposal_service` creates review-only bill proposal, not auto-post.
7. Reviewer attaches invoice PDF or marks exception.

### Example C: Kotak payment settlement proposal

1. Bank debit line matches Kotak vendor.
2. Zoho snapshot shows open bills and due dates.
3. Settlement policy for Kotak = FIFO by due date, then bill date, then bill number.
4. `proposal_service` generates allocation lines bill-by-bill.
5. Residual amount becomes vendor advance line if unmatched.
6. Reviewer approves.
7. `posting_service` posts payment application receipt.
