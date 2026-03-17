# Investment Report: Real Data + Gemini LLM Analysis

**Date:** 2026-03-17
**Status:** Approved
**Approach:** Surgical Cleanup (modify ReportClient in-place)

## Problem

The current investment report (`/cars/[make]/[id]/report`) displays fabricated and misleading data:

- **Fair Value** is circular: applies 0.8x-1.2x to the car's own price
- **Comparables** silently substitutes live listings as "comparable sales" when DB is empty
- **Inspection checklist** is 6 hardcoded items identical for every car
- **Red flag criticality** is arbitrary (first 2 = "Critical", rest = "Monitor")
- **Investment Grade** uses a simplistic score (brand + age + price tier)
- **Verdict** (BUY/HOLD/WATCH) is deterministic from the circular fair value
- For `live-*` listings, `shouldQueryHistoricalData = false` so most DB data is skipped entirely
- The `Analysis` table is tied to the `Auction` model (legacy PG), not the `listings` table (Supabase)
- The credits system (`User`, `UserAnalysis`, `CreditTransaction`) also lives in legacy PG

## Solution

**Single-click report generation** that combines:
1. Real market statistics computed from `listings` table sold history (`hammer_price`)
2. Gemini LLM analysis using all available real data as context

Everything moves to Supabase: new `listing_reports` table for analysis storage, new credits tables replacing the legacy PG system.

The user clicks "Generate Investment Report" once and gets a complete report. If the report already exists in `listing_reports`, it loads instantly.

## Data Model

### Primary data source: Supabase `listings` table

```
listings {
  id                  uuid PK
  year, make, model, trim
  hammer_price        -- actual sale price (real data)
  original_currency   -- currency of hammer_price (USD, EUR, GBP, JPY, etc.)
  sale_date           -- when it sold
  status              -- sold / active / etc.
  source              -- BaT, AutoScout24, ClassicCom, etc.
  source_url
  country, region, city, location
  mileage, mileage_unit
  engine, transmission, body_style
  color_exterior, color_interior
  vin
  description_text    -- full listing description
  images, photos_media
  current_bid, bid_count, reserve_status
  end_time, start_time, final_price
  seller_notes
  platform, title
}
```

### Currency normalization

`hammer_price` values come from multiple sources in different currencies. Before computing market stats, all prices must be converted to USD using the `original_currency` field. The `original_currency` stores ISO codes (`"USD"`, `"EUR"`, `"GBP"`, `"JPY"`) but `toUsd()` in `regionPricing.ts` uses currency symbols (`"$"`, `"€"`, `"£"`, `"¥"`). A mapping function `isoCurrencyToSymbol()` bridges this gap in `marketStats.ts`.

### Key queries needed

| Query | Purpose | Filter |
|-------|---------|--------|
| `fetchSoldListingsForModel(make, model)` | **NEW** - Comparables for same model | `status = "sold"`, `hammer_price > 0`, same make + model |
| `fetchSoldListingsForMake(make)` | Market context for the brand | Already exists — `status = "sold"`, `hammer_price > 0` |
| `fetchLiveListingById(id)` | The car being analyzed | Already exists |
| `findSimilarCars(car, candidates)` | Similar active listings | Already exists |

### Model matching strategy for `fetchSoldListingsForModel()`

Rather than raw `model ILIKE %model%` (which matches too broadly, e.g., "911" matching all 911 variants), use `extractSeries()` from brandConfig to normalize the model to its series ID first:

1. Extract series via `extractSeries(model, year, make)`
2. Query sold listings where `extractSeries(listing.model, listing.year, listing.make)` matches the same series
3. If < 3 results, expand to same family group via `getSeriesConfig(series).familyGroup`
4. Always label the scope used in the stats: `"model"`, `"series"`, or `"family"`

In practice, the series extraction happens in the app layer after fetching sold listings for the make, since `extractSeries()` is a JS function, not a SQL function. So the flow is: fetch all sold listings for the make → filter in JS by matching series → compute stats.

### Computed market stats (from sold history)

From `fetchSoldListingsForModel()` results, compute:

```typescript
interface ModelMarketStats {
  totalSales: number
  medianPrice: number
  avgPrice: number
  p25Price: number       // 25th percentile
  p75Price: number       // 75th percentile
  minPrice: number
  maxPrice: number
  // Trend: compare avg of recent 6 months vs prior 6 months
  trendPercent: number   // e.g., +5.2 or -3.1
  trendDirection: "up" | "down" | "stable"
  oldestSaleDate: string
  newestSaleDate: string
  scope: "model" | "series" | "family"
}
```

**Trend thresholds**: `stable` = trendPercent between -3% and +3%. `up` = > +3%. `down` = < -3%.

**Fair Value range** = P25 to P75 of `hammer_price` (converted to USD) from sold listings of the same series. This replaces the circular 0.8x-1.2x calculation.

### NEW: `listing_reports` table (Supabase)

Replaces the legacy `Analysis` table in PostgreSQL. Clean schema aligned with `listings`.

```sql
CREATE TABLE listing_reports (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id             uuid NOT NULL REFERENCES listings(id),

  -- Market stats (computed from sold history, cached here)
  fair_value_low         numeric,          -- P25 of real sales (USD)
  fair_value_high        numeric,          -- P75 of real sales (USD)
  median_price           numeric,          -- median hammer_price (USD)
  avg_price              numeric,          -- average hammer_price (USD)
  min_price              numeric,          -- lowest sale price (USD)
  max_price              numeric,          -- highest sale price (USD)
  total_comparable_sales integer,          -- how many sales were used
  trend_percent          numeric,          -- e.g., +5.2 or -3.1
  trend_direction        text,             -- 'up' / 'down' / 'stable'
  stats_scope            text,             -- 'model' / 'series' / 'family'

  -- LLM analysis (Gemini)
  investment_grade       text,             -- AAA / AA / A / BBB / BB / B
  confidence             text,             -- HIGH / MEDIUM / LOW
  red_flags              text[],
  key_strengths          text[],
  critical_questions     text[],
  yearly_maintenance     numeric,
  insurance_estimate     numeric,
  major_service_cost     numeric,
  appreciation_potential text,
  bid_target_low         numeric,          -- LLM recommended buy price low
  bid_target_high        numeric,          -- LLM recommended buy price high
  raw_llm_response       jsonb,

  -- Meta
  llm_model              text,             -- e.g., 'gemini-2.0-flash'
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_listing_reports_listing UNIQUE (listing_id)
);

CREATE INDEX idx_listing_reports_listing_id ON listing_reports(listing_id);

-- RLS: any authenticated user can read reports; only service role can insert/update
ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reports" ON listing_reports FOR SELECT USING (true);
CREATE POLICY "Service role inserts reports" ON listing_reports FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role updates reports" ON listing_reports FOR UPDATE USING (auth.role() = 'service_role');
```

**Why a new table instead of reusing `Analysis`:**
- `Analysis.auctionId` references the `Auction` table — wrong data model
- Column names like `bidTargetLow` use auction/bid language
- `Analysis` lives in legacy PG, not Supabase
- `getAnalysesForMake()` is hardcoded to `return []` ("Analysis table does not exist in Supabase")
- `investmentGrade` in old table uses `EXCELLENT/GOOD/FAIR/SPECULATIVE` — we use `AAA-B`
- New table co-locates market stats + LLM analysis in one row
- FK to `listings(id)` provides referential integrity

### NEW: Credits tables (Supabase)

Replace legacy PG `User`, `UserAnalysis`, `CreditTransaction` tables.

```sql
CREATE TABLE user_credits (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id    uuid NOT NULL UNIQUE,  -- references auth.users(id)
  email               text,
  display_name        text,
  credits_balance     integer NOT NULL DEFAULT 3,
  tier                text NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE', 'PRO')),
  credit_reset_date   timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- RLS: users can only read/update their own row
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own credits" ON user_credits FOR SELECT USING (auth.uid() = supabase_user_id);
CREATE POLICY "Service role manages credits" ON user_credits FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE user_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES user_credits(id),
  listing_id          uuid NOT NULL REFERENCES listings(id),
  report_id           uuid NOT NULL REFERENCES listing_reports(id),
  credit_cost         integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_user_reports_user_listing UNIQUE (user_id, listing_id)
);

-- RLS: users can only see their own reports
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own reports" ON user_reports FOR SELECT USING (
  user_id IN (SELECT id FROM user_credits WHERE supabase_user_id = auth.uid())
);
CREATE POLICY "Service role manages reports" ON user_reports FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE credit_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES user_credits(id),
  amount              integer NOT NULL,          -- positive = add, negative = deduct
  type                text NOT NULL CHECK (type IN ('FREE_MONTHLY', 'REPORT_USED', 'PURCHASE')),
  description         text,
  listing_id          uuid REFERENCES listings(id),
  stripe_payment_id   text,                      -- only for PURCHASE type
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- RLS: users can only see their own transactions
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own transactions" ON credit_transactions FOR SELECT USING (
  user_id IN (SELECT id FROM user_credits WHERE supabase_user_id = auth.uid())
);
CREATE POLICY "Service role manages transactions" ON credit_transactions FOR ALL USING (auth.role() = 'service_role');
```

**Same logic as legacy credits, clean naming:**
- `user_credits` replaces `User` — tracks balance + monthly resets
- `user_reports` replaces `UserAnalysis` — tracks which user generated which report
- `credit_transactions` replaces `CreditTransaction` — audit log
- 3 free credits/month for FREE tier, monthly reset
- Re-accessing a previously generated report is free (check `user_reports`)

## Existing infrastructure (action plan)

### Files to refactor or replace

| File | Purpose | Action |
|------|---------|--------|
| `src/app/api/analyze/route.ts` | API endpoint | **Refactor** — use Supabase `listings` + `listing_reports` + new credits tables |
| `src/lib/ai/analyzer.ts` | LLM orchestration + JSON parsing + caching | **Refactor** — swap Claude for Gemini import, update prompt building |
| `src/lib/ai/claude.ts` | Claude API client | **Replace** with `src/lib/ai/gemini.ts` |
| `src/lib/ai/prompts.ts` | Prompt templates + response schema | **Refactor** — add sold history context, update response schema |
| `src/lib/credits/index.ts` | Legacy PG credits | **Replace** with `src/lib/credits/supabaseCredits.ts` |
| `src/hooks/useAnalysis.ts` | Client-side hook | **Refactor** — update types, keep same API shape |

### Legacy files (deprecate, don't delete yet)

| File | Reason to keep |
|------|---------------|
| `src/lib/ai/claude.ts` | Other features may use it; mark as deprecated |
| `src/lib/credits/index.ts` | Rename to `index.legacy.ts`, keep for reference |
| `src/lib/db/queries.ts` | `getAnalysisForCar()`, `saveAnalysis()` etc. still used by other code paths; don't break them |

## Architecture

### UX Flow

```
Car detail page → "Investment Report" button
  │
  ├─ Report EXISTS in listing_reports?
  │   └─ YES → Load report page instantly (all sections populated)
  │
  └─ NO → Show generation loading state (~5-10s)
       ├─ Step 1: Fetch sold history for model + make from Supabase listings
       ├─ Step 2: Compute market stats (median, P25-P75, trend)
       ├─ Step 3: Call Gemini with full context (sold history + car data + stats)
       ├─ Step 4: Save to listing_reports table (market stats + LLM analysis)
       ├─ Step 5: Record in user_reports + deduct credit
       └─ Step 6: Show complete report (all sections)

  On Gemini failure (after 1 retry):
       └─ Show partial report with data-only sections (Valuation, Market Context, Similar Cars)
          + error message: "AI analysis unavailable. Showing market data only. [Retry]"
          Market stats are still saved to listing_reports (LLM fields as null)
```

Second visit → report loaded from `listing_reports`, no Gemini call.

### API Route: Refactor existing `POST /api/analyze`

```typescript
// 1. Auth via Supabase (existing pattern)
// 2. Get/create user in user_credits table
// 3. Check user_reports — has user already generated report for this listing? (free re-access)
// 4. Check listing_reports — report already exists? Return cached
// 5. Credits check — does user have credits?
// 6. Fetch car from Supabase listings table
// 7. Fetch sold listings for make → filter by series in JS
// 8. Compute market stats via computeMarketStats()
// 9. Get brand thesis from brandConfig
// 10. Build Gemini prompt with ALL real context
// 11. Call Gemini API via gemini.ts
// 12. Parse + validate structured JSON response (reuse analyzer.ts logic)
// 13. INSERT into listing_reports (market stats + LLM fields)
// 14. INSERT into user_reports + deduct credit + log transaction
// 15. Return report data + credits remaining to frontend
```

### Replace Claude with Gemini: `src/lib/ai/gemini.ts`

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai"

// analyzeWithSystem(systemPrompt, userPrompt): Promise<string>
// - Uses GEMINI_API_KEY env var
// - Model: GEMINI_MODEL env var (default: "gemini-2.0-flash")
// - Returns text response
// - 1 retry with exponential backoff on transient errors
```

The `analyzer.ts` orchestrator stays largely the same — it already handles JSON parsing, caching, and retry logic. Only the LLM client import changes from `claude.ts` to `gemini.ts`.

### New credits module: `src/lib/credits/supabaseCredits.ts`

```typescript
// Same function signatures as legacy credits/index.ts, backed by Supabase tables:
//
// getOrCreateUser(supabaseUserId, email, name?) → UserCreditsRow
// checkAndResetFreeCredits(userId) → UserCreditsRow
// hasAlreadyGenerated(userId, listingId) → boolean  (was: hasAlreadyAnalyzed)
// deductCredit(userId, listingId, reportId) → { success, creditUsed, cached }
// getUserCredits(supabaseUserId) → UserCreditsRow | null
// addPurchasedCredits(userId, amount) → UserCreditsRow
// getTransactionHistory(userId, limit?) → CreditTransactionRow[]
```

### Gemini prompt structure

The prompt receives (via refactored `prompts.ts`):

1. **Car listing data** — full specs + description_text (not truncated)
2. **Sold history (same series)** — up to 50 recent sales with hammer_price, sale_date, mileage, currency
3. **Sold history (same make)** — broader market context, up to 200 sales
4. **Market stats** — computed median, P25, P75, avg, trend for the series
5. **Similar active listings** — current market offerings for comparison
6. **Brand/series thesis** — from brandConfig.ts

Key instruction in prompt:

> "You are a collector car investment analyst. Based ONLY on the real market data provided below (actual sale prices, listing details, and comparable transactions), generate a structured investment analysis. If insufficient data exists for any field, return null. Never fabricate sale records, price data, or market statistics."

Response format: JSON matching the `listing_reports` LLM fields schema.

### Environment variables

```
GEMINI_API_KEY=<user provides>
GEMINI_MODEL=gemini-2.0-flash   # configurable, verify model ID at implementation time
```

## Report Sections (ReportClient.tsx changes)

### Section 1: Executive Summary — always visible

| Data | Source | Change |
|------|--------|--------|
| Car specs (year, make, model, etc.) | Supabase listing | No change |
| Current price | `hammer_price` or `current_bid` | No change |
| Investment Grade | `listing_reports.investment_grade` (Gemini) | Replace `computeGrade()` |
| Fair Value range | `listing_reports.fair_value_low/high` (real P25-P75) | Replace circular 0.8x-1.2x |
| Risk Score | `listing_reports.confidence` (Gemini) | Replace hardcoded mapping |
| Verdict | Computed from real fair value + Gemini grade | Replace deterministic logic |

### Section 2: Vehicle Identity — always visible

| Data | Source | Change |
|------|--------|--------|
| All specs | Supabase listing fields | No change |
| Category label | Derive from source | Replace hardcoded "Live Auctions" |
| Description/History | `description_text` full | No change |

### Section 3: Valuation — visible when report has market stats

| Data | Source | Change |
|------|--------|--------|
| Fair Value range | `listing_reports.fair_value_low/high` | **Replace** circular calculation |
| Market position | Car price vs `listing_reports.median_price` | **Replace** — based on real sales |
| Comparable sales | Sold listings of same series from Supabase | **Replace** — real sold cars only, never live fallback |
| Regional breakdown | Apply regional premiums to real fair value | Keep but base on real data |

### Section 4: Market Context — visible when report has market stats

| Data | Source | Change |
|------|--------|--------|
| Total sales tracked | `listing_reports.total_comparable_sales` | Real data |
| Average / Median price | `listing_reports.avg_price / median_price` (USD) | Real data |
| Price range (min-max) | From sold listings | Real data |
| Trend | `listing_reports.trend_percent / trend_direction` | Real data |
| Brand thesis | `getSeriesThesis()` from brandConfig | **Fix**: use brand thesis, not description snippet |

### Section 5: Risk Assessment — visible when report has LLM analysis

| Data | Source | Change |
|------|--------|--------|
| Red flags | `listing_reports.red_flags` (Gemini) | Real LLM analysis |
| Risk score | `listing_reports.confidence` (Gemini) | Real LLM assessment |
| No criticality badges | Removed | **Remove** hardcoded first-2-critical rule |

### Section 6: Due Diligence — visible when report has LLM analysis

| Data | Source | Change |
|------|--------|--------|
| Questions for seller | `listing_reports.critical_questions` (Gemini) | Real LLM analysis |
| Inspection checklist | Removed | **Remove** hardcoded 6 items |

### Section 7: Ownership Economics — visible when report has LLM analysis

| Data | Source | Change |
|------|--------|--------|
| Annual maintenance | `listing_reports.yearly_maintenance` (Gemini) | Real LLM estimate |
| Annual insurance | `listing_reports.insurance_estimate` (Gemini) | Real LLM estimate |
| Major service cost | `listing_reports.major_service_cost` (Gemini) | Real LLM estimate |
| 5-year projection | Computed from above | Only if base data exists |

### Section 8: Investment Performance — visible when report has market stats

| Data | Source | Change |
|------|--------|--------|
| Price vs real fair value | Car price vs `fair_value_low/high` | Based on real sales |
| Similar cars comparison | `findSimilarCars()` results | No change (already real) |
| Appreciation potential | `listing_reports.appreciation_potential` (Gemini) | Real LLM analysis |

### Section 9: Similar Vehicles — always visible if similar cars found

No changes — already uses real data from `findSimilarCars()`.

### Section 10: Verdict — visible when report has LLM analysis + market stats

| Data | Source | Change |
|------|--------|--------|
| Verdict (BUY/HOLD/WATCH) | Derived from Gemini grade + real fair value position | **Replace** deterministic logic |
| Investment Grade | `listing_reports.investment_grade` (Gemini) | Real LLM grade |
| Key takeaways | Generated from real data points | Only reference available data |
| Strategy text | Removed | **Remove** generic i18n copy |

## New query: `fetchSoldListingsForModel()`

```typescript
// In src/lib/supabaseLiveListings.ts
export interface SoldListingRecordWithCurrency extends SoldListingRecord {
  originalCurrency: string | null
  mileage: number | null
  source: string
}

export async function fetchSoldListingsForModel(
  make: string,
  model: string,
  limit = 50
): Promise<SoldListingRecordWithCurrency[]> {
  // 1. Fetch sold listings for make from Supabase
  //    IMPORTANT: SELECT must include original_currency, mileage, source
  //    (the existing fetchSoldListingsForMake does NOT select these)
  //
  //    .from("listings")
  //    .select("id,year,make,model,trim,hammer_price,original_currency,sale_date,status,mileage,source")
  //    .ilike("make", make)
  //    .eq("status", "sold")
  //    .gt("hammer_price", 0)
  //    .order("sale_date", { ascending: false })
  //    .limit(200)
  //
  // 2. In JS: use extractSeries() to filter to same series
  // 3. If < 3 results, expand to same family group
  // 4. Return up to $limit results with currency info
}
```

## New module: `src/lib/marketStats.ts`

```typescript
import { toUsd } from "./regionPricing"

const ISO_TO_SYMBOL: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF",
}

export interface ModelMarketStats {
  totalSales: number
  medianPrice: number      // USD
  avgPrice: number         // USD
  p25Price: number         // USD
  p75Price: number         // USD
  minPrice: number         // USD
  maxPrice: number         // USD
  trendPercent: number
  trendDirection: "up" | "down" | "stable"  // ±3% threshold
  oldestSaleDate: string
  newestSaleDate: string
  scope: "model" | "series" | "family"
}

export function computeMarketStats(
  soldListings: SoldListingRecordWithCurrency[],
  scope: "model" | "series" | "family"
): ModelMarketStats | null {
  // Returns null if < 3 sold listings
  // 1. Convert all hammer_prices to USD:
  //    toUsd(price, ISO_TO_SYMBOL[originalCurrency] ?? "$")
  // 2. Sort USD prices ascending
  // 3. Compute: P25, P50 (median), P75, avg, min, max
  // 4. Trend: split by date into recent 6 months vs prior 6 months, compare averages
  // 5. trendDirection: stable if ±3%, up if > +3%, down if < -3%
}
```

## New module: `src/lib/reports/queries.ts`

```typescript
// Supabase queries for listing_reports and credits tables.
// All queries use the Supabase client (not legacy dbQuery).

// Reports
export async function getReportForListing(listingId: string): Promise<ListingReport | null>
export async function saveReport(listingId: string, data: ReportData): Promise<ListingReport>

// Credits
export async function getOrCreateUser(supabaseUserId: string, email: string): Promise<UserCredits>
export async function checkAndResetFreeCredits(userId: string): Promise<UserCredits>
export async function hasAlreadyGenerated(userId: string, listingId: string): Promise<boolean>
export async function deductCredit(userId: string, listingId: string, reportId: string): Promise<DeductResult>
export async function getUserCredits(supabaseUserId: string): Promise<UserCredits | null>
export async function addPurchasedCredits(userId: string, amount: number): Promise<UserCredits>
export async function getTransactionHistory(userId: string, limit?: number): Promise<CreditTransaction[]>
```

## Implementation phases (internal, not user-facing)

### Phase I: Real data infrastructure
1. Create `listing_reports` table in Supabase (SQL migration)
2. Create `user_credits`, `user_reports`, `credit_transactions` tables in Supabase
3. Add `fetchSoldListingsForModel()` to `supabaseLiveListings.ts`
4. Create `src/lib/marketStats.ts` with `computeMarketStats()`
5. Create `src/lib/reports/queries.ts` (Supabase queries for new tables)
6. Update `report/page.tsx`:
   - Add `setRequestLocale(locale)` (pre-existing bug fix)
   - Remove `shouldQueryHistoricalData` gate
   - Fetch model-specific sold history + existing report from Supabase
   - Compute market stats and pass to ReportClient
7. Update `ReportClient.tsx`:
   - Accept `report: ListingReport | null` and `marketStats: ModelMarketStats | null` props
   - Replace circular fair value with real P25-P75 from report/stats
   - Remove comparables fallback to similar cars — use real sold listings only
   - Hide sections without real data (conditional rendering)
   - Remove hardcoded inspection checklist
   - Remove hardcoded criticality badges
   - Remove generic verdict strategy text
   - `fairValueByRegion` on CollectorCar is ignored in report

### Phase II: Gemini LLM integration
1. Install `@google/generative-ai` package
2. Create `src/lib/ai/gemini.ts` (replaces `claude.ts` for report generation)
3. Refactor `src/lib/ai/prompts.ts` — add sold history + market stats context
4. Refactor `src/lib/ai/analyzer.ts` — swap Claude import for Gemini
5. Refactor `src/app/api/analyze/route.ts`:
   - Fetch listing from Supabase (not Auction table)
   - Add sold history + market stats to analysis context
   - Save to `listing_reports` (not `Analysis`)
   - Use new credits module (`src/lib/reports/queries.ts`)
6. Update `ReportClient.tsx`:
   - Wire "Generate Report" button to `/api/analyze`
   - Use credits from API response
   - Show report data in sections when available
   - Show partial report (market stats only) + retry on Gemini failure

## Files modified

| File | Changes |
|------|---------|
| `src/lib/supabaseLiveListings.ts` | Add `fetchSoldListingsForModel()` with currency info |
| `src/lib/marketStats.ts` | **NEW** — market stats computation with USD normalization |
| `src/lib/reports/queries.ts` | **NEW** — Supabase queries for `listing_reports` + credits tables |
| `src/lib/ai/gemini.ts` | **NEW** — Gemini API client (replaces `claude.ts` for reports) |
| `src/lib/ai/prompts.ts` | Refactor — add sold history context, update response schema |
| `src/lib/ai/analyzer.ts` | Refactor — swap Claude for Gemini import |
| `src/app/api/analyze/route.ts` | Refactor — Supabase listings + `listing_reports` + new credits |
| `src/hooks/useAnalysis.ts` | **Replaced by server-side props** — report page loads `listing_reports` data via `page.tsx` server component. Hook only used for the "Generate" button POST call. Types updated to match `listing_reports` schema. GET endpoint removed (server-side fetch replaces it). |
| `src/lib/regionPricing.ts` | Add `"CHF"` entry to `TO_USD_RATE` for Swiss Franc support |
| `src/app/[locale]/cars/[make]/[id]/report/page.tsx` | Update data fetching, add locale handling, pass report + market stats |
| `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx` | Major cleanup — remove fabricated data, conditional rendering, use `listing_reports` data |

## Supabase migrations needed

```
migrations/
  001_create_listing_reports.sql
  002_create_user_credits.sql
  003_create_user_reports.sql
  004_create_credit_transactions.sql
```

These are applied via Supabase Dashboard SQL editor or `supabase db push`.

## What gets removed

- Circular fair value usage in ReportClient (`buildFairValue`/`buildRegionalFairValue` still exists on CollectorCar but is ignored in report)
- Hardcoded inspection checklist (6 items)
- Hardcoded criticality badges (first 2 = critical)
- `computeGrade()` fallback for investment grade in report (replaced by Gemini)
- Comparables fallback to `similarCars` presented as sales
- Generic verdict strategy i18n text
- `shouldQueryHistoricalData` gate (all listings now get sold history from Supabase)
- Legacy PG dependency for reports (Analysis, User, UserAnalysis, CreditTransaction tables no longer used for new reports)

## What stays unchanged

- `findSimilarCars()` — already uses real data
- `rowToCollectorCar()` mapping — real Supabase data (still produces `fairValueByRegion` for other pages)
- `fetchSoldListingsForMake()` — already exists, still used for brand-level context
- `src/lib/ai/analyzer.ts` — JSON parsing + caching logic reused (only import changes)
- Legacy `src/lib/credits/index.ts` — kept as-is for backward compat, not used by new reports
- Legacy `src/lib/db/queries.ts` — kept as-is, not used by new reports
- All car detail page UI outside the report
