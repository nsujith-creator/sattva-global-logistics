# Implementation Plan

## Delivery Strategy

Build in phases that each produce reviewable, testable outputs.

Do not attempt full autonomous bookkeeping in one step.

## Phase 1: Evidence and Read-Side Foundation

Objective:
- create the evidence-led backbone without Zoho writes

Deliverables:
- PostgreSQL schema and migrations for core tables
- evidence vault strategy
- ingest pipelines for:
  - Zoho snapshots
  - bank statements
  - GSTR-2B manual files
- extraction versioning and record fingerprints
- audit event backbone
- terminal-first review exports

Dependencies:
- Python 3.12+
- PostgreSQL
- SQLAlchemy or SQLModel
- Alembic
- Pydantic
- pytest
- file parsing libraries for CSV/XLSX/PDF

Exit criteria:
- same document can be re-run without duplicate documents/records
- Zoho snapshots stored as read-only tables
- basic reconciliation views available

## Phase 2: Matching, Rules, and Proposal Layer

Objective:
- turn raw evidence into explicit reviewable accounting intent

Deliverables:
- vendor/account normalization
- `match_candidate` generation
- `classification_result` generation
- `posting_proposal` and `posting_proposal_line`
- rule support for:
  - drawings
  - Kotak FIFO settlement
  - normal bill-to-bill settlement
  - GSTR-2B missing bill candidates
  - tax payment classification

Exit criteria:
- a bank debit can become drawings, vendor payment, expense candidate, or tax payment candidate via explicit classification and proposal records
- no direct posting exists yet

## Phase 3: Approval and Controlled Posting

Objective:
- introduce gated Zoho writes with full receipts and reversals

Deliverables:
- approval workflow
- posting service
- idempotency enforcement
- receipt capture
- dry run / review only / approved post / reversal post modes
- period lock enforcement

Exit criteria:
- live Zoho writes happen only through `posting_service`
- duplicate post prevention proven in tests
- reversal flow works for at least journals and one AP-related flow

## Phase 4: Reconstruction Reports and Hardening

Objective:
- produce FY-level outputs and close control gaps

Deliverables:
- FY trial balance, P&L, balance sheet
- GST purchase reconciliation
- revenue reconciliation
- tax payment reconciliation
- books vs filed ITR comparison
- unresolved exceptions report
- audit pack export
- reviewer UI or improved terminal review surface

Exit criteria:
- each FY can be reported with unresolved gaps explicitly shown
- differences vs filed tax documents are explainable

## Sequencing Detail

### Phase 1 order

1. secret handling design
2. core schema
3. ingest registry
4. bank import
5. GSTR-2B import
6. Zoho snapshot read connector
7. audit events
8. replay tests

### Phase 2 order

1. vendor master normalization
2. deterministic matching
3. rules engine framework with `rule_version`
4. drawings rule
5. vendor settlement rules
6. GST missing bill rules
7. proposal generation
8. exception queues

### Phase 3 order

1. approval decisions
2. posting payload builders
3. idempotency key infrastructure
4. dry-run engine
5. approved post for journals and vendor bills
6. payment application support
7. reversal workflows

## Test Strategy

### Unit tests

Required early:
- document fingerprinting
- source record fingerprinting
- ingestion idempotency
- duplicate detection
- drawings threshold handling
- personal account detection
- Kotak FIFO settlement
- standard bill-to-bill settlement
- GSTR-2B missing bill candidate generation
- period lock enforcement
- reversal proposal generation
- replay consistency

### Integration tests

Required before live posting:
- Zoho snapshot ingestion
- proposal to approval transition
- posting idempotency
- receipt persistence
- failure retry with same idempotency key

### Fixture policy

Fixtures must be masked for:
- GSTIN
- PAN
- account numbers
- UPI ids
- bill numbers where needed

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| dirty existing Zoho data | false matches and false confidence | treat snapshots as evidence, not truth |
| portal/API instability | ingestion delays | support manual file ingest as first-class workflow |
| ambiguous bank narration | misclassification | deterministic fingerprints + exception queue |
| incomplete historical evidence | unresolved books | preserve exceptions and difference reports instead of guessing |
| credential exposure from old repo | security incident | rotate credentials before connector reuse |
| old script assumptions leak forward | architectural debt | enforce proposal layer and read/write separation from day one |

## Recommended Build Priority for the First Working Slice

Implement next:
1. Zoho read snapshots
2. bank import
3. GSTR-2B manual import
4. drawings rule
5. vendor settlement policy
6. dry-run proposal generation

This is the smallest slice that proves the shift away from parse-to-post.
