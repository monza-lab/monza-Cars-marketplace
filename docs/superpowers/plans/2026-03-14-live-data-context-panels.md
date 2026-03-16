# Live Data Context Panels — Replace Hardcoded Mocks with Live Auction Data

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 6 hardcoded mock data objects in DashboardClient.tsx with computations derived from live auction data, following the pattern already established by `FamilyContextPanel`.

**Architecture:** `FamilyContextPanel` already computes top variants, recent sales, market depth, and ownership cost from live auctions — it's the gold standard. `BrandContextPanel` and `ContextPanel` still read from 6 static mock objects (`mockMarketPulse`, `mockWhyBuy`, `mockAnalysis`, `mockOwnershipCost`, `mockTopModels`, `mockMarketDepth`). This plan wires both panels to live data using the exact same computation patterns, then removes the dead mock objects. `brandConfig.ts` already stores `ownershipCosts`, `marketDepth`, and `defaultThesis` for Porsche — we use those as base values where appropriate, with the mocks as fallbacks for non-registered brands.

**Tech Stack:** React 19 `useMemo`, TypeScript, `brandConfig.ts` helpers

---

## Audit: What Uses Each Mock

| Mock Object | BrandContextPanel | ContextPanel | FamilyContextPanel | Other |
|---|---|---|---|---|
| `mockMarketPulse` | Recent sales (line 2294) | Recent comparables (line 1679) | ✗ (uses live) | — |
| `mockWhyBuy` | Investment thesis (line 2273) | Investment thesis (line 1678) | ✗ (uses `getSeriesThesis()`) | — |
| `mockAnalysis` | ✗ | Fallback grade/range (line 1681) | ✗ | `aggregateBrands` trend (line 451) |
| `mockOwnershipCost` | Ownership cost (line 2294) | Ownership cost (line 1680) | ✗ (computes from price) | — |
| `mockTopModels` | Top models section (line 2295) | ✗ | ✗ (computes live variants) | — |
| `mockMarketDepth` | Liquidity section (line 2296) | ✗ | ✗ (computes from auctions) | — |

---

## Files to Modify

| File | Change |
|---|---|
| `src/components/dashboard/DashboardClient.tsx` | Wire live data to BrandContextPanel + ContextPanel; remove mock objects |

No new files needed. All changes are within DashboardClient.tsx.

---

## Task 1: Pass `auctions` prop to BrandContextPanel

**File:** `src/components/dashboard/DashboardClient.tsx`

`BrandContextPanel` currently receives `{ brand, allBrands }` — no access to auction data. To compute live metrics, it needs the brand's auctions.

- [ ] **Step 1: Add `auctions` prop to BrandContextPanel signature**

Find (line ~2269):
```typescript
function BrandContextPanel({ brand, allBrands }: { brand: Brand; allBrands: Brand[] }) {
```

Replace with:
```typescript
function BrandContextPanel({ brand, allBrands, auctions }: { brand: Brand; allBrands: Brand[]; auctions: Auction[] }) {
```

- [ ] **Step 2: Pass `filteredAuctions` at the render site**

Find (line ~2749):
```typescript
<BrandContextPanel brand={selectedBrand} allBrands={brands} />
```

Replace with:
```typescript
<BrandContextPanel brand={selectedBrand} allBrands={brands} auctions={filteredAuctions} />
```

- [ ] **Step 3: Filter auctions to the active brand inside the component**

Add this `useMemo` right after the existing `const { selectedRegion, effectiveRegion } = useRegion()` line (line ~2271):

```typescript
  const brandAuctions = useMemo(() =>
    auctions.filter(a => a.make === brand.name),
    [auctions, brand.name]
  )
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new type errors (existing ones may be present).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "refactor(dashboard): pass auctions prop to BrandContextPanel"
```

---

## Task 2: Replace `mockTopModels` with live top variants

**File:** `src/components/dashboard/DashboardClient.tsx`

Copy the computation pattern from `FamilyContextPanel.topVariants` (lines 1945–1970).

- [ ] **Step 1: Add `topModels` useMemo to BrandContextPanel**

Inside `BrandContextPanel`, **replace** this line:
```typescript
  const topModels = mockTopModels[brand.name] || mockTopModels["default"]
```

With this `useMemo` (identical pattern to FamilyContextPanel lines 1945–1970):
```typescript
  const topModels = useMemo(() => {
    const variantMap = new Map<string, { count: number; prices: number[]; grade: string }>()
    brandAuctions.forEach(a => {
      const variant = a.model
      const existing = variantMap.get(variant) || { count: 0, prices: [], grade: "B" }
      existing.count++
      if (a.currentBid > 0) existing.prices.push(a.currentBid)
      const g = a.analysis?.investmentGrade || "B"
      if (["AAA", "AA", "A"].indexOf(g) < ["AAA", "AA", "A"].indexOf(existing.grade)) {
        existing.grade = g
      }
      variantMap.set(variant, existing)
    })

    return Array.from(variantMap.entries())
      .filter(([, data]) => data.prices.length > 0)
      .map(([name, data]) => ({
        name,
        avgPrice: Math.round(data.prices.reduce((s, p) => s + p, 0) / data.prices.length),
        count: data.count,
        grade: data.grade,
        trend: data.grade === "AAA" ? "Premium" : data.grade === "AA" ? "Strong" : "Stable",
      }))
      .sort((a, b) => b.avgPrice - a.avgPrice)
      .slice(0, 5)
  }, [brandAuctions])
```

- [ ] **Step 2: Update the JSX that renders top models**

The existing JSX references `topModels` with fields `name`, `avgPrice`, `grade`, `trend`. The new computation returns the same field names — **no JSX changes needed**. Verify by searching the JSX for `topModels.map` and confirming the fields match.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): compute BrandContextPanel top models from live auctions"
```

---

## Task 3: Replace `mockMarketPulse` with live recent sales in BrandContextPanel

**File:** `src/components/dashboard/DashboardClient.tsx`

Copy the pattern from `FamilyContextPanel.recentSales` (lines 1972–1984).

- [ ] **Step 1: Add `recentSales` useMemo to BrandContextPanel**

**Replace** this line:
```typescript
  const marketPulse = mockMarketPulse[brand.name] || mockMarketPulse["default"]
```

With:
```typescript
  const recentSales = useMemo(() => {
    return brandAuctions
      .filter(a => a.currentBid > 0)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
      .slice(0, 5)
      .map(a => ({
        title: `${a.year} ${a.model}`,
        price: a.currentBid,
        platform: a.platform?.replace(/_/g, " ") || "Auction",
        date: new Date(a.endTime).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }))
  }, [brandAuctions])
```

- [ ] **Step 2: Update JSX to use `recentSales` instead of `marketPulse`**

In the BrandContextPanel JSX, find the Recent Sales section that references `marketPulse`. It will look like:
```typescript
{marketPulse.slice(0, 5).map((sale, i) => (
```

Replace `marketPulse.slice(0, 5)` with `recentSales`:
```typescript
{recentSales.map((sale, i) => (
```

The JSX accesses `sale.title`, `sale.price`, `sale.date`, `sale.platform` — all of which match the new shape.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): compute BrandContextPanel recent sales from live auctions"
```

---

## Task 4: Replace `mockMarketDepth` with live computation in BrandContextPanel

**File:** `src/components/dashboard/DashboardClient.tsx`

Copy the pattern from `FamilyContextPanel.depth` (lines 1901–1925). Use `brandConfig.marketDepth` as a fallback for Porsche, and compute from auctions for all brands.

- [ ] **Step 1: Add `depth` useMemo to BrandContextPanel**

**Replace** this line:
```typescript
  const depth = mockMarketDepth[brand.name] || mockMarketDepth["default"]
```

With:
```typescript
  const depth = useMemo(() => {
    const count = brandAuctions.length
    if (count === 0) {
      // Fallback: try brandConfig, then use sensible defaults
      const config = getBrandConfig(brand.name)
      return config?.marketDepth ?? { auctionsPerYear: 15, avgDaysToSell: 20, sellThroughRate: 80, demandScore: 6 }
    }
    const withBids = brandAuctions.filter(a => a.currentBid > 0)
    const ended = brandAuctions.filter(a => new Date(a.endTime).getTime() < Date.now())
    const sold = ended.filter(a => a.currentBid > 0)
    const sellThrough = ended.length > 0 ? Math.round((sold.length / ended.length) * 100) : 85
    const avgDays = ended.length > 0
      ? Math.round(ended.reduce((sum, a) => {
          const created = new Date(a.endTime).getTime() - (7 * 86400000)
          return sum + (new Date(a.endTime).getTime() - created) / 86400000
        }, 0) / ended.length)
      : 14
    const demandScore = Math.min(10, Math.max(1, Math.round(
      (count >= 20 ? 3 : count >= 10 ? 2 : 1) +
      (withBids.length / Math.max(count, 1)) * 4 +
      (sellThrough / 100) * 3
    )))
    return {
      auctionsPerYear: Math.max(count * 4, 12),
      avgDaysToSell: avgDays,
      sellThroughRate: sellThrough,
      demandScore,
    }
  }, [brandAuctions, brand.name])
```

- [ ] **Step 2: Add `getBrandConfig` to the brandConfig imports (NEW import)**

`getBrandConfig` is NOT currently imported. Find the existing import (near top of file):

```typescript
import { extractSeries, getSeriesConfig, getSeriesThesis, getFamilyGroupsWithSeries } from "@/lib/brandConfig"
```

Replace with:

```typescript
import { extractSeries, getSeriesConfig, getSeriesThesis, getFamilyGroupsWithSeries, getBrandConfig } from "@/lib/brandConfig"
```

This import is also needed by Tasks 5, 6, 7, and 8, so it must be added in this task.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): compute BrandContextPanel market depth from live auctions"
```

---

## Task 5: Replace `mockOwnershipCost` with price-tier scaled computation in BrandContextPanel

**File:** `src/components/dashboard/DashboardClient.tsx`

Copy the pattern from `FamilyContextPanel.ownershipCost` (lines 1927–1941). Use `brandConfig.ownershipCosts` as the base, scaled by brand price tier.

- [ ] **Step 1: Add `ownershipCost` useMemo to BrandContextPanel**

**Replace** this line:
```typescript
  const ownershipCost = mockOwnershipCost[brand.name] || mockOwnershipCost["default"]
```

With:
```typescript
  const ownershipCost = useMemo(() => {
    const config = getBrandConfig(brand.name)
    const base = config?.ownershipCosts ?? { insurance: 8000, storage: 5000, maintenance: 7000 }
    const withBids = brandAuctions.filter(a => a.currentBid > 0)
    const avgPrice = withBids.length > 0
      ? withBids.reduce((sum, a) => sum + a.currentBid, 0) / withBids.length
      : (brand.priceMin + brand.priceMax) / 2
    const scale = avgPrice < 100_000 ? 0.7 : avgPrice < 250_000 ? 1.0 : avgPrice < 500_000 ? 1.3 : 1.6
    return {
      insurance: Math.round(base.insurance * scale),
      storage: Math.round(base.storage * scale),
      maintenance: Math.round(base.maintenance * scale),
    }
  }, [brandAuctions, brand.name, brand.priceMin, brand.priceMax])
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): compute BrandContextPanel ownership cost from live price tier"
```

---

## Task 6: Replace `mockWhyBuy` with `brandConfig` thesis

**File:** `src/components/dashboard/DashboardClient.tsx`

`brandConfig.ts` already has `defaultThesis` per brand. For brands not in the registry, keep the existing mock as a fallback.

- [ ] **Step 1: Replace `mockWhyBuy` usage in BrandContextPanel**

Find:
```typescript
  const whyBuy = mockWhyBuy[brand.name] || mockWhyBuy["default"]
```

Replace with:
```typescript
  const whyBuy = getBrandConfig(brand.name)?.defaultThesis || mockWhyBuy[brand.name] || mockWhyBuy["default"]
```

- [ ] **Step 2: Replace `mockWhyBuy` usage in ContextPanel**

Find (in `ContextPanel` function):
```typescript
  const whyBuy = mockWhyBuy[auction.make] || mockWhyBuy["default"]
```

Replace with:
```typescript
  const whyBuy = getBrandConfig(auction.make)?.defaultThesis || mockWhyBuy[auction.make] || mockWhyBuy["default"]
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): prefer brandConfig thesis over mockWhyBuy"
```

---

## Task 7: Replace mock data in ContextPanel (single auction view)

**File:** `src/components/dashboard/DashboardClient.tsx`

`ContextPanel` uses `mockMarketPulse` for recent comparables and `mockOwnershipCost` for ownership cost. It already has `allAuctions` prop — use it.

- [ ] **Step 1: Replace `mockMarketPulse` with live recent sales**

Find (in `ContextPanel`):
```typescript
  const marketPulse = mockMarketPulse[auction.make] || mockMarketPulse["default"]
```

Replace with:
```typescript
  const recentSales = useMemo(() => {
    return allAuctions
      .filter(a => a.make === auction.make && a.id !== auction.id && a.currentBid > 0)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
      .slice(0, 5)
      .map(a => ({
        title: `${a.year} ${a.model}`,
        price: a.currentBid,
        platform: a.platform?.replace(/_/g, " ") || "Auction",
        date: new Date(a.endTime).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }))
  }, [allAuctions, auction.make, auction.id])
```

Then update the JSX in the "Recent Comparables" section:

Find:
```typescript
{marketPulse.slice(0, 5).map((sale, i) => (
```

Replace with:
```typescript
{recentSales.map((sale, i) => (
```

- [ ] **Step 2: Replace `mockOwnershipCost` with price-tier scaled computation**

Find (in `ContextPanel`):
```typescript
  const ownershipCost = mockOwnershipCost[auction.make] || mockOwnershipCost["default"]
```

Replace with:
```typescript
  const ownershipCost = useMemo(() => {
    const config = getBrandConfig(auction.make)
    const base = config?.ownershipCosts ?? { insurance: 8000, storage: 5000, maintenance: 7000 }
    const price = auction.currentBid || 100_000
    const scale = price < 100_000 ? 0.7 : price < 250_000 ? 1.0 : price < 500_000 ? 1.3 : 1.6
    return {
      insurance: Math.round(base.insurance * scale),
      storage: Math.round(base.storage * scale),
      maintenance: Math.round(base.maintenance * scale),
    }
  }, [auction.make, auction.currentBid])
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): replace ContextPanel mocks with live auction data"
```

---

## Task 8: Replace `mockAnalysis` fallback in `aggregateBrands`

**File:** `src/components/dashboard/DashboardClient.tsx`

`mockAnalysis` is still used in two places:
1. `aggregateBrands` — for `brand.avgTrend` (line ~451)
2. `ContextPanel` — for fallback `lowRange`/`highRange` when `auction.analysis` is null

For trend, we can compute it from the brand's actual grades. For the price fallback, use the brand's min/max from live data.

- [ ] **Step 1: Replace `mockAnalysis` trend in `aggregateBrands`**

Find (in `aggregateBrands`):
```typescript
      avgTrend: mockAnalysis[name]?.trend || mockAnalysis["default"].trend,
```

Replace with:
```typescript
      avgTrend: topGrade === "AAA" ? "Premium Demand" : topGrade === "AA" ? "Strong Demand" : topGrade === "A" ? "High Demand" : "Growing Demand",
```

- [ ] **Step 2: Replace `mockAnalysis` fallback in ContextPanel**

Find (in `ContextPanel`):
```typescript
  const fallbackAnalysis = mockAnalysis[auction.make] || mockAnalysis["default"]

  // Fair value range for fallback display
  const lowRange = auction.analysis?.bidTargetLow || fallbackAnalysis.lowRange
  const highRange = auction.analysis?.bidTargetHigh || fallbackAnalysis.highRange
```

Replace with:
```typescript
  // Fair value range — use analysis if available, otherwise derive from current bid
  const bidFallback = auction.currentBid || 50_000
  const lowRange = auction.analysis?.bidTargetLow || Math.round(bidFallback * 0.85)
  const highRange = auction.analysis?.bidTargetHigh || Math.round(bidFallback * 1.15)
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): derive trend and price range from live data instead of mockAnalysis"
```

---

## Task 9: Remove dead mock objects

**File:** `src/components/dashboard/DashboardClient.tsx`

After Tasks 1–8, check which mock objects still have any references. Remove any that are completely unused.

- [ ] **Step 1: Check remaining references for each mock**

Search each mock object name in the file. Expected state after Tasks 1–8:

| Mock | Expected references | Action |
|---|---|---|
| `mockMarketPulse` | 0 (replaced in BrandContextPanel Task 3, ContextPanel Task 7) | **Delete** |
| `mockWhyBuy` | 2 (kept as fallback for non-registered brands in Task 6) | **Keep** |
| `mockAnalysis` | 0 (replaced in Tasks 8) | **Delete** |
| `mockOwnershipCost` | 0 (replaced in Tasks 5, 7) | **Delete** |
| `mockTopModels` | 0 (replaced in Task 2) | **Delete** |
| `mockMarketDepth` | 0 (replaced in Task 4) | **Delete** |

- [ ] **Step 2: Delete unused mock objects**

Delete these blocks (exact line ranges will shift after earlier edits — search by name):
1. `const mockMarketPulse = {` ... `}` (lines ~141–268)
2. `const mockAnalysis = {` ... `}` (lines ~293–313)
3. `const mockOwnershipCost = {` ... `}` (lines ~329–344)
4. `const mockTopModels = {` ... `}` (lines ~378–388)
5. `const mockMarketDepth = {` ... `}` (lines ~392–405)

Also delete any now-unused types:
- `TopModel` type if only used by `mockTopModels`
- `MarketDepth` type if only used by `mockMarketDepth`

Keep:
- `mockWhyBuy` — still used as fallback for brands not in `brandConfig.ts`
- `priceRanges` — check if used elsewhere; if not, delete
- `topBrands` — check if used elsewhere; if not, delete

- [ ] **Step 3: Delete other unused constants**

Check `priceRanges` (line ~316) and `topBrands` (line ~326) for any remaining references. If unused, delete them.

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors from deleted references.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "chore(dashboard): remove 5 dead mock data objects (~200 lines)"
```

---

## Task 10: Verify all context panels render correctly

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Check FamilyContextPanel (should be unchanged)**

1. Open `http://localhost:3000`
2. Scroll to a Porsche family card (e.g., 992) — Column C should show:
   - Thesis from `brandConfig.ts`
   - Regional valuations computed from auction prices
   - Top variants computed from live auctions
   - Recent sales from live auctions
   - Liquidity metrics computed from live auctions
   - Ownership cost scaled by price tier

- [ ] **Step 3: Check BrandContextPanel (newly wired)**

1. Click back or scroll to the brand overview (before any family is selected)
2. Column C should show the brand context with:
   - **Thesis**: from `brandConfig.defaultThesis` (for Porsche) or `mockWhyBuy` fallback
   - **Top Models**: live aggregation from auctions, not hardcoded — verify model names match actual listings
   - **Recent Sales**: live auctions sorted by endTime, not hardcoded famous sales
   - **Market Depth**: computed from auction counts, not static numbers
   - **Ownership Cost**: scaled by average brand price tier

- [ ] **Step 4: Check that non-Porsche brands degrade gracefully**

If the dashboard shows any non-Porsche brand (e.g., Ferrari, BMW):
- Thesis should fall back to `mockWhyBuy`
- Market depth should fall back to sensible defaults (not crash)
- Top models should show actual listings (even if few)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(dashboard): replace all hardcoded mock data with live auction computations

BrandContextPanel now computes top models, recent sales, market depth,
and ownership cost from live auctions — same pattern as FamilyContextPanel.
ContextPanel recent sales and ownership cost are also live.
~200 lines of dead mock data removed."
```

---

## Expected Final State

| Panel | Before | After |
|---|---|---|
| **FamilyContextPanel** | All live (gold standard) | Unchanged |
| **BrandContextPanel** | 5/6 sections hardcoded | All live, brandConfig fallback |
| **ContextPanel** | 3/4 sections hardcoded | All live, brandConfig fallback |
| **Mock objects** | 6 objects (~200 lines) | 1 remaining (`mockWhyBuy` as fallback) |

Data flow after changes:
```
API → auctions → filteredAuctions → BrandContextPanel.auctions prop
                                   → brandAuctions (filtered by make)
                                   → topModels (useMemo)
                                   → recentSales (useMemo)
                                   → depth (useMemo, brandConfig fallback)
                                   → ownershipCost (useMemo, price-tier scaled)
                                   → whyBuy (brandConfig → mockWhyBuy fallback)
```
