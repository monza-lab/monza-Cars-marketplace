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

### Regional market segregation (3-tier pricing)

**Problem**: Only ~4,117 listings have verified sold status with `hammer_price > 0`, and 99% of those are from Bring a Trailer (US only). But we have 19k AutoScout24 listings (EU) and 6.5k AutoTrader listings (UK) with asking prices stored in `hammer_price`.

**Solution**: Segregate market data by region and data quality tier:

| Tier | Label in Report | Sources | What `hammer_price` means | Region |
|------|----------------|---------|--------------------------|--------|
| **Tier 1: Verified Sales** | "Based on X verified sales" | BaT, ClassicCom | Actual sale price (hammer price) | US |
| **Tier 2: Active Asking Prices** | "Based on X active listings" | AutoScout24, AutoTrader | Asking/listing price | EU (EUR), UK (GBP) |
| **Tier 3: Recently Removed** | "Based on X recently delisted" | AutoScout24 (delisted) | Last known asking price | EU |

**Implementation rules**:
- Never mix tiers in the same statistical calculation
- Each tier gets its own `RegionalMarketStats` block
- Labels are always honest about data type (sale price vs asking price)
- Currency stays native per region (USD for US, EUR for EU, GBP for UK), with USD conversion available
- The report shows all available regional data, clearly separated

**Source-to-region mapping**:
```typescript
const SOURCE_REGION: Record<string, { region: string; tier: 1 | 2 | 3; currency: string }> = {
  "Bring a Trailer": { region: "US", tier: 1, currency: "USD" },
  "ClassicCom":      { region: "US", tier: 1, currency: "USD" },
  "AutoScout24":     { region: "EU", tier: 2, currency: "EUR" },
  "AutoTrader":      { region: "UK", tier: 2, currency: "GBP" },
  "BeForward":       { region: "JP", tier: 2, currency: "JPY" },  // limited data
}
```

**Delisted detection**: AutoScout24 listings with `status = 'delisted'` or `status = 'sold'` without auction provenance are Tier 3.

### Key queries needed

| Query | Purpose | Filter |
|-------|---------|--------|
| `fetchPricedListingsForModel(make, model)` | **NEW** - All listings with price data for same model | `hammer_price > 0`, same make + model, any status |
| `fetchSoldListingsForMake(make)` | Market context for the brand | Already exists — `status = "sold"`, `hammer_price > 0` |
| `fetchLiveListingById(id)` | The car being analyzed | Already exists |
| `findSimilarCars(car, candidates)` | Similar active listings | Already exists |

### Model matching strategy for `fetchPricedListingsForModel()`

Rather than raw `model ILIKE %model%` (which matches too broadly, e.g., "911" matching all 911 variants), use `extractSeries()` from brandConfig to normalize the model to its series ID first:

1. Extract series via `extractSeries(model, year, make)`
2. Query listings where `extractSeries(listing.model, listing.year, listing.make)` matches the same series
3. If < 3 results, expand to same family group via `getSeriesConfig(series).familyGroup`
4. Always label the scope used in the stats: `"model"`, `"series"`, or `"family"`

In practice, the series extraction happens in the app layer after fetching priced listings for the make, since `extractSeries()` is a JS function, not a SQL function. So the flow is: fetch all priced listings for the make → filter in JS by matching series → segregate by tier/region → compute stats per region.

### Computed market stats (per region)

From `fetchPricedListingsForModel()` results, segregated by region/tier, compute:

```typescript
interface RegionalMarketStats {
  region: string            // "US" | "EU" | "UK"
  tier: 1 | 2 | 3
  tierLabel: string         // "Verified Sales" | "Active Listings" | "Recently Delisted"
  currency: string          // native currency: "USD" | "EUR" | "GBP"
  totalListings: number
  medianPrice: number       // in native currency
  avgPrice: number          // in native currency
  p25Price: number          // 25th percentile, native currency
  p75Price: number          // 75th percentile, native currency
  minPrice: number
  maxPrice: number
  medianPriceUsd: number    // converted to USD for cross-region comparison
  // Trend: compare avg of recent 6 months vs prior 6 months
  trendPercent: number      // e.g., +5.2 or -3.1
  trendDirection: "up" | "down" | "stable"
  oldestDate: string
  newestDate: string
  sources: string[]         // e.g., ["Bring a Trailer", "ClassicCom"]
}

interface ModelMarketStats {
  scope: "model" | "series" | "family"
  regions: RegionalMarketStats[]
  // Convenience: best available fair value (Tier 1 > Tier 2 > Tier 3)
  primaryFairValueLow: number   // USD, P25 from best tier
  primaryFairValueHigh: number  // USD, P75 from best tier
  primaryTier: 1 | 2 | 3
  primaryRegion: string
  totalDataPoints: number       // sum across all regions
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

  -- Market stats (best available, in USD for primary comparison)
  fair_value_low         numeric,          -- P25 from best tier (USD)
  fair_value_high        numeric,          -- P75 from best tier (USD)
  median_price           numeric,          -- median from best tier (USD)
  avg_price              numeric,          -- average from best tier (USD)
  min_price              numeric,          -- lowest price from best tier (USD)
  max_price              numeric,          -- highest price from best tier (USD)
  total_comparable_sales integer,          -- data points from best tier
  trend_percent          numeric,          -- e.g., +5.2 or -3.1
  trend_direction        text,             -- 'up' / 'down' / 'stable'
  stats_scope            text,             -- 'model' / 'series' / 'family'
  primary_tier           integer,          -- 1 (verified sales) / 2 (asking) / 3 (delisted)
  primary_region         text,             -- 'US' / 'EU' / 'UK'

  -- Full regional breakdown (all tiers, stored as JSONB)
  regional_stats         jsonb,            -- array of RegionalMarketStats objects

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
       ├─ Step 1: Fetch all priced listings for model from Supabase (sold + active + delisted)
       ├─ Step 2: Segregate by region/tier → compute regional market stats
       ├─ Step 3: Call Gemini with full context (regional data + car data + stats)
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
2. **Regional market data** — per-region stats with tier labels:
   - US Market: verified sales from BaT/ClassicCom (Tier 1)
   - EU Market: asking prices from AutoScout24 (Tier 2)
   - UK Market: asking prices from AutoTrader (Tier 2)
3. **Sample comparable listings** — up to 20 per region with hammer_price, date, mileage, currency, source
4. **Cross-market summary** — primary fair value, total data points, scope used
5. **Similar active listings** — current market offerings for comparison
6. **Brand/series thesis** — from brandConfig.ts

Key: the prompt explicitly tells Gemini which data is verified sales vs asking prices, so the LLM can weight them appropriately.

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
| Fair Value range | `listing_reports.fair_value_low/high` (from best tier, in USD) | **Replace** circular calculation |
| Market position | Car price vs `listing_reports.median_price` | **Replace** — based on real data |
| Comparable transactions | Tier 1: real sold cars. Tier 2: active asking prices. Labeled honestly. | **Replace** — never fake "comparable sales" |
| Regional breakdown | `listing_reports.regional_stats` — show each region's P25-P75 in native currency | **Replace** — real per-region data, not premiums applied to one value |

**Display logic for valuation**:
- Primary fair value (bold, top): from best available tier (Tier 1 preferred)
- If Tier 1 data exists: "Fair Value: $X - $Y (based on N verified sales, US market)"
- If only Tier 2: "Estimated Range: €X - €Y (based on N active listings, EU market)"
- Show all available regions below as supplementary data

### Section 4: Market Context — visible when report has market stats

| Data | Source | Change |
|------|--------|--------|
| Regional market cards | `listing_reports.regional_stats` (one card per region with data) | **NEW** — separate US/EU/UK cards |
| Per-region stats | median, avg, P25-P75, trend, count — in native currency | Real data per region |
| Data quality label | Tier 1: "Verified Sales", Tier 2: "Asking Prices", Tier 3: "Recently Delisted" | **NEW** — honest labeling |
| Brand thesis | `getSeriesThesis()` from brandConfig | **Fix**: use brand thesis, not description snippet |

**Display example**:
```
🇺🇸 US Market — Verified Sales (BaT, ClassicCom)
   Median: $185,000 | Range: $142,000 - $245,000 | Trend: ↑ +5.2%
   Based on 47 verified sales (Jan 2024 - Mar 2026)

🇪🇺 EU Market — Active Listings (AutoScout24)
   Median: €168,000 | Range: €125,000 - €220,000 | Trend: → stable
   Based on 89 active listings

🇬🇧 UK Market — Active Listings (AutoTrader)
   Median: £155,000 | Range: £118,000 - £198,000 | Trend: ↓ -2.1%
   Based on 34 active listings
```

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

## New query: `fetchPricedListingsForModel()`

```typescript
// In src/lib/supabaseLiveListings.ts
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

export async function fetchPricedListingsForModel(
  make: string,
  model: string,
  limit = 300
): Promise<PricedListingRecord[]> {
  // 1. Fetch ALL listings with price data for this make from Supabase
  //    NOT limited to status="sold" — includes active, delisted, sold
  //    IMPORTANT: SELECT must include original_currency, mileage, source, country, status
  //
  //    .from("listings")
  //    .select("id,year,make,model,trim,hammer_price,original_currency,sale_date,status,mileage,source,country")
  //    .ilike("make", make)
  //    .gt("hammer_price", 0)
  //    .order("sale_date", { ascending: false })
  //    .limit(500)
  //
  // 2. In JS: use extractSeries() to filter to same series
  // 3. If < 3 results, expand to same family group
  // 4. Segregate by tier/region using SOURCE_REGION mapping
  // 5. Return up to $limit results
}
```

## New module: `src/lib/marketStats.ts`

```typescript
import { toUsd } from "./regionPricing"

const ISO_TO_SYMBOL: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF",
}

const SOURCE_REGION: Record<string, { region: string; tier: 1 | 2 | 3; currency: string }> = {
  "Bring a Trailer": { region: "US", tier: 1, currency: "USD" },
  "ClassicCom":      { region: "US", tier: 1, currency: "USD" },
  "AutoScout24":     { region: "EU", tier: 2, currency: "EUR" },
  "AutoTrader":      { region: "UK", tier: 2, currency: "GBP" },
  "BeForward":       { region: "JP", tier: 2, currency: "JPY" },
}

export interface RegionalMarketStats {
  region: string
  tier: 1 | 2 | 3
  tierLabel: string
  currency: string
  totalListings: number
  medianPrice: number
  avgPrice: number
  p25Price: number
  p75Price: number
  minPrice: number
  maxPrice: number
  medianPriceUsd: number
  trendPercent: number
  trendDirection: "up" | "down" | "stable"
  oldestDate: string
  newestDate: string
  sources: string[]
}

export interface ModelMarketStats {
  scope: "model" | "series" | "family"
  regions: RegionalMarketStats[]
  primaryFairValueLow: number    // USD, P25 from best tier
  primaryFairValueHigh: number   // USD, P75 from best tier
  primaryTier: 1 | 2 | 3
  primaryRegion: string
  totalDataPoints: number
}

export function segregateByRegion(
  listings: PricedListingRecord[]
): Map<string, { tier: number; currency: string; listings: PricedListingRecord[] }> {
  // Group listings by source → region/tier using SOURCE_REGION mapping
  // For AutoScout24: status="delisted" → Tier 3, else → Tier 2
  // Returns Map keyed by "region-tier" (e.g., "US-1", "EU-2", "EU-3")
}

export function computeRegionalStats(
  listings: PricedListingRecord[],
  region: string,
  tier: 1 | 2 | 3,
  currency: string
): RegionalMarketStats | null {
  // Returns null if < 3 listings
  // 1. Compute stats in NATIVE currency (not USD) for display
  // 2. Also compute medianPriceUsd for cross-region comparison
  // 3. Sort prices ascending → P25, P50 (median), P75, avg, min, max
  // 4. Trend: split by date into recent 6 months vs prior 6 months, compare averages
  // 5. trendDirection: stable if ±3%, up if > +3%, down if < -3%
}

export function computeMarketStats(
  listings: PricedListingRecord[],
  scope: "model" | "series" | "family"
): ModelMarketStats | null {
  // Returns null if no regions have >= 3 listings
  // 1. segregateByRegion(listings)
  // 2. computeRegionalStats() for each region/tier group
  // 3. Pick primary: Tier 1 > Tier 2 > Tier 3 (by highest tier, then most data)
  // 4. primaryFairValueLow/High = P25/P75 from primary region, converted to USD
  // 5. totalDataPoints = sum across all regions
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
1. Create `listing_reports` table in Supabase (SQL migration) — includes `regional_stats` JSONB column
2. Create `user_credits`, `user_reports`, `credit_transactions` tables in Supabase
3. Add `fetchPricedListingsForModel()` to `supabaseLiveListings.ts` — fetches all listings with price (not just sold)
4. Create `src/lib/marketStats.ts` with `segregateByRegion()`, `computeRegionalStats()`, `computeMarketStats()`
5. Create `src/lib/reports/queries.ts` (Supabase queries for new tables)
6. Update `report/page.tsx`:
   - Add `setRequestLocale(locale)` (pre-existing bug fix)
   - Remove `shouldQueryHistoricalData` gate
   - Fetch model-specific priced listings + existing report from Supabase
   - Compute regional market stats and pass to ReportClient
7. Update `ReportClient.tsx`:
   - Accept `report: ListingReport | null` and `marketStats: ModelMarketStats | null` props
   - Replace circular fair value with real P25-P75 from best tier
   - Show regional market cards (US/EU/UK) with honest tier labels
   - Remove comparables fallback to similar cars — use real priced listings by tier
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
| `src/lib/supabaseLiveListings.ts` | Add `fetchPricedListingsForModel()` — all listings with price data (sold + active + delisted) |
| `src/lib/marketStats.ts` | **NEW** — regional market stats computation with tier segregation + USD normalization |
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
