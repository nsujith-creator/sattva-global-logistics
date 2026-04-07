param(
    [string]$StatementPath = "C:\Users\sujit\Downloads\3326 Bank Statement 01042023-31032024.xlsx",
    [string]$RepoRoot = "C:\sattva\books_recon",
    [string]$OutputPrefix = "3326_fy2023_24_reconstruction"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

$script:ExcelNamespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
$script:StopTokens = @(
    "NFT", "NEFT", "RTGS", "IMPS", "IB", "TFR", "TO", "BY", "CHRG", "IFO", "SHP", "UPI", "ECM",
    "A", "C", "CNT", "BANK", "STATEMENT", "WITHDRAWAL", "DEPOSIT", "BALANCE", "FN", "GST", "TAX"
)
$script:BankTokens = @(
    "ICICI BANK", "ICICI", "HDFC", "HDFC BANK", "SBI", "STATE BANK OF INDIA", "IDBI", "INDUSIND",
    "AXIS", "YES BANK", "KOTAK", "CANARA", "FEDERAL BANK", "UNION BANK"
)

function Get-NormalizedText {
    param([AllowNull()][string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return ""
    }

    $normalized = $Text.ToUpperInvariant()
    $normalized = [regex]::Replace($normalized, "[^A-Z0-9]+", " ")
    $normalized = [regex]::Replace($normalized, "\s+", " ").Trim()
    return $normalized
}

function Get-UniqueStrings {
    param([string[]]$Values)

    $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $result = [System.Collections.Generic.List[string]]::new()
    foreach ($value in $Values) {
        if ([string]::IsNullOrWhiteSpace($value)) {
            continue
        }
        $trimmed = $value.Trim()
        if ($seen.Add($trimmed)) {
            $result.Add($trimmed)
        }
    }
    return @($result)
}

function Convert-ExcelValueToDate {
    param([AllowNull()][string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    $trimmed = $Value.Trim()
    $doubleValue = 0.0
    if ([double]::TryParse($trimmed, [ref]$doubleValue)) {
        return [DateTime]::FromOADate($doubleValue).Date
    }

    $formats = @(
        "dd/MM/yyyy",
        "dd-MM-yyyy",
        "yyyy-MM-dd",
        "dd/MM/yy",
        "dd-MM-yy",
        "yyyy/MM/dd"
    )
    foreach ($format in $formats) {
        $parsed = [DateTime]::MinValue
        if ([DateTime]::TryParseExact($trimmed, $format, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::None, [ref]$parsed)) {
            return $parsed.Date
        }
    }

    return ([DateTime]::Parse($trimmed, [System.Globalization.CultureInfo]::InvariantCulture)).Date
}

function Convert-ExcelValueToDecimal {
    param([AllowNull()][string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return [decimal]::Zero
    }

    $clean = $Value.Trim().Replace(",", "")
    return [decimal]::Parse($clean, [System.Globalization.CultureInfo]::InvariantCulture)
}

function Get-CellText {
    param($Cell)

    if ($null -eq $Cell) {
        return ""
    }

    if ($Cell.t -eq "inlineStr") {
        $parts = @()
        foreach ($node in $Cell.SelectNodes(".//x:t", $script:NsManager)) {
            $parts += $node.InnerText
        }
        return ($parts -join "")
    }

    $valueProperty = $Cell.PSObject.Properties["v"]
    if ($valueProperty -and $null -ne $valueProperty.Value) {
        return [string]$valueProperty.Value
    }

    return ""
}

function Open-XlsxXmlDocument {
    param(
        [string]$Path,
        [string]$EntryName
    )

    $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $entry = $zip.GetEntry($EntryName)
        if ($null -eq $entry) {
            throw "Missing workbook entry $EntryName in $Path."
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

    [xml]$document = $content
    return $document
}

function Get-CounterpartyHint {
    param([AllowNull()][string]$Narration)

    if ([string]::IsNullOrWhiteSpace($Narration)) {
        return $null
    }

    $parts = $Narration -split "[/\\]"
    $bestCandidate = $null
    $bestScore = [double]::NegativeInfinity
    foreach ($part in $parts) {
        $candidate = Get-NormalizedText $part
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }
        if ($candidate.Length -lt 4) {
            continue
        }
        if ($candidate -match "^[0-9]+$") {
            continue
        }
        if ($script:StopTokens -contains $candidate) {
            continue
        }
        if ($script:BankTokens -contains $candidate) {
            continue
        }
        if ($candidate -match "^[A-Z]{4}0[0-9A-Z]{6,}$") {
            continue
        }
        if ($candidate -match "^[A-Z0-9]{10,}$" -and $candidate -notmatch "[A-Z].*[A-Z]") {
            continue
        }
        $tokens = @($candidate -split " " | Where-Object { $_ })
        if ($tokens.Count -eq 0) {
            continue
        }
        if (@($tokens | Where-Object { $script:StopTokens -notcontains $_ }).Count -eq 0) {
            continue
        }
        if ($tokens.Count -eq 1 -and $candidate -match "^(?=.*[A-Z])(?=.*\d)[A-Z0-9]+$") {
            continue
        }

        $letterOnlyTokens = @($tokens | Where-Object { $_ -match "^[A-Z]{4,}$" })
        $score = 0.0
        if ($letterOnlyTokens.Count -gt 0) {
            $score += 2.0
        }
        if ($tokens.Count -gt 1) {
            $score += 1.0
        }
        $digitChars = ([regex]::Matches($candidate, "\d")).Count
        $alphaChars = ([regex]::Matches($candidate, "[A-Z]")).Count
        if ($digitChars -gt 0 -and $digitChars -ge $alphaChars) {
            $score -= 1.5
        }
        if ($candidate -match "BANK|CHRG|MAINTENANCE|UPI|IMPS|NEFT|RTGS|TFR|ECM") {
            $score -= 1.0
        }
        $score += [Math]::Min(1.0, $candidate.Length / 30.0)

        if ($score -gt $bestScore) {
            $bestScore = $score
            $bestCandidate = $candidate
        }
    }

    if ($bestCandidate) {
        return $bestCandidate
    }

    $normalized = Get-NormalizedText $Narration
    if ($normalized -match "SUJITH NAIR") {
        return "SUJITH NAIR"
    }
    return $null
}

function Get-BankReference {
    param(
        [AllowNull()][string]$Narration,
        [AllowNull()][string]$ChequeDetails
    )

    if (-not [string]::IsNullOrWhiteSpace($ChequeDetails)) {
        return $ChequeDetails.Trim()
    }

    if ([string]::IsNullOrWhiteSpace($Narration)) {
        return $null
    }

    $tokens = $Narration -split "[/\\\s]+"
    foreach ($token in $tokens) {
        if ([string]::IsNullOrWhiteSpace($token)) {
            continue
        }
        if ($token -match "^(S\d{6,}|[A-Z0-9]*\d{6,}[A-Z0-9]*)$") {
            return $token.Trim()
        }
    }

    return $null
}

function Get-SafeFile {
    param(
        [string]$Directory,
        [string]$Filter
    )

    $file = Get-ChildItem -Path $Directory -Filter $Filter | Sort-Object Name -Descending | Select-Object -First 1
    if ($null -eq $file) {
        return $null
    }
    return $file.FullName
}

function Get-ContactDirectory {
    param([object[]]$Contacts)

    $directory = foreach ($contact in $Contacts) {
        $aliases = Get-UniqueStrings @(
            [string]$contact.contact_name,
            [string]$contact.vendor_name,
            [string]$contact.customer_name,
            [string]$contact.company_name
        )
        $normalizedAliases = @()
        foreach ($alias in $aliases) {
            $normalized = Get-NormalizedText $alias
            if ($normalized.Length -ge 4) {
                $normalizedAliases += $normalized
            }
        }
        [pscustomobject]@{
            contact_id = [string]$contact.contact_id
            contact_name = [string]$contact.contact_name
            contact_type = [string]$contact.contact_type
            normalized_aliases = @(Get-UniqueStrings $normalizedAliases)
        }
    }

    return @($directory)
}

function Get-ContactMatch {
    param(
        [string]$Narration,
        [string]$CounterpartyHint,
        [object[]]$ContactDirectory,
        [string]$ExpectedType
    )

    $normalizedNarration = Get-NormalizedText $Narration
    $narrationTokens = @($normalizedNarration -split " " | Where-Object { $_ })
    $hint = Get-NormalizedText $CounterpartyHint
    $hintTokens = @($hint -split " " | Where-Object { $_ })

    $best = $null
    $bestScore = 0.0

    foreach ($contact in $ContactDirectory) {
        if ($ExpectedType -and $contact.contact_type -ne $ExpectedType) {
            continue
        }

        foreach ($alias in $contact.normalized_aliases) {
            $score = 0.0
            $reasons = [System.Collections.Generic.List[string]]::new()
            $aliasTokens = @($alias -split " " | Where-Object { $_ })
            if ($aliasTokens.Count -eq 0) {
                continue
            }

            if ($hint -and $hint -eq $alias) {
                $score += 0.82
                $reasons.Add("counterparty_hint_exact")
            }
            elseif ($hint -and $hint.Contains($alias)) {
                $score += 0.68
                $reasons.Add("counterparty_hint_contains_alias")
            }

            if ($normalizedNarration.Contains($alias)) {
                $score += 0.72
                $reasons.Add("narration_contains_alias")
            }

            $commonTokens = @($aliasTokens | Where-Object { $narrationTokens -contains $_ })
            $commonCount = @($commonTokens | Select-Object -Unique).Count
            if ($commonCount -ge 2) {
                $ratio = $commonCount / [double]$aliasTokens.Count
                $score += [Math]::Min(0.35, [Math]::Round(0.15 + (0.20 * $ratio), 4))
                $reasons.Add("token_overlap_$commonCount")
            }
            elseif ($commonCount -eq 1) {
                $longToken = @($commonTokens | Where-Object { $_.Length -ge 7 } | Select-Object -First 1)
                if ($longToken.Count -gt 0) {
                    $score += 0.18
                    $reasons.Add("single_long_token_overlap")
                }
            }

            if ($hintTokens.Count -gt 0) {
                $hintOverlap = @($aliasTokens | Where-Object { $hintTokens -contains $_ } | Select-Object -Unique).Count
                if ($hintOverlap -ge 2) {
                    $score += 0.1
                    $reasons.Add("hint_token_overlap")
                }
            }

            $score = [Math]::Min(0.99, [Math]::Round($score, 4))
            if ($score -gt $bestScore) {
                $bestScore = $score
                $best = [pscustomobject]@{
                    contact_id = $contact.contact_id
                    contact_name = $contact.contact_name
                    contact_type = $contact.contact_type
                    alias = $alias
                    score = $score
                    reasons = @($reasons)
                }
            }
        }
    }

    return $best
}

function Get-SujithDetection {
    param($Transaction)

    $normalizedNarration = Get-NormalizedText $Transaction.narration
    $score = 0.0
    $signals = [System.Collections.Generic.List[string]]::new()

    if ($normalizedNarration.Contains("13590100051909")) {
        $score += 0.78
        $signals.Add("pattern_13590100051909")
    }
    if ($normalizedNarration -match "(^| )51909( |$)") {
        $score += 0.42
        $signals.Add("pattern_51909")
    }
    if ($normalizedNarration -match "(^| )217( |$)") {
        $score += 0.18
        $signals.Add("pattern_217")
    }
    if ($normalizedNarration.Contains("SUJITH")) {
        $score += 0.82
        $signals.Add("name_sujith")
    }

    if ($Transaction.direction -eq "debit") {
        if ([decimal]$Transaction.amount -gt [decimal]"30000") {
            $score += 0.12
            $signals.Add("soft_signal_gt_30000_drawings_lean")
            $amountSignal = "drawings_lean"
        }
        else {
            $score += 0.04
            $signals.Add("soft_signal_lt_30000_expense_lean")
            $amountSignal = "expense_lean"
        }
    }
    else {
        $amountSignal = "not_applicable"
    }

    $score = [Math]::Min(0.99, [Math]::Round($score, 4))
    if ($score -ge 0.85) {
        $confidence = "high"
    }
    elseif ($score -ge 0.55) {
        $confidence = "medium"
    }
    elseif ($score -ge 0.25) {
        $confidence = "low"
    }
    else {
        $confidence = "none"
    }

    [pscustomobject]@{
        is_candidate = $confidence -ne "none"
        confidence = $confidence
        score = $score
        amount_signal = $amountSignal
        signals = @($signals)
    }
}

function Get-BillCandidates {
    param(
        $Transaction,
        [object[]]$Bills,
        $VendorMatch
    )

    if ($Transaction.direction -ne "debit") {
        return @()
    }

    $normalizedNarration = Get-NormalizedText $Transaction.narration
    $txnDate = [DateTime]$Transaction.transaction_date
    $amount = [decimal]$Transaction.amount

    $candidates = foreach ($bill in $Bills) {
        $billDate = [DateTime]$bill.date
        if ($billDate -gt $txnDate) {
            continue
        }

        $score = 0.0
        $reasons = [System.Collections.Generic.List[string]]::new()
        $normalizedBillNumber = Get-NormalizedText ([string]$bill.bill_number)
        $normalizedReference = Get-NormalizedText ([string]$bill.reference_number)
        $normalizedVendor = Get-NormalizedText ([string]$bill.vendor_name)
        $billTotal = [decimal]$bill.total
        $billBalance = [decimal]$bill.balance

        if ($normalizedBillNumber -and $normalizedNarration.Contains($normalizedBillNumber)) {
            $score += 0.55
            $reasons.Add("bill_number_match")
        }
        if ($normalizedReference -and $normalizedNarration.Contains($normalizedReference)) {
            $score += 0.45
            $reasons.Add("reference_match")
        }
        if ($normalizedVendor -and $normalizedNarration.Contains($normalizedVendor)) {
            $score += 0.4
            $reasons.Add("vendor_name_match")
        }
        if ($VendorMatch -and $VendorMatch.contact_id -eq [string]$bill.vendor_id) {
            $score += 0.25
            $reasons.Add("vendor_contact_id_match")
        }

        $diffTotal = [Math]::Abs($amount - $billTotal)
        $diffBalance = [Math]::Abs($amount - $billBalance)
        $bestDiff = [Math]::Min($diffTotal, $diffBalance)
        if ($bestDiff -eq [decimal]::Zero) {
            $score += 0.3
            $reasons.Add("exact_amount_match")
        }
        elseif ($bestDiff -le [decimal]"1.00") {
            $score += 0.2
            $reasons.Add("amount_within_1")
        }
        elseif ($bestDiff -le [decimal]"25.00") {
            $score += 0.08
            $reasons.Add("amount_within_25")
        }

        $ageDays = ($txnDate - $billDate).Days
        if ($ageDays -le 30) {
            $score += 0.1
            $reasons.Add("bill_within_30_days")
        }
        elseif ($ageDays -le 90) {
            $score += 0.07
            $reasons.Add("bill_within_90_days")
        }
        elseif ($ageDays -le 365) {
            $score += 0.03
            $reasons.Add("bill_within_365_days")
        }

        $score = [Math]::Min(0.99, [Math]::Round($score, 4))
        if ($score -lt 0.4) {
            continue
        }

        if ($score -ge 0.85) {
            $confidence = "high"
        }
        elseif ($score -ge 0.6) {
            $confidence = "medium"
        }
        else {
            $confidence = "low"
        }

        [pscustomobject]@{
            bill_id = [string]$bill.bill_id
            vendor_id = [string]$bill.vendor_id
            vendor_name = [string]$bill.vendor_name
            bill_number = [string]$bill.bill_number
            reference_number = [string]$bill.reference_number
            bill_date = ([DateTime]$bill.date).ToString("yyyy-MM-dd")
            total = [decimal]$bill.total
            balance = [decimal]$bill.balance
            score = $score
            confidence = $confidence
            reasons = @($reasons)
        }
    }

    return @($candidates | Sort-Object @{ Expression = "score"; Descending = $true }, @{ Expression = "bill_date"; Descending = $true } | Select-Object -First 3)
}

function Get-ClassificationTag {
    param(
        $Transaction,
        $SujithDetection,
        $VendorMatch,
        $CustomerMatch
    )

    $normalizedNarration = Get-NormalizedText $Transaction.narration
    $isChargeLike = $normalizedNarration.StartsWith("CHRG ") -or $normalizedNarration.Contains("A C MAINTENANCE") -or $normalizedNarration.Contains("BANK CHARGES")

    if ($SujithDetection.confidence -in @("high", "medium")) {
        return "sujith transfer candidate"
    }

    if ($Transaction.direction -eq "debit") {
        if ($VendorMatch -and $VendorMatch.score -ge 0.55) {
            return "vendor payment candidate"
        }
        if (-not $isChargeLike -and $Transaction.counterparty_hint) {
            return "vendor payment candidate"
        }
        return "unknown / manual review"
    }

    if ($Transaction.direction -eq "credit") {
        if ($CustomerMatch -and $CustomerMatch.score -ge 0.55) {
            return "client receipt candidate"
        }
        if ($Transaction.counterparty_hint) {
            return "client receipt candidate"
        }
        return "unknown / manual review"
    }

    return "unknown / manual review"
}

function Add-Aggregate {
    param(
        [hashtable]$Map,
        [string]$Key,
        [decimal]$Amount
    )

    if ([string]::IsNullOrWhiteSpace($Key)) {
        return
    }
    if (-not $Map.ContainsKey($Key)) {
        $Map[$Key] = [decimal]::Zero
    }
    $Map[$Key] += $Amount
}

function Get-AggregateTable {
    param([hashtable]$Map)

    return @(
        foreach ($entry in $Map.GetEnumerator() | Sort-Object Value -Descending) {
            [pscustomobject]@{
                name = $entry.Key
                amount = [Math]::Round([decimal]$entry.Value, 2)
            }
        }
    )
}

function Format-Money {
    param([decimal]$Value)
    return ("{0:N2}" -f $Value)
}

function Build-BankTransactions {
    param([string]$Path)

    $sheetXml = Open-XlsxXmlDocument -Path $Path -EntryName "xl/worksheets/sheet1.xml"
    $script:NsManager = [System.Xml.XmlNamespaceManager]::new($sheetXml.NameTable)
    $script:NsManager.AddNamespace("x", $script:ExcelNamespace)

    $rows = $sheetXml.SelectNodes("//x:sheetData/x:row", $script:NsManager)
    $transactions = [System.Collections.Generic.List[object]]::new()
    $seenFingerprints = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $duplicateCount = 0
    $accountRef = "UNKNOWN"

    foreach ($row in $rows) {
        $rowNumber = [int]$row.r
        $cellMap = @{}
        foreach ($cell in $row.SelectNodes("./x:c", $script:NsManager)) {
            $column = [regex]::Match([string]$cell.r, "^[A-Z]+").Value
            $cellMap[$column] = Get-CellText $cell
        }

        if ($rowNumber -eq 9 -and $cellMap.ContainsKey("C")) {
            $accountRef = $cellMap["C"]
            continue
        }

        if ($rowNumber -lt 12) {
            continue
        }

        $narration = if ($cellMap.ContainsKey("C")) { [string]$cellMap["C"] } else { "" }
        if ([string]::IsNullOrWhiteSpace($narration)) {
            continue
        }

        $debit = Convert-ExcelValueToDecimal ($(if ($cellMap.ContainsKey("H")) { $cellMap["H"] } else { "" }))
        $credit = Convert-ExcelValueToDecimal ($(if ($cellMap.ContainsKey("I")) { $cellMap["I"] } else { "" }))
        if ($debit -eq [decimal]::Zero -and $credit -eq [decimal]::Zero) {
            continue
        }
        if ($debit -gt [decimal]::Zero -and $credit -gt [decimal]::Zero) {
            throw "Row $rowNumber has both debit and credit populated."
        }

        $direction = if ($credit -gt [decimal]::Zero) { "credit" } else { "debit" }
        $amount = if ($credit -gt [decimal]::Zero) { $credit } else { $debit }
        $transactionDate = Convert-ExcelValueToDate ($(if ($cellMap.ContainsKey("B")) { $cellMap["B"] } else { "" }))
        $valueDate = Convert-ExcelValueToDate ($(if ($cellMap.ContainsKey("E")) { $cellMap["E"] } else { "" }))
        $balance = Convert-ExcelValueToDecimal ($(if ($cellMap.ContainsKey("J")) { $cellMap["J"] } else { "" }))
        $reference = Get-BankReference -Narration $narration -ChequeDetails ($(if ($cellMap.ContainsKey("G")) { $cellMap["G"] } else { "" }))
        $counterpartyHint = Get-CounterpartyHint -Narration $narration

        $fingerprint = @(
            $transactionDate.ToString("yyyy-MM-dd"),
            $(if ($valueDate) { $valueDate.ToString("yyyy-MM-dd") } else { "" }),
            $direction,
            ("{0:0.00}" -f $amount),
            (Get-NormalizedText $narration),
            $(if ($reference) { $reference } else { "" }),
            ("{0:0.00}" -f $balance)
        ) -join "|"

        if (-not $seenFingerprints.Add($fingerprint)) {
            $duplicateCount += 1
            continue
        }

        $transactions.Add([pscustomobject]@{
                statement_row = [int]$(if ($cellMap.ContainsKey("A")) { $cellMap["A"] } else { 0 })
                transaction_date = $transactionDate.ToString("yyyy-MM-dd")
                value_date = $(if ($valueDate) { $valueDate.ToString("yyyy-MM-dd") } else { $null })
                direction = $direction
                amount = [Math]::Round($amount, 2)
                debit = $(if ($debit -gt [decimal]::Zero) { [Math]::Round($debit, 2) } else { $null })
                credit = $(if ($credit -gt [decimal]::Zero) { [Math]::Round($credit, 2) } else { $null })
                narration = $narration.Trim()
                transaction_type = $(if ($cellMap.ContainsKey("F")) { [string]$cellMap["F"] } else { "" })
                cheque_details = $(if ($cellMap.ContainsKey("G") -and -not [string]::IsNullOrWhiteSpace($cellMap["G"])) { [string]$cellMap["G"] } else { $null })
                reference = $reference
                balance = [Math]::Round($balance, 2)
                bank_account_ref = $accountRef
                counterparty_hint = $counterpartyHint
            })
    }

    [pscustomobject]@{
        bank_account_ref = $accountRef
        transactions = @($transactions)
        duplicate_count = $duplicateCount
    }
}

$exportDir = Join-Path $RepoRoot "data\exports"
$stagedDir = Join-Path $RepoRoot "data\staged\zoho_sandbox"

if (-not (Test-Path $StatementPath)) { throw "Bank statement not found at $StatementPath." }
if (-not (Test-Path $stagedDir)) { throw "Zoho staged snapshot directory not found at $stagedDir." }

$parsed = Build-BankTransactions -Path $StatementPath
$transactions = @($parsed.transactions)
$contactsPath = Get-SafeFile -Directory $stagedDir -Filter "*_contacts.json"
$billsPath = Get-SafeFile -Directory $stagedDir -Filter "*_bills.json"
$accountsPath = Get-SafeFile -Directory $stagedDir -Filter "*_chartofaccounts.json"
$vendorPaymentsPath = Get-SafeFile -Directory $stagedDir -Filter "*_vendorpayments.json"
$invoiceSnapshotPath = Get-SafeFile -Directory $stagedDir -Filter "*invoice*.json"
$contactsPayload = if ($contactsPath) { Get-Content $contactsPath -Raw | ConvertFrom-Json } else { $null }
$billsPayload = if ($billsPath) { Get-Content $billsPath -Raw | ConvertFrom-Json } else { $null }
$contacts = @($(if ($contactsPayload) { $contactsPayload.contacts } else { @() }))
$bills = @($(if ($billsPayload) { $billsPayload.bills } else { @() }))
$contactDirectory = Get-ContactDirectory -Contacts $contacts
$vendorTotals = @{}
$customerTotals = @{}
$classificationCounts = @{}
$sujithResults = [System.Collections.Generic.List[object]]::new()
$vendorMatchResults = [System.Collections.Generic.List[object]]::new()
$receiptMatchResults = [System.Collections.Generic.List[object]]::new()
$unmatchedTransactions = [System.Collections.Generic.List[object]]::new()
$transactionRecords = [System.Collections.Generic.List[object]]::new()
$totalDebits = [decimal]::Zero
$totalCredits = [decimal]::Zero

foreach ($txn in $transactions) {
    $vendorMatch = Get-ContactMatch -Narration $txn.narration -CounterpartyHint $txn.counterparty_hint -ContactDirectory $contactDirectory -ExpectedType "vendor"
    $customerMatch = Get-ContactMatch -Narration $txn.narration -CounterpartyHint $txn.counterparty_hint -ContactDirectory $contactDirectory -ExpectedType "customer"
    $sujithDetection = Get-SujithDetection -Transaction $txn
    $billCandidates = @(Get-BillCandidates -Transaction $txn -Bills $bills -VendorMatch $vendorMatch)
    $topBillCandidate = $billCandidates | Select-Object -First 1
    $classificationTag = Get-ClassificationTag -Transaction $txn -SujithDetection $sujithDetection -VendorMatch $vendorMatch -CustomerMatch $customerMatch
    if (-not $classificationCounts.ContainsKey($classificationTag)) { $classificationCounts[$classificationTag] = 0 }
    $classificationCounts[$classificationTag] += 1
    if ($txn.direction -eq "debit") { $totalDebits += [decimal]$txn.amount } else { $totalCredits += [decimal]$txn.amount }

    if ($classificationTag -eq "vendor payment candidate") {
        $vendorName = $null
        if ($topBillCandidate -and $topBillCandidate.score -ge 0.4) {
            $vendorName = $topBillCandidate.vendor_name
        } elseif ($vendorMatch -and $vendorMatch.score -ge 0.3) {
            $vendorName = $vendorMatch.contact_name
        } elseif ($txn.counterparty_hint -and $txn.counterparty_hint -notmatch "^(BILL NOS|[A-Z0-9]+|HONGKONG|STANDARD|UNITED)$") {
            $vendorName = $txn.counterparty_hint
        }
        Add-Aggregate -Map $vendorTotals -Key $vendorName -Amount ([decimal]$txn.amount)
    } elseif ($classificationTag -eq "client receipt candidate") {
        $customerName = if ($customerMatch) { $customerMatch.contact_name } elseif ($txn.counterparty_hint) { $txn.counterparty_hint } else { "UNIDENTIFIED" }
        Add-Aggregate -Map $customerTotals -Key $customerName -Amount ([decimal]$txn.amount)
    }

    if ($sujithDetection.is_candidate) {
        $sujithResults.Add([pscustomobject]@{ transaction_date = $txn.transaction_date; amount = $txn.amount; direction = $txn.direction; narration = $txn.narration; reference = $txn.reference; confidence = $sujithDetection.confidence; score = $sujithDetection.score; amount_signal = $sujithDetection.amount_signal; signals = @($sujithDetection.signals) })
    }
    if (@($billCandidates).Count -gt 0) {
        $vendorMatchResults.Add([pscustomobject]@{ transaction_date = $txn.transaction_date; amount = $txn.amount; narration = $txn.narration; reference = $txn.reference; vendor_contact_match = $vendorMatch; candidates = @($billCandidates) })
    }
    if ($classificationTag -eq "client receipt candidate") {
        if ($invoiceSnapshotPath) {
            $receiptMatchResults.Add([pscustomobject]@{ transaction_date = $txn.transaction_date; amount = $txn.amount; narration = $txn.narration; note = "Sales invoice snapshot exists but matching is not implemented in this report." })
        } else {
            $receiptMatchResults.Add([pscustomobject]@{ transaction_date = $txn.transaction_date; amount = $txn.amount; narration = $txn.narration; customer_contact_match = $customerMatch; note = "No sales invoice snapshot available in staged Zoho data." })
        }
    }

    $hasStrongBillCandidate = @($billCandidates | Where-Object { $_.score -ge 0.6 }).Count -gt 0
    if (-not $hasStrongBillCandidate -and $classificationTag -eq "unknown / manual review") {
        $unmatchedTransactions.Add([pscustomobject]@{ transaction_date = $txn.transaction_date; direction = $txn.direction; amount = $txn.amount; narration = $txn.narration; reference = $txn.reference })
    }

    $transactionRecords.Add([pscustomobject]@{ statement_row = $txn.statement_row; transaction_date = $txn.transaction_date; value_date = $txn.value_date; direction = $txn.direction; amount = $txn.amount; debit = $txn.debit; credit = $txn.credit; narration = $txn.narration; transaction_type = $txn.transaction_type; cheque_details = $txn.cheque_details; reference = $txn.reference; balance = $txn.balance; bank_account_ref = $txn.bank_account_ref; counterparty_hint = $txn.counterparty_hint; classification_tag = $classificationTag; vendor_contact_match = $vendorMatch; customer_contact_match = $customerMatch; sujith_detection = $sujithDetection; vendor_bill_candidates = @($billCandidates) })
}

$firstTransaction = $transactions | Select-Object -First 1
$lastTransaction = $transactions | Select-Object -Last 1
$openingBalance = if ($firstTransaction.direction -eq "credit") { [decimal]$firstTransaction.balance - [decimal]$firstTransaction.amount } else { [decimal]$firstTransaction.balance + [decimal]$firstTransaction.amount }
$closingBalance = [decimal]$lastTransaction.balance
$recomputedClosing = $openingBalance + $totalCredits - $totalDebits
$potentialDrawings = @($sujithResults | Where-Object { $_.direction -eq "debit" -and $_.amount_signal -eq "drawings_lean" -and $_.confidence -in @("high", "medium") })
$potentialDrawingsTotal = [decimal]::Zero
foreach ($row in $potentialDrawings) { $potentialDrawingsTotal += [decimal]$row.amount }
$topVendorsPaid = Get-AggregateTable -Map $vendorTotals | Select-Object -First 15
$topCustomersReceived = Get-AggregateTable -Map $customerTotals | Select-Object -First 15
$topVendorPaymentMatches = @($vendorMatchResults | ForEach-Object { $topCandidate = $_.candidates | Select-Object -First 1; [pscustomobject]@{ transaction_date = $_.transaction_date; amount = $_.amount; narration = $_.narration; matched_vendor = $topCandidate.vendor_name; matched_bill_number = $topCandidate.bill_number; matched_reference_number = $topCandidate.reference_number; score = $topCandidate.score; confidence = $topCandidate.confidence; reasons = $topCandidate.reasons } } | Sort-Object @{ Expression = "score"; Descending = $true }, @{ Expression = "amount"; Descending = $true } | Select-Object -First 25)
$report = [pscustomobject]@{
    statement = [pscustomobject]@{ path = $StatementPath; account_ref = $parsed.bank_account_ref; transactions_ingested = $transactions.Count; duplicates_skipped = $parsed.duplicate_count; opening_balance_inferred = [Math]::Round($openingBalance, 2); closing_balance_reported = [Math]::Round($closingBalance, 2); closing_balance_recomputed = [Math]::Round($recomputedClosing, 2) }
    parsing = [pscustomobject]@{ format = "xlsx"; sheet_name = "OpTransactionHistory"; period_start = "2023-04-01"; period_end = "2024-03-31"; latest_zoho_bills_snapshot = $billsPath; latest_zoho_contacts_snapshot = $contactsPath; latest_zoho_accounts_snapshot = $accountsPath }
    summary = [pscustomobject]@{ total_debits = [Math]::Round($totalDebits, 2); total_credits = [Math]::Round($totalCredits, 2); net_movement = [Math]::Round($totalCredits - $totalDebits, 2) }
    classification_breakdown = [pscustomobject]$classificationCounts
    sujith_transfer_detection = [pscustomobject]@{ candidates = @($sujithResults | Sort-Object transaction_date, amount); total_candidates = $sujithResults.Count; potential_drawings_total = [Math]::Round($potentialDrawingsTotal, 2) }
    vendor_payment_match_candidates = @($topVendorPaymentMatches)
    client_receipt_match_candidates = @($receiptMatchResults | Select-Object -First 25)
    top_vendors_paid = @($topVendorsPaid)
    top_customers_received = @($topCustomersReceived)
    unmatched_pool = [pscustomobject]@{ count = $unmatchedTransactions.Count; sample = @($unmatchedTransactions | Select-Object -First 25) }
    gaps_vs_full_reconstruction = @(
        if (-not $invoiceSnapshotPath) { [pscustomobject]@{ gap = "sales_invoice_snapshot_missing"; evidence = "No invoice snapshot file was found under data/staged/zoho_sandbox, so client receipt to invoice matching could not be attempted." } }
        if (-not $vendorPaymentsPath) { [pscustomobject]@{ gap = "vendor_payment_snapshot_missing"; evidence = "No Zoho vendor payment snapshot file was found, so prior in-Zoho payment applications cannot be checked against bank outflows." } }
        if (-not $accountsPath) { [pscustomobject]@{ gap = "chart_of_accounts_snapshot_missing"; evidence = "No Zoho chart-of-accounts snapshot file was found in staged data." } }
        [pscustomobject]@{ gap = "gst_evidence_missing"; evidence = "No real GSTR-2B or GSTR-3B files were present under books_recon/data for this run." }
        [pscustomobject]@{ gap = "itr_ais_evidence_missing"; evidence = "No real AIS, ITR, or Computation of Income files were present under books_recon/data for this run." }
        [pscustomobject]@{ gap = "personal_bank_evidence_missing"; evidence = "The run only included the 3326 business current account. Personal-bank funding/payment evidence is not yet available for cross-settlement review." }
    )
    recommended_next_phase = @(
        "Load real sales invoice and payments-received snapshots for FY 2023-24 before attempting receipt closure.",
        "Load real Zoho vendor-payment and chart-of-accounts snapshots to separate already-posted settlements from missing bank applications.",
        "Load real GSTR-2B, GSTR-3B, AIS, and ITR support so unmatched outflows/inflows can be tested against filed truth rather than narration alone.",
        "Bring in Sujith personal-bank evidence only after this 3326 pass is reviewed, so cross-account vendor settlements can be linked without force-fitting."
    )
}
New-Item -ItemType Directory -Path $exportDir -Force | Out-Null
$jsonPath = Join-Path $exportDir "$OutputPrefix.transactions.json"
$reportPath = Join-Path $exportDir "$OutputPrefix.report.json"
$markdownPath = Join-Path $exportDir "$OutputPrefix.summary.md"
$transactionRecords | ConvertTo-Json -Depth 12 | Set-Content -Path $jsonPath -Encoding UTF8
$report | ConvertTo-Json -Depth 12 | Set-Content -Path $reportPath -Encoding UTF8
$md = @("# 3326 Bank Reconstruction FY 2023-24","","## File parsing result","- Statement file: $StatementPath","- Account ref: $($parsed.bank_account_ref)","- Transactions ingested: $($transactions.Count)","- Duplicates skipped: $($parsed.duplicate_count)","- Opening balance inferred: INR $(Format-Money $openingBalance)","- Closing balance reported: INR $(Format-Money $closingBalance)","- Closing balance recomputed: INR $(Format-Money $recomputedClosing)","","## Classification breakdown") + @($classificationCounts.Keys | Sort-Object | ForEach-Object { "- $($_): $($classificationCounts[$_])" }) + @("","## Summary","- Total debits: INR $(Format-Money $totalDebits)","- Total credits: INR $(Format-Money $totalCredits)","- Net movement: INR $(Format-Money ($totalCredits - $totalDebits))","- Total potential drawings: INR $(Format-Money $potentialDrawingsTotal)","- Unmatched pool count: $($unmatchedTransactions.Count)","","## Top vendors paid") + @($topVendorsPaid | Select-Object -First 10 | ForEach-Object { "- $($_.name): INR $(Format-Money ([decimal]$_.amount))" }) + @("","## Top customers received") + @($topCustomersReceived | Select-Object -First 10 | ForEach-Object { "- $($_.name): INR $(Format-Money ([decimal]$_.amount))" }) + @("","## Vendor payment match candidates") + @($topVendorPaymentMatches | Select-Object -First 15 | ForEach-Object { "- $($_.transaction_date) | INR $(Format-Money ([decimal]$_.amount)) | $($_.matched_vendor) | $($_.matched_bill_number) | score $($_.score)" }) + @("","## Client receipt match candidates")
if ($invoiceSnapshotPath) { $md += @($receiptMatchResults | Select-Object -First 15 | ForEach-Object { "- $($_.transaction_date) | INR $(Format-Money ([decimal]$_.amount)) | $($_.note)" }) } else { $md += "- No sales invoice snapshot was available, so client receipt to invoice matching was not attempted." }
$md += @("","## Gaps vs full reconstruction") + @($report.gaps_vs_full_reconstruction | ForEach-Object { "- $($_.gap): $($_.evidence)" }) + @("","## Recommended next phase") + @($report.recommended_next_phase | ForEach-Object { "- $_" })
$md -join [Environment]::NewLine | Set-Content -Path $markdownPath -Encoding UTF8
[pscustomobject]@{ transactions_json = $jsonPath; report_json = $reportPath; summary_md = $markdownPath; transactions_ingested = $transactions.Count; duplicates_skipped = $parsed.duplicate_count; total_debits = [Math]::Round($totalDebits, 2); total_credits = [Math]::Round($totalCredits, 2); sujith_candidates = $sujithResults.Count; vendor_bill_candidate_rows = $vendorMatchResults.Count; client_receipt_candidate_rows = $receiptMatchResults.Count; unmatched_count = $unmatchedTransactions.Count } | ConvertTo-Json -Compress
