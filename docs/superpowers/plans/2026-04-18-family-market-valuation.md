# Family Market Valuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard valuation card compute family/series medians and averages from all marketplace listings, with the current region filter scoping the source data to all markets or a specific market.

**Architecture:** Keep the Porsche family mapping in `src/lib/brandConfig.ts` as the only taxonomy source. Add a dedicated valuation data slice from Supabase marketplace listings, separate from the active listing feed used by the dashboard cards. Compute valuation stats server-side from all listings, then let the client render the current market scope using the existing region selector (`null` = all markets, `EU`/`UK`/`JP`/`US` = market-filtered view).

**Tech Stack:** TypeScript, Next.js App Router, Supabase, existing `fetchLiveListingsAsCollectorCars` helper, Vitest.

**Plan Budget:** `{files: 7, LOC/file: < 1000, deps: 0}`

**Files:**
- Modify: `src/lib/dashboardCache.ts`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/components/dashboard/utils/valuation.ts`
- Modify: `src/components/dashboard/context/shared/RegionalValuation.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`
- Add: `src/components/dashboard/utils/valuation.test.ts`
- Add: `src/lib/dashboardCache.test.ts`

---

### Task 1: Build the valuation data model from marketplace listings

**Files:**
- Modify: `src/components/dashboard/utils/valuation.ts`
- Add: `src/components/dashboard/utils/valuation.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that feeds a mixed set of marketplace listings into a new helper and expects:

```ts
const listings = [
  { make: "Porsche", model: "992 GT3", year: 2023, title: "2023 Porsche 992 GT3", price: 300000, currentBid: 0, originalCurrency: "USD", region: "US", status: "ACTIVE" },
  { make: "Porsche", model: "992 GT3", year: 2023, title: "2023 Porsche 992 GT3", price: 290000, currentBid: 0, originalCurrency: "EUR", region: "EU", status: "ACTIVE" },
  { make: "Porsche", model: "991 Turbo S", year: 2017, title: "2017 Porsche 991 Turbo S", price: 240000, currentBid: 0, originalCurrency: "USD", region: "US", status: "SOLD" },
]

const allMarkets = computeFamilyMarketValuations(listings, null, rates)
const europeOnly = computeFamilyMarketValuations(listings, "EU", rates)

expect(allMarkets["992"].sampleCount).toBe(2)
expect(allMarkets["992"].medianUsd).toBeGreaterThan(0)
expect(europeOnly["992"].sampleCount).toBe(1)
expect(europeOnly["992"].medianUsd).not.toBe(allMarkets["992"].medianUsd)
expect(allMarkets["991"].sampleCount).toBe(1)
```

The test should also verify that the existing Porsche series mapping is used:

```ts
expect(extractSeries("992 GT3", 2023, "Porsche", "2023 Porsche 992 GT3")).toBe("992")
expect(getSeriesConfig("992", "Porsche")?.family).toBe("911 Family")
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run src/components/dashboard/utils/valuation.test.ts
```

Expected: fail because the new family-market helper does not exist yet.

- [ ] **Step 3: Implement the helper**

Add a market-aware helper that:

```ts
export type MarketScope = "all" | "US" | "EU" | "UK" | "JP"

export type FamilyValuationStats = {
  sampleCount: number
  medianUsd: number
  averageUsd: number
  minUsd: number
  maxUsd: number
}

export function computeFamilyMarketValuations(
  listings: Array<{
    make: string
    model: string
    year: number
    title?: string
    price: number
    currentBid: number
    originalCurrency?: string | null
    region?: string | null
    status: string
  }>,
  selectedRegion: string | null,
  rates: Record<string, number>,
): Record<string, FamilyValuationStats> {
  // 1. Keep only Porsche listings with a valid series config.
  // 2. If selectedRegion is null, use every listing.
  // 3. If selectedRegion is set, keep only listings whose region matches it.
  // 4. Convert prices to USD using listingPriceUsd().
  // 5. Compute sampleCount, medianUsd, averageUsd, minUsd, maxUsd per series.
}
```

The helper should use `extractSeries(...)` and `getSeriesConfig(...)` from `src/lib/brandConfig.ts` and should ignore rows without a valid price.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run src/components/dashboard/utils/valuation.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/utils/valuation.ts src/components/dashboard/utils/valuation.test.ts
git commit -m "feat: compute family valuations from marketplace listings"
```

---

### Task 2: Fetch a separate valuation universe from Supabase

**Files:**
- Modify: `src/lib/dashboardCache.ts`
- Add: `src/lib/dashboardCache.test.ts`
- Modify: `src/app/[locale]/page.tsx`

- [ ] **Step 1: Write the failing test**

Add a dashboard cache test that stubs `fetchLiveListingsAsCollectorCars` and expects two separate slices:

```ts
expect(fetchLiveListingsAsCollectorCars).toHaveBeenCalledWith(
  expect.objectContaining({
    make: "Porsche",
    includeAllSources: true,
    includePriceHistory: false,
    status: "all",
  })
)
```

and also expects the existing active feed call to remain unchanged for the cards:

```ts
expect(fetchLiveListingsAsCollectorCars).toHaveBeenCalledWith(
  expect.objectContaining({
    make: "Porsche",
    includeAllSources: true,
    includePriceHistory: false,
  })
)
```

The returned dashboard payload should include a new valuation universe field, separate from `auctions`, so the context panels can compute valuation stats from all listings without disturbing the active feed.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run src/lib/dashboardCache.test.ts
```

Expected: fail because the dashboard payload does not yet expose the valuation universe.

- [ ] **Step 3: Implement the cache split**

Update `fetchDashboardDataUncached()` to:

```ts
const [liveActive, liveAll, aggregates, seriesCounts] = await Promise.all([
  fetchLiveListingsAsCollectorCars({
    limit: DASHBOARD_SOURCE_BUDGET,
    includePriceHistory: false,
    make: requestedMake,
    includeAllSources: true,
  }),
  fetchLiveListingsAsCollectorCars({
    limit: 0,
    includePriceHistory: false,
    make: requestedMake,
    status: "all",
    includeAllSources: true,
  }),
  fetchLiveListingAggregateCounts({ make: requestedMake }),
  fetchSeriesCounts(requestedMake ?? "Porsche"),
])
```

Return:

```ts
{
  auctions: active.map(transformCar),
  valuationListings: liveAll.map(transformCar),
  liveNow: aggregates.liveNow,
  regionTotals: ...,
  seriesCounts,
}
```

Keep the existing `auctions` field as the active feed for the main dashboard cards.

Update `src/app/[locale]/page.tsx` to pass the new `valuationListings` prop through to `DashboardClient`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run src/lib/dashboardCache.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardCache.ts src/lib/dashboardCache.test.ts src/app/[locale]/page.tsx
git commit -m "feat: cache marketplace valuation listings separately"
```

---

### Task 3: Rewire the valuation card to use market-scoped listings

**Files:**
- Modify: `src/components/dashboard/context/shared/RegionalValuation.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`
- Optionally modify: `src/components/dashboard/context/BrandContextPanel.tsx`
- Optionally modify: `src/components/dashboard/context/FamilyContextPanel.tsx`

- [ ] **Step 1: Write the failing test**

Add a component test that renders the valuation section with:

```ts
selectedRegion = null
// expect "All markets" scope to use all listing prices

selectedRegion = "EU"
// expect only EU listings to contribute to the valuations
```

The test should assert that the component no longer reads from the old auction-only slice when a valuation universe is provided.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run src/components/dashboard/utils/valuation.test.ts src/lib/dashboardCache.test.ts
```

Expected: the UI behavior assertions fail until the component accepts the new props and uses them.

- [ ] **Step 3: Implement the prop and filtering change**

Update the valuation section so it receives the preloaded `valuationListings` slice and scopes it like this:

```ts
const scopedListings = selectedRegion
  ? filterAuctionsForRegion(valuationListings, selectedRegion)
  : valuationListings
```

Then compute the family/series stats from `scopedListings`, not from `allAuctions`.

For display, keep the current market highlight and bar layout, but make the numbers come from:

```ts
medianUsd
averageUsd
sampleCount
```

The valuation card should therefore behave as follows:
- `All` = all marketplace listings across all regions
- `US` = US listings only
- `EU` = European listings only
- `UK` = UK listings only
- `JP` = Japan listings only

If a family/series has no scoped listings, render the empty state cleanly instead of falling back to the auction feed.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run src/components/dashboard/utils/valuation.test.ts src/lib/dashboardCache.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/context/shared/RegionalValuation.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "feat: scope family valuations by region"
```

---

### Task 4: End-to-end verification

**Files:**
- None new
- Re-run: `src/lib/dashboardCache.ts`, `src/components/dashboard/utils/valuation.ts`, `src/components/dashboard/context/shared/RegionalValuation.tsx`

- [ ] **Step 1: Run the focused test suite**

Run:

```bash
npx vitest run src/components/dashboard/utils/valuation.test.ts src/lib/dashboardCache.test.ts src/lib/supabaseLiveListings.test.ts
```

Expected:
- family series mapping passes for `992`, `991`, `997`, `996`, `993`, `964`, `930`
- all-market aggregation includes every marketplace listing
- region-scoped aggregation narrows correctly
- dashboard cache still returns the active listing feed

- [ ] **Step 2: Smoke the dashboard**

Run the app and verify:
- the market selector `All` uses the full valuation universe
- selecting `EU` only changes the valuation numbers to European listings
- the active feed and sidebar remain unchanged

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx src/components/dashboard/context/shared/RegionalValuation.tsx src/components/dashboard/utils/valuation.ts src/lib/dashboardCache.ts src/app/[locale]/page.tsx src/components/dashboard/utils/valuation.test.ts src/lib/dashboardCache.test.ts
git commit -m "feat: make dashboard valuations market-aware"
```
