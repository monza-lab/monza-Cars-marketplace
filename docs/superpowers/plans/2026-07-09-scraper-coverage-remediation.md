# Scraper Coverage Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore trustworthy live marketplace coverage by fixing UK active coverage, the recurring BaT detail write error, BeForward enrichment WAF failures, ClassicCom data-quality gaps, AutoScout24 shard saturation visibility, and zero-write enrichment blind spots.

**Architecture:** Treat `public.listings` as the data source of truth and `public.scraper_runs` as the operational source of truth. Each stage adds one measurable correction and one validation query so scraper health cannot read green while market coverage is actually missing or low-quality.

**Tech Stack:** Next.js App Router cron routes, TypeScript scraper scripts, Supabase/Postgres via `pg` and `@supabase/supabase-js`, Vitest tests, local runner artifacts under `logs/scraper-runs/` and `agents/testscripts/artifacts/`.

---

## Evidence Baseline

Latest evidence from live DB and local run artifacts:

- `listings`: 64,868 total rows, 19,506 active rows.
- Active by canonical market: EU 11,960, US 6,288, JP 1,258, UK 0.
- Active by source: AutoScout24 6,830, ClassicCom 6,200, Elferspot 5,130, BeForward 1,258, BaT 88, AutoTrader 0.
- AutoTrader latest delist check: checked 213, live 0, delisted 213, errors 0.
- BeForward enrichment 7-day reliability: 47 runs, 25 failed, 1,253 errors, recurring WAF challenge.
- BaT detail latest recurring error: `value too long for type character varying(100)`.
- ClassicCom active quality gaps: 5,327 active rows missing price, 4,335 missing engine, 5,104 missing transmission.
- AutoScout24 latest warnings: shard saturation on `718-all`, `cayenne-all`, `macan-low`, `macan-mid`.
- VIN enrichment health artifact: 18 recent runs, 9,000 discovered, 0 written in the 3-day audit window.

## File Map

- Modify: `scripts/autotrader-delist-check.ts`
  Add conservative delist safeguards so a single run cannot zero UK coverage without a second signal.
- Modify: `scripts/autotrader-enrich.ts` or the AutoTrader status write path found during Task 1
  Ensure newly discovered AutoTrader rows remain `active` until verified dead by the guarded delist flow.
- Test: `tests/integration/autotrader-delist-guard.test.ts`
  Regression test for avoiding mass delist when all checked rows appear dead.
- Modify: `scripts/bat-detail-scraper.ts` and the BaT detail writer it calls
  Truncate or remap overlong varchar fields before DB writes.
- Test: `tests/integration/bat-detail-writer.test.ts`
  Regression test for the overlong value seen in `scraper_runs`.
- Modify: `src/app/api/cron/enrich-beforward/route.ts`, `scripts/bf-enrich-cli.ts`, and BeForward Scrapling helper scripts if needed
  Route WAF-blocked detail enrichment to the already-working Scrapling/GitHub Actions path or skip with an explicit retry state.
- Test: `src/app/api/cron/enrich-beforward/route.test.ts`
  Regression test that WAF blocks mark the run degraded/queued instead of failed-red loops.
- Modify: `scripts/classic-enrich-scrapling.ts`, `scripts/classic_scrapling_fetch.py`, and Classic normalization files under `src/features/scrapers/`
  Raise price/spec extraction for active ClassicCom rows and classify non-Porsche noise as skips.
- Test: `tests/scrapers/classic-data-quality-regression.test.ts`
  Fixture-backed checks for price, engine, transmission, and non-Porsche skip behavior.
- Modify: `src/features/scrapers/autoscout24_collector/shards.ts`, `src/features/scrapers/autoscout24_collector/discover.ts`, `scripts/scraper-health-audit.ts`
  Split saturated shards and make saturation a health warning until resolved.
- Test: `src/features/scrapers/autoscout24_collector/shards.test.ts` and `scripts/run-scrapers.test.ts`
  Verify shard partitioning and warning propagation.
- Modify: `src/app/api/cron/enrich-vin/route.ts` and `scripts/enrich-from-vin.ts`
  Add exhausted-candidate classification and a useful zero-write reason.
- Test: `src/app/api/cron/enrich-vin/route.test.ts`
  Verify zero-write is classified as exhausted, blocked, or broken.
- Modify: `scripts/scraper-health-audit.ts`, `src/app/api/admin/data-quality/overview/route.ts`, and dashboard types if needed
  Add coverage gates: UK active = 0, source active = 0 after writes, Classic price/spec below threshold, BeForward WAF failure rate, BaT schema error recurrence.
- Test: `src/app/api/admin/data-quality/overview/route.test.ts`, `src/app/api/admin/scrapers/live/route.test.ts`, `tests/quality/data-quality.test.ts`
  Verify health reports reflect DB coverage, not only cron exit status.

## Stage 0: Create A Repeatable Coverage Audit

### Task 0.1: Add A Coverage Snapshot Script

**Files:**
- Create: `scripts/coverage-snapshot.ts`
- Test: `tests/integration/coverage-snapshot.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { summarizeCoverageRows } from "../../scripts/coverage-snapshot";

describe("summarizeCoverageRows", () => {
  it("flags a market with zero active rows even when rows exist historically", () => {
    const result = summarizeCoverageRows([
      { source: "AutoTrader", market: "UK", active: 0, total: 4687, pricedPct: null, imagePct: null },
      { source: "AutoScout24", market: "EU", active: 6830, total: 32388, pricedPct: 100, imagePct: 99.4 },
    ]);

    expect(result.marketAlerts).toContainEqual({
      market: "UK",
      severity: "critical",
      message: "UK has historical rows but zero active coverage",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/coverage-snapshot.test.ts`

Expected: FAIL because `scripts/coverage-snapshot.ts` does not exist.

- [ ] **Step 3: Implement the script with exportable pure logic**

Create `scripts/coverage-snapshot.ts` with a `summarizeCoverageRows(rows)` function and a CLI path that loads `.env.local`, queries `listings`, and writes `agents/testscripts/artifacts/coverage-snapshot-<timestamp>.json`.

The SQL must group by source and canonical market using the same mapping as `src/lib/pricing/canonicalMarket.ts`.

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run tests/integration/coverage-snapshot.test.ts`

Expected: PASS.

- [ ] **Step 5: Generate the first artifact**

Run: `npx tsx scripts/coverage-snapshot.ts`

Expected: JSON artifact containing active counts, total counts, price/image/VIN/engine/transmission completeness, freshness, and market alerts.

## Stage 1: Restore UK Coverage And Stop Unsafe AutoTrader Delists

### Task 1.1: Guard The AutoTrader Delist Check

**Files:**
- Modify: `scripts/autotrader-delist-check.ts`
- Test: `tests/integration/autotrader-delist-guard.test.ts`

- [ ] **Step 1: Write failing regression tests**

Add tests for:

```ts
expect(shouldApplyDelistBatch({ checked: 213, live: 0, delisted: 213, errors: 0, sourceActiveBefore: 213 })).toEqual({
  apply: false,
  reason: "mass-delist-guard",
});

expect(shouldApplyDelistBatch({ checked: 20, live: 17, delisted: 3, errors: 0, sourceActiveBefore: 213 })).toEqual({
  apply: true,
  reason: "normal",
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/autotrader-delist-guard.test.ts`

Expected: FAIL because the guard function is missing.

- [ ] **Step 3: Add the guard**

In `scripts/autotrader-delist-check.ts`, export `shouldApplyDelistBatch(input)` and refuse to apply delists when:

- checked rows >= 50;
- live rows = 0;
- delisted rows / checked rows >= 0.9;
- source had active rows before the run.

When refused, write a `scraper_runs` row with `success: false`, `errors_count: 1`, and error message `mass-delist-guard`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/integration/autotrader-delist-guard.test.ts`

Expected: PASS.

### Task 1.2: Rehydrate Recent AutoTrader Active Rows

**Files:**
- Create: `scripts/restore-autotrader-active-guarded.ts`

- [ ] **Step 1: Add a dry-run restore command**

Create a script that selects AutoTrader rows inserted or updated in the last 7 days and currently `delisted`, prints counts, and requires `--apply` before writing.

- [ ] **Step 2: Dry-run restore**

Run: `npx tsx scripts/restore-autotrader-active-guarded.ts --days=7`

Expected: prints candidate count and sample URLs without DB writes.

- [ ] **Step 3: Apply only after candidate sample is sane**

Run: `npx tsx scripts/restore-autotrader-active-guarded.ts --days=7 --apply`

Expected: UK active count becomes nonzero.

- [ ] **Step 4: Validate coverage**

Run: `npx tsx scripts/coverage-snapshot.ts`

Expected: UK market no longer has zero active coverage, or the artifact clearly states remaining blocker.

## Stage 2: Fix BaT Detail Schema Failures

### Task 2.1: Reproduce And Patch Overlong Field Mapping

**Files:**
- Modify: `scripts/bat-detail-scraper.ts`
- Modify: BaT detail DB writer module found by tracing imports from `scripts/bat-detail-scraper.ts`
- Test: `tests/integration/bat-detail-writer.test.ts`

- [ ] **Step 1: Write a failing writer test**

Use a row fixture where a varchar-limited field receives a string longer than 100 characters. The expected behavior is successful normalization with a truncated or relocated value, not a DB-write exception.

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/integration/bat-detail-writer.test.ts`

Expected: FAIL with current unchecked string behavior.

- [ ] **Step 3: Implement a field-length boundary**

Add a local helper such as:

```ts
export function truncateDbVarchar(value: string | null | undefined, max = 100): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}
```

Apply it only to columns known from `information_schema` to be `character varying(100)`.

- [ ] **Step 4: Validate**

Run:

```bash
npx vitest run tests/integration/bat-detail-writer.test.ts
npx tsx scripts/bat-detail-scraper.ts --limit=5
```

Expected: test passes and no `value too long for type character varying(100)` appears in the new run log.

## Stage 3: Stop BeForward Enrichment WAF Failure Loops

### Task 3.1: Classify WAF Blocks As Queueable, Not Repeated Failures

**Files:**
- Modify: `src/app/api/cron/enrich-beforward/route.ts`
- Modify: `scripts/bf-enrich-cli.ts`
- Test: `src/app/api/cron/enrich-beforward/route.test.ts`

- [ ] **Step 1: Write failing tests**

Add a test where 50/50 detail fetches return WAF challenge. Expected response:

```ts
{
  success: true,
  degraded: true,
  written: 0,
  queuedForScrapling: 50,
  errors: []
}
```

The corresponding `scraper_runs` row should have `errors_count = 0` and an error/warning message that is informational, not a hard failure.

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/app/api/cron/enrich-beforward/route.test.ts`

Expected: FAIL with current failed-run behavior.

- [ ] **Step 3: Implement queue/degraded classification**

Detect WAF challenge strings and store retry metadata in `enrichment_meta->beforward` or `scraper_state`, using a compact state:

```json
{ "detailStatus": "queued_scrapling", "reason": "waf_challenge", "queuedAt": "<iso>" }
```

- [ ] **Step 4: Validate**

Run:

```bash
npx vitest run src/app/api/cron/enrich-beforward/route.test.ts
npx tsx scripts/scraper-health-audit.ts --days=3
```

Expected: BeForward enrichment no longer appears as a hard failure loop when the work is queued or skipped intentionally.

## Stage 4: Raise ClassicCom Useful Coverage

### Task 4.1: Fix Classic Price And Spec Extraction

**Files:**
- Modify: `scripts/classic-enrich-scrapling.ts`
- Modify: `scripts/classic_scrapling_fetch.py`
- Modify: Classic normalization module under `src/features/scrapers/`
- Test: `tests/scrapers/classic-data-quality-regression.test.ts`

- [ ] **Step 1: Add fixture-backed tests**

Use existing Classic fixture pages under `tests/fixtures/` and add assertions that Porsche rows extract:

- listing price when visible;
- engine;
- transmission;
- VIN;
- photos.

Also assert non-Porsche rows return a skip classification instead of an error.

- [ ] **Step 2: Run the tests**

Run: `npx vitest run tests/scrapers/classic-data-quality-regression.test.ts`

Expected: FAIL on current missing price/spec cases.

- [ ] **Step 3: Patch normalization locally**

Prefer parser changes inside the Classic feature/normalizer rather than dashboard-side fixes. Store unavailable values as explicit `null`; do not invent values.

- [ ] **Step 4: Validate DB improvement**

Run:

```bash
npx vitest run tests/scrapers/classic-data-quality-regression.test.ts
npx tsx scripts/classic-enrich-scrapling.ts --limit=100
npx tsx scripts/coverage-snapshot.ts
```

Expected: ClassicCom active missing price/spec counts decrease from the baseline.

## Stage 5: Reduce AutoScout24 Shard Saturation

### Task 5.1: Split Saturated Shards And Gate Health

**Files:**
- Modify: `src/features/scrapers/autoscout24_collector/shards.ts`
- Modify: `src/features/scrapers/autoscout24_collector/discover.ts`
- Modify: `scripts/scraper-health-audit.ts`
- Test: `src/features/scrapers/autoscout24_collector/shards.test.ts`

- [ ] **Step 1: Add shard tests**

Assert that saturated families split by narrower model/year/price buckets for `718`, `cayenne`, and `macan`.

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/features/scrapers/autoscout24_collector/shards.test.ts`

Expected: FAIL until new shard definitions exist.

- [ ] **Step 3: Implement narrower shards**

Add shard partitions that keep each query under the 20-page limit. Preserve existing source IDs and dedupe behavior.

- [ ] **Step 4: Add health warning persistence**

In `scripts/scraper-health-audit.ts`, keep AutoScout24 `degraded` when shard saturation appears in latest run messages, even if writes succeed.

- [ ] **Step 5: Validate**

Run:

```bash
npx vitest run src/features/scrapers/autoscout24_collector/shards.test.ts
npx tsx scripts/scraper-health-audit.ts --days=3
```

Expected: saturation warnings are visible until discovery no longer hits page limits.

## Stage 6: Make VIN Zero-Write Actionable

### Task 6.1: Classify Zero Writes

**Files:**
- Modify: `src/app/api/cron/enrich-vin/route.ts`
- Modify: `scripts/enrich-from-vin.ts`
- Test: `src/app/api/cron/enrich-vin/route.test.ts`

- [ ] **Step 1: Add tests for zero-write reasons**

Cover three cases:

- no candidates left: status `exhausted`;
- candidates exist but decoder returns no data: status `blocked`;
- decoder/database error: status `failed`.

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/app/api/cron/enrich-vin/route.test.ts`

Expected: FAIL because zero-write reason is not explicit.

- [ ] **Step 3: Implement reason reporting**

Return and log:

```json
{ "success": true, "written": 0, "zeroWriteReason": "exhausted|blocked|failed" }
```

Record this in `scraper_runs.error_messages` as a compact diagnostic only when it is not `exhausted`.

- [ ] **Step 4: Validate**

Run:

```bash
npx vitest run src/app/api/cron/enrich-vin/route.test.ts
npx tsx scripts/scraper-health-audit.ts --days=3
```

Expected: VIN enrichment no longer produces an ambiguous zero-write alert.

## Stage 7: Upgrade Health Reporting To Coverage-Truth

### Task 7.1: Add Coverage Gates To Health Audit

**Files:**
- Modify: `scripts/scraper-health-audit.ts`
- Modify: `src/features/scrapers/common/monitoring/audit.ts`
- Test: monitoring audit tests under `src/features/scrapers/common/monitoring/`

- [ ] **Step 1: Add coverage-gate tests**

Add tests for:

- source has recent writes but zero active rows;
- UK market active count is zero;
- ClassicCom price coverage below 50%;
- BeForward WAF failure rate above 25%;
- BaT detail has recurring schema error.

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/features/scrapers/common/monitoring`

Expected: FAIL until gates exist.

- [ ] **Step 3: Implement gates**

Pull summary data from `v_source_ingestion` and the new coverage snapshot query. Mark status:

- `failed` for zero active coverage in a scheduled/live source;
- `degraded` for low field coverage;
- `degraded` for recurring schema errors;
- `working` only when both runs and DB coverage are healthy.

- [ ] **Step 4: Validate**

Run:

```bash
npx vitest run src/features/scrapers/common/monitoring
npx tsx scripts/scraper-health-audit.ts --days=3
npx tsx scripts/coverage-snapshot.ts
```

Expected: audit output tells the same story as DB coverage.

## Stage 8: Final End-To-End Verification

### Task 8.1: Run The Full Scraper Audit Loop

**Files:**
- No code changes unless earlier validation exposes a bug.

- [ ] **Step 1: Run focused unit/integration tests**

Run:

```bash
npx vitest run tests/integration/autotrader-delist-guard.test.ts tests/integration/bat-detail-writer.test.ts src/app/api/cron/enrich-beforward/route.test.ts src/app/api/cron/enrich-vin/route.test.ts src/features/scrapers/autoscout24_collector/shards.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run health and coverage scripts**

Run:

```bash
npx tsx scripts/coverage-snapshot.ts
npx tsx scripts/scraper-health-audit.ts --days=3
```

Expected: artifacts show nonzero UK active coverage, no BaT varchar recurrence, BeForward WAF is queued/degraded rather than failed-looping, ClassicCom coverage metrics improve or remain explicitly degraded.

- [ ] **Step 3: Run full scraper runner only after focused checks pass**

Run:

```bash
npx tsx scripts/run-scrapers.ts --full
```

Expected: the runner completes without BaT timeout/schema failure and without AutoTrader mass-delisting all active UK rows.

- [ ] **Step 4: Commit by stage**

Commit after each successful stage with messages:

```bash
git commit -m "test: add scraper coverage snapshot"
git commit -m "fix: guard autotrader mass delists"
git commit -m "fix: harden bat detail writes"
git commit -m "fix: classify beforward waf enrichment"
git commit -m "fix: improve classic listing extraction"
git commit -m "fix: split saturated autoscout24 shards"
git commit -m "fix: classify vin enrichment zero writes"
git commit -m "feat: gate scraper health by db coverage"
```

## Execution Order

Execute in this order:

1. Stage 0 gives every later fix a scoreboard.
2. Stage 1 restores the missing UK market and prevents repeat damage.
3. Stage 2 removes the concrete BaT schema error.
4. Stage 3 stops BeForward failure loops.
5. Stage 4 improves the largest low-quality corpus.
6. Stage 5 makes AutoScout24 high-volume discovery safer.
7. Stage 6 removes ambiguous VIN noise.
8. Stage 7 makes monitoring tell the truth.
9. Stage 8 proves the whole system.

## Pass/Fail Criteria

Pass when:

- UK active coverage is nonzero or explicitly blocked by a verified external marketplace condition.
- No scraper can mass-delist a whole active source from one all-dead check.
- BaT detail runs no longer emit `value too long for type character varying(100)`.
- BeForward WAF blocks are queued/degraded with useful state, not repeated hard failures.
- ClassicCom price/spec coverage improves from baseline or remains visibly degraded in health.
- AutoScout24 shard saturation is either gone or visible as a degraded warning.
- VIN enrichment zero-write state is classified.
- `scraper-health-audit` and `coverage-snapshot` agree with actual `listings` coverage.

Fail when:

- A cron says `WORKING` while its source has zero active rows.
- A recent write path is followed by a cleanup/delist path that removes all active rows without a guard.
- Error strings recur in `scraper_runs` without a regression test.
- Data-quality gaps remain invisible in the operator-facing audit.
