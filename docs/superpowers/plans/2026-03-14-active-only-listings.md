# Active-Only Listings — Hard Filter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee that only active listings (status = "ACTIVE" or "ENDING_SOON") are ever shown anywhere in the app — dashboard, make pages, infinite scroll, and all region views.

**Architecture:** Apply the filter at every layer as a defense-in-depth strategy. The DB already filters correctly (`LIVE_DB_STATUS_VALUES = ["active"]`). We add explicit client-side guards in: (1) the non-paginated API route, (2) `filteredAuctions` in DashboardClient before any aggregation, (3) individual aggregation functions as a second safety net, (4) `useInfiniteAuctions` hook. This means a stale or mis-tagged listing can never surface to a user no matter which layer fails.

**Tech Stack:** Next.js 16 API Routes, React 19 `useMemo`, TypeScript

---

## Audit Summary

| Location | Status | Action |
|---|---|---|
| DB queries (`supabaseLiveListings.ts`) | ✅ Already filters `status="active"` | No change needed |
| `fetchLiveListingsAsCollectorCars()` | ✅ Defaults to active | No change needed |
| `fetchPaginatedListings()` | ✅ Filters by active | No change needed |
| **`/api/mock-auctions` non-paginated path** | ⚠️ Client-side status filter allows `?status=Ended` | Add hard guard |
| **`DashboardClient` — `filteredAuctions`** | ⚠️ Only region-filters, no status filter | Add status guard |
| **`DashboardClient` — `aggregateBrands()`** | ⚠️ No status filter on auctions input | Add status guard |
| **`DashboardClient` — `aggregateFamilies()`** | ⚠️ No status filter on auctions input | Add status guard |
| **`DashboardClient` — `activeBrandFamilies`** | ⚠️ No status filter | Add status guard |
| **`useInfiniteAuctions.ts`** | ⚠️ Relies 100% on API to filter | Add client-side guard |
| `MakePageClient.tsx` | ✅ Already filters active only | No change needed |
| `SearchClient.tsx` | ✅ Ended filter is intentional UX | No change needed |

---

## Files to Modify

| File | Lines affected | Change |
|---|---|---|
| `src/app/api/mock-auctions/route.ts` | ~160–170 | Add post-fetch hard guard filtering non-active cars |
| `src/components/dashboard/DashboardClient.tsx` | ~2572, ~408, ~476, ~1200 | Add status filter to `filteredAuctions`, `aggregateBrands`, `aggregateFamilies`, `activeBrandFamilies` |
| `src/hooks/useInfiniteAuctions.ts` | accumulation block | Add status filter when accumulating pages |

---

## Task 1: Guard the non-paginated API route

**File:** `src/app/api/mock-auctions/route.ts`

The non-paginated path serves the dashboard. Even though the DB only returns active listings, a defensive filter here ensures no leaked ended listing ever reaches the client — regardless of future DB changes.

**Context:** After line `let results: CollectorCar[] = live;` (~line 160), add:

- [ ] **Step 1: Add the hard guard**

Open `src/app/api/mock-auctions/route.ts`. Find:
```typescript
let results: CollectorCar[] = live;
```

Replace with:
```typescript
// Hard guard: only active listings are ever shown on the dashboard.
// The DB already filters this, but we enforce it here as a safety net.
let results: CollectorCar[] = live.filter(
  car => car.status === "ACTIVE" || car.status === "ENDING_SOON"
);
```

- [ ] **Step 2: Verify the API still returns data**

Start the dev server and open: `http://localhost:3000/api/mock-auctions`

Expected: JSON with `auctions` array where every item has `status` of `"ACTIVE"` or `"ENDING_SOON"`. No `"ENDED"` values.

Quick check in browser console:
```js
fetch('/api/mock-auctions').then(r=>r.json()).then(d=>
  console.log('statuses:', [...new Set(d.auctions.map(a=>a.status))])
)
```
Expected output: `statuses: ["ACTIVE"]` or `statuses: ["ACTIVE", "ENDING_SOON"]`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mock-auctions/route.ts
git commit -m "fix(api): hard-guard non-paginated route to active listings only"
```

---

## Task 2: Filter `filteredAuctions` in DashboardClient

**File:** `src/components/dashboard/DashboardClient.tsx`

`filteredAuctions` is the single input to every aggregation (`aggregateBrands`, `aggregateFamilies`, `activeBrandFamilies`, `liveAuctions`). Filtering status here means all downstream functions are automatically protected.

- [ ] **Step 1: Add status filter to `filteredAuctions` memo**

Find the `filteredAuctions` useMemo (around line 2572):
```typescript
const filteredAuctions = useMemo(() => {
  return filterAuctionsForRegion(auctions, selectedRegion)
}, [auctions, selectedRegion])
```

Replace with:
```typescript
const filteredAuctions = useMemo(() => {
  const regionFiltered = filterAuctionsForRegion(auctions, selectedRegion)
  // Hard requirement: only active listings are ever displayed.
  return regionFiltered.filter(
    a => a.status === "ACTIVE" || a.status === "ENDING_SOON"
  )
}, [auctions, selectedRegion])
```

- [ ] **Step 2: Add status filter inside `aggregateBrands`**

Find `aggregateBrands` (around line 408):
```typescript
function aggregateBrands(auctions: Auction[], dbTotalOverride?: number): Brand[] {
  const brandMap = new Map<string, Auction[]>()

  auctions.forEach(auction => {
```

Replace the forEach with a filtered version:
```typescript
function aggregateBrands(auctions: Auction[], dbTotalOverride?: number): Brand[] {
  const brandMap = new Map<string, Auction[]>()

  auctions
    .filter(a => a.status === "ACTIVE" || a.status === "ENDING_SOON")
    .forEach(auction => {
```

- [ ] **Step 3: Add status filter inside `aggregateFamilies`**

Find `aggregateFamilies` (around line 476):
```typescript
function aggregateFamilies(auctions: Auction[], dbSeriesCounts?: Record<string, number>): PorscheFamily[] {
  const familyMap = new Map<string, Auction[]>()

  auctions.forEach(auction => {
```

Replace:
```typescript
function aggregateFamilies(auctions: Auction[], dbSeriesCounts?: Record<string, number>): PorscheFamily[] {
  const familyMap = new Map<string, Auction[]>()

  auctions
    .filter(a => a.status === "ACTIVE" || a.status === "ENDING_SOON")
    .forEach(auction => {
```

- [ ] **Step 4: Add status filter inside `activeBrandFamilies` memo**

Find the `activeBrandFamilies` useMemo inside `DiscoverySidebar` (around line 1200):
```typescript
    const brandAuctions = auctions.filter(a => a.make === brandName)
    const familyMap = new Map<string, { count: number; years: number[] }>()

    brandAuctions.forEach(a => {
```

Replace:
```typescript
    const brandAuctions = auctions.filter(
      a => a.make === brandName &&
           (a.status === "ACTIVE" || a.status === "ENDING_SOON")
    )
    const familyMap = new Map<string, { count: number; years: number[] }>()

    brandAuctions.forEach(a => {
```

- [ ] **Step 5: Verify dashboard shows no ended listings**

Open the dashboard at `http://localhost:3000`. In browser console:
```js
// Check no ENDED statuses in rendered data
document.querySelectorAll('[data-status]')
// If no data-status attributes, check the React DevTools
// or add a temporary console.log in DashboardClient filteredAuctions
```

Alternatively, verify the `liveAuctions` list in the sidebar shows only live/ending-soon items with countdown timers.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "fix(dashboard): enforce active-only filter on all aggregations and family drill-downs"
```

---

## Task 3: Guard `useInfiniteAuctions` hook

**File:** `src/hooks/useInfiniteAuctions.ts`

The infinite scroll hook accumulates pages from the paginated API. The paginated API already filters by `status=active` at the DB level. This task adds a client-side safety net so that if any future API change allows ended listings through, they never reach the MakePage UI.

- [ ] **Step 1: Find where pages are accumulated**

Open `src/hooks/useInfiniteAuctions.ts` and find where new cars are added to state. Look for the block that merges new page results with existing cars (something like `setCars(prev => [...prev, ...newCars])` or deduplication logic).

- [ ] **Step 2: Add status filter on accumulation**

In the block where incoming cars are processed before being added to state, add a filter. The exact location depends on the current code, but the pattern is:

```typescript
// Before adding to accumulated cars, filter to active only
const activeCars = newCars.filter(
  c => c.status === "ACTIVE" || c.status === "ENDING_SOON"
)
```

Apply this filter before the deduplication step and before calling `setCars`.

- [ ] **Step 3: Verify the make page only shows active listings**

Open `http://localhost:3000/en/cars/porsche`. Scroll through listings. Verify:
- All cards show active auctions with countdown timers
- No "Ended" or sold listings appear
- Infinite scroll continues loading active listings only

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useInfiniteAuctions.ts
git commit -m "fix(hook): filter active-only listings in useInfiniteAuctions accumulation"
```

---

## Task 4: Final verification across all regions

- [ ] **Step 1: Check all region tabs on the dashboard**

Open dashboard. Click each region tab:
- All → verify brand card shows correct count, family counts are for active listings
- US → verify only US active listings appear
- EU → verify only EU active listings appear
- UK → verify only UK active listings appear
- JP → verify only JP active listings appear

No "Ended" badge or past auction should appear in any region view.

- [ ] **Step 2: Check make page**

Open `/en/cars/porsche`. Scroll through all visible cards. Every card should have:
- A countdown timer (e.g., "2d 4h" or "3h 22m")
- OR a "Ending Soon" badge

No card should show "Ended" or have a past end date without a live badge.

- [ ] **Step 3: Check the sidebar family counts match active listings**

Click on a family in the sidebar (e.g., 992). The count shown should match the approximate number of active 992 listings. Compare with the "All" region total.

- [ ] **Step 4: Commit final verification note**

```bash
git add -A
git commit -m "fix: enforce active-only listings across dashboard, make page, and infinite scroll"
```

---

## Expected Final State

Every entry point to the user-facing app applies the active filter at multiple layers:

```
DB query          → status = "active"           (supabaseLiveListings.ts)
API route         → .filter(ACTIVE|ENDING_SOON) (mock-auctions/route.ts)
DashboardClient   → filteredAuctions filtered   (DashboardClient.tsx)
aggregateBrands   → .filter(ACTIVE|ENDING_SOON) (DashboardClient.tsx)
aggregateFamilies → .filter(ACTIVE|ENDING_SOON) (DashboardClient.tsx)
activeBrandFamilies → filtered in brandAuctions (DashboardClient.tsx)
useInfiniteAuctions → filtered on accumulation  (useInfiniteAuctions.ts)
MakePageClient    → already filters             (MakePageClient.tsx) ✅
```
