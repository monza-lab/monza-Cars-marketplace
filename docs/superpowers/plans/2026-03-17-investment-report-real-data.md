# Investment Report: Real Data + Gemini LLM — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all fabricated data in the investment report with real market data from Supabase, then add Gemini LLM analysis — using a 3-tier regional market segregation approach.

**Architecture:** Server component fetches priced listings from Supabase `listings` table, segregates by region/tier (US verified sales, EU/UK asking prices), computes per-region statistics, and passes them to the client. A "Generate Report" button calls the refactored `/api/analyze` endpoint which persists market stats + Gemini analysis to a new `listing_reports` Supabase table. Credits migrate from legacy PG to new Supabase tables.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL + RLS), Google Gemini (`@google/generative-ai`), Vitest, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-17-investment-report-real-data-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260317_create_listing_reports.sql` | DDL for `listing_reports` table with RLS |
| `supabase/migrations/20260317_create_credits_tables.sql` | DDL for `user_credits`, `user_reports`, `credit_transactions` with RLS |
| `src/lib/marketStats.ts` | Regional market stats computation: `segregateByRegion()`, `computeRegionalStats()`, `computeMarketStats()`, `computeMarketStatsForCar()` |
| `src/lib/marketStats.test.ts` | Unit tests for market stats module |
| `src/lib/reports/queries.ts` | Supabase CRUD for `listing_reports` and credits tables |
| `src/lib/reports/queries.test.ts` | Unit tests for report queries (mocked Supabase) |
| `src/lib/reports/types.ts` | Shared TypeScript interfaces: `ListingReport`, `UserCredits`, `RegionalMarketStats`, `ModelMarketStats` |
| `src/lib/ai/gemini.ts` | Gemini API client: `analyzeWithGemini(systemPrompt, userPrompt)` |
| `src/lib/ai/gemini.test.ts` | Unit tests for Gemini client (mocked API) |

### Modified files

| File | Changes |
|------|---------|
| `src/lib/regionPricing.ts` | Add CHF to `TO_USD_RATE` and `FROM_USD_RATE` |
| `src/lib/supabaseLiveListings.ts` | Add `fetchPricedListingsForModel()` |
| `src/lib/ai/prompts.ts` | Add `buildReportAnalysisPrompt()` with regional market data context |
| `src/lib/ai/analyzer.ts` | Add `analyzeForReport()` that uses Gemini instead of Claude |
| `src/app/api/analyze/route.ts` | Add `POST` handler for listing-based reports (Supabase + Gemini + new credits) |
| `src/hooks/useAnalysis.ts` | Refactor to `useReport()` hook for listing reports |
| `src/app/[locale]/cars/[make]/[id]/report/page.tsx` | Fetch priced listings, compute market stats, check existing report |
| `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx` | Accept new props, remove fabricated data, show regional market cards |

---

## Task 1: Supabase Migration — `listing_reports` Table

**Files:**
- Create: `supabase/migrations/20260317_create_listing_reports.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration: Create listing_reports table for investment report data
-- Stores computed market stats + Gemini LLM analysis per listing

CREATE TABLE IF NOT EXISTS listing_reports (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id             uuid NOT NULL,

  -- Market stats (best available tier, in USD)
  fair_value_low         numeric,
  fair_value_high        numeric,
  median_price           numeric,
  avg_price              numeric,
  min_price              numeric,
  max_price              numeric,
  total_comparable_sales integer,
  trend_percent          numeric,
  trend_direction        text,
  stats_scope            text,
  primary_tier           integer,
  primary_region         text,

  -- Full regional breakdown (all tiers)
  regional_stats         jsonb,

  -- LLM analysis (Gemini)
  investment_grade       text,
  confidence             text,
  red_flags              text[],
  key_strengths          text[],
  critical_questions     text[],
  yearly_maintenance     numeric,
  insurance_estimate     numeric,
  major_service_cost     numeric,
  appreciation_potential text,
  bid_target_low         numeric,
  bid_target_high        numeric,
  raw_llm_response       jsonb,

  -- Meta
  llm_model              text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_listing_reports_listing UNIQUE (listing_id)
);

CREATE INDEX idx_listing_reports_listing_id ON listing_reports(listing_id);

ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reports" ON listing_reports FOR SELECT USING (true);
CREATE POLICY "Service role inserts reports" ON listing_reports FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role updates reports" ON listing_reports FOR UPDATE USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Apply migration via Supabase Dashboard SQL editor**

Run the SQL in the Supabase Dashboard → SQL Editor. Verify the table exists:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'listing_reports' ORDER BY ordinal_position;
```

Expected: All columns listed above appear.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260317_create_listing_reports.sql
git commit -m "feat(db): create listing_reports table for investment reports"
```

---

## Task 2: Supabase Migration — Credits Tables

**Files:**
- Create: `supabase/migrations/20260317_create_credits_tables.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration: Create credits tables in Supabase
-- Replaces legacy PG User, UserAnalysis, CreditTransaction tables

CREATE TABLE IF NOT EXISTS user_credits (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id    uuid NOT NULL UNIQUE,
  email               text,
  display_name        text,
  credits_balance     integer NOT NULL DEFAULT 3,
  tier                text NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE', 'PRO')),
  credit_reset_date   timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own credits" ON user_credits FOR SELECT USING (auth.uid() = supabase_user_id);
CREATE POLICY "Service role manages credits" ON user_credits FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS user_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES user_credits(id),
  listing_id          uuid NOT NULL,
  report_id           uuid NOT NULL REFERENCES listing_reports(id),
  credit_cost         integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_user_reports_user_listing UNIQUE (user_id, listing_id)
);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own reports" ON user_reports FOR SELECT USING (
  user_id IN (SELECT id FROM user_credits WHERE supabase_user_id = auth.uid())
);
CREATE POLICY "Service role manages reports" ON user_reports FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS credit_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES user_credits(id),
  amount              integer NOT NULL,
  type                text NOT NULL CHECK (type IN ('FREE_MONTHLY', 'REPORT_USED', 'PURCHASE')),
  description         text,
  listing_id          uuid,
  stripe_payment_id   text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own transactions" ON credit_transactions FOR SELECT USING (
  user_id IN (SELECT id FROM user_credits WHERE supabase_user_id = auth.uid())
);
CREATE POLICY "Service role manages transactions" ON credit_transactions FOR ALL USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Apply migration via Supabase Dashboard SQL editor**

Verify all three tables exist:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('user_credits', 'user_reports', 'credit_transactions');
```

Expected: 3 rows returned.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260317_create_credits_tables.sql
git commit -m "feat(db): create credits tables in Supabase (user_credits, user_reports, credit_transactions)"
```

---

## Task 3: Shared Types — `src/lib/reports/types.ts`

**Files:**
- Create: `src/lib/reports/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
// ---------------------------------------------------------------------------
// Shared types for investment reports and credits
// ---------------------------------------------------------------------------

/** Stats for a single region/tier combination */
export interface RegionalMarketStats {
  region: string             // "US" | "EU" | "UK" | "JP"
  tier: 1 | 2 | 3
  tierLabel: string          // "Verified Sales" | "Active Listings" | "Recently Delisted"
  currency: string           // native: "USD" | "EUR" | "GBP" | "JPY"
  totalListings: number
  medianPrice: number        // native currency
  avgPrice: number           // native currency
  p25Price: number           // native currency
  p75Price: number           // native currency
  minPrice: number
  maxPrice: number
  medianPriceUsd: number     // converted to USD
  trendPercent: number       // e.g., +5.2 or -3.1
  trendDirection: "up" | "down" | "stable"
  oldestDate: string
  newestDate: string
  sources: string[]          // e.g., ["Bring a Trailer", "ClassicCom"]
}

/** Aggregated market stats across all regions */
export interface ModelMarketStats {
  scope: "model" | "series" | "family"
  regions: RegionalMarketStats[]
  primaryFairValueLow: number    // USD, P25 from best tier
  primaryFairValueHigh: number   // USD, P75 from best tier
  primaryTier: 1 | 2 | 3
  primaryRegion: string
  totalDataPoints: number
}

/** A row from listing_reports table */
export interface ListingReport {
  id: string
  listing_id: string
  fair_value_low: number | null
  fair_value_high: number | null
  median_price: number | null
  avg_price: number | null
  min_price: number | null
  max_price: number | null
  total_comparable_sales: number | null
  trend_percent: number | null
  trend_direction: string | null
  stats_scope: string | null
  primary_tier: number | null
  primary_region: string | null
  regional_stats: RegionalMarketStats[] | null
  investment_grade: string | null
  confidence: string | null
  red_flags: string[] | null
  key_strengths: string[] | null
  critical_questions: string[] | null
  yearly_maintenance: number | null
  insurance_estimate: number | null
  major_service_cost: number | null
  appreciation_potential: string | null
  bid_target_low: number | null
  bid_target_high: number | null
  raw_llm_response: Record<string, unknown> | null
  llm_model: string | null
  created_at: string
  updated_at: string
}

/** A row from user_credits table */
export interface UserCreditsRow {
  id: string
  supabase_user_id: string
  email: string | null
  display_name: string | null
  credits_balance: number
  tier: "FREE" | "PRO"
  credit_reset_date: string
  created_at: string
  updated_at: string
}

/** A row from credit_transactions table */
export interface CreditTransactionRow {
  id: string
  user_id: string
  amount: number
  type: "FREE_MONTHLY" | "REPORT_USED" | "PURCHASE"
  description: string | null
  listing_id: string | null
  stripe_payment_id: string | null
  created_at: string
}

/** Result of deducting a credit */
export type DeductResult =
  | { success: true; creditUsed: number; cached: boolean }
  | { success: false; error: string }

/** A priced listing record fetched from Supabase */
export interface PricedListingRecord {
  id: string
  year: number
  make: string
  model: string
  trim: string | null
  hammerPrice: number
  originalCurrency: string | null
  saleDate: string | null
  status: string
  mileage: number | null
  source: string
  country: string | null
}

/** Source-to-region mapping entry */
export interface SourceRegionInfo {
  region: string
  tier: 1 | 2 | 3
  currency: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/reports/types.ts
git commit -m "feat(types): add shared types for investment reports and credits"
```

---

## Task 4: Restore Missing Exports in Region Pricing + Add CHF

**Files:**
- Modify: `src/lib/regionPricing.ts`

The file was previously simplified and lost exports (`toUsd`, `TO_USD_RATE`, `FROM_USD_RATE`, `REGION_CURRENCY`, `convertFromUsd`, `getCurrency`, `formatPriceForRegion`, `getFairValueForRegion`) that many components still import. We need to restore them and add CHF support.

- [ ] **Step 1: Add missing constants and functions back to `regionPricing.ts`**

Add these after the existing `import` statement and before `resolveRegion`:

```typescript
// Region → currency symbol
export const REGION_CURRENCY: Record<string, string> = {
  US: "$",
  EU: "€",
  UK: "£",
  JP: "¥",
}

// Currency → USD rate
export const TO_USD_RATE: Record<string, number> = {
  "$": 1,
  "€": 1.08,
  "£": 1.27,
  "¥": 0.0067,
  "CHF": 1.13,
}

// USD → currency rate (inverse)
export const FROM_USD_RATE: Record<string, number> = {
  "$": 1,
  "€": 1 / 1.08,
  "£": 1 / 1.27,
  "¥": 1 / 0.0067,
  "CHF": 1 / 1.13,
}

// Regional market premium multipliers (relative to US base)
export const REGIONAL_MARKET_PREMIUM: Record<string, number> = {
  US: 1.0,
  EU: 1.08,
  UK: 1.15,
  JP: 0.85,
}

/** Convert any currency amount to USD */
export function toUsd(value: number, currency: string): number {
  return value * (TO_USD_RATE[currency] || 1)
}

/** Convert a USD amount to the target currency */
export function convertFromUsd(usdAmount: number, targetCurrency: string): number {
  return usdAmount * (FROM_USD_RATE[targetCurrency] || 1)
}

/** Get currency symbol for a region */
export function getCurrency(selected: string | null): string {
  return REGION_CURRENCY[resolveRegion(selected)]
}

/** One-liner: convert USD → target region, then format */
export function formatPriceForRegion(usdAmount: number, selectedRegion: string | null): string {
  const currency = getCurrency(selectedRegion)
  const converted = convertFromUsd(usdAmount, currency)
  return formatRegionalPrice(converted, currency)
}

/** Get the fair value range for the selected region */
export function getFairValueForRegion(
  fairValue: FairValueByRegion,
  selectedRegion: string | null
): import("./curatedCars").RegionalPricing {
  const region = resolveRegion(selectedRegion)
  return fairValue[region]
}
```

- [ ] **Step 2: Verify the dev server compiles**

Run: `npm run dev` — confirm no import errors in the console. Kill after successful compilation.

- [ ] **Step 3: Commit**

```bash
git add src/lib/regionPricing.ts
git commit -m "fix(pricing): restore missing exports (toUsd, TO_USD_RATE, etc.) + add CHF support"
```

---

## Task 5: Market Stats Module — `src/lib/marketStats.ts`

**Files:**
- Create: `src/lib/marketStats.ts`
- Create: `src/lib/marketStats.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/marketStats.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  segregateByRegion,
  computeRegionalStats,
  computeMarketStats,
  ISO_TO_SYMBOL,
  SOURCE_REGION,
} from "./marketStats"
import type { PricedListingRecord } from "./reports/types"

// ── Test data factory ──
function makeListing(overrides: Partial<PricedListingRecord> = {}): PricedListingRecord {
  return {
    id: "test-1",
    year: 2020,
    make: "Porsche",
    model: "911 Carrera",
    trim: null,
    hammerPrice: 100000,
    originalCurrency: "USD",
    saleDate: "2025-06-15",
    status: "sold",
    mileage: 15000,
    source: "Bring a Trailer",
    country: "US",
    ...overrides,
  }
}

describe("ISO_TO_SYMBOL", () => {
  it("maps common ISO codes to symbols", () => {
    expect(ISO_TO_SYMBOL["USD"]).toBe("$")
    expect(ISO_TO_SYMBOL["EUR"]).toBe("€")
    expect(ISO_TO_SYMBOL["GBP"]).toBe("£")
    expect(ISO_TO_SYMBOL["CHF"]).toBe("CHF")
  })
})

describe("SOURCE_REGION", () => {
  it("maps known sources to region/tier", () => {
    expect(SOURCE_REGION["Bring a Trailer"]).toEqual({ region: "US", tier: 1, currency: "USD" })
    expect(SOURCE_REGION["AutoScout24"]).toEqual({ region: "EU", tier: 2, currency: "EUR" })
    expect(SOURCE_REGION["AutoTrader"]).toEqual({ region: "UK", tier: 2, currency: "GBP" })
  })
})

describe("segregateByRegion", () => {
  it("groups listings by region-tier key", () => {
    const listings = [
      makeListing({ id: "1", source: "Bring a Trailer", status: "sold" }),
      makeListing({ id: "2", source: "Bring a Trailer", status: "sold" }),
      makeListing({ id: "3", source: "AutoScout24", status: "active", originalCurrency: "EUR", hammerPrice: 90000 }),
      makeListing({ id: "4", source: "AutoScout24", status: "delisted", originalCurrency: "EUR", hammerPrice: 85000 }),
    ]
    const result = segregateByRegion(listings)
    expect(result.has("US-1")).toBe(true)
    expect(result.get("US-1")!.listings).toHaveLength(2)
    expect(result.has("EU-2")).toBe(true)
    expect(result.get("EU-2")!.listings).toHaveLength(1) // only active
    expect(result.has("EU-3")).toBe(true)
    expect(result.get("EU-3")!.listings).toHaveLength(1) // delisted
  })

  it("skips listings with unknown source", () => {
    const listings = [makeListing({ source: "UnknownPlatform" })]
    const result = segregateByRegion(listings)
    expect(result.size).toBe(0)
  })
})

describe("computeRegionalStats", () => {
  it("returns null for fewer than 3 listings", () => {
    const listings = [makeListing({ id: "1" }), makeListing({ id: "2" })]
    expect(computeRegionalStats(listings, "US", 1, "USD")).toBeNull()
  })

  it("computes correct P25/P50/P75 for 5 listings", () => {
    const prices = [80000, 90000, 100000, 110000, 120000]
    const listings = prices.map((p, i) =>
      makeListing({ id: `${i}`, hammerPrice: p, originalCurrency: "USD" })
    )
    const stats = computeRegionalStats(listings, "US", 1, "USD")!
    expect(stats).not.toBeNull()
    expect(stats.totalListings).toBe(5)
    expect(stats.medianPrice).toBe(100000)
    expect(stats.minPrice).toBe(80000)
    expect(stats.maxPrice).toBe(120000)
    expect(stats.p25Price).toBe(90000)
    expect(stats.p75Price).toBe(110000)
    expect(stats.avgPrice).toBe(100000)
    expect(stats.region).toBe("US")
    expect(stats.tier).toBe(1)
    expect(stats.tierLabel).toBe("Verified Sales")
  })

  it("converts EUR listings to USD for medianPriceUsd", () => {
    const listings = [
      makeListing({ id: "1", hammerPrice: 90000, originalCurrency: "EUR" }),
      makeListing({ id: "2", hammerPrice: 100000, originalCurrency: "EUR" }),
      makeListing({ id: "3", hammerPrice: 110000, originalCurrency: "EUR" }),
    ]
    const stats = computeRegionalStats(listings, "EU", 2, "EUR")!
    expect(stats.medianPrice).toBe(100000) // native EUR
    expect(stats.medianPriceUsd).toBeGreaterThan(100000) // EUR → USD, rate > 1
  })

  it("computes trend direction from date splits", () => {
    const now = new Date()
    const recentDate = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
    const oldDate = new Date(now.getTime() - 300 * 86400000).toISOString().slice(0, 10)
    const listings = [
      makeListing({ id: "1", hammerPrice: 80000, saleDate: oldDate }),
      makeListing({ id: "2", hammerPrice: 85000, saleDate: oldDate }),
      makeListing({ id: "3", hammerPrice: 100000, saleDate: recentDate }),
      makeListing({ id: "4", hammerPrice: 105000, saleDate: recentDate }),
    ]
    const stats = computeRegionalStats(listings, "US", 1, "USD")!
    expect(stats.trendDirection).toBe("up")
    expect(stats.trendPercent).toBeGreaterThan(3)
  })
})

describe("computeMarketStats", () => {
  it("returns null when no region has 3+ listings", () => {
    const listings = [makeListing({ id: "1" }), makeListing({ id: "2" })]
    expect(computeMarketStats(listings, "series")).toBeNull()
  })

  it("selects Tier 1 as primary over Tier 2", () => {
    const batListings = Array.from({ length: 3 }, (_, i) =>
      makeListing({ id: `bat-${i}`, source: "Bring a Trailer", hammerPrice: 100000 + i * 10000 })
    )
    const asListings = Array.from({ length: 5 }, (_, i) =>
      makeListing({ id: `as-${i}`, source: "AutoScout24", status: "active", hammerPrice: 90000 + i * 10000, originalCurrency: "EUR" })
    )
    const stats = computeMarketStats([...batListings, ...asListings], "series")!
    expect(stats).not.toBeNull()
    expect(stats.primaryTier).toBe(1)
    expect(stats.primaryRegion).toBe("US")
    expect(stats.regions.length).toBe(2) // US-1 and EU-2
    expect(stats.totalDataPoints).toBe(8)
  })

  it("falls back to Tier 2 when no Tier 1 data", () => {
    const listings = Array.from({ length: 5 }, (_, i) =>
      makeListing({ id: `as-${i}`, source: "AutoScout24", status: "active", hammerPrice: 90000 + i * 10000, originalCurrency: "EUR" })
    )
    const stats = computeMarketStats(listings, "series")!
    expect(stats.primaryTier).toBe(2)
    expect(stats.primaryRegion).toBe("EU")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/marketStats.test.ts --reporter=verbose 2>&1 | tail -20`

Expected: FAIL — module `./marketStats` not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/marketStats.ts`:

```typescript
// ---------------------------------------------------------------------------
// Market Stats — Regional price analysis for investment reports
// ---------------------------------------------------------------------------
// Segregates listings by source → region/tier, then computes per-region
// statistics (P25, median, P75, trend). Never mixes tiers.
// ---------------------------------------------------------------------------

import { toUsd } from "./regionPricing"
import type {
  PricedListingRecord,
  RegionalMarketStats,
  ModelMarketStats,
  SourceRegionInfo,
} from "./reports/types"

// ── Currency ISO → symbol bridge ──

export const ISO_TO_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CHF: "CHF",
}

// ── Source → Region/Tier mapping ──

export const SOURCE_REGION: Record<string, SourceRegionInfo> = {
  "Bring a Trailer": { region: "US", tier: 1, currency: "USD" },
  "ClassicCom":      { region: "US", tier: 1, currency: "USD" },
  "AutoScout24":     { region: "EU", tier: 2, currency: "EUR" },
  "AutoTrader":      { region: "UK", tier: 2, currency: "GBP" },
  "BeForward":       { region: "JP", tier: 2, currency: "JPY" },
}

const TIER_LABELS: Record<number, string> = {
  1: "Verified Sales",
  2: "Active Listings",
  3: "Recently Delisted",
}

// ── Segregation ──

export function segregateByRegion(
  listings: PricedListingRecord[],
): Map<string, { tier: number; currency: string; region: string; listings: PricedListingRecord[] }> {
  const groups = new Map<string, { tier: number; currency: string; region: string; listings: PricedListingRecord[] }>()

  for (const listing of listings) {
    const info = SOURCE_REGION[listing.source]
    if (!info) continue

    // AutoScout24 delisted → Tier 3
    let tier = info.tier
    if (listing.source === "AutoScout24" && listing.status === "delisted") {
      tier = 3
    }

    const key = `${info.region}-${tier}`
    if (!groups.has(key)) {
      groups.set(key, { tier, currency: info.currency, region: info.region, listings: [] })
    }
    groups.get(key)!.listings.push(listing)
  }

  return groups
}

// ── Per-region stats ──

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

export function computeRegionalStats(
  listings: PricedListingRecord[],
  region: string,
  tier: 1 | 2 | 3,
  currency: string,
): RegionalMarketStats | null {
  if (listings.length < 3) return null

  // Prices in native currency
  const prices = listings.map(l => l.hammerPrice).sort((a, b) => a - b)

  const median = percentile(prices, 50)
  const p25 = percentile(prices, 25)
  const p75 = percentile(prices, 75)
  const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
  const min = prices[0]
  const max = prices[prices.length - 1]

  // USD conversion for cross-region comparison
  const symbol = ISO_TO_SYMBOL[currency] ?? "$"
  const medianUsd = Math.round(toUsd(median, symbol))

  // Trend: recent 6 months vs prior 6 months
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const cutoff = sixMonthsAgo.toISOString().slice(0, 10)

  const recent: number[] = []
  const older: number[] = []
  for (const l of listings) {
    if (!l.saleDate) {
      recent.push(l.hammerPrice)
      continue
    }
    if (l.saleDate >= cutoff) recent.push(l.hammerPrice)
    else older.push(l.hammerPrice)
  }

  let trendPercent = 0
  let trendDirection: "up" | "down" | "stable" = "stable"
  if (recent.length > 0 && older.length > 0) {
    const avgRecent = recent.reduce((s, p) => s + p, 0) / recent.length
    const avgOlder = older.reduce((s, p) => s + p, 0) / older.length
    if (avgOlder > 0) {
      trendPercent = Math.round(((avgRecent - avgOlder) / avgOlder) * 1000) / 10
      trendDirection = trendPercent > 3 ? "up" : trendPercent < -3 ? "down" : "stable"
    }
  }

  // Date range
  const dates = listings
    .map(l => l.saleDate)
    .filter((d): d is string => d != null)
    .sort()

  // Sources
  const sourceSet = new Set(listings.map(l => l.source))

  return {
    region,
    tier,
    tierLabel: TIER_LABELS[tier] ?? "Unknown",
    currency,
    totalListings: listings.length,
    medianPrice: Math.round(median),
    avgPrice: avg,
    p25Price: Math.round(p25),
    p75Price: Math.round(p75),
    minPrice: min,
    maxPrice: max,
    medianPriceUsd: medianUsd,
    trendPercent,
    trendDirection,
    oldestDate: dates[0] ?? "",
    newestDate: dates[dates.length - 1] ?? "",
    sources: Array.from(sourceSet),
  }
}

// ── Aggregated market stats ──

export function computeMarketStats(
  listings: PricedListingRecord[],
  scope: "model" | "series" | "family",
): ModelMarketStats | null {
  const groups = segregateByRegion(listings)

  const regions: RegionalMarketStats[] = []
  for (const [, group] of groups) {
    const stats = computeRegionalStats(
      group.listings,
      group.region,
      group.tier as 1 | 2 | 3,
      group.currency,
    )
    if (stats) regions.push(stats)
  }

  if (regions.length === 0) return null

  // Pick primary: lowest tier number (1 > 2 > 3), then most data
  regions.sort((a, b) => a.tier - b.tier || b.totalListings - a.totalListings)
  const primary = regions[0]

  // Convert primary P25/P75 to USD
  const symbol = ISO_TO_SYMBOL[primary.currency] ?? "$"
  const fairLow = Math.round(toUsd(primary.p25Price, symbol))
  const fairHigh = Math.round(toUsd(primary.p75Price, symbol))

  return {
    scope,
    regions,
    primaryFairValueLow: fairLow,
    primaryFairValueHigh: fairHigh,
    primaryTier: primary.tier,
    primaryRegion: primary.region,
    totalDataPoints: regions.reduce((sum, r) => sum + r.totalListings, 0),
  }
}

// ── Shared helper: series filtering + stats (used by page.tsx and route.ts) ──

import { extractSeries, getSeriesConfig } from "./brandConfig"
import type { PricedListingRow } from "./supabaseLiveListings"

/**
 * Filter priced listings by series, expand to family if needed,
 * map to PricedListingRecord, and compute regional market stats.
 */
export function computeMarketStatsForCar(
  car: { make: string; model: string; year: number },
  allPriced: PricedListingRow[],
): { marketStats: ModelMarketStats | null; pricedRecords: PricedListingRecord[] } {
  const series = extractSeries(car.model, car.year, car.make)

  let filtered = allPriced.filter(l => {
    const lSeries = extractSeries(l.model, l.year, l.make)
    return lSeries === series
  })

  let scope: "model" | "series" | "family" = "series"
  if (filtered.length < 3) {
    const config = getSeriesConfig(series, car.make)
    if (config) {
      filtered = allPriced.filter(l => {
        const lSeries = extractSeries(l.model, l.year, l.make)
        const lConfig = getSeriesConfig(lSeries, l.make)
        return lConfig?.family === config.family
      })
      scope = "family"
    }
  }

  const pricedRecords: PricedListingRecord[] = filtered.map(l => ({
    id: l.id,
    year: l.year,
    make: l.make,
    model: l.model,
    trim: l.trim ?? null,
    hammerPrice: Number(l.hammer_price),
    originalCurrency: l.original_currency ?? null,
    saleDate: l.sale_date ?? null,
    status: l.status,
    mileage: l.mileage ? Number(l.mileage) : null,
    source: l.source,
    country: l.country ?? null,
  }))

  const marketStats = computeMarketStats(pricedRecords, scope)
  return { marketStats, pricedRecords }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/marketStats.test.ts --reporter=verbose 2>&1 | tail -30`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketStats.ts src/lib/marketStats.test.ts
git commit -m "feat(marketStats): add regional market stats computation with tier segregation"
```

---

## Task 6: Fetch Priced Listings — `supabaseLiveListings.ts`

**Files:**
- Modify: `src/lib/supabaseLiveListings.ts` (add function near line 1039, after `fetchSoldListingsForMake`)

- [ ] **Step 1: Write the failing test**

Add to `src/lib/supabaseLiveListings.test.ts` (existing file):

```typescript
// At the end of the file:
describe("fetchPricedListingsForModel", () => {
  it("is exported as a function", async () => {
    const mod = await import("./supabaseLiveListings")
    expect(typeof mod.fetchPricedListingsForModel).toBe("function")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/supabaseLiveListings.test.ts --reporter=verbose 2>&1 | tail -20`

Expected: FAIL — `fetchPricedListingsForModel` is not exported.

- [ ] **Step 3: Implement `fetchPricedListingsForModel`**

Add after the `fetchSoldListingsForMake` function (around line 1039) in `src/lib/supabaseLiveListings.ts`:

```typescript
// ─── Priced listings for model (all statuses with hammer_price) ───

export interface PricedListingRow {
  id: string
  year: number
  make: string
  model: string
  trim: string | null
  hammer_price: number
  original_currency: string | null
  sale_date: string | null
  status: string
  mileage: number | null
  source: string
  country: string | null
}

export async function fetchPricedListingsForModel(
  make: string,
  limit = 500
): Promise<PricedListingRow[]> {
  const normalizedMake = normalizeSupportedMake(make);
  if (!normalizedMake) return [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return [];

  try {
    const supabase = createSupabaseClient(url, key);

    const { data, error } = await supabase
      .from("listings")
      .select("id,year,make,model,trim,hammer_price,original_currency,sale_date,status,mileage,source,country")
      .ilike("make", normalizedMake)
      .not("hammer_price", "is", null)
      .gt("hammer_price", 0)
      .order("sale_date", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.filter(
      (r: { hammer_price: string | number | null }) => r.hammer_price != null && Number(r.hammer_price) > 0
    ) as PricedListingRow[];
  } catch (err) {
    console.error("[supabaseLiveListings] fetchPricedListingsForModel failed:", err);
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/supabaseLiveListings.test.ts --reporter=verbose 2>&1 | tail -20`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabaseLiveListings.ts src/lib/supabaseLiveListings.test.ts
git commit -m "feat(listings): add fetchPricedListingsForModel for all priced listings"
```

---

## Task 7: Report Queries — `src/lib/reports/queries.ts`

**Files:**
- Create: `src/lib/reports/queries.ts`
- Create: `src/lib/reports/queries.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/queries.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock Supabase client
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}))

// Mock env vars
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key")

describe("reports/queries exports", () => {
  it("exports expected functions", async () => {
    const mod = await import("./queries")
    expect(typeof mod.getReportForListing).toBe("function")
    expect(typeof mod.saveReport).toBe("function")
    expect(typeof mod.getOrCreateUser).toBe("function")
    expect(typeof mod.hasAlreadyGenerated).toBe("function")
    expect(typeof mod.deductCredit).toBe("function")
    expect(typeof mod.checkAndResetFreeCredits).toBe("function")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reports/queries.test.ts --reporter=verbose 2>&1 | tail -20`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/reports/queries.ts`:

```typescript
// ---------------------------------------------------------------------------
// Supabase queries for listing_reports and credits tables
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js"
import type {
  ListingReport,
  UserCreditsRow,
  CreditTransactionRow,
  DeductResult,
  RegionalMarketStats,
  ModelMarketStats,
} from "./types"
import { toUsd } from "../regionPricing"
import { ISO_TO_SYMBOL } from "../marketStats"

const FREE_CREDITS_PER_MONTH = 3

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ── Reports ──

export async function getReportForListing(
  listingId: string,
): Promise<ListingReport | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("listing_reports")
    .select("*")
    .eq("listing_id", listingId)
    .single()

  if (error || !data) return null
  return data as ListingReport
}

export async function saveReport(
  listingId: string,
  marketStats: ModelMarketStats | null,
  llmData: Partial<ListingReport> | null,
): Promise<ListingReport> {
  const supabase = getServiceClient()

  const row: Record<string, unknown> = {
    listing_id: listingId,
    updated_at: new Date().toISOString(),
  }

  if (marketStats) {
    const primary = marketStats.regions.find(
      r => r.region === marketStats.primaryRegion && r.tier === marketStats.primaryTier,
    )
    const sym = primary ? (ISO_TO_SYMBOL[primary.currency] ?? "$") : "$"
    row.fair_value_low = marketStats.primaryFairValueLow
    row.fair_value_high = marketStats.primaryFairValueHigh
    row.median_price = primary ? Math.round(primary.medianPriceUsd) : null
    row.avg_price = primary ? Math.round(toUsd(primary.avgPrice, sym)) : null
    row.min_price = primary ? Math.round(toUsd(primary.minPrice, sym)) : null
    row.max_price = primary ? Math.round(toUsd(primary.maxPrice, sym)) : null
    row.total_comparable_sales = marketStats.totalDataPoints
    row.trend_percent = primary?.trendPercent ?? null
    row.trend_direction = primary?.trendDirection ?? null
    row.stats_scope = marketStats.scope
    row.primary_tier = marketStats.primaryTier
    row.primary_region = marketStats.primaryRegion
    row.regional_stats = marketStats.regions
  }

  if (llmData) {
    for (const [key, value] of Object.entries(llmData)) {
      if (key !== "id" && key !== "listing_id" && key !== "created_at") {
        row[key] = value
      }
    }
  }

  const { data, error } = await supabase
    .from("listing_reports")
    .upsert(row, { onConflict: "listing_id" })
    .select("*")
    .single()

  if (error) throw new Error(`Failed to save report: ${error.message}`)
  return data as ListingReport
}

// ── Credits ──

export async function getOrCreateUser(
  supabaseUserId: string,
  email: string,
  displayName?: string,
): Promise<UserCreditsRow> {
  const supabase = getServiceClient()

  // Try to find existing user
  const { data: existing } = await supabase
    .from("user_credits")
    .select("*")
    .eq("supabase_user_id", supabaseUserId)
    .single()

  if (existing) return existing as UserCreditsRow

  // Create new user with 3 free credits
  const { data: created, error } = await supabase
    .from("user_credits")
    .insert({
      supabase_user_id: supabaseUserId,
      email,
      display_name: displayName ?? null,
      credits_balance: FREE_CREDITS_PER_MONTH,
      tier: "FREE",
      credit_reset_date: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (error) {
    // Race condition: another request created the user
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("user_credits")
        .select("*")
        .eq("supabase_user_id", supabaseUserId)
        .single()
      if (retry) return retry as UserCreditsRow
    }
    throw new Error(`Failed to create user: ${error.message}`)
  }

  // Log welcome credits transaction
  await supabase.from("credit_transactions").insert({
    user_id: created.id,
    amount: FREE_CREDITS_PER_MONTH,
    type: "FREE_MONTHLY",
    description: "Welcome credits",
  })

  return created as UserCreditsRow
}

export async function checkAndResetFreeCredits(
  userId: string,
): Promise<UserCreditsRow> {
  const supabase = getServiceClient()

  const { data: user } = await supabase
    .from("user_credits")
    .select("*")
    .eq("id", userId)
    .single()

  if (!user) throw new Error("User not found")

  const now = new Date()
  const resetDate = new Date(user.credit_reset_date)
  const monthsSinceReset =
    (now.getFullYear() - resetDate.getFullYear()) * 12 +
    (now.getMonth() - resetDate.getMonth())

  if (monthsSinceReset < 1) return user as UserCreditsRow

  const { data: updated, error } = await supabase
    .from("user_credits")
    .update({
      credits_balance: user.credits_balance + FREE_CREDITS_PER_MONTH,
      credit_reset_date: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single()

  if (error) throw new Error(`Failed to reset credits: ${error.message}`)

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: FREE_CREDITS_PER_MONTH,
    type: "FREE_MONTHLY",
    description: `Monthly free credits - ${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
  })

  return (updated ?? user) as UserCreditsRow
}

export async function hasAlreadyGenerated(
  userId: string,
  listingId: string,
): Promise<boolean> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from("user_reports")
    .select("id")
    .eq("user_id", userId)
    .eq("listing_id", listingId)
    .single()

  return !!data
}

export async function deductCredit(
  userId: string,
  listingId: string,
  reportId: string,
): Promise<DeductResult> {
  const supabase = getServiceClient()

  // Check if already generated (free re-access)
  const already = await hasAlreadyGenerated(userId, listingId)
  if (already) return { success: true, creditUsed: 0, cached: true }

  // Check balance
  const { data: user } = await supabase
    .from("user_credits")
    .select("*")
    .eq("id", userId)
    .single()

  if (!user) return { success: false, error: "USER_NOT_FOUND" }
  if (user.credits_balance < 1) return { success: false, error: "INSUFFICIENT_CREDITS" }

  // Deduct credit
  const { error: updateError } = await supabase
    .from("user_credits")
    .update({
      credits_balance: user.credits_balance - 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (updateError) return { success: false, error: updateError.message }

  // Record the report access
  const { error: reportError } = await supabase
    .from("user_reports")
    .insert({
      user_id: userId,
      listing_id: listingId,
      report_id: reportId,
      credit_cost: 1,
    })

  if (reportError && reportError.code === "23505") {
    // Already recorded — restore credit
    await supabase
      .from("user_credits")
      .update({ credits_balance: user.credits_balance })
      .eq("id", userId)
    return { success: true, creditUsed: 0, cached: true }
  }

  // Log transaction
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: -1,
    type: "REPORT_USED",
    description: `Report for listing ${listingId}`,
    listing_id: listingId,
  })

  return { success: true, creditUsed: 1, cached: false }
}

export async function getUserCredits(
  supabaseUserId: string,
): Promise<UserCreditsRow | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from("user_credits")
    .select("*")
    .eq("supabase_user_id", supabaseUserId)
    .single()

  if (!data) return null

  return checkAndResetFreeCredits(data.id)
}

export async function addPurchasedCredits(
  userId: string,
  amount: number,
  stripePaymentId?: string,
): Promise<UserCreditsRow> {
  const supabase = getServiceClient()

  const { data: user } = await supabase
    .from("user_credits")
    .select("*")
    .eq("id", userId)
    .single()

  if (!user) throw new Error("User not found")

  const { data: updated, error } = await supabase
    .from("user_credits")
    .update({
      credits_balance: user.credits_balance + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single()

  if (error) throw new Error(`Failed to add credits: ${error.message}`)

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount,
    type: "PURCHASE",
    description: `Purchased ${amount} credits`,
    stripe_payment_id: stripePaymentId ?? null,
  })

  return (updated ?? user) as UserCreditsRow
}

export async function getTransactionHistory(
  userId: string,
  limit = 20,
): Promise<CreditTransactionRow[]> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as CreditTransactionRow[]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/reports/queries.test.ts --reporter=verbose 2>&1 | tail -20`

Expected: All tests PASS (export checks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/queries.ts src/lib/reports/queries.test.ts src/lib/reports/types.ts
git commit -m "feat(reports): add Supabase queries for listing_reports and credits tables"
```

---

## Task 8: Gemini API Client — `src/lib/ai/gemini.ts`

**Files:**
- Create: `src/lib/ai/gemini.ts`
- Create: `src/lib/ai/gemini.test.ts`

- [ ] **Step 1: Install the Gemini SDK**

Run: `npm install @google/generative-ai`

- [ ] **Step 2: Write the failing test**

Create `src/lib/ai/gemini.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the SDK
const mockGenerateContent = vi.fn()
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: mockGenerateContent,
    }),
  })),
}))

vi.stubEnv("GEMINI_API_KEY", "test-key")
vi.stubEnv("GEMINI_MODEL", "gemini-2.0-flash")

describe("gemini client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exports analyzeWithGemini function", async () => {
    const mod = await import("./gemini")
    expect(typeof mod.analyzeWithGemini).toBe("function")
  })

  it("returns text from Gemini response", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => '{"grade": "AA"}' },
    })

    const { analyzeWithGemini } = await import("./gemini")
    const result = await analyzeWithGemini("system prompt", "user prompt")
    expect(result).toBe('{"grade": "AA"}')
  })

  it("retries once on transient error", async () => {
    vi.useFakeTimers()
    mockGenerateContent
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockResolvedValueOnce({
        response: { text: () => '{"grade": "A"}' },
      })

    const { analyzeWithGemini } = await import("./gemini")
    const promise = analyzeWithGemini("system", "user")
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise
    expect(result).toBe('{"grade": "A"}')
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/gemini.test.ts --reporter=verbose 2>&1 | tail -20`

Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

Create `src/lib/ai/gemini.ts`:

```typescript
// ---------------------------------------------------------------------------
// Gemini API Client — for investment report analysis
// ---------------------------------------------------------------------------

import { GoogleGenerativeAI } from "@google/generative-ai"

const DEFAULT_MODEL = "gemini-2.0-flash"

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set")
  return new GoogleGenerativeAI(apiKey)
}

function getModelId(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL
}

/**
 * Send a prompt with system instruction to Gemini and return text response.
 * Retries once with exponential backoff on transient errors.
 */
export async function analyzeWithGemini(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const client = getClient()
  const model = client.getGenerativeModel({
    model: getModelId(),
    systemInstruction: systemPrompt,
  })

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await model.generateContent(userPrompt)
      return result.response.text()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt === 0) {
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }

  throw lastError ?? new Error("Gemini API call failed")
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/ai/gemini.test.ts --reporter=verbose 2>&1 | tail -20`

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/gemini.ts src/lib/ai/gemini.test.ts package.json package-lock.json
git commit -m "feat(ai): add Gemini API client for investment report analysis"
```

---

## Task 9: Refactor Prompts — `src/lib/ai/prompts.ts`

**Files:**
- Modify: `src/lib/ai/prompts.ts`

- [ ] **Step 1: Add the new report analysis prompt builder**

First, add the import at the **top** of `src/lib/ai/prompts.ts` (after existing imports, before any function/const):

```typescript
import type { RegionalMarketStats, PricedListingRecord } from "@/lib/reports/types"
```

Then append the following to the **end** of the file (keep existing functions intact):

```typescript
// ---------------------------------------------------------------------------
// Investment Report Analysis Prompt (Gemini)
// ---------------------------------------------------------------------------

export const REPORT_SYSTEM_PROMPT = `You are Monza Lab AI, an expert collector car investment analyst. You specialize in valuations based on real market data — actual sale prices, asking prices, and listing histories.

RULES:
- Base ALL analysis on the real market data provided below
- Clearly distinguish between verified sales and asking prices in your reasoning
- If insufficient data exists for any field, return null for that field
- Never fabricate sale records, price data, or market statistics
- Be specific to the exact vehicle being analyzed
- Reference known issues for the specific year/make/model
- Express uncertainty when data is limited

You always respond with valid JSON when asked to do so.`

export function buildReportAnalysisPrompt(
  vehicle: {
    title: string
    year: number
    make: string
    model: string
    trim?: string | null
    mileage?: number | null
    mileageUnit?: string
    transmission?: string | null
    engine?: string | null
    exteriorColor?: string | null
    interiorColor?: string | null
    location?: string | null
    price: number
    vin?: string | null
    description?: string | null
    sellerNotes?: string | null
    platform: string
    sourceUrl?: string
  },
  regionalStats: RegionalMarketStats[],
  sampleListings: PricedListingRecord[],
  brandThesis: string | null,
): string {
  // Vehicle section
  const vehicleSection = `VEHICLE BEING ANALYZED:
- Title: ${vehicle.title}
- Year: ${vehicle.year}
- Make: ${vehicle.make}
- Model: ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}
- Price: $${vehicle.price.toLocaleString()} (listing price)
- Mileage: ${vehicle.mileage != null ? `${vehicle.mileage.toLocaleString()} ${vehicle.mileageUnit || "mi"}` : "Not specified"}
- Transmission: ${vehicle.transmission || "Not specified"}
- Engine: ${vehicle.engine || "Not specified"}
- Exterior: ${vehicle.exteriorColor || "Not specified"}
- Interior: ${vehicle.interiorColor || "Not specified"}
- Location: ${vehicle.location || "Not specified"}
- VIN: ${vehicle.vin || "Not provided"}
- Platform: ${vehicle.platform}
${vehicle.sourceUrl ? `- URL: ${vehicle.sourceUrl}` : ""}

${vehicle.description ? `LISTING DESCRIPTION:\n${vehicle.description.slice(0, 3000)}\n` : ""}
${vehicle.sellerNotes ? `SELLER NOTES:\n${vehicle.sellerNotes.slice(0, 1000)}\n` : ""}`

  // Regional market data
  const marketSections = regionalStats.map(r => {
    const tierNote = r.tier === 1
      ? "VERIFIED SALES (actual transaction prices)"
      : r.tier === 2
        ? "ASKING PRICES (active listings, NOT confirmed sales)"
        : "RECENTLY DELISTED (last known asking prices)"

    return `${r.region} MARKET — ${tierNote} [${r.sources.join(", ")}]:
  Count: ${r.totalListings}
  Median: ${r.currency === "USD" ? "$" : r.currency === "EUR" ? "€" : r.currency === "GBP" ? "£" : "¥"}${r.medianPrice.toLocaleString()} (${r.currency})
  Range: P25=${r.p25Price.toLocaleString()} — P75=${r.p75Price.toLocaleString()} (${r.currency})
  Min-Max: ${r.minPrice.toLocaleString()} — ${r.maxPrice.toLocaleString()} (${r.currency})
  Trend: ${r.trendDirection} (${r.trendPercent > 0 ? "+" : ""}${r.trendPercent}%)
  Period: ${r.oldestDate} to ${r.newestDate}`
  }).join("\n\n")

  // Sample comparables (up to 20 per region)
  const sampleSection = sampleListings.length > 0
    ? `SAMPLE COMPARABLE LISTINGS:\n${sampleListings.slice(0, 60).map((l, i) =>
        `${i + 1}. ${l.year} ${l.make} ${l.model}${l.trim ? ` ${l.trim}` : ""} — ${l.originalCurrency ?? "USD"} ${l.hammerPrice.toLocaleString()} [${l.source}] ${l.status} ${l.saleDate ?? ""} ${l.mileage ? `(${l.mileage.toLocaleString()} mi)` : ""}`
      ).join("\n")}`
    : "NO COMPARABLE LISTINGS AVAILABLE."

  const thesisSection = brandThesis
    ? `BRAND/SERIES INVESTMENT THESIS:\n${brandThesis}\n`
    : ""

  return `${vehicleSection}

REGIONAL MARKET DATA:
${marketSections}

${sampleSection}

${thesisSection}
INSTRUCTIONS:
Analyze this vehicle and respond with ONLY a valid JSON object (no markdown fences). Use this exact structure:

{
  "investmentGrade": "<AAA|AA|A|BBB|BB|B or null if insufficient data>",
  "confidence": "<HIGH|MEDIUM|LOW>",
  "redFlags": ["<string — potential concern identified from listing or market data>"],
  "keyStrengths": ["<string — positive aspect of this vehicle>"],
  "criticalQuestions": ["<string — important question a buyer should ask>"],
  "ownershipCosts": {
    "yearlyMaintenance": <number in USD or null>,
    "insuranceEstimate": <number in USD or null>,
    "majorServiceCost": <number in USD or null>,
    "majorServiceDescription": "<string describing what the service is>"
  },
  "appreciationPotential": "<string — 2-3 sentences on investment outlook>",
  "bidTargetLow": <number in USD — conservative buy price or null>,
  "bidTargetHigh": <number in USD — aggressive buy price or null>,
  "comparableAnalysis": "<string — 2-3 paragraphs analyzing this vehicle vs comparable market data>"
}

Be specific to THIS exact vehicle. Weight verified sales (Tier 1) more heavily than asking prices (Tier 2). If data is limited, lower the confidence and explain why.`
}
```

- [ ] **Step 2: Verify types import works**

Run: `npx tsc --noEmit src/lib/ai/prompts.ts 2>&1 | head -20`

If this fails due to project-wide issues, just verify no new errors in the file by running the dev server briefly.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/prompts.ts
git commit -m "feat(prompts): add buildReportAnalysisPrompt with regional market data context"
```

---

## Task 10: Refactor Analyzer — `src/lib/ai/analyzer.ts`

**Files:**
- Modify: `src/lib/ai/analyzer.ts`

- [ ] **Step 1: Add the `analyzeForReport` function**

Add to the end of `src/lib/ai/analyzer.ts` (keep all existing code intact):

```typescript
import { analyzeWithGemini } from './gemini';
import {
  REPORT_SYSTEM_PROMPT,
  buildReportAnalysisPrompt,
} from './prompts';
import type { RegionalMarketStats, PricedListingRecord, ListingReport } from '@/lib/reports/types';

/** LLM fields from listing_reports that Gemini fills */
export interface ReportLLMFields {
  investment_grade: string | null
  confidence: string | null
  red_flags: string[]
  key_strengths: string[]
  critical_questions: string[]
  yearly_maintenance: number | null
  insurance_estimate: number | null
  major_service_cost: number | null
  appreciation_potential: string | null
  bid_target_low: number | null
  bid_target_high: number | null
  raw_llm_response: Record<string, unknown> | null
  llm_model: string
}

/**
 * Generate a Gemini-powered investment report analysis.
 * Returns the LLM fields ready to merge into listing_reports.
 */
export async function analyzeForReport(
  vehicle: Parameters<typeof buildReportAnalysisPrompt>[0],
  regionalStats: RegionalMarketStats[],
  sampleListings: PricedListingRecord[],
  brandThesis: string | null,
): Promise<ReportLLMFields> {
  const userPrompt = buildReportAnalysisPrompt(
    vehicle,
    regionalStats,
    sampleListings,
    brandThesis,
  )

  const rawText = await analyzeWithGemini(REPORT_SYSTEM_PROMPT, userPrompt)

  // Reuse existing robust JSON parser
  const parsed = extractJSON<Record<string, unknown>>(rawText)

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

  return {
    investment_grade: typeof parsed.investmentGrade === 'string' ? parsed.investmentGrade : null,
    confidence: typeof parsed.confidence === 'string' ? parsed.confidence : null,
    red_flags: Array.isArray(parsed.redFlags) ? parsed.redFlags.filter((s: unknown) => typeof s === 'string') : [],
    key_strengths: Array.isArray(parsed.keyStrengths) ? parsed.keyStrengths.filter((s: unknown) => typeof s === 'string') : [],
    critical_questions: Array.isArray(parsed.criticalQuestions) ? parsed.criticalQuestions.filter((s: unknown) => typeof s === 'string') : [],
    yearly_maintenance: typeof parsed.ownershipCosts === 'object' && parsed.ownershipCosts != null
      ? (parsed.ownershipCosts as Record<string, unknown>).yearlyMaintenance as number ?? null
      : null,
    insurance_estimate: typeof parsed.ownershipCosts === 'object' && parsed.ownershipCosts != null
      ? (parsed.ownershipCosts as Record<string, unknown>).insuranceEstimate as number ?? null
      : null,
    major_service_cost: typeof parsed.ownershipCosts === 'object' && parsed.ownershipCosts != null
      ? (parsed.ownershipCosts as Record<string, unknown>).majorServiceCost as number ?? null
      : null,
    appreciation_potential: typeof parsed.appreciationPotential === 'string' ? parsed.appreciationPotential : null,
    bid_target_low: typeof parsed.bidTargetLow === 'number' ? parsed.bidTargetLow : null,
    bid_target_high: typeof parsed.bidTargetHigh === 'number' ? parsed.bidTargetHigh : null,
    raw_llm_response: parsed,
    llm_model: model,
  }
}
```

**Important:** The `extractJSON` function is already defined in `analyzer.ts` but is not exported. You need to either export it or keep `analyzeForReport` in the same file (which it is).

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai/analyzer.ts
git commit -m "feat(analyzer): add analyzeForReport using Gemini for investment reports"
```

---

## Task 11: Refactor API Route — `src/app/api/analyze/route.ts`

**Files:**
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Add the listing-based report generation**

Replace the entire file content (the old auction-based code is superseded):

```typescript
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchPricedListingsForModel, fetchLiveListingById } from "@/lib/supabaseLiveListings"
import { extractSeries, getSeriesThesis } from "@/lib/brandConfig"
import { computeMarketStatsForCar } from "@/lib/marketStats"
import { analyzeForReport } from "@/lib/ai/analyzer"
import {
  getReportForListing,
  saveReport,
  getOrCreateUser,
  hasAlreadyGenerated,
  deductCredit,
  checkAndResetFreeCredits,
} from "@/lib/reports/queries"

interface AnalyzeRequestBody {
  listingId: string
}

export async function POST(request: Request) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { success: false, error: "AUTH_REQUIRED", message: "Please sign in to generate reports" },
        { status: 401 },
      )
    }

    const body: AnalyzeRequestBody = await request.json()
    if (!body.listingId) {
      return NextResponse.json({ success: false, error: "listingId is required" }, { status: 400 })
    }

    // 2. Get/create user + reset credits if needed
    const dbUser = await getOrCreateUser(authUser.id, authUser.email!, authUser.user_metadata?.full_name)
    const user = await checkAndResetFreeCredits(dbUser.id)

    // 3. Check if user already generated this report (free re-access)
    const alreadyGenerated = await hasAlreadyGenerated(user.id, body.listingId)

    // 4. Check existing report
    const existingReport = await getReportForListing(body.listingId)
    if (existingReport && existingReport.investment_grade) {
      return NextResponse.json({
        success: true,
        data: existingReport,
        cached: true,
        creditUsed: 0,
        creditsRemaining: user.credits_balance,
      })
    }

    // 5. Credits check (if not already generated and no cached report)
    if (!alreadyGenerated && user.credits_balance < 1) {
      return NextResponse.json(
        {
          success: false,
          error: "INSUFFICIENT_CREDITS",
          message: "You have no report credits remaining.",
          creditsRemaining: 0,
        },
        { status: 402 },
      )
    }

    // 6. Fetch the car
    const car = await fetchLiveListingById(body.listingId)
    if (!car) {
      return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 })
    }

    // 7. Fetch priced listings and compute market stats (shared helper)
    const allPriced = await fetchPricedListingsForModel(car.make)
    const { marketStats, pricedRecords } = computeMarketStatsForCar(car, allPriced)
    const series = extractSeries(car.model, car.year, car.make)

    // 8. Get brand thesis
    const brandThesis = getSeriesThesis(series, car.make)

    // 9. Call Gemini
    let llmData = null
    try {
      llmData = await analyzeForReport(
        {
          title: car.title,
          year: car.year,
          make: car.make,
          model: car.model,
          trim: car.trim,
          mileage: car.mileage,
          mileageUnit: car.mileageUnit,
          transmission: car.transmission,
          engine: car.engine,
          exteriorColor: car.exteriorColor,
          interiorColor: car.interiorColor,
          location: car.location,
          price: car.price,
          vin: car.vin,
          description: car.description,
          sellerNotes: car.sellerNotes,
          platform: car.platform,
          sourceUrl: car.sourceUrl,
        },
        marketStats?.regions ?? [],
        pricedRecords.slice(0, 60),
        brandThesis,
      )
    } catch (geminiError) {
      console.error("[analyze] Gemini failed:", geminiError)
      // Continue with market stats only
    }

    // 10. Save report
    const report = await saveReport(body.listingId, marketStats, llmData)

    // 11. Deduct credit
    let creditUsed = 0
    if (!alreadyGenerated) {
      const creditResult = await deductCredit(user.id, body.listingId, report.id)
      if (creditResult.success) {
        creditUsed = creditResult.creditUsed
      }
    }

    return NextResponse.json({
      success: true,
      data: report,
      cached: false,
      creditUsed,
      creditsRemaining: user.credits_balance - creditUsed,
      geminiUsed: !!llmData,
    })
  } catch (error) {
    console.error("Error analyzing listing:", error)

    if (error instanceof SyntaxError) {
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to generate report" },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "refactor(api): rewrite /api/analyze for Supabase listings + Gemini + regional stats"
```

---

## Task 12: Refactor useAnalysis Hook — `src/hooks/useAnalysis.ts`

**Files:**
- Modify: `src/hooks/useAnalysis.ts`

- [ ] **Step 1: Replace the hook with useReport**

Replace the entire file:

```typescript
"use client"
import { useState, useCallback } from "react"
import type { ListingReport } from "@/lib/reports/types"

interface UseReportResult {
  report: ListingReport | null
  loading: boolean
  error: string | null
  generating: boolean
  triggerGeneration: () => Promise<void>
  creditUsed: number
  creditsRemaining: number | null
}

export function useReport(listingId: string): UseReportResult {
  const [report, setReport] = useState<ListingReport | null>(null)
  const [loading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [creditUsed, setCreditUsed] = useState(0)
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null)

  const triggerGeneration = useCallback(async () => {
    if (!listingId) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      })
      const data = await res.json()
      if (data.success) {
        setReport(data.data)
        setCreditUsed(data.creditUsed ?? 0)
        setCreditsRemaining(data.creditsRemaining ?? null)
      } else {
        setError(data.error || "Report generation failed")
      }
    } catch {
      setError("Failed to generate report")
    } finally {
      setGenerating(false)
    }
  }, [listingId])

  return { report, loading, error, generating, triggerGeneration, creditUsed, creditsRemaining }
}

// Keep old export name for backward compatibility
export const useAnalysis = useReport
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAnalysis.ts
git commit -m "refactor(hooks): replace useAnalysis with useReport for listing-based reports"
```

---

## Task 13: Update Report Server Page — `page.tsx`

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/page.tsx`

- [ ] **Step 1: Rewrite the server page**

Replace the entire file:

```typescript
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { setRequestLocale } from "next-intl/server"
import { CURATED_CARS } from "@/lib/curatedCars"
import {
  fetchLiveListingById,
  fetchLiveListingByIdWithStatus,
  fetchLiveListingsAsCollectorCars,
  fetchPricedListingsForModel,
} from "@/lib/supabaseLiveListings"
import { computeMarketStatsForCar } from "@/lib/marketStats"
import { getReportForListing } from "@/lib/reports/queries"
import { ReportClient } from "./ReportClient"
import { findSimilarCars } from "@/lib/similarCars"

interface ReportPageProps {
  params: Promise<{ locale: string; make: string; id: string }>
}

export async function generateMetadata({ params }: ReportPageProps) {
  const { id } = await params

  let car = CURATED_CARS.find(c => c.id === id) ?? null
  if (!car && id.startsWith("live-")) {
    car = await fetchLiveListingById(id)
  }

  if (!car) return { title: "Not Found | Monza Lab" }

  return {
    title: `Investment Dossier: ${car.title} | Monza Lab`,
    description: `Comprehensive investment analysis for ${car.title}. Valuation, risk assessment, ownership economics, and market context.`,
  }
}

export async function generateStaticParams() {
  return CURATED_CARS.map(car => ({
    make: car.make.toLowerCase().replace(/\s+/g, "-"),
    id: car.id,
  }))
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const isLiveId = id.startsWith("live-")

  let car = CURATED_CARS.find(c => c.id === id) ?? null
  let liveLookupTransientError = false

  if (!car && isLiveId) {
    const liveLookup = await fetchLiveListingByIdWithStatus(id)
    car = liveLookup.car
    liveLookupTransientError = liveLookup.transientError
  }

  if (!car) {
    if (isLiveId && liveLookupTransientError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6 text-center">
          <div className="max-w-xl space-y-4">
            <h1 className="text-2xl font-semibold text-foreground">Live report temporarily unavailable</h1>
            <p className="text-muted-foreground">
              We could not reach the live listing data source right now. Please retry in a moment.
            </p>
          </div>
        </div>
      )
    }
    notFound()
  }

  // Fetch similar cars
  const allCandidates = CURATED_CARS.filter(c => c.id !== car.id)
  if (car.id.startsWith("live-")) {
    const live = await fetchLiveListingsAsCollectorCars({ limit: 60, includePriceHistory: false })
    allCandidates.push(...live.filter(c => c.id !== car.id))
  }
  const similarCars = findSimilarCars(car, allCandidates, 6)

  // Fetch priced listings + compute market stats + check for existing report
  const [allPriced, existingReport] = await Promise.all([
    fetchPricedListingsForModel(car.make),
    getReportForListing(car.id),
  ])

  // Filter by series, expand to family if needed, compute regional stats (shared helper)
  const { marketStats } = computeMarketStatsForCar(car, allPriced)

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-border" />
              <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">Loading report...</p>
          </div>
        </div>
      }
    >
      <ReportClient
        car={car}
        similarCars={similarCars}
        existingReport={existingReport}
        marketStats={marketStats}
      />
    </Suspense>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/[locale]/cars/[make]/[id]/report/page.tsx"
git commit -m "refactor(report): update server page to fetch priced listings + compute regional stats"
```

---

## Task 14: Update ReportClient — Remove Fabricated Data + Add Regional Display

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`

This is the largest task. The component is ~2,551 lines. The changes are:
1. Update props interface to accept `existingReport` + `marketStats`
2. Remove old DB props (`dbMarketData`, `dbComparables`, etc.)
3. Add "Generate Report" button wired to `useReport` hook
4. Replace circular fair value with real P25-P75 from best tier
5. Show regional market cards in the Market Context section
6. Hide sections that need LLM data when no report exists
7. Remove hardcoded inspection checklist
8. Remove hardcoded criticality badges
9. Replace deterministic verdict with real data

- [ ] **Step 1: Update the props interface and imports**

At the top of `ReportClient.tsx`, replace the old DB type imports and component signature:

Old (around line 40-42):
```typescript
import type { DbMarketDataRow, DbComparableRow, DbAnalysisRow, DbSoldRecord } from "@/lib/db/queries"
```

New:
```typescript
import type { ListingReport, ModelMarketStats, RegionalMarketStats } from "@/lib/reports/types"
import { useReport } from "@/hooks/useAnalysis"
```

Old (around line 121):
```typescript
export function ReportClient({ car, similarCars, dbMarketData, dbMarketDataBrand = [], dbComparables = [], dbAnalysis, dbSoldHistory = [], dbAnalyses = [] }: {
  car: CollectorCar
  similarCars: SimilarCarResult[]
  dbMarketData?: DbMarketDataRow | null
  dbMarketDataBrand?: DbMarketDataRow[]
  dbComparables?: DbComparableRow[]
  dbAnalysis?: DbAnalysisRow | null
  dbSoldHistory?: DbSoldRecord[]
  dbAnalyses?: DbAnalysisRow[]
}) {
```

New:
```typescript
export function ReportClient({ car, similarCars, existingReport, marketStats }: {
  car: CollectorCar
  similarCars: SimilarCarResult[]
  existingReport: ListingReport | null
  marketStats: ModelMarketStats | null
}) {
```

- [ ] **Step 2: Add the useReport hook and state derivation**

Right after the component signature, add:

```typescript
  const { report: generatedReport, generating, error: reportError, triggerGeneration, creditsRemaining } = useReport(car.id)

  // Use existing report or the one just generated
  const report = generatedReport ?? existingReport
  const hasLLM = !!(report?.investment_grade)
  const hasStats = !!(marketStats && marketStats.totalDataPoints > 0) || !!(report?.regional_stats?.length)
  const regions: RegionalMarketStats[] = report?.regional_stats ?? marketStats?.regions ?? []
```

- [ ] **Step 3: Replace fair value derivation**

Find the lines that compute `fairLow`, `fairHigh` (around lines 239-241):

Old:
```typescript
  const regionRange = getFairValueForRegion(car.fairValueByRegion, selectedRegion)
  const fairLow = dbMarketData?.lowPrice ?? regionRange.low
  const fairHigh = dbMarketData?.highPrice ?? regionRange.high
```

New:
```typescript
  const fairLow = report?.fair_value_low ?? marketStats?.primaryFairValueLow ?? 0
  const fairHigh = report?.fair_value_high ?? marketStats?.primaryFairValueHigh ?? 0
```

- [ ] **Step 4: Replace risk score derivation**

Find risk score computation (around lines 256-259):

Old:
```typescript
  const riskScore = dbAnalysis?.confidence === "HIGH" ? 25 :
    dbAnalysis?.confidence === "MEDIUM" ? 45 :
    dbAnalysis?.confidence === "LOW" ? 70 :
    car.investmentGrade === "AAA" ? 25 : ...
```

New:
```typescript
  const riskScore = report?.confidence === "HIGH" ? 25 :
    report?.confidence === "MEDIUM" ? 45 :
    report?.confidence === "LOW" ? 70 :
    car.investmentGrade === "AAA" ? 25 : car.investmentGrade === "AA" ? 35 : car.investmentGrade === "A" ? 50 : 65
```

- [ ] **Step 5: Replace red flags, questions, and ownership data**

Find the derivations (around lines 204-218):

Old:
```typescript
  const flags = dbAnalysis?.redFlags?.length ? dbAnalysis.redFlags : []
  const questions = dbAnalysis?.criticalQuestions?.length ? dbAnalysis.criticalQuestions : []
  ...
  const hasDbOwnershipData = !!(dbAnalysis?.insuranceEstimate || dbAnalysis?.yearlyMaintenance)
```

New:
```typescript
  const flags = report?.red_flags?.length ? report.red_flags : []
  const questions = report?.critical_questions?.length ? report.critical_questions : []
  const strengths = report?.key_strengths?.length ? report.key_strengths : []
  const hasOwnershipData = !!(report?.insurance_estimate || report?.yearly_maintenance)
  const ownershipCosts = hasOwnershipData ? {
    insurance: report!.insurance_estimate ?? 0,
    maintenance: report!.yearly_maintenance ?? 0,
    majorService: report!.major_service_cost ?? 0,
  } : null
```

- [ ] **Step 6: Replace comparable sales (comps)**

Find the comparable sales derivation (around lines 218-230):

Old:
```typescript
  const comps = dbComparables.length > 0
    ? dbComparables.map(c => ({ ... }))
    : similarCars.slice(0, 5).map(sc => ({ ... }))  // FALLBACK: live as "sold"
```

New:
```typescript
  // Only show real priced listings — never use similar cars as "comparable sales"
  const comps: Array<{ title: string; price: string; date: string; source: string }> = []
  // Comps will come from regional_stats in the report display — no fake comparables
```

- [ ] **Step 7: Replace investment grade display**

Throughout the component, replace references to `car.investmentGrade` for the primary grade display with:
```typescript
const investmentGrade = report?.investment_grade ?? car.investmentGrade
```

- [ ] **Step 8: Replace verdict logic**

Find verdict computation (around line 262):

Old:
```typescript
  const verdict = isBelowFair && car.investmentGrade <= "AA" ? "buy" : ...
```

New:
```typescript
  const isBelowFair = car.price > 0 && fairLow > 0 && car.price < fairLow
  const isAboveFair = car.price > 0 && fairHigh > 0 && car.price > fairHigh
  const verdict = !hasLLM ? null :
    isBelowFair && (report?.investment_grade === "AAA" || report?.investment_grade === "AA") ? "buy" :
    isAboveFair ? "watch" : "hold"
```

- [ ] **Step 9: Add "Generate Report" button**

In the summary section (section 1), add a generate button when no report exists:

```tsx
{!report && !generating && (
  <button
    onClick={triggerGeneration}
    className="mt-4 w-full py-3 px-6 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
  >
    Generate Investment Report
  </button>
)}
{generating && (
  <div className="mt-4 flex items-center justify-center gap-3 py-3">
    <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    <span className="text-sm text-muted-foreground">Generating report...</span>
  </div>
)}
{reportError && (
  <p className="mt-2 text-sm text-red-400">{reportError}</p>
)}
```

- [ ] **Step 10: Add regional market cards in Market Context section**

Note: `regionLabels` is already defined at line 59 of `ReportClient.tsx`. `fmtRegional` is imported as `formatRegionalPrice as fmtRegional` from `regionPricing.ts` (restored in Task 4).

In the market context section, replace the old single market data display with regional cards:

```tsx
{regions.length > 0 && (
  <div className="space-y-4">
    {regions.map(r => (
      <div key={`${r.region}-${r.tier}`} className="p-4 rounded-lg bg-card/50 border border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{regionLabels[r.region]?.flag ?? "🌍"}</span>
          <span className="font-semibold text-foreground">
            {r.region} Market — {r.tierLabel}
          </span>
          <span className="text-xs text-muted-foreground">({r.sources.join(", ")})</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Median</span>
            <p className="font-mono font-semibold">{fmtRegional(r.medianPrice, r.currency === "USD" ? "$" : r.currency === "EUR" ? "€" : r.currency === "GBP" ? "£" : "¥")}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Range (P25–P75)</span>
            <p className="font-mono">{fmtRegional(r.p25Price, r.currency === "USD" ? "$" : r.currency === "EUR" ? "€" : r.currency === "GBP" ? "£" : "¥")} – {fmtRegional(r.p75Price, r.currency === "USD" ? "$" : r.currency === "EUR" ? "€" : r.currency === "GBP" ? "£" : "¥")}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Trend</span>
            <p className={r.trendDirection === "up" ? "text-emerald-400" : r.trendDirection === "down" ? "text-red-400" : "text-muted-foreground"}>
              {r.trendDirection === "up" ? "↑" : r.trendDirection === "down" ? "↓" : "→"} {r.trendPercent > 0 ? "+" : ""}{r.trendPercent}%
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Based on</span>
            <p>{r.totalListings} {r.tier === 1 ? "verified sales" : "listings"}</p>
          </div>
        </div>
        {r.oldestDate && r.newestDate && (
          <p className="text-xs text-muted-foreground mt-2">
            Period: {r.oldestDate} to {r.newestDate}
          </p>
        )}
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 11: Hide sections without data**

Wrap the following sections in conditional rendering:

- **Risk Assessment** section: `{hasLLM && flags.length > 0 && ( ... )}`
- **Due Diligence** section: `{hasLLM && questions.length > 0 && ( ... )}`
- **Ownership Economics** section: `{hasLLM && ownershipCosts && ( ... )}`
- **Verdict** section: `{hasLLM && verdict && ( ... )}`
- **Valuation** section: `{hasStats && ( ... )}`
- **Market Context** section: `{hasStats && ( ... )}`

Remove the hardcoded inspection checklist items from Due Diligence.
Remove the hardcoded criticality badges (first 2 = "Critical").

- [ ] **Step 12: Verify the dev server compiles without errors**

Run: `npm run dev` and navigate to any car's report page.

Expected: Page loads without compilation errors. Sections without data are hidden. "Generate Report" button appears.

- [ ] **Step 13: Commit**

```bash
git add "src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx"
git commit -m "refactor(report): remove fabricated data, add regional market cards, wire Generate button"
```

---

## Task 15: Integration Test — End-to-End Verification

**Files:**
- No new files

- [ ] **Step 1: Run all existing tests**

Run: `npm test 2>&1 | tail -30`

Expected: All tests pass. No regressions.

- [ ] **Step 2: Run the dev server and test manually**

Run: `npm run dev`

1. Navigate to a Porsche listing report page (e.g., `/en/cars/porsche/live-xxx/report`)
2. Verify:
   - Page loads with car details (summary + identity sections visible)
   - Regional market cards show if priced data exists
   - "Generate Report" button appears
   - Sections without LLM data are hidden (no fabricated inspection checklist, no fake criticality badges)
3. If Gemini API key is set, click "Generate Report":
   - Loading spinner appears
   - After ~5-10s, all sections populate
   - Regional market data shows with honest tier labels
   - Investment grade, red flags, strengths populate from Gemini

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix(report): integration test fixes"
```

---

## Summary of Commits (Expected Order)

1. `feat(db): create listing_reports table for investment reports`
2. `feat(db): create credits tables in Supabase`
3. `feat(types): add shared types for investment reports and credits`
4. `feat(pricing): add CHF (Swiss Franc) to currency rate maps`
5. `feat(marketStats): add regional market stats computation with tier segregation`
6. `feat(listings): add fetchPricedListingsForModel for all priced listings`
7. `feat(reports): add Supabase queries for listing_reports and credits tables`
8. `feat(ai): add Gemini API client for investment report analysis`
9. `feat(prompts): add buildReportAnalysisPrompt with regional market data context`
10. `feat(analyzer): add analyzeForReport using Gemini for investment reports`
11. `refactor(api): rewrite /api/analyze for Supabase listings + Gemini + regional stats`
12. `refactor(hooks): replace useAnalysis with useReport for listing-based reports`
13. `refactor(report): update server page to fetch priced listings + compute regional stats`
14. `refactor(report): remove fabricated data, add regional market cards, wire Generate button`
15. `fix(report): integration test fixes` (if needed)
