param(
    [string]$ZipQ1 = "C:\Users\sujit\Downloads\Reconciliation+Status.zip",
    [string]$ZipQ2 = "C:\Users\sujit\Downloads\Reconciliation+Status(1).zip",
    [string]$ZipQ3 = "C:\Users\sujit\Downloads\Reconciliation+Status(2).zip",
    [string]$ZipQ4 = "C:\Users\sujit\Downloads\Reconciliation+Status(3).zip",
    [string]$BillsCsv = "C:\sattva\books_recon\data\exports\bills_reconstruction\sattva_bills_reconstructed_v1.csv",
    [string]$ZohoActionQueueCsv = "C:\sattva\books_recon\data\exports\bills_reconstruction\sattva_zoho_action_queue_v1.csv",
    [string]$OutputDir = "C:\sattva\books_recon\data\exports\reconciliation_status_fy23_24"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$QuarterMap = [ordered]@{
    $ZipQ1 = "Q1_APR_JUN_2023"
    $ZipQ2 = "Q2_JUL_SEP_2023"
    $ZipQ3 = "Q3_OCT_DEC_2023"
    $ZipQ4 = "Q4_JAN_MAR_2024"
}

$FyStart = [datetime]"2023-04-01"

function Read-ZipCsv {
    param(
        [string]$ZipPath,
        [string]$EntryName
    )

    $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $entry = $zip.GetEntry($EntryName)
        if ($null -eq $entry) {
            throw "Missing $EntryName in $ZipPath."
        }
        $reader = [System.IO.StreamReader]::new($entry.Open())
        try {
            $content = $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }
    }
    finally {
        $zip.Dispose()
    }

    if ([string]::IsNullOrWhiteSpace($content)) {
        return @()
    }
    return @($content | ConvertFrom-Csv)
}

function Normalize-Text {
    param([AllowNull()][string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return ""
    }
    $text = $Value.ToUpperInvariant()
    $text = [regex]::Replace($text, "[^A-Z0-9]+", " ")
    return [regex]::Replace($text, "\s+", " ").Trim()
}

function Normalize-Payee {
    param([AllowNull()][string]$Value)
    return Normalize-Text $Value
}

function Convert-ToDecimalOrZero {
    param([AllowNull()][string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return [decimal]::Zero
    }

    $clean = $Value.Replace(",", "").Replace("₹", "").Replace("â‚¹", "").Trim()
    $parsed = [decimal]::Zero
    if ([decimal]::TryParse($clean, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
        return [Math]::Round($parsed, 2)
    }
    return [decimal]::Zero
}

function Convert-ToDateString {
    param([AllowNull()][string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return ""
    }

    $formats = @("yyyy-MM-dd", "dd/MM/yyyy", "MM/dd/yyyy", "dd-MM-yyyy")
    foreach ($format in $formats) {
        $parsed = [datetime]::MinValue
        if ([datetime]::TryParseExact($Value.Trim(), $format, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::None, [ref]$parsed)) {
            return $parsed.ToString("yyyy-MM-dd")
        }
    }

    return ([datetime]::Parse($Value, [System.Globalization.CultureInfo]::InvariantCulture)).ToString("yyyy-MM-dd")
}

function Convert-ToDateObject {
    param([AllowNull()][string]$Value)

    $dateText = Convert-ToDateString $Value
    if ([string]::IsNullOrWhiteSpace($dateText)) {
        return $null
    }
    return [datetime]::ParseExact($dateText, "yyyy-MM-dd", [System.Globalization.CultureInfo]::InvariantCulture)
}

function Get-CompositeIssueKey {
    param($Row)
    $parts = @(
        $Row.Zoho_Date,
        ("{0:0.00}" -f [decimal]$Row.Debit),
        ("{0:0.00}" -f [decimal]$Row.Credit),
        (Normalize-Text $Row.Transaction_Type),
        $Row.Payee_Normalized
    )
    return ($parts -join "|")
}

function Get-TokenSimilarity {
    param(
        [string]$Left,
        [string]$Right
    )

    $noise = @("PRIVATE","PVT","LIMITED","LTD","LLP","INDIA","SERVICES","SERVICE","COMPANY","CO","CORPORATION","CORP","PTE","SHIPPING","LOGISTICS","LOGISTIX","AGENCIES","AGENCY","ONLINE","SOLUTIONS","GLOBAL","LINE","LINES","SA")

    $leftTokens = @(Normalize-Text $Left -split " " | Where-Object { $_ -and $_.Length -ge 3 -and $noise -notcontains $_ } | Select-Object -Unique)
    $rightTokens = @(Normalize-Text $Right -split " " | Where-Object { $_ -and $_.Length -ge 3 -and $noise -notcontains $_ } | Select-Object -Unique)
    if ($leftTokens.Count -eq 0 -or $rightTokens.Count -eq 0) {
        return 0.0
    }

    $intersections = @($leftTokens | Where-Object { $rightTokens -contains $_ }).Count
    return [Math]::Round(($intersections / [double][Math]::Max($leftTokens.Count, $rightTokens.Count)), 4)
}

function Get-BillCandidates {
    param(
        $Row,
        [object[]]$Bills
    )

    if ($Row.Audit_Class -ne "VENDOR_PAYMENT") {
        return @()
    }

    $zohoDate = Convert-ToDateObject $Row.Zoho_Date
    if ($null -eq $zohoDate) {
        return @()
    }

    $rowAmount = if ($Row.Direction -eq "OUTFLOW") { [decimal]$Row.Credit } else { [decimal]$Row.Debit }
    $candidates = foreach ($bill in $Bills) {
        $billDate = Convert-ToDateObject $bill.Document_Date
        if ($null -eq $billDate) { continue }
        $dateDelta = [Math]::Abs(($zohoDate - $billDate).Days)
        if ($dateDelta -gt 120) { continue }

        $nameScore = Get-TokenSimilarity -Left $Row.Payee_Normalized -Right $bill.Party_Name_Normalized
        $billNumberNormalized = Normalize-Text $bill.'Bill#'
        $referenceNormalized = Normalize-Text $bill.'Reference Number'
        $rowReference = Normalize-Text $Row.Reference_Number
        $billNumberHit = -not [string]::IsNullOrWhiteSpace($billNumberNormalized) -and $rowReference.Contains($billNumberNormalized)
        $referenceHit = -not [string]::IsNullOrWhiteSpace($referenceNormalized) -and $rowReference.Contains($referenceNormalized)

        $targets = @()
        $targets += [decimal](Convert-ToDecimalOrZero $bill.Clean_Total_Amount)
        $targets += [decimal](Convert-ToDecimalOrZero $bill.Clean_Balance_Due)
        $targets = @($targets | Where-Object { $_ -gt 0 } | Select-Object -Unique)
        if ($targets.Count -eq 0) { continue }

        $bestTarget = $targets | ForEach-Object {
            [pscustomobject]@{
                target = [decimal]$_
                delta_pct = [Math]::Round(([Math]::Abs($rowAmount - $_) / [double]$_) * 100, 4)
            }
        } | Sort-Object delta_pct | Select-Object -First 1

        $within3 = $bestTarget.delta_pct -le 3.0
        $within10 = $bestTarget.delta_pct -le 10.0
        $hasNameEvidence = $nameScore -ge 0.35 -or $billNumberHit -or $referenceHit
        if (-not $hasNameEvidence) { continue }
        if (-not $within10 -and -not $billNumberHit -and -not $referenceHit) { continue }

        $score = 0.0
        if ($billNumberHit) { $score += 0.45 }
        if ($referenceHit) { $score += 0.25 }
        $score += [Math]::Min(0.40, ($nameScore * 0.40))
        if ($within3) { $score += 0.25 } elseif ($within10) { $score += 0.10 }
        $score += [Math]::Max(0.0, (0.10 - ($dateDelta / 1000.0)))
        $score = [Math]::Min(0.99, [Math]::Round($score, 4))

        $confidence = "LOW"
        if (($billNumberHit -or $referenceHit -or $nameScore -ge 0.65) -and $within3 -and $dateDelta -le 90) {
            $confidence = "HIGH"
        }
        elseif ($nameScore -ge 0.45 -and $within3) {
            $confidence = "MEDIUM"
        }

        [pscustomobject]@{
            Bill = $bill
            Score = $score
            Confidence = $confidence
            NameScore = $nameScore
            AmountDeltaPct = $bestTarget.delta_pct
            DateDeltaDays = $dateDelta
            BillNumberHit = $billNumberHit
            ReferenceHit = $referenceHit
        }
    }

    return @($candidates | Sort-Object @{ Expression = "Confidence"; Descending = $true }, @{ Expression = "Score"; Descending = $true }, @{ Expression = "DateDeltaDays"; Ascending = $true })
}

function Get-AuditClass {
    param($Row)

    if ($Row.Legacy_Flag -eq "YES") {
        return "LEGACY_OPENING_MISMATCH"
    }

    $transactionType = Normalize-Text $Row.Transaction_Type
    $payee = $Row.Payee_Normalized
    $reference = Normalize-Text $Row.Reference_Number

    switch ($transactionType) {
        "CUSTOMER PAYMENT" { return "CUSTOMER_RECEIPT" }
        "VENDOR PAYMENT" { return "VENDOR_PAYMENT" }
        "OWNERS DRAWINGS" { return "OWNER_DRAWING" }
    }

    if ($transactionType -eq "DEPOSIT") {
        if ($payee -match "SUJITH|NSUJITH|51909|217") { return "OWNER_FUNDING" }
        return "CUSTOMER_RECEIPT"
    }

    if ($transactionType -eq "OTHER INCOME") {
        return "INTEREST"
    }

    if ($transactionType -eq "EXPENSE") {
        if ($payee -match "GST|CGST|SGST|IGST") { return "GST_PAYMENT" }
        if ($payee -match "INCOME TAX|ADVANCE TAX|SELF ASSESSMENT|TDS" -or $reference -match "INCOME TAX|ADVANCE TAX|SELF ASSESSMENT|TDS") { return "INCOME_TAX_PAYMENT" }
        if ($payee -match "BANK CHARGE|CHARGE|MAINTENANCE" -or $reference -match "BANK CHARGE|CHARGE|MAINTENANCE") { return "BANK_CHARGES" }
        if ($payee -match "SUJITH|NSUJITH|51909|217") { return "OWNER_DRAWING" }
        if (-not [string]::IsNullOrWhiteSpace($payee)) { return "VENDOR_PAYMENT" }
        return "EXPENSE_UNCLEAR"
    }

    if ($transactionType -eq "VENDOR PAYMENT REFUND") {
        return "UNKNOWN"
    }

    return "UNKNOWN"
}

function Get-RecommendedAction {
    param($Row)

    switch ($Row.Audit_Class) {
        "LEGACY_OPENING_MISMATCH" { return "MARK_AS_LEGACY_OPENING_ITEM" }
        "GST_PAYMENT" { return "TAG_AS_TAX_PAYMENT" }
        "INCOME_TAX_PAYMENT" { return "TAG_AS_TAX_PAYMENT" }
        "OWNER_FUNDING" { return "REVIEW_OWNER_FUNDING" }
        "OWNER_DRAWING" { return "REVIEW_OWNER_DRAWING" }
        "EXPENSE_UNCLEAR" { return "HOLD_EXPENSE_UNCLEAR" }
        "VENDOR_PAYMENT" {
            if ($Row.Bill_Match_Flag -eq "YES") { return "RELINK_TO_EXISTING_BILL_OR_PAYMENT" }
            return "KEEP_FOR_RECONCILIATION"
        }
        "CUSTOMER_RECEIPT" { return "KEEP_FOR_RECONCILIATION" }
        default { return "MANUAL_REVIEW_REQUIRED" }
    }
}

function Add-QuarterRows {
    param(
        [System.Collections.Generic.List[object]]$Target,
        [string]$ZipPath,
        [string]$QuarterLabel,
        [string]$EntryName,
        [string]$SetLabel
    )

    foreach ($row in Read-ZipCsv -ZipPath $ZipPath -EntryName $EntryName) {
        $statementAmountRaw = if ($row.PSObject.Properties.Name -contains "Statement Amount") { [string]$row.'Statement Amount' } else { "" }
        $statementDateRaw = if ($row.PSObject.Properties.Name -contains "Statement Date") { [string]$row.'Statement Date' } else { "" }
        $statementIdRaw = if ($row.PSObject.Properties.Name -contains "Statement ID") { [string]$row.'Statement ID' } else { "" }
        $target.Add([pscustomobject]@{
                Statement_ID = $statementIdRaw
                Statement_Amount = [Math]::Round([decimal](Convert-ToDecimalOrZero $statementAmountRaw), 2)
                Statement_Date = Convert-ToDateString $statementDateRaw
                Zoho_Date = Convert-ToDateString $row.Date
                Debit = [Math]::Round([decimal](Convert-ToDecimalOrZero $row.Debit), 2)
                Credit = [Math]::Round([decimal](Convert-ToDecimalOrZero $row.Credit), 2)
                Transaction_Type = [string]$row.'Transaction Type'
                Payee = [string]$row.Payee
                Payee_Normalized = Normalize-Payee $row.Payee
                Currency_Code = [string]$row.'Currency code'
                Reference_Number = [string]$row.'Reference#'
                Reconciliation_Status = [string]$row.'Reconciliation Status'
                Source_Quarter = $QuarterLabel
                Source_File = [System.IO.Path]::GetFileName($ZipPath)
                Source_Set = $SetLabel
            })
    }
}

if (-not (Test-Path $BillsCsv)) {
    throw "Bills CSV not found at $BillsCsv."
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$matchedRows = [System.Collections.Generic.List[object]]::new()
$unreconciledRowsRaw = [System.Collections.Generic.List[object]]::new()
$unmatchedTxnRowsRaw = [System.Collections.Generic.List[object]]::new()
$legacyRows = [System.Collections.Generic.List[object]]::new()
$unmatchedBankStatementCounts = [System.Collections.Generic.List[object]]::new()

foreach ($zipPath in $QuarterMap.Keys) {
    $quarter = $QuarterMap[$zipPath]
    Add-QuarterRows -Target $matchedRows -ZipPath $zipPath -QuarterLabel $quarter -EntryName "matched and categorized transactions.csv" -SetLabel "MATCHED"
    Add-QuarterRows -Target $unreconciledRowsRaw -ZipPath $zipPath -QuarterLabel $quarter -EntryName "unreconciled transactions.csv" -SetLabel "UNRECONCILED"
    Add-QuarterRows -Target $unmatchedTxnRowsRaw -ZipPath $zipPath -QuarterLabel $quarter -EntryName "unmatched transactions.csv" -SetLabel "UNMATCHED_TXN"

    $unmatchedBankRows = @(Read-ZipCsv -ZipPath $zipPath -EntryName "unmatched bank statements.csv")
    $unmatchedBankStatementCounts.Add([pscustomobject]@{
            Source_Quarter = $quarter
            Source_File = [System.IO.Path]::GetFileName($zipPath)
            Unmatched_Bank_Statement_Rows = $unmatchedBankRows.Count
        })
}

$bills = @(Import-Csv -Path $BillsCsv)

$matchedMaster = foreach ($row in $matchedRows) {
    $legacyFlag = if ((Convert-ToDateObject $row.Zoho_Date) -lt $FyStart -or (Convert-ToDateObject $row.Statement_Date) -lt $FyStart) { "YES" } else { "NO" }
    $direction = if ($row.Debit -gt 0 -and $row.Credit -eq 0) { "INFLOW" } elseif ($row.Credit -gt 0 -and $row.Debit -eq 0) { "OUTFLOW" } elseif ((Normalize-Text $row.Transaction_Type) -eq "CUSTOMER PAYMENT") { "INFLOW" } else { "OUTFLOW" }

    $record = [pscustomobject]@{
        Statement_ID = $row.Statement_ID
        Statement_Amount = [Math]::Round([decimal]$row.Statement_Amount, 2)
        Statement_Date = $row.Statement_Date
        Zoho_Date = $row.Zoho_Date
        Debit = [Math]::Round([decimal]$row.Debit, 2)
        Credit = [Math]::Round([decimal]$row.Credit, 2)
        Transaction_Type = $row.Transaction_Type
        Payee = $row.Payee
        Payee_Normalized = $row.Payee_Normalized
        Currency_Code = $row.Currency_Code
        Reference_Number = [string]$row.Reference_Number
        Reconciliation_Status = $row.Reconciliation_Status
        Source_Quarter = $row.Source_Quarter
        Source_File = $row.Source_File
        Direction = $direction
        Audit_Class = ""
        Proof_Status = ""
        Legacy_Flag = $legacyFlag
        Review_Flag = "NO"
        Recommended_Zoho_Action = ""
        Notes = ""
        Bill_Match_Flag = "NO"
        Matched_Bill_ID = ""
        Match_Confidence = "NONE"
        Bill_Match_Notes = ""
    }

    $record.Audit_Class = Get-AuditClass -Row $record
    $record.Proof_Status = if (-not [string]::IsNullOrWhiteSpace($record.Statement_ID) -and -not [string]::IsNullOrWhiteSpace($record.Statement_Date)) { "PROVEN_BY_STATEMENT_AND_ZOHO" } else { "PROVEN_BY_ZOHO_ONLY" }

    $billCandidates = @(Get-BillCandidates -Row $record -Bills $bills)
    if ($record.Audit_Class -eq "VENDOR_PAYMENT" -and $billCandidates.Count -gt 0) {
        $top = $billCandidates | Select-Object -First 1
        $record.Bill_Match_Flag = "YES"
        $record.Matched_Bill_ID = $top.Bill.BILL_ID
        $record.Match_Confidence = $top.Confidence
        $record.Bill_Match_Notes = "Name score $($top.NameScore); amount delta $($top.AmountDeltaPct)% ; date delta $($top.DateDeltaDays) days."
    }
    elseif ($record.Audit_Class -eq "VENDOR_PAYMENT") {
        $record.Bill_Match_Notes = "No safe bill match found in supplied bill dataset."
    }

    $record.Review_Flag = if ($record.Legacy_Flag -eq "YES" -or $record.Audit_Class -in @("UNKNOWN","EXPENSE_UNCLEAR","OWNER_FUNDING","OWNER_DRAWING")) { "YES" } elseif ($record.Audit_Class -eq "VENDOR_PAYMENT" -and $record.Match_Confidence -in @("LOW","NONE")) { "YES" } else { "NO" }
    $record.Recommended_Zoho_Action = Get-RecommendedAction -Row $record
    $record.Notes = switch ($record.Audit_Class) {
        "LEGACY_OPENING_MISMATCH" { "Zoho-side transaction date falls before FY23-24 and should be treated as legacy opening contamination." }
        "CUSTOMER_RECEIPT" { "Matched statement row plus Zoho customer-side label." }
        "VENDOR_PAYMENT" {
            if ($record.Bill_Match_Flag -eq "YES") { "Vendor-side match exists in supplied bill dataset." } else { "Vendor-side classification proven by statement+Zoho, but bill linkage is not proven from supplied bills file." }
        }
        "GST_PAYMENT" { "Expense row shows GST-like payee/reference wording." }
        "INCOME_TAX_PAYMENT" { "Expense row shows income-tax/TDS-like payee/reference wording." }
        "BANK_CHARGES" { "Charge-like payee/reference wording." }
        "OWNER_FUNDING" { "Deposit wording suggests owner/personal funding; keep under review." }
        "OWNER_DRAWING" { "Zoho transaction type or payee suggests drawings; keep under review." }
        "EXPENSE_UNCLEAR" { "Expense row has no reliable payee evidence for tax/vendor/owner classification." }
        "INTEREST" { "Other income treated as interest unless contrary evidence appears." }
        default { "Classification not proven beyond available export fields." }
    }

    $record
}

$dedupeMaps = @{
    Unreconciled = @{}
    Unmatched = @{}
}

foreach ($row in $unreconciledRowsRaw) {
    $legacy = if ((Convert-ToDateObject $row.Zoho_Date) -lt $FyStart) { "YES" } else { "NO" }
    $item = [pscustomobject]@{
        Zoho_Date = $row.Zoho_Date
        Debit = [Math]::Round([decimal]$row.Debit, 2)
        Credit = [Math]::Round([decimal]$row.Credit, 2)
        Transaction_Type = $row.Transaction_Type
        Payee = $row.Payee
        Payee_Normalized = $row.Payee_Normalized
        Currency_Code = $row.Currency_Code
        Reference_Number = [string]$row.Reference_Number
        Reconciliation_Status = $row.Reconciliation_Status
        Source_Quarter = $row.Source_Quarter
        Source_File = $row.Source_File
        LEGACY_PRE_FY23_24 = $legacy
    }
    $key = Get-CompositeIssueKey -Row $item
    if (-not $dedupeMaps.Unreconciled.ContainsKey($key)) {
        $dedupeMaps.Unreconciled[$key] = $item
    }
}

foreach ($row in $unmatchedTxnRowsRaw) {
    $legacy = if ((Convert-ToDateObject $row.Zoho_Date) -lt $FyStart) { "YES" } else { "NO" }
    $item = [pscustomobject]@{
        Zoho_Date = $row.Zoho_Date
        Debit = [Math]::Round([decimal]$row.Debit, 2)
        Credit = [Math]::Round([decimal]$row.Credit, 2)
        Transaction_Type = $row.Transaction_Type
        Payee = $row.Payee
        Payee_Normalized = $row.Payee_Normalized
        Currency_Code = $row.Currency_Code
        Reference_Number = [string]$row.Reference_Number
        Reconciliation_Status = $row.Reconciliation_Status
        Source_Quarter = $row.Source_Quarter
        Source_File = $row.Source_File
        LEGACY_PRE_FY23_24 = $legacy
    }
    $key = Get-CompositeIssueKey -Row $item
    if (-not $dedupeMaps.Unmatched.ContainsKey($key)) {
        $dedupeMaps.Unmatched[$key] = $item
    }
}

$unreconciledMaster = @($dedupeMaps.Unreconciled.Values | Sort-Object Zoho_Date, Debit, Credit, Transaction_Type, Payee)
$unmatchedTxnMaster = @($dedupeMaps.Unmatched.Values | Sort-Object Zoho_Date, Debit, Credit, Transaction_Type, Payee)

foreach ($row in $matchedMaster) {
    if ($row.Legacy_Flag -eq "YES") {
        $legacyRows.Add([pscustomobject]@{
                Source_Set = "MATCHED_MASTER"
                Statement_Date = $row.Statement_Date
                Zoho_Date = $row.Zoho_Date
                Statement_Amount = $row.Statement_Amount
                Debit = $row.Debit
                Credit = $row.Credit
                Transaction_Type = $row.Transaction_Type
                Payee = $row.Payee
                Legacy_Flag = $row.Legacy_Flag
                Source_Quarter = $row.Source_Quarter
                Source_File = $row.Source_File
            })
    }
}

foreach ($row in $unreconciledMaster + $unmatchedTxnMaster) {
    if ($row.LEGACY_PRE_FY23_24 -eq "YES") {
        $legacyRows.Add([pscustomobject]@{
                Source_Set = if ($unreconciledMaster -contains $row) { "UNRECONCILED_MASTER" } else { "UNMATCHED_TXN_MASTER" }
                Statement_Date = ""
                Zoho_Date = $row.Zoho_Date
                Statement_Amount = ""
                Debit = $row.Debit
                Credit = $row.Credit
                Transaction_Type = $row.Transaction_Type
                Payee = $row.Payee
                Legacy_Flag = $row.LEGACY_PRE_FY23_24
                Source_Quarter = $row.Source_Quarter
                Source_File = $row.Source_File
            })
    }
}

$vendorBillMatchQueue = @($matchedMaster | Where-Object { $_.Audit_Class -eq "VENDOR_PAYMENT" } | Select-Object Statement_ID,Statement_Date,Zoho_Date,Statement_Amount,Debit,Credit,Transaction_Type,Payee,Reference_Number,Source_Quarter,Source_File,Bill_Match_Flag,Matched_Bill_ID,Match_Confidence,Bill_Match_Notes,Recommended_Zoho_Action,Notes)
$zohoActionQueue = @($matchedMaster | Select-Object Statement_Date,Zoho_Date,Statement_Amount,Transaction_Type,Payee,Audit_Class,Proof_Status,Bill_Match_Flag,Match_Confidence,Legacy_Flag,Recommended_Zoho_Action,Notes)

$matchedMaster | Export-Csv -Path (Join-Path $OutputDir "sattva_fy23_24_matched_master_v1.csv") -NoTypeInformation -Encoding UTF8
$unreconciledMaster | Export-Csv -Path (Join-Path $OutputDir "sattva_fy23_24_unreconciled_master_v1.csv") -NoTypeInformation -Encoding UTF8
$unmatchedTxnMaster | Export-Csv -Path (Join-Path $OutputDir "sattva_fy23_24_unmatched_txn_master_v1.csv") -NoTypeInformation -Encoding UTF8
$legacyRows | Export-Csv -Path (Join-Path $OutputDir "sattva_fy23_24_legacy_items_v1.csv") -NoTypeInformation -Encoding UTF8
$vendorBillMatchQueue | Export-Csv -Path (Join-Path $OutputDir "sattva_fy23_24_vendor_bill_match_queue_v1.csv") -NoTypeInformation -Encoding UTF8
$zohoActionQueue | Export-Csv -Path (Join-Path $OutputDir "sattva_fy23_24_zoho_action_queue_v1.csv") -NoTypeInformation -Encoding UTF8

$customerReceiptCount = @($matchedMaster | Where-Object { $_.Audit_Class -eq "CUSTOMER_RECEIPT" }).Count
$vendorPaymentCount = @($matchedMaster | Where-Object { $_.Audit_Class -eq "VENDOR_PAYMENT" }).Count
$expenseUnclearCount = @($matchedMaster | Where-Object { $_.Audit_Class -eq "EXPENSE_UNCLEAR" }).Count
$highCount = @($matchedMaster | Where-Object { $_.Match_Confidence -eq "HIGH" }).Count
$mediumCount = @($matchedMaster | Where-Object { $_.Match_Confidence -eq "MEDIUM" }).Count
$lowCount = @($matchedMaster | Where-Object { $_.Match_Confidence -eq "LOW" }).Count
$noneCount = @($matchedMaster | Where-Object { $_.Match_Confidence -eq "NONE" }).Count
$legacyCount = @($legacyRows).Count

Write-Output "FY23-24 Reconciliation Status Summary"
Write-Output "total_matched_categorized_annual_rows,$(@($matchedMaster).Count)"
Write-Output "total_unreconciled_annual_rows_after_dedupe,$(@($unreconciledMaster).Count)"
Write-Output "total_unmatched_transaction_annual_rows_after_dedupe,$(@($unmatchedTxnMaster).Count)"
Write-Output "total_legacy_pre_fy23_24_rows,$legacyCount"
Write-Output "total_likely_customer_receipts,$customerReceiptCount"
Write-Output "total_likely_vendor_payments,$vendorPaymentCount"
Write-Output "total_expense_unclear_rows,$expenseUnclearCount"
Write-Output "bill_matches_HIGH,$highCount"
Write-Output "bill_matches_MEDIUM,$mediumCount"
Write-Output "bill_matches_LOW,$lowCount"
Write-Output "bill_matches_NONE,$noneCount"
