Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repo = "C:\sattva"
$AdvisoryDir = "C:\sattva\docs\advisories"
$TodayIso = Get-Date -Format "yyyy-MM-dd"
$RunLog = Join-Path $AdvisoryDir "scheduled-smoke-test-$TodayIso.log"
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
Log "Starting scheduled smoke test"

$gitStatus = git status --short --untracked-files=no
if ($gitStatus) {
  Fail "Repo is not clean: $gitStatus"
}

if (-not (Test-Path -LiteralPath $CodexExe)) {
  Fail "Codex executable not found: $CodexExe"
}

Log "Testing Codex exec from scheduled context"
$codexOutput = & $CodexExe exec "Say READY and do nothing else" 2>&1
$codexOutput | Out-File -LiteralPath (Join-Path $AdvisoryDir "scheduled-smoke-codex-$TodayIso.log") -Encoding UTF8

if ($LASTEXITCODE -ne 0) {
  Fail "Codex smoke test failed with exit code $LASTEXITCODE"
}

$codexText = $codexOutput -join "`n"
if ($codexText -notmatch "READY") {
  Fail "Codex smoke test did not return READY"
}

Log "SUCCESS: Scheduled context can run Codex"
