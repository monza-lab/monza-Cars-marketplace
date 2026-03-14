# Performance Optimization: Offset Pagination + Infinite Scroll + Lazy Images

**Date:** 2026-03-14
**Status:** Draft
**Problem:** App becomes unusably slow after enabling all 26,905 Supabase listings. Root causes: no pagination (full dataset fetched in one request), all cards rendered to DOM at once, `priority` on every image, `unoptimized` bypassing Next.js image optimization.

---

## 1. API Layer — Offset-Based Pagination

### 1.1 New Query Parameters

**File:** `src/app/api/mock-auctions/route.ts`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `pageSize` | number | `50` | Items per page (max `200`) |
| `cursor` | string | `null` | Base64-encoded offset cursor from previous response |
| `region` | string | `null` | Region filter (`US`, `EU`, `UK`, `JP`) |
| `platform` | string | `null` | Platform filter (`BRING_A_TRAILER`, etc.) |
| `query` | string | `null` | Text search on title/model |
| `sortBy` | string | `endTime` | Sort field |
| `sortOrder` | string | `asc` | Sort direction |

Existing params (`make`, `grade`, `status`, `category`) remain unchanged.

**Note on `family` filter:** The `listings` table has no `family` or `series` column. Series is derived client-side via `extractSeries(model, year, make)` from `brandConfig.ts`. Family filtering remains a client-side post-filter applied after fetching each page. The hook fetches pages until enough matching cars are accumulated (see Section 2.1).

### 1.2 Response Shape

```ts
{
  auctions: TransformedAuction[], // pageSize items (existing inline shape, 1 image each)
  nextCursor: string | null,      // null = last page
  hasMore: boolean,
  aggregates: {                   // from fetchLiveListingAggregateCounts (first request only)
    liveNow: number,
    regionTotals: { all, US, EU, UK, JP }
  }
}
```

`TransformedAuction` is the existing inline transform shape already used in `route.ts` (id, title, year, make, model, trim, engine, transmission, mileage, mileageUnit, location, platform, status, currentBid, bidCount, endTime, images, sourceUrl, investmentGrade, trend, trendValue, category, region). No new type needed.

**Totals:** The `aggregates` object (from `fetchLiveListingAggregateCounts()`) is included only on the **first page** response. Subsequent pages omit it to avoid redundant COUNT queries on every scroll. The client caches the aggregates from page 1.

### 1.3 Cursor Implementation

The cursor encodes an offset position for simple, deterministic pagination:

```ts
// Encode: after returning page N
const nextOffset = currentOffset + pageSize;
const nextCursor = btoa(JSON.stringify({ offset: nextOffset }));

// Decode: on next request
const { offset } = JSON.parse(atob(cursor));
// Supabase: .range(offset, offset + pageSize - 1)
```

Offset pagination is used instead of keyset because:
- Many rows have `null` values for `end_time` and `sale_date`, making keyset ordering fragile
- Supabase `.range()` natively supports offset pagination
- Dataset size (26K) is well within offset pagination's performance range

### 1.4 Backend Changes to `supabaseLiveListings.ts`

Add a new function `fetchPaginatedListings()`:

```ts
export async function fetchPaginatedListings(options: {
  make: string;
  pageSize?: number;        // default 50
  offset?: number;          // default 0 (decoded from cursor by caller)
  region?: string | null;   // DB filter on country column
  platform?: string | null; // DB filter on source/platform columns
  query?: string | null;    // DB filter: .ilike on title/model
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: 'active' | 'all';
}): Promise<{
  cars: CollectorCar[];
  hasMore: boolean;
}>
```

This function:
1. Builds a single Supabase query with DB-level filters (make, region, platform, query, status)
2. Applies sort order
3. Uses `.range(offset, offset + pageSize - 1)` for pagination
4. Returns `pageSize` cars + `hasMore` flag

**Key difference from `fetchLiveListingsAsCollectorCars`:** No per-source bucketing. A single query across all sources with filters applied at the DB level. The per-source interleaving was needed when we fetched everything; with server-side filters + sort, it's unnecessary.

### 1.5 Totals Strategy

Totals displayed in tabs/headers come from `fetchLiveListingAggregateCounts()` — already exists, uses `SELECT count(*)` with `head: true`. This is a lightweight query that returns accurate counts without fetching row data.

- Called once on page load (not per scroll page)
- Returns `{ liveNow, regionTotalsByPlatform, regionTotalsByLocation }`
- These counts are the "truth" shown in the UI, independent of how many cards are loaded

---

## 2. Client Infinite Scroll

### 2.1 New Hook: `useInfiniteAuctions`

**File:** `src/hooks/useInfiniteAuctions.ts`

```ts
interface UseInfiniteAuctionsParams {
  make: string;
  family?: string;       // client-side filter via extractSeries()
  region?: string;       // passed to API as server-side filter
  platform?: string;     // passed to API as server-side filter
  query?: string;        // passed to API as server-side filter
  sortBy?: string;
  sortOrder?: string;
}

interface UseInfiniteAuctionsResult {
  cars: CollectorCar[];          // accumulated across pages, filtered by family client-side
  total: number;                 // from aggregates (DB count)
  aggregates: LiveListingAggregateCounts;
  isLoading: boolean;            // first page loading
  isFetchingMore: boolean;       // subsequent page loading
  hasMore: boolean;
  error: string | null;
  sentinelRef: RefCallback;      // attach to sentinel element
  reset: () => void;             // clear and re-fetch (on filter change)
}
```

**Behavior:**
1. On mount: fetch page 1 (API returns aggregates on first page only)
2. `IntersectionObserver` watches `sentinelRef` element (placed after last card, rootMargin: `200px`)
3. When sentinel enters viewport → fetch next page, append to `cars`
4. **Family filtering:** After each page fetch, apply `extractSeries(model, year, make)` client-side. If the matching cars from a page are fewer than expected (many filtered out), automatically fetch the next page until either `minVisible` threshold is met or no more pages exist.
5. On filter/sort change: `reset()` cancels any in-flight request, clears accumulated cars, scrolls to top (`window.scrollTo({ top: 0, behavior: 'instant' })`), and fetches fresh page 1
6. Deduplication by `car.id` to prevent duplicates across pages

### 2.2 Sentinel Element & Empty State

```tsx
{/* After the last car card */}
{hasMore && (
  <div ref={sentinelRef} className="h-20 flex items-center justify-center">
    {isFetchingMore && <Spinner />}
  </div>
)}
{!hasMore && cars.length > 0 && (
  <p className="text-center text-zinc-500 py-8">
    Showing all {cars.length} listings
  </p>
)}
{!isLoading && !hasMore && cars.length === 0 && (
  <div className="text-center text-zinc-500 py-16">
    <p>No listings found for these filters.</p>
  </div>
)}
```

### 2.3 Page Size Strategy

- **Initial load:** 50 cars (fast first paint)
- **Subsequent pages:** 50 cars each
- **Prefetch threshold:** 200px before sentinel enters viewport (IntersectionObserver rootMargin)
- **Race condition handling:** Each fetch carries a request ID; stale responses are discarded on filter/sort change

---

## 3. MakePage Changes

### 3.1 Current (slow)

```
MakePage (server):
  fetchLiveListingsAsCollectorCars({ limit: 4000 })  → 28K cars serialized as RSC props
  fetchLiveListingAggregateCounts()
  → passes cars={28KCars} to MakePageClient
```

### 3.2 After (fast)

```
MakePage (server):
  fetchLiveListingAggregateCounts()  → lightweight COUNT query only
  → passes make, initialFamily, aggregates to MakePageClient
  MakePageClient fetches its own data via useInfiniteAuctions hook
```

**Props removed from MakePageClient:** `cars` (the massive array)
**Props kept:** `make`, `initialFamily`, `initialGen`, `liveRegionTotals`, `liveNowCount`, `dbMarketData`, `dbComparables`, `dbSoldHistory`, `dbAnalyses`

### 3.3 Rendering Strategy

`MakePage` switches to dynamic rendering. Changes:
- Add `export const dynamic = 'force-dynamic'` to `page.tsx`
- Remove `generateStaticParams()` (the `CURATED_CARS` array it reads from is empty, so it produces zero static params today — vestigial code)
- Update the `notFound()` guard: instead of checking `cars.length === 0`, check whether the make is a supported live make via `isSupportedLiveMake(decodedMake)`

---

## 4. Dashboard (Home Page) — Minimal Changes

The dashboard keeps its current layout (full-height family snap cards). Changes:

1. **Reduce API fetch budget:** The dashboard only needs enough data to compute family-level aggregations (counts, sample images). Reduce `PER_SOURCE_BUDGET` back to `500` for the dashboard API call — it doesn't show individual cars.
2. **Image fixes:** Apply the same `priority`/`unoptimized` fixes (Section 5).
3. **Totals:** Continue using `aggregates.liveNow` from the API response for accurate counts.

---

## 5. Image Loading Fixes

### 5.1 Remove `unoptimized`

All image hosts are already configured in `next.config.ts` `images.remotePatterns`. The `unoptimized` prop bypasses Next.js image optimization (WebP/AVIF conversion, responsive srcset, quality reduction). Removing it enables:
- Automatic WebP/AVIF serving (30-50% smaller files)
- Responsive `srcset` generation
- Quality optimization

**Remove from:** `CarFeedCard`, `ModelFeedCard`, `FamilyCard`, `BrandCard`, `AuctionCard`
**Keep on:** None (all hosts are in remotePatterns)

### 5.2 Fix `priority` Usage

`priority` should only be on images that are above-the-fold on initial load. Currently it's on **every** card image, causing the browser to eagerly download all images.

| Component | Current | Fixed |
|-----------|---------|-------|
| `CarFeedCard` | `priority` always | No `priority`. Use default `loading="lazy"` |
| `ModelFeedCard` | `priority` always | `priority` only when `index === 0` |
| `FamilyCard` | `priority` always | `priority` only when `index === 0` |
| `BrandCard` | `priority` always | `priority` only on first visible brand |
| `AuctionCard` | No priority (good) | Keep as-is |

### 5.3 Explicit `loading="lazy"`

For cards that may be below the fold, explicitly set `loading="lazy"` to ensure browser-native lazy loading:

```tsx
<Image
  src={car.image}
  alt={car.title}
  fill
  sizes="(max-width: 768px) 100vw, 50vw"
  loading={index === 0 ? "eager" : "lazy"}
  referrerPolicy="no-referrer"
/>
```

---

## 6. Files to Modify

| File | Changes |
|------|---------|
| `src/lib/supabaseLiveListings.ts` | Add `fetchPaginatedListings()` function |
| `src/app/api/mock-auctions/route.ts` | Add cursor/pageSize params, use `fetchPaginatedListings` |
| `src/hooks/useInfiniteAuctions.ts` | **New file** — infinite scroll hook with IntersectionObserver |
| `src/app/[locale]/cars/[make]/page.tsx` | Remove `fetchLiveListingsAsCollectorCars` call, add `dynamic = 'force-dynamic'`, remove `generateStaticParams`, pass only aggregates |
| `src/app/[locale]/cars/[make]/MakePageClient.tsx` | Use `useInfiniteAuctions` instead of `cars` prop, fix image props |
| `src/components/dashboard/DashboardClient.tsx` | Fix image `priority`/`unoptimized` props |
| `src/components/auction/AuctionCard.tsx` | Remove `unoptimized` |

---

## 7. Performance Targets

| Metric | Before | Target |
|--------|--------|--------|
| Initial API payload | ~5-10 MB (28K cars) | ~150 KB (50 cars + aggregates) |
| DOM nodes on car feed | thousands (all cards) | ~50-100 (one page of cards) |
| Images loaded on mount | ALL (priority on every card) | 3-5 (above-fold only) |
| Time to interactive | 5-10s+ | < 2s |
| RSC serialization | 28K CollectorCar objects | Aggregates only (~1 KB) |

---

## 8. What This Does NOT Change

- Database queries or schema
- Scraper/collector logic
- The 26,905 listings remain fully in Supabase — all accessible via pagination
- Dashboard layout (family snap cards)
- Column A/B/C architecture
- Routing or i18n
- Auth or middleware
