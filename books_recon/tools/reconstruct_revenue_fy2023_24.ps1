param(
    [string]$RepoRoot = "C:\sattva\books_recon",
    [string]$OutputPrefix = "fy23_24_revenue_reconstruction"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$fyStart = [datetime]"2023-04-01"
$fyEnd = [datetime]"2024-03-31"
$rawDir = Join-Path $RepoRoot "data\raw"
$exportDir = Join-Path $RepoRoot "data\exports"
$bankPath = Join-Path $exportDir "3326_fy2023_24_reconstruction.transactions.json"

function Get-NormalizedText {
    param([AllowNull()][string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
    $normalized = $Text.ToUpperInvariant()
    $normalized = [regex]::Replace($normalized, "[^A-Z0-9]+", " ")
    return ([regex]::Replace($normalized, "\s+", " ").Trim())
}

function Convert-ToDecimalSafe {
    param([AllowNull()][string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return [decimal]::Zero }
    return [decimal]::Parse($Value.Trim().Replace(",", ""), [System.Globalization.CultureInfo]::InvariantCulture)
}

function Convert-ToDateSafe {
    param([AllowNull()][string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
    $formats = @("yyyy-MM-dd", "dd/MM/yyyy", "dd-MM-yyyy", "MM/dd/yyyy", "yyyy/MM/dd")
    foreach ($format in $formats) {
        $parsed = [datetime]::MinValue
        if ([datetime]::TryParseExact($Value.Trim(), $format, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::None, [ref]$parsed)) {
            return $parsed.Date
        }
    }
    return ([datetime]::Parse($Value, [System.Globalization.CultureInfo]::InvariantCulture)).Date
}

function Get-BankReference {
    param([AllowNull()][string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
    foreach ($token in ($Text -split "[/\\\s]+")) {
        if ($token -match "^(S\d{6,}|[A-Z0-9]*\d{6,}[A-Z0-9]*)$") {
            return $token.Trim()
        }
    }
    return $null
}

function Get-TextScore {
    param(
        [string]$Left,
        [string]$Right
    )

    $a = Get-NormalizedText $Left
    $b = Get-NormalizedText $Right
    if (-not $a -or -not $b) { return 0.0 }
    if ($a -eq $b) { return 0.99 }
    if ($a.Contains($b) -or $b.Contains($a)) { return 0.8 }

    $aTokens = @($a -split " " | Where-Object { $_ })
    $bTokens = @($b -split " " | Where-Object { $_ })
    if ($aTokens.Count -eq 0 -or $bTokens.Count -eq 0) { return 0.0 }

    $common = @($aTokens | Where-Object { $bTokens -contains $_ } | Select-Object -Unique)
    $commonCount = $common.Count
    if ($commonCount -eq 0) { return 0.0 }
    $ratio = $commonCount / [double]([Math]::Max($aTokens.Count, $bTokens.Count))
    return [Math]::Round([Math]::Min(0.75, 0.15 + (0.75 * $ratio)), 4)
}

function Get-ConfidenceLabel {
    param([double]$Score)
    if ($Score -ge 0.85) { return "high" }
    if ($Score -ge 0.65) { return "medium" }
    if ($Score -ge 0.55) { return "low" }
    return "none"
}

function Import-CsvSafe {
    param([string]$Path)

    $headerLine = Get-Content -Path $Path -TotalCount 1
    $headers = $headerLine -split ","
    $seen = @{}
    $deduped = foreach ($header in $headers) {
        $name = $header.Trim()
        if (-not $seen.ContainsKey($name)) {
            $seen[$name] = 0
            $name
        } else {
            $seen[$name] += 1
            "${name}__$($seen[$name])"
        }
    }
    return @(Import-Csv -Path $Path -Header $deduped | Select-Object -Skip 1)
}

function Import-InvoiceFiles {
    param([string[]]$Paths)

    $rawRows = foreach ($path in $Paths) { Import-CsvSafe -Path $path }
    $groups = $rawRows | Group-Object { if ($_.('Invoice ID')) { $_.('Invoice ID') } else { "$($_.('Invoice Number'))|$($_.('Customer Name'))|$($_.('Invoice Date'))|$($_.Total)" } }

    $records = foreach ($group in $groups) {
        $first = $group.Group[0]
        $invoiceDate = Convert-ToDateSafe $first.('Invoice Date')
        $dueDate = Convert-ToDateSafe $first.('Due Date')
        $taxBreakup = [pscustomobject]@{
            cgst = [Math]::Round(($group.Group | Measure-Object -Property CGST -Sum).Sum, 2)
            sgst = [Math]::Round(($group.Group | Measure-Object -Property SGST -Sum).Sum, 2)
            igst = [Math]::Round(($group.Group | Measure-Object -Property IGST -Sum).Sum, 2)
            cess = [Math]::Round(($group.Group | Measure-Object -Property CESS -Sum).Sum, 2)
            tds = [Math]::Round((($group.Group | ForEach-Object { Convert-ToDecimalSafe $_.('TDS Amount') } | Measure-Object -Maximum).Maximum), 2)
            round_off = [Math]::Round((Convert-ToDecimalSafe $first.('Round Off')), 2)
        }
        [pscustomobject]@{
            invoice_id = [string]$first.('Invoice ID')
            invoice_number = [string]$first.('Invoice Number')
            customer_id = [string]$first.('Customer ID')
            customer_name = [string]$first.('Customer Name')
            invoice_date = $(if ($invoiceDate) { $invoiceDate.ToString("yyyy-MM-dd") } else { $null })
            due_date = $(if ($dueDate) { $dueDate.ToString("yyyy-MM-dd") } else { $null })
            invoice_status = [string]$first.('Invoice Status')
            currency_code = [string]$first.('Currency Code')
            gst_treatment = [string]$first.('GST Treatment')
            gstin = [string]$first.('GST Identification Number (GSTIN)')
            subtotal = [Math]::Round((Convert-ToDecimalSafe $first.SubTotal), 2)
            total = [Math]::Round((Convert-ToDecimalSafe $first.Total), 2)
            current_balance_field = [Math]::Round((Convert-ToDecimalSafe $first.Balance), 2)
            tax_breakup = $taxBreakup
            line_count = $group.Count
            raw_source_rows = $group.Count
        }
    }

    [pscustomobject]@{
        raw_rows = @($rawRows).Count
        invoice_records = @($records)
        duplicates_skipped = @($rawRows).Count - @($records).Count
    }
}

function Import-PaymentFiles {
    param([string[]]$Paths)

    $rawRows = foreach ($path in $Paths) { Import-CsvSafe -Path $path }
    $groups = $rawRows | Group-Object { if ($_.('CustomerPayment ID')) { $_.('CustomerPayment ID') } else { "$($_.('Payment Number'))|$($_.Date)|$($_.Amount)|$($_.('Customer Name'))" } }

    $records = foreach ($group in $groups) {
        $first = $group.Group[0]
        $paymentDate = Convert-ToDateSafe $first.Date
        $createdTime = Convert-ToDateSafe $first.('Created Time')
        $allocations = @(
            $group.Group |
                Group-Object { if ($_.('InvoicePayment ID')) { $_.('InvoicePayment ID') } else { "$($_.('Invoice Number'))|$($_.('Amount Applied to Invoice'))" } } |
                ForEach-Object {
                    $row = $_.Group[0]
                    [pscustomobject]@{
                        invoice_payment_id = [string]$row.('InvoicePayment ID')
                        invoice_number = [string]$row.('Invoice Number')
                        invoice_date = $(if ($row.('Invoice Date')) { (Convert-ToDateSafe $row.('Invoice Date')).ToString("yyyy-MM-dd") } else { $null })
                        amount_applied = [Math]::Round((Convert-ToDecimalSafe $row.('Amount Applied to Invoice')), 2)
                        withholding_tax_amount = [Math]::Round((Convert-ToDecimalSafe $row.('Withholding Tax Amount')), 2)
                    }
                }
        )
        [pscustomobject]@{
            payment_number = [string]$first.('Payment Number')
            customer_payment_id = [string]$first.('CustomerPayment ID')
            customer_id = [string]$first.CustomerID
            customer_name = [string]$first.('Customer Name')
            mode = [string]$first.Mode
            payment_type = [string]$first.('Payment Type')
            payment_date = $(if ($paymentDate) { $paymentDate.ToString("yyyy-MM-dd") } else { $null })
            created_date = $(if ($createdTime) { $createdTime.ToString("yyyy-MM-dd") } else { $null })
            amount = [Math]::Round((Convert-ToDecimalSafe $first.Amount), 2)
            unused_amount = [Math]::Round((Convert-ToDecimalSafe $first.('Unused Amount')), 2)
            bank_charges = [Math]::Round((Convert-ToDecimalSafe $first.('Bank Charges')), 2)
            reference = $(if ($first.('Reference Number')) { [string]$first.('Reference Number') } else { Get-BankReference $first.Description })
            description = [string]$first.Description
            deposit_to = [string]$first.('Deposit To')
            payment_status = [string]$first.('Payment Status')
            linked_invoices = $allocations
            linked_invoice_count = $allocations.Count
            total_applied = [Math]::Round((($allocations | Measure-Object -Property amount_applied -Sum).Sum), 2)
            total_withholding = [Math]::Round((($allocations | Measure-Object -Property withholding_tax_amount -Sum).Sum), 2)
        }
    }

    [pscustomobject]@{
        raw_rows = @($rawRows).Count
        payment_records = @($records)
        duplicates_skipped = @($rawRows).Count - @($records).Count
    }
}

function Get-BankCreditRecords {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Bank reconstruction file not found at $Path."
    }

    $rows = Get-Content $Path -Raw | ConvertFrom-Json
    return @(
        $rows |
            Where-Object { $_.direction -eq "credit" } |
            ForEach-Object {
                [pscustomobject]@{
                    statement_row = $_.statement_row
                    transaction_date = $_.transaction_date
                    amount = [Math]::Round((Convert-ToDecimalSafe ([string]$_.amount)), 2)
                    narration = [string]$_.narration
                    reference = $(if ($_.reference) { [string]$_.reference } else { Get-BankReference $_.narration })
                    counterparty_hint = [string]$_.counterparty_hint
                    prior_classification = [string]$_.classification_tag
                }
            }
    )
}

function Get-BankPaymentCandidatePairs {
    param(
        [object[]]$BankCredits,
        [object[]]$Payments
    )

    $pairs = [System.Collections.Generic.List[object]]::new()
    foreach ($bank in $BankCredits) {
        foreach ($payment in $Payments) {
            $score = 0.0
            $reasons = [System.Collections.Generic.List[string]]::new()
            $amountDiff = [Math]::Abs(([decimal]$bank.amount) - ([decimal]$payment.amount))
            if ($amountDiff -eq [decimal]::Zero) {
                $score += 0.45
                $reasons.Add("exact_amount")
            } elseif ($amountDiff -le [decimal]"1.00") {
                $score += 0.38
                $reasons.Add("amount_within_1")
            } else {
                continue
            }

            $bankDate = [datetime]$bank.transaction_date
            $paymentDate = [datetime]$payment.payment_date
            $dayDelta = [Math]::Abs(($bankDate - $paymentDate).Days)
            if ($dayDelta -eq 0) {
                $score += 0.2
                $reasons.Add("exact_date")
            } elseif ($dayDelta -le 3) {
                $score += 0.15
                $reasons.Add("date_within_3")
            } elseif ($dayDelta -le 7) {
                $score += 0.1
                $reasons.Add("date_within_7")
            } elseif ($dayDelta -le 30) {
                $score += 0.05
                $reasons.Add("date_within_30")
            }

            $nameScore = Get-TextScore $bank.counterparty_hint $payment.customer_name
            if ($nameScore -ge 0.8) {
                $score += 0.2
                $reasons.Add("customer_name_strong")
            } elseif ($nameScore -ge 0.45) {
                $score += 0.12
                $reasons.Add("customer_name_partial")
            }

            $descriptionScore = Get-TextScore $bank.narration $payment.description
            if ($descriptionScore -ge 0.95) {
                $score += 0.3
                $reasons.Add("description_exact")
            } elseif ($descriptionScore -ge 0.8) {
                $score += 0.22
                $reasons.Add("description_contains")
            } elseif ($descriptionScore -ge 0.45) {
                $score += 0.1
                $reasons.Add("description_partial")
            }

            if ($bank.reference -and $payment.reference -and (Get-NormalizedText $bank.reference) -eq (Get-NormalizedText $payment.reference)) {
                $score += 0.15
                $reasons.Add("reference_match")
            }

            $score = [Math]::Min(0.99, [Math]::Round($score, 4))
            $confidence = Get-ConfidenceLabel $score
            if ($confidence -eq "none") {
                continue
            }

            $pairs.Add([pscustomobject]@{
                    bank_row = [int]$bank.statement_row
                    payment_id = [string]$payment.customer_payment_id
                    score = $score
                    confidence = $confidence
                    reasons = @($reasons)
                })
        }
    }

    return @($pairs | Sort-Object @{ Expression = "score"; Descending = $true }, bank_row, payment_id)
}

function Get-DirectInvoiceCandidates {
    param(
        $BankCredit,
        [object[]]$Invoices
    )

    $bankDate = [datetime]$BankCredit.transaction_date
    $amount = [decimal]$BankCredit.amount
    $candidates = foreach ($invoice in $Invoices) {
        $invoiceDate = [datetime]$invoice.invoice_date
        if ($invoiceDate -gt $bankDate) { continue }
        $score = 0.0
        $reasons = [System.Collections.Generic.List[string]]::new()
        if ([Math]::Abs($amount - [decimal]$invoice.total) -le [decimal]"1.00") {
            $score += 0.45
            $reasons.Add("invoice_amount_match")
        } else {
            continue
        }
        $nameScore = Get-TextScore $BankCredit.counterparty_hint $invoice.customer_name
        if ($nameScore -ge 0.8) {
            $score += 0.25
            $reasons.Add("customer_name_strong")
        } elseif ($nameScore -ge 0.45) {
            $score += 0.12
            $reasons.Add("customer_name_partial")
        }
        if ((Get-NormalizedText $BankCredit.narration).Contains((Get-NormalizedText $invoice.invoice_number))) {
            $score += 0.2
            $reasons.Add("invoice_number_in_narration")
        }
        $ageDays = ($bankDate - $invoiceDate).Days
        if ($ageDays -le 30) { $score += 0.1; $reasons.Add("invoice_within_30_days") }
        elseif ($ageDays -le 90) { $score += 0.05; $reasons.Add("invoice_within_90_days") }

        $score = [Math]::Min(0.8, [Math]::Round($score, 4))
        $confidence = Get-ConfidenceLabel $score
        if ($confidence -eq "none") { continue }
        [pscustomobject]@{
            invoice_number = $invoice.invoice_number
            customer_name = $invoice.customer_name
            invoice_date = $invoice.invoice_date
            amount = $invoice.total
            score = $score
            confidence = $confidence
            reasons = @($reasons)
        }
    }

    return @($candidates | Sort-Object @{ Expression = "score"; Descending = $true } | Select-Object -First 3)
}

$invoicePaths = @(
    (Join-Path $rawDir "invoice_fy23_24_h1.csv"),
    (Join-Path $rawDir "invoice_fy23_24_h2.csv")
)
$paymentPaths = @(
    (Join-Path $rawDir "payments_fy23_24_h1.csv"),
    (Join-Path $rawDir "payments_fy23_24_h2.csv")
)
foreach ($path in ($invoicePaths + $paymentPaths)) {
    if (-not (Test-Path $path)) { throw "Required revenue file not found at $path." }
}

$invoiceImport = Import-InvoiceFiles -Paths $invoicePaths
$paymentImport = Import-PaymentFiles -Paths $paymentPaths
$bankCredits = Get-BankCreditRecords -Path $bankPath
$candidatePairs = Get-BankPaymentCandidatePairs -BankCredits $bankCredits -Payments $paymentImport.payment_records

$bankByRow = @{}
foreach ($row in $bankCredits) { $bankByRow[[string]$row.statement_row] = $row }
$paymentById = @{}
foreach ($row in $paymentImport.payment_records) { $paymentById[[string]$row.customer_payment_id] = $row }

$assignedBank = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$assignedPayment = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$bankPaymentMatches = [System.Collections.Generic.List[object]]::new()
foreach ($pair in $candidatePairs) {
    if ($assignedBank.Contains([string]$pair.bank_row) -or $assignedPayment.Contains([string]$pair.payment_id)) { continue }
    $assignedBank.Add([string]$pair.bank_row) | Out-Null
    $assignedPayment.Add([string]$pair.payment_id) | Out-Null
    $bank = $bankByRow[[string]$pair.bank_row]
    $payment = $paymentById[[string]$pair.payment_id]
    $bankPaymentMatches.Add([pscustomobject]@{
            bank_row = $bank.statement_row
            bank_date = $bank.transaction_date
            bank_amount = $bank.amount
            bank_narration = $bank.narration
            payment_id = $payment.customer_payment_id
            payment_number = $payment.payment_number
            payment_date = $payment.payment_date
            payment_amount = $payment.amount
            customer_name = $payment.customer_name
            score = $pair.score
            confidence = $pair.confidence
            reasons = $pair.reasons
            linked_invoices = $payment.linked_invoices
        })
}

$matchedBankRows = $assignedBank
$matchedPaymentIds = $assignedPayment
$unmatchedBankCredits = @($bankCredits | Where-Object { -not $matchedBankRows.Contains([string]$_.statement_row) })
$unmatchedPayments = @($paymentImport.payment_records | Where-Object { -not $matchedPaymentIds.Contains([string]$_.customer_payment_id) })
$directInvoiceMatches = @(
    foreach ($bank in $unmatchedBankCredits) {
        $candidates = Get-DirectInvoiceCandidates -BankCredit $bank -Invoices $invoiceImport.invoice_records
        if (@($candidates).Count -gt 0) {
            [pscustomobject]@{
                bank_row = $bank.statement_row
                bank_date = $bank.transaction_date
                bank_amount = $bank.amount
                narration = $bank.narration
                candidates = $candidates
            }
        }
    }
)

$invoiceLedgerMap = @{}
foreach ($invoice in $invoiceImport.invoice_records) {
    $invoiceLedgerMap[[string]$invoice.invoice_number] = [ordered]@{
        invoice_number = $invoice.invoice_number
        invoice_id = $invoice.invoice_id
        customer_name = $invoice.customer_name
        invoice_date = $invoice.invoice_date
        due_date = $invoice.due_date
        invoice_status = $invoice.invoice_status
        total = [decimal]$invoice.total
        subtotal = [decimal]$invoice.subtotal
        tax_breakup = $invoice.tax_breakup
        payment_ids = [System.Collections.Generic.List[string]]::new()
        bank_rows = [System.Collections.Generic.List[string]]::new()
        cash_received = [decimal]::Zero
        withholding = [decimal]::Zero
    }
}

foreach ($match in $bankPaymentMatches) {
    foreach ($alloc in $match.linked_invoices) {
        if (-not $invoiceLedgerMap.ContainsKey([string]$alloc.invoice_number)) { continue }
        $ledger = $invoiceLedgerMap[[string]$alloc.invoice_number]
        $ledger.cash_received += [decimal]$alloc.amount_applied
        $ledger.withholding += [decimal]$alloc.withholding_tax_amount
        if (-not $ledger.payment_ids.Contains([string]$match.payment_id)) { $ledger.payment_ids.Add([string]$match.payment_id) }
        if (-not $ledger.bank_rows.Contains([string]$match.bank_row)) { $ledger.bank_rows.Add([string]$match.bank_row) }
    }
}

$invoiceLedger = @(
    foreach ($item in $invoiceLedgerMap.Values) {
        $settled = [Math]::Round(($item.cash_received + $item.withholding), 2)
        $outstanding = [Math]::Round([Math]::Max(0, $item.total - $settled), 2)
        $invoiceDate = [datetime]$item.invoice_date
        $agingDays = if ($outstanding -gt 0) { ($fyEnd - $invoiceDate).Days } else { 0 }
        $bucket = if ($outstanding -le 0) { "settled" } elseif ($agingDays -le 30) { "0-30" } elseif ($agingDays -le 60) { "31-60" } elseif ($agingDays -le 90) { "61-90" } elseif ($agingDays -le 180) { "91-180" } else { "181+" }
        [pscustomobject]@{
            invoice_number = $item.invoice_number
            customer_name = $item.customer_name
            invoice_date = $item.invoice_date
            total = [Math]::Round($item.total, 2)
            cash_received = [Math]::Round($item.cash_received, 2)
            withholding = [Math]::Round($item.withholding, 2)
            settled = $settled
            outstanding = $outstanding
            aging_bucket = $bucket
            bank_match_count = $item.bank_rows.Count
            payment_match_count = $item.payment_ids.Count
        }
    }
)

$matchingSummary = @(
    $bankPaymentMatches | Group-Object confidence | ForEach-Object { [pscustomobject]@{ confidence = $_.Name; count = $_.Count; amount = [Math]::Round((($_.Group | Measure-Object -Property bank_amount -Sum).Sum), 2) } }
) | Sort-Object @{ Expression = "confidence"; Descending = $true }

$totalInvoiced = [Math]::Round((($invoiceLedger | Measure-Object -Property total -Sum).Sum), 2)
$totalReceivedByPayments = [Math]::Round((($paymentImport.payment_records | Measure-Object -Property amount -Sum).Sum), 2)
$totalMatchedBankReceipts = [Math]::Round((($bankPaymentMatches | Measure-Object -Property bank_amount -Sum).Sum), 2)
$totalCashAllocated = [Math]::Round((($invoiceLedger | Measure-Object -Property cash_received -Sum).Sum), 2)
$totalWithholding = [Math]::Round((($invoiceLedger | Measure-Object -Property withholding -Sum).Sum), 2)
$totalOutstanding = [Math]::Round((($invoiceLedger | Measure-Object -Property outstanding -Sum).Sum), 2)
$unmatchedBankAmount = [Math]::Round((($unmatchedBankCredits | Measure-Object -Property amount -Sum).Sum), 2)
$unmatchedPaymentAmount = [Math]::Round((($unmatchedPayments | Measure-Object -Property amount -Sum).Sum), 2)
$unusedReceiptAmount = [Math]::Round((($paymentImport.payment_records | Measure-Object -Property unused_amount -Sum).Sum), 2)
$agingBuckets = @($invoiceLedger | Group-Object aging_bucket | ForEach-Object { [pscustomobject]@{ bucket = $_.Name; count = $_.Count; outstanding = [Math]::Round((($_.Group | Measure-Object -Property outstanding -Sum).Sum), 2) } } | Sort-Object bucket)
$unpaidInvoices = @($invoiceLedger | Where-Object { $_.outstanding -gt 0 } | Sort-Object outstanding -Descending)
$taxOnInvoices = [Math]::Round((($invoiceImport.invoice_records | ForEach-Object { [decimal]($_.tax_breakup.cgst + $_.tax_breakup.sgst + $_.tax_breakup.igst + $_.tax_breakup.cess) } | Measure-Object -Sum).Sum), 2)

$report = [pscustomobject]@{
    invoice_ingestion = [pscustomobject]@{ raw_rows = $invoiceImport.raw_rows; unique_invoices = $invoiceImport.invoice_records.Count; duplicates_skipped = $invoiceImport.duplicates_skipped }
    payment_ingestion = [pscustomobject]@{ raw_rows = $paymentImport.raw_rows; unique_payments = $paymentImport.payment_records.Count; duplicates_skipped = $paymentImport.duplicates_skipped }
    matching_results = [pscustomobject]@{ bank_to_payment = $matchingSummary; matched_bank_receipts = $bankPaymentMatches.Count; unmatched_bank_receipts = $unmatchedBankCredits.Count; unmatched_payment_records = $unmatchedPayments.Count; direct_invoice_heuristics = $directInvoiceMatches.Count }
    totals = [pscustomobject]@{ total_invoiced = $totalInvoiced; total_received_by_payments = $totalReceivedByPayments; total_matched_bank_receipts = $totalMatchedBankReceipts; total_cash_allocated_to_invoices = $totalCashAllocated; total_withholding_captured = $totalWithholding; total_outstanding_as_of_fy_end = $totalOutstanding; total_invoice_tax = $taxOnInvoices }
    unmatched_receipts = [pscustomobject]@{ bank_credits_without_payment_match_count = $unmatchedBankCredits.Count; bank_credits_without_payment_match_amount = $unmatchedBankAmount; payment_records_without_bank_match_count = $unmatchedPayments.Count; payment_records_without_bank_match_amount = $unmatchedPaymentAmount; unused_receipt_amount = $unusedReceiptAmount; bank_credit_samples = @($unmatchedBankCredits | Select-Object -First 20); payment_samples = @($unmatchedPayments | Select-Object -First 20 payment_number,customer_name,payment_date,amount,description,reference,linked_invoice_count,unused_amount) }
    unpaid_invoices = [pscustomobject]@{ count = $unpaidInvoices.Count; outstanding_amount = $totalOutstanding; top_items = @($unpaidInvoices | Select-Object -First 25) }
    aging = @($agingBuckets)
    key_inconsistencies = @(
        [pscustomobject]@{ issue = "bank_receipts_without_payment_record"; value = $unmatchedBankAmount; detail = "$($unmatchedBankCredits.Count) bank credits did not land on a payment record match." }
        [pscustomobject]@{ issue = "payment_records_without_bank_match"; value = $unmatchedPaymentAmount; detail = "$($unmatchedPayments.Count) payment records did not land on a bank credit match." }
        [pscustomobject]@{ issue = "unused_receipts"; value = $unusedReceiptAmount; detail = "Unused amounts remain on customer payment records." }
        [pscustomobject]@{ issue = "fy_end_receivables"; value = $totalOutstanding; detail = "$($unpaidInvoices.Count) invoices remain outstanding based on FY-end payment evidence." }
    )
    readiness = [pscustomobject]@{
        gst_itr_alignment = if ($unmatchedBankCredits.Count -eq 0 -and $unmatchedPayments.Count -eq 0 -and $totalOutstanding -eq 0) { "ready" } else { "not_ready" }
        reason = "Revenue-side evidence improved materially, but unmatched bank receipts, unmatched payment records, and FY-end outstanding invoices still require review before GST/ITR alignment."
    }
}

New-Item -ItemType Directory -Path $exportDir -Force | Out-Null
$invoiceOut = Join-Path $exportDir "$OutputPrefix.invoices.json"
$paymentOut = Join-Path $exportDir "$OutputPrefix.payments.json"
$matchOut = Join-Path $exportDir "$OutputPrefix.matches.json"
$reportOut = Join-Path $exportDir "$OutputPrefix.report.json"
$summaryOut = Join-Path $exportDir "$OutputPrefix.summary.md"
$invoiceImport.invoice_records | ConvertTo-Json -Depth 8 | Set-Content -Path $invoiceOut -Encoding UTF8
$paymentImport.payment_records | ConvertTo-Json -Depth 8 | Set-Content -Path $paymentOut -Encoding UTF8
[pscustomobject]@{ bank_payment_matches = $bankPaymentMatches; unmatched_bank_credits = $unmatchedBankCredits; unmatched_payments = $unmatchedPayments; direct_invoice_heuristics = $directInvoiceMatches; invoice_ledger = $invoiceLedger } | ConvertTo-Json -Depth 10 | Set-Content -Path $matchOut -Encoding UTF8
$report | ConvertTo-Json -Depth 10 | Set-Content -Path $reportOut -Encoding UTF8
$md = @(
    "# FY 2023-24 Revenue Reconstruction","","## Invoice ingestion","- Raw invoice rows: $($invoiceImport.raw_rows)","- Unique invoices: $($invoiceImport.invoice_records.Count)","- Safe dedupe reduction: $($invoiceImport.duplicates_skipped)","","## Payments ingestion","- Raw payment rows: $($paymentImport.raw_rows)","- Unique payment records: $($paymentImport.payment_records.Count)","- Safe dedupe reduction: $($paymentImport.duplicates_skipped)","","## Matching results"
) + @($matchingSummary | ForEach-Object { "- $($_.confidence): $($_.count) receipts, INR $('{0:N2}' -f $_.amount)" }) + @(
    "- Unmatched bank receipts: $($unmatchedBankCredits.Count), INR $('{0:N2}' -f $unmatchedBankAmount)","- Unmatched payment records: $($unmatchedPayments.Count), INR $('{0:N2}' -f $unmatchedPaymentAmount)","","## Revenue view","- Total invoiced: INR $('{0:N2}' -f $totalInvoiced)","- Total received by payment records: INR $('{0:N2}' -f $totalReceivedByPayments)","- Total bank receipts matched to payments: INR $('{0:N2}' -f $totalMatchedBankReceipts)","- Total cash allocated to invoices: INR $('{0:N2}' -f $totalCashAllocated)","- Total withholding captured: INR $('{0:N2}' -f $totalWithholding)","- FY-end outstanding: INR $('{0:N2}' -f $totalOutstanding)","","## Aging"
) + @($agingBuckets | ForEach-Object { "- $($_.bucket): $($_.count) invoices, INR $('{0:N2}' -f $_.outstanding)" }) + @("","## Readiness","- GST/ITR alignment: $($report.readiness.gst_itr_alignment)","- Reason: $($report.readiness.reason)")
$md -join [Environment]::NewLine | Set-Content -Path $summaryOut -Encoding UTF8
[pscustomobject]@{ invoices_json = $invoiceOut; payments_json = $paymentOut; matches_json = $matchOut; report_json = $reportOut; summary_md = $summaryOut; unique_invoices = $invoiceImport.invoice_records.Count; unique_payments = $paymentImport.payment_records.Count; matched_bank_receipts = $bankPaymentMatches.Count; unmatched_bank_receipts = $unmatchedBankCredits.Count; unpaid_invoices = $unpaidInvoices.Count } | ConvertTo-Json -Compress
