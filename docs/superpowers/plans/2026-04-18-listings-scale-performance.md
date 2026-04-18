# Listings Scale Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Monza dashboard and MakePage load in <1s at 18K+ listings by pushing aggregation into Postgres, indexing the hot active-listings subset, and replacing in-memory caches with Next.js 16 `"use cache"` + tag-based cron invalidation.

**Architecture:**
- Denormalize `series` onto `listings` so family filtering and facet counts can be done in SQL directly (brandConfig.ts remains the single source of truth at write time).
- One partial index for active listings + one materialized view that pre-computes every facet count the UI needs, refreshed by scraper crons at the end of each run.
- Swap the N+1 Node-side aggregations (`fetchSeriesCounts`, `fetchLiveListingAggregateCounts`) for single `SELECT` queries against the MV.
- Migrate dashboard data fetching from `unstable_cache` in-memory maps to `"use cache"` + `cacheTag("listings")`, with cron routes calling `revalidateTag` on completion.

**Tech Stack:** Next.js 16 (App Router, `"use cache"`), React 19, Supabase (Postgres 15), TypeScript, Vitest, Supabase migrations.

**Plan Budget:** `{files: ~22 modified + 5 new, LOC/file: <= 250 target, deps: 0 new}`

**Worktree:** Execute this plan in a dedicated git worktree off `UI-UX-5.0` (or current active branch).

---

## File Structure

### New files

- `supabase/migrations/20260419_listings_series_column.sql`
  Add `series` column + backfill + index.
- `supabase/migrations/20260419_listings_active_partial_index.sql`
  Partial composite index on the hot active subset.
- `supabase/migrations/20260419_listings_active_counts_mv.sql`
  Materialized view + concurrent refresh function.
- `scripts/backfill-series-column.ts`
  One-shot Node script that reads rows in batches, computes `extractSeries(...)`, writes back.
- `src/app/api/cache/revalidate-listings/route.ts`
  Cron-triggered tag invalidation endpoint.

### Files to modify

- `src/lib/supabaseLiveListings.ts`
  Rewire `fetchSeriesCounts`, `fetchLiveListingAggregateCounts`, `fetchPaginatedListings`, `fetchLiveListingsAsCollectorCars`. Remove in-memory caches.
- `src/lib/dashboardCache.ts`
  Migrate from `unstable_cache` to `"use cache"` + `cacheLife` / `cacheTag`.
- `src/features/scrapers/porsche_collector/supabase_writer.ts`
- `src/features/scrapers/ferrari_collector/supabase_writer.ts`
- `src/features/scrapers/autoscout24_collector/supabase_writer.ts`
- `src/features/scrapers/autotrader_collector/supabase_writer.ts`
- `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- `src/features/scrapers/classic_collector/supabase_writer.ts`
- `src/features/scrapers/elferspot_collector/supabase_writer.ts`
  Each: set `series` on insert/update + call `revalidateTag("listings")` (via fetch) when writes succeed.
- `src/app/api/cron/cleanup/route.ts`
- `src/app/api/cron/validate/route.ts`
- `src/app/api/cron/porsche/route.ts`
- `src/app/api/cron/ferrari/route.ts`
  Each: invoke `refresh_listings_active_counts()` RPC at the end of the run.

### Tests

- `src/lib/supabaseLiveListings.test.ts` (new) — table-driven tests for the refactored query builders.
- `src/features/scrapers/common/seriesEnrichment.test.ts` (new) — assert the `series` field is set to `extractSeries(...)` output for representative rows.
- `scripts/backfill-series-column.test.ts` (new) — the script's mapper logic.
- `src/lib/dashboardCache.test.ts` — update assertions for tag-based caching.

---

## Phase 1 — Schema foundations

### Task 1: Add `series` column and indexes

**Files:**
- Create: `supabase/migrations/20260419_listings_series_column.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: Add series column for fast family filtering + facet aggregation
-- series is populated by scraper writers using extractSeries() from brandConfig.ts

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS series TEXT;

-- Partial index — most filtering is on active listings only.
CREATE INDEX IF NOT EXISTS listings_active_series_idx
  ON listings (series)
  WHERE status = 'active';

-- Make-scoped lookup for series counts by make.
CREATE INDEX IF NOT EXISTS listings_active_make_series_idx
  ON listings (make, series)
  WHERE status = 'active';

COMMENT ON COLUMN listings.series IS
  'Normalized series id (e.g. "992", "991", "718-cayman"). Populated by scraper writers via extractSeries() from brandConfig.ts. NULL for unclassified rows.';
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` (or use the Supabase MCP `apply_migration` tool).
Expected: migration applied, `\d listings` shows the new column + both indexes.

- [ ] **Step 3: Verify index shape**

Run in SQL editor:
```sql
SELECT indexname, indexdef FROM pg_indexes
 WHERE tablename = 'listings' AND indexname LIKE 'listings_active_%_idx';
```
Expected: two rows matching the names above.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260419_listings_series_column.sql
git commit -m "feat(db): add series column + partial indexes for active listings"
```

---

### Task 2: Partial composite index on `(status, end_time, id)`

**Files:**
- Create: `supabase/migrations/20260419_listings_active_partial_index.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: Partial index on the active-listings subset for fast paginated lookups.
-- Matches the WHERE + ORDER BY used by fetchPaginatedListings:
--   WHERE status = 'active' AND end_time > now()
--   ORDER BY end_time ASC, id DESC

CREATE INDEX IF NOT EXISTS listings_active_endtime_id_idx
  ON listings (end_time ASC NULLS LAST, id DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS listings_active_make_endtime_idx
  ON listings (make, end_time ASC NULLS LAST)
  WHERE status = 'active';
```

- [ ] **Step 2: Apply and verify with EXPLAIN**

Apply migration. Then run in SQL editor:
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, end_time FROM listings
 WHERE status = 'active' AND make = 'Porsche'
 ORDER BY end_time ASC NULLS LAST, id DESC
 LIMIT 50;
```
Expected: plan uses `listings_active_make_endtime_idx` or `listings_active_endtime_id_idx` (no `Seq Scan` on `listings`), execution time < 50ms.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260419_listings_active_partial_index.sql
git commit -m "feat(db): partial index on active listings for paginated queries"
```

---

### Task 3: Materialized view `listings_active_counts`

**Files:**
- Create: `supabase/migrations/20260419_listings_active_counts_mv.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: Materialized view aggregating facet counts for active listings.
-- The dashboard + MakePage need: total, per-series, per-source, per-region.
-- Refreshed by scraper crons and the cleanup cron via
-- refresh_listings_active_counts().

DROP MATERIALIZED VIEW IF EXISTS listings_active_counts CASCADE;

CREATE MATERIALIZED VIEW listings_active_counts AS
SELECT
  lower(make)                AS make,
  coalesce(series, '__null') AS series,
  source,
  CASE
    WHEN upper(country) IN ('USA', 'US', 'UNITED STATES') THEN 'US'
    WHEN upper(country) IN ('UK', 'UNITED KINGDOM')        THEN 'UK'
    WHEN upper(country) = 'JAPAN'                           THEN 'JP'
    WHEN country IS NOT NULL                                THEN 'EU'
    ELSE NULL
  END                        AS region_by_country,
  count(*)                   AS live_count
FROM listings
WHERE status = 'active'
  AND (end_time IS NULL OR end_time > now())
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX listings_active_counts_uniq
  ON listings_active_counts (make, series, source, region_by_country);

CREATE INDEX listings_active_counts_make_idx
  ON listings_active_counts (make);

-- Refresh function: CONCURRENTLY keeps the MV readable during refresh.
-- Safe to call from any cron route as the final step.
CREATE OR REPLACE FUNCTION refresh_listings_active_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY listings_active_counts;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_listings_active_counts() TO service_role, authenticated;
GRANT SELECT ON listings_active_counts TO service_role, authenticated, anon;
```

- [ ] **Step 2: Apply and seed the MV**

Apply migration. Then populate the MV once (it's empty on creation):
```sql
REFRESH MATERIALIZED VIEW listings_active_counts;
```

- [ ] **Step 3: Verify shape and size**

```sql
SELECT make, count(*) AS groups, sum(live_count) AS total_live
  FROM listings_active_counts
 GROUP BY make;
```
Expected: non-zero totals for `porsche` and `ferrari`; `total_live` matches a direct `SELECT count(*) FROM listings WHERE status='active'`.

- [ ] **Step 4: Benchmark**

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT series, sum(live_count) FROM listings_active_counts
 WHERE make = 'porsche' GROUP BY series;
```
Expected: < 5ms, uses `listings_active_counts_make_idx`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260419_listings_active_counts_mv.sql
git commit -m "feat(db): listings_active_counts MV + refresh function"
```

---

## Phase 2 — Populate `series` at write time

### Task 4: Extract a shared "apply series" helper

**Files:**
- Create: `src/features/scrapers/common/seriesEnrichment.ts`
- Create: `src/features/scrapers/common/seriesEnrichment.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/scrapers/common/seriesEnrichment.test.ts
import { describe, it, expect } from "vitest";
import { withSeries } from "./seriesEnrichment";

describe("withSeries", () => {
  it("adds series='992' for a 2023 Porsche 992 Carrera", () => {
    const result = withSeries({
      make: "Porsche",
      model: "992 Carrera",
      year: 2023,
      title: "2023 Porsche 911 Carrera",
    });
    expect(result.series).toBe("992");
  });

  it("preserves null series when extraction cannot resolve", () => {
    const result = withSeries({
      make: "Porsche",
      model: "",
      year: 0,
      title: null,
    });
    expect(result.series).toBeNull();
  });

  it("is pure (does not mutate input)", () => {
    const input = { make: "Porsche", model: "992", year: 2023, title: null };
    const output = withSeries(input);
    expect(output).not.toBe(input);
    expect(input).not.toHaveProperty("series");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/common/seriesEnrichment.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/features/scrapers/common/seriesEnrichment.ts
import { extractSeries, getSeriesConfig } from "@/lib/brandConfig";

export type SeriesInput = {
  make: string;
  model: string | null | undefined;
  year: number | null | undefined;
  title?: string | null;
};

export function computeSeries(input: SeriesInput): string | null {
  const seriesId = extractSeries(
    input.model ?? "",
    input.year ?? 0,
    input.make,
    input.title ?? undefined,
  );
  return getSeriesConfig(seriesId, input.make) ? seriesId : null;
}

export function withSeries<T extends SeriesInput>(row: T): T & { series: string | null } {
  return { ...row, series: computeSeries(row) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/scrapers/common/seriesEnrichment.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/common/seriesEnrichment.ts \
        src/features/scrapers/common/seriesEnrichment.test.ts
git commit -m "feat(scrapers): shared withSeries() helper for write-time enrichment"
```

---

### Task 5: Wire `series` into every supabase writer

**Files:**
- Modify: `src/features/scrapers/porsche_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/ferrari_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/autoscout24_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/autotrader_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/classic_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/elferspot_collector/supabase_writer.ts`

Each writer constructs a row object before calling `supabase.from("listings").upsert(...)`. The edit is the same pattern for each file:

- [ ] **Step 1: Locate the upsert payload in one writer, add `withSeries` at the call site**

Example for `porsche_collector/supabase_writer.ts` — wrap the row before upsert:

```typescript
import { withSeries } from "@/features/scrapers/common/seriesEnrichment";

// ... inside the function that builds the payload:
const payload = withSeries({
  make: normalizedMake,
  model: listing.model,
  year: listing.year,
  title: listing.title,
  // ... existing fields
});

const { error } = await supabase.from("listings").upsert(payload, {
  onConflict: "source_url",
});
```

- [ ] **Step 2: Repeat the same edit for the other six writers**

For each file, ensure `series` is set on every write path (insert AND update). If the writer updates only a subset of columns, include `series` in that subset.

- [ ] **Step 3: Verify with a scraper dry-run**

```bash
npx tsx scripts/debug-scraper.ts porsche --dry-run 2>&1 | grep -E "series|payload" | head -5
```
Expected: logged payloads include a `series` key (e.g. `"992"` or `null`).

- [ ] **Step 4: Commit**

```bash
git add src/features/scrapers
git commit -m "feat(scrapers): populate listings.series on every upsert"
```

---

### Task 6: Backfill `series` for existing rows

**Files:**
- Create: `scripts/backfill-series-column.ts`
- Create: `scripts/backfill-series-column.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/backfill-series-column.test.ts
import { describe, it, expect } from "vitest";
import { mapRowToUpdate } from "./backfill-series-column";

describe("mapRowToUpdate", () => {
  it("returns id + series for resolvable rows", () => {
    expect(
      mapRowToUpdate({
        id: "abc",
        make: "Porsche",
        model: "992 Carrera",
        year: 2023,
        title: null,
      }),
    ).toEqual({ id: "abc", series: "992" });
  });

  it("returns null for unresolvable rows (skipped from update batch)", () => {
    expect(
      mapRowToUpdate({
        id: "abc",
        make: "Porsche",
        model: "",
        year: 0,
        title: null,
      }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/backfill-series-column.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the script**

```typescript
// scripts/backfill-series-column.ts
// One-shot: walks all rows in `listings` via keyset pagination,
// computes series for rows where it is NULL, writes in batches of 500.
//
// Run with: npx tsx scripts/backfill-series-column.ts

import { createClient } from "@supabase/supabase-js";
import { computeSeries } from "../src/features/scrapers/common/seriesEnrichment";

type Row = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  title: string | null;
};

export function mapRowToUpdate(row: Row): { id: string; series: string } | null {
  if (!row.make) return null;
  const series = computeSeries({
    make: row.make,
    model: row.model,
    year: row.year,
    title: row.title,
  });
  return series ? { id: row.id, series } : null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const PAGE = 1000;
  let lastId: string | null = null;
  let totalUpdated = 0;

  while (true) {
    let q = supabase
      .from("listings")
      .select("id, make, model, year, title")
      .is("series", null)
      .order("id", { ascending: true })
      .limit(PAGE);
    if (lastId) q = q.gt("id", lastId);

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;

    const updates = data.map(mapRowToUpdate).filter((u): u is { id: string; series: string } => u !== null);

    // Upsert in chunks of 500 so payloads stay reasonable.
    for (let i = 0; i < updates.length; i += 500) {
      const chunk = updates.slice(i, i + 500);
      const { error: upErr } = await supabase
        .from("listings")
        .upsert(chunk, { onConflict: "id" });
      if (upErr) throw upErr;
      totalUpdated += chunk.length;
    }

    console.log(`backfilled ${totalUpdated} rows so far (lastId=${data[data.length - 1].id})`);
    lastId = data[data.length - 1].id;
    if (data.length < PAGE) break;
  }

  console.log(`done — ${totalUpdated} rows updated`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/backfill-series-column.test.ts`
Expected: PASS.

- [ ] **Step 5: Execute the backfill against the real DB**

```bash
npx tsx scripts/backfill-series-column.ts
```
Expected: logs "backfilled N rows so far" progressing through all rows; final line "done — N rows updated". N should roughly match your active + historical Porsche + Ferrari count (~18K+).

- [ ] **Step 6: Verify coverage**

```sql
SELECT count(*) FILTER (WHERE series IS NOT NULL) AS classified,
       count(*) FILTER (WHERE series IS NULL)     AS unclassified,
       count(*)                                   AS total
  FROM listings;
```
Expected: `classified / total` > 0.9 for a healthy Porsche dataset. Unclassified rows should be genuinely ambiguous titles (e.g. parts, generic "911").

- [ ] **Step 7: Refresh the MV so it picks up the new values**

```sql
SELECT refresh_listings_active_counts();
```

- [ ] **Step 8: Commit**

```bash
git add scripts/backfill-series-column.ts scripts/backfill-series-column.test.ts
git commit -m "chore(backfill): populate listings.series for historical rows"
```

---

### Task 7: Wire `refresh_listings_active_counts()` into crons

**Files:**
- Modify: `src/app/api/cron/cleanup/route.ts`
- Modify: `src/app/api/cron/porsche/route.ts`
- Modify: `src/app/api/cron/ferrari/route.ts`
- Modify: `src/app/api/cron/validate/route.ts`

- [ ] **Step 1: Add a shared refresh helper**

```typescript
// src/features/scrapers/common/refreshCounts.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function refreshListingsActiveCounts(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("refresh_listings_active_counts");
  if (error) {
    console.error("[refreshListingsActiveCounts] failed:", error.message);
  }
}
```

- [ ] **Step 2: Call it at the end of each cron route**

In each of the four routes, immediately before the final `NextResponse.json(...)`, add:

```typescript
import { refreshListingsActiveCounts } from "@/features/scrapers/common/refreshCounts";

// ... at the end of the handler, after writes complete:
await refreshListingsActiveCounts(supabase);
```

- [ ] **Step 3: Verify with one manual cron run**

```bash
curl -s -X GET 'http://localhost:3000/api/cron/cleanup' -H "Authorization: Bearer $CRON_SECRET" | jq .
```
Then:
```sql
SELECT pg_size_pretty(pg_relation_size('listings_active_counts')) AS size,
       max(now()) AS refreshed_at
  FROM listings_active_counts;
```
Expected: non-zero size, the row count matches an ad-hoc `GROUP BY` against `listings`.

- [ ] **Step 4: Commit**

```bash
git add src/features/scrapers/common/refreshCounts.ts src/app/api/cron
git commit -m "feat(cron): refresh listings_active_counts at end of scraper runs"
```

---

## Phase 3 — Frontend reads from the MV

### Task 8: Replace `fetchSeriesCounts` with an MV query

**Files:**
- Modify: `src/lib/supabaseLiveListings.ts:1469` (the `fetchSeriesCounts` function)

- [ ] **Step 1: Add a test covering the new SQL shape**

Append to `src/lib/supabaseLiveListings.test.ts` (create the file if it doesn't exist — mock Supabase):

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("./brandConfig", () => ({
  extractSeries: vi.fn(),
  getSeriesConfig: vi.fn(),
  getModelPatternsForSeries: vi.fn(),
}));

const from = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from }),
}));

describe("fetchSeriesCounts", () => {
  it("sums live_count per series from the MV", async () => {
    from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { series: "992", live_count: 42 },
          { series: "991", live_count: 17 },
          { series: "992", live_count: 5 },
          { series: "__null", live_count: 999 },
        ],
        error: null,
      }),
    });

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "x";

    const { fetchSeriesCounts } = await import("./supabaseLiveListings");
    const counts = await fetchSeriesCounts("Porsche");

    expect(counts).toEqual({ "992": 47, "991": 17 });
  });
});
```

- [ ] **Step 2: Run test (fails against current implementation)**

Run: `npx vitest run src/lib/supabaseLiveListings.test.ts`
Expected: FAIL (or no such test file) — `fetchSeriesCounts` currently queries `listings` directly.

- [ ] **Step 3: Rewrite `fetchSeriesCounts`**

Replace the function body (currently at `src/lib/supabaseLiveListings.ts:1469-1530`) with:

```typescript
export async function fetchSeriesCounts(
  make: string,
): Promise<Record<string, number>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return {};

  const targetMake = resolveRequestedMake(make).toLowerCase();

  try {
    const supabase = createSupabaseClient(url, key);
    const { data, error } = await supabase
      .from("listings_active_counts")
      .select("series,live_count")
      .eq("make", targetMake);

    if (error || !data) {
      console.error("[supabaseLiveListings] fetchSeriesCounts MV query failed:", error?.message);
      return {};
    }

    const counts: Record<string, number> = {};
    for (const row of data as { series: string; live_count: number }[]) {
      if (row.series === "__null") continue;
      counts[row.series] = (counts[row.series] ?? 0) + Number(row.live_count);
    }
    return counts;
  } catch (err) {
    console.error("[supabaseLiveListings] fetchSeriesCounts threw:", err);
    return {};
  }
}
```

Also delete the now-obsolete `_seriesCountsCache` and `SERIES_COUNTS_TTL_MS` constants above the function.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/supabaseLiveListings.test.ts`
Expected: PASS.

- [ ] **Step 5: Benchmark against the live DB**

```bash
time curl -s 'http://localhost:3000/api/mock-auctions' > /dev/null
```
Expected: total round-trip < 2s cold (down from 30s+).

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabaseLiveListings.ts src/lib/supabaseLiveListings.test.ts
git commit -m "perf(listings): query MV for series counts instead of client-side agg"
```

---

### Task 9: Replace `fetchLiveListingAggregateCounts` with an MV query

**Files:**
- Modify: `src/lib/supabaseLiveListings.ts:712` (the `fetchLiveListingAggregateCounts` function)

- [ ] **Step 1: Add a test covering the derivation**

```typescript
// Add to src/lib/supabaseLiveListings.test.ts
describe("fetchLiveListingAggregateCounts", () => {
  it("derives regionTotals from MV rows in one query", async () => {
    from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { source: "BaT",          region_by_country: "US", live_count: 100 },
          { source: "AutoScout24",  region_by_country: "EU", live_count:  60 },
          { source: "Elferspot",    region_by_country: "EU", live_count:  20 },
          { source: "AutoTrader",   region_by_country: "UK", live_count:  15 },
          { source: "BeForward",    region_by_country: "JP", live_count:  10 },
          { source: "ClassicCom",   region_by_country: "US", live_count:  25 },
        ],
        error: null,
      }),
    });

    const { fetchLiveListingAggregateCounts } = await import("./supabaseLiveListings");
    const result = await fetchLiveListingAggregateCounts({ make: "Porsche" });

    expect(result.liveNow).toBe(230);
    expect(result.regionTotalsByPlatform).toEqual({
      all: 230, US: 125, EU: 80, UK: 15, JP: 10,
    });
    expect(result.regionTotalsByLocation).toEqual({
      all: 230, US: 125, EU: 80, UK: 15, JP: 10,
    });
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npx vitest run src/lib/supabaseLiveListings.test.ts`
Expected: FAIL — current implementation runs 10 separate count queries.

- [ ] **Step 3: Rewrite the function**

Replace the function body with:

```typescript
export async function fetchLiveListingAggregateCounts(
  options?: { make?: string | null },
): Promise<LiveListingAggregateCounts> {
  const empty: LiveListingAggregateCounts = {
    liveNow: 0,
    regionTotalsByPlatform: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 },
    regionTotalsByLocation: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 },
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return empty;

  const targetMake = resolveRequestedMake(options?.make).toLowerCase();

  try {
    const supabase = createSupabaseClient(url, key);
    const { data, error } = await supabase
      .from("listings_active_counts")
      .select("source,region_by_country,live_count")
      .eq("make", targetMake);

    if (error || !data) {
      console.error("[supabaseLiveListings] aggregate MV query failed:", error?.message);
      return empty;
    }

    const platform = { all: 0, US: 0, UK: 0, EU: 0, JP: 0 };
    const location = { all: 0, US: 0, UK: 0, EU: 0, JP: 0 };

    for (const row of data as { source: string; region_by_country: string | null; live_count: number }[]) {
      const n = Number(row.live_count);
      platform.all += n;
      location.all += n;

      const canonical = resolveCanonicalSource(row.source, null);
      if (canonical === "BaT" || canonical === "CarsAndBids" || canonical === "ClassicCom") platform.US += n;
      else if (canonical === "AutoScout24" || canonical === "CollectingCars" || canonical === "Elferspot") platform.EU += n;
      else if (canonical === "AutoTrader") platform.UK += n;
      else if (canonical === "BeForward") platform.JP += n;

      if (row.region_by_country === "US" || row.region_by_country === null) location.US += n;
      else if (row.region_by_country === "UK") location.UK += n;
      else if (row.region_by_country === "JP") location.JP += n;
      else if (row.region_by_country === "EU") location.EU += n;
    }

    return {
      liveNow: platform.all,
      regionTotalsByPlatform: platform,
      regionTotalsByLocation: location,
    };
  } catch (err) {
    console.error("[supabaseLiveListings] fetchLiveListingAggregateCounts threw:", err);
    return empty;
  }
}
```

Also delete the in-memory cache block (`_aggregateCountsCache`, `_aggregateCountsInflight`, `AGGREGATE_COUNTS_TTL_MS`) added in the previous hotfix — the MV makes them redundant.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/supabaseLiveListings.test.ts`
Expected: PASS (both series + aggregate tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabaseLiveListings.ts src/lib/supabaseLiveListings.test.ts
git commit -m "perf(listings): query MV for aggregate region/platform counts"
```

---

### Task 10: Switch paginated query from `ilike` + model-keyword OR to `eq` + `series`

**Files:**
- Modify: `src/lib/supabaseLiveListings.ts:1354` (the `fetchPaginatedListings` function)

- [ ] **Step 1: Add a test asserting the new filter shape**

```typescript
// Add to src/lib/supabaseLiveListings.test.ts
describe("fetchPaginatedListings", () => {
  it("uses eq('make') + eq('series') instead of ilike + model keywords when a family is supplied", async () => {
    const eqMock = vi.fn().mockReturnThis();
    const orMock = vi.fn().mockReturnThis();
    const order = vi.fn().mockReturnThis();
    const range = vi.fn().mockResolvedValue({ data: [], error: null });

    from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: eqMock,
      or: orMock,
      order,
      range,
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
    });

    const { fetchPaginatedListings } = await import("./supabaseLiveListings");
    await fetchPaginatedListings({
      make: "Porsche",
      modelPatterns: { keywords: ["992"] },
      pageSize: 50,
      offset: 0,
    });

    // make is eq(), not ilike()
    expect(eqMock).toHaveBeenCalledWith("make", "Porsche");
    // family was resolved to a series eq, not a model.ilike OR
    expect(eqMock).toHaveBeenCalledWith("series", "992");
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npx vitest run src/lib/supabaseLiveListings.test.ts -t fetchPaginatedListings`
Expected: FAIL.

- [ ] **Step 3: Refactor `fetchPaginatedListings`**

Replace `.ilike("make", targetMake)` with `.eq("make", targetMake)` across the file.

For the family-filter block (currently around line 1375), replace the `model.ilike` OR clause with a direct series filter. Update `getModelPatternsForSeries` callers in `src/app/api/mock-auctions/route.ts` to pass a `series` id directly instead of a keywords bag.

```typescript
// In fetchPaginatedListings — replace the modelPatterns block with:
if (options.series) {
  query = query.eq("series", options.series);
}
if (options.yearMin !== undefined) query = query.gte("year", options.yearMin);
if (options.yearMax !== undefined) query = query.lte("year", options.yearMax);
```

Update the `fetchPaginatedListings` params type:

```typescript
export async function fetchPaginatedListings(options: {
  make: string;
  pageSize?: number;
  offset?: number;
  region?: string | null;
  platform?: string | null;
  query?: string | null;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: "active" | "all";
  series?: string | null;
  yearMin?: number;
  yearMax?: number;
}): Promise<{ cars: CollectorCar[]; hasMore: boolean }>;
```

- [ ] **Step 4: Update the caller**

In `src/app/api/mock-auctions/route.ts` (around line 110), replace `modelPatterns` with:

```typescript
const paginatedPromise = fetchPaginatedListings({
  make: requestedMake ?? "Porsche",
  pageSize: rawPageSize,
  offset,
  region: regionParam,
  platform: platformFilter,
  query: query || null,
  sortBy,
  sortOrder: sortOrder as "asc" | "desc",
  status: dbStatus,
  series: family || null,
});
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run src/lib/supabaseLiveListings.test.ts`
Expected: PASS.

- [ ] **Step 6: Smoke test**

Start dev server, visit `/de/cars/porsche?family=992`, confirm listings load and the page renders the 992 family.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabaseLiveListings.ts src/app/api/mock-auctions/route.ts
git commit -m "perf(listings): filter by indexed make/series instead of ilike keywords"
```

---

## Phase 4 — Next.js 16 caching

### Task 11: Migrate dashboard data to `"use cache"` + `cacheTag`

**Files:**
- Modify: `src/lib/dashboardCache.ts`
- Modify: `src/lib/dashboardCache.test.ts`
- Modify: `next.config.ts` (enable `cacheComponents` if not already)

- [ ] **Step 1: Enable cacheComponents in next.config.ts**

```typescript
// next.config.ts — add inside the config object:
experimental: {
  cacheComponents: true,
},
```

- [ ] **Step 2: Update the test for the new caching shape**

```typescript
// src/lib/dashboardCache.test.ts — replace the existing single test body
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabaseLiveListings", () => ({
  fetchLiveListingsAsCollectorCars: vi.fn(async () => []),
  fetchLiveListingAggregateCounts: vi.fn(async () => ({
    liveNow: 7,
    regionTotalsByPlatform: { all: 7, US: 3, UK: 1, EU: 2, JP: 1 },
    regionTotalsByLocation: { all: 7, US: 3, UK: 1, EU: 2, JP: 1 },
  })),
  fetchSeriesCounts: vi.fn(async () => ({ "992": 1 })),
}));

vi.mock("./makeProfiles", () => ({ resolveRequestedMake: () => "Porsche" }));

describe("getCachedDashboardData", () => {
  it("returns the dashboard shape from a single fan-out", async () => {
    const { getCachedDashboardData } = await import("./dashboardCache");
    const data = await getCachedDashboardData();
    expect(data.liveNow).toBe(7);
    expect(data.seriesCounts).toEqual({ "992": 1 });
    expect(data.valuationListings).toEqual([]);
  });
});
```

- [ ] **Step 3: Rewrite `dashboardCache.ts`**

```typescript
// src/lib/dashboardCache.ts
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from "next/cache";
import {
  fetchLiveListingsAsCollectorCars,
  fetchLiveListingAggregateCounts,
  fetchSeriesCounts,
} from "./supabaseLiveListings";
import { resolveRequestedMake } from "./makeProfiles";
import type { CollectorCar } from "./curatedCars";

// ... keep the existing DashboardAuction / DashboardData types unchanged ...
// ... keep transformCar and serializeEndTime unchanged ...

const DASHBOARD_SOURCE_BUDGET = 200;

export async function getCachedDashboardData(): Promise<DashboardData> {
  "use cache";
  cacheLife("minutes"); // 5-min profile, stale-while-revalidate
  cacheTag("listings");

  const requestedMake = resolveRequestedMake(null);

  const [live, aggregates, seriesCounts] = await Promise.all([
    fetchLiveListingsAsCollectorCars({
      limit: DASHBOARD_SOURCE_BUDGET,
      includePriceHistory: false,
      make: requestedMake,
      includeAllSources: true,
    }),
    fetchLiveListingAggregateCounts({ make: requestedMake }),
    fetchSeriesCounts(requestedMake ?? "Porsche"),
  ]);

  const active = live.filter(
    (car) => car.status === "ACTIVE" || car.status === "ENDING_SOON",
  );

  return {
    auctions: active.map(transformCar),
    valuationListings: [],
    liveNow: aggregates.liveNow,
    regionTotals: {
      all: aggregates.regionTotalsByPlatform.all,
      US: aggregates.regionTotalsByPlatform.US,
      UK: aggregates.regionTotalsByPlatform.UK,
      EU: aggregates.regionTotalsByPlatform.EU,
      JP: aggregates.regionTotalsByPlatform.JP,
    },
    seriesCounts,
  };
}

// Keep the uncached variant exported for tests.
export { getCachedDashboardData as fetchDashboardDataUncached };
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/dashboardCache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardCache.ts src/lib/dashboardCache.test.ts next.config.ts
git commit -m "feat(cache): migrate dashboard to 'use cache' + cacheTag('listings')"
```

---

### Task 12: Add the cron-triggered `revalidateTag` endpoint

**Files:**
- Create: `src/app/api/cache/revalidate-listings/route.ts`
- Modify: scraper cron routes (Task 7's list) to hit this endpoint after writes.

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/cache/revalidate-listings/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  revalidateTag("listings");
  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
```

- [ ] **Step 2: Call it from each scraper cron on success**

At the end of each cron route (right after `refreshListingsActiveCounts(supabase)`), add:

```typescript
try {
  await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/cache/revalidate-listings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
} catch (err) {
  console.error("[cron] revalidateTag failed (non-fatal):", err);
}
```

- [ ] **Step 3: Manual verification**

```bash
curl -s -X POST 'http://localhost:3000/api/cache/revalidate-listings' \
  -H "Authorization: Bearer $CRON_SECRET" | jq .
```
Expected: `{ "revalidated": true, "at": "..." }`.

Reload the dashboard in a browser — the next request should re-fetch (network tab: cache miss for the RSC payload), then subsequent requests cache hit until the next invalidation.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cache src/app/api/cron
git commit -m "feat(cache): cron-triggered revalidateTag('listings') endpoint"
```

---

## Phase 5 — Query cleanup (polish)

### Task 13: Collapse source/platform bucket queries into a single OR

**Files:**
- Modify: `src/lib/supabaseLiveListings.ts:910` (the `querySourceBucket` function)

- [ ] **Step 1: Add a test asserting one query per source**

```typescript
// Add to src/lib/supabaseLiveListings.test.ts
describe("querySourceBucket", () => {
  it("fires one OR query per source instead of separate source + platform queries", async () => {
    const orSpy = vi.fn().mockReturnThis();
    from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: orSpy,
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const { fetchLiveListingsAsCollectorCars } = await import("./supabaseLiveListings");
    await fetchLiveListingsAsCollectorCars({ make: "Porsche", limit: 50 });

    // Two .or() calls per source query: one for end_time filter, one for source/platform.
    // Prior implementation did two separate queries per source.
    expect(orSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Refactor `querySourceBucket`**

Replace the source/platform two-pass pattern with a single query that ORs both columns:

```typescript
const querySourceBucket = async (source: CanonicalSource) => {
  const sourceAliases = SOURCE_ALIASES[source] ?? [source];
  const platformAliases = source in PLATFORM_ALIASES
    ? PLATFORM_ALIASES[source as keyof typeof PLATFORM_ALIASES]
    : [];

  const orClause = platformAliases.length > 0
    ? `source.in.(${encodePostgrestInValues([...sourceAliases])}),platform.in.(${encodePostgrestInValues([...platformAliases])})`
    : `source.in.(${encodePostgrestInValues([...sourceAliases])})`;

  const { data, error } = await buildBaseQuery()
    .or(orClause)
    .order("sale_date", { ascending: false, nullsFirst: false })
    .order("end_time",  { ascending: false, nullsFirst: false })
    .order("id",        { ascending: false })
    .range(0, Math.max(0, maxRowsPerSource - 1));

  if (error) {
    console.error(`[supabaseLiveListings] ${source} query failed:`, error.message);
    return [] as ListingRow[];
  }

  const rows = (data ?? []) as ListingRow[];
  const byId = new Map<string, ListingRow>();
  for (const row of rows) {
    const canonicalSource = resolveCanonicalSource(row.source, row.platform);
    if (canonicalSource !== source) continue;
    if (statusFilter?.toLowerCase() === "active" && !isLiveListingStatus(row.status)) continue;
    byId.set(row.id, row);
  }
  return Array.from(byId.values());
};
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/supabaseLiveListings.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabaseLiveListings.ts src/lib/supabaseLiveListings.test.ts
git commit -m "perf(listings): collapse source/platform bucket into single OR query"
```

---

### Task 14: Switch paginated endpoint to keyset cursor

**Files:**
- Modify: `src/lib/supabaseLiveListings.ts` (`fetchPaginatedListings`)
- Modify: `src/app/api/mock-auctions/route.ts`
- Modify: `src/hooks/useInfiniteAuctions.ts`

- [ ] **Step 1: Add a test for keyset cursor encoding**

```typescript
// Add to src/lib/supabaseLiveListings.test.ts
describe("fetchPaginatedListings keyset cursor", () => {
  it("returns the next cursor encoded from the last row's (end_time, id)", async () => {
    const rows = [
      { id: "a", end_time: "2026-05-01T00:00:00Z", year: 2023, make: "Porsche", model: "992",
        /* other ListingRow fields omitted — mapper handles nulls */ } as any,
      { id: "b", end_time: "2026-05-02T00:00:00Z", year: 2023, make: "Porsche", model: "992" } as any,
    ];
    from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
    });

    const { fetchPaginatedListings } = await import("./supabaseLiveListings");
    const { nextCursor, hasMore } = await fetchPaginatedListings({
      make: "Porsche", pageSize: 2, status: "active",
    });

    expect(hasMore).toBe(false);
    expect(nextCursor).toEqual({ endTime: "2026-05-02T00:00:00Z", id: "b" });
  });
});
```

- [ ] **Step 2: Swap offset cursor for keyset in `fetchPaginatedListings`**

Replace the `range(offset, offset + pageSize)` pattern with a keyset cursor built from `(end_time, id)`:

```typescript
export async function fetchPaginatedListings(options: {
  make: string;
  pageSize?: number;
  cursor?: { endTime: string | null; id: string } | null;
  region?: string | null;
  platform?: string | null;
  query?: string | null;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: "active" | "all";
  series?: string | null;
  yearMin?: number;
  yearMax?: number;
}): Promise<{
  cars: CollectorCar[];
  hasMore: boolean;
  nextCursor: { endTime: string | null; id: string } | null;
}> {
  const pageSize = options.pageSize ?? 50;
  // ... same filter setup as before ...

  // Keyset: WHERE (end_time, id) > (cursor.endTime, cursor.id)
  if (options.cursor) {
    const { endTime, id } = options.cursor;
    if (endTime !== null) {
      query = query.or(
        `end_time.gt.${endTime},and(end_time.eq.${endTime},id.lt.${id})`,
      );
    } else {
      query = query.lt("id", id);
    }
  }

  query = query
    .order("end_time", { ascending: true, nullsFirst: false })
    .order("id",       { ascending: false })
    .limit(pageSize + 1);

  const { data, error } = await query;
  if (error) {
    console.error("[supabaseLiveListings] fetchPaginatedListings failed:", error.message);
    return { cars: [], hasMore: false, nextCursor: null };
  }

  const rows = ((data ?? []) as ListingRow[]).filter((r) => !isJunkListing(r));
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const last = pageRows[pageRows.length - 1];
  const nextCursor = hasMore && last
    ? { endTime: last.end_time, id: last.id }
    : null;

  return { cars: pageRows.map(rowToCollectorCar), hasMore, nextCursor };
}
```

- [ ] **Step 3: Update `/api/mock-auctions` to encode/decode the keyset cursor**

Replace the `btoa(JSON.stringify({ offset }))` cursor handling with JSON-encoded keyset cursors (same `btoa`/`atob` roundtrip, different payload shape).

- [ ] **Step 4: Update `useInfiniteAuctions`**

The hook already treats `cursor` as an opaque string, so no behavioral change — just ensure it forwards whatever the API returns.

- [ ] **Step 5: Run tests + smoke**

Run: `npx vitest run src/lib/supabaseLiveListings.test.ts`
Expected: PASS.

Visit `/de/cars/porsche?family=992`, scroll to trigger infinite load, confirm subsequent pages come back quickly and without duplicates.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabaseLiveListings.ts src/app/api/mock-auctions src/hooks/useInfiniteAuctions.ts
git commit -m "perf(listings): keyset cursor pagination for paginated listings"
```

---

## Done criteria

- Cold dashboard load (`/de`) renders in < 1s at 18K+ listings (measure with Chrome DevTools: TTFB + FCP).
- `/de/cars/porsche?family=992` renders first page in < 1s cold; subsequent infinite scrolls in < 300ms.
- `tail -f .next/trace` no longer shows `AbortError` or `canceling statement due to statement timeout`.
- `vitest run` passes the new `src/lib/supabaseLiveListings.test.ts` and the updated `dashboardCache.test.ts`.
- `SELECT count(*) FROM listings WHERE series IS NULL AND status='active'` is ~0 for Porsche (ambiguous tail for Ferrari is acceptable).
- After a scraper cron completes, the dashboard picks up the new listings within one request (no 5-min wait).
