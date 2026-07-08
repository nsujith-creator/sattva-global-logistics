[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$PayloadPath,

  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ApprovedUpdateAdvisoryUrl = "https://cakmipiqchlotuhahuds.supabase.co/functions/v1/update-advisory"
$StaticTradeAdvisoryUrl = "https://www.sattvaglobal.in/trade-advisory"
$LogDirectory = "C:\sattva\docs\advisories"
$RunnerName = "windows-deterministic-runner"

function Redact-LogText {
  param([AllowNull()][string]$Text)
  if ([string]::IsNullOrEmpty($Text)) { return $Text }

  $redacted = $Text
  $redacted = $redacted -replace 'https://api\.vercel\.com/v1/integrations/deploy/[^"\s\)]*', '[REDACTED_VERCEL_DEPLOY_HOOK_URL]'
  $redacted = $redacted -replace 'https://vercel\.com/api/hooks/[^"\s\)]*', '[REDACTED_VERCEL_DEPLOY_HOOK_URL]'
  $redacted = $redacted -replace '(?i)(ADVISORY_SECRET\s*[=:]\s*)[^"\s]+', '$1[REDACTED]'
  $redacted = $redacted -replace '(?i)(VERCEL_DEPLOY_HOOK_URL\s*[=:]\s*)[^"\s]+', '$1[REDACTED]'
  return $redacted
}

function Fail-Run {
  param([string]$Message)
  throw (Redact-LogText $Message)
}

function Assert-WindowsUserEnvironmentAvailable {
  $isWindowsRuntime = $false
  if (Get-Variable -Name IsWindows -Scope Global -ErrorAction SilentlyContinue) {
    $isWindowsRuntime = [bool]$IsWindows
  } else {
    $isWindowsRuntime = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT
  }

  if (-not $isWindowsRuntime) {
    Fail-Run "This runner is Windows-only and must be executed on Windows PowerShell/PowerShell."
  }

  try {
    [void][Environment]::GetEnvironmentVariable("PATH", "User")
  } catch {
    Fail-Run "PowerShell could not read Windows User-scope environment variables: $(Redact-LogText $_.Exception.Message)"
  }
}

function Get-UserSecretPresence {
  param([string]$Name)
  $value = [Environment]::GetEnvironmentVariable($Name, "User")
  return @{
    Name = $Name
    Value = $value
    Presence = $(if ([string]::IsNullOrWhiteSpace($value)) { "MISSING" } else { "SET" })
  }
}

function Read-AdvisoryPayload {
  param([string]$Path)

  $resolved = Resolve-Path -LiteralPath $Path -ErrorAction Stop
  try {
    $raw = Get-Content -LiteralPath $resolved.Path -Raw -Encoding UTF8
    $payload = $raw | ConvertFrom-Json
  } catch {
    Fail-Run "Payload JSON could not be read or parsed: $(Redact-LogText $_.Exception.Message)"
  }

  return @{
    Path = $resolved.Path
    Payload = $payload
  }
}

function Test-StringField {
  param(
    [object]$Payload,
    [string]$Name,
    [bool]$Required = $true
  )

  if (-not ($Payload.PSObject.Properties.Name -contains $Name)) {
    if ($Required) { return "$Name is required." }
    return $null
  }
  $value = $Payload.$Name
  if ($Required -and [string]::IsNullOrWhiteSpace([string]$value)) {
    return "$Name must be a non-empty string."
  }
  return $null
}

function Test-StringArrayField {
  param(
    [object]$Payload,
    [string]$Name,
    [bool]$Required = $true
  )

  if (-not ($Payload.PSObject.Properties.Name -contains $Name)) {
    if ($Required) { return "$Name is required." }
    return $null
  }
  if ($null -eq $Payload.$Name -or $Payload.$Name -isnot [array]) {
    return "$Name must be an array of strings."
  }
  foreach ($item in $Payload.$Name) {
    if ([string]::IsNullOrWhiteSpace([string]$item)) {
      return "$Name must contain only non-empty strings."
    }
  }
  return $null
}

function Test-ObjectArrayField {
  param(
    [object]$Payload,
    [string]$Name,
    [string[]]$RequiredProperties
  )

  if (-not ($Payload.PSObject.Properties.Name -contains $Name)) {
    return "$Name is required."
  }
  if ($null -eq $Payload.$Name -or $Payload.$Name -isnot [array]) {
    return "$Name must be an array."
  }
  foreach ($item in $Payload.$Name) {
    foreach ($property in $RequiredProperties) {
      if (-not ($item.PSObject.Properties.Name -contains $property) -or [string]::IsNullOrWhiteSpace([string]$item.$property)) {
        return "$Name item is missing non-empty property '$property'."
      }
    }
  }
  return $null
}

function Test-AdvisoryPayload {
  param([object]$Payload)

  $errors = New-Object System.Collections.Generic.List[string]

  foreach ($field in @("date_display", "updated_at_display", "situation", "india_impact", "updated_by")) {
    $error = Test-StringField -Payload $Payload -Name $field
    if ($error) { $errors.Add($error) }
  }

  if (($Payload.PSObject.Properties.Name -contains "situation") -and ([string]$Payload.situation).Length -lt 50) {
    $errors.Add("situation must be at least 50 characters to satisfy the Edge Function validation gate.")
  }

  $carrierError = Test-ObjectArrayField -Payload $Payload -Name "carrier_notes" -RequiredProperties @("carrier", "status", "note")
  if ($carrierError) { $errors.Add($carrierError) }

  $surchargeError = Test-ObjectArrayField -Payload $Payload -Name "surcharges" -RequiredProperties @("carrier", "date", "name", "amount", "currency", "trade")
  if ($surchargeError) { $errors.Add($surchargeError) }

  foreach ($field in @("source_tags", "verification_markers")) {
    $error = Test-StringArrayField -Payload $Payload -Name $field
    if ($error) { $errors.Add($error) }
  }

  $staleError = Test-StringArrayField -Payload $Payload -Name "stale_markers" -Required $false
  if ($staleError) { $errors.Add($staleError) }

  if (($Payload.PSObject.Properties.Name -contains "updated_by") -and [string]$Payload.updated_by -ne $RunnerName) {
    $errors.Add("updated_by must be '$RunnerName'.")
  }

  if ($errors.Count -gt 0) {
    Fail-Run ("Payload validation failed: " + ($errors -join " "))
  }
}

function New-PublishBody {
  param([object]$Payload)

  $body = [ordered]@{
    situation = [string]$Payload.situation
    carrier_notes = $Payload.carrier_notes
    surcharges = $Payload.surcharges
    india_impact = [string]$Payload.india_impact
    source_tags = $Payload.source_tags
    updated_by = [string]$Payload.updated_by
  }

  if ($Payload.PSObject.Properties.Name -contains "force") {
    $body.force = [bool]$Payload.force
  }

  return $body
}

function Invoke-UpdateAdvisory {
  param(
    [object]$PublishBody,
    [string]$AdvisorySecret
  )

  $json = $PublishBody | ConvertTo-Json -Depth 20
  try {
    $response = Invoke-WebRequest `
      -Uri $ApprovedUpdateAdvisoryUrl `
      -Method POST `
      -ContentType "application/json" `
      -Headers @{ "x-advisory-secret" = $AdvisorySecret } `
      -Body $json `
      -UseBasicParsing
  } catch {
    if ($_.Exception.Response) {
      $response = $_.Exception.Response
    } else {
      Fail-Run "update-advisory request failed: $(Redact-LogText $_.Exception.Message)"
    }
  }

  $ok = $false
  $content = ""
  if ($response -is [System.Net.HttpWebResponse]) {
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    $content = $reader.ReadToEnd()
    $statusCode = [int]$response.StatusCode
  } else {
    $content = [string]$response.Content
    $statusCode = [int]$response.StatusCode
  }

  try {
    $parsed = $content | ConvertFrom-Json
    $ok = ($parsed.ok -eq $true)
  } catch {
    $ok = $false
  }

  return @{
    StatusCode = $statusCode
    Ok = $ok
    Body = $content
  }
}

function Invoke-VercelDeployHook {
  param([string]$DeployHookUrl)

  try {
    $response = Invoke-WebRequest `
      -Uri $DeployHookUrl `
      -Method POST `
      -UseBasicParsing
  } catch {
    if ($_.Exception.Response) {
      $response = $_.Exception.Response
    } else {
      Fail-Run "Vercel deploy hook request failed: $(Redact-LogText $_.Exception.Message)"
    }
  }

  return @{
    StatusCode = [int]$response.StatusCode
  }
}

function Get-MarkerVariants {
  param([string]$Marker)

  if ([string]::IsNullOrWhiteSpace($Marker)) {
    return @($Marker)
  }

  $variants = New-Object System.Collections.Generic.List[string]
  $variants.Add($Marker)

  $dateMatch = [regex]::Match($Marker, '^(0?[1-9]|[12][0-9]|3[01])\s+([A-Za-z]+)\s+(\d{4})$')
  if ($dateMatch.Success) {
    $day = [int]$dateMatch.Groups[1].Value
    $month = $dateMatch.Groups[2].Value
    $year = $dateMatch.Groups[3].Value
    $variants.Add(("{0} {1} {2}" -f $day, $month, $year))
    $variants.Add(("{0:00} {1} {2}" -f $day, $month, $year))
  }

  return @($variants | Select-Object -Unique)
}

function Test-HtmlContainsMarker {
  param(
    [string]$Html,
    [string]$Marker
  )

  foreach ($variant in (Get-MarkerVariants -Marker $Marker)) {
    if ($Html.Contains($variant)) {
      return $true
    }
  }

  return $false
}

function Test-StaticHtml {
  param(
    [object]$Payload,
    [int]$MaxAttempts = 18,
    [int]$DelaySeconds = 20
  )

  $requiredMarkers = @($Payload.verification_markers)
  $staleMarkers = @()
  if ($Payload.PSObject.Properties.Name -contains "stale_markers" -and $null -ne $Payload.stale_markers) {
    $staleMarkers = @($Payload.stale_markers)
  }

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri $StaticTradeAdvisoryUrl -Method GET -UseBasicParsing -Headers @{ "Cache-Control" = "no-cache" }
      $html = [string]$response.Content
    } catch {
      if ($attempt -eq $MaxAttempts) {
        Fail-Run "Static HTML fetch failed: $(Redact-LogText $_.Exception.Message)"
      }
      Start-Sleep -Seconds $DelaySeconds
      continue
    }

    $ssrFound = $html.Contains('id="ssr-advisory"')
    $dateFound = Test-HtmlContainsMarker -Html $html -Marker ([string]$Payload.date_display)
    $foundMarkers = @($requiredMarkers | Where-Object { Test-HtmlContainsMarker -Html $html -Marker ([string]$_) })
    $missingMarkers = @($requiredMarkers | Where-Object { -not (Test-HtmlContainsMarker -Html $html -Marker ([string]$_)) })
    $presentStaleMarkers = @($staleMarkers | Where-Object { $html.Contains([string]$_) })

    $htmlRefreshed = $ssrFound -and $dateFound -and ($foundMarkers.Count -ge 1) -and ($presentStaleMarkers.Count -eq 0)
    if ($htmlRefreshed) {
      return @{
        Refreshed = $true
        SsrFound = $ssrFound
        DateFound = $dateFound
        FoundMarkers = $foundMarkers
        MissingMarkers = $missingMarkers
        StaleAbsent = $true
        PresentStaleMarkers = $presentStaleMarkers
        Attempts = $attempt
      }
    }

    if ($attempt -lt $MaxAttempts) {
      Start-Sleep -Seconds $DelaySeconds
    }
  }

  return @{
    Refreshed = $false
    SsrFound = $ssrFound
    DateFound = $dateFound
    FoundMarkers = $foundMarkers
    MissingMarkers = $missingMarkers
    StaleAbsent = ($presentStaleMarkers.Count -eq 0)
    PresentStaleMarkers = $presentStaleMarkers
    Attempts = $MaxAttempts
  }
}

function Write-ExecutionLog {
  param(
    [string]$PayloadPath,
    [string]$AdvisorySecretPresence,
    [string]$DeployHookPresence,
    [AllowNull()][object]$EdgeResult,
    [bool]$DeployHookAttempted,
    [AllowNull()][object]$DeployHookResult,
    [AllowNull()][object]$HtmlResult,
    [string]$FinalVerdict
  )

  New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
  $timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"
  $logPath = Join-Path $LogDirectory "execution-log-$timestamp.md"

  $edgeStatus = if ($null -eq $EdgeResult) { "not attempted" } else { [string]$EdgeResult.StatusCode }
  $edgeOk = if ($null -eq $EdgeResult) { "no" } elseif ($EdgeResult.Ok) { "yes" } else { "no" }
  $deployStatus = if ($null -eq $DeployHookResult) { "not attempted" } else { [string]$DeployHookResult.StatusCode }
  $htmlRefreshed = if ($null -eq $HtmlResult) { "no" } elseif ($HtmlResult.Refreshed) { "yes" } else { "no" }
  $markersFound = if ($null -eq $HtmlResult) { "not checked" } else { (@($HtmlResult.FoundMarkers) -join "; ") }
  $markersMissing = if ($null -eq $HtmlResult) { "not checked" } else { (@($HtmlResult.MissingMarkers) -join "; ") }
  $staleAbsent = if ($null -eq $HtmlResult) { "not checked" } elseif ($HtmlResult.StaleAbsent) { "yes" } else { "no" }
  $stalePresent = if ($null -eq $HtmlResult) { "not checked" } else { (@($HtmlResult.PresentStaleMarkers) -join "; ") }

  $content = @(
    "# Freight Advisory Execution Log",
    "",
    "- Runner OS: Windows",
    "- Payload path: $PayloadPath",
    "- ADVISORY_SECRET presence: $AdvisorySecretPresence",
    "- VERCEL_DEPLOY_HOOK_URL presence: $DeployHookPresence",
    "- Edge Function HTTP status: $edgeStatus",
    "- Edge Function ok:true: $edgeOk",
    "- Direct Supabase upsert used: no",
    "- Deploy hook attempted: $(if ($DeployHookAttempted) { 'yes' } else { 'no' })",
    "- Deploy hook HTTP status: $deployStatus",
    "- Static HTML refreshed: $htmlRefreshed",
    "- Verification markers found: $markersFound",
    "- Verification markers missing: $markersMissing",
    "- Stale markers absent: $staleAbsent",
    "- Stale markers present: $stalePresent",
    "- Secrets exposed: no",
    "- Final verdict: $FinalVerdict"
  )

  Set-Content -LiteralPath $logPath -Value $content -Encoding UTF8
  return $logPath
}

$edgeResult = $null
$deployHookResult = $null
$htmlResult = $null
$deployHookAttempted = $false
$finalVerdict = "failed"
$resolvedPayloadPath = $PayloadPath
$advisorySecretPresence = "MISSING"
$deployHookPresence = "MISSING"

try {
  Assert-WindowsUserEnvironmentAvailable

  $advisorySecretInfo = Get-UserSecretPresence -Name "ADVISORY_SECRET"
  $deployHookInfo = Get-UserSecretPresence -Name "VERCEL_DEPLOY_HOOK_URL"
  $advisorySecretPresence = $advisorySecretInfo.Presence
  $deployHookPresence = $deployHookInfo.Presence

  $payloadRead = Read-AdvisoryPayload -Path $PayloadPath
  $resolvedPayloadPath = $payloadRead.Path
  $payload = $payloadRead.Payload
  Test-AdvisoryPayload -Payload $payload

  if ($DryRun) {
    Write-Host "Dry run passed."
    Write-Host "Payload path: $resolvedPayloadPath"
    Write-Host "ADVISORY_SECRET presence: $advisorySecretPresence"
    Write-Host "VERCEL_DEPLOY_HOOK_URL presence: $deployHookPresence"
    Write-Host "No Edge Function call attempted."
    Write-Host "No Vercel deploy hook call attempted."
    Write-Host "No production execution log written."
    exit 0
  }

  if ($advisorySecretPresence -ne "SET") {
    Fail-Run "ADVISORY_SECRET is missing from Windows User environment."
  }
  if ($deployHookPresence -ne "SET") {
    Fail-Run "VERCEL_DEPLOY_HOOK_URL is missing from Windows User environment."
  }

  $publishBody = New-PublishBody -Payload $payload
  $edgeResult = Invoke-UpdateAdvisory -PublishBody $publishBody -AdvisorySecret $advisorySecretInfo.Value

  if ($edgeResult.StatusCode -ne 200 -or -not $edgeResult.Ok) {
    Fail-Run "update-advisory did not return HTTP 200 with ok:true. HTTP status: $($edgeResult.StatusCode)."
  }

  $deployHookAttempted = $true
  $deployHookResult = Invoke-VercelDeployHook -DeployHookUrl $deployHookInfo.Value

  if ($deployHookResult.StatusCode -lt 200 -or $deployHookResult.StatusCode -ge 300) {
    Fail-Run "Vercel deploy hook did not return a 2xx status. HTTP status: $($deployHookResult.StatusCode)."
  }

  $htmlResult = Test-StaticHtml -Payload $payload
  if (-not $htmlResult.Refreshed) {
    Fail-Run "Static HTML verification failed after $($htmlResult.Attempts) attempts."
  }

  $finalVerdict = "success"
  $logPath = Write-ExecutionLog `
    -PayloadPath $resolvedPayloadPath `
    -AdvisorySecretPresence $advisorySecretPresence `
    -DeployHookPresence $deployHookPresence `
    -EdgeResult $edgeResult `
    -DeployHookAttempted $deployHookAttempted `
    -DeployHookResult $deployHookResult `
    -HtmlResult $htmlResult `
    -FinalVerdict $finalVerdict

  Write-Host "Freight advisory publish succeeded."
  Write-Host "Execution log: $logPath"
  exit 0
} catch {
  $finalVerdict = "failed: $(Redact-LogText $_.Exception.Message)"
  if (-not $DryRun) {
    try {
      $logPath = Write-ExecutionLog `
        -PayloadPath $resolvedPayloadPath `
        -AdvisorySecretPresence $advisorySecretPresence `
        -DeployHookPresence $deployHookPresence `
        -EdgeResult $edgeResult `
        -DeployHookAttempted $deployHookAttempted `
        -DeployHookResult $deployHookResult `
        -HtmlResult $htmlResult `
        -FinalVerdict $finalVerdict
      Write-Error "$(Redact-LogText $_.Exception.Message) Execution log: $logPath"
    } catch {
      Write-Error "$(Redact-LogText $_.Exception.Message)"
    }
  } else {
    Write-Error "$(Redact-LogText $_.Exception.Message)"
  }
  exit 1
}
