# Haus Report World-Class Completion — Close All V2 Gaps

**Date:** 2026-05-12
**Status:** Draft — pending user review
**Owner:** Edgar / Monza Haus
**Supersedes:** None. Builds on `2026-04-21-haus-report-v2-design.md` (the V2 spec). This spec closes every gap between what V2 designed and what actually works today.

---

## 1. Context & Problem

The V2 spec (April 21, 2026) designed a world-class report product. A comprehensive audit on May 12 revealed that **the implementation is ~60% complete** — the architecture is sound but critical data pipelines are disconnected, the old V1 remains the default experience, and several sections render blank or with false fallback data.

### 1.1 Audit findings (executive summary)

| Category | Count | Severity |
|---|---|---|
| Structurally blank sections (data never connected) | 4 | Critical |
| Data pipelines disconnected (generated but not displayed) | 3 | Critical |
| Fallbacks producing false/misleading data | 5 | High |
| Placeholder sections shown to users | 8 | Medium |
| Missing logging in generation pipeline | 6 gaps | Medium |
| Hardcoded English strings (i18n pending) | ~85 | Low (deferred) |

### 1.2 Root causes

1. **V1 is still the default.** V2 requires `?v2=1` in the URL. Most users never see the improved report.
2. **V1 ReportClient was never refactored post-HausReport.** Arrays `flags[]`, `questions[]`, `strengths[]` are hardcoded empty at lines 237-241 of `ReportClient.tsx`. The HausReport pipeline populates `signals_detected` and `signals_missing` but V1 doesn't consume them for its legacy sections.
3. **AI intelligence layers generate but don't persist/propagate.** `color_intelligence`, `vin_intelligence`, and `investment_narrative` are computed in `/api/analyze` and saved to `listing_reports`, but `assembleHausReportFromDB()` doesn't read them back, so they're lost on page reload.
4. **False-positive fallbacks.** When DB returns null for fair values, `num(v, 0)` silently converts to `$0K` — misleading. `comparable_layer_used` defaults to `"strict"` when unknown. `extraction_version` defaults to `"v1.0"` even for unprocessed reports.
5. **Zero logging in the generation pipeline.** When a report comes out with blank sections, there's no way to diagnose why without reading code.

---

## 2. Scope

### 2.1 In scope (this spec)

1. **Make V2 the default report experience** — remove `?v2=1` gate
2. **Connect all disconnected data pipelines** — color_intelligence, vin_intelligence, investment_narrative from DB through to V2 UI
3. **Fix all false fallbacks** — null fair values show "not computed" instead of $0K
4. **Deprecate V1 ReportClient** — keep file but redirect all traffic to V2
5. **Deprecate V1 jsPDF export** — remove client-side PDF generation, use server-side react-pdf exclusively
6. **Add structured logging to `/api/analyze`** — every step, every count, every duration
7. **Connect signals to V1 legacy sections** (if V1 is kept as fallback) — `signals_missing` → `questions[]`, risk signals → `flags[]`
8. **Fix react-pdf templates** — ensure no blank pages when data is sparse
9. **Fix Excel export** — ensure V2 data (color intel, VIN intel, narrative) flows to sheets

### 2.2 Out of scope (explicit)

- **i18n of ~85 hardcoded strings** — tracked separately, non-blocking for this iteration
- **Specialist agents** — Tier 3 content, post-editorial work
- **Reference pack / KB seeding** — editorial work by Edgar, parallel track
- **New UI blocks not in V2 spec** — no new sections invented
- **Stripe/pricing changes** — no payment flow changes
- **DB schema migrations** — all changes are application-layer reads of existing columns

---

## 3. Detailed Changes

### 3.1 Make V2 the default report

**File:** `src/app/[locale]/cars/[make]/[id]/report/page.tsx`

**Current behavior:** Lines 204-225 — renders `ReportClientV2` only when `resolvedSearch.v2 === "1"`, otherwise renders `ReportClient` (V1).

**Change:** Invert the condition. V2 is the default. V1 is accessible via `?v1=1` as a fallback during transition.

```tsx
// Before
{resolvedSearch.v2 === "1" ? <ReportClientV2 ... /> : <ReportClient ... />}

// After
{resolvedSearch.v1 === "1" ? <ReportClient ... /> : <ReportClientV2 ... />}
```

**Also pass new props to ReportClientV2** that are currently only available server-side:
- `d2Precomputed` — already computed but only passed when `v2=1`
- `reportTier`, `reportHash`, `reportVersion` — same

**Since V2 is now the default, all these props are always passed.**

### 3.2 Connect color_intelligence, vin_intelligence, investment_narrative to DB round-trip

**Problem (CRITICAL — both sides are broken):**

The pipeline in `/api/analyze` (lines 362-381) composes `color_intelligence`, `vin_intelligence`, and `investment_narrative` on the HausReport object. But these are **silently dropped** on both sides:

1. **Write side:** `saveHausReport()` (queries.ts:830-858) does NOT include these fields in its upsert payload. It only writes: `fair_value_low/high`, `median_price`, `specific_car_fair_value_*`, `comparable_layer_used`, `comparables_count`, `modifiers_applied_json`, `modifiers_total_percent`, `signals_extracted_at`, `extraction_version`, `landed_cost_json`. The three intelligence fields are composed on the object but never persisted.

2. **Read side:** `assembleHausReportFromDB()` (queries.ts:899-946) does not read them back from the DB row.

**Fix — Write side:** `src/lib/reports/queries.ts` — function `saveHausReport`

Add the three fields to the upsert payload, using defensive patterns (try-catch with Postgres error code 42703 for missing columns, same pattern as `saveReportMetadataV2`):

```typescript
// Add to the upsert payload in saveHausReport():
color_intelligence_json: report.color_intelligence ?? null,
vin_intelligence_json: report.vin_intelligence ?? null,
investment_narrative_json: report.investment_narrative ?? null,
```

If the columns don't exist yet in the DB, wrap the write in a try-catch that silently ignores `42703` (undefined_column) errors, same as `saveReportMetadataV2` at lines 62-88. This keeps the save non-blocking while BE migration lands.

**Fix — Read side:** `src/lib/reports/queries.ts` — function `assembleHausReportFromDB`

Read the three fields from the DB row with defensive null handling:

```typescript
// Add to the return object in assembleHausReportFromDB():
color_intelligence: (row.color_intelligence_json ?? null) as HausReport["color_intelligence"],
vin_intelligence: (row.vin_intelligence_json ?? null) as HausReport["vin_intelligence"],
investment_narrative: (row.investment_narrative_json ?? null) as HausReport["investment_narrative"],
```

**Propagation through adapter:** `src/lib/fairValue/adaptV1ToV2.ts`

The adapter already spreads `...ctx.v1Report` into the V2 shape (line 128). Since `HausReport` already has optional `color_intelligence?`, `vin_intelligence?`, `investment_narrative?` fields (types.ts lines 101-103), they will automatically propagate when present. No code change needed in the adapter.

**DB columns status:** The columns `color_intelligence_json`, `vin_intelligence_json`, `investment_narrative_json` may not exist yet in the `listing_reports` table. The defensive patterns above (42703 handling) ensure both read and write work whether or not the BE migration has landed. When the columns don't exist, the fields will be `null` in the assembled report — the UI already handles null for all three blocks.

### 3.3 Fix false fallbacks in assembleHausReportFromDB

**File:** `src/lib/reports/queries.ts` — function `assembleHausReportFromDB`

| Current | Problem | Fix |
|---|---|---|
| `num(row.fair_value_low)` → 0 | Shows $0K | Return `null` and let UI handle |
| `num(row.specific_car_fair_value_mid)` → 0 | Shows $0K, verdict says "Fair value not yet computed" | Return `null` |
| `(row.comparable_layer_used ?? "strict")` | Says "strict" when unknown | Default to `null`, UI shows "unknown" |
| `(row.extraction_version ?? "v1.0")` | False version | Default to `null` |

**Approach:** Change `HausReport` type to make fair value fields `number | null` (types.ts lines 79-81). Update `assembleHausReportFromDB` to return `null` instead of `0` when DB value is null.

**Cascading type impact:** Changing these fields from `number` to `number | null` is a cascading change. A TypeScript build (`npx tsc --noEmit`) will reveal all consumers that need null guards. Known impacted locations:

- `VerdictBlock.tsx`: show "Awaiting analysis" instead of $0
- `SpecificCarFairValueBlock.tsx`: show "Generate report to see fair value" instead of $0K-$0K
- `ValuationPage.tsx` (PDF): guard against null/0 mid value
- `Cover.tsx` (PDF): show "Pending" instead of $0K range
- `adaptV1ToV2.ts`: spreads `...ctx.v1Report`, null values propagate automatically
- `ReportClientV2.tsx`: `computeDelta()` helper line 254-256 already returns 0 when `fairMidUsd === 0`, update to also handle null
- `renderReport.tsx`: `composeOneLiner()` and `deriveVerdict()` already handle 0, update for null
- `applyModifiers` / `computeSpecificCarFairValue` in engine.ts — these compute values, not consume them, so no impact
- Any other consumers revealed by the TypeScript compiler

### 3.4 Structured logging in /api/analyze

**File:** `src/app/api/analyze/route.ts`

Add a `ReportGenerationLog` object that accumulates through the pipeline and is logged as a single structured JSON at the end:

```typescript
interface ReportGenerationLog {
  listingId: string
  userId: string
  startedAt: string
  // Pipeline steps
  steps: {
    marketStats: { durationMs: number; found: boolean; totalDataPoints: number; primaryRegion: string | null; baselineUsd: number }
    structuredSignals: { durationMs: number; count: number; keys: string[] }
    sellerSignal: { durationMs: number; found: boolean; tier: string | null }
    geminiExtraction: { durationMs: number; ok: boolean; signalCount: number; model: string }
    colorIntel: { durationMs: number; exteriorFound: boolean; rarity: string; isPTS: boolean }
    vinIntel: { durationMs: number; decoded: boolean; warnings: string[] }
    modifiers: { durationMs: number; count: number; totalPercent: number; baselineUsd: number }
    fairValue: { low: number; mid: number; high: number }
    landedCost: { durationMs: number; computed: boolean; origin: string | null; destination: string }
    narrative: { durationMs: number; generated: boolean; model: string | null }
    arbitrage: { durationMs: number; regionsWithData: number }
    persist: { durationMs: number; success: boolean }
    hash: { value: string; version: number; tier: string }
  }
  // Totals
  totalDurationMs: number
  totalSignalsDetected: number
  totalSignalsMissing: number
  cached: boolean
  creditUsed: number
}
```

Log at `console.info("[analyze] Report generated:", JSON.stringify(log))` on success.
Log at `console.error("[analyze] Report generation failed:", JSON.stringify(partialLog), error)` on failure.

**Cache-hit path (early return at line 169):** Log a shorter entry:
```typescript
console.info("[analyze] Cache hit:", JSON.stringify({
  listingId: body.listingId,
  userId: authUser.id,
  cached: true,
  hasSignals: !!cachedHausRow.signals_extracted_at,
  tier: v2Meta.tier ?? "tier_1",
  version: v2Meta.version ?? 1,
}))
```

### 3.5 Deprecate V1 jsPDF export

**Current state:** V1 ReportClient has a ~700-line `handleDownloadPdf` function (lines 343-1171) that generates a PDF client-side using jsPDF. The V2 system uses server-side react-pdf via `/api/reports/[id]/pdf/route.ts`.

**Change:**
- In `ReportClientV2`, the `DownloadSheet` component already calls the server-side PDF API. No changes needed for V2.
- Since V2 is now the default, the jsPDF code in V1 becomes dead code.
- **Do not delete V1 ReportClient yet** — keep it accessible via `?v1=1` for transition. But the jsPDF path is effectively deprecated.

### 3.6 Fix react-pdf templates for sparse data

**Files:** `src/lib/exports/pdf/templates/*.tsx`

| Template | Issue | Fix |
|---|---|---|
| `RemarkableAndArbitragePage.tsx` | When 0 claims AND 0 arbitrage regions, page is nearly empty | Show a fuller "pending analysis" message on the same page with methodology context and a note about what will appear when signals are extracted. Do NOT merge into Cover (changing page count is risky). |
| `ValuationPage.tsx` | When `specific_car_fair_value_mid === 0`, delta computation produces `NaN` or `Infinity` | Guard: if mid is null/0, show "Valuation pending" instead of the breakdown |
| `DueDiligencePage.tsx` | When 0 signals detected AND 0 missing, page shows only "No objective signals extracted yet" | Add the fallback questions from EXPECTED_SIGNAL_KEYS as default questions when no extraction has run |
| `ComparablesPage.tsx` | When 0 comparables AND 0 regions, page is nearly empty | Show "Comparable data is being collected for this model" with methodology link |

### 3.7 Fix Excel export to include V2 data

**Files:** `src/lib/exports/excel/sheets/*.ts`

The server-side Excel export already exists but needs to include the new intelligence layers:

| Sheet | Missing data | Fix |
|---|---|---|
| Summary | No color intel, VIN intel, narrative | Add rows for exterior color/rarity/PTS, VIN decoded info, narrative excerpt |
| Data & Sources | No color/VIN signals in signals list | Include color and VIN signals in the signals table |
| Assumptions | No color premium modifier | Add color_premium_percent as an editable assumption if applicable |

### 3.8 Ensure saveHausReport persists all intelligence fields

**File:** `src/lib/reports/queries.ts` — function `saveHausReport`

**Verify/fix** that the upsert includes:
- `color_intelligence_json` (the full ColorIntelligence object)
- `vin_intelligence_json` (the full VinIntelligence object)
- `investment_narrative_json` (the full InvestmentNarrative object)

If these columns don't exist in the DB yet, the save should use a defensive pattern (try-catch, ignore unknown column errors) similar to `saveReportMetadataV2`.

### 3.9 Fix D3 peer positioning default

**File:** `src/lib/marketIntel/aggregator.ts` — function `computeD3PeerPositioning`

**Current:** When `variantSoldPricesUsd` is empty, defaults `percentile = 50`. This is misleading.

**Fix:** Return `percentile: null` (change `MarketIntelD3.vin_percentile_within_variant` type from `number` to `number | null` in types.ts line 135).

**Impacted consumers:**
- `ComparablesAndPositioningBlock.tsx` line 135 — renders `{d3.vin_percentile_within_variant}th percentile` without null guard. Add: show "Not enough data" when null.
- `ComparablesPage.tsx` (PDF template) line 32 — same pattern. Add null guard.

### 3.10 Fix verdict when fair value is null/0

**Problem:** When `specific_car_fair_value_mid` is 0 or null, `deriveVerdict` returns `"WATCH"` — misleading. The Cover shows a WATCH verdict chip when there's no data to support any verdict.

**Fix:** Add a 4th verdict state `"PENDING"` for when fair value is null/0. This requires changes in **all locations** that derive or display the verdict:

| File | Function/Component | Change |
|---|---|---|
| `src/lib/exports/pdf/renderReport.tsx` | `deriveVerdict()` line 24 | Return `"PENDING"` when `fairMid === 0 \|\| fairMid == null` |
| `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx` | `deriveVerdict()` line 241 | Same |
| `src/components/report/VerdictBlock.tsx` | `VERDICT_STYLE` record + props type | Add `PENDING` style (neutral gray), update `VerdictBlockProps["verdict"]` union type |
| `src/lib/exports/pdf/templates/Cover.tsx` | `verdictColors()` usage | Ensure `verdictColors` handles `"PENDING"` (neutral gray border/text) |
| `src/lib/exports/pdf/styles.ts` | `verdictColors()` function | Add `"PENDING"` color mapping |
| `src/lib/exports/excel/sheets/summary.ts` | Verdict cell coloring | Handle `"PENDING"` with gray fill |

**Also update** `searchParams` type in `page.tsx` line 34 to include `v1?: string`:
```typescript
searchParams?: Promise<{ mock?: string; v2?: string; v1?: string }>
```

---

## 4. Data Flow (After Changes)

```
User opens /cars/porsche/{id}/report
        │
        ▼
  Server component (page.tsx)
        ├── fetchLiveListingById(id)
        ├── fetchPricedListingsForModel(make)
        ├── getExchangeRates()
        ├── computeMarketStatsForCar() → marketStats + regions
        ├── computeArbitrageForCar() → d2Precomputed
        ├── getComparablesForModel() → dbComparables
        ├── getReportForListing(id) → reportRow
        ├── fetchSignalsForListing(id) → signalRows
        └── assembleHausReportFromDB(reportRow, signalRows)
              │ NOW INCLUDES: color_intelligence,
              │ vin_intelligence, investment_narrative
              │
              ▼
        ReportClientV2 (DEFAULT)
              │
              ├── adaptV1ReportToV2()
              │     ├── computeD1Trajectory()
              │     ├── d2Precomputed (passed from server)
              │     ├── computeD3PeerPositioning()
              │     ├── computeD4Confidence()
              │     ├── generateRemarkable()
              │     └── spreads color_intel, vin_intel, narrative
              │
              └── Renders 14 blocks, ALL with data:
                    ├── ReportHeader
                    ├── MarketIntelPanel (D1 + D4)
                    ├── VerdictBlock (handles null fair value)
                    ├── InvestmentStoryBlock (narrative from DB)
                    ├── ColorIntelBlock (color intel from DB)
                    ├── VinIntelBlock (VIN intel from DB)
                    ├── SpecificCarFairValueBlock
                    ├── WhatsRemarkableBlock
                    ├── ValuationBreakdownBlock
                    ├── ArbitrageSignalBlock (D2)
                    ├── ComparablesAndPositioningBlock (D3)
                    ├── MarketContextBlock
                    ├── SignalsDetectedBlock
                    ├── QuestionsToAskBlock
                    ├── MethodologyLink
                    ├── ReportSourcesBlock
                    └── ReportMetadataFooter
```

---

## 5. Files Changed (Complete List)

| # | File | Change type | Description |
|---|---|---|---|
| 1 | `src/app/[locale]/cars/[make]/[id]/report/page.tsx` | Modify | V2 default, pass all props always |
| 2 | `src/lib/reports/queries.ts` | Modify | `assembleHausReportFromDB` reads color/VIN/narrative; fix null fallbacks |
| 3 | `src/lib/reports/queries.ts` | Modify | `saveHausReport` persists color/VIN/narrative defensively |
| 4 | `src/lib/fairValue/types.ts` | Modify | Fair value fields become `number | null`; D3 percentile becomes `number | null` |
| 5 | `src/lib/fairValue/adaptV1ToV2.ts` | Modify | Propagate color/VIN/narrative from v1Report |
| 6 | `src/lib/marketIntel/aggregator.ts` | Modify | D3 percentile returns null when no data |
| 7 | `src/app/api/analyze/route.ts` | Modify | Add structured logging throughout pipeline |
| 8 | `src/lib/exports/pdf/renderReport.tsx` | Modify | Handle null fair value, add PENDING verdict |
| 9 | `src/lib/exports/pdf/templates/Cover.tsx` | Modify | Handle null fair value display |
| 10 | `src/lib/exports/pdf/templates/ValuationPage.tsx` | Modify | Guard against null/0 mid value |
| 11 | `src/lib/exports/pdf/templates/RemarkableAndArbitragePage.tsx` | Modify | Handle empty state gracefully |
| 12 | `src/lib/exports/pdf/templates/DueDiligencePage.tsx` | Modify | Show default questions when no extraction |
| 13 | `src/lib/exports/pdf/templates/ComparablesPage.tsx` | Modify | Better empty state message |
| 14 | `src/components/report/VerdictBlock.tsx` | Modify | Handle null fair value |
| 15 | `src/components/report/SpecificCarFairValueBlock.tsx` | Modify | Handle null/0 values |
| 16 | `src/components/report/ComparablesAndPositioningBlock.tsx` | Modify | Handle null percentile |
| 17 | `src/lib/exports/excel/sheets/summary.ts` | Modify | Add color/VIN/narrative rows |
| 18 | `src/lib/exports/excel/sheets/dataAndSources.ts` | Modify | Include color/VIN signals |
| 19 | `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx` | Modify | Handle null fair values in helpers, PENDING verdict |
| 20 | `src/lib/exports/pdf/styles.ts` | Modify | Add PENDING to `verdictColors()` |
| 21 | `src/lib/exports/excel/sheets/assumptions.ts` | Modify | Add color_premium_percent if present in modifiers |

---

## 6. Success Criteria

1. Opening `/en/cars/porsche/{id}/report` renders V2 by default (no `?v2=1` needed)
2. A report generated via `/api/analyze` shows color intelligence, VIN intelligence, and investment narrative in the V2 UI after page reload
3. A listing with no report generated shows "Generate report" state, not $0K values
4. A listing with a report but null fair values shows "Pending" verdict, not WATCH with $0K
5. The server logs show a complete structured JSON for every report generation with step durations and signal counts
6. The react-pdf export produces a clean document with no near-empty pages
7. The Excel export includes color intel, VIN intel, and narrative data
8. D3 peer positioning shows "Not enough data" instead of a false "50th percentile" when no comparables exist
9. V1 remains accessible via `?v1=1` as fallback

---

## 7. What This Does NOT Change

- No new UI blocks invented (all 14 blocks already exist in V2)
- No new DB migrations required upfront — all reads and writes use defensive patterns (try-catch for missing columns with Postgres 42703 handling) so the code works whether or not `color_intelligence_json`, `vin_intelligence_json`, `investment_narrative_json` columns exist. If they don't exist yet, these fields will be null in the UI until the BE migration adds them.
- No pricing/payment changes
- No i18n work (tracked separately; ~85 strings remain hardcoded in English)
- No specialist agents or KB seeding (editorial work, parallel track)
- No new API routes
