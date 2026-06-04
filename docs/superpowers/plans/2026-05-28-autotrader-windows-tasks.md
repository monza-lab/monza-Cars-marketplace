# AutoTrader Windows Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the AutoTrader scheduled pipeline by making the three canonical Windows Task Scheduler jobs exist and prove that discovery, enrichment, and delist runs are observable.

**Architecture:** Keep the existing launcher scripts as the single execution boundary and manage scheduling outside the app through Windows Task Scheduler. Use one task for discovery, one task for enrichment with four daily triggers, and one task for delist checks, all writing to `scripts/logs/autotrader-windows.log` and, where supported, `scraper_runs`.

**Tech Stack:** Windows Task Scheduler PowerShell cmdlets, existing `.bat` launchers, Node 24.5.0, npm 11.5.2, Python 3.11.9, tsx 4.21.0, Supabase `scraper_runs`.

---

## Phase Zero Context

**Environment matrix**
- OS: Microsoft Windows 11 Home `10.0.26200`, build `26200`
- Shell: PowerShell
- Timezone: Europe/Berlin
- Node: `v24.5.0`
- npm: `11.5.2`
- Python: `3.11.9`
- tsx: `4.21.0`
- Repo: `C:\Users\capos\Documents\Personal\AI\MonZA\monza-Cars-marketplace`

**Non-functional requirements**
- Discovery must run daily at `09:00 Europe/Berlin`.
- Enrichment must run daily at `10:00`, `13:00`, `16:00`, and `19:00 Europe/Berlin`.
- Delist check must run daily at `22:00 Europe/Berlin`.
- Tasks must run only under the local `capos` user because existing tasks are configured as interactive-only.
- Tasks must use the existing `.bat` files so logs and environment conventions remain local.
- No new npm dependencies.

**Locality envelope**
- Files: 1 plan file only. Existing runtime files referenced but not modified.
- LOC/file: this plan is under 250 LOC; no production file changes planned.
- Deps: 0 new dependencies.

## Target State

Exactly these three canonical Task Scheduler task names should exist:

| Task | Action | Trigger |
|---|---|---|
| `\Monza\AutoTrader-Discovery-09h` | `scripts\autotrader-discovery-scheduled.bat` | Daily `09:00` |
| `\Monza\AutoTrader-Enrichment` | `scripts\autotrader-enrich-scheduled.bat` | Daily `10:00`, `13:00`, `16:00`, `19:00` |
| `\Monza\AutoTrader-Delist-22h` | `scripts\autotrader-delist-scheduled.bat` | Daily `22:00` |

Existing legacy enrichment tasks named `\Monza\AutoTrader-Enrich-10h`, `\Monza\AutoTrader-Enrich-13h`, `\Monza\AutoTrader-Enrich-16h`, and `\Monza\AutoTrader-Enrich-19h` can remain during rollout, but must be disabled after the canonical `\Monza\AutoTrader-Enrichment` task is verified. This prevents duplicate enrichment.

## Pass-Fail Criteria

Pass:
- `schtasks /Query /TN "\Monza\AutoTrader-Discovery-09h"` succeeds.
- `schtasks /Query /TN "\Monza\AutoTrader-Enrichment"` succeeds and shows four triggers.
- `schtasks /Query /TN "\Monza\AutoTrader-Delist-22h"` succeeds.
- Manual discovery test records a new `scraper_runs` row with `scraper_name = autotrader`, `runtime = windows_task`, and `written > 0`.
- `scripts/logs/autotrader-windows.log` contains fresh start/finish lines for the manually run task.

Fail:
- Any canonical task is missing.
- Discovery writes only `runtime = cli`, meaning the task did not use the scheduled launcher environment.
- Discovery exits non-zero or writes no `scraper_runs` row.
- Enrichment runs duplicate because both canonical and legacy enrichment tasks remain enabled after verification.

## Task 1: Preflight Current Scheduler State

**Files:**
- Read: `scripts/autotrader-discovery-scheduled.bat`
- Read: `scripts/autotrader-enrich-scheduled.bat`
- Read: `scripts/autotrader-delist-scheduled.bat`
- Read: `scripts/logs/autotrader-windows.log`
- No file changes.

- [ ] **Step 1: Confirm the three launcher scripts exist**

Run:

```powershell
Test-Path scripts\autotrader-discovery-scheduled.bat
Test-Path scripts\autotrader-enrich-scheduled.bat
Test-Path scripts\autotrader-delist-scheduled.bat
```

Expected: all three commands print `True`.

- [ ] **Step 2: Capture current AutoTrader task inventory**

Run:

```powershell
Get-ScheduledTask -TaskPath "\Monza\" -ErrorAction SilentlyContinue |
  Where-Object { $_.TaskName -like "AutoTrader*" } |
  Select-Object TaskPath,TaskName,State |
  Format-Table -AutoSize
```

Expected before implementation: enrichment and delist tasks exist, discovery is missing.

- [ ] **Step 3: Confirm no stale active AutoTrader discovery run is stuck**

Run:

```powershell
npx tsx agents\testscripts\audit-scraper-runs.ts --since=2026-05-28T00:00:00.000Z --until=2026-05-29T00:00:00.000Z
```

Expected: `active_runs` does not include `autotrader`.

## Task 2: Create Canonical Windows Tasks

**Files:**
- Use: `scripts/autotrader-discovery-scheduled.bat`
- Use: `scripts/autotrader-enrich-scheduled.bat`
- Use: `scripts/autotrader-delist-scheduled.bat`
- No file changes.

- [ ] **Step 1: Create the `\Monza` folder if missing**

Run:

```powershell
$service = New-Object -ComObject Schedule.Service
$service.Connect()
$root = $service.GetFolder("\")
try {
  $null = $root.GetFolder("Monza")
} catch {
  $null = $root.CreateFolder("Monza")
}
```

Expected: no error.

- [ ] **Step 2: Register discovery**

Run:

```powershell
$root = "C:\Users\capos\Documents\Personal\AI\MONZA\monza-Cars-marketplace"
$action = New-ScheduledTaskAction -Execute "$root\scripts\autotrader-discovery-scheduled.bat" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At "09:00"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName "AutoTrader-Discovery-09h" -TaskPath "\Monza\" -Action $action -Trigger $trigger -Settings $settings -Description "Monza AutoTrader discovery, daily 09:00 Europe/Berlin" -Force
```

Expected: task registration succeeds.

- [ ] **Step 3: Register enrichment as one task with four triggers**

Run:

```powershell
$root = "C:\Users\capos\Documents\Personal\AI\MONZA\monza-Cars-marketplace"
$action = New-ScheduledTaskAction -Execute "$root\scripts\autotrader-enrich-scheduled.bat" -WorkingDirectory $root
$triggers = @(
  New-ScheduledTaskTrigger -Daily -At "10:00"
  New-ScheduledTaskTrigger -Daily -At "13:00"
  New-ScheduledTaskTrigger -Daily -At "16:00"
  New-ScheduledTaskTrigger -Daily -At "19:00"
)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName "AutoTrader-Enrichment" -TaskPath "\Monza\" -Action $action -Trigger $triggers -Settings $settings -Description "Monza AutoTrader enrichment, four daily Europe/Berlin runs" -Force
```

Expected: task registration succeeds.

- [ ] **Step 4: Register delist**

Run:

```powershell
$root = "C:\Users\capos\Documents\Personal\AI\MONZA\monza-Cars-marketplace"
$action = New-ScheduledTaskAction -Execute "$root\scripts\autotrader-delist-scheduled.bat" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At "22:00"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName "AutoTrader-Delist-22h" -TaskPath "\Monza\" -Action $action -Trigger $trigger -Settings $settings -Description "Monza AutoTrader delist check, daily 22:00 Europe/Berlin" -Force
```

Expected: task registration succeeds.

## Task 3: Verify Canonical Tasks and Prevent Duplicate Enrichment

**Files:**
- Read: Task Scheduler state
- Read: `scripts/logs/autotrader-windows.log`
- No file changes.

- [ ] **Step 1: Query the three canonical tasks**

Run:

```powershell
schtasks /Query /TN "\Monza\AutoTrader-Discovery-09h" /FO LIST /V
schtasks /Query /TN "\Monza\AutoTrader-Enrichment" /FO LIST /V
schtasks /Query /TN "\Monza\AutoTrader-Delist-22h" /FO LIST /V
```

Expected: all three queries succeed. `AutoTrader-Enrichment` shows four daily triggers.

- [ ] **Step 2: Disable legacy enrichment tasks after canonical enrichment exists**

Run:

```powershell
$legacy = @(
  "\Monza\AutoTrader-Enrich-10h",
  "\Monza\AutoTrader-Enrich-13h",
  "\Monza\AutoTrader-Enrich-16h",
  "\Monza\AutoTrader-Enrich-19h"
)
foreach ($task in $legacy) {
  schtasks /Query /TN $task *> $null
  if ($LASTEXITCODE -eq 0) {
    schtasks /Change /TN $task /DISABLE
  }
}
```

Expected: any legacy enrichment task that exists is disabled.

- [ ] **Step 3: Confirm final enabled AutoTrader task set**

Run:

```powershell
Get-ScheduledTask -TaskPath "\Monza\" |
  Where-Object { $_.TaskName -like "AutoTrader*" } |
  Select-Object TaskName,State |
  Sort-Object TaskName |
  Format-Table -AutoSize
```

Expected:
- `AutoTrader-Discovery-09h` is `Ready`.
- `AutoTrader-Enrichment` is `Ready`.
- `AutoTrader-Delist-22h` is `Ready`.
- Legacy `AutoTrader-Enrich-*` tasks, if present, are `Disabled`.

## Task 4: Manual Smoke Test Discovery

**Files:**
- Use: `scripts/autotrader-discovery-scheduled.bat`
- Read: `scripts/logs/autotrader-windows.log`
- Read: `agents/testscripts/artifacts/scraper-run-log-*.json`
- No file changes.

- [ ] **Step 1: Start the discovery task manually**

Run:

```powershell
schtasks /Run /TN "\Monza\AutoTrader-Discovery-09h"
```

Expected: command says the task was started.

- [ ] **Step 2: Wait until task finishes**

Run:

```powershell
do {
  Start-Sleep -Seconds 15
  $task = Get-ScheduledTask -TaskPath "\Monza\" -TaskName "AutoTrader-Discovery-09h"
  $state = $task.State
  Write-Host "State: $state"
} while ($state -eq "Running")
```

Expected: state returns to `Ready`.

- [ ] **Step 3: Check task result**

Run:

```powershell
(Get-ScheduledTaskInfo -TaskPath "\Monza\" -TaskName "AutoTrader-Discovery-09h") |
  Select-Object LastRunTime,LastTaskResult,NextRunTime
```

Expected: `LastTaskResult` is `0`.

- [ ] **Step 4: Confirm log evidence**

Run:

```powershell
Get-Content scripts\logs\autotrader-windows.log -Tail 80
```

Expected:
- A fresh line containing `AutoTrader discovery starting`.
- A fresh line containing `AutoTrader discovery finished exit_code=0`.
- Collector output between those lines.

- [ ] **Step 5: Confirm database evidence**

Run:

```powershell
npx tsx agents\testscripts\audit-scraper-runs.ts --since=2026-05-28T00:00:00.000Z --until=2026-05-29T00:00:00.000Z
```

Expected:
- A fresh `autotrader` row exists.
- `runtime` is `windows_task`.
- `success` is `true`.
- `written` is greater than `0`.

## Task 5: Update Operational Notes If Needed

**Files:**
- Modify only if actual final task names differ: `docs/scrapers/SCRAPERS.md`
- No change expected if the task names above are used.

- [ ] **Step 1: Compare docs to actual task names**

Run:

```powershell
Get-Content docs\scrapers\SCRAPERS.md |
  Select-String -Pattern "AutoTrader-Discovery|AutoTrader-Enrich|AutoTrader-Enrichment|AutoTrader-Delist" -Context 1,1
```

Expected: docs mention the same canonical task names used on the machine.

- [ ] **Step 2: If docs still reference legacy enrichment task names, update only that table**

Expected edit if needed:

```markdown
**Windows tasks:** `\Monza\AutoTrader-Enrichment` with daily triggers at 10:00, 13:00, 16:00, and 19:00 Europe/Berlin
```

- [ ] **Step 3: Commit docs only if changed**

Run:

```powershell
git diff -- docs\scrapers\SCRAPERS.md
git add docs\scrapers\SCRAPERS.md
git commit -m "docs(scrapers): clarify autotrader windows tasks"
```

Expected: commit only if docs changed.

## Testscript TS-AUTOTRADER-WINDOWS-TASKS

**Identifier:** `TS-AUTOTRADER-WINDOWS-TASKS`

**Objective:** Verify the AutoTrader scheduled pipeline is restored and observable.

**Prerequisites:**
- PowerShell running as the `capos` user.
- Existing `.env.local` contains Supabase credentials.
- Existing launcher scripts exist.

**Setup:**

```powershell
cd C:\Users\capos\Documents\Personal\AI\MONZA\monza-Cars-marketplace
```

**Run commands:**

```powershell
schtasks /Query /TN "\Monza\AutoTrader-Discovery-09h" /FO LIST /V
schtasks /Query /TN "\Monza\AutoTrader-Enrichment" /FO LIST /V
schtasks /Query /TN "\Monza\AutoTrader-Delist-22h" /FO LIST /V
schtasks /Run /TN "\Monza\AutoTrader-Discovery-09h"
```

Then poll:

```powershell
do {
  Start-Sleep -Seconds 15
  $state = (Get-ScheduledTask -TaskPath "\Monza\" -TaskName "AutoTrader-Discovery-09h").State
  Write-Host "State: $state"
} while ($state -eq "Running")
Get-ScheduledTaskInfo -TaskPath "\Monza\" -TaskName "AutoTrader-Discovery-09h"
Get-Content scripts\logs\autotrader-windows.log -Tail 80
npx tsx agents\testscripts\audit-scraper-runs.ts --since=2026-05-28T00:00:00.000Z --until=2026-05-29T00:00:00.000Z
```

**Expected observations:**
- The three canonical scheduled tasks exist.
- Discovery task finishes with `LastTaskResult = 0`.
- Log file contains discovery start and finish lines.
- Supabase run audit shows a new `autotrader` run with `runtime = windows_task`.

**Artifact capture:**
- Save command output in the chat or in `agents/testscripts/artifacts/autotrader-windows-tasks-2026-05-28.txt`.
- Existing audit command writes JSON to `agents/testscripts/artifacts/scraper-run-log-2026-05-28T00-00-00-000Z.json`.

**Cleanup:**
- Keep canonical tasks enabled.
- Keep legacy `AutoTrader-Enrich-*` tasks disabled after canonical enrichment is verified.

**Known limitations:**
- Windows Task Scheduler can require an interactive user session depending on local task security settings.
- Discovery depends on the local network path and AutoTrader behavior; a one-off site block should be diagnosed from `scripts/logs/autotrader-windows.log` before changing code.
