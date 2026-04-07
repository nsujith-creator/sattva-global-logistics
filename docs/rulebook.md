# Rulebook

## Rule Design Principles

1. Deterministic rules override heuristic and AI suggestions.
2. AI may suggest, but never finalize accounting treatment.
3. If evidence conflicts materially, create an exception instead of forcing classification.
4. Closed periods are protected.
5. Every rule execution must record `rule_name`, `rule_version`, input evidence refs, output object ids, and explanation.

## Rule Execution Order

### Stage 1: Hard exclusions

- reject duplicate documents by `document_sha256`
- reject duplicate extracted rows by `record_fingerprint`
- reject inactive/superseded source records
- block direct posting into locked periods
- quarantine malformed extracts missing primary amount/date identifiers

### Stage 2: Deterministic identity rules

- exact bill number to Zoho bill
- exact invoice number
- exact GSTIN + invoice number
- exact challan number
- exact bank reference / UTR
- exact beneficiary/account fingerprint

### Stage 3: Deterministic accounting rules

- proprietor drawings
- Kotak FIFO settlement
- default bill-to-bill settlement
- GSTR-2B missing bill candidate generation
- income-tax and GST payment classification

### Stage 4: Bounded heuristics

- narration pattern scoring
- amount tolerance
- date tolerance
- partial reference matching

### Stage 5: AI assist

Allowed for:
- narration meaning
- likely vendor normalization
- likely account head suggestion

Not allowed for:
- final approval
- period-lock bypass
- converting personal transfer to business expense without supporting evidence

## 1. Bank Transaction Classification Logic

Goal:
- classify each bank transaction into:
  - vendor payment
  - expense
  - proprietor drawings
  - tax payment
  - revenue
  - transfer/suspense/exception

### 1.1 Debit decision path

For each bank debit:
1. duplicate check
2. exact tax challan/reference match
3. personal counterparty whitelist/fingerprint check
4. exact vendor settlement reference check
5. expense-supporting evidence check
6. if unresolved, route to exception queue

### 1.2 Debit outcomes

| Outcome | Required evidence | Auto classify? |
|---|---|---|
| `tax_payment` | bank debit + challan/portal/manual tax evidence | yes, if deterministic match |
| `drawings` | bank debit + personal whitelist hit + amount rules | yes above threshold, else candidate |
| `vendor_payment` | bank debit + vendor match + bill/open balance evidence | yes if clear |
| `expense_candidate` | bank debit + narration/support points to business spend | candidate only |
| `bank_charge` | exact bank charge pattern | yes |
| `unclassified_debit_exception` | insufficient or conflicting evidence | no |

## 2. Drawings Rule

### 2.1 Personal counterparty detection

A transfer enters drawings logic only if at least one approved personal indicator hits:
- beneficiary account fingerprint exact match
- UPI id exact match
- IFSC + last4 + alias match
- narration regex from approved whitelist
- `vendor_master.is_personal_counterparty=true`

Amount threshold alone is not sufficient.

### 2.2 Rules

Rule `drawings.personal.over_30000.auto`:
- if personal indicator hit = true
- and debit amount > INR 30,000
- and no stronger conflicting evidence exists
- classify as `drawings`
- propose:
  - Dr Drawings / Proprietor Withdrawals
  - Cr Bank

Rule `drawings.personal.le_30000.candidate`:
- if personal indicator hit = true
- and debit amount <= INR 30,000
- classify as `expense_or_drawings_candidate`
- do not auto-post
- send to `possible_drawings` queue

Rule `drawings.override.to_business_expense`:
- if personal indicator hit = true
- and amount > INR 30,000
- but documentary support shows business purpose
- reviewer must explicitly override with note and evidence ref

### 2.3 Conflict resolution

Priority:
1. exact tax challan match beats personal match
2. exact beneficiary personal match vs exact vendor settlement match -> raise high-severity conflict exception, do not auto-resolve

## 3. Vendor Settlement Rules

Settlement policy is vendor-configurable via `vendor_master.default_settlement_policy`.

### 3.1 Default policy for most vendors: `bill_to_bill`

Decision order:
1. exact bill number in narration/reference
2. exact invoice number
3. exact amount equal to one open bill
4. one remaining clear candidate within tolerance
5. else queue settlement review

Handling:
- if payment > matched bill -> settle bill, residual becomes vendor advance candidate
- if payment < matched bill -> partial settlement allowed

### 3.2 Kotak policy: `fifo_oldest_due`

Canonical vendor example:
- `KOTAK MULTILINK LOGISTIX PRIVATE LIMITED`

Rule `vendor_payment.kotak.fifo_oldest_due`:
- if bank debit matches Kotak vendor
- allocate payment against open bills in this order:
  1. oldest `due_date`
  2. then oldest `bill_date`
  3. then ascending `bill_number`
- partial settlement allowed
- residual becomes vendor advance

Example:
- payment INR 200,000
- open bills:
  - A due 2025-04-10 balance 80,000
  - B due 2025-04-20 balance 70,000
  - C due 2025-04-20 balance 90,000
- proposal:
  - settle A 80,000
  - settle B 70,000
  - settle C 50,000

### 3.3 Auto-settlement control

Auto-settlement allowed only if:
- vendor match confidence >= 0.95
- latest Zoho open-bill snapshot is available
- target period is not locked

Else:
- proposal only
- approval required

## 4. GST Purchase Reconstruction Logic

Purpose:
- use GSTR-2B as strong evidence of purchase bill existence, but not as the sole evidence for all expenses

### 4.1 Matching order

For each `gst_purchase_line`:
1. exact Zoho bill match by supplier GSTIN + invoice number
2. exact vendor + invoice number
3. exact taxable + tax + invoice date tolerance
4. if no accepted match, create `missing_bill_candidate`

### 4.2 Missing bill candidate rule

Rule `gst_2b.missing_bill_candidate`:
- if GSTR-2B line has no accepted Zoho bill match
- and not already linked to an open proposal/exception
- classify as `missing_bill_candidate`
- create review-only vendor bill proposal

Required candidate fields:
- supplier GSTIN
- supplier name
- invoice number
- invoice date
- taxable value
- tax split
- filing period

### 4.3 Non-GSTR expense classes

The system must not expect the following in GSTR-2B completeness checks:
- proprietor drawings
- salaries
- bank charges
- direct taxes
- income-tax interest/penalty
- certain reimbursements
- internal transfers

### 4.4 Conflict rule

If GSTR-2B shows an invoice but Zoho shows a materially different bill amount:
- raise `conflicting_gst_bill`
- do not auto-adjust
- require reviewer decision

## 5. Tax Payment Classification

### 5.1 Income-tax classes

Allowed classes:
- `advance_tax`
- `self_assessment_tax`
- `regular_assessment_tax`
- `interest`
- `penalty`

Rule order:
1. exact challan/CIN match from portal/manual evidence
2. exact amount + same date + bank reference
3. classify based on portal evidence

If portal evidence is absent:
- classify as `tax_payment_candidate`
- no final posting

### 5.2 GST classes

Allowed classes:
- `gst_liability_discharge`
- `gst_interest`
- `gst_penalty`

Same match order:
1. exact challan / PMT reference
2. exact amount/date with portal/manual record

### 5.3 Posting treatment examples

- advance tax:
  - Dr Advance Tax Asset
  - Cr Bank
- GST liability discharge:
  - Dr GST Payable
  - Cr Bank

If liability target is unclear:
- generate review-only journal proposal

## 6. Revenue Reconstruction Logic

Use:
- bank credits
- Zoho sales/invoice snapshots
- AIS / 26AS / TIS
- ITR computation support docs

Do not force books to equal filed ITR.

For each bank credit:
1. check exact invoice/customer match in Zoho
2. check tax info for TDS/receipt evidence
3. check narration for loan/transfer/refund/interest
4. if likely business receipt, classify `revenue_candidate`
5. otherwise route to `unmatched_bank_credit`

After reconstruction:
- compare reconstructed revenue to filed ITR/computation
- produce difference report
- do not auto-adjust solely to match filing

## 7. Exception Thresholds

Raise exceptions for:
- missing primary identifier on source record
- multiple competing vendor matches within 0.05 score band
- GSTR-2B invoice without Zoho bill
- bank debit > materiality threshold with no clear classification
- conflict between personal transfer and business evidence
- tax debit without supporting challan/portal evidence
- posting into locked period
- duplicate external posting receipt with payload mismatch

## 8. Materiality Thresholds

Operational review gates:

| Area | Threshold | Action |
|---|---|---|
| drawings override above threshold | any amount > INR 30,000 | review if not accepted as drawings |
| unmatched bank debit | > INR 10,000 | mandatory review |
| unmatched bank credit | > INR 10,000 | mandatory review |
| GST mismatch invoice variance | > INR 1,000 or > 2% of invoice gross | conflict exception |
| vendor settlement residual | > INR 500 | show residual advance explicitly |
| tax payment unclassified | any amount | mandatory review |
| period-end adjustment proposal | any amount | mandatory approval |
| AI-only inference on posting head | any amount | review only, never auto-post |

Thresholds should be stored in `rule_version.rules_json`.

## 9. Fiscal Year and Period Lock Rules

States:
- `open`
- `soft_locked`
- `hard_locked`

Rules:
- `soft_locked`: proposals allowed, posting requires elevated approval
- `hard_locked`: direct replacement posting blocked; reversal workflow only

Rule `period.hard_lock.block_direct_post`:
- if target period is hard locked
- `approved_post` is forbidden
- only `reversal_post` in an open period is allowed

Rule `period.closed.supersede_not_overwrite`:
- if a classification/proposal changes for a closed period
- prior object becomes superseded
- no destructive edits

## 10. Conflict Resolution Priority

Evidence strength order:
1. exact portal/manual tax evidence
2. exact external reference match
3. exact beneficiary/account fingerprint
4. exact GSTIN + invoice number
5. exact bill/invoice number
6. amount/date deterministic combos
7. bounded heuristics
8. AI assist

If two rules conflict at the same strength:
- do not choose automatically
- create exception
- require review
