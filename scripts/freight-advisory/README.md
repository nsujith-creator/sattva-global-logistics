# Sattva Freight Advisory Windows Runner

This replaces the paused Claude Cowork scheduled task for publishing the Sattva Freight Intelligence Advisory. The scheduled publisher must be this deterministic Windows script, not Claude, Codex, ChatGPT, or any other AI agent.

The runner uses only this approved path:

Windows User-scope secrets -> `update-advisory` Supabase Edge Function -> `ok:true` -> Vercel deploy hook -> static SSR HTML verification -> execution log.

It does not research or write advisory content. It publishes a prepared JSON payload only.

## Files

- `run-freight-advisory.ps1` - Windows-only deterministic publisher.
- `sample-advisory-payload.json` - Dummy payload showing the expected shape.

Execution logs are written to `C:\sattva\docs\advisories\execution-log-YYYY-MM-DD-HHMM.md` only during real publish attempts.

## Prepare The Daily Payload

Create a reviewed JSON payload under `C:\sattva\docs\advisories\`, for example:

```powershell
Copy-Item `
  -LiteralPath "C:\sattva\scripts\freight-advisory\sample-advisory-payload.json" `
  -Destination "C:\sattva\docs\advisories\advisory-payload-2026-06-23.json"
```

Replace the dummy content with approved advisory content. Required fields:

- `date_display`
- `updated_at_display`
- `situation`
- `carrier_notes`
- `surcharges`
- `india_impact`
- `source_tags`
- `verification_markers`
- `stale_markers`
- `updated_by`

`updated_by` must be `windows-deterministic-runner`.

The Edge Function stores only the current approved advisory fields: `situation`, `carrier_notes`, `surcharges`, `india_impact`, `source_tags`, and `updated_by`. The runner uses `date_display`, `updated_at_display`, `verification_markers`, and `stale_markers` for validation and static HTML proof.

Make sure `date_display` and at least one `verification_markers` value will appear in the prerendered static page after deployment.

## Secret Setup

Store secrets in Windows User environment variables only. Never store secrets in this repo.

```powershell
[Environment]::SetEnvironmentVariable("ADVISORY_SECRET", "<secret>", "User")
[Environment]::SetEnvironmentVariable("VERCEL_DEPLOY_HOOK_URL", "<vercel-deploy-hook-url>", "User")
```

Open a new PowerShell window after setting them.

The runner never reads `$env:ADVISORY_SECRET` or `$env:VERCEL_DEPLOY_HOOK_URL`. It reads only:

```powershell
[Environment]::GetEnvironmentVariable("ADVISORY_SECRET", "User")
[Environment]::GetEnvironmentVariable("VERCEL_DEPLOY_HOOK_URL", "User")
```

## Dry Run

Dry run validates Windows, payload shape, and User-scope secret presence. It does not call Supabase, does not call Vercel, and writes no production execution log.

```powershell
Set-Location C:\sattva\scripts\freight-advisory
.\run-freight-advisory.ps1 `
  -PayloadPath "C:\sattva\docs\advisories\advisory-payload-2026-06-23.json" `
  -DryRun
```

## Manual Publish

Run only after the payload has been reviewed and approved.

```powershell
Set-Location C:\sattva\scripts\freight-advisory
.\run-freight-advisory.ps1 `
  -PayloadPath "C:\sattva\docs\advisories\advisory-payload-2026-06-23.json"
```

Expected successful flow:

1. Validate Windows and User-scope secret access.
2. Validate payload shape.
3. POST to `update-advisory` with `x-advisory-secret`.
4. Continue only after HTTP `200` and `ok:true`.
5. Trigger Vercel deploy hook.
6. Poll `https://www.sattvaglobal.in/trade-advisory`.
7. Verify `id="ssr-advisory"`, `date_display`, at least one verification marker, and stale marker absence.
8. Write the execution log.

## Manual Verification Commands

Fetch raw static HTML without using a browser:

```powershell
$html = (Invoke-WebRequest -Uri "https://www.sattvaglobal.in/trade-advisory" -UseBasicParsing).Content
$html.Contains('id="ssr-advisory"')
$html.Contains("23 June 2026")
$html.Contains("Sample Source Tag")
```

Inspect the latest execution log:

```powershell
Get-ChildItem C:\sattva\docs\advisories\execution-log-*.md |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1 |
  Get-Content
```

## Windows Task Scheduler

Create the scheduled task from an elevated or normal PowerShell session, depending on the Windows account that owns the User-scope secrets. Use Windows PowerShell 5.1 / powershell.exe unless you deliberately verify PowerShell 7 separately.

```powershell
$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\sattva\scripts\freight-advisory\run-freight-advisory.ps1" -PayloadPath "C:\sattva\docs\advisories\advisory-payload-latest.json"'

$trigger = New-ScheduledTaskTrigger -Daily -At 3:10PM

Register-ScheduledTask `
  -TaskName "Sattva Freight Advisory Publisher" `
  -Action $action `
  -Trigger $trigger `
  -Description "Publishes the reviewed Sattva freight advisory through update-advisory and Vercel."
```

Use the same Windows user that has `ADVISORY_SECRET` and `VERCEL_DEPLOY_HOOK_URL` set in User environment variables.

## Troubleshooting

`ADVISORY_SECRET missing`

Set `ADVISORY_SECRET` in the Windows User environment, then open a new PowerShell window. Do not put it in `.env.local`, Process env, or the repo.

`Edge Function 401`

The User-scope `ADVISORY_SECRET` is missing or does not match the Supabase Edge Function secret. The runner sends it only as the `x-advisory-secret` header.

`Vercel hook missing`

Set `VERCEL_DEPLOY_HOOK_URL` in the Windows User environment. The runner never prints the hook URL.

`static HTML stale`

Check the Vercel deployment triggered by the hook. The runner requires raw HTML at `https://www.sattvaglobal.in/trade-advisory` to contain `id="ssr-advisory"`, the payload `date_display`, and at least one verification marker. Make sure the marker is stored in an advisory field that prerender injects, such as `situation`, `india_impact`, or `source_tags`.

`wrong OS`

Run the script on Windows only. Linux, WSL, macOS, and sandbox runtimes are rejected.

## Safety Rules

- Never store secrets in the repo.
- Never commit real advisory secrets or Vercel hook URLs.
- Do not use direct Supabase table upserts.
- Do not trigger Vercel unless `update-advisory` returns HTTP `200` and `ok:true`.
- Claude, Codex, and ChatGPT should not be the scheduled publisher.
