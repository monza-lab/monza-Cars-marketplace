# Absolute Car Counts in Monza and Classic Views

**Date:** 2026-04-18
**Status:** Approved for implementation planning
**Scope:** Frontend + API + Supabase bridge (no schema changes)

## Problem

Two views show misleading "array-length" counts instead of true database totals:

**1. Monza view — series page (`/cars/porsche?family=992`)**
Every count label shows `50` (the paginated page size). Users see "50 cars" and assume there are only 50 992s in the database.

**2. Classic view — browse page (`/browse`)**
The header shows `{filtered.length} of {auctions.length} vehicles` where `auctions.length` is the upfront batch size (`DASHBOARD_LISTING_LIMIT`), not the true total of active Porsches in the database. The "Load more (X remaining)" button at the bottom of the grid shows `filtered.length - visibleCount`, which is the slice remaining in the already-loaded array — not a database total.

The pagination limits exist for performance (loading thousands of listings upfront would be slow). The limits themselves are correct; only the **displayed counts** are wrong. Users should see absolute totals while the loaders continue to work as they do today.

## Goal

Every visible counter in `MakePageClient` (Monza view) and `BrowseClient` (Classic view) reflects the absolute total of matching listings in Supabase. Counters update when filters change.

## Non-Goals

- No new count badges (e.g. per-variant chip counts like `GT3 (28)`). Only update existing counters.
- No change to pagination behavior — Monza still fetches 50 per page on scroll, Classic still slices locally from its initial batch.
- No changes to the Dashboard home page — it already uses `dbSeriesCounts` correctly.
- No schema changes.
- **Load-more button semantics in Classic view stay local.** The button shows how many cards remain in the already-loaded set, not the delta to a database total. See "Classic view: load-more label" below for the rationale.

## Design — Monza view (`MakePageClient`)

### Count precision: `planned`

Supabase's `count` options trade accuracy for speed:

- `exact` — COUNT(*) on the filtered set. Slow on large tables. **Previously removed for this reason.**
- `estimated` — uses Postgres planner statistics. Fast, ±5-10% accuracy.
- `planned` — fastest, uses planner estimates only. Accuracy depends on statistics freshness.

**We use `planned`.** Counts are visual (not used for logic), performance is the priority, and the number shown only needs to be realistic — not exact to the unit. A user seeing "214 cars" when there are actually 218 is acceptable. A page that takes 800ms longer to load is not.

### Three-layer change

**Layer 1 — Supabase bridge (`src/lib/supabaseLiveListings.ts`)**

`fetchPaginatedListings()` currently removes `count: 'exact'` to avoid full-table scans (line ~1471). Replace with `count: 'planned'`:

```ts
const query = supabase
  .from("listings")
  .select(LISTINGS_COLUMNS, { count: "planned" })  // was: no count
  ...
```

The function returns two new fields:

```ts
{
  auctions: CollectorCar[],
  nextCursor: string | null,
  hasMore: boolean,
  totalCount: number | null,       // NEW — planned count for the full filtered query
  totalLiveCount: number | null,   // NEW — planned count restricted to ACTIVE/ENDING_SOON
}
```

Two separate counts are needed because the UI distinguishes between:
- **All matching cars** (header, position indicator, feed header) — reflects the full filtered set.
- **Live auctions only** (Latest Listings sidebar badge) — reflects `status IN ('ACTIVE', 'ENDING_SOON')`.

Implementation: the bridge runs the main paginated query (returns rows + planned count), plus a second **HEAD-only** count query with an added `status IN (...)` filter. HEAD queries don't return rows, only the count — fast and cheap.

Both counts may be `null` if Supabase doesn't return a count (e.g. fallback path without joins). UI must handle null.

**Layer 2 — API route (`src/app/api/mock-auctions/route.ts`)**

The paginated path currently has a comment `// totalCount intentionally omitted` (~line 162). Remove the comment and include `totalCount` in the response:

```ts
{
  auctions,
  nextCursor,
  hasMore,
  totalCount,       // NEW — all matching
  totalLiveCount,   // NEW — live-only subset
}
```

Filters (family, variant, region, year, mileage, transmission, price) are already applied to the query; both counts reflect the same filtered set automatically.

**Layer 3 — UI (`src/app/[locale]/cars/[make]/MakePageClient.tsx`)**

Replace four display sites:

| Line | Current | Change to | Source |
|---|---|---|---|
| 903 | `totalLiveCount={liveCars.length}` | `totalLiveCount={displayLiveTotal}` | `totalLiveCount` from API |
| 956 | `{infiniteTotalCount ?? familyCars.length} cars` | `{displayTotal} cars` | `totalCount` |
| 1005 | `{activeCarIndex + 1}/{variantFilteredFeedCars.length}` | `{activeCarIndex + 1}/{displayTotal}` | `totalCount` |
| 1088-1090 | `{liveCars.length}` (Latest Listings badge) | `{displayLiveTotal}` | `totalLiveCount` |
| 1168 | `{variantFilteredFeedCars.length} cars` | `{displayTotal} cars` | `totalCount` |

Where the derived values are:

```ts
const displayTotal = infiniteTotalCount ?? null
const displayLiveTotal = infiniteTotalLiveCount ?? null
```

**Loading and null handling:** Show `—` (em dash) or a skeleton when either value is `null`. Never show `50` or any partial array length as a fallback. Better to show a placeholder for 200ms than a wrong number.

**Note on the empty-state check at line 1096 (`liveCars.length === 0`):** this check controls UI rendering (empty state vs. list), not a displayed number. Keep it as-is — it reflects whether the loaded live subset has anything to render, which is the correct semantic for that branch.

**When filters change:** the `useInfiniteAuctions` hook refetches with new filter params. The first page response carries the new `totalCount`. The counter transitions through `—` (loading) then to the new absolute value.

### Filter interaction

When the user applies `variant=GT3`, the API query becomes `series=992 AND variant=GT3`. The planned count reflects this filtered set. Example: total 992s = 214, total 992 GT3s = 28. Clicking the GT3 chip changes header from `214 cars` to `28 cars`.

Region, price, year, mileage, and transmission filters behave identically — the counter always reflects the intersection of all active filters.

### Position indicator `1/N`

With absolute total, `1/342` means "position 1 of 342 total matching cars." When the user scrolls past the 50th loaded car, the hook fetches page 2; the indicator continues to count against 342 throughout. If the user reaches the end of loaded results without more pages available (`hasMore: false`), the final position equals `342/342`.

## Design — Classic view (`BrowseClient`)

Classic view has a different architecture than Monza: the page server-loads a single capped batch of active Porsches (`DASHBOARD_LISTING_LIMIT`, currently ~200) plus two aggregates from the database — `aggregates.liveNow` (total active Porsches) and `seriesCounts` (per-series active totals). All filtering (search, status, series, sort) runs client-side on the loaded batch. The "Load more" button slices further into the already-loaded array; it does not fetch from the database.

### Data already available

`/browse` receives these from `fetchDashboardDataUncached()` via `DashboardData`:
- `auctions: DashboardAuction[]` — loaded batch (capped).
- `liveNow: number` — absolute count of active Porsches in DB (from `fetchLiveListingAggregateCounts`).
- `seriesCounts: Record<string, number>` — absolute per-series counts (from `fetchSeriesCounts`).

No API or data-fetch changes are required for Classic view. The fix is purely a UI rewiring to prefer these absolute counts over `.length`.

### UI changes in `src/components/browse/BrowseClient.tsx`

| Line | Current | Change to | Rationale |
|---|---|---|---|
| 235 | `<span>{filtered.length}</span>` | `<span>{filteredTotal}</span>` | See derivation below |
| 237 | `<span>{auctions.length}</span>` | `<span>{liveNow}</span>` | Absolute active total from DB |
| 399 | `Load more ({filtered.length - visibleCount} remaining)` | unchanged | Local slice; see below |

**Deriving `filteredTotal`:**

```ts
const filteredTotal = useMemo(() => {
  // No filter → show the absolute total.
  if (statusFilter === "all" && seriesFilter === "all" && !query.trim()) {
    return liveNow;
  }
  // Only a series filter → use the DB series count.
  if (statusFilter === "all" && seriesFilter !== "all" && !query.trim()) {
    return seriesCounts[seriesFilter] ?? filtered.length;
  }
  // Any other combination involves client-only filters (status, search)
  // that the database aggregates don't cover. Fall back to the loaded count.
  return filtered.length;
}, [statusFilter, seriesFilter, query, liveNow, seriesCounts, filtered.length]);
```

Accept imprecision for status/search filters rather than introducing a second round-trip to the database. The header reads e.g. `145 of 342 vehicles` — honest for unfiltered and series-only views, degrades gracefully for status/search filters to match the loaded-batch behavior. This is consistent with the spec's principle: counts are visual, not load-bearing.

**Props:** add `liveNow: number` to `BrowseClient`'s props. `seriesCounts` is already passed. Wire `liveNow` through from `BrowsePage` (`data.liveNow` is already computed).

### Classic view: load-more label

The button's implied action is "reveal more cards I can render right now" — i.e. extend `visibleCount`. That action can only reach cards already in `auctions[]`. Labeling it with a database delta (e.g. `Load more (200 remaining)` when there are only 50 left in the batch) would mislead users into clicking a button that can't deliver on the promise.

Keeping the label tied to the loaded batch (`filtered.length - visibleCount`) is honest about what the button will do. When the user exhausts the batch, the button disappears (existing `hasMore` logic) — at that point the header still reads e.g. `200 of 342 vehicles`, which is sufficient disclosure that the loaded batch is not exhaustive.

A follow-up that switches Classic view to true server pagination (and then re-labels the button meaningfully) is out of scope for this spec.

## Edge cases

- **Fallback query path** (Supabase PostgREST schema cache stale, `fetchLiveListingsAsCollectorCars` fallback without joins): may not return a count. Return `totalCount: null`; UI shows `—`.
- **Zero results**: `totalCount: 0` → UI shows `0 cars`, list shows empty state.
- **Region filter changes mid-scroll**: refetch from page 1 with new filters; `totalCount` updates to new filtered value.
- **Rapid filter changes** (user clicking multiple chips quickly): use the latest request's `totalCount`; discard stale in-flight responses. The existing hook should already handle this via its request keying.

## Out-of-scope items worth noting for later

These are NOT part of this spec but may be natural follow-ups:

- Adding per-chip counts to variant filters (e.g. `Carrera (89) · GT3 (28)`).
- Showing filter-facet counts in the sidebar (e.g. `2020-2024 (47)`).
- Upgrading from `planned` to `exact` when a specific page requires exact numbers (e.g. an admin/reporting view).

## Files to modify

**Monza view:**
1. `src/lib/supabaseLiveListings.ts` — `fetchPaginatedListings()` add `count: 'planned'`, return `totalCount` and `totalLiveCount` (via a second HEAD count query for ACTIVE/ENDING_SOON).
2. `src/app/api/mock-auctions/route.ts` — include `totalCount` and `totalLiveCount` in paginated response.
3. `src/lib/hooks/useInfiniteAuctions.ts` (or wherever the hook lives) — pass through both counts from API response (verify existing shape; extend if needed).
4. `src/app/[locale]/cars/[make]/MakePageClient.tsx` — replace five display sites with `displayTotal` / `displayLiveTotal`, add null/loading state.

**Classic view:**
5. `src/app/[locale]/browse/page.tsx` — pass `liveNow={data.liveNow}` to `BrowseClient`.
6. `src/components/browse/BrowseClient.tsx` — accept `liveNow` prop, compute `filteredTotal`, update header counts. Load-more label unchanged.

## Testing

**Monza view:**
- Unit: `fetchPaginatedListings()` returns `totalCount` and `totalLiveCount` from Supabase response, handles null case.
- Integration: `/api/mock-auctions?family=992` response includes both counts.
- Integration: `/api/mock-auctions?family=992&variant=gt3` returns smaller counts than unfiltered.
- Integration: `totalLiveCount ≤ totalCount` always.
- Visual: series page shows absolute counts, not 50. Filter changes update both counts.

**Classic view:**
- Visual: `/browse` header shows `N of M vehicles` where M = absolute active total (not the batch size).
- Visual: selecting a series chip changes the header to the DB per-series count.
- Visual: status or search filters degrade to loaded-batch counts (documented, not a bug).
- Visual: "Load more (X remaining)" still reflects the loaded batch — clicking always reveals X more cards.

## Success criteria

1. Loading `/cars/porsche?family=992` shows `N cars` where N > 50 (for any family with > 50 listings).
2. Clicking any variant chip or filter on the Monza series page immediately changes the count to the filtered absolute total.
3. `/browse` (Classic view) header shows `X of Y vehicles` where Y equals the database-reported total of active Porsches, not the loaded batch size.
4. Selecting a series chip in Classic view updates the `X of Y` numbers to reflect the DB series count.
5. Page load time is not noticeably slower (< 100ms regression) in either view.
6. No counter ever reads `50` (Monza) or the batch size (Classic) unless the true filtered total happens to equal that number.
