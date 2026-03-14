# Fast Page Load — Decouple Series Counts from Critical Path

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard page renders in <5 seconds by removing `fetchSeriesCounts` (28 Supabase requests) from the blocking critical path.

**Architecture:** Split the dashboard API into two concerns: (1) the main `/api/mock-auctions` response returns immediately with auctions + aggregate counts (fast); (2) series counts come from a new `/api/series-counts` endpoint with 10-minute HTTP caching, fetched non-blocking after the page renders.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase PostgREST, React `useState`/`useEffect`

---

## Root Cause

`/api/mock-auctions` runs this `Promise.all` before returning **any** response:

```typescript
// src/app/api/mock-auctions/route.ts line 147
const [live, aggregates, seriesCounts] = await Promise.all([
  fetchLiveListingsAsCollectorCars({ limit: 500 }),   // ~7 requests — fast
  fetchLiveListingAggregateCounts({ make }),           // 9 COUNT queries — fast
  fetchSeriesCounts(requestedMake ?? "Porsche"),       // 1 + 27 requests — SLOW
]);
```

`fetchSeriesCounts` fetches 26,905 rows in 27 parallel Supabase requests (Supabase caps `.range()` at 1,000 rows). The page spinner shows until **all 28** requests finish. Average cold-cache time: 3–8 seconds.

## Fix: Progressive Loading

```
Before:  /api/mock-auctions → [auctions + aggregates + seriesCounts] → render
After:   /api/mock-auctions → [auctions + aggregates] → render (fast)
         /api/series-counts → [seriesCounts] → update UI (non-blocking, cached)
```

---

## Files to Modify / Create

| File | Action | What changes |
|------|--------|--------------|
| `src/app/api/series-counts/route.ts` | **Create** | New endpoint returns `seriesCounts`, sets `Cache-Control: s-maxage=600, stale-while-revalidate=3600` |
| `src/app/api/mock-auctions/route.ts` | **Modify** | Remove `fetchSeriesCounts` from `Promise.all`; remove it from both response objects |
| `src/app/[locale]/page.tsx` | **Modify** | Render `DashboardClient` as soon as auctions arrive; fetch series counts separately in a second `useEffect` and update state |

---

## Task 1: Create `/api/series-counts` endpoint

**Files:**
- Create: `src/app/api/series-counts/route.ts`

The new route calls `fetchSeriesCounts` and returns the result with HTTP cache headers so the CDN/browser caches it for 10 minutes (stale-while-revalidate means the browser serves the stale cached value immediately and revalidates in the background).

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/series-counts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchSeriesCounts } from "@/lib/supabaseLiveListings";
import { normalizeSupportedMake, resolveRequestedMake } from "@/lib/makeProfiles";

export async function GET(request: NextRequest) {
  const make = request.nextUrl.searchParams.get("make") || "";

  const requestedMake = make && make !== "All Makes"
    ? normalizeSupportedMake(make)
    : resolveRequestedMake(null);

  const seriesCounts = await fetchSeriesCounts(requestedMake ?? "Porsche");

  return NextResponse.json(
    { seriesCounts },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
      },
    }
  );
}
```

- [ ] **Step 2: Verify the route responds correctly**

Open browser or curl: `http://localhost:3000/api/series-counts?make=Porsche`

Expected: JSON response `{ "seriesCounts": { "992": 3500, "991": 2100, ... } }` within a few seconds (cold cache). Response headers should include `Cache-Control: public, s-maxage=600, stale-while-revalidate=3600`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/series-counts/route.ts
git commit -m "feat(api): add /api/series-counts endpoint with 10min HTTP cache"
```

---

## Task 2: Remove `fetchSeriesCounts` from `/api/mock-auctions`

**Files:**
- Modify: `src/app/api/mock-auctions/route.ts`

Remove `fetchSeriesCounts` from both the import and the `Promise.all`. Also remove `seriesCounts` from both response bodies (non-paginated path only — the paginated path never had it).

- [ ] **Step 1: Remove `fetchSeriesCounts` import and usages**

In `src/app/api/mock-auctions/route.ts`:

1. Line 10 — remove `fetchSeriesCounts` from the import:
```typescript
// Before:
import {
  fetchLiveListingAggregateCounts,
  fetchLiveListingsAsCollectorCars,
  fetchPaginatedListings,
  fetchSeriesCounts,
} from "@/lib/supabaseLiveListings";

// After:
import {
  fetchLiveListingAggregateCounts,
  fetchLiveListingsAsCollectorCars,
  fetchPaginatedListings,
} from "@/lib/supabaseLiveListings";
```

2. Lines 147–158 — remove `fetchSeriesCounts` from `Promise.all`:
```typescript
// Before:
const [live, aggregates, seriesCounts] = await Promise.all([
  fetchLiveListingsAsCollectorCars({
    limit: PER_SOURCE_BUDGET,
    includePriceHistory: false,
    make: requestedMake,
    includeAllSources: true,
  }),
  fetchLiveListingAggregateCounts({ make: requestedMake }),
  fetchSeriesCounts(requestedMake ?? "Porsche"),
]);

// After:
const [live, aggregates] = await Promise.all([
  fetchLiveListingsAsCollectorCars({
    limit: PER_SOURCE_BUDGET,
    includePriceHistory: false,
    make: requestedMake,
    includeAllSources: true,
  }),
  fetchLiveListingAggregateCounts({ make: requestedMake }),
]);
```

3. Lines 247–252 — remove `seriesCounts` from the response:
```typescript
// Before:
  aggregates: {
    liveNow: aggregates.liveNow,
    regionTotals: aggregates.regionTotalsByPlatform,
    seriesCounts,
  },

// After:
  aggregates: {
    liveNow: aggregates.liveNow,
    regionTotals: aggregates.regionTotalsByPlatform,
  },
```

- [ ] **Step 2: Verify the endpoint is faster**

Open: `http://localhost:3000/api/mock-auctions`

Expected: Response arrives in <2 seconds. JSON has `auctions` array and `aggregates` with `liveNow` + `regionTotals` but **no** `seriesCounts` key.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mock-auctions/route.ts
git commit -m "perf(api): remove fetchSeriesCounts from mock-auctions critical path"
```

---

## Task 3: Update `page.tsx` for non-blocking series counts

**Files:**
- Modify: `src/app/[locale]/page.tsx`

Currently `HomeContent` shows a spinner until ALL data (including series counts) has loaded. After this task:
- Spinner shows until `auctions` + `aggregates` arrive (fast)
- `DashboardClient` renders immediately with `seriesCounts={undefined}`
- A second `useEffect` fetches `/api/series-counts` non-blocking and updates `seriesCounts` state
- `DashboardClient` re-renders with exact counts when they arrive (usually <2s later)

The `DashboardClient` already handles `seriesCounts={undefined}` gracefully — it falls back to sample counts until exact counts arrive.

- [ ] **Step 1: Update `HomeAggregates` type — remove `seriesCounts`**

`seriesCounts` no longer comes from the auctions endpoint, so remove it from `HomeAggregates`:

```typescript
// Before:
type HomeAggregates = {
  liveNow: number;
  regionTotals: LiveRegionTotals;
  seriesCounts?: Record<string, number>;
};

// After:
type HomeAggregates = {
  liveNow: number;
  regionTotals: LiveRegionTotals;
};
```

- [ ] **Step 2: Update `normalizeAuctionPayload` — remove `seriesCounts` extraction**

```typescript
// Before (in normalizeAuctionPayload):
      seriesCounts: aggregatePayload.seriesCounts as Record<string, number> | undefined,

// After — remove that line entirely. aggregates object becomes:
  const aggregates = aggregatePayload
    ? {
        liveNow: typeof aggregatePayload.liveNow === "number" ? aggregatePayload.liveNow : auctions.length,
        regionTotals: {
          all: Number(aggregatePayload?.regionTotals?.all ?? auctions.length),
          US: Number(aggregatePayload?.regionTotals?.US ?? 0),
          UK: Number(aggregatePayload?.regionTotals?.UK ?? auctions.length),
          EU: Number(aggregatePayload?.regionTotals?.EU ?? 0),
          JP: Number(aggregatePayload?.regionTotals?.JP ?? auctions.length),
        },
      }
    : undefined;
```

- [ ] **Step 3: Add a `fetchSeriesCountsFromApi` helper function**

Add this function above `HomeContent` (alongside the existing `fetchAuctionsWithFallback`):

```typescript
async function fetchSeriesCountsFromApi(make = "Porsche"): Promise<Record<string, number>> {
  const localePrefix = typeof window === "undefined"
    ? ""
    : getLocalePrefixFromPathname(window.location.pathname);

  try {
    const res = await fetch(`${localePrefix}/api/series-counts?make=${encodeURIComponent(make)}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const payload = await res.json();
    return payload?.seriesCounts ?? {};
  } catch {
    return {};
  }
}
```

- [ ] **Step 4: Update `HomeContent` to render immediately and load series counts in background**

Replace the current `HomeContent` implementation:

```typescript
function HomeContent({
  loadingLabel,
  emptyLabel,
}: {
  loadingLabel: string;
  emptyLabel: string;
}) {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [aggregates, setAggregates] = useState<HomeAggregates | undefined>(undefined);
  const [seriesCounts, setSeriesCounts] = useState<Record<string, number> | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // Critical path: fetch auctions + aggregates. Renders as soon as this resolves.
  useEffect(() => {
    async function fetchAuctions() {
      try {
        const fetched = await fetchAuctionsWithFallback();
        setAuctions(fetched.auctions);
        setAggregates(fetched.aggregates);
      } catch (error) {
        console.error("Failed to fetch auctions:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAuctions();
  }, []);

  // Non-blocking: fetch exact series counts separately, update when ready.
  useEffect(() => {
    fetchSeriesCountsFromApi().then(counts => {
      if (Object.keys(counts).length > 0) {
        setSeriesCounts(counts);
      }
    });
  }, []);

  if (loading) {
    return <MonzaInfinityLoader />;
  }

  if (auctions.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <span className="text-muted-foreground text-sm">{emptyLabel}</span>
      </div>
    );
  }

  return (
    <DashboardClient
      auctions={auctions}
      liveRegionTotals={aggregates?.regionTotals}
      liveNowTotal={aggregates?.liveNow}
      seriesCounts={seriesCounts}
    />
  );
}
```

Note: the existing `setSeriesCounts` line in the first `useEffect` should be **removed** since `seriesCounts` no longer comes from the auctions payload.

- [ ] **Step 5: Verify loading behaviour**

1. Open DevTools → Network tab
2. Reload `http://localhost:3000`
3. Confirm: dashboard renders in <3 seconds (auctions appear without waiting for series counts)
4. Confirm: ~1–2 seconds later the family counts update from sample counts to exact DB counts
5. Reload again: series counts should update almost instantly (HTTP cache hit on `/api/series-counts`)

- [ ] **Step 6: Commit**

```bash
git add src/app/[locale]/page.tsx
git commit -m "perf(dashboard): load series counts non-blocking after initial render"
```

---

## Expected Result

| Scenario | Before | After |
|----------|--------|-------|
| Cold cache (first ever load) | 5–8s spinner | <2s render + counts update 2s later |
| Warm module cache (same process) | ~1s | <2s render + counts instant |
| Warm HTTP cache (after first load) | ~1s | <2s render + counts instant |
| Region switch | Instant (client-side) | Instant (client-side) |
