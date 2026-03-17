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

## Solution

**Single-click report generation** that combines:
1. Real market statistics computed from `listings` table sold history (`hammer_price`)
2. Gemini LLM analysis using all available real data as context

The user clicks "Generate Investment Report" once and gets a complete report. If the analysis already exists in the `Analysis` table, it loads instantly.

## Data Model

### Primary data source: Supabase `listings` table

```
listings {
  id, year, make, model, trim
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

`hammer_price` values come from multiple sources in different currencies. Before computing market stats, all prices must be converted to USD using the `original_currency` field. The `fetchSoldListingsForModel()` query must return `original_currency` alongside `hammer_price`. The `computeMarketStats()` function converts all prices to USD before calculating percentiles and averages using existing `toUsd()` from `regionPricing.ts`.

### Key queries needed

| Query | Purpose | Filter |
|-------|---------|--------|
| `fetchSoldListingsForModel(make, model)` | **NEW** - Comparables for same model | `status = "sold"`, `hammer_price > 0`, same make + model |
| `fetchSoldListingsForMake(make)` | Market context for the brand | Already exists — `status = "sold"`, `hammer_price > 0` |
| `fetchLiveListingById(id)` | The car being analyzed | Already exists |
| `findSimilarCars(car, candidates)` | Similar active listings | Already exists |

### Model matching strategy for `fetchSoldListingsForModel()`

Rather than raw `model ILIKE %model%` (which matches too broadly, e.g., "911" matching all 911 variants), use `extractSeries()` from brandConfig to normalize the model to its series ID first. Query by series:

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
  priceStdDev: number
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

### Analysis storage: existing `Analysis` table (PostgreSQL)

```
Analysis {
  auctionId           -- maps to car ID (see ID mapping section below)
  bidTargetLow        -- recommended buy range low
  bidTargetHigh       -- recommended buy range high
  confidence          -- HIGH / MEDIUM / LOW
  criticalQuestions   -- string[] questions for the seller
  redFlags            -- string[] specific risks
  keyStrengths        -- string[] specific strengths
  yearlyMaintenance   -- number (annual estimate)
  insuranceEstimate   -- number (annual estimate)
  majorServiceCost    -- number
  investmentGrade     -- AAA / AA / A / BBB / BB / B
  appreciationPotential -- string description
  rawAnalysis         -- JSON (full Gemini response)
}
```

### Analysis table ID mapping

The `Analysis` table uses `auctionId` as its foreign key with a `UNIQUE` constraint and `ON CONFLICT ("auctionId") DO UPDATE` upsert. For Supabase `live-*` listings, we use the Supabase UUID (the part after `live-`) as the `auctionId`. The `Analysis` table's `auctionId` column is a UUID/text field — it does NOT have a foreign key constraint to the `Auction` table, so storing a Supabase listing ID there works without schema changes.

The existing `/api/analyze/route.ts` already uses this pattern — it accepts an `auctionId` and stores the analysis keyed to it. We follow the same pattern with the Supabase listing ID.

## Existing infrastructure (to refactor, not rebuild)

### Existing analysis pipeline

The project already has a complete analysis pipeline:

| File | Purpose | Action |
|------|---------|--------|
| `src/app/api/analyze/route.ts` | API endpoint for analysis generation | **Refactor** — replace Auction table lookups with Supabase listing lookups, add sold history context |
| `src/lib/ai/analyzer.ts` | Orchestrates LLM call + JSON parsing + caching | **Refactor** — swap Claude client for Gemini, update prompt building |
| `src/lib/ai/claude.ts` | Claude API client | **Replace** with `src/lib/ai/gemini.ts` |
| `src/lib/ai/prompts.ts` | Prompt templates + response schema | **Refactor** — update prompts with sold history context, keep response schema compatible |
| `src/lib/credits/index.ts` | User credits, analysis tracking, monthly resets | **Keep** — use existing credits system (not `useTokens` hook) |

### Credits system (not tokens)

The existing credits system in `src/lib/credits/index.ts` is the correct gate for report generation:
- `getOrCreateUser(supabaseId, email)` — creates user with 3 free monthly credits
- `hasAlreadyAnalyzed(userId, auctionId)` — free re-access to previous analyses
- `deductCredit(userId, auctionId)` — deducts 1 credit + logs transaction
- Monthly reset of free credits via `checkAndResetFreeCredits()`

The `useTokens` hook referenced in `ReportClient.tsx` is a separate client-side mechanism. During refactor, align the client-side to use the credits system via the API route response (which already returns `creditsRemaining`).

## Architecture

### UX Flow

```
Car detail page → "Investment Report" button
  │
  ├─ Analysis EXISTS in DB?
  │   └─ YES → Load report page instantly (all sections populated)
  │
  └─ NO → Show generation loading state (~5-10s)
       ├─ Step 1: Fetch sold history for model + make from Supabase
       ├─ Step 2: Compute market stats (median, P25-P75, trend)
       ├─ Step 3: Call Gemini with full context (sold history + car data + stats)
       ├─ Step 4: Save analysis to Analysis table
       └─ Step 5: Show complete report (all sections)

  On Gemini failure (after 1 retry):
       └─ Show partial report with data-only sections (Valuation, Market Context, Similar Cars)
          + error message: "AI analysis unavailable. Showing market data only. [Retry]"
```

Second visit → analysis loaded from DB, no Gemini call.

### API Route: Refactor existing `POST /api/analyze`

Refactor the existing `/api/analyze/route.ts` instead of creating a new route:

```typescript
// 1. Auth via Supabase (existing)
// 2. Credits check via credits/index.ts (existing)
// 3. Check if analysis already exists → return cached (existing, 24h cache)
// 4. Fetch car from Supabase listings table (NEW — replace Auction table lookup)
// 5. Fetch sold listings for model via fetchSoldListingsForMake + series filtering (NEW)
// 6. Compute market stats via computeMarketStats() (NEW)
// 7. Find similar active listings (NEW)
// 8. Get brand thesis from brandConfig (NEW)
// 9. Build Gemini prompt with ALL real context (REFACTOR prompts.ts)
// 10. Call Gemini API via gemini.ts (REPLACE claude.ts)
// 11. Parse + validate structured JSON response (existing analyzer.ts logic)
// 12. Save to Analysis table via saveAnalysis() (existing)
// 13. Deduct credit (existing)
// 14. Return analysis + credits remaining to frontend
```

### Replace Claude with Gemini: `src/lib/ai/gemini.ts`

Replace `src/lib/ai/claude.ts` with a Gemini equivalent:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai"

// analyzeWithSystem(systemPrompt, userPrompt): Promise<string>
// - Uses GEMINI_API_KEY env var
// - Model: GEMINI_MODEL env var (default: "gemini-2.0-flash")
// - Returns text response
// - 1 retry with exponential backoff on transient errors
```

The `analyzer.ts` orchestrator stays largely the same — it already handles JSON parsing, caching, and retry logic. Only the LLM client import changes from `claude.ts` to `gemini.ts`.

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

Response format: JSON matching existing `AIAnalysisResponse` schema from `prompts.ts` (already compatible with `DbAnalysisRow`).

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
| Investment Grade | `Analysis.investmentGrade` (Gemini) | Replace `computeGrade()` |
| Fair Value range | Computed from sold history P25-P75 | Replace circular 0.8x-1.2x |
| Risk Score | `Analysis.confidence` (Gemini) | Replace hardcoded mapping |
| Verdict | Computed from real fair value + Gemini grade | Replace deterministic logic |

### Section 2: Vehicle Identity — always visible

| Data | Source | Change |
|------|--------|--------|
| All specs | Supabase listing fields | No change |
| Category label | Derive from source | Replace hardcoded "Live Auctions" |
| Description/History | `description_text` full | No change |

### Section 3: Valuation — visible when sold history exists

| Data | Source | Change |
|------|--------|--------|
| Fair Value range | P25-P75 from sold listings | **Replace** circular calculation |
| Market position | Car price vs median of sold listings | **Replace** — now based on real sales |
| Comparable sales | Sold listings of same series from Supabase | **Replace** — real sold cars only, never live fallback |
| Regional breakdown | Apply regional premiums to real fair value | Keep but base on real data |

### Section 4: Market Context — visible when sold history exists

| Data | Source | Change |
|------|--------|--------|
| Total sales tracked | Count from sold listings query | Real data |
| Average / Median price | Computed from `hammer_price` (USD-normalized) | Real data |
| Price range (min-max) | From sold listings | Real data |
| Trend | Compare recent vs older sold prices (±3% threshold for stable) | Real data |
| Brand thesis | `getSeriesThesis()` from brandConfig | **Fix**: use brand thesis, not description snippet |

### Section 5: Risk Assessment — visible when Analysis exists

| Data | Source | Change |
|------|--------|--------|
| Red flags | `Analysis.redFlags` (Gemini) | Real LLM analysis |
| Risk score | `Analysis.confidence` (Gemini) | Real LLM assessment |
| No criticality badges | Removed | **Remove** hardcoded first-2-critical rule |

### Section 6: Due Diligence — visible when Analysis exists

| Data | Source | Change |
|------|--------|--------|
| Questions for seller | `Analysis.criticalQuestions` (Gemini) | Real LLM analysis |
| Inspection checklist | Removed | **Remove** hardcoded 6 items |

### Section 7: Ownership Economics — visible when Analysis exists

| Data | Source | Change |
|------|--------|--------|
| Annual maintenance | `Analysis.yearlyMaintenance` (Gemini) | Real LLM estimate |
| Annual insurance | `Analysis.insuranceEstimate` (Gemini) | Real LLM estimate |
| Major service cost | `Analysis.majorServiceCost` (Gemini) | Real LLM estimate |
| 5-year projection | Computed from above | Only if base data exists |

### Section 8: Investment Performance — visible when sold history exists

| Data | Source | Change |
|------|--------|--------|
| Price vs real fair value | Car price vs P25-P75 | Based on real sales |
| Similar cars comparison | `findSimilarCars()` results | No change (already real) |
| Appreciation potential | `Analysis.appreciationPotential` (Gemini) | Real LLM analysis |

### Section 9: Similar Vehicles — always visible if similar cars found

No changes — already uses real data from `findSimilarCars()`.

### Section 10: Verdict — visible when Analysis + sold history exist

| Data | Source | Change |
|------|--------|--------|
| Verdict (BUY/HOLD/WATCH) | Derived from Gemini grade + real fair value position | **Replace** deterministic logic |
| Investment Grade | `Analysis.investmentGrade` (Gemini) | Real LLM grade |
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
  //    SELECT id, year, make, model, trim, hammer_price, original_currency,
  //           sale_date, status, mileage, source
  //    FROM listings
  //    WHERE make ILIKE $make AND status = 'sold' AND hammer_price > 0
  //    ORDER BY sale_date DESC LIMIT 200
  //
  // 2. In JS: use extractSeries() to filter to same series
  // 3. If < 3 results, expand to same family group
  // 4. Return up to $limit results with currency info
}
```

## New module: `src/lib/marketStats.ts`

```typescript
import { toUsd } from "./regionPricing"

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
  // 1. Convert all hammer_prices to USD via toUsd(price, currency)
  // 2. Sort USD prices ascending
  // 3. Compute percentiles (P25, P50/median, P75), avg, min, max
  // 4. Trend: split by date into recent 6 months vs prior 6 months, compare averages
  // 5. Stable threshold: ±3%
}
```

## Implementation phases (internal, not user-facing)

### Phase I: Real data infrastructure
1. Add `fetchSoldListingsForModel()` to `supabaseLiveListings.ts`
2. Create `src/lib/marketStats.ts` with `computeMarketStats()`
3. Update `report/page.tsx`:
   - Add `setRequestLocale(locale)` (pre-existing bug fix)
   - Remove `shouldQueryHistoricalData` gate
   - Fetch model-specific sold history from Supabase
   - Compute market stats and pass to ReportClient
4. Update `ReportClient.tsx`:
   - Accept `marketStats: ModelMarketStats | null` prop
   - Replace circular fair value with real P25-P75 stats
   - Remove comparables fallback to similar cars — use real sold listings only
   - Hide sections without real data (conditional rendering)
   - Remove hardcoded inspection checklist
   - Remove hardcoded criticality badges
   - Remove generic verdict strategy text
   - `fairValueByRegion` on CollectorCar is ignored in report — use `marketStats` instead

### Phase II: Gemini LLM integration
1. Install `@google/generative-ai` package
2. Create `src/lib/ai/gemini.ts` (replace `claude.ts`)
3. Refactor `src/lib/ai/prompts.ts` — add sold history + market stats to prompt context
4. Refactor `src/lib/ai/analyzer.ts` — swap Claude import for Gemini
5. Refactor `src/app/api/analyze/route.ts`:
   - Replace Auction table lookup with Supabase listing lookup
   - Add sold history + market stats to analysis context
   - Keep existing credits system
6. Update `ReportClient.tsx`:
   - Wire "Generate Report" button to `/api/analyze`
   - Use credits system response (not useTokens)
   - Show Analysis data in sections when available
   - Show partial report + retry on Gemini failure

## Files modified

| File | Changes |
|------|---------|
| `src/lib/supabaseLiveListings.ts` | Add `fetchSoldListingsForModel()` with currency info |
| `src/lib/marketStats.ts` | **NEW** — market stats computation with USD normalization |
| `src/lib/ai/gemini.ts` | **NEW** — Gemini API client (replaces `claude.ts`) |
| `src/lib/ai/prompts.ts` | Refactor — add sold history context to prompts |
| `src/lib/ai/analyzer.ts` | Refactor — swap Claude for Gemini import |
| `src/app/api/analyze/route.ts` | Refactor — Supabase listings instead of Auction table, add market context |
| `src/app/[locale]/cars/[make]/[id]/report/page.tsx` | Update data fetching, add locale handling, pass market stats |
| `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx` | Major cleanup — remove fabricated data, conditional rendering, wire credits system |

## What gets removed

- Circular fair value usage in ReportClient (`buildFairValue`/`buildRegionalFairValue` still exists on CollectorCar but is ignored in report)
- Hardcoded inspection checklist (6 items)
- Hardcoded criticality badges (first 2 = critical)
- `computeGrade()` fallback for investment grade in report (replaced by Gemini)
- Comparables fallback to `similarCars` presented as sales
- Generic verdict strategy i18n text
- `shouldQueryHistoricalData` gate (all listings now get sold history from Supabase)
- `src/lib/ai/claude.ts` (replaced by `gemini.ts`)

## What stays unchanged

- `findSimilarCars()` — already uses real data
- `rowToCollectorCar()` mapping — real Supabase data (still produces `fairValueByRegion` for other pages)
- `fetchSoldListingsForMake()` — already exists, still used for brand-level context
- `src/lib/credits/index.ts` — credits system gates report generation
- `src/lib/ai/analyzer.ts` — JSON parsing + caching logic reused (only import changes)
- All car detail page UI outside the report
