# Data Quality Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all remaining hardcoded exchange rates, automate AS24 detail enrichment, expire stale dealer listings, add price validation, and increase VIN enrichment throughput — bringing data quality from ~85% to ~99%.

**Architecture:** Seven independent tasks addressing distinct quality gaps. Tasks 1-4 fix currency conversion accuracy across all server-side code. Task 5 adds lifecycle management for dealer listings. Task 6 adds price guardrails to the validator. Task 7 increases VIN decode throughput. Each task is independently deployable.

**Tech Stack:** TypeScript, Next.js API routes, Supabase, Vitest, Frankfurter API, NHTSA vPIC API

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `vercel.json` | Modify | Add enrich-details cron schedule |
| `src/app/api/enrich/route.ts` | Modify | Replace hardcoded EUR/GBP multipliers with live rates |
| `src/lib/marketStats.ts` | Modify | Switch from regionPricing.toUsd to exchangeRates.toUsd |
| `src/lib/marketStats.test.ts` | Modify | Add test for live-rate conversion |
| `src/lib/reports/queries.ts` | Modify | Switch from regionPricing.toUsd to exchangeRates.toUsd |
| `src/app/api/cron/cleanup/route.ts` | Modify | Add Step 1d: stale dealer listing expiry |
| `src/app/api/cron/cleanup/route.test.ts` | Modify | Add test for Step 1d |
| `src/features/scrapers/common/listingValidator.ts` | Modify | Add price validation rules |
| `src/features/scrapers/common/listingValidator.test.ts` | Modify | Add price validation tests |
| `src/app/api/cron/enrich-vin/route.ts` | Modify | Increase limit from 500 to 2000, raise maxDuration |

---

### Task 1: Schedule AS24 Detail Enrichment in Vercel Cron

**Files:**
- Modify: `vercel.json`

This is the simplest fix with high impact — the enrich-details route already works but isn't scheduled.

- [ ] **Step 1: Add the cron entry**

In `vercel.json`, add after the `enrich-titles` entry (line 13):

```json
{ "path": "/api/cron/enrich-details", "schedule": "30 7 * * *" }
```

**Important:** The existing last line (enrich-titles) currently has no trailing comma. You must add a comma after it before adding the new entry.

The full crons array should end:
```json
    { "path": "/api/cron/enrich-titles",   "schedule": "15 7 * * *" },
    { "path": "/api/cron/enrich-details",  "schedule": "30 7 * * *" }
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(cron): schedule AS24 detail enrichment at 07:30 UTC daily"
```

---

### Task 2: Replace Hardcoded Exchange Rates in enrich/route.ts

**Files:**
- Modify: `src/app/api/enrich/route.ts:80-92`

Lines 85-88 hardcode `0.92` (EUR) and `0.79` (GBP) for fair value conversion. These should use `getExchangeRates()` from the shared helper.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/enrich/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock exchangeRates BEFORE importing route
vi.mock("@/lib/exchangeRates", () => ({
  getExchangeRates: vi.fn().mockResolvedValue({
    EUR: 0.92,
    GBP: 0.79,
    JPY: 149.5,
  }),
}));

// Mock Supabase
const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockSelectSold = vi.fn().mockResolvedValue({
  data: [
    { id: "a", make: "Porsche", model: "911", year: 2020, hammer_price: 100000, status: "sold" },
    { id: "b", make: "Porsche", model: "911", year: 2021, hammer_price: 120000, status: "sold" },
  ],
  error: null,
});
const mockSelectNoThesis = vi.fn().mockResolvedValue({ data: [], error: null });

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "pricing") {
        return { upsert: mockUpsert };
      }
      if (table === "listings") {
        // Chain: .select().not().eq() for sold listings
        // Chain: .select().is().limit() for thesis
        return {
          select: vi.fn(() => ({
            not: vi.fn(() => ({
              eq: mockSelectSold,
            })),
            is: vi.fn(() => ({
              limit: mockSelectNoThesis,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      return {};
    }),
  })),
}));

describe("POST /api/enrich", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.CRON_SECRET = "test-secret";
  });

  it("uses getExchangeRates for EUR/GBP conversion instead of hardcoded rates", async () => {
    const { getExchangeRates } = await import("@/lib/exchangeRates");
    const { POST } = await import("./route");

    const request = new Request("http://localhost/api/enrich", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    await POST(request);

    // Verify getExchangeRates was called
    expect(getExchangeRates).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/enrich/route.test.ts`
Expected: FAIL — `getExchangeRates` was not called (current code uses hardcoded multipliers)

- [ ] **Step 3: Implement the fix**

In `src/app/api/enrich/route.ts`:

1. Add import at top:
```ts
import { getExchangeRates } from "@/lib/exchangeRates";
```

2. After `const errors: string[] = [];` (line 36), fetch rates:
```ts
  const rates = await getExchangeRates();
```

3. Replace lines 85-88:
```ts
              fair_value_low_eur: Math.round(low * 0.92),
              fair_value_high_eur: Math.round(high * 0.92),
              fair_value_low_gbp: Math.round(low * 0.79),
              fair_value_high_gbp: Math.round(high * 0.79),
```
With:
```ts
              fair_value_low_eur: Math.round(low * (rates.EUR ?? 0.92)),
              fair_value_high_eur: Math.round(high * (rates.EUR ?? 0.92)),
              fair_value_low_gbp: Math.round(low * (rates.GBP ?? 0.79)),
              fair_value_high_gbp: Math.round(high * (rates.GBP ?? 0.79)),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/enrich/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/enrich/route.ts src/app/api/enrich/route.test.ts
git commit -m "fix(enrich): replace hardcoded EUR/GBP rates with live Frankfurter API rates"
```

---

### Task 3: Migrate marketStats.ts to Live Exchange Rates

**Files:**
- Modify: `src/lib/marketStats.ts:8,100-101,186-188`
- Modify: `src/lib/marketStats.test.ts`
- Modify: `src/app/api/analyze/route.ts` (caller)
- Modify: `src/app/[locale]/cars/[make]/[id]/report/page.tsx` (caller)

The `computeRegionalStats` function calls `toUsd(median, symbol)` from `regionPricing.ts` which uses hardcoded rates with currency symbols. We need to switch to `toUsd(median, isoCode, rates)` from `exchangeRates.ts` which uses live rates with ISO codes.

**Key insight:** The callers already have ISO codes from `SOURCE_REGION` (e.g. `"EUR"`, `"GBP"`). They convert to symbols (`"€"`, `"£"`) only because the old `toUsd` required symbols. With the new `toUsd`, we pass ISO codes directly — simpler code.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/marketStats.test.ts`:

```ts
  it("accepts rates parameter for USD conversion", () => {
    const listings = Array.from({ length: 3 }, (_, i) =>
      makeListing({
        id: `eur-${i}`,
        source: "AutoScout24",
        status: "active",
        hammerPrice: 90000 + i * 10000,
        originalCurrency: "EUR",
      })
    )
    // Pass custom rates where 1 USD = 0.50 EUR (i.e. EUR is very strong)
    const stats = computeMarketStats(listings, "series", { EUR: 0.5 })!
    expect(stats).not.toBeNull()
    // median EUR price = 100000, with rate 0.5: 100000 / 0.5 = 200000 USD
    expect(stats.primaryFairValueLow).toBeGreaterThan(150000)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/marketStats.test.ts`
Expected: FAIL — `computeMarketStats` does not accept a `rates` parameter

- [ ] **Step 3: Implement the migration**

In `src/lib/marketStats.ts`:

1. Change import (line 8):
```ts
// REMOVE:
import { toUsd } from "./regionPricing"
// ADD:
import { toUsd } from "./exchangeRates"
```

2. Add `rates` parameter to `computeRegionalStats` (line 81):
```ts
export function computeRegionalStats(
  listings: PricedListingRecord[],
  region: string,
  tier: 1 | 2 | 3,
  currency: string,
  rates: Record<string, number> = {},
): RegionalMarketStats | null {
```

3. Replace line 100-101:
```ts
  // REMOVE:
  const symbol = ISO_TO_SYMBOL[currency] ?? "$"
  const medianUsd = Math.round(toUsd(median, symbol))
  // ADD:
  const medianUsd = Math.round(toUsd(median, currency, rates))
```

4. Add `rates` parameter to `computeMarketStats` (line 162):
```ts
export function computeMarketStats(
  listings: PricedListingRecord[],
  scope: "model" | "series" | "family",
  rates: Record<string, number> = {},
): ModelMarketStats | null {
```

5. Pass `rates` to `computeRegionalStats` call (line 170):
```ts
    const stats = computeRegionalStats(
      group.listings,
      group.region,
      group.tier as 1 | 2 | 3,
      group.currency,
      rates,
    )
```

6. Replace lines 186-188:
```ts
  // REMOVE:
  const symbol = ISO_TO_SYMBOL[primary.currency] ?? "$"
  const fairLow = Math.round(toUsd(primary.p25Price, symbol))
  const fairHigh = Math.round(toUsd(primary.p75Price, symbol))
  // ADD:
  const fairLow = Math.round(toUsd(primary.p25Price, primary.currency, rates))
  const fairHigh = Math.round(toUsd(primary.p75Price, primary.currency, rates))
```

7. Add `rates` parameter to `computeMarketStatsForCar` (line 222):
```ts
export function computeMarketStatsForCar(
  car: { make: string; model: string; year: number },
  allPriced: PricedListingRow[],
  rates: Record<string, number> = {},
): { marketStats: ModelMarketStats | null; pricedRecords: PricedListingRecord[] } {
```

8. Pass `rates` to `computeMarketStats` call (line 261):
```ts
  const marketStats = computeMarketStats(pricedRecords, scope, rates)
```

- [ ] **Step 4: Fix existing test that will break**

The existing test `"converts EUR listings to USD for medianPriceUsd"` calls `computeRegionalStats(listings, "EU", 2, "EUR")` without `rates`. With the old `regionPricing.toUsd("€")`, it multiplied by `1.08` → result `108000 > 100000`. But with the new `exchangeRates.toUsd("EUR", {})`, empty rates means the amount passes through unchanged → result `100000`, which fails `toBeGreaterThan(100000)`.

Fix by passing rates to the test:

```ts
  it("converts EUR listings to USD for medianPriceUsd", () => {
    const listings = [
      makeListing({ id: "1", hammerPrice: 90000, originalCurrency: "EUR" }),
      makeListing({ id: "2", hammerPrice: 100000, originalCurrency: "EUR" }),
      makeListing({ id: "3", hammerPrice: 110000, originalCurrency: "EUR" }),
    ]
    const stats = computeRegionalStats(listings, "EU", 2, "EUR", { EUR: 0.92 })!
    expect(stats.medianPrice).toBe(100000) // native EUR
    expect(stats.medianPriceUsd).toBeGreaterThan(100000) // 100000 / 0.92 ≈ 108696
  })
```

- [ ] **Step 5: Run all tests to verify they pass**

Run: `npx vitest run src/lib/marketStats.test.ts`
Expected: All PASS

- [ ] **Step 6: Update callers to pass live rates**

In `src/app/api/analyze/route.ts` (line 5 and 81):

```ts
// Add import:
import { getExchangeRates } from "@/lib/exchangeRates"

// At line 81, change:
//   const { marketStats, pricedRecords } = computeMarketStatsForCar(car, allPriced)
// To:
    const rates = await getExchangeRates()
    const { marketStats, pricedRecords } = computeMarketStatsForCar(car, allPriced, rates)
```

In `src/app/[locale]/cars/[make]/[id]/report/page.tsx` (line 11 and 89):

```ts
// Add import:
import { getExchangeRates } from "@/lib/exchangeRates"

// At line 89, change:
//   const { marketStats } = computeMarketStatsForCar(car, allPriced)
// To:
  const rates = await getExchangeRates()
  const { marketStats } = computeMarketStatsForCar(car, allPriced, rates)
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 8: Run all tests**

Run: `npx vitest run src/lib/marketStats.test.ts`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/marketStats.ts src/lib/marketStats.test.ts src/app/api/analyze/route.ts "src/app/[locale]/cars/[make]/[id]/report/page.tsx"
git commit -m "fix(marketStats): use live exchange rates instead of hardcoded symbol-based rates"
```

---

### Task 4: Migrate reports/queries.ts to Live Exchange Rates

**Files:**
- Modify: `src/lib/reports/queries.ts:14,63-65`

The `saveReport` function uses `toUsd(avgPrice, sym)` from `regionPricing.ts` with currency symbols. Switch to ISO-based `toUsd` from `exchangeRates.ts`.

- [ ] **Step 1: Implement the migration**

In `src/lib/reports/queries.ts`:

1. Change import (line 14) and remove unused import (line 15):
```ts
// REMOVE:
import { toUsd } from "../regionPricing"
import { ISO_TO_SYMBOL } from "../marketStats"
// ADD:
import { toUsd } from "../exchangeRates"
```

(`ISO_TO_SYMBOL` is no longer needed since we pass ISO codes directly to `toUsd` instead of converting to symbols first.)

2. `saveReport` is already async. Change lines 59-65:
```ts
    // REMOVE:
    const sym = primary ? (ISO_TO_SYMBOL[primary.currency] ?? "$") : "$"
    row.fair_value_low = marketStats.primaryFairValueLow
    row.fair_value_high = marketStats.primaryFairValueHigh
    row.median_price = primary ? Math.round(primary.medianPriceUsd) : null
    row.avg_price = primary ? Math.round(toUsd(primary.avgPrice, sym)) : null
    row.min_price = primary ? Math.round(toUsd(primary.minPrice, sym)) : null
    row.max_price = primary ? Math.round(toUsd(primary.maxPrice, sym)) : null
    // ADD:
    const { getExchangeRates } = await import("../exchangeRates")
    const rates = await getExchangeRates()
    const cur = primary?.currency ?? "USD"
    row.fair_value_low = marketStats.primaryFairValueLow
    row.fair_value_high = marketStats.primaryFairValueHigh
    row.median_price = primary ? Math.round(primary.medianPriceUsd) : null
    row.avg_price = primary ? Math.round(toUsd(primary.avgPrice, cur, rates)) : null
    row.min_price = primary ? Math.round(toUsd(primary.minPrice, cur, rates)) : null
    row.max_price = primary ? Math.round(toUsd(primary.maxPrice, cur, rates)) : null
```

Note: We use dynamic `import()` for `getExchangeRates` to avoid top-level import of a server-only function in a file that's also imported by tests. The static `toUsd` import at line 14 is a pure function and safe everywhere.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Run existing queries tests**

Run: `npx vitest run src/lib/reports/queries.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/queries.ts
git commit -m "fix(reports): use live exchange rates for report price conversions"
```

---

### Task 5: Add Step 1d to Cleanup — Expire Stale Dealer Listings

**Files:**
- Modify: `src/app/api/cron/cleanup/route.ts`
- Modify: `src/app/api/cron/cleanup/route.test.ts`

**Problem:** Dealer listings from AutoTrader, BeForward, and AutoScout24 have no `end_time`. The cleanup cron only marks listings as sold/unsold when `end_time < now` (Steps 1a/1b) or when URLs return 404 (Step 1c). Dealer listings that were sold/removed from the source website but weren't caught by backfill (because their URL returns a redirect or generic page, not 404) stay `active` forever.

**Solution:** Step 1d — any listing that is `active`, has no `end_time`, and hasn't been updated in >90 days is almost certainly no longer available. Mark as `unsold`.

- [ ] **Step 1: Write the failing test**

Add to `src/app/api/cron/cleanup/route.test.ts`:

```ts
  it("includes staleDealer count in response (Step 1d)", async () => {
    const request = new Request("http://localhost:3000/api/cron/cleanup", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body).toHaveProperty("staleDealerFixed");
    expect(typeof body.staleDealerFixed).toBe("number");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/cleanup/route.test.ts`
Expected: FAIL — `staleDealerFixed` property not in response

- [ ] **Step 3: Update Supabase mock chain**

The Step 1d query uses `.update().eq("status", "active").is("end_time", null).lt("updated_at", cutoff90d).select("id")`. The existing mock's `eqReturn` needs an `.is()` method.

Update the mock in `route.test.ts`. In the `createChainableMock()` function, add `isReturn` to the chain:

```ts
        // is() is used by Step 1d (stale dealer → unsold)
        const isReturn = {
          lt: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        };

        // The eq() return must have lt(), contains(), and is()
        const eqReturn = {
          lt: vi.fn().mockReturnValue(ltReturn),
          contains: vi.fn().mockReturnValue(containsReturn),
          is: vi.fn().mockReturnValue(isReturn),
        };
```

- [ ] **Step 4: Implement Step 1d**

In `src/app/api/cron/cleanup/route.ts`, after the Step 1c block (after `deadUrlFixedCount` logging, around line 202), add:

```ts
    // ── Step 1d: Expire stale dealer listings ──
    // Dealer listings (no end_time) that haven't been updated in >90 days
    // are almost certainly no longer available. Mark as 'unsold'.
    const cutoff90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: staleDealerData, error: staleDealerErr } = await supabase
      .from("listings")
      .update({ status: "unsold", updated_at: now })
      .eq("status", "active")
      .is("end_time", null)
      .lt("updated_at", cutoff90d)
      .select("id");

    if (staleDealerErr) {
      console.error("[cron/cleanup] stale-dealer→unsold error:", staleDealerErr.message);
    }
    const staleDealerCount = staleDealerData?.length ?? 0;
    if (staleDealerCount > 0) {
      console.log(`[cron/cleanup] Expired ${staleDealerCount} stale dealer listings (>90d, no end_time)`);
    }
```

Then update BOTH response paths to include `staleDealerFixed: staleDealerCount`:

**Early return path** (around line 276): Add `staleDealerFixed: staleDealerCount` to the JSON response and update `written` to include `staleDealerCount`.

**Normal return path** (around line 345): Add `staleDealerFixed: staleDealerCount` to the JSON response and update `written` to include `staleDealerCount`.

Also add `staleDealerCount` to `refresh_updated` in both `recordScraperRun` calls.

Add to `allMessages` / `earlyMessages`:
```ts
if (staleDealerCount > 0) earlyMessages.push(`stale-dealer-unsold: ${staleDealerCount}`);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/app/api/cron/cleanup/route.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/cleanup/route.ts src/app/api/cron/cleanup/route.test.ts
git commit -m "feat(cleanup): add Step 1d — expire dealer listings inactive >90 days"
```

---

### Task 6: Add Price Validation Rules to Listing Validator

**Files:**
- Modify: `src/features/scrapers/common/listingValidator.ts`
- Modify: `src/features/scrapers/common/listingValidator.test.ts`

**Problem:** Listings with absurd prices ($0, $1, $999,999,999) distort statistics and fair value calculations. The validator currently only checks make/model/title — not price.

**Solution:** Add optional `price` field to `ListingInput` and validate against reasonable Porsche price bounds.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/scrapers/common/listingValidator.test.ts`:

```ts
describe("price validation", () => {
  it("rejects listings with price below $500", () => {
    const result = validateListing({
      make: "Porsche",
      model: "911",
      title: "2020 Porsche 911",
      year: 2020,
      price: 100,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("price-too-low:100");
  });

  it("rejects listings with price above $50M", () => {
    const result = validateListing({
      make: "Porsche",
      model: "911",
      title: "2020 Porsche 911",
      year: 2020,
      price: 60_000_000,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("price-too-high:60000000");
  });

  it("accepts listings with no price (price validation is optional)", () => {
    const result = validateListing({
      make: "Porsche",
      model: "911",
      title: "2020 Porsche 911",
      year: 2020,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts listings with price=0 (means no price data yet)", () => {
    const result = validateListing({
      make: "Porsche",
      model: "911",
      title: "2020 Porsche 911",
      year: 2020,
      price: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts listings within normal range", () => {
    const result = validateListing({
      make: "Porsche",
      model: "911",
      title: "2020 Porsche 911",
      year: 2020,
      price: 85000,
    });
    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/scrapers/common/listingValidator.test.ts`
Expected: FAIL — `price` property does not exist on `ListingInput`

- [ ] **Step 3: Implement price validation**

In `src/features/scrapers/common/listingValidator.ts`:

1. Add `price` to `ListingInput` interface (line 31):
```ts
interface ListingInput {
  make: string;
  model: string;
  title: string;
  year?: number;
  price?: number;
}
```

2. Add price constants at the top (after `INVALID_MODELS`, around line 13):
```ts
const MIN_PRICE_USD = 500;      // Below $500 is almost certainly data error
const MAX_PRICE_USD = 50_000_000; // $50M cap (even a 917K is ~$14M)
```

3. In `validateListing()`, add Rule 5 before the final `return { valid: true }` (before line 168):
```ts
  // Rule 5: Price sanity check (only when price is provided and > 0)
  if (listing.price && listing.price > 0) {
    if (listing.price < MIN_PRICE_USD) {
      return { valid: false, reason: `price-too-low:${listing.price}` };
    }
    if (listing.price > MAX_PRICE_USD) {
      return { valid: false, reason: `price-too-high:${listing.price}` };
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/scrapers/common/listingValidator.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/common/listingValidator.ts src/features/scrapers/common/listingValidator.test.ts
git commit -m "feat(validator): add price sanity check ($500–$50M range)"
```

---

### Task 7: Increase VIN Enrichment Throughput

**Files:**
- Modify: `src/app/api/cron/enrich-vin/route.ts:12,47`

**Problem:** The VIN enrichment cron processes 500 listings per run with a 60s timeout. NHTSA batches of 50 VINs with 1s delay between batches means 500 VINs needs ~10 batches × ~2s each ≈ 20s — well within 60s. But the 500 limit means it takes many days to work through the backlog. We can safely increase to 2000 VINs (40 batches × ~2s ≈ 80s) with a 120s timeout.

- [ ] **Step 1: Increase the limit and timeout**

In `src/app/api/cron/enrich-vin/route.ts`:

1. Change line 12:
```ts
// REMOVE:
export const maxDuration = 60; // VIN decode is fast — 60s is plenty
// ADD:
export const maxDuration = 120;
```

2. Change line 47:
```ts
// REMOVE:
      .limit(500);
// ADD:
      .limit(2000);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/enrich-vin/route.ts
git commit -m "perf(enrich-vin): increase throughput from 500 to 2000 VINs per run"
```

---

## Final Verification

- [ ] **Step 1: TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Clean (no new errors)

- [ ] **Step 2: All scraper/cron tests pass**

Run: `npx vitest run src/app/api/cron/ src/app/api/enrich/ src/lib/marketStats.test.ts src/features/scrapers/common/listingValidator.test.ts`
Expected: All PASS

- [ ] **Step 3: No hardcoded exchange rates remain in server code**

Run: `grep -rn "0\.92\|0\.79\|1\.08\|1\.27\|0\.0067" src/lib/regionPricing.ts src/app/api/enrich/route.ts src/lib/marketStats.ts src/lib/reports/queries.ts`
Expected: Only `regionPricing.ts` (kept for formatting/display functions that are NOT used for conversion accuracy) and no hits in the other 3 files.

- [ ] **Step 4: Verify vercel.json has enrich-details**

Run: `grep enrich-details vercel.json`
Expected: `{ "path": "/api/cron/enrich-details", "schedule": "30 7 * * *" }`

---

## Summary of Impact

| Task | Quality Gap Fixed | Impact |
|------|------------------|--------|
| 1. Schedule enrich-details | AS24 listings missing trim/transmission/images | HIGH — automates enrichment of ~25 listings/day |
| 2. Fix enrich/route.ts rates | Fair values use stale EUR/GBP rates | MEDIUM — affects pricing table accuracy |
| 3. Fix marketStats.ts rates | Regional stats use stale symbol-based rates | MEDIUM — affects reports and investment analysis |
| 4. Fix queries.ts rates | Report prices use stale rates | MEDIUM — affects saved report accuracy |
| 5. Stale dealer expiry | Dealer listings stay active forever | HIGH — cleans up listings gone from source |
| 6. Price validation | Absurd prices distort statistics | MEDIUM — prevents $0 and $999M outliers |
| 7. VIN throughput | Slow backlog processing | LOW — 4x faster VIN enrichment |
