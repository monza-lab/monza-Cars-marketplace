# Currency Toggle — Design Spec

**Date:** 2026-03-17
**Goal:** Decouple currency display from market/region selection so users can view all prices in their preferred currency, with real-time exchange rates from an external API.

---

## Problem

Currently, switching the region pill (US/EU/UK/JP) changes both the listing filter AND the display currency. Users cannot view EU market listings priced in USD, or US listings in EUR. This is confusing when comparing across markets.

## Solution

Add a separate currency dropdown in the navbar. Currency selection is independent of region filtering. Exchange rates come from a live API instead of hardcoded values. Regional market premiums are removed — conversion is pure FX.

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/app/api/exchange-rates/route.ts` | Next.js API route — proxy to frankfurter.app, server-side cache (1h TTL) |
| `src/lib/CurrencyContext.tsx` | React context: selected currency, live rates, `useCurrency()` hook |
| `src/components/layout/CurrencyDropdown.tsx` | Dropdown button in navbar — `$ USD`, `€ EUR`, `£ GBP`, `¥ JPY` |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/regionPricing.ts` | Remove hardcoded rates, premiums, `formatPriceForRegion()`, `getCurrency()`. Keep `formatRegionalPrice()` (formatting only), `formatUsd()`, `resolveRegion()`. |
| `src/lib/RegionContext.tsx` | Remove `currency` from context type and derived state. |
| `src/app/[locale]/layout.tsx` | Add `CurrencyProvider` to provider stack. |
| `src/components/layout/Header.tsx` | Add `CurrencyDropdown` next to region pills. |
| `src/lib/utils/formatters.ts` | Remove or adapt `formatCurrency()` to accept currency param, or mark callers for migration to `useCurrency().formatPrice()`. |
| ~28 consumer files | Replace `formatPriceForRegion(amount, selectedRegion)` with `formatPrice(amount)` from `useCurrency()`. |
| ~12 `formatCurrency()` callers | Replace hardcoded USD `formatCurrency()` with `useCurrency().formatPrice()`. Includes: `AuctionCard`, `AuctionsClient`, `AuctionDetailClient`, `SearchClient`, `PriceChart`, `OwnershipCost`, `RecentSales`. |

### Unchanged

- `RegionContext` still handles market filtering (selectedRegion, setSelectedRegion, effectiveRegion).
- Supabase data layer — prices remain stored in USD.

---

## API Route: `/api/exchange-rates`

```
GET /api/exchange-rates
→ Proxies: https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY
→ Response: { base: "USD", rates: { EUR: 0.92, GBP: 0.79, JPY: 149.5 }, updatedAt: "..." }
→ Cache: in-memory variable, 1h TTL
→ Headers: Cache-Control: public, max-age=3600
→ Fallback: if frankfurter fails, return last known rates (or hardcoded defaults on first failure)
```

No API key required. frankfurter.app is free and open-source.

Rates are fetched once per page load. No periodic refresh — FX precision is not critical for collector car browsing.

---

## CurrencyContext

```typescript
type Currency = "USD" | "EUR" | "GBP" | "JPY"
type Rates = Record<string, number>  // { EUR: 0.92, GBP: 0.79, JPY: 149.5 }

type CurrencyContextType = {
  currency: Currency
  setCurrency: (c: Currency) => void
  rates: Rates | null
  isLoading: boolean
  convertFromUsd: (amount: number) => number
  formatPrice: (usdAmount: number) => string
}
```

- Fetches `/api/exchange-rates` on mount (once per page load).
- Persists `currency` in `localStorage` key `monza-currency`.
- On load, reads from localStorage; defaults to `"USD"`.
- `convertFromUsd(amount)` returns `amount * rates[currency]` (or `amount` if USD).
- `formatPrice(amount)` converts then formats using existing `formatRegionalPrice()`.

### SSR / Hydration Strategy

All price-displaying components in this project are `"use client"` components. The `CurrencyProvider` initializes with `"USD"` on the server and reads localStorage on the client. Since prices are rendered inside client components that already handle their own state, the initial server render shows USD and the client corrects to the user's saved preference on mount. This is the same pattern the project already uses for region selection (no SSR persistence). No special hydration suppression needed.

---

## CurrencyDropdown

- Single button showing current currency: `$ USD` with a chevron.
- Click opens dropdown with 4 options, each showing symbol + code.
- Active option has a checkmark.
- Reuses animation patterns from existing `DropdownSelect.tsx`.
- Closes on selection or outside click.

---

## Migration: `formatPriceForRegion` → `formatPrice`

**Before:**
```tsx
const { selectedRegion } = useRegion()
formatPriceForRegion(car.price, selectedRegion)
```

**After:**
```tsx
const { formatPrice } = useCurrency()
formatPrice(car.price)
```

### Migration scope (~28 files using `formatPriceForRegion`):

Dashboard: `DashboardClient`, `FamilyCard`, `FamilyContextPanel`, `BrandContextPanel`, `RegionalValuation`, `RecentSales`, `OwnershipCost`, `DiscoverySidebar`, `MobileLiveAuctions`, `MobileBrandRow`, `MobileHeroBrand`, `MobileRegionPills`.

Make page: `MakePageClient`, `CarFeedCard`, `ModelFeedCard`, `GenerationFeedCard`, `CarCard`, `ModelNavSidebar`, `CarContextPanel`, `GenerationContextPanel`, `ModelContextPanel`, `MobileMakeLiveAuctions`, `MobileModelContext`, `MobileModelRow`, `MobileHeroModel`, `MakePageRegionPills`.

Other: `CarDetailClient`, `ReportClient`, `AdvisorChat`, `advisorEngine`, `OnboardingModal`, `Header`.

### Migration scope (~12 files using hardcoded `formatCurrency()`):

`AuctionCard`, `AuctionsClient`, `AuctionDetailClient`, `SearchClient`, `PriceChart`, `OwnershipCost`, `RecentSales`, `FeaturedAuctionsSection`, `AnalysisReport`, `ModelPageClient`.

### `toUsd()` callers:

Files using `toUsd()` (e.g., `RegionalValuation`, `RecentSales`) will be updated to use the live rates from context. The `toUsd()` function in `regionPricing.ts` will be updated to accept a rates object parameter, or callers will compute the inverse directly from `rates`.

---

## FairValueByRegion — Fate

With regional premiums removed, the per-region fair values become pure FX conversions of the same USD base price. This makes the "Regional Comparison" table (showing US/EU/UK/JP side by side) **redundant** — all 4 rows would be the same value in different currencies.

**Decision:** Convert the Regional Comparison panels into a **"Price in other currencies"** display. Instead of showing 4 region rows with implied market premium differences, show the single fair value range converted to the user's selected currency. The `FairValueByRegion` type remains in the codebase (it's part of `CollectorCar`) but the UI simplifies:

- `RegionalValuation` component: show fair value low/high in the selected currency (from `useCurrency()`) instead of a 4-row region table.
- `buildRegionalFairValue()`: keep for backwards compatibility with data already computed, but new displays use `convertFromUsd()` from context.

---

## What Gets Removed

- `TO_USD_RATE`, `FROM_USD_RATE` constants (replaced by live API rates)
- `REGIONAL_MARKET_PREMIUM` constant (eliminated entirely)
- `formatPriceForRegion()` function (replaced by context's `formatPrice()`)
- `getCurrency()` function (no longer needed — currency comes from context)
- `currency` field from `RegionContext` (decoupled)
- `REGION_CURRENCY` map (no remaining consumers after migration)

## What Stays

- `formatRegionalPrice(value, symbol)` — pure formatting (K/M/億 abbreviations)
- `formatUsd(value)` — explicit USD formatting for edge cases
- `resolveRegion()` — still used for region filtering
- `buildRegionalFairValue()` — kept for data compatibility, not used in new display logic
- `FairValueByRegion` type — kept in `CollectorCar` interface

---

## Persistence

- Currency stored in `localStorage` under key `monza-currency`.
- On app load: read localStorage → set initial currency.
- On change: update localStorage + context state.
- No server-side persistence needed.

---

## Error Handling

- If `/api/exchange-rates` fails on first load: use hardcoded fallback rates (same as current values).
- If API fails on subsequent loads: keep last successful rates in memory.
- Toggle is always functional — worst case uses stale rates.
- Loading state: dropdown enabled but shows current currency; prices render with best available rates.
