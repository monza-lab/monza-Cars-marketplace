# Absolute Car Counts in MakePageClient

**Date:** 2026-04-18
**Status:** Approved for implementation planning
**Scope:** Frontend + API + Supabase bridge (no schema changes)

## Problem

On the series page (e.g. `/cars/porsche?family=992`), every count label in the UI shows `50` — the page size of the paginated loader — instead of the true number of matching listings in Supabase. This is misleading: users seeing "50 cars" assume there are only 50 992s in the database, when there may be hundreds.

The pagination limit exists for performance (loading thousands of listings upfront would be slow). The limit itself is correct; only the **displayed count** is wrong. Users should see absolute totals while the loader continues to fetch 50 cars at a time on scroll.

## Goal

Every visible counter on `MakePageClient` reflects the absolute total of matching listings in Supabase, respecting all active filters. The counter updates when filters change.

## Non-Goals

- No new count badges (e.g. per-variant chip counts like `GT3 (28)`). Only update existing counters.
- No change to pagination behavior — still 50 listings per page on scroll.
- No changes to the Dashboard home page — it already uses `dbSeriesCounts` correctly.
- No schema changes.

## Design

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

1. `src/lib/supabaseLiveListings.ts` — `fetchPaginatedListings()` add `count: 'planned'`, return `totalCount` and `totalLiveCount` (via a second HEAD count query for ACTIVE/ENDING_SOON).
2. `src/app/api/mock-auctions/route.ts` — include `totalCount` and `totalLiveCount` in paginated response.
3. `src/lib/hooks/useInfiniteAuctions.ts` (or wherever the hook lives) — pass through both counts from API response (verify existing shape; extend if needed).
4. `src/app/[locale]/cars/[make]/MakePageClient.tsx` — replace five display sites with `displayTotal` / `displayLiveTotal`, add null/loading state.

## Testing

- Unit: `fetchPaginatedListings()` returns `totalCount` and `totalLiveCount` from Supabase response, handles null case.
- Integration: `/api/mock-auctions?family=992` response includes both counts.
- Integration: `/api/mock-auctions?family=992&variant=gt3` returns smaller counts than unfiltered.
- Integration: `totalLiveCount ≤ totalCount` always.
- Visual: series page shows absolute counts, not 50. Filter changes update both counts.

## Success criteria

1. Loading `/cars/porsche?family=992` shows `N cars` where N > 50 (for any family with > 50 listings).
2. Clicking any variant chip or filter immediately changes the count to the filtered absolute total.
3. Page load time is not noticeably slower (< 100ms regression).
4. No counter ever reads `50` unless the true filtered total is 50.
