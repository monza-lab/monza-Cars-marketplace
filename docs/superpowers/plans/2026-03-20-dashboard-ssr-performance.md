# Dashboard SSR + Caching Performance Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard load in under 1 second by converting from client-side rendering to server-side rendering with 5-minute caching.

**Architecture:** The home page (`/[locale]/page.tsx`) currently renders client-side — it shows a loader, fetches `/api/mock-auctions` (which fires 30+ Supabase queries), then renders. We convert to SSR: the page fetches data server-side via `unstable_cache` (5-min TTL), renders DashboardClient with data pre-loaded in HTML. On Vercel's CDN, subsequent visitors get cached HTML instantly. A `loading.tsx` provides a streaming fallback — it shows during client-side navigations and on cold-cache server renders while Supabase data loads.

**Tech Stack:** Next.js 16 (App Router), `unstable_cache` from `next/cache`, Supabase, Vercel CDN/ISR

> **Note:** `unstable_cache` still works in Next.js 16 but is being phased out in favor of the `"use cache"` directive (requires `dynamicIO` experimental flag). This plan uses `unstable_cache` for stability; migration to `"use cache"` is a future improvement.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/dashboardCache.ts` | Server-side cached data fetcher. Wraps Supabase calls in `unstable_cache` with 5-min revalidation. Transforms `CollectorCar` → `DashboardAuction` shape. |
| Create | `src/app/[locale]/loading.tsx` | Streaming fallback for cold-cache loads. Renders `MonzaInfinityLoader`. |
| Rewrite | `src/app/[locale]/page.tsx` | Convert from `"use client"` CSR to async server component. Calls cached fetch, passes data as props. |
| Modify | `src/lib/supabaseLiveListings.ts:70` | Increase `SUPABASE_TIMEOUT_MS` from 12s → 30s |
| Modify | `src/app/api/mock-auctions/route.ts:18` | Reduce `PER_SOURCE_BUDGET` from 500 → 200 |
| Modify | `src/app/api/mock-auctions/route.ts` (response) | Add `Cache-Control: s-maxage=300, stale-while-revalidate=60` header |

---

### Task 1: Create `src/lib/dashboardCache.ts` — Server-Side Cached Fetcher

**Files:**
- Create: `src/lib/dashboardCache.ts`

This module wraps the three Supabase functions (`fetchLiveListingsAsCollectorCars`, `fetchLiveListingAggregateCounts`, `fetchSeriesCounts`) in a single `unstable_cache` call. The cached result is revalidated every 5 minutes. It also transforms `CollectorCar` into the `DashboardAuction` shape that `DashboardClient` expects.

- [ ] **Step 1: Create the cached fetcher module**

```typescript
// src/lib/dashboardCache.ts
import { unstable_cache } from "next/cache";
import {
  fetchLiveListingsAsCollectorCars,
  fetchLiveListingAggregateCounts,
  fetchSeriesCounts,
} from "./supabaseLiveListings";
import { resolveRequestedMake } from "./makeProfiles";
import type { CollectorCar } from "./curatedCars";

// ─── Shape expected by DashboardClient ───

export type DashboardAuction = {
  id: string;
  title: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  price: number;
  currentBid: number;
  bidCount: number;
  viewCount: number;
  watchCount: number;
  status: string;
  endTime: string;
  platform: string;
  engine: string | null;
  transmission: string | null;
  exteriorColor: string | null;
  mileage: number | null;
  mileageUnit: string | null;
  location: string | null;
  region?: string | null;
  description: string | null;
  images: string[];
  analysis: {
    bidTargetLow: number | null;
    bidTargetHigh: number | null;
    confidence: string | null;
    investmentGrade: string | null;
    appreciationPotential: string | null;
    keyStrengths: string[];
    redFlags: string[];
  } | null;
  priceHistory: { price: number; timestamp: string }[];
  fairValueByRegion?: {
    US: { currency: "$" | "€" | "£" | "¥"; low: number; high: number };
    EU: { currency: "$" | "€" | "£" | "¥"; low: number; high: number };
    UK: { currency: "$" | "€" | "£" | "¥"; low: number; high: number };
    JP: { currency: "$" | "€" | "£" | "¥"; low: number; high: number };
  };
  category?: string;
  originalCurrency?: string | null;
};

export type DashboardRegionTotals = {
  all: number;
  US: number;
  UK: number;
  EU: number;
  JP: number;
};

export type DashboardData = {
  auctions: DashboardAuction[];
  liveNow: number;
  regionTotals: DashboardRegionTotals;
  seriesCounts: Record<string, number>;
};

// ─── PER_SOURCE_BUDGET for dashboard path (matches API route) ───
const DASHBOARD_SOURCE_BUDGET = 200;

function transformCar(car: CollectorCar): DashboardAuction {
  return {
    id: car.id,
    title: car.title,
    year: car.year,
    make: car.make,
    model: car.model,
    trim: car.trim,
    engine: car.engine,
    transmission: car.transmission,
    mileage: car.mileage,
    mileageUnit: car.mileageUnit,
    location: car.location,
    platform: car.platform,
    status: car.status,
    price: car.price,
    currentBid: car.currentBid,
    bidCount: car.bidCount,
    viewCount: 0,
    watchCount: 0,
    endTime: car.endTime instanceof Date ? car.endTime.toISOString() : String(car.endTime),
    exteriorColor: null,
    description: null,
    images: car.images.slice(0, 1),
    region: car.region,
    category: car.category,
    originalCurrency: car.originalCurrency ?? null,
    analysis: car.investmentGrade
      ? {
          bidTargetLow: null,
          bidTargetHigh: null,
          confidence: null,
          investmentGrade: car.investmentGrade,
          appreciationPotential: car.trend,
          keyStrengths: [],
          redFlags: [],
        }
      : null,
    priceHistory: [],
    fairValueByRegion: car.fairValueByRegion,
  };
}

async function fetchDashboardDataUncached(): Promise<DashboardData> {
  const requestedMake = resolveRequestedMake(null); // Porsche default

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

  // Only active listings for dashboard
  const active = live.filter(
    (car) => car.status === "ACTIVE" || car.status === "ENDING_SOON"
  );

  return {
    auctions: active.map(transformCar),
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

/**
 * Cached dashboard data. Revalidates every 5 minutes.
 * On Vercel, this uses the Data Cache — subsequent calls within the TTL
 * return instantly without hitting Supabase.
 */
export const getCachedDashboardData = unstable_cache(
  fetchDashboardDataUncached,
  ["dashboard-data-v1"],
  { revalidate: 300 } // 5 minutes
);
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsc --noEmit src/lib/dashboardCache.ts 2>&1 | head -20`

Fix any type errors. The `CollectorCar` type may need checking — ensure `investmentGrade`, `trend`, `fairValueByRegion`, `originalCurrency` exist on it. If not, use optional chaining.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dashboardCache.ts
git commit -m "feat(perf): add server-side cached dashboard data fetcher"
```

---

### Task 2: Create `loading.tsx` — Streaming Fallback

**Files:**
- Create: `src/app/[locale]/loading.tsx`

Next.js App Router uses `loading.tsx` as a Suspense boundary around the page. It shows during **any** server render — client-side navigations, cold-cache loads, and briefly on warm-cache loads while the server streams HTML. On warm cache the flash is imperceptible (< 50ms).

- [ ] **Step 1: Create the loading file**

```tsx
// src/app/[locale]/loading.tsx
import { MonzaInfinityLoader } from "@/components/shared/MonzaInfinityLoader";

export default function Loading() {
  return <MonzaInfinityLoader />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/loading.tsx
git commit -m "feat(perf): add loading.tsx for SSR streaming fallback"
```

---

### Task 3: Convert `page.tsx` from CSR to SSR

**Files:**
- Rewrite: `src/app/[locale]/page.tsx`

This is the core change. The page goes from a 220-line client component (with `useEffect`, `useState`, `fetch`) to a ~40-line server component that calls the cached fetcher and passes data as props.

- [ ] **Step 1: Rewrite page.tsx as a server component**

Replace the entire file with:

```tsx
// src/app/[locale]/page.tsx
import { setRequestLocale } from "next-intl/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getCachedDashboardData, type DashboardData } from "@/lib/dashboardCache";

async function loadDashboardData(): Promise<DashboardData> {
  try {
    return await getCachedDashboardData();
  } catch (err) {
    console.error("[Home] getCachedDashboardData failed:", err);
    return { auctions: [], liveNow: 0, regionTotals: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 }, seriesCounts: {} };
  }
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await loadDashboardData();

  if (data.auctions.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <span className="text-muted-foreground text-sm">
          No listings found
        </span>
      </div>
    );
  }

  return (
    <DashboardClient
      auctions={data.auctions}
      liveRegionTotals={data.regionTotals}
      liveNowTotal={data.liveNow}
      seriesCounts={data.seriesCounts}
    />
  );
}
```

**What was removed:**
- `"use client"` directive
- `useEffect`, `useState`, `Suspense` imports
- `fetchAuctionsWithFallback()` and all 4 fallback endpoints
- `normalizeAuctionPayload()` — transformation now in `dashboardCache.ts`
- `HomeContent` wrapper component
- Local `Auction` type definition (now in `dashboardCache.ts`)
- `useTranslations` usage (DashboardClient handles its own translations internally)

**What was added:**
- `setRequestLocale(locale)` for next-intl static generation
- `await getCachedDashboardData()` — single cached server call
- Direct prop passing to `DashboardClient`

- [ ] **Step 2: Verify the page renders**

Run: `npm run dev -- --webpack`

Open `http://localhost:3000` in browser. Expected:
- DashboardClient renders with data (warm cache: instant, cold cache: brief loader)
- Browser network tab shows NO `/api/mock-auctions` fetch (data came server-side in HTML)
- Terminal shows Supabase queries only on first load (cached after)

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/page.tsx
git commit -m "feat(perf): convert home page from CSR to SSR with cached data"
```

---

### Task 4: Fix Supabase Timeout + Reduce Query Budget

**Files:**
- Modify: `src/lib/supabaseLiveListings.ts:70`
- Modify: `src/app/api/mock-auctions/route.ts:18`

Two quick changes that prevent AbortError cascades:

1. **Timeout:** 12s → 30s — gives Supabase enough time to respond under load
2. **Budget:** 500 → 200 per source — dashboard only needs sample data for family aggregation, not full inventory

- [ ] **Step 1: Increase Supabase timeout**

In `src/lib/supabaseLiveListings.ts`, line 70:

```typescript
// Before:
const SUPABASE_TIMEOUT_MS = 12_000;

// After:
const SUPABASE_TIMEOUT_MS = 30_000;
```

- [ ] **Step 2: Reduce PER_SOURCE_BUDGET in API route**

In `src/app/api/mock-auctions/route.ts`, line 18:

```typescript
// Before:
const PER_SOURCE_BUDGET = 500;

// After:
const PER_SOURCE_BUDGET = 200;
```

- [ ] **Step 3: Verify no AbortErrors**

Run: `npm run dev -- --webpack`

Open `http://localhost:3000`. Check terminal logs. Expected:
- NO `AbortError: This operation was aborted` messages
- `/api/mock-auctions` (if still called by other pages) responds in < 10s

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabaseLiveListings.ts src/app/api/mock-auctions/route.ts
git commit -m "fix(perf): increase Supabase timeout to 30s, reduce dashboard budget to 200/source"
```

---

### Task 5: Add Cache-Control Headers to API Route

**Files:**
- Modify: `src/app/api/mock-auctions/route.ts` (response section)

The `/api/mock-auctions` route is still used by the MakePage (brand detail pages) for paginated browsing. Add cache headers so Vercel's CDN caches the JSON response for 5 minutes.

- [ ] **Step 1: Add cache headers to non-paginated response**

In `src/app/api/mock-auctions/route.ts`, find the final `return NextResponse.json(...)` (around line 261) for the non-paginated path and replace with:

```typescript
// Before:
return NextResponse.json({
  auctions: transformed,
  total,
  page: 1,
  limit: total,
  totalPages: 1,
  aggregates: {
    liveNow: aggregates.liveNow,
    regionTotals: aggregates.regionTotalsByPlatform,
    seriesCounts,
  },
});

// After:
const body = {
  auctions: transformed,
  total,
  page: 1,
  limit: total,
  totalPages: 1,
  aggregates: {
    liveNow: aggregates.liveNow,
    regionTotals: aggregates.regionTotalsByPlatform,
    seriesCounts,
  },
};

return NextResponse.json(body, {
  headers: {
    "Cache-Control": "s-maxage=300, stale-while-revalidate=60",
  },
});
```

- [ ] **Step 2: Add cache headers to paginated response too**

In the paginated path (around line 158), change:

```typescript
// Before:
return NextResponse.json(response);

// After:
return NextResponse.json(response, {
  headers: {
    "Cache-Control": "s-maxage=60, stale-while-revalidate=30",
  },
});
```

(Paginated path uses shorter TTL since users are actively browsing.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mock-auctions/route.ts
git commit -m "feat(perf): add Cache-Control headers to mock-auctions API"
```

---

### Task 6: End-to-End Verification

- [ ] **Step 1: Clean build cache**

```bash
rm -rf .next
```

- [ ] **Step 2: Start dev server**

```bash
npm run dev -- --webpack
```

- [ ] **Step 3: First load (cold cache) — measure timing**

Open `http://localhost:3000` in browser. Expected behavior:
- `loading.tsx` shows MonzaInfinityLoader briefly while server fetches data
- Dashboard renders with data
- Terminal shows Supabase queries executing (first time only)
- No AbortError messages

- [ ] **Step 4: Second load (warm cache) — measure timing**

Refresh the page. Expected behavior:
- Dashboard renders **instantly** — no loader visible
- Terminal shows NO new Supabase queries (data served from `unstable_cache`)
- Page load time < 1 second

- [ ] **Step 5: Verify API route still works for other consumers**

Open `http://localhost:3000/api/mock-auctions` in browser. Expected:
- JSON response with `auctions` array
- Response header includes `Cache-Control: s-maxage=300, stale-while-revalidate=60`
- Response time < 10s (budget reduced from 500 to 200)

- [ ] **Step 6: Final commit with all changes**

If any fixups were needed during verification:
```bash
git add -A
git commit -m "fix(perf): address issues found during SSR verification"
```

---

## Performance Expected Results

| Metric | Before | After |
|--------|--------|-------|
| First Contentful Paint | 2-6s (CSR, shows loader) | < 1s (HTML has data) |
| Supabase queries per visit | 30+ per visitor | 30+ once per 5 min |
| `/api/mock-auctions` response | 6-24s | Not called by dashboard |
| AbortError frequency | Every page load | Rare (30s timeout) |
| Vercel CDN utilization | None | HTML + JSON cached at edge |
| SEO | Empty page (JS-rendered) | Full HTML with content |
