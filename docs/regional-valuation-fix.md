# Regional Valuation Fix — Frontend Documentation

## Problem
The "Valuation by Market" indicator showed identical values across all 4 regions (US, EU, UK, JP). The bars were the same width and percentages were identical because the pricing was just a currency conversion that round-tripped back to the same USD value.

## Root Cause
`buildFairValue()` in `supabaseLiveListings.ts` applied hardcoded currency conversion rates (e.g., `price × 0.92` for EUR) that, when reconverted to USD via `toUsd()` (multiply by `1.08`), produced nearly identical values: `0.92 × 1.08 ≈ 1.0`.

There was **no regional market premium** — only currency conversion.

## What Was Fixed (Frontend Only)

### 1. `src/lib/regionPricing.ts` — New centralized pricing engine
- Added `REGIONAL_MARKET_PREMIUM` constants:
  - US: `1.0` (base market)
  - EU: `1.08` (+8% European collector premium)
  - UK: `1.15` (+15% UK import/RHD premium)
  - JP: `0.85` (-15% LHD import discount)
- Added `buildRegionalFairValue(usdPrice)` — applies premium × FX rate per region
- Exported for use across all modules

### 2. `src/lib/supabaseLiveListings.ts` — Server-side data source
- `buildFairValue()` now delegates to `buildRegionalFairValue()` from regionPricing.ts
- Every car fetched from Supabase gets properly differentiated regional pricing
- Import added: `import { buildRegionalFairValue } from "./regionPricing"`

### 3. `src/app/[locale]/cars/[make]/MakePageClient.tsx` — Model-level aggregation
- `aggregateRegionalPricing()` rewritten to always derive from USD base prices using `buildRegionalFairValue()` (client-side recalculation, doesn't depend on stale server cache)
- Added subtitle "Fair value range by region" under header

### 4. `src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx` — Car-level display
- Both desktop and mobile valuation panels now recalculate from USD base via `buildRegionalFairValue()` instead of reading potentially stale `car.fairValueByRegion`
- Added subtitle under header

### 5. `src/components/dashboard/DashboardClient.tsx` — Family & brand level
- Family-level `regionalVal` rewritten to use `REGIONAL_MARKET_PREMIUM` for both `usdCurrent` (bar widths) and per-region appreciation rates
- 5-year appreciation now varies by region: US +22%, UK +28%, EU +18%, JP +12%
- `+{pct}%` badge now shows "5Y" suffix for clarity
- Added subtitle "Avg. valuation & 5-year return by region" under header
- Brand-level uses `mockRegionalValuation` which already had differentiated values

## Result

| Region | Market Premium | Bar Width | 5Y Return |
|--------|---------------|-----------|-----------|
| US     | 1.0x (base)   | ~87%      | +22%      |
| EU     | 1.08x         | ~94%      | +18%      |
| UK     | 1.15x         | 100%      | +28%      |
| JP     | 0.85x         | ~74%      | +12%      |

Japan shows as "BEST VALUE" (cheapest market). UK is most expensive.
"YOUR MARKET" badge highlights the user's selected region from the top-level selector.

## Backend Recommendations

When real per-region pricing data becomes available from the DB, the backend should:

1. **Store actual regional prices** in the `listings` table (e.g., `price_usd`, `price_eur`, `price_gbp`, `price_jpy`) based on real auction data from each market
2. **Source-aware pricing**: Cars from Collecting Cars (UK) should have native GBP prices; BaT/Cars & Bids (US) have native USD. The DB should store the original currency and amount
3. **Historical appreciation by region**: Track sold prices over time per region to compute real 5-year returns instead of the current hardcoded estimates
4. **Replace `buildFairValue`**: Once the DB stores real multi-region pricing, `buildFairValue` can be removed and the API can return actual `fairValueByRegion` per car

The current frontend premiums (`REGIONAL_MARKET_PREMIUM` in `regionPricing.ts`) are reasonable estimates based on collector car market dynamics and can be fine-tuned or replaced with data-driven values.

## Files Changed
```
src/lib/regionPricing.ts                              — REGIONAL_MARKET_PREMIUM + buildRegionalFairValue()
src/lib/supabaseLiveListings.ts                       — buildFairValue() delegates to new function
src/app/[locale]/cars/[make]/MakePageClient.tsx        — aggregateRegionalPricing() rewritten + subtitle
src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx  — client-side recalculation + subtitle
src/components/dashboard/DashboardClient.tsx           — family-level with premiums + 5Y label + subtitle
```
