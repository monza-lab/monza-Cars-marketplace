# Real-Data Regional Valuations — Design Spec

**Date:** 2026-03-15
**Status:** Approved

## Problem

The "Valuation by Market" component in DashboardClient shows regional prices derived from hardcoded multipliers (`REGIONAL_MARKET_PREMIUM`: US 1.0, EU 1.08, UK 1.15, JP 0.85). These numbers are invented and don't reflect real market data. The actual auction data with real prices and real regions already exists in the loaded auctions.

## Solution

Replace hardcoded premium multipliers with **median sold prices grouped by region** from the auctions already loaded in DashboardClient.

### Computation (client-side)

1. Group `familyAuctions` by `region` field (US/UK/EU/JP)
2. Filter each group to sold listings with `price > 0`
3. Compute **median price** per region
4. If a region has 0 sold listings, fall back to median of `currentBid` from active listings
5. If still 0 → show "No data" / hide that region's bar

### Region source

Use the listing's `region` field (already mapped from `country` via `mapRegion()` in supabaseLiveListings.ts).

### Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/DashboardClient.tsx` | Rewrite both `regionalVal` useMemos (family card ~line 1678, brand card ~line 2087) |
| `src/lib/regionPricing.ts` | Remove `REGIONAL_MARKET_PREMIUM` export (no longer needed) |

### What gets removed
- `REGIONAL_MARKET_PREMIUM` constant and its usage
- Hardcoded FX rates in DashboardClient (1/0.0067, 1/1.27, 1/1.08)
- The `baseMillions * premium` formula

### What gets added
- `computeMedian(prices: number[]): number` utility in DashboardClient (pure function)
- New `regionalVal` logic grouping real auctions by region

### Edge cases
- Region with 0 sold listings → fall back to currentBid median
- Region with 0 listings of any kind → `usdCurrent: 0`, bar hidden
- FX conversion still uses `TO_USD_RATE` / `FROM_USD_RATE` from regionPricing.ts
