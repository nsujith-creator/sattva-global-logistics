# Data Dictionary

## Conventions

Type conventions:
- `uuid`: UUID primary key
- `text`: variable text
- `varchar(n)`: bounded string
- `date`: calendar date
- `timestamptz`: UTC timestamp with timezone
- `numeric(18,2)`: money
- `numeric(5,4)`: confidence score
- `jsonb`: structured payload or metadata

Core lineage path:

`source_document -> source_record -> evidence_bundle -> match_candidate -> classification_result -> posting_proposal -> approval_decision -> zoho_posting_receipt`

Phase C schema decisions:
- `zoho_snapshots` is implemented as a table family, not a single polymorphic table.
- `period_lock` is added as an explicit relational table because period protection is a first-class control, not metadata.
- `evidence_bundle_item` is added as an explicit relational table so evidence membership remains queryable and auditable without JSON-only joins.

## 1. fiscal_year

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | fiscal year id |
| `code` | varchar(9) | unique, not null | `FY2022-23` |
| `start_date` | date | not null | FY start |
| `end_date` | date | not null | FY end |
| `assessment_year_code` | varchar(9) | null | `AY2023-24` |
| `is_closed` | boolean | not null default false | year lock |
| `closed_at` | timestamptz | null | closure time |
| `close_reason` | text | null | why closed |
| `notes` | text | null | reviewer notes |

## 1a. period_lock

Business meaning:
- explicit period-level lock state separate from fiscal year master

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | period lock id |
| `fiscal_year_id` | uuid | FK fiscal_year.id not null | owning FY |
| `period_code` | varchar(10) | not null | `2025-04`, `2025-Q4`, or `FY2025-26` |
| `lock_state` | varchar(20) | not null | `open`, `soft_locked`, `hard_locked` |
| `locked_at` | timestamptz | null | lock timestamp |
| `reason` | text | null | lock reason |

Constraint:
- unique (`fiscal_year_id`, `period_code`)

## 2. source_document

Immutable evidence file or source snapshot registration.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | document id |
| `fiscal_year_id` | uuid | FK fiscal_year.id, null | related FY |
| `source_system` | varchar(50) | not null | `bank`, `gst_2b`, `zoho`, `income_tax`, `manual_upload` |
| `document_type` | varchar(50) | not null | `bank_csv`, `invoice_pdf`, `gstr2b_excel`, `itr_ack_pdf` |
| `source_document_ref` | varchar(255) | null | statement ref, challan ref |
| `original_filename` | text | not null | file name |
| `storage_path` | text | not null | vault path |
| `mime_type` | varchar(100) | not null | mime |
| `file_size_bytes` | bigint | not null | size |
| `document_sha256` | varchar(64) | not null unique | file fingerprint |
| `ingest_batch_key` | varchar(100) | not null | batch id |
| `captured_at` | timestamptz | not null | source capture time |
| `ingested_at` | timestamptz | not null | system ingest time |
| `source_account_ref` | varchar(100) | null | GSTIN/account mask/org id |
| `confidentiality_level` | varchar(20) | not null default `restricted` | handling class |
| `is_active` | boolean | not null default true | active copy |
| `supersedes_document_id` | uuid | FK source_document.id, null | replacement chain |
| `metadata_json` | jsonb | not null default '{}' | source metadata |

## 3. source_record

One extracted atomic record from a source document.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | source record id |
| `source_document_id` | uuid | FK source_document.id not null | parent document |
| `record_type` | varchar(50) | not null | `bank_txn`, `gst_purchase_line`, `tax_item`, `invoice_header` |
| `source_row_number` | integer | null | row/line index |
| `record_fingerprint` | varchar(64) | not null | deterministic row hash |
| `extraction_version` | varchar(50) | not null | parser version |
| `parse_status` | varchar(20) | not null | `parsed`, `partial`, `failed`, `manual_override` |
| `event_date` | date | null | primary date |
| `amount` | numeric(18,2) | null | primary amount |
| `currency_code` | varchar(3) | not null default `INR` | currency |
| `raw_payload` | jsonb | not null | raw extract |
| `normalized_payload` | jsonb | not null default '{}' | canonicalized extract |
| `quality_score` | numeric(5,4) | null | 0-1 quality |
| `review_required` | boolean | not null default false | extraction ambiguity |
| `superseded_by_record_id` | uuid | FK source_record.id, null | replacement extract |

Constraint:
- unique (`source_document_id`, `record_fingerprint`, `extraction_version`)

## 4. vendor_master

Canonical vendor registry across bank, GST, invoices, and Zoho.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | vendor id |
| `canonical_name` | text | unique, not null | system standard vendor name |
| `display_name` | text | not null | reviewer label |
| `vendor_type` | varchar(30) | not null | `freight_vendor`, `software_vendor`, `government`, `proprietor_personal`, `unknown` |
| `gstin` | varchar(15) | null | GSTIN |
| `pan` | varchar(10) | null | PAN |
| `is_personal_counterparty` | boolean | not null default false | proprietor personal route |
| `personal_match_mode` | varchar(30) | null | `beneficiary_account`, `upi_handle`, `name_pattern`, `mixed` |
| `beneficiary_fingerprints` | jsonb | not null default '[]' | UPI/account hashes |
| `narration_patterns` | jsonb | not null default '[]' | regex list |
| `zoho_contact_id` | varchar(50) | null | mapped Zoho contact |
| `default_settlement_policy` | varchar(30) | not null default `bill_to_bill` | `bill_to_bill`, `fifo_oldest_due`, `advance_first`, `manual_only` |
| `is_active` | boolean | not null default true | active flag |
| `metadata_json` | jsonb | not null default '{}' | aliases, notes |

## 5. account_master

Canonical chart for classification and proposals.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | account id |
| `account_code` | varchar(50) | unique, not null | internal code |
| `account_name` | text | not null | canonical name |
| `account_type` | varchar(30) | not null | `asset`, `liability`, `equity`, `income`, `expense` |
| `subtype` | varchar(50) | null | `drawings`, `bank_charges`, `advance_tax`, `trade_payables` |
| `normal_balance` | varchar(6) | not null | `debit` or `credit` |
| `is_control_account` | boolean | not null default false | control account |
| `zoho_account_id` | varchar(50) | null | Zoho map |
| `gst_treatment_hint` | varchar(30) | null | `eligible_itc`, `blocked_itc`, `non_gst` |
| `is_postable` | boolean | not null default true | post target |
| `is_active` | boolean | not null default true | active flag |

## 6. bank_transaction

Normalized bank transaction ledger.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | bank transaction id |
| `source_record_id` | uuid | FK source_record.id not null unique | origin row |
| `bank_account_ref` | varchar(100) | not null | masked account ref |
| `transaction_date` | date | not null | posting date |
| `value_date` | date | null | value date |
| `direction` | varchar(6) | not null | `debit` or `credit` |
| `amount` | numeric(18,2) | not null | absolute amount |
| `signed_amount` | numeric(18,2) | not null | sign-coded amount |
| `currency_code` | varchar(3) | not null default `INR` | currency |
| `narration` | text | not null | narration |
| `counterparty_name` | text | null | payee/payer |
| `counterparty_fingerprint` | varchar(64) | null | beneficiary fingerprint |
| `bank_reference` | varchar(100) | null | UTR/cheque/ref |
| `channel` | varchar(30) | null | `neft`, `rtgs`, `imps`, `upi`, `cash`, `charges` |
| `is_reconciled` | boolean | not null default false | reconciled |
| `recon_status` | varchar(30) | not null default `unmatched` | state |
| `metadata_json` | jsonb | not null default '{}' | bank details |

## 7. gst_purchase_line

One purchase line or invoice summary line from GSTR-2B or GST data.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | GST purchase line id |
| `source_record_id` | uuid | FK source_record.id not null unique | origin row |
| `supplier_gstin` | varchar(15) | not null | supplier GSTIN |
| `supplier_name` | text | not null | portal supplier name |
| `invoice_number` | varchar(100) | not null | invoice no |
| `invoice_date` | date | not null | invoice date |
| `invoice_type` | varchar(30) | null | regular, debit note, credit note |
| `place_of_supply` | varchar(50) | null | POS |
| `taxable_value` | numeric(18,2) | not null | taxable base |
| `igst_amount` | numeric(18,2) | not null default 0 | IGST |
| `cgst_amount` | numeric(18,2) | not null default 0 | CGST |
| `sgst_amount` | numeric(18,2) | not null default 0 | SGST |
| `cess_amount` | numeric(18,2) | not null default 0 | cess |
| `total_tax_amount` | numeric(18,2) | not null | total GST |
| `itc_availability` | varchar(20) | null | eligible, ineligible, reversal |
| `filing_period` | varchar(7) | not null | `YYYY-MM` |
| `vendor_master_id` | uuid | FK vendor_master.id, null | normalized vendor |
| `match_status` | varchar(30) | not null default `unmatched` | reconciliation state |

## 8. tax_information_item

One item from AIS, 26AS, TIS, ITR, challan record, or tax portal export.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | tax info id |
| `source_record_id` | uuid | FK source_record.id not null unique | origin |
| `tax_system` | varchar(30) | not null | `income_tax`, `gst` |
| `item_type` | varchar(40) | not null | `advance_tax`, `self_assessment_tax`, `gst_cash_payment`, `interest`, `penalty`, `tds_credit`, `turnover_info` |
| `authority_reference` | varchar(100) | null | challan/CIN/ref |
| `item_date` | date | not null | transaction/credit date |
| `assessment_year_code` | varchar(9) | null | AY code |
| `period_code` | varchar(20) | null | GST month/quarter |
| `party_identifier` | varchar(50) | null | TAN/GSTIN/bank ref |
| `amount` | numeric(18,2) | not null | amount |
| `section_code` | varchar(20) | null | tax section |
| `metadata_json` | jsonb | not null default '{}' | raw detail |

## 9. zoho_snapshot tables

Shared columns:
- `id uuid PK`
- `snapshot_at timestamptz not null`
- `snapshot_batch_key varchar(100) not null`
- `zoho_object_id varchar(50) not null`
- `is_deleted_in_zoho boolean not null default false`
- `payload jsonb not null`

Read-only captured state from Zoho at a point in time.

### 9a. zoho_snapshot_bill

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `vendor_name` | text | not null | Zoho vendor name |
| `vendor_id` | varchar(50) | not null | Zoho contact id |
| `bill_number` | varchar(100) | not null | bill number |
| `bill_date` | date | not null | bill date |
| `due_date` | date | null | due date |
| `currency_code` | varchar(3) | not null | currency |
| `total` | numeric(18,2) | not null | bill total |
| `balance` | numeric(18,2) | not null | unpaid balance |
| `status` | varchar(30) | not null | open, paid, overdue |
| `reference_number` | varchar(100) | null | BL/challan/ref |

### 9b. zoho_snapshot_vendor_payment

Fields:
- `payment_number varchar(100)`
- `payment_date date`
- `vendor_id varchar(50)`
- `amount numeric(18,2)`
- `unapplied_amount numeric(18,2)`
- `reference_number varchar(100)`

### 9c. zoho_snapshot_expense

Fields:
- `expense_date date`
- `paid_through_account_id varchar(50)`
- `amount numeric(18,2)`
- `reference_number varchar(100)`
- `account_id varchar(50)`

### 9d. zoho_snapshot_journal

Fields:
- `journal_number varchar(100)`
- `journal_date date`
- `total numeric(18,2)`
- `status varchar(30)`

### 9e. zoho_snapshot_contact

Fields:
- `contact_name text`
- `contact_type varchar(20)`
- `gstin varchar(15)`
- `status varchar(20)`

### 9f. zoho_snapshot_chart_account

Fields:
- `account_name text`
- `account_code varchar(50)`
- `account_type varchar(30)`
- `is_active boolean`

## 10. evidence_bundle

Explicit grouping of evidence supporting one classification/proposal.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | bundle id |
| `bundle_type` | varchar(40) | not null | `vendor_bill_case`, `drawings_case`, `tax_payment_case`, `revenue_case` |
| `bundle_fingerprint` | varchar(64) | not null unique | bundle hash |
| `primary_record_type` | varchar(50) | not null | main driving record |
| `primary_record_id` | uuid | not null | main object id |
| `evidence_summary` | text | not null | concise explanation |
| `confidence_score` | numeric(5,4) | null | bundle strength |
| `status` | varchar(20) | not null default `open` | `open`, `resolved`, `superseded` |
| `metadata_json` | jsonb | not null default '{}' | member evidence refs |

## 10a. evidence_bundle_item

Business meaning:
- relational membership table for evidence bundles

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | bundle item id |
| `evidence_bundle_id` | uuid | FK evidence_bundle.id not null | parent bundle |
| `item_object_type` | varchar(50) | not null | source table/object type |
| `item_object_id` | uuid/text | not null | linked object id |
| `item_role` | varchar(30) | not null | `primary`, `supporting`, `conflicting`, `reference` |
| `ordinal` | integer | not null default 1 | display/order hint |
| `notes` | text | null | reviewer/system note |

Constraint:
- unique (`evidence_bundle_id`, `item_object_type`, `item_object_id`, `item_role`)

## 11. match_candidate

One candidate link between evidence and a target business object.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | match id |
| `evidence_bundle_id` | uuid | FK evidence_bundle.id not null | parent bundle |
| `from_object_type` | varchar(50) | not null | `bank_transaction`, `gst_purchase_line`, `tax_information_item` |
| `from_object_id` | uuid | not null | source object |
| `to_object_type` | varchar(50) | not null | `vendor_master`, `zoho_snapshot_bill`, `account_master`, `tax_class` |
| `to_object_id` | text | not null | target id or code |
| `match_layer` | varchar(20) | not null | `deterministic`, `heuristic`, `ai_assist` |
| `rule_name` | varchar(100) | not null | rule id |
| `score` | numeric(5,4) | not null | 0-1 |
| `decision_status` | varchar(20) | not null default `candidate` | `candidate`, `accepted`, `rejected`, `superseded` |
| `explanation` | text | not null | reason |
| `evidence_refs` | jsonb | not null | supporting refs |

## 12. classification_result

Explicit accounting interpretation of a bundle at a point in time.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | classification id |
| `evidence_bundle_id` | uuid | FK evidence_bundle.id not null | case bundle |
| `rule_version_id` | uuid | FK rule_version.id not null | ruleset used |
| `classification_type` | varchar(40) | not null | `drawings`, `vendor_payment`, `expense_candidate`, `missing_bill_candidate`, `tax_payment`, `revenue_candidate` |
| `status` | varchar(20) | not null | `proposed`, `confirmed`, `rejected`, `superseded` |
| `confidence_score` | numeric(5,4) | not null | 0-1 |
| `materiality_amount` | numeric(18,2) | null | money at risk |
| `accounting_period_date` | date | not null | target period date |
| `decision_summary` | text | not null | concise treatment |
| `explanation_json` | jsonb | not null | structured reasoning |
| `ai_assist_json` | jsonb | not null default '{}' | advisory output |
| `supersedes_classification_id` | uuid | FK classification_result.id, null | replacement chain |

## 13. posting_proposal

Reviewable candidate posting package derived from a classification.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | proposal id |
| `classification_result_id` | uuid | FK classification_result.id not null | source interpretation |
| `proposal_fingerprint` | varchar(64) | not null unique | semantic hash |
| `proposal_type` | varchar(40) | not null | `vendor_bill_create`, `vendor_payment_apply`, `expense_create`, `journal_create`, `reversal_journal` |
| `proposal_mode` | varchar(20) | not null default `review_only` | intended mode |
| `target_system` | varchar(20) | not null default `zoho_books` | destination |
| `target_period_date` | date | not null | accounting period target |
| `status` | varchar(20) | not null | `draft`, `pending_approval`, `approved`, `rejected`, `posted`, `superseded` |
| `currency_code` | varchar(3) | not null default `INR` | currency |
| `gross_amount` | numeric(18,2) | not null | total amount |
| `narrative` | text | not null | reviewer-facing summary |
| `policy_flags` | jsonb | not null default '{}' | closed period, materiality, conflicts |
| `supersedes_proposal_id` | uuid | FK posting_proposal.id, null | replacement chain |

## 14. posting_proposal_line

One action line inside a proposal.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | line id |
| `posting_proposal_id` | uuid | FK posting_proposal.id not null | parent proposal |
| `line_no` | integer | not null | line order |
| `action_type` | varchar(40) | not null | `debit_line`, `credit_line`, `apply_bill`, `create_vendor_advance`, `attach_reference` |
| `account_master_id` | uuid | FK account_master.id, null | ledger target |
| `vendor_master_id` | uuid | FK vendor_master.id, null | vendor target |
| `zoho_target_object_type` | varchar(40) | null | bill, vendor_payment, expense, journal |
| `zoho_target_object_ref` | varchar(100) | null | external ref if known |
| `description` | text | not null | narration |
| `quantity` | numeric(18,4) | null | quantity |
| `rate` | numeric(18,2) | null | rate |
| `amount` | numeric(18,2) | not null | line amount |
| `tax_code` | varchar(50) | null | internal tax treatment |
| `allocation_json` | jsonb | not null default '{}' | settlement splits |

## 15. approval_decision

Explicit reviewer decision on a proposal.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | approval id |
| `posting_proposal_id` | uuid | FK posting_proposal.id not null | target proposal |
| `decision` | varchar(25) | not null | `approved`, `rejected`, `approved_with_edits`, `sent_back`, `superseded` |
| `decision_by` | text | not null | reviewer |
| `decision_at` | timestamptz | not null | timestamp |
| `reason_code` | varchar(50) | null | structured reason |
| `comment_text` | text | null | notes |
| `edited_payload` | jsonb | not null default '{}' | approved-with-edits delta |
| `is_final` | boolean | not null default true | finality flag |

## 16. zoho_posting_receipt

Immutable receipt for one attempted or completed Zoho write.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | receipt id |
| `posting_proposal_id` | uuid | FK posting_proposal.id not null | posted proposal |
| `approval_decision_id` | uuid | FK approval_decision.id, null | authorizing approval |
| `posting_mode` | varchar(20) | not null | `dry_run`, `review_only`, `approved_post`, `reversal_post` |
| `idempotency_key` | varchar(128) | not null unique | write dedupe key |
| `request_hash` | varchar(64) | not null | payload hash |
| `target_object_type` | varchar(40) | not null | bill, vendor_payment, expense, journal |
| `target_external_id` | varchar(100) | null | Zoho object id |
| `target_external_number` | varchar(100) | null | Zoho number |
| `posting_status` | varchar(20) | not null | `simulated`, `submitted`, `succeeded`, `failed`, `duplicate_suppressed` |
| `posted_at` | timestamptz | null | success time |
| `response_code` | varchar(20) | null | API status |
| `response_payload` | jsonb | not null default '{}' | sanitized response |
| `reversal_of_receipt_id` | uuid | FK zoho_posting_receipt.id, null | reversal chain |

## 17. exception_case

Tracked unresolved issue requiring review or blocking automation.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | exception id |
| `exception_type` | varchar(50) | not null | `unmatched_bank_debit`, `conflicting_gst_bill`, `closed_period_write`, `missing_support`, `low_confidence_match` |
| `severity` | varchar(20) | not null | `low`, `medium`, `high`, `critical` |
| `status` | varchar(20) | not null | `open`, `in_review`, `resolved`, `waived`, `superseded` |
| `related_object_type` | varchar(50) | not null | source table |
| `related_object_id` | uuid | not null | source row |
| `fiscal_year_id` | uuid | FK fiscal_year.id, null | relevant FY |
| `summary` | text | not null | short issue |
| `details_json` | jsonb | not null | issue payload |
| `assigned_to` | text | null | reviewer |
| `resolved_at` | timestamptz | null | resolution time |
| `resolution_note` | text | null | closure note |

## 18. rule_version

Immutable published ruleset version for classification/proposal logic.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | rule version id |
| `rulebook_name` | varchar(50) | not null | `core_accounting_rules` |
| `version_code` | varchar(30) | unique, not null | example `2026.03.29.1` |
| `effective_from` | date | not null | activation date |
| `effective_to` | date | null | retirement date |
| `is_active` | boolean | not null default true | active flag |
| `published_by` | text | not null | owner |
| `change_summary` | text | not null | what changed |
| `rules_json` | jsonb | not null | frozen parameters |

## 19. audit_event

Append-only trace of every meaningful system action.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | uuid | PK | event id |
| `event_ts` | timestamptz | not null | occurrence time |
| `event_type` | varchar(50) | not null | `document_ingested`, `record_extracted`, `match_created`, `proposal_approved`, `zoho_post_succeeded` |
| `actor_type` | varchar(20) | not null | `system`, `reviewer`, `operator` |
| `actor_id` | text | not null | service/user id |
| `object_type` | varchar(50) | not null | affected object |
| `object_id` | text | not null | affected id |
| `correlation_id` | varchar(100) | not null | end-to-end trace key |
| `idempotency_key` | varchar(128) | null | when relevant |
| `before_state_json` | jsonb | null | prior state |
| `after_state_json` | jsonb | null | new state |
| `event_detail_json` | jsonb | not null default '{}' | context payload |

## Example Relationship Patterns

### Bank debit -> drawings

- one `source_document`
- one `source_record`
- one `bank_transaction`
- one `evidence_bundle`
- many `match_candidate` rows against personal fingerprints and account heads
- one accepted `classification_result=drawings`
- one `posting_proposal`
- one `approval_decision`
- one `zoho_posting_receipt`

### GSTR-2B missing invoice

- one `source_document`
- one `source_record`
- one `gst_purchase_line`
- zero matched `zoho_snapshot_bill`
- one `classification_result=missing_bill_candidate`
- one `posting_proposal` in `review_only`
- maybe one `exception_case` if invoice PDF is absent
