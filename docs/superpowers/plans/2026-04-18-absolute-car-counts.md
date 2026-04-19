# Absolute Car Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the misleading "array-length" counts (e.g. `50 cars`, `200 vehicles`) in the Monza series page and the Classic `/browse` page with absolute totals from Supabase. Pagination behavior stays unchanged; this is a display-only refactor.

**Architecture:** Three-layer change for Monza view: Supabase bridge (`fetchPaginatedListings` gains `totalCount` + `totalLiveCount` via `count: 'planned'` and a second HEAD count query) → API route (`/api/mock-auctions` passes both through) → hook + UI (`useInfiniteAuctions` exposes both; `MakePageClient` swaps 5 display sites). Classic view is simpler: no data-fetch changes — `BrowseClient` is rewired to prefer the already-available `liveNow` and `seriesCounts` aggregates over local `.length`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (`@supabase/supabase-js`), vitest.

**Reference:** See the spec at `docs/superpowers/specs/2026-04-18-absolute-car-counts-design.md` for rationale, precision-vs-speed tradeoff (`planned` chosen), and the Classic view load-more label rationale.

---

## File Structure

Files touched, with a one-line responsibility summary:

- `src/lib/supabaseLiveListings.ts` — add `count: 'planned'` to the main paginated query; add a parallel HEAD count query for `status='active'`; return `totalCount` + `totalLiveCount`.
- `src/app/api/mock-auctions/route.ts` — pass `totalCount` and `totalLiveCount` through the paginated response.
- `src/hooks/useInfiniteAuctions.ts` — extend state + return shape with `totalLiveCount` (the `totalCount` wiring already exists).
- `src/app/[locale]/cars/[make]/MakePageClient.tsx` — destructure `totalLiveCount` from the hook; replace 5 display sites with `displayTotal` / `displayLiveTotal`, showing `—` on null.
- `src/app/[locale]/browse/page.tsx` — pass `liveNow={data.liveNow}` to `BrowseClient`.
- `src/components/browse/BrowseClient.tsx` — accept `liveNow` prop; compute `filteredTotal`; update the "X of Y vehicles" header. Load-more label unchanged.

---

## Task 1: Bridge returns `totalCount` from the main paginated query

**Files:**
- Modify: `src/lib/supabaseLiveListings.ts:1440-1593` (`fetchPaginatedListings`)

Add `count: 'planned'` to the main query so Supabase returns a row-count estimate alongside the page of rows. Return this as `totalCount` (may be `null` if Supabase omits it).

- [ ] **Step 1: Update the return-type signature**

In `src/lib/supabaseLiveListings.ts` at the signature of `fetchPaginatedListings` (line 1452-1456), change:

```ts
}): Promise<{
  cars: CollectorCar[];
  hasMore: boolean;
  nextCursor: { endTime: string | null; id: string } | null;
}> {
```

to:

```ts
}): Promise<{
  cars: CollectorCar[];
  hasMore: boolean;
  nextCursor: { endTime: string | null; id: string } | null;
  totalCount: number | null;
  totalLiveCount: number | null;
}> {
```

(`totalLiveCount` will be wired in Task 2 — included here so callers see the full shape from the start.)

- [ ] **Step 2: Update the early-return empty path**

At line 1461-1463, change:

```ts
if (!url || !key) {
  return { cars: [], hasMore: false, nextCursor: null };
}
```

to:

```ts
if (!url || !key) {
  return { cars: [], hasMore: false, nextCursor: null, totalCount: null, totalLiveCount: null };
}
```

- [ ] **Step 3: Add `count: 'planned'` to the main query**

At line 1475-1478, change:

```ts
let query = supabase
  .from("listings")
  .select(SELECT_NARROW)
  .eq("make", targetMake);
```

to:

```ts
let query = supabase
  .from("listings")
  .select(SELECT_NARROW, { count: "planned" })
  .eq("make", targetMake);
```

Also update the stale comment at lines 1471-1474. Change:

```ts
// Build base query. Count omitted on purpose: `count: "exact"` forces
// a full-table scan alongside every page fetch which collides with the
// Supabase statement_timeout when multiple sources / tabs query in
// parallel. `hasMore` is already derived from fetching pageSize + 1.
```

to:

```ts
// Build base query. Using `count: "planned"` — Postgres returns its
// planner-estimated row count for the filtered query without executing
// a full table scan. Accuracy is approximate (statistics freshness),
// which is acceptable for visual counters. See
// docs/superpowers/specs/2026-04-18-absolute-car-counts-design.md.
```

- [ ] **Step 4: Read `count` from the Supabase response**

At line 1570, change:

```ts
const { data, error } = await query;
```

to:

```ts
const { data, error, count } = await query;
```

- [ ] **Step 5: Update the error-path and success-path returns**

At line 1572-1575, change:

```ts
if (error) {
  console.error("[supabaseLiveListings] fetchPaginatedListings failed:", error.message);
  return { cars: [], hasMore: false, nextCursor: null };
}
```

to:

```ts
if (error) {
  console.error("[supabaseLiveListings] fetchPaginatedListings failed:", error.message);
  return { cars: [], hasMore: false, nextCursor: null, totalCount: null, totalLiveCount: null };
}
```

At line 1588, change:

```ts
return { cars, hasMore, nextCursor };
```

to:

```ts
const totalCount = typeof count === "number" ? count : null;
return { cars, hasMore, nextCursor, totalCount, totalLiveCount: null };
```

(`totalLiveCount` is set to `null` here; Task 2 will compute it.)

At line 1589-1592 (the catch block), change:

```ts
} catch (err) {
  console.error("[supabaseLiveListings] fetchPaginatedListings threw:", err);
  return { cars: [], hasMore: false, nextCursor: null };
}
```

to:

```ts
} catch (err) {
  console.error("[supabaseLiveListings] fetchPaginatedListings threw:", err);
  return { cars: [], hasMore: false, nextCursor: null, totalCount: null, totalLiveCount: null };
}
```

- [ ] **Step 6: Update call sites that destructure the result**

Search for any call sites that destructure the return value without handling the new fields — those are fine (they'll just ignore `totalCount`/`totalLiveCount`), but any exhaustive-shape code must be updated.

Run:

```bash
rg "fetchPaginatedListings\(" src --type ts
```

Review each result. Most call `await fetchPaginatedListings(...)` and destructure selectively — no action needed. The key one is `src/app/api/mock-auctions/route.ts` which will be updated in Task 3.

- [ ] **Step 7: Verify TypeScript**

Run:

```bash
npx tsc --noEmit 2>&1 | rg -v "^\.next/" | head -40
```

Expected: no new errors introduced. Ignore `.next/dev/types/*` noise (per CLAUDE.md).

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabaseLiveListings.ts
git commit -m "feat(listings): return planned totalCount from fetchPaginatedListings

Bridge now requests count: 'planned' on the main paginated query and
returns totalCount (may be null). Lays the groundwork for absolute
count displays in Monza view. totalLiveCount field is present in the
return shape but still null — populated in the next commit."
```

---

## Task 2: Bridge returns `totalLiveCount` via a HEAD count query

**Files:**
- Modify: `src/lib/supabaseLiveListings.ts:1440-1593` (`fetchPaginatedListings`)

The Latest Listings sidebar badge needs a count restricted to `status = 'active'` regardless of the main query's status filter. Implement this as a second, parallel, HEAD-only query that reuses the same filter conditions but pins the status.

**Why HEAD:** `count: 'planned', head: true` returns the count without any rows, which is cheap. We run it in parallel with the main query via `Promise.all` so total latency is `max(main, head)` rather than `main + head`.

- [ ] **Step 1: Extract filter application into a helper**

To avoid duplicating ~40 lines of filter logic across the main query and the HEAD query, extract a small helper. Add this just above `fetchPaginatedListings` at line 1440:

```ts
/**
 * Apply the filters shared by the paginated rows query and the live-count
 * HEAD query. Keeps the two queries in sync so the counts always describe
 * the same logical set (aside from the status filter, which differs).
 */
function applyPaginatedListingFilters<T>(
  query: T,
  options: {
    series?: string | null;
    modelPatterns?: { keywords: string[]; yearMin?: number; yearMax?: number } | null;
    region?: string | null;
    platform?: string | null;
    query?: string | null;
  },
): T {
  // The real query object has chainable methods; at this point in the
  // file types are loose — we mirror that.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = query;

  if (options.series) {
    q = q.eq("series", options.series);
    const patterns = options.modelPatterns;
    if (patterns?.yearMin !== undefined) q = q.gte("year", patterns.yearMin);
    if (patterns?.yearMax !== undefined) q = q.lte("year", patterns.yearMax);
  } else if (options.modelPatterns) {
    const { keywords, yearMin, yearMax } = options.modelPatterns;
    if (keywords.length > 0) {
      const orClauses = keywords
        .map((kw) => `model.ilike.%${kw.replace(/[%_]/g, "")}%`)
        .join(",");
      q = q.or(orClauses);
    }
    if (yearMin !== undefined) q = q.gte("year", yearMin);
    if (yearMax !== undefined) q = q.lte("year", yearMax);
  }

  if (options.region) {
    const regionUpper = options.region.toUpperCase();
    const sourceGroups = REGION_SOURCE_MAP[regionUpper];
    if (sourceGroups) {
      const allAliases = sourceGroups.flat();
      q = q.in("source", allAliases);
    } else {
      const countryValues = REGION_COUNTRY_MAP[regionUpper];
      if (countryValues) q = q.in("country", countryValues);
    }
  }

  if (options.platform) {
    const sourceAliases = resolveSourceAliasesForPlatform(options.platform);
    q = q.in("source", sourceAliases);
  }

  if (options.query) {
    const escaped = options.query.replace(/[%_]/g, "");
    q = q.or(`title.ilike.%${escaped}%,model.ilike.%${escaped}%`);
  }

  return q as T;
}
```

- [ ] **Step 2: Refactor the main query to use the helper**

In `fetchPaginatedListings`, replace lines 1487-1544 (series/modelPatterns/region/platform/query filters — everything from the `// Series / model filter.` comment through `title.ilike...`) with a single call:

```ts
query = applyPaginatedListingFilters(query, {
  series: options.series,
  modelPatterns: options.modelPatterns,
  region: options.region,
  platform: options.platform,
  query: options.query,
});
```

Leave the status filter (1480-1485) and the cursor filter (1546-1559) where they are — those are specific to the main query (status filter varies, cursor only applies to the paginated rows query).

- [ ] **Step 3: Build the HEAD count query**

Just after `query = query.limit(pageSize + 1);` (line 1568) and before `const { data, error, count } = await query;`, add:

```ts
// Parallel HEAD count query for live-only subset (status='active').
// This count ignores the main query's status filter and always
// restricts to live listings — matches the "Latest Listings" semantics.
let liveCountQuery = supabase
  .from("listings")
  .select("id", { count: "planned", head: true })
  .eq("make", targetMake)
  .eq("status", LIVE_DB_STATUS_VALUES[0]);

liveCountQuery = applyPaginatedListingFilters(liveCountQuery, {
  series: options.series,
  modelPatterns: options.modelPatterns,
  region: options.region,
  platform: options.platform,
  query: options.query,
});

// Exclude stale auction rows whose end_time passed (mirrors main query).
liveCountQuery = liveCountQuery.or(
  "end_time.is.null,end_time.gt." + new Date().toISOString(),
);
```

- [ ] **Step 4: Run both queries in parallel**

Replace the single `await query` at line 1570 with a `Promise.all`:

```ts
const [rowsResult, liveCountResult] = await Promise.all([
  query,
  liveCountQuery,
]);

const { data, error, count } = rowsResult;
const totalLiveCount =
  liveCountResult.error || typeof liveCountResult.count !== "number"
    ? null
    : liveCountResult.count;
```

- [ ] **Step 5: Return `totalLiveCount` instead of `null`**

Update the success-path return (previously `totalLiveCount: null`) to use the computed value:

```ts
const totalCount = typeof count === "number" ? count : null;
return { cars, hasMore, nextCursor, totalCount, totalLiveCount };
```

- [ ] **Step 6: Verify TypeScript**

Run:

```bash
npx tsc --noEmit 2>&1 | rg -v "^\.next/" | head -40
```

Expected: no new errors.

- [ ] **Step 7: Lint check**

Run:

```bash
npx eslint src/lib/supabaseLiveListings.ts
```

Expected: no new errors beyond pre-existing warnings.

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabaseLiveListings.ts
git commit -m "feat(listings): add parallel totalLiveCount HEAD query

fetchPaginatedListings now runs a second HEAD-only count query in
parallel with the main paginated query, pinned to status='active'.
This is the count used by the Latest Listings sidebar badge. Shared
filters are extracted into applyPaginatedListingFilters so both
queries describe the same logical set."
```

---

## Task 3: API route passes both counts through

**Files:**
- Modify: `src/app/api/mock-auctions/route.ts:156-166`

- [ ] **Step 1: Update the paginated response**

Replace lines 158-165:

```ts
const response: Record<string, unknown> = {
  auctions: transformed,
  nextCursor,
  hasMore: paginatedResult.hasMore,
  // totalCount is intentionally omitted: count: "exact" was dropped in the
  // earlier hotfix to avoid full-table scan overhead; keyset pagination
  // makes totalCount explicitly unavailable.
};
```

with:

```ts
const response: Record<string, unknown> = {
  auctions: transformed,
  nextCursor,
  hasMore: paginatedResult.hasMore,
  totalCount: paginatedResult.totalCount,
  totalLiveCount: paginatedResult.totalLiveCount,
};
```

- [ ] **Step 2: Manual API smoke test**

Start the dev server (if not already running):

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; rm -rf .next; npm run dev &
sleep 8
```

Hit the API:

```bash
curl -s "http://localhost:3000/api/mock-auctions?pageSize=50&make=Porsche&family=992" | python3 -c "import sys, json; d = json.load(sys.stdin); print('auctions:', len(d.get('auctions', [])), 'totalCount:', d.get('totalCount'), 'totalLiveCount:', d.get('totalLiveCount'))"
```

Expected output: something like `auctions: 50 totalCount: 187 totalLiveCount: 187` (numbers vary). Both counts should be integers or `null`, and both should be ≥ the auctions array length.

Then test with a variant filter:

```bash
curl -s "http://localhost:3000/api/mock-auctions?pageSize=50&make=Porsche&family=992&query=GT3" | python3 -c "import sys, json; d = json.load(sys.stdin); print('totalCount:', d.get('totalCount'), 'totalLiveCount:', d.get('totalLiveCount'))"
```

Expected: counts should be smaller than the unfiltered request (GT3s are a subset of 992s).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mock-auctions/route.ts
git commit -m "feat(api): expose totalCount and totalLiveCount in mock-auctions

The paginated response now carries both planned counts from the bridge.
Counts reflect all active filters (family, variant, region, platform,
search). Removes the 'intentionally omitted' comment — the underlying
full-scan issue is resolved by using count: 'planned' instead of 'exact'."
```

---

## Task 4: Hook exposes `totalLiveCount`

**Files:**
- Modify: `src/hooks/useInfiniteAuctions.ts`

The hook already reads `data.totalCount` from the API (line 133-135) and returns it (line 344). We need to do the same for `totalLiveCount`.

- [ ] **Step 1: Extend the return interface**

At line 24-35, add `totalLiveCount` to `UseInfiniteAuctionsResult`:

```ts
interface UseInfiniteAuctionsResult {
  cars: any[];
  total: number;
  totalCount: number | null;
  totalLiveCount: number | null;        // NEW
  aggregates: Aggregates | null;
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  error: string | null;
  sentinelRef: (node: HTMLElement | null) => void;
  reset: () => void;
}
```

- [ ] **Step 2: Add state**

Just after line 64 (`const [totalCount, setTotalCount] = useState<number | null>(null);`), add:

```ts
const [totalLiveCount, setTotalLiveCount] = useState<number | null>(null);
```

- [ ] **Step 3: Cache the value on each page fetch**

In `fetchPage`, at line 133-135:

```ts
if (data.totalCount !== undefined) {
  setTotalCount(data.totalCount);
}
```

Add the parallel block immediately after:

```ts
if (data.totalLiveCount !== undefined) {
  setTotalLiveCount(data.totalLiveCount);
}
```

- [ ] **Step 4: Reset on filter change**

In `reset` at line 236-254, just after `setTotalCount(null);` (line 243), add:

```ts
setTotalLiveCount(null);
```

- [ ] **Step 5: Return the value**

At line 340-352, update the return object:

```ts
return {
  cars: visibleCars,
  total: aggregates?.liveNow ?? 0,
  totalCount,
  totalLiveCount,                // NEW
  aggregates,
  isLoading,
  isFetchingMore,
  hasMore,
  error,
  sentinelRef,
  reset,
};
```

- [ ] **Step 6: Verify TypeScript**

Run:

```bash
npx tsc --noEmit 2>&1 | rg -v "^\.next/" | head -40
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useInfiniteAuctions.ts
git commit -m "feat(hooks): expose totalLiveCount from useInfiniteAuctions

Mirrors the existing totalCount wiring. Reset on filter change so the
UI never shows a stale count while a refetch is in flight."
```

---

## Task 5: MakePageClient uses absolute counts

**Files:**
- Modify: `src/app/[locale]/cars/[make]/MakePageClient.tsx:147-162` (destructure)
- Modify: `src/app/[locale]/cars/[make]/MakePageClient.tsx:903, 956, 1005, 1088-1090, 1168` (display sites)

- [ ] **Step 1: Destructure `totalLiveCount` from the hook**

At line 147-162, update the destructuring:

```ts
const {
  cars: infiniteScrollCars,
  total: infiniteTotal,
  totalCount: infiniteTotalCount,
  totalLiveCount: infiniteTotalLiveCount,      // NEW
  aggregates: infiniteAggregates,
  isLoading: isLoadingCars,
  isFetchingMore,
  hasMore,
  sentinelRef,
  reset: resetInfiniteScroll,
} = useInfiniteAuctions({
  make,
  family: selectedFamilyForFeed || undefined,
  region: selectedRegion && selectedRegion !== "all" ? selectedRegion : undefined,
  query: searchQuery || undefined,
})
```

- [ ] **Step 2: Add display-value derivation**

Just after the `useInfiniteAuctions` destructuring block (around line 162), add:

```ts
// Derived counts for visible labels. Null while the first page is
// in flight — UI renders '—' rather than a misleading array length.
const displayTotal: number | null = infiniteTotalCount
const displayLiveTotal: number | null = infiniteTotalLiveCount
```

- [ ] **Step 3: Small helper for null-safe rendering**

Just after the derivations added in Step 2, add:

```ts
const formatCount = (n: number | null): string => (n === null ? "—" : String(n))
```

- [ ] **Step 4: Replace display site — Sidebar header (line 956)**

Change:

```tsx
<span className="text-[10px] text-muted-foreground tabular-nums">{infiniteTotalCount ?? familyCars.length} cars</span>
```

to:

```tsx
<span className="text-[10px] text-muted-foreground tabular-nums">{formatCount(displayTotal)} cars</span>
```

- [ ] **Step 5: Replace display site — Car index position (line 1005)**

Change:

```tsx
<span className="text-[9px] tabular-nums text-muted-foreground">
  {activeCarIndex + 1}/{variantFilteredFeedCars.length}
</span>
```

to:

```tsx
<span className="text-[9px] tabular-nums text-muted-foreground">
  {activeCarIndex + 1}/{formatCount(displayTotal)}
</span>
```

- [ ] **Step 6: Replace display site — Feed header (line 1168)**

Change:

```tsx
<span className="text-[9px] text-muted-foreground tabular-nums">{variantFilteredFeedCars.length} cars</span>
```

to:

```tsx
<span className="text-[9px] text-muted-foreground tabular-nums">{formatCount(displayTotal)} cars</span>
```

- [ ] **Step 7: Replace display site — Latest Listings badge (lines 1088-1092)**

Change:

```tsx
{liveCars.length > 0 && (
  <span className="px-1.5 py-0.5 rounded-full bg-positive/10 text-[9px] font-bold text-positive">
    {liveCars.length}
  </span>
)}
```

to:

```tsx
{displayLiveTotal !== null && displayLiveTotal > 0 && (
  <span className="px-1.5 py-0.5 rounded-full bg-positive/10 text-[9px] font-bold text-positive">
    {displayLiveTotal}
  </span>
)}
```

**Note:** the `liveCars.length === 0` check at line 1096 (empty-state branch) stays unchanged — it controls rendering of the empty-state text vs. the loaded live list, not a displayed number.

- [ ] **Step 8: Replace display site — Mobile total-live prop (line 903)**

Change:

```tsx
<MobileMakeLiveAuctions
  cars={selectedFamilyForFeed
    ? regionFilteredCars.filter(c => extractFamily(c.model, c.year, make) === selectedFamilyForFeed)
    : regionFilteredCars
  }
  totalLiveCount={liveCars.length}
/>
```

to:

```tsx
<MobileMakeLiveAuctions
  cars={selectedFamilyForFeed
    ? regionFilteredCars.filter(c => extractFamily(c.model, c.year, make) === selectedFamilyForFeed)
    : regionFilteredCars
  }
  totalLiveCount={displayLiveTotal ?? 0}
/>
```

(Falling back to `0` on null for the mobile prop — the child component expects a number, and `0` causes no count badge to render, which matches the null-state intent.)

- [ ] **Step 9: TypeScript check**

Run:

```bash
npx tsc --noEmit 2>&1 | rg -v "^\.next/" | head -40
```

Expected: no new errors.

- [ ] **Step 10: Visual verification**

With the dev server running, open `http://localhost:3000/en/cars/porsche?family=992` in the browser.

Check each of these visible labels:

| Element | Expected |
|---|---|
| Sidebar `992` header | "N cars" where N is the DB total for 992 (likely > 50) |
| "Cars" position indicator | `1/N` where N is the DB total |
| Feed header (above first car) | "N cars" matching sidebar |
| Latest Listings green badge | Integer equal to live-only 992 count |

Then click a variant chip (e.g. GT3). All four numbers should update to reflect the filtered subset.

Then change region (US/EU/UK/JP). Numbers should update again.

If any counter shows "—" for more than ~500ms after the first page loads, that's a bug — report and debug before committing.

- [ ] **Step 11: Commit**

```bash
git add src/app/[locale]/cars/[make]/MakePageClient.tsx
git commit -m "feat(monza): use absolute counts in MakePageClient

All five visible counters (sidebar header, position indicator, feed
header, Latest Listings badge, mobile total-live prop) now read the
DB-backed totals from useInfiniteAuctions instead of array lengths.
Loading state shows '—' instead of a partial array length."
```

---

## Task 6: Classic view `/browse` uses absolute counts

**Files:**
- Modify: `src/app/[locale]/browse/page.tsx:55`
- Modify: `src/components/browse/BrowseClient.tsx:134-140, 235-238`

Classic view has all the data it needs already (`data.liveNow`, `data.seriesCounts`). No API or bridge changes. This task is purely a UI rewiring.

- [ ] **Step 1: Pass `liveNow` from the page to the client**

In `src/app/[locale]/browse/page.tsx`, at line 55:

```tsx
return <BrowseClient auctions={data.auctions} seriesCounts={data.seriesCounts} />;
```

Change to:

```tsx
return <BrowseClient auctions={data.auctions} seriesCounts={data.seriesCounts} liveNow={data.liveNow} />;
```

- [ ] **Step 2: Extend `BrowseClient` props**

In `src/components/browse/BrowseClient.tsx` at line 134-140:

```tsx
export function BrowseClient({
  auctions,
  seriesCounts,
}: {
  auctions: DashboardAuction[];
  seriesCounts: Record<string, number>;
}) {
```

Change to:

```tsx
export function BrowseClient({
  auctions,
  seriesCounts,
  liveNow,
}: {
  auctions: DashboardAuction[];
  seriesCounts: Record<string, number>;
  liveNow: number;
}) {
```

- [ ] **Step 3: Compute `filteredTotal`**

Immediately after the `filtered` useMemo ends (line 202, right after `}, [auctions, query, seriesFilter, statusFilter, sortBy]);`), add:

```tsx
const filteredTotal = useMemo(() => {
  // No filter → absolute total from DB.
  if (statusFilter === "all" && seriesFilter === "all" && !query.trim()) {
    return liveNow;
  }
  // Series-only filter → DB per-series count.
  if (statusFilter === "all" && seriesFilter !== "all" && !query.trim()) {
    return seriesCounts[seriesFilter] ?? filtered.length;
  }
  // Status or search filter → DB aggregates don't cover these.
  // Fall back to the loaded-batch count.
  return filtered.length;
}, [statusFilter, seriesFilter, query, liveNow, seriesCounts, filtered.length]);
```

- [ ] **Step 4: Update the header counter**

At line 234-239:

```tsx
<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
  <span className="tabular-nums text-foreground font-medium">{filtered.length}</span>
  <span>of</span>
  <span className="tabular-nums">{auctions.length}</span>
  <span>vehicles</span>
</div>
```

Change to:

```tsx
<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
  <span className="tabular-nums text-foreground font-medium">{filteredTotal}</span>
  <span>of</span>
  <span className="tabular-nums">{liveNow}</span>
  <span>vehicles</span>
</div>
```

- [ ] **Step 5: Leave the load-more label unchanged**

Verify line 399 still reads:

```tsx
Load more ({filtered.length - visibleCount} remaining)
```

**Do not modify this line.** See the spec for rationale: the button's implied action is "reveal more already-loaded cards," and the label must reflect that, not the DB delta.

- [ ] **Step 6: TypeScript check**

Run:

```bash
npx tsc --noEmit 2>&1 | rg -v "^\.next/" | head -40
```

Expected: no new errors.

- [ ] **Step 7: Visual verification**

With the dev server running, open `http://localhost:3000/en/browse`.

Check:

| Element | Expected |
|---|---|
| Page header "X of Y vehicles" | Y = DB total of active Porsches (from `liveNow`), not the batch size (~200) |
| After clicking a series chip (e.g. 992) | X updates to `seriesCounts["992"]` |
| After typing in search | X degrades to `filtered.length` (loaded-batch) — this is expected, see spec |
| Load more button | Still says "Load more (N remaining)" where N is the slice remaining in the loaded set — unchanged |

- [ ] **Step 8: Commit**

```bash
git add src/app/[locale]/browse/page.tsx src/components/browse/BrowseClient.tsx
git commit -m "feat(browse): use absolute counts in Classic view header

BrowseClient now reads liveNow and seriesCounts (both already fetched
by dashboardCache) instead of deriving counts from the loaded batch.
The 'Load more' button label stays tied to the loaded batch so the
button's implied action matches reality — see spec for rationale."
```

---

## Task 7: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all existing tests pass. If any test fails with a reference to `fetchPaginatedListings` or `useInfiniteAuctions`, the new fields likely broke a shape assertion — update the test to include `totalCount: null, totalLiveCount: null` where appropriate.

- [ ] **Step 2: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1 | rg -v "^\.next/" | tee /tmp/tsc-out.txt | head -80
wc -l /tmp/tsc-out.txt
```

Expected: line count unchanged (or decreased) versus baseline. No new errors.

- [ ] **Step 3: Lint**

```bash
npx eslint src/lib/supabaseLiveListings.ts src/app/api/mock-auctions/route.ts src/hooks/useInfiniteAuctions.ts src/app/\[locale\]/cars/\[make\]/MakePageClient.tsx src/components/browse/BrowseClient.tsx src/app/\[locale\]/browse/page.tsx
```

Expected: no new errors.

- [ ] **Step 4: Production build sanity check**

```bash
rm -rf .next
npm run build 2>&1 | tail -40
```

Expected: build succeeds. Route table should still list `/api/mock-auctions` and both page routes.

- [ ] **Step 5: Perf spot-check**

With the dev server running, open DevTools Network tab and reload `http://localhost:3000/en/cars/porsche?family=992`. Find the first `/api/mock-auctions?...` request.

- Record response time. It should be within ~100ms of the pre-change baseline (no `count: 'exact'` regression). If it's noticeably slower (> 500ms), something is wrong — `count: 'planned'` should be cheap.
- Confirm the response body contains both `totalCount` and `totalLiveCount`.

- [ ] **Step 6: Cross-check with the spec's success criteria**

Walk through the spec's Success Criteria section:

1. `/cars/porsche?family=992` shows N > 50 ✓
2. Variant chip click updates counts ✓
3. `/browse` header Y = `liveNow` (DB total) ✓
4. Classic series chip updates X to DB series count ✓
5. Page load < 100ms regression ✓
6. No counter reads 50 or the batch size unless the true total equals that ✓

- [ ] **Step 7: No-op commit (optional, records verification)**

If no code was changed during verification, skip this step. If any fixup was needed:

```bash
git add -u
git commit -m "chore: post-implementation fixups from verification pass"
```

---

## Rollback plan

If something regresses in production, revert the three commits in reverse order:

```bash
git revert <task-6-sha> <task-5-sha> <task-4-sha> <task-3-sha> <task-2-sha> <task-1-sha>
```

Or cherry-pick just the Monza-view commits (Tasks 1-5) if Classic view alone is broken — each task is self-contained.

## Notes for the implementer

- This plan assumes the brandConfig/extractSeries layer is stable. Don't alter it.
- `count: 'planned'` relies on Postgres planner statistics. If counts look wildly off (e.g. showing 500 when there are clearly fewer), the team may need to run `ANALYZE listings` in Supabase. That's an operational action, not a code change.
- The HEAD count query in Task 2 adds one extra DB round-trip. Executed in parallel with the main query, it contributes essentially zero latency. If integration reveals otherwise, the escape hatch is to set `totalLiveCount = totalCount` when `status === 'active'` (the common case) — but do not do this preemptively.
