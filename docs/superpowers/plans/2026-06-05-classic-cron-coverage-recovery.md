# Classic.com Cron Coverage Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Classic.com US active inventory coverage by making discovery crawl enough pages, preventing false stale delisting when discovery is partial, and live-testing the cron jobs against Supabase.

**Architecture:** Keep the existing vertical Classic.com scraper slice. Add small, local safety gates around discovery coverage and stale refresh, increase scheduled crawl depth, and add one focused verification script that queries live Supabase before and after cron execution. No new runtime dependency is needed.

**Tech Stack:** Next.js 16 API route cron, GitHub Actions, TypeScript, Supabase/Postgres, existing Playwright/Scrapling Classic.com collector.

---

## Phase Zero Context

Environment captured on 2026-06-05:

- OS/workspace: Windows PowerShell in `C:\Users\capos\Documents\Personal\AI\MonZA\monza-Cars-marketplace`
- Node: `v24.5.0`
- npm: `11.5.2`
- Python: `3.11.9`
- Git: `2.46.2.windows.1`
- Next.js: `16.1.6`
- Supabase client: `@supabase/supabase-js 2.95.3`
- Browser tooling: `playwright 1.58.1`, `rebrowser-playwright 1.52.0`
- Vercel CLI: not globally installed in this environment; project has `vercel` package dependency. Recommend `npm i -g vercel` before Vercel log/env workflows.

Current evidence from live Supabase:

- `ClassicCom active`: 796
- `ClassicCom delisted`: 4,740
- Classic.com report on 2026-04-20 had 4,998 active rows.
- Recent GitHub Actions Classic runs discover about 480 rows and write about 450.
- Vercel cron discovers about 240 rows and then delists stale Classic rows.
- `refreshStaleListings({ staleDays: 7 })` can drain inventory if discovery only sees the first 240 to 480 results.

Non-functional requirements:

- Do not delete listings.
- Do not introduce dependencies.
- Keep Classic.com logic inside `src/features/scrapers/classic_collector/` plus cron/workflow configuration.
- Live test against the real Supabase project and collect before/after artifacts.
- Fail closed: skip stale delisting when discovery coverage is too low.

## Locality Envelope

Files:

- Modify: `.github/workflows/classic-collector.yml` - increase scheduled/manual defaults and add explicit run coverage knobs.
- Modify: `src/app/api/cron/classic/route.ts` - increase Vercel discovery coverage and gate stale refresh.
- Modify: `src/features/scrapers/classic_collector/supabase_writer.ts` - add coverage-aware stale refresh parameters.
- Modify: `src/features/scrapers/classic_collector/supabase_writer.test.ts` - prove stale refresh skips when discovery is below threshold.
- Create: `scripts/classic-cron-live-check.ts` - one-command live Supabase verification around cron/manual runs.
- Optional modify: `docs/scrapers/SCRAPERS.md` - document new Classic live-test commands after implementation.

LOC/file target:

- `.github/workflows/classic-collector.yml`: <= 30 changed LOC
- `src/app/api/cron/classic/route.ts`: <= 60 changed LOC
- `src/features/scrapers/classic_collector/supabase_writer.ts`: <= 90 changed LOC
- `src/features/scrapers/classic_collector/supabase_writer.test.ts`: <= 140 changed LOC
- `scripts/classic-cron-live-check.ts`: <= 220 LOC
- `docs/scrapers/SCRAPERS.md`: <= 40 changed LOC

Deps:

- Runtime deps: 0
- Dev deps: 0
- External accounts/config: existing Supabase env vars and existing GitHub Actions secrets only.

## Pass/Fail Criteria

Pass:

- Unit test proves stale refresh does not delist rows when Classic discovery is below a configured minimum.
- `npm test -- src/features/scrapers/classic_collector/supabase_writer.test.ts` passes.
- `npm run scrapers:audit -- --days=3` reports Classic.com not failed or stuck.
- Live Classic Vercel cron returns `success: true`.
- Live GitHub Actions/manual Classic collector completes and writes rows.
- After live runs, `ClassicCom active` is stable or increasing, and `refresh_updated` is not draining hundreds of rows when discovery coverage is partial.

Fail:

- Any live cron run returns HTTP 500/401.
- Classic discovery returns 0 while stale refresh still updates rows.
- Classic active count drops materially during validation without matching evidence that rows are actually gone from source.
- Duplicate-key write errors exceed the current baseline enough to block writes.

## Task 1: Add Coverage-Aware Stale Refresh Contract

**Files:**

- Modify: `src/features/scrapers/classic_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/classic_collector/supabase_writer.test.ts`

- [ ] **Step 1: Write failing test for low-discovery skip**

Add a test case to `src/features/scrapers/classic_collector/supabase_writer.test.ts` that calls `refreshStaleListings` with a low `discoveredCount` and asserts no Supabase update happens.

Use this exact behavior:

```ts
const result = await refreshStaleListings({
  staleDays: 7,
  maxUpdates: 100,
  discoveredCount: 240,
  minDiscoveryForRefresh: 750,
});

expect(result.checked).toBe(0);
expect(result.updated).toBe(0);
expect(result.skipped).toBe(true);
expect(result.errors).toEqual([]);
```

Expected reason: discovery coverage below 750 means the collector did not observe enough of the Classic.com result set to safely mark missing rows as stale.

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm test -- src/features/scrapers/classic_collector/supabase_writer.test.ts
```

Expected: fail because `RefreshResult.skipped`, `discoveredCount`, and `minDiscoveryForRefresh` are not implemented yet.

- [ ] **Step 3: Implement the smallest contract change**

Change `RefreshResult` and `refreshStaleListings` in `src/features/scrapers/classic_collector/supabase_writer.ts`:

```ts
export interface RefreshResult {
  checked: number;
  updated: number;
  errors: string[];
  skipped?: boolean;
  reason?: string;
}
```

Extend options:

```ts
export async function refreshStaleListings(opts?: {
  staleDays?: number;
  maxUpdates?: number;
  discoveredCount?: number;
  minDiscoveryForRefresh?: number;
}): Promise<RefreshResult> {
  const staleDays = opts?.staleDays ?? 7;
  const maxUpdates = opts?.maxUpdates ?? 200;
  const minDiscoveryForRefresh = opts?.minDiscoveryForRefresh ?? 0;
  const discoveredCount = opts?.discoveredCount;

  if (
    minDiscoveryForRefresh > 0 &&
    discoveredCount !== undefined &&
    discoveredCount < minDiscoveryForRefresh
  ) {
    return {
      checked: 0,
      updated: 0,
      errors: [],
      skipped: true,
      reason: `Classic discovery ${discoveredCount} below stale refresh threshold ${minDiscoveryForRefresh}`,
    };
  }

  // Existing Supabase query/update logic remains below this guard.
}
```

- [ ] **Step 4: Run test and commit**

Run:

```powershell
npm test -- src/features/scrapers/classic_collector/supabase_writer.test.ts
```

Expected: pass.

Commit:

```powershell
git add src/features/scrapers/classic_collector/supabase_writer.ts src/features/scrapers/classic_collector/supabase_writer.test.ts
git commit -m "fix: gate classic stale refresh by discovery coverage"
```

## Task 2: Increase Classic.com Scheduled Coverage

**Files:**

- Modify: `.github/workflows/classic-collector.yml`
- Modify: `src/app/api/cron/classic/route.ts`

- [ ] **Step 1: Update GitHub Actions default crawl depth**

Change `.github/workflows/classic-collector.yml` defaults:

```yaml
max_pages:
  description: 'Max search pages'
  default: '200'
max_listings:
  description: 'Max listings to process'
  default: '6000'
```

Keep workflow timeout at 90 minutes. The full GitHub Actions run uses Scrapling-first detail fetching and is the right place for broad coverage.

- [ ] **Step 2: Update Vercel cron to safer discovery settings**

In `src/app/api/cron/classic/route.ts`, change the collector config:

```ts
maxPages: 25,
maxListings: 750,
```

Keep `summaryOnly: true`. Vercel cron remains a supplement, not the full collector.

- [ ] **Step 3: Pass coverage info into stale refresh**

Replace:

```ts
const refreshResult = await refreshStaleListings({ staleDays: 7, maxUpdates: 100 });
```

with:

```ts
const refreshResult = await refreshStaleListings({
  staleDays: 10,
  maxUpdates: 100,
  discoveredCount: result.counts.discovered,
  minDiscoveryForRefresh: 700,
});
```

Rationale:

- `staleDays: 10` gives the GitHub Actions full collector more time to re-see rows.
- `minDiscoveryForRefresh: 700` prevents the 240-row/480-row partial discovery problem from delisting rows.
- `maxUpdates: 100` stays conservative.

- [ ] **Step 4: Include skip metadata in cron response and monitoring errors**

Add `skipped` and `reason` to the JSON response refresh object:

```ts
refresh: {
  checked: refreshResult.checked,
  updated: refreshResult.updated,
  skipped: refreshResult.skipped ?? false,
  reason: refreshResult.reason ?? null,
  errors: refreshResult.errors,
},
```

When `refreshResult.reason` exists, include it in `error_messages` only if the run has other errors; otherwise rely on the JSON response. This keeps the health dashboard from treating an intentional skip as a failure.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm test -- src/features/scrapers/classic_collector/supabase_writer.test.ts
```

Expected: pass.

Commit:

```powershell
git add .github/workflows/classic-collector.yml src/app/api/cron/classic/route.ts
git commit -m "fix: expand classic coverage and protect stale refresh"
```

## Task 3: Add Live Classic Cron Verification Script

**Files:**

- Create: `scripts/classic-cron-live-check.ts`

- [ ] **Step 1: Create the live verification script**

Create `scripts/classic-cron-live-check.ts` with these responsibilities:

- Load `.env.local` and `.env`.
- Connect to Supabase using `DATABASE_URL` when present, otherwise use `NEXT_PUBLIC_SUPABASE_URL` plus service role key through Supabase client.
- Print Classic status counts.
- Print latest Classic scraper runs.
- Print recent `refresh_updated` totals.
- Optionally call the Vercel cron endpoint when invoked with `--trigger-cron`.

Required command interface:

```powershell
npx tsx scripts/classic-cron-live-check.ts --before
npx tsx scripts/classic-cron-live-check.ts --trigger-cron
npx tsx scripts/classic-cron-live-check.ts --after
```

Expected output sections:

```text
## classic_status_counts
## classic_recent_runs
## classic_refresh_window
## assessment
```

Assessment rules:

- Print `PASS` when active count is not lower than the before snapshot and latest cron success is true.
- Print `WARN` when Classic is degraded but still writing.
- Print `FAIL` when cron failed, active count dropped by more than 100 during test, or discovery was 0 and refresh updated rows.

- [ ] **Step 2: Run preflight**

Run:

```powershell
npx tsx scripts/classic-cron-live-check.ts --before
```

Expected:

- Prints current `ClassicCom` counts.
- Prints last 10 Classic runs.
- Does not modify data.

- [ ] **Step 3: Commit script**

Commit:

```powershell
git add scripts/classic-cron-live-check.ts
git commit -m "chore: add classic cron live check"
```

## Task 4: Live-Test Vercel Cron Route

**Files:**

- No code edits in this task.
- Artifact output: `agents/testscripts/artifacts/classic-cron-live-<timestamp>.json`

- [ ] **Step 1: Confirm env variables**

Run:

```powershell
npm run env:check
```

Expected:

- `NEXT_PUBLIC_SUPABASE_URL` present.
- `SUPABASE_SERVICE_ROLE_KEY` present.
- `CRON_SECRET` present.
- `NEXT_PUBLIC_APP_URL` present and points at the target deployment.

- [ ] **Step 2: Capture before snapshot**

Run:

```powershell
npx tsx scripts/classic-cron-live-check.ts --before
```

Expected:

- Active count recorded.
- Latest Classic run recorded.

- [ ] **Step 3: Trigger deployed cron endpoint**

Run:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Uri "$env:NEXT_PUBLIC_APP_URL/api/cron/classic" -Headers $headers -Method GET
```

Expected JSON:

```json
{
  "success": true,
  "counts": {
    "discovered": 700,
    "written": 0
  },
  "refresh": {
    "skipped": false
  }
}
```

Acceptable variation:

- `counts.discovered` may be below 700 if Classic.com blocks or paginates differently.
- If `counts.discovered < 700`, expected `refresh.skipped` is `true` and `refresh.updated` is `0`.

- [ ] **Step 4: Capture after snapshot**

Run:

```powershell
npx tsx scripts/classic-cron-live-check.ts --after
```

Expected:

- Latest `vercel_cron` run exists.
- Run `success` is true.
- If discovery was below threshold, no stale rows were delisted by that run.
- Active count did not drop by more than 100.

- [ ] **Step 5: Run scraper health audit**

Run:

```powershell
npm run scrapers:audit -- --days=3
```

Expected:

- `classic` is not `FAILED` or `STUCK`.
- `classic` may remain `DEGRADED` if duplicate-key errors are still present; that is acceptable for this phase if writes continue.

## Task 5: Live-Test GitHub Actions Full Collector

**Files:**

- No code edits in this task.
- External UI: GitHub Actions > Classic.com Collector (Daily)

- [ ] **Step 1: Trigger workflow manually**

Use GitHub Actions workflow dispatch with:

```text
max_pages: 200
max_listings: 6000
dry_run: false
summary_only: false
disable_playwright: true
```

Expected:

- Workflow starts on `ubuntu-latest`.
- Scrapling installs successfully.
- Collector discovers significantly more than 480 rows if Classic.com exposes enough pages.

- [ ] **Step 2: Watch run output**

Expected healthy log pattern:

```text
collector.discover_start
discover.page_done
collector.discover_done
collector.progress
collector.done
```

Failing pattern:

```text
collector.no_listings
Cloudflare challenge not resolved
Supabase listings upsert failed
```

- [ ] **Step 3: Capture post-GHA live state**

Run locally:

```powershell
npx tsx scripts/classic-cron-live-check.ts --after
npm run scrapers:audit -- --days=3
```

Expected:

- Latest Classic `github_actions` run exists.
- `discovered` is greater than the previous 480-row ceiling.
- `written` is greater than 0.
- `ClassicCom active` is stable or increasing.

## Task 6: Diagnose Remaining Duplicate-Key Errors

**Files:**

- Modify only if live tests show write errors remain high: `src/features/scrapers/classic_collector/supabase_writer.ts`
- Test: `src/features/scrapers/classic_collector/supabase_writer.test.ts`

- [ ] **Step 1: Query duplicate source/source_id conflicts**

Run:

```sql
select source, source_id, count(*)
from listings
where source = 'ClassicCom'
group by source, source_id
having count(*) > 1;
```

Expected:

- Normally 0 rows because unique constraint blocks duplicates.

- [ ] **Step 2: Query source_url/source_id mismatch candidates**

Run:

```sql
select id, source, source_id, source_url, status, updated_at
from listings
where source = 'ClassicCom'
  and source_url in (
    select source_url
    from listings
    where source = 'ClassicCom'
    group by source_url
    having count(*) > 1
  )
order by source_url, updated_at desc
limit 100;
```

Expected:

- If rows appear, current fallback update-by-url may be colliding with another `source_id`.

- [ ] **Step 3: Fix only if confirmed**

If the mismatch is confirmed, change conflict handling to select existing row by both `source_url` and `source`, then preserve the existing `source_id` when updating by URL:

```ts
const patchedRow = {
  ...row,
  source_id: existingSourceId,
  images: mergeImages(existing.images, listing.photos),
  photos_count: mergeImages(existing.images, listing.photos).length,
};
```

Add a unit test where a source URL conflict points to an existing row with a different `source_id`, and assert update preserves existing `source_id`.

- [ ] **Step 4: Verify**

Run:

```powershell
npm test -- src/features/scrapers/classic_collector/supabase_writer.test.ts
npm run scrapers:audit -- --days=3
```

Expected:

- Tests pass.
- Classic write errors decrease on next live run.

## Task 7: Documentation and Operator Runbook

**Files:**

- Modify: `docs/scrapers/SCRAPERS.md`

- [ ] **Step 1: Document the new Classic recovery behavior**

Add a short section under Classic.com Collector:

```md
### Classic.com coverage safety

The Vercel cron is summary-only and must not delist stale rows unless discovery coverage is high enough. It passes `discoveredCount` into `refreshStaleListings`; if discovery is below the threshold, stale refresh is skipped.

Live check:

```powershell
npx tsx scripts/classic-cron-live-check.ts --before
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Uri "$env:NEXT_PUBLIC_APP_URL/api/cron/classic" -Headers $headers -Method GET
npx tsx scripts/classic-cron-live-check.ts --after
```
```

- [ ] **Step 2: Commit docs**

Run:

```powershell
git add docs/scrapers/SCRAPERS.md
git commit -m "docs: add classic cron recovery runbook"
```

## Final Verification Script

Run all final checks in this order:

```powershell
npm test -- src/features/scrapers/classic_collector/supabase_writer.test.ts
npm run scrapers:audit -- --days=3
npx tsx scripts/classic-cron-live-check.ts --before
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Uri "$env:NEXT_PUBLIC_APP_URL/api/cron/classic" -Headers $headers -Method GET
npx tsx scripts/classic-cron-live-check.ts --after
```

Expected final observations:

- Unit tests pass.
- Classic scraper health is not failed/stuck.
- Vercel cron returns success.
- If discovery is partial, stale refresh is skipped.
- `ClassicCom active` does not collapse during live testing.
- GitHub Actions full run increases discovery beyond the current 480-row ceiling or produces a clear source-side pagination/blocking signal.

## Rollback Plan

If live testing shows worse behavior:

1. Revert `.github/workflows/classic-collector.yml` crawl depth to `max_pages: 20`, `max_listings: 1000`.
2. Keep the stale refresh coverage guard in place; it is protective.
3. Set Vercel cron `maxPages` back to 10 and `maxListings` back to 250 only if the route times out.
4. Run:

```powershell
npm test -- src/features/scrapers/classic_collector/supabase_writer.test.ts
npm run scrapers:audit -- --days=3
```

## Self-Review

Spec coverage:

- Restores Classic.com coverage: Tasks 2 and 5.
- Prevents false delisting: Tasks 1 and 2.
- Includes live testing of cron jobs: Tasks 4 and 5.
- Uses current repo patterns and no new dependencies: all tasks stay in existing scraper/cron/script areas.

Placeholder scan:

- No TBD/TODO placeholders.
- Each task has concrete files, commands, expected outputs, and pass/fail criteria.

Type consistency:

- `RefreshResult.skipped` and `RefreshResult.reason` are introduced before use in the cron route.
- `discoveredCount` and `minDiscoveryForRefresh` are defined in `refreshStaleListings` options before tests and cron route use them.
