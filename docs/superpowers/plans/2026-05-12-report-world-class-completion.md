# Haus Report World-Class Completion — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all V2 gaps — make V2 the default report, connect disconnected data pipelines (color/VIN/narrative), fix false fallbacks ($0K → null), add PENDING verdict, fix all PDF/Excel empty states, and add structured logging.

**Architecture:** Changes are application-layer only — no DB migrations. Defensive patterns (Postgres error code 42703) ensure reads/writes work whether intelligence columns exist or not. Changes flow: types → DB layer → adapter → UI/PDF/Excel.

**Tech Stack:** Next.js 16 (App Router), TypeScript, React, Supabase, react-pdf, ExcelJS, Vitest

**Spec:** `docs/superpowers/specs/2026-05-12-report-world-class-completion-design.md`

---

## File Structure

| # | File | Responsibility | Action |
|---|------|---------------|--------|
| 1 | `src/lib/fairValue/types.ts` | HausReport type, MarketIntelD3 type | Modify — fair value fields → `number \| null`, D3 percentile → `number \| null` |
| 2 | `src/lib/reports/queries.ts` | DB read/write for reports | Modify — `saveHausReport` adds intelligence fields; `assembleHausReportFromDB` reads them + fixes false fallbacks |
| 3 | `src/lib/marketIntel/aggregator.ts` | D3 peer positioning | Modify — return `null` percentile when no data |
| 4 | `src/lib/exports/pdf/renderReport.tsx` | PDF entry point, `deriveVerdict`, `composeOneLiner` | Modify — add PENDING verdict, null fair value handling |
| 5 | `src/lib/exports/pdf/styles.ts` | PDF color palette | Modify — add PENDING to `verdictColors()` |
| 6 | `src/lib/exports/pdf/templates/Cover.tsx` | PDF cover page | Modify — handle null fair values |
| 7 | `src/lib/exports/pdf/templates/ValuationPage.tsx` | PDF valuation breakdown | Modify — guard null/0 mid value |
| 8 | `src/lib/exports/pdf/templates/RemarkableAndArbitragePage.tsx` | PDF remarkable + arbitrage | Modify — better empty state |
| 9 | `src/lib/exports/pdf/templates/DueDiligencePage.tsx` | PDF due diligence | Modify — show default questions when no extraction |
| 10 | `src/lib/exports/pdf/templates/ComparablesPage.tsx` | PDF comparables + positioning | Modify — null percentile guard, better empty state |
| 11 | `src/components/report/VerdictBlock.tsx` | UI verdict chip | Modify — add PENDING style |
| 12 | `src/components/report/SpecificCarFairValueBlock.tsx` | UI fair value range | Modify — handle null/0 |
| 13 | `src/components/report/ComparablesAndPositioningBlock.tsx` | UI comparables | Modify — handle null percentile |
| 14 | `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx` | V2 client component | Modify — PENDING verdict, null fair value in helpers |
| 15 | `src/app/[locale]/cars/[make]/[id]/report/page.tsx` | Server page | Modify — V2 default, pass all props always |
| 16 | `src/lib/exports/excel/sheets/summary.ts` | Excel summary sheet | Modify — add intelligence rows, PENDING verdict color |
| 17 | `src/lib/exports/excel/sheets/dataAndSources.ts` | Excel data sheet | Modify — add color/VIN signals |
| 18 | `src/lib/exports/excel/sheets/assumptions.ts` | Excel assumptions sheet | Modify — add color_premium_percent |
| 19 | `src/app/api/analyze/route.ts` | Report generation API | Modify — add structured logging |
| T1 | `src/lib/fairValue/__tests__/nullFairValue.test.ts` | Test — null fair value handling | Create |
| T2 | `src/lib/marketIntel/__tests__/d3NullPercentile.test.ts` | Test — D3 null percentile | Create |
| T3 | `src/lib/reports/__tests__/assembleHausReport.test.ts` | Test — DB assembly with intelligence fields | Create |

---

## Chunk 1: Foundation — Types, D3, and Core Logic Tests

### Task 1: Update HausReport type — fair value fields become `number | null`

**Files:**
- Modify: `src/lib/fairValue/types.ts:78-81`

- [ ] **Step 1: Write the failing test for null fair values**

Create file `src/lib/fairValue/__tests__/nullFairValue.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import type { HausReport } from "../types"

describe("HausReport null fair value fields", () => {
  it("accepts null for specific_car_fair_value fields", () => {
    const partial: Pick<
      HausReport,
      "specific_car_fair_value_low" | "specific_car_fair_value_mid" | "specific_car_fair_value_high"
    > = {
      specific_car_fair_value_low: null,
      specific_car_fair_value_mid: null,
      specific_car_fair_value_high: null,
    }
    expect(partial.specific_car_fair_value_mid).toBeNull()
  })

  it("accepts null for fair_value_low and fair_value_high", () => {
    const partial: Pick<HausReport, "fair_value_low" | "fair_value_high"> = {
      fair_value_low: null,
      fair_value_high: null,
    }
    expect(partial.fair_value_low).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/fairValue/__tests__/nullFairValue.test.ts`
Expected: TypeScript compilation error — `null` not assignable to `number`

- [ ] **Step 3: Update HausReport type to accept null**

In `src/lib/fairValue/types.ts`, change lines 74-81:

```typescript
// Before
fair_value_low: number
fair_value_high: number
// ...
specific_car_fair_value_low: number
specific_car_fair_value_mid: number
specific_car_fair_value_high: number

// After
fair_value_low: number | null
fair_value_high: number | null
// ...
specific_car_fair_value_low: number | null
specific_car_fair_value_mid: number | null
specific_car_fair_value_high: number | null
```

Also change `comparable_layer_used` and `extraction_version`:
```typescript
// Before (line 82)
comparable_layer_used: ComparableLayer
// After
comparable_layer_used: ComparableLayer | null

// Before (line 93)
extraction_version: string
// After
extraction_version: string | null
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/fairValue/__tests__/nullFairValue.test.ts`
Expected: PASS

- [ ] **Step 5: Run tsc to find all consumers that need null guards**

Run: `npx tsc --noEmit 2>&1 | head -100`
Expected: Multiple type errors in files that consume these fields. **Write down every file:line so subsequent tasks can fix them.**

- [ ] **Step 6: Commit**

```bash
git add src/lib/fairValue/types.ts src/lib/fairValue/__tests__/nullFairValue.test.ts
git commit -m "feat(types): make HausReport fair value fields nullable for honest null handling"
```

---

### Task 2: Update MarketIntelD3 — percentile becomes `number | null`

**Files:**
- Modify: `src/lib/fairValue/types.ts:135`
- Modify: `src/lib/marketIntel/aggregator.ts:255-271`
- Create: `src/lib/marketIntel/__tests__/d3NullPercentile.test.ts`

- [ ] **Step 1: Write failing test for null percentile when no data**

Create file `src/lib/marketIntel/__tests__/d3NullPercentile.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { computeD3PeerPositioning } from "../aggregator"

describe("computeD3PeerPositioning", () => {
  it("returns null percentile when no variant sold prices exist", () => {
    const result = computeD3PeerPositioning({
      thisVinPriceUsd: 150_000,
      variantSoldPricesUsd: [],
      adjacentVariants: [],
    })
    expect(result.vin_percentile_within_variant).toBeNull()
    expect(result.variant_distribution_bins).toHaveLength(0)
  })

  it("returns computed percentile when data exists", () => {
    const result = computeD3PeerPositioning({
      thisVinPriceUsd: 120_000,
      variantSoldPricesUsd: [100_000, 110_000, 120_000, 130_000, 140_000],
      adjacentVariants: [],
    })
    // 3 out of 5 prices are ≤ 120k → 60th percentile
    expect(result.vin_percentile_within_variant).toBe(60)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/marketIntel/__tests__/d3NullPercentile.test.ts`
Expected: FAIL — percentile is 50 (not null) for empty array

- [ ] **Step 3: Update MarketIntelD3 type**

In `src/lib/fairValue/types.ts`, change line 135:

```typescript
// Before
vin_percentile_within_variant: number

// After
vin_percentile_within_variant: number | null
```

- [ ] **Step 4: Update computeD3PeerPositioning to return null**

In `src/lib/marketIntel/aggregator.ts`, change lines 257-259:

```typescript
// Before
const percentile =
  sorted.length === 0
    ? 50

// After
const percentile =
  sorted.length === 0
    ? null
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/marketIntel/__tests__/d3NullPercentile.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/fairValue/types.ts src/lib/marketIntel/aggregator.ts src/lib/marketIntel/__tests__/d3NullPercentile.test.ts
git commit -m "fix(d3): return null percentile when no comparables instead of false 50th"
```

---

### Task 3: Add PENDING verdict type

**Files:**
- Modify: `src/lib/exports/pdf/renderReport.tsx:24-30`
- Modify: `src/lib/exports/pdf/styles.ts:184-190`

- [ ] **Step 1: Update deriveVerdict in renderReport.tsx**

In `src/lib/exports/pdf/renderReport.tsx`, change lines 24-30:

```typescript
// Before
export function deriveVerdict(askingUsd: number, fairMid: number): "BUY" | "WATCH" | "WALK" {
  if (fairMid === 0) return "WATCH"

// After
export type Verdict = "BUY" | "WATCH" | "WALK" | "PENDING"

export function deriveVerdict(askingUsd: number, fairMid: number | null): Verdict {
  if (fairMid === 0 || fairMid == null) return "PENDING"
```

The rest of the function body remains the same (delta calculation, BUY/WALK/WATCH thresholds).

- [ ] **Step 2: Update composeOneLiner for null fair value**

In `src/lib/exports/pdf/renderReport.tsx`, change line 33:

```typescript
// Before
if (report.specific_car_fair_value_mid === 0) return "Fair value not yet computed"

// After
if (!report.specific_car_fair_value_mid) return "Fair value not yet computed"
```

- [ ] **Step 3: Add PENDING to verdictColors**

In `src/lib/exports/pdf/styles.ts`, change lines 184-190:

```typescript
// Before
export function verdictColors(verdict: "BUY" | "WATCH" | "WALK") {
  if (verdict === "BUY") return { color: colors.positive, borderColor: colors.positive }
  if (verdict === "WALK") return { color: colors.negative, borderColor: colors.negative }
  return { color: colors.warning, borderColor: colors.warning }
}

// After
export function verdictColors(verdict: "BUY" | "WATCH" | "WALK" | "PENDING") {
  if (verdict === "BUY") return { color: colors.positive, borderColor: colors.positive }
  if (verdict === "WALK") return { color: colors.negative, borderColor: colors.negative }
  if (verdict === "PENDING") return { color: PDF_COLORS.muted, borderColor: PDF_COLORS.muted }
  return { color: colors.warning, borderColor: colors.warning }
}
```

Note: `PDF_COLORS.muted` is `"#6B6365"` (Stone Dark) — the neutral muted gray in the brand palette (line 14 of styles.ts).

- [ ] **Step 4: Run tsc to verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -i "verdict\|renderReport\|styles" | head -20`
Expected: May show errors in Cover.tsx or other consumers — these are addressed in later tasks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/exports/pdf/renderReport.tsx src/lib/exports/pdf/styles.ts
git commit -m "feat(verdict): add PENDING state for null/0 fair values"
```

---

## Chunk 2: DB Round-Trip — Persist & Read Intelligence Fields

### Task 4: Fix saveHausReport to persist color/VIN/narrative

**Files:**
- Modify: `src/lib/reports/queries.ts:830-858`

- [ ] **Step 1: Add intelligence fields to saveHausReport upsert payload**

In `src/lib/reports/queries.ts`, the `saveHausReport` function at line 836. Add the three intelligence fields to the upsert object, **before** the closing `}` at line 853:

```typescript
      landed_cost_json: report.landed_cost,
      updated_at: new Date().toISOString(),
      // Intelligence layers (columns may not exist yet — handled by try-catch)
      color_intelligence_json: report.color_intelligence ?? null,
      vin_intelligence_json: report.vin_intelligence ?? null,
      investment_narrative_json: report.investment_narrative ?? null,
```

- [ ] **Step 2: Wrap the upsert in a defensive try-catch (42703 pattern)**

Refactor `saveHausReport` to use the same defensive pattern as `saveReportMetadataV2` (lines 55-88). If the upsert fails with `42703` (undefined column), retry without the three intelligence fields:

```typescript
export async function saveHausReport(
  listingId: string,
  report: Omit<HausReport, "listing_id">,
): Promise<void> {
  const supabase = getServiceClient()

  const basePayload = {
    listing_id: listingId,
    fair_value_low: report.fair_value_low,
    fair_value_high: report.fair_value_high,
    median_price: report.median_price,
    specific_car_fair_value_low: report.specific_car_fair_value_low,
    specific_car_fair_value_mid: report.specific_car_fair_value_mid,
    specific_car_fair_value_high: report.specific_car_fair_value_high,
    comparable_layer_used: report.comparable_layer_used,
    comparables_count: report.comparables_count,
    modifiers_applied_json: report.modifiers_applied,
    modifiers_total_percent: report.modifiers_total_percent,
    signals_extracted_at: report.signals_extracted_at,
    extraction_version: report.extraction_version,
    landed_cost_json: report.landed_cost,
    updated_at: new Date().toISOString(),
  }

  // Try with intelligence fields first
  const fullPayload = {
    ...basePayload,
    color_intelligence_json: report.color_intelligence ?? null,
    vin_intelligence_json: report.vin_intelligence ?? null,
    investment_narrative_json: report.investment_narrative ?? null,
  }

  const { error } = await supabase
    .from("listing_reports")
    .upsert(fullPayload, { onConflict: "listing_id" })

  if (error) {
    // 42703 = undefined column — intelligence columns not yet migrated
    if (
      error.code === "42703" ||
      /color_intelligence|vin_intelligence|investment_narrative/i.test(error.message ?? "")
    ) {
      console.warn("[saveHausReport] Intelligence columns not found, saving without them")
      const { error: retryError } = await supabase
        .from("listing_reports")
        .upsert(basePayload, { onConflict: "listing_id" })
      if (retryError) throw new Error(`saveHausReport retry failed: ${retryError.message}`)
      return
    }
    throw new Error(`saveHausReport failed: ${error.message}`)
  }
}
```

- [ ] **Step 3: Run tsc to verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep "queries" | head -10`
Expected: No new errors in queries.ts

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/queries.ts
git commit -m "fix(reports): persist color/VIN/narrative intelligence in saveHausReport"
```

---

### Task 5: Fix assembleHausReportFromDB — read intelligence + fix false fallbacks

**Files:**
- Modify: `src/lib/reports/queries.ts:899-946`
- Create: `src/lib/reports/__tests__/assembleHausReport.test.ts`

- [ ] **Step 1: Write failing tests for assembly**

Create file `src/lib/reports/__tests__/assembleHausReport.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { assembleHausReportFromDB } from "../queries"

const EMPTY_SIGNAL_ROWS: Parameters<typeof assembleHausReportFromDB>[1] = []

describe("assembleHausReportFromDB", () => {
  it("returns null for fair value fields when DB values are null", () => {
    const row = {
      listing_id: "test-123",
      fair_value_low: null,
      fair_value_high: null,
      median_price: 100_000,
      specific_car_fair_value_low: null,
      specific_car_fair_value_mid: null,
      specific_car_fair_value_high: null,
      comparable_layer_used: null,
      comparables_count: 0,
      modifiers_applied_json: [],
      modifiers_total_percent: 0,
      signals_extracted_at: null,
      extraction_version: null,
      landed_cost_json: null,
    }
    const result = assembleHausReportFromDB(row, EMPTY_SIGNAL_ROWS)

    expect(result.specific_car_fair_value_mid).toBeNull()
    expect(result.specific_car_fair_value_low).toBeNull()
    expect(result.specific_car_fair_value_high).toBeNull()
    expect(result.fair_value_low).toBeNull()
    expect(result.fair_value_high).toBeNull()
    expect(result.comparable_layer_used).toBeNull()
    expect(result.extraction_version).toBeNull()
  })

  it("reads color_intelligence_json from DB row", () => {
    const colorIntel = {
      exteriorColorName: "Guards Red",
      exteriorRarity: "standard",
      isPTS: false,
    }
    const row = {
      listing_id: "test-456",
      fair_value_low: 80_000,
      fair_value_high: 120_000,
      median_price: 100_000,
      specific_car_fair_value_low: 90_000,
      specific_car_fair_value_mid: 100_000,
      specific_car_fair_value_high: 110_000,
      comparable_layer_used: "strict",
      comparables_count: 5,
      modifiers_applied_json: [],
      modifiers_total_percent: 0,
      signals_extracted_at: "2026-05-12T00:00:00Z",
      extraction_version: "v2.0",
      landed_cost_json: null,
      color_intelligence_json: colorIntel,
      vin_intelligence_json: null,
      investment_narrative_json: null,
    }
    const result = assembleHausReportFromDB(row, EMPTY_SIGNAL_ROWS)

    expect(result.color_intelligence).toEqual(colorIntel)
    expect(result.vin_intelligence).toBeNull()
    expect(result.investment_narrative).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/assembleHausReport.test.ts`
Expected: FAIL — null fair values become 0, color_intelligence is undefined

- [ ] **Step 3: Fix assembleHausReportFromDB**

In `src/lib/reports/queries.ts`, replace the `assembleHausReportFromDB` function (lines 899-946):

```typescript
export function assembleHausReportFromDB(
  row: Record<string, unknown>,
  signalRows: ListingSignalRow[],
): HausReport {
  const detected: DetectedSignal[] = signalRows.map((r) => ({
    key: r.signal_key,
    name_i18n_key:
      r.signal_value_json?.name_i18n_key ?? `report.signals.${r.signal_key}`,
    value_display: r.signal_value_json?.value_display ?? "",
    evidence: {
      source_type: r.evidence_source_type as DetectedSignal["evidence"]["source_type"],
      source_ref: r.evidence_source_ref ?? "",
      raw_excerpt: r.evidence_raw_excerpt,
      confidence: r.evidence_confidence as DetectedSignal["evidence"]["confidence"],
    },
  }))

  const detectedKeys = new Set(detected.map((s) => s.key))
  const missing: MissingSignal[] = EXPECTED_SIGNAL_KEYS
    .filter((k) => !detectedKeys.has(k))
    .map((k) => ({
      key: k,
      name_i18n_key: `report.signals.${k}`,
      question_for_seller_i18n_key: `report.questions.${k}_question`,
    }))

  // Nullable numeric: return null when DB value is null/undefined, not 0
  const numOrNull = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v)

  // Non-nullable numeric: still use 0 fallback (for counts, percentages)
  const num = (v: unknown, fallback = 0) =>
    v === null || v === undefined ? fallback : Number(v)

  return {
    listing_id: String(row.listing_id ?? ""),
    fair_value_low: numOrNull(row.fair_value_low),
    fair_value_high: numOrNull(row.fair_value_high),
    median_price: num(row.median_price),
    specific_car_fair_value_low: numOrNull(row.specific_car_fair_value_low),
    specific_car_fair_value_mid: numOrNull(row.specific_car_fair_value_mid),
    specific_car_fair_value_high: numOrNull(row.specific_car_fair_value_high),
    comparable_layer_used: (row.comparable_layer_used ?? null) as HausReport["comparable_layer_used"],
    comparables_count: num(row.comparables_count),
    signals_detected: detected,
    signals_missing: missing,
    modifiers_applied: (row.modifiers_applied_json ?? []) as AppliedModifier[],
    modifiers_total_percent: num(row.modifiers_total_percent),
    signals_extracted_at: (row.signals_extracted_at as string | null) ?? null,
    extraction_version: (row.extraction_version as string | null) ?? null,
    landed_cost: (row.landed_cost_json ?? null) as HausReport["landed_cost"],
    // Intelligence layers (columns may not exist — defensive null)
    color_intelligence: (row.color_intelligence_json ?? null) as HausReport["color_intelligence"],
    vin_intelligence: (row.vin_intelligence_json ?? null) as HausReport["vin_intelligence"],
    investment_narrative: (row.investment_narrative_json ?? null) as HausReport["investment_narrative"],
  }
}
```

Key changes:
- `numOrNull` helper returns `null` instead of `0` for fair value fields
- `comparable_layer_used` defaults to `null` instead of `"strict"`
- `extraction_version` defaults to `null` instead of `"v1.0"`
- Added `color_intelligence`, `vin_intelligence`, `investment_narrative` from DB row

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/reports/__tests__/assembleHausReport.test.ts`
Expected: PASS

- [ ] **Step 5: Run existing fixture tests to check for regressions**

Run: `npx vitest run src/lib/fairValue/__fixtures__/fixtures.test.ts`
Expected: May fail if mock fixtures don't have null values — update fixtures if needed.

- [ ] **Step 6: Run full tsc to find cascading null errors**

Run: `npx tsc --noEmit 2>&1 | head -80`
Expected: Type errors in consumers of these fields. **Note every error — these are addressed in subsequent tasks.**

- [ ] **Step 7: Commit**

```bash
git add src/lib/reports/queries.ts src/lib/reports/__tests__/assembleHausReport.test.ts
git commit -m "fix(reports): read intelligence fields from DB, return null instead of false 0 for fair values"
```

---

## Chunk 3: Verdict & UI Block Updates

### Task 6: Update VerdictBlock component for PENDING

**Files:**
- Modify: `src/components/report/VerdictBlock.tsx:1-13`

- [ ] **Step 1: Update VerdictBlockProps type and VERDICT_STYLE**

In `src/components/report/VerdictBlock.tsx`:

Update the props type — change `verdict` union:
```typescript
// Before
verdict: "BUY" | "WATCH" | "WALK"

// After
verdict: "BUY" | "WATCH" | "WALK" | "PENDING"
```

Add PENDING to VERDICT_STYLE (after line 12):
```typescript
const VERDICT_STYLE: Record<string, string> = {
  BUY: "bg-positive/15 text-positive border-positive/30",
  WATCH: "bg-primary/15 text-primary dark:text-primary border-primary/30",
  WALK: "bg-destructive/15 text-destructive border-destructive/30",
  PENDING: "bg-muted/15 text-muted-foreground border-muted/30",
}
```

- [ ] **Step 2: Update prop types to accept null fair values**

Change `fairValueMidUsd` prop from `number` to `number | null` in the `VerdictBlockProps` interface. Then add a null guard where `fairValueMidUsd` is displayed (around line 59 where `fmtUsd(fairValueMidUsd)` is called):

```typescript
// Props type:
fairValueMidUsd: number | null

// Display guard — replace the fmtUsd(fairValueMidUsd) call:
{fairValueMidUsd != null ? fmtUsd(fairValueMidUsd) : "Awaiting analysis"}
```

- [ ] **Step 3: Run tsc to verify**

Run: `npx tsc --noEmit 2>&1 | grep "VerdictBlock" | head -5`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/report/VerdictBlock.tsx
git commit -m "feat(verdict): add PENDING style to VerdictBlock for null fair values"
```

---

### Task 7: Update ReportClientV2 — deriveVerdict + computeDelta for null

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx:241-257`

- [ ] **Step 1: Import Verdict type or define locally**

Import `Verdict` type from `renderReport.tsx` or define the same type locally:

```typescript
type Verdict = "BUY" | "WATCH" | "WALK" | "PENDING"
```

- [ ] **Step 2: Update deriveVerdict (lines 241-246)**

```typescript
// Before
function deriveVerdict(report: HausReportV2, askingUsd: number): "BUY" | "WATCH" | "WALK" {
  const delta = computeDelta(askingUsd, report.specific_car_fair_value_mid)
  if (delta <= -5) return "BUY"
  if (delta >= 10) return "WALK"
  return "WATCH"
}

// After
function deriveVerdict(report: HausReportV2, askingUsd: number): Verdict {
  if (!report.specific_car_fair_value_mid) return "PENDING"
  const delta = computeDelta(askingUsd, report.specific_car_fair_value_mid)
  if (delta <= -5) return "BUY"
  if (delta >= 10) return "WALK"
  return "WATCH"
}
```

- [ ] **Step 3: Update computeDelta (lines 254-257)**

```typescript
// Before
function computeDelta(askingUsd: number, fairMidUsd: number): number {
  if (!askingUsd || fairMidUsd === 0) return 0

// After
function computeDelta(askingUsd: number, fairMidUsd: number | null): number {
  if (!askingUsd || !fairMidUsd) return 0
```

- [ ] **Step 4: Run tsc to verify**

Run: `npx tsc --noEmit 2>&1 | grep "ReportClientV2" | head -10`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx
git commit -m "fix(report-v2): handle null fair values with PENDING verdict"
```

---

### Task 8: Fix SpecificCarFairValueBlock for null/0

**Files:**
- Modify: `src/components/report/SpecificCarFairValueBlock.tsx`

- [ ] **Step 1: Add null/0 guard at top of component**

Add an early return when fair value is null or 0:

```typescript
// At the top of the component, after props destructuring:
if (!fairValueMidUsd) {
  return (
    <div className="rounded-lg border border-dashed border-muted p-6 text-center text-muted-foreground">
      <p className="text-sm">Generate report to see specific-car fair value</p>
    </div>
  )
}
```

- [ ] **Step 2: Update prop types to accept null**

Update the props interface:
```typescript
fairValueLowUsd: number | null
fairValueMidUsd: number | null
fairValueHighUsd: number | null
comparableLayer: "strict" | "series" | "family" | null
```

- [ ] **Step 3: Update local fmtK to accept null**

The component has a local `fmtK` function (around line 36) that only accepts `number`. Update it to handle `null`:

```typescript
// Before
const fmtK = (v: number) => ...

// After
const fmtK = (v: number | null) => {
  if (v == null) return "—"
  // ... existing formatting logic
}
```

This ensures `fmtK(fairValueLowUsd)` and `fmtK(fairValueHighUsd)` at line 65 won't fail TypeScript after the early return guard for `fairValueMidUsd`.

- [ ] **Step 4: Guard comparableLayer display**

Where `comparableLayer` is displayed, add a null guard:
```typescript
// Show "unknown" when comparableLayer is null
{comparableLayer ?? "unknown"}
```

- [ ] **Step 5: Run tsc to verify**

Run: `npx tsc --noEmit 2>&1 | grep "SpecificCarFairValue" | head -5`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/report/SpecificCarFairValueBlock.tsx
git commit -m "fix(report): show pending state instead of \$0K in fair value block"
```

---

### Task 9: Fix ComparablesAndPositioningBlock for null percentile

**Files:**
- Modify: `src/components/report/ComparablesAndPositioningBlock.tsx:132-138`

- [ ] **Step 1: Add null guard for percentile display**

At line 135, add a null check:

```typescript
// Before
{d3.vin_percentile_within_variant}th percentile

// After
{d3.vin_percentile_within_variant != null
  ? `${d3.vin_percentile_within_variant}th percentile`
  : "Not enough data"}
```

- [ ] **Step 2: Run tsc to verify**

Run: `npx tsc --noEmit 2>&1 | grep "ComparablesAndPositioning" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/report/ComparablesAndPositioningBlock.tsx
git commit -m "fix(report): show 'Not enough data' instead of false 50th percentile"
```

---

## Chunk 4: Make V2 the Default Report

### Task 10: Switch V2 to default, V1 to fallback

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/page.tsx:33,204-225`

- [ ] **Step 1: Update searchParams type**

At line 33, add `v1` param:

```typescript
// Before
searchParams?: Promise<{ mock?: string; v2?: string }>

// After
searchParams?: Promise<{ mock?: string; v2?: string; v1?: string }>
```

- [ ] **Step 2: Invert the V2/V1 conditional**

At lines 204-225, swap the condition:

```tsx
// Before
{resolvedSearch.v2 === "1" ? <ReportClientV2 ... /> : <ReportClient ... />}

// After
{resolvedSearch.v1 === "1" ? <ReportClient ... /> : <ReportClientV2 ... />}
```

- [ ] **Step 3: Ensure all V2 props are always passed**

The V2 props (`d2Precomputed`, `reportTier`, `reportHash`, `reportVersion`) are currently only passed inside the `v2 === "1"` branch. Since V2 is now the default, these props must be passed unconditionally. Verify the data preparation code (lines 129-188) runs unconditionally — it does, since it's above the conditional render.

- [ ] **Step 4: Run tsc to verify**

Run: `npx tsc --noEmit 2>&1 | grep "page.tsx" | head -5`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/cars/[make]/[id]/report/page.tsx"
git commit -m "feat(report): make V2 the default experience, V1 accessible via ?v1=1"
```

---

## Chunk 5: PDF Template Fixes

### Task 11: Fix Cover.tsx for null fair values

**Files:**
- Modify: `src/lib/exports/pdf/templates/Cover.tsx:47-58`

- [ ] **Step 1: Update CoverProps.verdict type to include PENDING**

At line 10 of Cover.tsx, update the `verdict` prop type:

```typescript
// Before
verdict: "BUY" | "WATCH" | "WALK"

// After
verdict: "BUY" | "WATCH" | "WALK" | "PENDING"
```

- [ ] **Step 2: Guard fair value display**

The Cover shows a low–high range and mid value (lines 47-58). Wrap in a null check:

```tsx
{report.specific_car_fair_value_mid != null ? (
  <>
    <Text>{fmtK(report.specific_car_fair_value_low)} – {fmtK(report.specific_car_fair_value_high)}</Text>
    {/* ... existing mid value display ... */}
  </>
) : (
  <Text style={pdfStyles.bodyMuted}>Valuation pending</Text>
)}
```

Note: `fmtK()` in styles.ts already handles null (returns "—"), so the low/high calls are safe even without the wrapper. But the wrapper gives a cleaner UX when all three are null.

- [ ] **Step 3: Guard comparable_layer_used display**

At line 56, `{report.comparable_layer_used}` will render `null` as text when the field is null. Add a guard:

```tsx
// Before
{report.comparable_layer_used} layer

// After
{report.comparable_layer_used ?? "pending"} layer
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/exports/pdf/templates/Cover.tsx
git commit -m "fix(pdf): show 'Valuation pending' on Cover when fair value is null"
```

---

### Task 12: Fix ValuationPage.tsx for null/0 mid value

**Files:**
- Modify: `src/lib/exports/pdf/templates/ValuationPage.tsx:28`

- [ ] **Step 1: Guard against null/0 in delta computation**

At line 28:

```typescript
// Before
const delta = ((askingUsd - report.specific_car_fair_value_mid) / report.specific_car_fair_value_mid) * 100

// After
const hasFairValue = report.specific_car_fair_value_mid != null && report.specific_car_fair_value_mid > 0
const delta = hasFairValue
  ? ((askingUsd - report.specific_car_fair_value_mid!) / report.specific_car_fair_value_mid!) * 100
  : 0
```

- [ ] **Step 2: Add early return for pending state**

Wrap the main content in a guard:

```tsx
{!hasFairValue ? (
  <View style={{ padding: 20 }}>
    <Text style={styles.h2}>Valuation Breakdown</Text>
    <Text style={styles.bodyMuted}>
      Valuation pending — generate the report to see the full breakdown including
      baseline computation, modifiers, and specific-car fair value.
    </Text>
  </View>
) : (
  // ... existing valuation content ...
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/exports/pdf/templates/ValuationPage.tsx
git commit -m "fix(pdf): guard ValuationPage against null/0 fair value (prevents NaN/Infinity)"
```

---

### Task 13: Fix RemarkableAndArbitragePage.tsx empty state

**Files:**
- Modify: `src/lib/exports/pdf/templates/RemarkableAndArbitragePage.tsx`

- [ ] **Step 1: Improve the empty remarkable claims message**

When `claims.length === 0`, improve the messaging (around lines 28-33):

```tsx
// Before: "No remarkable findings…"
// After:
<Text style={pdfStyles.bodyMuted}>
  No remarkable findings extracted yet. Remarkable claims are sourced from
  structured signals, reference packs, and specialist agents. As more data
  is collected for this model, claims will appear here automatically.
</Text>
```

- [ ] **Step 2: Add fallback for empty arbitrage section**

The arbitrage section (line 47) is wrapped in `{d2.by_region.length > 0 && ...}`, so when there are zero regions nothing renders and the page is nearly empty. Add a fallback after the conditional block:

```tsx
{d2.by_region.length === 0 && (
  <View style={/* dashed card style */}>
    <Text style={pdfStyles.h2}>Cross-Border Opportunity</Text>
    <Text style={pdfStyles.bodyMuted}>
      Cross-border arbitrage data is being collected. As sold listings from
      multiple regions are captured, price differentials and landed cost
      estimates will appear here.
    </Text>
  </View>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/exports/pdf/templates/RemarkableAndArbitragePage.tsx
git commit -m "fix(pdf): improve empty state messaging for remarkable/arbitrage page"
```

---

### Task 14: Fix DueDiligencePage.tsx — show default questions when no extraction

**Files:**
- Modify: `src/lib/exports/pdf/templates/DueDiligencePage.tsx`

- [ ] **Step 1: Improve the no-signals empty state message**

When `signals.length === 0` (no extraction has run), the existing code at lines 74-78 shows "No objective signals extracted yet." Improve this message but do NOT add extra FALLBACK_QUESTION cards here — lines 80-93 already render `report.signals_missing` as questions (which includes ALL expected keys when nothing is detected):

```tsx
// Around lines 74-78, improve the message text only:
// Before: "No objective signals extracted yet"
// After:
<Text style={pdfStyles.bodyMuted}>
  No objective signals have been extracted yet. Generate the report to run
  structured signal extraction. The questions below are recommended based on
  standard due diligence for this vehicle category.
</Text>
```

This improved text contextualizes the fallback questions that already render from `report.signals_missing` at lines 80-93, so there is no duplication.

- [ ] **Step 2: Commit**

```bash
git add src/lib/exports/pdf/templates/DueDiligencePage.tsx
git commit -m "fix(pdf): show default due diligence questions when no signals extracted"
```

---

### Task 15: Fix ComparablesPage.tsx — null percentile + better empty state

**Files:**
- Modify: `src/lib/exports/pdf/templates/ComparablesPage.tsx:28-40,43-91`

- [ ] **Step 1: Add null guard for percentile display**

At lines 28-40:

```tsx
// Before
// "falls in the {vin_percentile_within_variant}th percentile"

// After
{d3.vin_percentile_within_variant != null
  ? `falls in the ${d3.vin_percentile_within_variant}th percentile`
  : "Not enough sold comparables to compute percentile position"}
```

- [ ] **Step 2: Improve empty comparables message**

When 0 comparables AND 0 regions:

```tsx
// Before: "No comparables available yet."
// After:
<Text style={styles.bodyMuted}>
  Comparable data is being collected for this model. As sold listings are
  captured across platforms, comparables will populate here automatically.
</Text>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/exports/pdf/templates/ComparablesPage.tsx
git commit -m "fix(pdf): null percentile guard + better empty state for comparables"
```

---

## Chunk 6: Excel Export Updates

### Task 16: Add color/VIN/narrative to Excel summary sheet

**Files:**
- Modify: `src/lib/exports/excel/sheets/summary.ts`

- [ ] **Step 1: Update buildSummarySheet function signature**

At line 18, update the `verdict` parameter type:

```typescript
// Before
verdict: "BUY" | "WATCH" | "WALK",

// After
verdict: "BUY" | "WATCH" | "WALK" | "PENDING",
```

- [ ] **Step 2: Add PENDING verdict color**

In the verdict coloring section (lines 111-117), the code uses a ternary chain (NOT a switch statement). Add PENDING:

```typescript
// Before (ternary at lines 111-116)
color: {
  argb:
    verdict === "BUY"
      ? "FF34D399"
      : verdict === "WALK"
        ? "FFFB923C"
        : "FFFBBF24",
}

// After
color: {
  argb:
    verdict === "BUY"
      ? "FF34D399"
      : verdict === "WALK"
        ? "FFFB923C"
        : verdict === "PENDING"
          ? "FF8B8386"
          : "FFFBBF24",
}
```

- [ ] **Step 3: Add null guards for put() calls with nullable fair values**

The `put()` function (line 39) accepts `string | number`. After Task 1 makes fair values nullable, several `put()` calls will fail TypeScript. Fix them:

```typescript
// Line 94 — fair value mid
put("Fair Value mid (USD)", report.specific_car_fair_value_mid ?? "Pending")

// Lines 95-100 — delta computation
const delta =
  report.specific_car_fair_value_mid == null || report.specific_car_fair_value_mid === 0
    ? 0
    : ((askingUsd - report.specific_car_fair_value_mid) /
        report.specific_car_fair_value_mid) *
      100

// Lines 122-124 — fair value range
put("Low (USD)", report.specific_car_fair_value_low ?? "Pending")
put("Mid (USD)", report.specific_car_fair_value_mid ?? "Pending")
put("High (USD)", report.specific_car_fair_value_high ?? "Pending")

// Line 126 — comparable layer
put("Comparable layer", report.comparable_layer_used ?? "unknown")

// Line 134 — extraction version
put("Extraction version", report.extraction_version ?? "—")
```

- [ ] **Step 4: Add intelligence rows after the Fair Value section**

After the fair value range rows (after line 126), add new sections using the existing `section()` and `put()` helpers:

```typescript
row++
section("Color Intelligence")
put("Exterior Color", report.color_intelligence?.exteriorColorName ?? "Not analyzed")
put("Rarity", report.color_intelligence?.exteriorRarity ?? "Unknown")
put("PTS", report.color_intelligence?.isPTS ? "Yes" : "No")

row++
section("VIN Intelligence")
put("VIN Decoded", report.vin_intelligence?.vinDecoded ? "Yes" : "No")
put("Plant", report.vin_intelligence?.plant ?? "Unknown")
put("Warnings", report.vin_intelligence?.warnings?.join(", ") || "None")

row++
section("Investment Narrative")
put("Narrative", report.investment_narrative?.story
  ? report.investment_narrative.story.substring(0, 200) + "…"
  : "Not generated")
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/exports/excel/sheets/summary.ts
git commit -m "feat(excel): add color/VIN/narrative intelligence rows to summary sheet"
```

---

### Task 17: Add color/VIN signals to dataAndSources sheet

**Files:**
- Modify: `src/lib/exports/excel/sheets/dataAndSources.ts`

- [ ] **Step 1: Add color and VIN signals to the signals table**

After the existing `signals_detected.forEach` loop (lines 113-122), add derived signals from intelligence layers. Use the same cell-assignment pattern as the existing loop:

```typescript
// After the existing signals_detected.forEach loop (line 122):
// Start index after the detected signals
let syntheticIdx = report.signals_detected.length + 1

// Color intelligence as synthetic signals
if (report.color_intelligence) {
  const ci = report.color_intelligence
  const colorSignals = [
    { key: "exterior_color", value: ci.exteriorColorName ?? "Unknown", source: "color_intelligence" },
    { key: "exterior_rarity", value: ci.exteriorRarity ?? "Unknown", source: "color_intelligence" },
    { key: "pts_status", value: ci.isPTS ? "Yes" : "No", source: "color_intelligence" },
  ]
  for (const s of colorSignals) {
    ws.getCell(row, 1).value = syntheticIdx++
    ws.getCell(row, 2).value = s.key
    ws.getCell(row, 3).value = s.value
    ws.getCell(row, 4).value = s.source
    ws.getCell(row, 5).value = "high"
    ws.getCell(row, 6).value = ""
    paintDataRow(ws, row)
    row++
  }
}

// VIN intelligence as synthetic signals
if (report.vin_intelligence) {
  const vi = report.vin_intelligence
  const vinSignals = [
    { key: "vin_decoded", value: vi.vinDecoded ? "Yes" : "No", source: "vin_intelligence" },
    { key: "vin_plant", value: vi.plant ?? "Unknown", source: "vin_intelligence" },
  ]
  if (vi.warnings?.length) {
    vinSignals.push({ key: "vin_warnings", value: vi.warnings.join("; "), source: "vin_intelligence" })
  }
  for (const s of vinSignals) {
    ws.getCell(row, 1).value = syntheticIdx++
    ws.getCell(row, 2).value = s.key
    ws.getCell(row, 3).value = s.value
    ws.getCell(row, 4).value = s.source
    ws.getCell(row, 5).value = "high"
    ws.getCell(row, 6).value = ""
    paintDataRow(ws, row)
    row++
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/exports/excel/sheets/dataAndSources.ts
git commit -m "feat(excel): include color/VIN intelligence as signals in data sheet"
```

---

### Task 18: Add color_premium_percent to assumptions sheet

**Files:**
- Modify: `src/lib/exports/excel/sheets/assumptions.ts`

- [ ] **Step 1: Add color premium modifier if present**

After the aggregate modifier row (around line 99), check for a color premium modifier in `report.modifiers_applied`:

```typescript
// After the aggregate modifier row:
const colorPremiumMod = report.modifiers_applied?.find(
  (m) => m.key === "color_premium" || m.signal_key === "paint_to_sample"
)
if (colorPremiumMod) {
  addNamedInput(
    ws, row++,
    "Color premium (%)",
    Number((colorPremiumMod.delta_percent / 100).toFixed(4)),
    "COLOR_PREMIUM_PCT",
    NUMBER_FMT.percent,
    "Color rarity premium applied. Can be overridden."
  )
}
```

Note: Match the `addNamedInput` function signature from line 99.

- [ ] **Step 2: Commit**

```bash
git add src/lib/exports/excel/sheets/assumptions.ts
git commit -m "feat(excel): add color premium modifier to assumptions sheet"
```

---

## Chunk 7: Structured Logging in /api/analyze

### Task 19: Add ReportGenerationLog to /api/analyze

**Files:**
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Define the ReportGenerationLog interface**

At the top of the file (after imports), add:

```typescript
interface ReportGenerationLog {
  listingId: string
  userId: string
  startedAt: string
  steps: Record<string, { durationMs: number; [key: string]: unknown }>
  totalDurationMs: number
  totalSignalsDetected: number
  totalSignalsMissing: number
  cached: boolean
  creditUsed: number
}
```

- [ ] **Step 2: Add timing helper**

```typescript
function timeStep<T>(fn: () => T | Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now()
  const resultOrPromise = fn()
  if (resultOrPromise instanceof Promise) {
    return resultOrPromise.then((result) => ({ result, durationMs: Date.now() - start }))
  }
  return Promise.resolve({ result: resultOrPromise, durationMs: Date.now() - start })
}
```

- [ ] **Step 3: Add pipelineStart timer and log object**

Early in the POST handler, before the cache check (around line 147), add:

```typescript
const pipelineStart = Date.now()
```

Then initialize the log object:

```typescript
const log: Partial<ReportGenerationLog> = {
  listingId: body.listingId,
  userId: authUser.id,
  startedAt: new Date().toISOString(),
  cached: false,
  steps: {},
}
```

- [ ] **Step 4: Wrap each pipeline step with timing**

For each major step in the pipeline (market data, structured signals, seller signal, text signals, color intel, VIN intel, modifiers, fair value, landed cost, narrative, persist), wrap with `timeStep` and record results:

// Example for market stats step:
const { result: marketStats, durationMs: marketStatsDuration } = await timeStep(
  () => computeMarketStatsForCar(...)
)
log.steps!.marketStats = { durationMs: marketStatsDuration, found: !!marketStats }

// ... repeat pattern for each step ...
```

- [ ] **Step 5: Add cache-hit logging**

At the cache-hit early return (around line 169):

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

- [ ] **Step 6: Add success logging at the end**

Before the response return:

```typescript
const totalDuration = Date.now() - pipelineStart
console.info("[analyze] Report generated:", JSON.stringify({
  ...log,
  totalDurationMs: totalDuration,
  totalSignalsDetected: report.signals_detected.length,
  totalSignalsMissing: report.signals_missing.length,
  creditUsed: alreadyGenerated ? 0 : 1,
}))
```

- [ ] **Step 7: Add failure logging in catch block**

In the catch block (around line 440):

```typescript
console.error("[analyze] Report generation failed:", JSON.stringify({
  ...log,
  totalDurationMs: Date.now() - pipelineStart,
  error: err instanceof Error ? err.message : String(err),
}))
```

- [ ] **Step 8: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat(analyze): add structured logging with step-by-step timings"
```

---

## Chunk 8: TypeScript Compilation & Final Verification

### Task 20: Fix all remaining TypeScript errors and verify

**Files:**
- All files modified in previous tasks

- [ ] **Step 1: Run full tsc**

Run: `npx tsc --noEmit 2>&1 | tee /tmp/tsc-errors.txt`
Expected: Zero errors. If errors remain, fix each one:

**Known guaranteed errors from type changes (fix if not already addressed by earlier tasks):**

| File | Line(s) | Issue | Fix |
|------|---------|-------|-----|
| `Cover.tsx` | 10 | `verdict` prop doesn't include `"PENDING"` | Update type union (Task 11) |
| `renderReport.tsx` | 42 | `deriveVerdict` return now includes `"PENDING"`, passed to Cover | Cover's prop type must accept it |
| `summary.ts` | 18 | `verdict` param doesn't include `"PENDING"` | Update type union (Task 16) |
| `summary.ts` | 94,122-124 | `put()` receives `number \| null` | Add `?? "Pending"` (Task 16) |
| `summary.ts` | 126 | `put()` receives `ComparableLayer \| null` | Add `?? "unknown"` (Task 16) |
| `summary.ts` | 134 | `put()` receives `string \| null` for extraction_version | Add `?? "—"` (Task 16) |

**Common error patterns:**
- `Type 'number | null' is not assignable to type 'number'` — add `?? 0` or `!` where safe, or update the consumer's type
- `Property 'PENDING' does not exist on type...` — update the type union
- Any `fmtK()` or `fmtUsd()` receiving `null` — `fmtK` in styles.ts already handles null (returns "—")

- [ ] **Step 2: Run all report-related tests**

Run: `npx vitest run src/lib/fairValue/ src/lib/reports/ src/lib/marketIntel/ src/components/report/`
Expected: All tests pass

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (or pre-existing failures only)

- [ ] **Step 4: Fix any test failures from type changes**

The fixture tests in `src/lib/fairValue/__fixtures__/fixtures.test.ts` may need updating if the mock JSON fixtures use `0` for fair values and the test asserts `number` behavior.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: resolve all TypeScript errors from nullable fair value migration"
```

---

## Post-Implementation Verification Checklist

After all tasks are complete, verify these success criteria from the spec:

1. [ ] Opening `/en/cars/porsche/{id}/report` renders V2 (no `?v2=1` needed)
2. [ ] `/en/cars/porsche/{id}/report?v1=1` renders V1 (fallback works)
3. [ ] A report with null fair values shows PENDING verdict (not WATCH with $0K)
4. [ ] A listing with no report shows "Generate report" (not $0K values)
5. [ ] After `/api/analyze`, color/VIN/narrative appear in V2 UI after page reload
6. [ ] Server logs show structured JSON with step durations for report generation
7. [ ] React-pdf export has no near-empty pages when data is sparse
8. [ ] Excel export includes color intel, VIN intel, and narrative rows
9. [ ] D3 percentile shows "Not enough data" when no comparables exist
10. [ ] `npx tsc --noEmit` produces zero errors
11. [ ] `npx vitest run` has no new test failures
