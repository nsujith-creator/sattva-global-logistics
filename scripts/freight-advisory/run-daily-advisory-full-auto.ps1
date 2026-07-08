Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repo = "C:\sattva"
$AdvisoryDir = "C:\sattva\docs\advisories"
$TodayIso = Get-Date -Format "yyyy-MM-dd"
$TodayDisplay = Get-Date -Format "dd MMMM yyyy"
$PayloadPath = Join-Path $AdvisoryDir "advisory-payload-$TodayIso.json"
$LatestPath = Join-Path $AdvisoryDir "advisory-payload-latest.json"
$RunLog = Join-Path $AdvisoryDir "auto-run-$TodayIso.log"
$CodexExe = "C:\Users\sujit\AppData\Roaming\npm\codex.ps1"

function Log($msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
  Add-Content -LiteralPath $RunLog -Value $line -Encoding UTF8
}

function Fail($msg) {
  Log "FAILED: $msg"
  throw $msg
}

Set-Location $Repo
Log "Starting full-auto advisory run for $TodayDisplay"

# Safety: do not run if repo has source changes
$gitStatus = git status --short
if ($gitStatus) {
  Fail "Repo is not clean. git status: $gitStatus"
}

# Generate today's artifacts through Codex non-interactive mode.
# Codex docs describe `codex exec` as the non-interactive scripting/CI mode.
$Prompt = @"
Use scripts/freight-advisory/MASTER_DAILY_GENERATION_PROMPT.md.
Today is $TodayDisplay.
Generate today's advisory artifacts and dry-run only.
Do not publish.
Do not modify website source files.
"@

Log "Running Codex generation dry-run"
$codexOutput = & $CodexExe exec $Prompt 2>&1
$codexOutput | Out-File -LiteralPath (Join-Path $AdvisoryDir "codex-generation-$TodayIso.log") -Encoding UTF8

if ($LASTEXITCODE -ne 0) {
  Fail "Codex generation failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path -LiteralPath $PayloadPath)) {
  Fail "Expected payload not found: $PayloadPath"
}

if (-not (Test-Path -LiteralPath $LatestPath)) {
  Fail "Latest payload not found: $LatestPath"
}

# Validate JSON
try {
  $payloadRaw = Get-Content -LiteralPath $PayloadPath -Raw -Encoding UTF8
  $payload = $payloadRaw | ConvertFrom-Json
} catch {
  Fail "Payload JSON parse failed: $($_.Exception.Message)"
}

# Basic deterministic content gates
if ($payload.date_display -ne $TodayDisplay) {
  Fail "Payload date_display mismatch. Expected '$TodayDisplay', got '$($payload.date_display)'"
}

if (-not $payload.situation -or -not $payload.carrier_notes -or -not $payload.india_impact) {
  Fail "Payload missing required advisory content fields"
}

# Confirm latest and dated payload match
$datedHash = (Get-FileHash -LiteralPath $PayloadPath -Algorithm SHA256).Hash
$latestHash = (Get-FileHash -LiteralPath $LatestPath -Algorithm SHA256).Hash
if ($datedHash -ne $latestHash) {
  Fail "Dated payload and latest payload differ"
}

Log "Running publisher dry-run"
$dryRunOutput = .\scripts\freight-advisory\run-freight-advisory.ps1 -PayloadPath $PayloadPath -DryRun 2>&1
$dryRunOutput | Out-File -LiteralPath (Join-Path $AdvisoryDir "publisher-dry-run-$TodayIso.log") -Encoding UTF8

if ($LASTEXITCODE -ne 0) {
  Fail "Publisher dry-run failed with exit code $LASTEXITCODE"
}

Log "Publishing already-generated payload"
$publishOutput = .\scripts\freight-advisory\run-freight-advisory.ps1 -PayloadPath $PayloadPath 2>&1
$publishOutput | Out-File -LiteralPath (Join-Path $AdvisoryDir "publisher-live-$TodayIso.log") -Encoding UTF8

if ($LASTEXITCODE -ne 0) {
  Fail "Publisher failed with exit code $LASTEXITCODE"
}

# Final repo safety check
$gitStatusAfter = git status --short
if ($gitStatusAfter) {
  Fail "Repo became dirty after run: $gitStatusAfter"
}

Log "SUCCESS: Advisory generated, validated, and published for $TodayDisplay"

