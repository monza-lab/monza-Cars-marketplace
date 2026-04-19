# Scraper Reliability Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore scraper reliability so every scheduled collector and enrichment job either writes useful data or fails loudly with actionable diagnostics, and add a repeatable audit path for verifying cron health against Supabase.

**Architecture:** Keep the current monolith and route-per-job design. Fix the broken jobs in place, add lightweight monitoring helpers around the existing `scraper_runs` table, and harden the timeout-prone routes by batching queries and making schema usage explicit rather than inferred at runtime.

**Tech Stack:** Next.js route handlers, Supabase JS, Vitest, TypeScript, Postgres RPC/querying

**Plan Budget:** `{files: 14 modified + 3 new, LOC/file: <= 250 target, deps: 0}`

**Worktree:** Execute this plan in a dedicated git worktree before touching implementation files.

---

## File Structure

### Existing files to modify

- `src/app/api/cron/porsche/route.ts`
  Purpose: Porsche collector cron orchestration and run recording.
- `src/app/api/cron/autotrader/route.ts`
  Purpose: AutoTrader collector cron orchestration and run recording.
- `src/app/api/cron/enrich-autotrader/route.ts`
  Purpose: AutoTrader detail enrichment cron.
- `src/app/api/cron/enrich-beforward/route.ts`
  Purpose: BeForward detail enrichment cron.
- `src/app/api/cron/backfill-images/route.ts`
  Purpose: Cross-source image backfill cron wrapper.
- `src/app/api/cron/enrich-vin/route.ts`
  Purpose: VIN enrichment cron.
- `src/app/api/cron/enrich-titles/route.ts`
  Purpose: Title enrichment cron.
- `src/app/api/cron/validate/route.ts`
  Purpose: Listing validator cron.
- `src/app/api/cron/enrich-elferspot/route.ts`
  Purpose: Elferspot enrichment cron.
- `src/features/scrapers/common/backfillImages.ts`
  Purpose: Shared backfill helper currently using a broken array filter.
- `src/features/scrapers/autotrader_collector/collector.ts`
  Purpose: AutoTrader collector core pipeline.
- `src/features/scrapers/autotrader_collector/supabase_writer.ts`
  Purpose: AutoTrader persistence path.
- `src/features/scrapers/porsche_collector/collector.ts`
  Purpose: Porsche collector aggregation and source error handling.
- `src/features/scrapers/common/monitoring/queries.ts`
  Purpose: Existing scraper dashboard queries.
- `docs/scrapers/SCRAPERS.md`
  Purpose: Human-facing scraper operations documentation.

### Existing tests to modify

- `src/app/api/cron/enrich-beforward/route.test.ts`
- `src/app/api/cron/enrich-autotrader/route.test.ts`
- `src/app/api/cron/backfill-images/route.test.ts`
- `src/app/api/cron/enrich-vin/route.test.ts`
- `src/app/api/cron/validate/route.test.ts`
- `src/app/api/cron/porsche/route.test.ts`
- `src/features/scrapers/autotrader_collector/collector.test.ts`

### New files to create

- `src/features/scrapers/common/monitoring/expectedRuns.ts`
  Purpose: Central expected schedule/runtime metadata for every monitored job.
- `src/features/scrapers/common/monitoring/expectedRuns.test.ts`
  Purpose: Guards the expected-run map against drift.
- `scripts/scraper-health-report.ts`
  Purpose: CLI audit script that compares expected schedules to `scraper_runs` and highlights missed runs, zero-write greens, and error spikes.

---

### Task 1: Lock In the Monitoring Contract

**Files:**
- Create: `src/features/scrapers/common/monitoring/expectedRuns.ts`
- Create: `src/features/scrapers/common/monitoring/expectedRuns.test.ts`
- Modify: `src/features/scrapers/common/monitoring/queries.ts`
- Test: `src/features/scrapers/common/monitoring/expectedRuns.test.ts`

- [ ] **Step 1: Write the failing test for expected scraper coverage**

```ts
import { describe, expect, it } from "vitest";
import { EXPECTED_SCRAPER_RUNS } from "./expectedRuns";

describe("EXPECTED_SCRAPER_RUNS", () => {
  it("contains every production scraper job we monitor in Supabase", () => {
    expect(Object.keys(EXPECTED_SCRAPER_RUNS).sort()).toEqual([
      "autoscout24",
      "autotrader",
      "backfill-images",
      "bat-detail",
      "beforward",
      "classic",
      "cleanup",
      "elferspot",
      "enrich-autotrader",
      "enrich-beforward",
      "enrich-details",
      "enrich-details-bulk",
      "enrich-elferspot",
      "enrich-titles",
      "enrich-vin",
      "ferrari",
      "liveness-check",
      "porsche",
      "validate",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/features/scrapers/common/monitoring/expectedRuns.test.ts`

Expected: FAIL because `expectedRuns.ts` does not exist yet.

- [ ] **Step 3: Add the expected-run map**

```ts
export type ExpectedRun = {
  runtime: "vercel_cron" | "github_actions" | "cli";
  scheduleUtc: string;
  requiredDaily: boolean;
  zeroWriteAllowed: boolean;
};

export const EXPECTED_SCRAPER_RUNS: Record<string, ExpectedRun> = {
  ferrari: { runtime: "vercel_cron", scheduleUtc: "0 0 * * *", requiredDaily: true, zeroWriteAllowed: false },
  porsche: { runtime: "vercel_cron", scheduleUtc: "0 1 * * *", requiredDaily: true, zeroWriteAllowed: false },
  autotrader: { runtime: "vercel_cron", scheduleUtc: "0 2 * * *", requiredDaily: true, zeroWriteAllowed: false },
  beforward: { runtime: "vercel_cron", scheduleUtc: "0 3 * * *", requiredDaily: true, zeroWriteAllowed: false },
  classic: { runtime: "github_actions", scheduleUtc: "0 4 * * *", requiredDaily: true, zeroWriteAllowed: false },
  autoscout24: { runtime: "github_actions", scheduleUtc: "0 5 * * *", requiredDaily: true, zeroWriteAllowed: false },
  validate: { runtime: "vercel_cron", scheduleUtc: "30 5 * * *", requiredDaily: true, zeroWriteAllowed: true },
  cleanup: { runtime: "vercel_cron", scheduleUtc: "0 6 * * *", requiredDaily: true, zeroWriteAllowed: false },
  "backfill-images": { runtime: "vercel_cron", scheduleUtc: "30 6 * * *", requiredDaily: true, zeroWriteAllowed: false },
  "enrich-vin": { runtime: "vercel_cron", scheduleUtc: "0 7 * * *", requiredDaily: true, zeroWriteAllowed: true },
  "enrich-titles": { runtime: "vercel_cron", scheduleUtc: "15 7 * * *", requiredDaily: true, zeroWriteAllowed: true },
  "enrich-details": { runtime: "vercel_cron", scheduleUtc: "30 7 * * *", requiredDaily: true, zeroWriteAllowed: true },
  "enrich-autotrader": { runtime: "vercel_cron", scheduleUtc: "45 7 * * *", requiredDaily: true, zeroWriteAllowed: false },
  "enrich-beforward": { runtime: "vercel_cron", scheduleUtc: "0 8 * * *", requiredDaily: true, zeroWriteAllowed: false },
  elferspot: { runtime: "vercel_cron", scheduleUtc: "15 9 * * *", requiredDaily: true, zeroWriteAllowed: false },
  "enrich-elferspot": { runtime: "vercel_cron", scheduleUtc: "45 9 * * *", requiredDaily: true, zeroWriteAllowed: true },
  "bat-detail": { runtime: "github_actions", scheduleUtc: "30 1 * * *", requiredDaily: true, zeroWriteAllowed: false },
  "enrich-details-bulk": { runtime: "github_actions", scheduleUtc: "manual-or-gha-batch", requiredDaily: false, zeroWriteAllowed: true },
  "liveness-check": { runtime: "cli", scheduleUtc: "30 10 * * *", requiredDaily: false, zeroWriteAllowed: true },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run src/features/scrapers/common/monitoring/expectedRuns.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/common/monitoring/expectedRuns.ts src/features/scrapers/common/monitoring/expectedRuns.test.ts
git commit -m "test: define expected scraper schedules"
```

### Task 2: Add a Repeatable Supabase Health Audit Script

**Files:**
- Create: `scripts/scraper-health-report.ts`
- Modify: `src/features/scrapers/common/monitoring/queries.ts`
- Test: `src/features/scrapers/common/monitoring/expectedRuns.test.ts`

- [ ] **Step 1: Add the failing script scaffold**

```ts
import { EXPECTED_SCRAPER_RUNS } from "@/features/scrapers/common/monitoring/expectedRuns";

async function main() {
  console.log("not implemented");
  process.exitCode = 1;
}

void main();
```

- [ ] **Step 2: Run the script to verify the placeholder fails the workflow**

Run: `npx tsx scripts/scraper-health-report.ts`

Expected: exits non-zero with `not implemented`

- [ ] **Step 3: Replace the scaffold with a real audit**

```ts
import { createClient } from "@supabase/supabase-js";
import { EXPECTED_SCRAPER_RUNS } from "@/features/scrapers/common/monitoring/expectedRuns";

type RunRow = {
  scraper_name: string;
  finished_at: string;
  success: boolean;
  discovered: number;
  written: number;
  errors_count: number;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client
    .from("scraper_runs")
    .select("scraper_name, finished_at, success, discovered, written, errors_count")
    .gte("finished_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("finished_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RunRow[];
  const grouped = new Map<string, RunRow[]>();

  for (const row of rows) {
    const bucket = grouped.get(row.scraper_name) ?? [];
    bucket.push(row);
    grouped.set(row.scraper_name, bucket);
  }

  for (const [scraperName, expected] of Object.entries(EXPECTED_SCRAPER_RUNS)) {
    const runs = grouped.get(scraperName) ?? [];
    const latest = runs[0];
    const zeroWriteGreens = runs.filter((r) => r.success && r.written === 0);
    const red = !latest || (expected.requiredDaily && runs.length === 0);

    console.log(JSON.stringify({
      scraperName,
      runtime: expected.runtime,
      latestFinishedAt: latest?.finished_at ?? null,
      latestSuccess: latest?.success ?? null,
      runs7d: runs.length,
      zeroWriteGreens7d: zeroWriteGreens.length,
      latestDiscovered: latest?.discovered ?? null,
      latestWritten: latest?.written ?? null,
      latestErrors: latest?.errors_count ?? null,
      status: red ? "missing" : zeroWriteGreens.length > 0 && !expected.zeroWriteAllowed ? "degraded" : "ok",
    }));
  }
}

void main();
```

- [ ] **Step 4: Run the audit script**

Run: `set -a; source .env.local; set +a; npx tsx scripts/scraper-health-report.ts`

Expected: prints one JSON line per scraper, with `degraded` for at least `porsche`, `autotrader`, `enrich-autotrader`, `enrich-beforward`, and `backfill-images` before fixes.

- [ ] **Step 5: Commit**

```bash
git add scripts/scraper-health-report.ts src/features/scrapers/common/monitoring/queries.ts
git commit -m "feat: add scraper health audit script"
```

### Task 3: Fix `enrich-beforward` Schema Usage and False Success

**Files:**
- Modify: `src/app/api/cron/enrich-beforward/route.ts`
- Modify: `src/app/api/cron/enrich-beforward/route.test.ts`
- Test: `src/app/api/cron/enrich-beforward/route.test.ts`

- [ ] **Step 1: Write the failing regression test for the `fuel_type` schema mismatch**

```ts
it("records a failed run when listing updates target missing columns", async () => {
  mockSelectRows([{ id: "row-1", source_url: "https://example.com/car" }]);
  mockDetailParse({
    trim: "Carrera",
    engine: "3.6L Flat-6",
    transmission: "Manual",
    exteriorColor: "Silver",
    fuel: "Gasoline",
  });
  mockUpdateError("Could not find the 'fuel_type' column of 'listings' in the schema cache");

  const response = await GET(makeAuthorizedRequest());
  const body = await response.json();

  expect(body.success).toBe(false);
  expect(recordScraperRun).toHaveBeenCalledWith(
    expect.objectContaining({
      scraper_name: "enrich-beforward",
      success: false,
      written: 0,
    }),
  );
});
```

- [ ] **Step 2: Run the route test to verify it fails**

Run: `npm test -- --run src/app/api/cron/enrich-beforward/route.test.ts`

Expected: FAIL because the route currently reports `success: true` and writes to `fuel_type`.

- [ ] **Step 3: Replace schema-unsafe updates with schema-safe fields and honest run status**

```ts
const update: Record<string, unknown> = {
  updated_at: new Date().toISOString(),
};

if (detail.trim) update.trim = detail.trim;
if (detail.engine) update.engine = detail.engine;
if (detail.transmission) update.transmission = detail.transmission;
if (detail.exteriorColor) update.color_exterior = detail.exteriorColor;
if (detail.vin) update.vin = detail.vin;

const attemptedFieldCount = Object.keys(update).length - 1;

if (attemptedFieldCount === 0) {
  continue;
}

const { error: updateErr } = await client
  .from("listings")
  .update(update)
  .eq("id", row.id);

if (updateErr) {
  errors.push(`Update failed (${row.id}): ${updateErr.message}`);
  continue;
}

enriched++;
```

- [ ] **Step 4: Make “green with zero writes and many errors” impossible**

```ts
const hardFailure = enriched === 0 && errors.some((msg) => msg.includes("schema cache"));

await recordScraperRun({
  scraper_name: "enrich-beforward",
  run_id: runId,
  started_at: startedAtIso,
  finished_at: new Date().toISOString(),
  success: !hardFailure,
  runtime: "vercel_cron",
  duration_ms: Date.now() - startTime,
  discovered,
  written: enriched,
  errors_count: errors.length,
  error_messages: errors.length > 0 ? errors : undefined,
});

if (hardFailure) {
  return NextResponse.json(
    { success: false, error: "Schema mismatch prevented BeForward enrichment", errors },
    { status: 500 },
  );
}
```

- [ ] **Step 5: Run the route test to verify it passes**

Run: `npm test -- --run src/app/api/cron/enrich-beforward/route.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/enrich-beforward/route.ts src/app/api/cron/enrich-beforward/route.test.ts
git commit -m "fix: make beforward enrichment schema-safe"
```

### Task 4: Fix the Broken Empty-Images Query in Shared Backfill

**Files:**
- Modify: `src/features/scrapers/common/backfillImages.ts`
- Modify: `src/app/api/cron/backfill-images/route.test.ts`
- Test: `src/app/api/cron/backfill-images/route.test.ts`

- [ ] **Step 1: Write the failing test for the empty-array filter**

```ts
it("queries empty images without using an invalid Postgres array literal", async () => {
  await GET(makeAuthorizedRequest());

  expect(mockListingsQuery.or).toHaveBeenCalledWith(
    "images.is.null,photos_count.eq.0"
  );
});
```

- [ ] **Step 2: Run the route test to verify it fails**

Run: `npm test -- --run src/app/api/cron/backfill-images/route.test.ts`

Expected: FAIL because the helper still uses `images.eq.[]`.

- [ ] **Step 3: Replace the array-literal filter with a stable predicate**

```ts
let query = client
  .from("listings")
  .select("id,source,source_url,photos_count")
  .eq("status", "active")
  .or("images.is.null,photos_count.eq.0");
```

- [ ] **Step 4: Run the route test to verify it passes**

Run: `npm test -- --run src/app/api/cron/backfill-images/route.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/common/backfillImages.ts src/app/api/cron/backfill-images/route.test.ts
git commit -m "fix: use stable empty-image filter in backfill"
```

### Task 5: Make AutoTrader Collector and Enrichment Honest and Useful

**Files:**
- Modify: `src/app/api/cron/autotrader/route.ts`
- Modify: `src/app/api/cron/enrich-autotrader/route.ts`
- Modify: `src/features/scrapers/autotrader_collector/collector.ts`
- Modify: `src/features/scrapers/autotrader_collector/supabase_writer.ts`
- Modify: `src/app/api/cron/enrich-autotrader/route.test.ts`
- Modify: `src/features/scrapers/autotrader_collector/collector.test.ts`
- Test: `src/app/api/cron/enrich-autotrader/route.test.ts`
- Test: `src/features/scrapers/autotrader_collector/collector.test.ts`

- [ ] **Step 1: Write the failing enrichment test for zero-write no-op runs**

```ts
it("fails the run when 100 candidates produce zero enriched rows", async () => {
  mockSelectRows(new Array(100).fill(null).map((_, i) => ({
    id: `row-${i}`,
    source_url: `https://example.com/${i}`,
  })));
  mockAutoTraderDetail({ engine: null, transmission: null, mileage: null, vin: null, description: null });

  const response = await GET(makeAuthorizedRequest());
  const body = await response.json();

  expect(body.success).toBe(false);
  expect(recordScraperRun).toHaveBeenCalledWith(
    expect.objectContaining({ success: false, written: 0 }),
  );
});
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `npm test -- --run src/app/api/cron/enrich-autotrader/route.test.ts src/features/scrapers/autotrader_collector/collector.test.ts`

Expected: FAIL because zero-write runs currently return success.

- [ ] **Step 3: Remove sentinel empty-string writes and fail zero-yield enrichments**

```ts
if (newFieldCount === 0) {
  continue;
}

const hardFailure = discovered > 0 && enriched === 0 && errors.length === 0;

await recordScraperRun({
  scraper_name: "enrich-autotrader",
  run_id: runId,
  started_at: startedAtIso,
  finished_at: new Date().toISOString(),
  success: !hardFailure,
  runtime: "vercel_cron",
  duration_ms: Date.now() - startTime,
  discovered,
  written: enriched,
  errors_count: errors.length,
  error_messages: hardFailure
    ? ["No AutoTrader rows were enriched; inspect selection query and detail parser"]
    : (errors.length > 0 ? errors : undefined),
});
```

- [ ] **Step 4: Make the collector surface source-level zero-yield anomalies**

```ts
if (config.mode === "daily" && counts.discovered > 0 && counts.written === 0) {
  throw new Error(`AutoTrader collector discovered ${counts.discovered} listings but wrote none`);
}
```

- [ ] **Step 5: Update the cron route to propagate collector anomalies**

```ts
const hardFailure =
  totalDiscovered > 0 &&
  totalWritten === 0 &&
  result.errors.length === 0;

await recordScraperRun({
  scraper_name: "autotrader",
  run_id: result.runId,
  started_at: startedAtIso,
  finished_at: new Date().toISOString(),
  success: !hardFailure,
  runtime: "vercel_cron",
  duration_ms: Date.now() - startTime,
  discovered: totalDiscovered,
  written: totalWritten,
  errors_count: result.errors.length + (hardFailure ? 1 : 0),
  refresh_checked: refreshResult.checked,
  refresh_updated: refreshResult.updated,
  source_counts: result.sourceCounts,
  error_messages: hardFailure
    ? ["AutoTrader collector produced zero writes"]
    : (result.errors.length > 0 ? result.errors : undefined),
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- --run src/app/api/cron/enrich-autotrader/route.test.ts src/features/scrapers/autotrader_collector/collector.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/cron/autotrader/route.ts src/app/api/cron/enrich-autotrader/route.ts src/features/scrapers/autotrader_collector/collector.ts src/features/scrapers/autotrader_collector/supabase_writer.ts src/app/api/cron/enrich-autotrader/route.test.ts src/features/scrapers/autotrader_collector/collector.test.ts
git commit -m "fix: fail autotrader jobs when they produce no useful output"
```

### Task 6: Reclassify Porsche Collector Partial Success as Degraded Failure

**Files:**
- Modify: `src/app/api/cron/porsche/route.ts`
- Modify: `src/app/api/cron/porsche/route.test.ts`
- Modify: `src/features/scrapers/porsche_collector/collector.ts`
- Test: `src/app/api/cron/porsche/route.test.ts`

- [ ] **Step 1: Write the failing test for blocked secondary sources**

```ts
it("fails the run when non-BaT sources are blocked and total writes stay at zero", async () => {
  mockCollectorResult({
    runId: "run-1",
    sourceCounts: {
      BaT: { discovered: 1000, written: 0 },
      CarsAndBids: { discovered: 0, written: 0 },
      CollectingCars: { discovered: 0, written: 0 },
    },
    errors: [
      "[C&B] Error scraping page 1: HTTP 403",
      "[CC] Error scraping page 1: HTTP 403",
    ],
  });

  const response = await GET(makeAuthorizedRequest());
  const body = await response.json();

  expect(body.success).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/app/api/cron/porsche/route.test.ts`

Expected: FAIL because the route currently records success.

- [ ] **Step 3: Add partial-failure semantics to the route**

```ts
const blockedSources = allErrors.filter((msg) => /\b403\b/.test(msg)).length;
const hardFailure = totalDiscovered > 0 && totalWritten === 0 && blockedSources >= 2;

await recordScraperRun({
  scraper_name: "porsche",
  run_id: result.runId,
  started_at: startedAtIso,
  finished_at: new Date().toISOString(),
  success: !hardFailure,
  runtime: "vercel_cron",
  duration_ms: Date.now() - startTime,
  discovered: totalDiscovered,
  written: totalWritten,
  errors_count: allErrors.length,
  refresh_checked: refreshResult.checked,
  refresh_updated: refreshResult.updated,
  source_counts: result.sourceCounts,
  backfill_discovered: backfillResult?.discovered,
  backfill_written: backfillResult?.written,
  error_messages: allErrors.length > 0 ? allErrors : undefined,
});
```

- [ ] **Step 4: Make the HTTP response match the run status**

```ts
if (hardFailure) {
  return NextResponse.json(
    {
      success: false,
      error: "Porsche collector completed with blocked sources and zero writes",
      sourceCounts: result.sourceCounts,
      errors: allErrors,
    },
    { status: 502 },
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- --run src/app/api/cron/porsche/route.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/porsche/route.ts src/app/api/cron/porsche/route.test.ts src/features/scrapers/porsche_collector/collector.ts
git commit -m "fix: mark porsche cron degraded when sources are blocked"
```

### Task 7: Break the Timeout Regression Into Batches

**Files:**
- Modify: `src/app/api/cron/enrich-vin/route.ts`
- Modify: `src/app/api/cron/enrich-titles/route.ts`
- Modify: `src/app/api/cron/validate/route.ts`
- Modify: `src/app/api/cron/enrich-elferspot/route.ts`
- Modify: `src/app/api/cron/enrich-vin/route.test.ts`
- Modify: `src/app/api/cron/validate/route.test.ts`
- Test: `src/app/api/cron/enrich-vin/route.test.ts`
- Test: `src/app/api/cron/validate/route.test.ts`

- [ ] **Step 1: Write the failing test for paged validation fetches**

```ts
it("fetches recent listings in bounded pages", async () => {
  mockPage(0, new Array(1000).fill(makeListing()));
  mockPage(1000, new Array(200).fill(makeListing()));

  await GET(makeAuthorizedRequest());

  expect(mockRange).toHaveBeenNthCalledWith(1, 0, 999);
  expect(mockRange).toHaveBeenNthCalledWith(2, 1000, 1999);
});
```

- [ ] **Step 2: Run the tests to verify the current routes are too coarse**

Run: `npm test -- --run src/app/api/cron/enrich-vin/route.test.ts src/app/api/cron/validate/route.test.ts`

Expected: FAIL or expose missing assertions for paging/time-budget logic.

- [ ] **Step 3: Reduce selection sizes and add stable ordering**

```ts
const { data: listings, error } = await supabase
  .from("listings")
  .select("id, vin, engine, transmission, body_style")
  .not("vin", "is", null)
  .neq("vin", "")
  .or("engine.is.null,transmission.is.null,body_style.is.null")
  .eq("status", "active")
  .order("updated_at", { ascending: true })
  .limit(500);
```

```ts
const { data: listings, error } = await supabase
  .from("listings")
  .select("id, title, engine, transmission, body_style, trim")
  .or("engine.is.null,transmission.is.null,body_style.is.null,trim.is.null")
  .eq("status", "active")
  .not("title", "is", null)
  .order("updated_at", { ascending: true })
  .limit(1000);
```

- [ ] **Step 4: Add explicit time-budget guards inside the loops**

```ts
const TIME_BUDGET_MS = 90_000;

for (const listing of listings) {
  if (Date.now() - startTime > TIME_BUDGET_MS) {
    errors.push(`Time budget reached after ${written} updates`);
    break;
  }
  // existing update work
}
```

- [ ] **Step 5: Keep validation fetches paged but with a hard stop**

```ts
while (true) {
  if (Date.now() - startTime > 45_000) {
    break;
  }

  const { data, error } = await client
    .from("listings")
    .select("id, make, model, year, title")
    .gte("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw new Error(`Fetch error: ${error.message}`);
  rows.push(...(data as ListingRow[]));
  if ((data?.length ?? 0) < pageSize) break;
  from += pageSize;
}
```

- [ ] **Step 6: Run the tests to verify the routes still pass**

Run: `npm test -- --run src/app/api/cron/enrich-vin/route.test.ts src/app/api/cron/validate/route.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/cron/enrich-vin/route.ts src/app/api/cron/enrich-titles/route.ts src/app/api/cron/validate/route.ts src/app/api/cron/enrich-elferspot/route.ts src/app/api/cron/enrich-vin/route.test.ts src/app/api/cron/validate/route.test.ts
git commit -m "fix: batch timeout-prone enrichment queries"
```

### Task 8: Update the Ops Docs and Verification Loop

**Files:**
- Modify: `docs/scrapers/SCRAPERS.md`
- Modify: `README.md`
- Test: manual verification using Supabase script + route tests

- [ ] **Step 1: Document the new health-check workflow**

```md
## Scraper Health Audit

Run the Supabase-backed audit after cron changes:

```bash
set -a; source .env.local; set +a
npx tsx scripts/scraper-health-report.ts
```

Review:
- missed daily runs
- successful runs with zero writes
- recurring error signatures
```

- [ ] **Step 2: Update the job table to include all monitored jobs**

```md
| Job | Runtime | Expected cadence | Health rule |
| --- | --- | --- | --- |
| enrich-details-bulk | GitHub Actions | ad hoc / batch | Alert if latest batch writes 0 unexpectedly |
| liveness-check | CLI / scheduled runner | daily | Alert on repeated 403 circuit breaks |
```

- [ ] **Step 3: Run the focused verification suite**

Run: `npm test -- --run src/app/api/cron/porsche/route.test.ts src/app/api/cron/enrich-beforward/route.test.ts src/app/api/cron/enrich-autotrader/route.test.ts src/app/api/cron/backfill-images/route.test.ts src/app/api/cron/enrich-vin/route.test.ts src/app/api/cron/validate/route.test.ts src/features/scrapers/autotrader_collector/collector.test.ts src/features/scrapers/common/monitoring/expectedRuns.test.ts`

Expected: PASS

- [ ] **Step 4: Run the live audit against Supabase**

Run: `set -a; source .env.local; set +a; npx tsx scripts/scraper-health-report.ts`

Expected: degraded jobs shrink to genuinely failing jobs only; no false-green zero-write jobs remain.

- [ ] **Step 5: Commit**

```bash
git add docs/scrapers/SCRAPERS.md README.md
git commit -m "docs: add scraper health audit workflow"
```

---

## Verification Checklist

- Run all focused Vitest files listed in Task 8.
- Trigger these cron routes locally with `Authorization: Bearer $CRON_SECRET`:
  - `/api/cron/porsche`
  - `/api/cron/autotrader`
  - `/api/cron/enrich-autotrader`
  - `/api/cron/enrich-beforward`
  - `/api/cron/backfill-images`
  - `/api/cron/enrich-vin`
  - `/api/cron/enrich-titles`
  - `/api/cron/validate`
- After each trigger, verify the corresponding `scraper_runs` record in Supabase has:
  - correct `success`
  - non-misleading `written`
  - actionable `error_messages`
- Run `npx tsx scripts/scraper-health-report.ts` and confirm no unexpected `missing` or `degraded` statuses remain.

## Self-Review

### Spec coverage

- Broken jobs traced: covered by Tasks 3 through 7.
- Cron health overview and repeatable audit: covered by Tasks 1, 2, and 8.
- Docs alignment with current runtime reality: covered by Task 8.

### Placeholder scan

- No `TODO`, `TBD`, or “handle appropriately” placeholders remain.
- Every task contains exact files, commands, and concrete code snippets.

### Type consistency

- Uses the repository’s existing `recordScraperRun`, route-handler, and Vitest patterns.
- Expected schedule metadata uses only existing runtime labels: `vercel_cron`, `github_actions`, `cli`.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-03-scraper-reliability-recovery.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
