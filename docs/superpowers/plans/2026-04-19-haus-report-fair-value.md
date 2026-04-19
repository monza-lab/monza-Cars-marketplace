# Haus Report (Fair Value + Signal Extraction) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Haus Report — a paid, on-demand, per-VIN investment report that combines market comparables with objectively-extracted listing signals (service history, rare options, ownership, seller context) to produce a specific-car Fair Value with traceable evidence. Simultaneously remove all AAA/AA/A investment grade language from the free browsing experience.

**Architecture:** Two-tier. **Free view** runs on pre-computed market stats only (zero LLM per listing). **Haus Report** (paid) runs the extraction pipeline once per VIN and caches the result in `listing_reports` + new `listing_signals`. The pipeline is: deterministic parsers (structured fields + seller whitelist) + Gemini 2.5-flash structured extraction (description text) → modifier engine → adjusted Fair Value + evidence list + missing signals list.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres), Vitest, Tailwind, next-intl, framer-motion, lucide-react, `@google/generative-ai` (Gemini 2.5-flash).

**Spec:** `docs/superpowers/specs/2026-04-19-fair-value-signal-extraction-design.md`

**Branch:** `Front-monzaaa` (already checked out). All work commits to this branch unless user instructs otherwise.

**Reference memories:**
- Never take the easy path — extract objective signals, never punt to user input or market-average assumptions
- Always test Gemini prompts live before shipping (GEMINI_API_KEY already validated in `.env.local` with `gemini-2.5-flash`)

---

## File Structure

### New files (this plan creates)

```
producto/
├── src/lib/fairValue/
│   ├── types.ts                                    # HausReport, DetectedSignal, AppliedModifier, MissingSignal
│   ├── modifiers.ts                                # MODIFIER_LIBRARY constant (12 modifiers, citations, versions)
│   ├── engine.ts                                   # computeSpecificCarFairValue + applyModifiers
│   ├── engine.test.ts                              # unit tests for engine
│   ├── __fixtures__/
│   │   ├── 992-gt3-pts-mock.json                   # primary FE-dev fixture
│   │   └── 991-carrera-sparse-mock.json            # edge-case fixture (sparse data)
│   └── extractors/
│       ├── text.ts                                 # Gemini signal extraction wrapper
│       ├── text.test.ts                            # unit tests w/ mocked Gemini
│       ├── structured.ts                           # deterministic parsers (mileage, transmission, year, colors)
│       ├── structured.test.ts                      # unit tests
│       ├── seller.ts                               # seller tier whitelist lookup
│       └── seller.test.ts                          # unit tests
├── src/lib/ai/
│   ├── gemini.ts                                   # Gemini API client (replaces claude.ts for Haus Report)
│   └── __fixtures__/
│       ├── gemini-signals-992-gt3.json             # validated real Gemini output (regression ref)
│       ├── gemini-signals-991-carrera.json
│       └── gemini-signals-997-gt3rs.json
├── src/components/report/
│   ├── HausReportTeaser.tsx                        # subtle card shown on free detail page
│   ├── SignalsDetectedSection.tsx                  # "Signals Detected" list with evidence tooltips
│   ├── SignalsMissingSection.tsx                   # "Data we couldn't verify" list
│   ├── ModifiersAppliedList.tsx                    # modifier line items with citations
│   └── MarketDeltaPill.tsx                         # reusable "−8% vs median" pill (free view)
└── supabase/migrations/
    ├── 20260419_create_listing_signals.sql
    └── 20260419_extend_listing_reports_haus_report.sql
```

### Modified files (AAA removal + integration)

See Task table in Phase 3 for the exhaustive list. Briefly:
- `ReportClient.tsx` — major refactor to render `HausReport` shape
- `AnalysisReport.tsx` — remove `GRADE_STYLES`, keep structure
- `BrowseCard.tsx`, `CarFeedCard.tsx`, `ModelFeedCard.tsx`, `GenerationFeedCard.tsx` — remove grade badge/cell, replace with `MarketDeltaPill`
- `CarContextPanel.tsx`, `ModelContextPanel.tsx`, `BrandContextPanel.tsx` — remove Grade metric column
- Mobile variants (4 files)
- `FeaturedAuctionsSection.tsx` — grade badge → listing status badge
- `similarCars.ts`, `aggregation.ts` — remove grade weighting
- `types/analysis.ts`, `types/auction.ts`, `lib/curatedCars.ts`, `lib/featuredAuctions.ts`, `lib/dashboardCache.ts`, `lib/reports/types.ts` — remove grade types/fields
- `api/analyze/route.ts`, `api/auctions/[id]/route.ts`, `api/mock-auctions/route.ts` — drop grade
- `ai/prompts.ts` — split into `buildSignalExtractionPrompt` + `buildAnalysisPrompt` (no grade)
- `messages/{en,es,de,ja}.json` — i18n key deletions + rewrites + additions

---

## Phase 0 — Prerequisites & Fixture Ground Truth

Before writing any production code, lock down the data shape by building the fixture the FE will render against and the modifier library it will display. Everything after this depends on these being stable.

### Task 1: Create the `fairValue` module skeleton and core types

**Files:**
- Create: `src/lib/fairValue/types.ts`

- [ ] **Step 1: Create the directory and types file**

Write `src/lib/fairValue/types.ts`:

```typescript
// Public types for the Haus Report (paid) + Fair Value signal extraction pipeline.
// See docs/superpowers/specs/2026-04-19-fair-value-signal-extraction-design.md §8.1

export type SignalSourceType =
  | "listing_text"      // extracted by Gemini from description_text
  | "structured_field"  // deterministic parse of a listings.* column
  | "seller_context"    // derived from seller whitelist/rating
  | "external"          // cross-listing lookups (e.g., prior BaT sale of same VIN)

export type Confidence = "high" | "medium" | "low"

export interface SignalEvidence {
  source_type: SignalSourceType
  source_ref: string                // e.g., "description_text:char_244-311" or "listings.transmission"
  raw_excerpt: string | null        // exact text excerpt that produced the signal (null for structured_field)
  confidence: Confidence
}

export interface DetectedSignal {
  key: string                       // stable id, e.g., "paint_to_sample"
  name_i18n_key: string             // e.g., "report.signals.paint_to_sample"
  value_display: string             // human-readable, e.g., "Gulf Blue (PTS code Y5C)"
  evidence: SignalEvidence
}

export interface AppliedModifier {
  key: string                       // matches MODIFIER_LIBRARY key
  signal_key: string                // links to DetectedSignal.key
  delta_percent: number             // e.g., +10 or -3
  baseline_contribution_usd: number // absolute USD impact on baseline
  citation_url: string | null
  version: string                   // modifier library version, e.g., "v1.0"
}

export interface MissingSignal {
  key: string
  name_i18n_key: string                  // e.g., "report.signals.service_records"
  question_for_seller_i18n_key: string   // e.g., "report.questions.ask_for_service_records"
}

export type ComparableLayer = "strict" | "series" | "family"

export interface HausReport {
  // Existing market stats fields (from 2026-03-17 spec — unchanged)
  listing_id: string
  fair_value_low: number
  fair_value_high: number
  median_price: number

  // NEW (this spec): specific-car fair value after modifiers
  specific_car_fair_value_low: number
  specific_car_fair_value_mid: number
  specific_car_fair_value_high: number
  comparable_layer_used: ComparableLayer
  comparables_count: number

  // NEW: signal extraction results
  signals_detected: DetectedSignal[]
  signals_missing: MissingSignal[]
  modifiers_applied: AppliedModifier[]
  modifiers_total_percent: number   // sum of all deltas

  // NEW: meta
  signals_extracted_at: string | null  // ISO timestamp; null = signal extraction not yet run
  extraction_version: string           // e.g., "v1.0"
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `cd producto && npx tsc --noEmit`
Expected: No errors (module has no callers yet).

- [ ] **Step 3: Commit**

```bash
cd producto && git add src/lib/fairValue/types.ts && git commit -m "feat(haus-report): add core types for fair value signal extraction"
```

---

### Task 2: Build the Modifier Library (12 modifiers + citations)

**Files:**
- Create: `src/lib/fairValue/modifiers.ts`

- [ ] **Step 1: Write `modifiers.ts`**

```typescript
// Modifier Library v1.0 — each modifier adjusts the baseline comparables median.
// Capped ±15% individually, ±35% aggregate (see engine.ts).
// Citations are PUBLIC URLs only. Internal notes not acceptable for v1.
// See docs/superpowers/specs/2026-04-19-fair-value-signal-extraction-design.md §6

export const MODIFIER_LIBRARY_VERSION = "v1.0"

export type ModifierKey =
  | "mileage_delta"
  | "transmission_manual"
  | "year_within_generation"
  | "paint_to_sample"
  | "service_records_complete"
  | "low_previous_owners"
  | "original_paint"
  | "accident_disclosed"
  | "modifications_disclosed"
  | "documentation_provided"
  | "warranty_remaining"
  | "seller_tier_specialist"

export interface ModifierDefinition {
  key: ModifierKey
  name_i18n_key: string
  signal_key: string                  // which DetectedSignal.key triggers this modifier
  base_percent: number                // starting value; can be overridden by data-driven regression
  range: [min: number, max: number]   // clamp
  citation_url: string | null         // MUST be public URL; null = modifier is "data-driven, no citation needed"
  is_data_driven: boolean             // true = %'s come from comparable-set regression at runtime
  description_i18n_key: string
}

export const MODIFIER_LIBRARY: Record<ModifierKey, ModifierDefinition> = {
  mileage_delta: {
    key: "mileage_delta",
    name_i18n_key: "report.modifiers.mileage_delta.name",
    signal_key: "mileage",
    base_percent: 0,
    range: [-15, 15],
    citation_url: null,
    is_data_driven: true,
    description_i18n_key: "report.modifiers.mileage_delta.description",
  },
  transmission_manual: {
    key: "transmission_manual",
    name_i18n_key: "report.modifiers.transmission_manual.name",
    signal_key: "transmission",
    base_percent: 0,
    range: [-10, 15],
    citation_url: null,
    is_data_driven: true,
    description_i18n_key: "report.modifiers.transmission_manual.description",
  },
  year_within_generation: {
    key: "year_within_generation",
    name_i18n_key: "report.modifiers.year_within_generation.name",
    signal_key: "year",
    base_percent: 0,
    range: [-10, 10],
    citation_url: null,
    is_data_driven: true,
    description_i18n_key: "report.modifiers.year_within_generation.description",
  },
  paint_to_sample: {
    key: "paint_to_sample",
    name_i18n_key: "report.modifiers.paint_to_sample.name",
    signal_key: "paint_to_sample",
    base_percent: 10,
    range: [8, 12],
    citation_url: "https://www.hagerty.com/media/market-trends/porsche-paint-to-sample-values/",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.paint_to_sample.description",
  },
  service_records_complete: {
    key: "service_records_complete",
    name_i18n_key: "report.modifiers.service_records_complete.name",
    signal_key: "service_records",
    base_percent: 4,
    range: [3, 5],
    citation_url: "https://www.pca.org/panorama/technical-q-and-as-importance-service-records",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.service_records_complete.description",
  },
  low_previous_owners: {
    key: "low_previous_owners",
    name_i18n_key: "report.modifiers.low_previous_owners.name",
    signal_key: "previous_owners",
    base_percent: 3,
    range: [-3, 4],
    citation_url: "https://www.hagerty.com/media/buying-and-selling/ownership-history-matters/",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.low_previous_owners.description",
  },
  original_paint: {
    key: "original_paint",
    name_i18n_key: "report.modifiers.original_paint.name",
    signal_key: "original_paint",
    base_percent: 4,
    range: [3, 5],
    citation_url: "https://www.hagerty.com/media/buying-and-selling/originality-and-collector-cars/",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.original_paint.description",
  },
  accident_disclosed: {
    key: "accident_disclosed",
    name_i18n_key: "report.modifiers.accident_disclosed.name",
    signal_key: "accident_history",
    base_percent: -10,
    range: [-15, -5],
    citation_url: "https://www.hagerty.com/media/market-trends/accident-history-impact-on-value/",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.accident_disclosed.description",
  },
  modifications_disclosed: {
    key: "modifications_disclosed",
    name_i18n_key: "report.modifiers.modifications_disclosed.name",
    signal_key: "modifications",
    base_percent: -5,
    range: [-8, -2],
    citation_url: "https://www.pca.org/panorama/modifications-and-resale-value",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.modifications_disclosed.description",
  },
  documentation_provided: {
    key: "documentation_provided",
    name_i18n_key: "report.modifiers.documentation_provided.name",
    signal_key: "documentation",
    base_percent: 2,
    range: [1, 3],
    citation_url: "https://www.hagerty.com/media/buying-and-selling/documentation-adds-value/",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.documentation_provided.description",
  },
  warranty_remaining: {
    key: "warranty_remaining",
    name_i18n_key: "report.modifiers.warranty_remaining.name",
    signal_key: "warranty",
    base_percent: 3,
    range: [2, 4],
    citation_url: null,
    is_data_driven: false,
    description_i18n_key: "report.modifiers.warranty_remaining.description",
  },
  seller_tier_specialist: {
    key: "seller_tier_specialist",
    name_i18n_key: "report.modifiers.seller_tier_specialist.name",
    signal_key: "seller_tier",
    base_percent: 3,
    range: [2, 4],
    citation_url: null,
    is_data_driven: false,
    description_i18n_key: "report.modifiers.seller_tier_specialist.description",
  },
}

export const MODIFIER_AGGREGATE_CAP_PERCENT = 35
export const MODIFIER_INDIVIDUAL_CAP_PERCENT = 15
```

- [ ] **Step 2: Verify type-check passes**

Run: `cd producto && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd producto && git add src/lib/fairValue/modifiers.ts && git commit -m "feat(haus-report): add modifier library v1.0 with 12 modifiers and public citations"
```

**Note to implementer:** The two `citation_url: null` entries (`warranty_remaining`, `seller_tier_specialist`) are acceptable only because `is_data_driven: false` and we will either find a public citation before shipping OR leave those two modifiers disabled in v1 (see §14 decision: "if no public source, modifier is shelved"). **Add a TODO in the plan commit message reminding content team to source these two citations.** If not found by Phase 8, set those two modifiers to `base_percent: 0` in production (they effectively don't run).

---

### Task 3: Write the Fair Value Engine with unit tests (TDD)

**Files:**
- Create: `src/lib/fairValue/engine.ts`
- Test: `src/lib/fairValue/engine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/fairValue/engine.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { applyModifiers, computeSpecificCarFairValue } from "./engine"
import { MODIFIER_LIBRARY } from "./modifiers"
import type { DetectedSignal } from "./types"

function signal(key: string, valueDisplay = "test"): DetectedSignal {
  return {
    key,
    name_i18n_key: `test.${key}`,
    value_display: valueDisplay,
    evidence: {
      source_type: "listing_text",
      source_ref: `test:${key}`,
      raw_excerpt: null,
      confidence: "high",
    },
  }
}

describe("applyModifiers", () => {
  it("returns empty array when no signals match", () => {
    const result = applyModifiers({
      baselineUsd: 200000,
      signals: [],
    })
    expect(result.appliedModifiers).toEqual([])
    expect(result.totalPercent).toBe(0)
  })

  it("applies a single static modifier for paint_to_sample signal", () => {
    const result = applyModifiers({
      baselineUsd: 200000,
      signals: [signal("paint_to_sample", "Gulf Blue")],
    })
    expect(result.appliedModifiers).toHaveLength(1)
    expect(result.appliedModifiers[0].key).toBe("paint_to_sample")
    expect(result.appliedModifiers[0].delta_percent).toBe(10)
    expect(result.appliedModifiers[0].baseline_contribution_usd).toBe(20000)
    expect(result.totalPercent).toBe(10)
  })

  it("stacks multiple modifiers additively", () => {
    const result = applyModifiers({
      baselineUsd: 100000,
      signals: [
        signal("paint_to_sample"),           // +10
        signal("service_records"),            // +4
        signal("previous_owners", "1"),       // +3 (low)
      ],
    })
    expect(result.totalPercent).toBe(17)
    expect(result.appliedModifiers).toHaveLength(3)
  })

  it("caps aggregate at ±35% even when stacked modifiers exceed it", () => {
    // Force 6 positive modifiers that would sum to 40%+
    const result = applyModifiers({
      baselineUsd: 100000,
      signals: [
        signal("paint_to_sample"),           // +10
        signal("service_records"),            // +4
        signal("previous_owners"),            // +3
        signal("original_paint"),             // +4
        signal("documentation"),              // +2
        signal("warranty"),                   // +3
        signal("seller_tier"),                // +3 → total would be +29, under cap
      ],
    })
    // With this set total = +29, no cap triggered
    expect(result.totalPercent).toBe(29)
    expect(result.cappedAggregate).toBe(false)
  })

  it("caps aggregate at +35% when forced over", () => {
    // Inject a fake high-value signal to force cap
    const result = applyModifiers({
      baselineUsd: 100000,
      signals: [
        signal("paint_to_sample"),
        signal("service_records"),
        signal("previous_owners"),
        signal("original_paint"),
        signal("documentation"),
        signal("warranty"),
        signal("seller_tier"),
      ],
      _testBoostPercent: 20, // test hook: adds +20 to simulate an over-cap scenario
    })
    expect(result.totalPercent).toBe(35)
    expect(result.cappedAggregate).toBe(true)
  })

  it("ignores signals with no matching modifier", () => {
    const result = applyModifiers({
      baselineUsd: 100000,
      signals: [signal("unknown_signal")],
    })
    expect(result.appliedModifiers).toHaveLength(0)
    expect(result.totalPercent).toBe(0)
  })
})

describe("computeSpecificCarFairValue", () => {
  it("returns baseline unchanged when no modifiers apply", () => {
    const fv = computeSpecificCarFairValue({
      baselineUsd: 200000,
      totalPercent: 0,
    })
    expect(fv.mid).toBe(200000)
    expect(fv.low).toBe(Math.round(200000 * 0.93))
    expect(fv.high).toBe(Math.round(200000 * 1.07))
  })

  it("shifts mid by totalPercent then applies ±7% band", () => {
    const fv = computeSpecificCarFairValue({
      baselineUsd: 200000,
      totalPercent: 10,
    })
    expect(fv.mid).toBe(220000)
    expect(fv.low).toBe(Math.round(220000 * 0.93))
    expect(fv.high).toBe(Math.round(220000 * 1.07))
  })

  it("handles negative totalPercent (net negative modifiers)", () => {
    const fv = computeSpecificCarFairValue({
      baselineUsd: 200000,
      totalPercent: -12,
    })
    expect(fv.mid).toBe(176000)
  })
})
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd producto && npx vitest run src/lib/fairValue/engine.test.ts`
Expected: Test file fails to resolve `./engine` (module not found).

- [ ] **Step 3: Implement `engine.ts` to satisfy the tests**

Create `src/lib/fairValue/engine.ts`:

```typescript
import {
  MODIFIER_LIBRARY,
  MODIFIER_LIBRARY_VERSION,
  MODIFIER_AGGREGATE_CAP_PERCENT,
  type ModifierKey,
} from "./modifiers"
import type { AppliedModifier, DetectedSignal } from "./types"

// Map of signal_key → ModifierKey. If a signal's key appears here, the
// corresponding modifier fires with its base_percent.
const SIGNAL_TO_MODIFIER: Record<string, ModifierKey> = {
  mileage: "mileage_delta",
  transmission: "transmission_manual",
  year: "year_within_generation",
  paint_to_sample: "paint_to_sample",
  service_records: "service_records_complete",
  previous_owners: "low_previous_owners",
  original_paint: "original_paint",
  accident_history: "accident_disclosed",
  modifications: "modifications_disclosed",
  documentation: "documentation_provided",
  warranty: "warranty_remaining",
  seller_tier: "seller_tier_specialist",
}

export interface ApplyModifiersInput {
  baselineUsd: number
  signals: DetectedSignal[]
  /** test-only: pretend an extra modifier adds N% so we can exercise the cap */
  _testBoostPercent?: number
}

export interface ApplyModifiersResult {
  appliedModifiers: AppliedModifier[]
  totalPercent: number
  cappedAggregate: boolean
}

export function applyModifiers(input: ApplyModifiersInput): ApplyModifiersResult {
  const { baselineUsd, signals, _testBoostPercent = 0 } = input
  const applied: AppliedModifier[] = []
  let runningPercent = 0

  for (const signal of signals) {
    const modKey = SIGNAL_TO_MODIFIER[signal.key]
    if (!modKey) continue
    const mod = MODIFIER_LIBRARY[modKey]
    const delta = mod.base_percent
    if (delta === 0) continue
    applied.push({
      key: mod.key,
      signal_key: signal.key,
      delta_percent: delta,
      baseline_contribution_usd: Math.round(baselineUsd * (delta / 100)),
      citation_url: mod.citation_url,
      version: MODIFIER_LIBRARY_VERSION,
    })
    runningPercent += delta
  }

  runningPercent += _testBoostPercent

  const cap = MODIFIER_AGGREGATE_CAP_PERCENT
  const capped = Math.abs(runningPercent) > cap
  const totalPercent = capped ? Math.sign(runningPercent) * cap : runningPercent

  return { appliedModifiers: applied, totalPercent, cappedAggregate: capped }
}

export interface SpecificCarFairValue {
  low: number
  mid: number
  high: number
}

export function computeSpecificCarFairValue(input: {
  baselineUsd: number
  totalPercent: number
}): SpecificCarFairValue {
  const mid = Math.round(input.baselineUsd * (1 + input.totalPercent / 100))
  return {
    mid,
    low: Math.round(mid * 0.93),
    high: Math.round(mid * 1.07),
  }
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd producto && npx vitest run src/lib/fairValue/engine.test.ts`
Expected: All 8 tests pass.

- [ ] **Step 5: Commit**

```bash
cd producto && git add src/lib/fairValue/engine.ts src/lib/fairValue/engine.test.ts && git commit -m "feat(haus-report): fair value engine with modifier application and ±35% cap"
```

---

### Task 4: Create the primary mock fixture (992 GT3 PTS with rich signals)

**Files:**
- Create: `src/lib/fairValue/__fixtures__/992-gt3-pts-mock.json`

- [ ] **Step 1: Write the fixture**

Create `src/lib/fairValue/__fixtures__/992-gt3-pts-mock.json`:

```json
{
  "listing_id": "mock-992-gt3-pts-12345",
  "fair_value_low": 245000,
  "fair_value_high": 285000,
  "median_price": 265000,

  "specific_car_fair_value_low": 281000,
  "specific_car_fair_value_mid": 302000,
  "specific_car_fair_value_high": 323000,
  "comparable_layer_used": "strict",
  "comparables_count": 7,

  "signals_detected": [
    {
      "key": "paint_to_sample",
      "name_i18n_key": "report.signals.paint_to_sample",
      "value_display": "Gulf Blue (PTS code Y5C)",
      "evidence": {
        "source_type": "listing_text",
        "source_ref": "description_text:char_244-311",
        "raw_excerpt": "Finished in Paint-to-Sample Gulf Blue (code Y5C)",
        "confidence": "high"
      }
    },
    {
      "key": "transmission",
      "name_i18n_key": "report.signals.transmission_manual",
      "value_display": "6-speed manual",
      "evidence": {
        "source_type": "structured_field",
        "source_ref": "listings.transmission",
        "raw_excerpt": null,
        "confidence": "high"
      }
    },
    {
      "key": "service_records",
      "name_i18n_key": "report.signals.service_records",
      "value_display": "14 service stamps, last major service 2025",
      "evidence": {
        "source_type": "listing_text",
        "source_ref": "description_text:char_412-478",
        "raw_excerpt": "Complete service history with 14 stamps through 2025",
        "confidence": "high"
      }
    },
    {
      "key": "previous_owners",
      "name_i18n_key": "report.signals.previous_owners",
      "value_display": "1 previous owner",
      "evidence": {
        "source_type": "listing_text",
        "source_ref": "description_text:char_580-605",
        "raw_excerpt": "Sold by the original owner",
        "confidence": "high"
      }
    },
    {
      "key": "original_paint",
      "name_i18n_key": "report.signals.original_paint",
      "value_display": "Original paint, no repaint disclosed",
      "evidence": {
        "source_type": "listing_text",
        "source_ref": "description_text:char_712-760",
        "raw_excerpt": "All original paint, no accidents or repaints",
        "confidence": "high"
      }
    },
    {
      "key": "documentation",
      "name_i18n_key": "report.signals.documentation",
      "value_display": "Window sticker and PPI available",
      "evidence": {
        "source_type": "listing_text",
        "source_ref": "description_text:char_890-935",
        "raw_excerpt": "Window sticker included, recent PPI available",
        "confidence": "high"
      }
    },
    {
      "key": "seller_tier",
      "name_i18n_key": "report.signals.seller_tier_specialist",
      "value_display": "Porsche specialist (Canepa)",
      "evidence": {
        "source_type": "seller_context",
        "source_ref": "seller_whitelist",
        "raw_excerpt": null,
        "confidence": "high"
      }
    }
  ],

  "signals_missing": [
    {
      "key": "warranty",
      "name_i18n_key": "report.signals.warranty",
      "question_for_seller_i18n_key": "report.questions.remaining_factory_warranty"
    },
    {
      "key": "accident_history",
      "name_i18n_key": "report.signals.accident_history",
      "question_for_seller_i18n_key": "report.questions.accident_disclosure_in_writing"
    },
    {
      "key": "carfax",
      "name_i18n_key": "report.signals.carfax",
      "question_for_seller_i18n_key": "report.questions.share_carfax_report"
    }
  ],

  "modifiers_applied": [
    {
      "key": "paint_to_sample",
      "signal_key": "paint_to_sample",
      "delta_percent": 10,
      "baseline_contribution_usd": 26500,
      "citation_url": "https://www.hagerty.com/media/market-trends/porsche-paint-to-sample-values/",
      "version": "v1.0"
    },
    {
      "key": "service_records_complete",
      "signal_key": "service_records",
      "delta_percent": 4,
      "baseline_contribution_usd": 10600,
      "citation_url": "https://www.pca.org/panorama/technical-q-and-as-importance-service-records",
      "version": "v1.0"
    },
    {
      "key": "low_previous_owners",
      "signal_key": "previous_owners",
      "delta_percent": 3,
      "baseline_contribution_usd": 7950,
      "citation_url": "https://www.hagerty.com/media/buying-and-selling/ownership-history-matters/",
      "version": "v1.0"
    },
    {
      "key": "original_paint",
      "signal_key": "original_paint",
      "delta_percent": 4,
      "baseline_contribution_usd": 10600,
      "citation_url": "https://www.hagerty.com/media/buying-and-selling/originality-and-collector-cars/",
      "version": "v1.0"
    },
    {
      "key": "documentation_provided",
      "signal_key": "documentation",
      "delta_percent": 2,
      "baseline_contribution_usd": 5300,
      "citation_url": "https://www.hagerty.com/media/buying-and-selling/documentation-adds-value/",
      "version": "v1.0"
    },
    {
      "key": "seller_tier_specialist",
      "signal_key": "seller_tier",
      "delta_percent": 3,
      "baseline_contribution_usd": 7950,
      "citation_url": null,
      "version": "v1.0"
    }
  ],
  "modifiers_total_percent": 14,

  "signals_extracted_at": "2026-04-19T12:00:00.000Z",
  "extraction_version": "v1.0"
}
```

- [ ] **Step 2: Validate it parses against the type**

Create `src/lib/fairValue/__fixtures__/fixtures.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import type { HausReport } from "../types"
import mock from "./992-gt3-pts-mock.json"

describe("992-gt3-pts-mock fixture", () => {
  it("conforms to HausReport shape", () => {
    const r: HausReport = mock as HausReport
    expect(r.listing_id).toBeTruthy()
    expect(r.specific_car_fair_value_mid).toBeGreaterThan(r.specific_car_fair_value_low)
    expect(r.specific_car_fair_value_high).toBeGreaterThan(r.specific_car_fair_value_mid)
    expect(r.signals_detected.length).toBeGreaterThan(0)
    expect(r.modifiers_applied.length).toBeGreaterThan(0)
    expect(r.extraction_version).toBe("v1.0")
  })

  it("specific fair value mid equals baseline × (1 + totalPercent/100) within ±1", () => {
    const r: HausReport = mock as HausReport
    const expectedMid = Math.round(r.median_price * (1 + r.modifiers_total_percent / 100))
    expect(Math.abs(r.specific_car_fair_value_mid - expectedMid)).toBeLessThan(Math.round(r.median_price * 0.02))
  })
})
```

- [ ] **Step 3: Run the fixture test**

Run: `cd producto && npx vitest run src/lib/fairValue/__fixtures__/fixtures.test.ts`
Expected: Both tests pass.

- [ ] **Step 4: Commit**

```bash
cd producto && git add src/lib/fairValue/__fixtures__/ && git commit -m "feat(haus-report): add 992 GT3 PTS mock fixture with rich signals"
```

---

### Task 5: Create the sparse fixture (991 Carrera, minimal signals — edge case)

**Files:**
- Create: `src/lib/fairValue/__fixtures__/991-carrera-sparse-mock.json`

- [ ] **Step 1: Write the sparse fixture**

Create `src/lib/fairValue/__fixtures__/991-carrera-sparse-mock.json`:

```json
{
  "listing_id": "mock-991-carrera-sparse-67890",
  "fair_value_low": 58000,
  "fair_value_high": 72000,
  "median_price": 65000,

  "specific_car_fair_value_low": 60450,
  "specific_car_fair_value_mid": 65000,
  "specific_car_fair_value_high": 69550,
  "comparable_layer_used": "series",
  "comparables_count": 14,

  "signals_detected": [
    {
      "key": "transmission",
      "name_i18n_key": "report.signals.transmission_pdk",
      "value_display": "PDK (automatic)",
      "evidence": {
        "source_type": "structured_field",
        "source_ref": "listings.transmission",
        "raw_excerpt": null,
        "confidence": "high"
      }
    }
  ],

  "signals_missing": [
    {
      "key": "paint_to_sample",
      "name_i18n_key": "report.signals.paint_to_sample",
      "question_for_seller_i18n_key": "report.questions.is_paint_factory_or_pts"
    },
    {
      "key": "service_records",
      "name_i18n_key": "report.signals.service_records",
      "question_for_seller_i18n_key": "report.questions.ask_for_service_records"
    },
    {
      "key": "previous_owners",
      "name_i18n_key": "report.signals.previous_owners",
      "question_for_seller_i18n_key": "report.questions.how_many_previous_owners"
    },
    {
      "key": "original_paint",
      "name_i18n_key": "report.signals.original_paint",
      "question_for_seller_i18n_key": "report.questions.confirm_original_paint"
    },
    {
      "key": "accident_history",
      "name_i18n_key": "report.signals.accident_history",
      "question_for_seller_i18n_key": "report.questions.accident_disclosure_in_writing"
    }
  ],

  "modifiers_applied": [],
  "modifiers_total_percent": 0,

  "signals_extracted_at": "2026-04-19T12:00:00.000Z",
  "extraction_version": "v1.0"
}
```

- [ ] **Step 2: Extend the fixture test to cover the sparse case**

Modify `src/lib/fairValue/__fixtures__/fixtures.test.ts` — add this block at the end:

```typescript
import sparse from "./991-carrera-sparse-mock.json"

describe("991-carrera-sparse-mock fixture", () => {
  it("conforms to HausReport shape", () => {
    const r: HausReport = sparse as HausReport
    expect(r.listing_id).toBeTruthy()
    expect(r.modifiers_applied).toHaveLength(0)
    expect(r.modifiers_total_percent).toBe(0)
    expect(r.signals_missing.length).toBeGreaterThan(r.signals_detected.length)
  })

  it("specific fair value mid equals median_price when no modifiers applied", () => {
    const r: HausReport = sparse as HausReport
    expect(r.specific_car_fair_value_mid).toBe(r.median_price)
  })
})
```

- [ ] **Step 3: Run fixture tests**

Run: `cd producto && npx vitest run src/lib/fairValue/__fixtures__/fixtures.test.ts`
Expected: 4 tests pass (2 per fixture).

- [ ] **Step 4: Commit**

```bash
cd producto && git add src/lib/fairValue/__fixtures__/ && git commit -m "feat(haus-report): add sparse 991 Carrera fixture for edge-case UI testing"
```

---

## Phase 1 — AAA Removal (Cross-Cutting Cleanup)

Before building new UI, remove every trace of AAA/AA/A/B+/B/C investment grade from the codebase. This is mechanical but must be exhaustive. Each task below groups related file changes.

### Task 6: Remove grade from shared types and data pipeline (non-UI)

**Files:**
- Modify: `src/types/analysis.ts`
- Modify: `src/types/auction.ts`
- Modify: `src/lib/curatedCars.ts`
- Modify: `src/lib/featuredAuctions.ts`
- Modify: `src/lib/dashboardCache.ts`
- Modify: `src/lib/reports/types.ts`

- [ ] **Step 1: Edit `src/types/analysis.ts`**

Delete line: `export type InvestmentGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'SPECULATIVE';`
Delete line: `investmentGrade?: InvestmentGrade | null;` (inside `Analysis` interface)
Delete the `grade: InvestmentGrade;` line nested inside `AIAnalysisResponse.investmentOutlook`.

- [ ] **Step 2: Edit `src/types/auction.ts`**

Delete line: `export type InvestmentGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'SPECULATIVE';`
Delete line: `investmentGrade?: InvestmentGrade | null;` inside the `Analysis` interface.

- [ ] **Step 3: Edit `src/lib/curatedCars.ts`**

Delete the `InvestmentGrade` type alias (line 6).
Delete the `investmentGrade: InvestmentGrade;` field from the `CollectorCar` interface (line 35).
Delete `export function getTopPicks()` and `export function getCarsByGrade()` entirely.

- [ ] **Step 4: Edit `src/lib/featuredAuctions.ts`**

Delete the `investmentGrade: "AAA" | "AA" | "A" | "B"` field from the `FeaturedAuction` interface (line 29).
Remove the `investmentGrade:` line from **every** hardcoded entry in the `FEATURED_AUCTIONS` array (lines 63, 96, 129, and any others).

- [ ] **Step 5: Edit `src/lib/dashboardCache.ts`**

In the `DashboardAuction.analysis` type (around line 70), delete the line: `investmentGrade: string | null;`
In the `transformCar` function (around line 142), delete the `investmentGrade: car.investmentGrade,` line in the projection.

- [ ] **Step 6: Edit `src/lib/reports/types.ts`**

In the TS type that mirrors the `listing_reports` row (around line 54), delete: `investment_grade: string | null`

**Important:** do NOT drop the DB column itself. Per spec §14, legacy rows keep their value; we only stop writing and stop reading. A future migration will drop the column once legacy reports are purged.

- [ ] **Step 7: Verify type-check (expect many errors — they're consumers we will fix next)**

Run: `cd producto && npx tsc --noEmit 2>&1 | grep -c "investmentGrade\|InvestmentGrade"`
Note the count. We will drive it to 0 in the following tasks.

- [ ] **Step 8: Commit**

```bash
cd producto && git add src/types/ src/lib/curatedCars.ts src/lib/featuredAuctions.ts src/lib/dashboardCache.ts src/lib/reports/types.ts && git commit -m "refactor(haus-report): remove investmentGrade from shared types and data layer"
```

---

### Task 7: Remove grade weighting from similar-cars and dashboard aggregation algorithms

**Files:**
- Modify: `src/lib/similarCars.ts`
- Modify: `src/components/dashboard/utils/aggregation.ts`
- Test: existing tests must continue to pass

- [ ] **Step 1: Edit `src/lib/similarCars.ts`**

Delete lines 12-21 (the `GRADE_ORDER` constant and `gradeDistance` function entirely).

In the scoring block (around lines 82-89), delete the entire "Investment grade match" section. Redistribute the 15 points as follows:
- Add +8 points if `Math.abs(candidate.priceUsd - target.priceUsd) / target.priceUsd <= 0.15` (price-band match, new)
- Add +4 points to the existing family match (whatever produced +7 now becomes +11)
- Add +3 points to the existing mileage match (whatever produced +5 now becomes +8)

Write the price-band block directly where the grade block used to be:

```typescript
// Price band match (replaces prior investment grade match)
if (target.priceUsd && candidate.priceUsd) {
  const delta = Math.abs(candidate.priceUsd - target.priceUsd) / target.priceUsd
  if (delta <= 0.15) {
    score += 8
    reasons.push("similar price range")
  }
}
```

(If the existing `similarCars.ts` uses different field names for price, adapt to the actual field — but the match must be price-based.)

- [ ] **Step 2: Edit `src/components/dashboard/utils/aggregation.ts`**

Delete the `GRADE_SCORE` constant and the `computeWeightedGrade` function entirely (lines 51-87 per audit).

Anywhere the result of `computeWeightedGrade(cars)` was assigned to `topGrade`, delete that line + delete the `topGrade` field from the resulting aggregate object.

In the aggregate return type (search for `topGrade: string`), remove that field.

- [ ] **Step 3: Run unit tests to catch type / call-site breakage**

Run: `cd producto && npx tsc --noEmit 2>&1 | head -50`
Run: `cd producto && npx vitest run src/lib/ src/components/dashboard/`

Expected: tests may show type errors where UI components still read `topGrade` or `investmentGrade`. Do NOT fix those here — they will be fixed in the UI removal tasks that follow.

- [ ] **Step 4: Commit**

```bash
cd producto && git add src/lib/similarCars.ts src/components/dashboard/utils/aggregation.ts && git commit -m "refactor(haus-report): remove grade weighting from similar-cars and brand aggregation"
```

---

### Task 8: Build the reusable `MarketDeltaPill` component (replacement for grade badges)

**Files:**
- Create: `src/components/report/MarketDeltaPill.tsx`
- Test: `src/components/report/MarketDeltaPill.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/report/MarketDeltaPill.test.tsx`:

```typescript
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MarketDeltaPill } from "./MarketDeltaPill"

describe("MarketDeltaPill", () => {
  it("renders null when median is missing", () => {
    const { container } = render(<MarketDeltaPill priceUsd={100000} medianUsd={null} />)
    expect(container.firstChild).toBeNull()
  })

  it("shows 'at median' when within ±2%", () => {
    render(<MarketDeltaPill priceUsd={101000} medianUsd={100000} />)
    expect(screen.getByText(/at median/i)).toBeInTheDocument()
  })

  it("shows negative percentage when below median", () => {
    render(<MarketDeltaPill priceUsd={92000} medianUsd={100000} />)
    expect(screen.getByText(/-8%/)).toBeInTheDocument()
  })

  it("shows positive percentage when above median", () => {
    render(<MarketDeltaPill priceUsd={110000} medianUsd={100000} />)
    expect(screen.getByText(/\+10%/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify FAIL**

Run: `cd producto && npx vitest run src/components/report/MarketDeltaPill.test.tsx`
Expected: Module not found.

- [ ] **Step 3: Implement `MarketDeltaPill.tsx`**

```tsx
// src/components/report/MarketDeltaPill.tsx
interface MarketDeltaPillProps {
  priceUsd: number | null | undefined
  medianUsd: number | null | undefined
  className?: string
}

export function MarketDeltaPill({ priceUsd, medianUsd, className }: MarketDeltaPillProps) {
  if (!priceUsd || !medianUsd || medianUsd <= 0) return null

  const deltaPct = ((priceUsd - medianUsd) / medianUsd) * 100
  const rounded = Math.round(deltaPct)

  if (Math.abs(rounded) <= 2) {
    return (
      <span
        className={`inline-flex items-center rounded-full backdrop-blur-md bg-foreground/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ${className ?? ""}`}
      >
        at median
      </span>
    )
  }

  const isBelow = rounded < 0
  const toneClass = isBelow
    ? "bg-positive/20 text-positive"
    : "bg-amber-500/15 text-amber-600 dark:text-amber-300"

  return (
    <span
      className={`inline-flex items-center rounded-full backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold ${toneClass} ${className ?? ""}`}
    >
      {isBelow ? "" : "+"}
      {rounded}%
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify PASS**

Run: `cd producto && npx vitest run src/components/report/MarketDeltaPill.test.tsx`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd producto && git add src/components/report/MarketDeltaPill.tsx src/components/report/MarketDeltaPill.test.tsx && git commit -m "feat(haus-report): add MarketDeltaPill for subtle free-view price positioning"
```

---

### Task 9: Replace grade badges in feed cards and browse card

**Files:**
- Modify: `src/components/browse/BrowseCard.tsx`
- Modify: `src/components/makePage/CarFeedCard.tsx`
- Modify: `src/components/makePage/ModelFeedCard.tsx`
- Modify: `src/components/makePage/GenerationFeedCard.tsx`

- [ ] **Step 1: Edit `BrowseCard.tsx`**

Delete line 73 (`const grade = car.analysis?.investmentGrade ?? null;`).
Delete the block at lines 105-109 (the grade pill with backdrop-blur).
Replace that pill's position (top-right overlay) with:

```tsx
<MarketDeltaPill priceUsd={car.priceUsd} medianUsd={car.analysis?.medianPriceUsd} />
```

Add at the top: `import { MarketDeltaPill } from "@/components/report/MarketDeltaPill"`.

If `car.priceUsd` or `car.analysis.medianPriceUsd` doesn't exist in the `DashboardAuction` type, adapt to the fields that do expose those values. If median is unavailable, the pill will return `null` — safe.

- [ ] **Step 2: Edit `CarFeedCard.tsx`**

Delete line 20 (`const grade = car.investmentGrade`).
Delete the badge block at lines 49-60 (the three-branch ternary on `grade`).
Replace with:

```tsx
<MarketDeltaPill priceUsd={car.priceUsd} medianUsd={car.medianPriceUsd} className="text-[10px] font-bold tracking-[0.1em]" />
```

Delete the entire stats grid cell at lines 124-136 (the Grade cell with `Shield` icon). Adjust the grid template columns to drop to 3 columns (from 4), or leave the other cells to expand.

Remove the `Shield` import if no longer used; remove the `t("sidebar.grade")` call.

- [ ] **Step 3: Edit `ModelFeedCard.tsx`**

Same pattern as CarFeedCard:
- Delete the grade destructure (`const grade = model.representativeCar.investmentGrade`)
- Replace the top-left badge with `<MarketDeltaPill priceUsd={...} medianUsd={...} />`
- Delete the grade stats cell (lines 104-115) and the `Shield` icon reference
- Remove unused imports

- [ ] **Step 4: Edit `GenerationFeedCard.tsx`**

Same pattern:
- Delete `topGrade: string` from the GenerationAggregate type
- Replace the top-left badge (lines 53-63) with MarketDeltaPill sourced from the aggregate's median
- Delete the grade stats cell (lines 107-118)
- If the aggregate doesn't have a clean `medianPriceUsd`, use whatever field is equivalent (added in Task 7's aggregation cleanup)

- [ ] **Step 5: Type-check the 4 files**

Run: `cd producto && npx tsc --noEmit 2>&1 | grep -E "BrowseCard|CarFeedCard|ModelFeedCard|GenerationFeedCard"`
Expected: zero errors in these files.

- [ ] **Step 6: Commit**

```bash
cd producto && git add src/components/browse/ src/components/makePage/CarFeedCard.tsx src/components/makePage/ModelFeedCard.tsx src/components/makePage/GenerationFeedCard.tsx && git commit -m "refactor(haus-report): replace grade badges with MarketDeltaPill in feed and browse cards"
```

---

### Task 10: Clean up mobile cards and hero variants

**Files:**
- Modify: `src/components/makePage/mobile/MobileHeroModel.tsx`
- Modify: `src/components/makePage/mobile/MobileModelRow.tsx`
- Modify: `src/components/dashboard/mobile/MobileHeroBrand.tsx`
- Modify: `src/components/dashboard/mobile/MobileBrandRow.tsx`

- [ ] **Step 1: Edit each mobile hero** (`MobileHeroModel.tsx`, `MobileHeroBrand.tsx`)

Delete the top-corner grade badge block entirely (lines 42-49 in Hero Model, lines 36-47 in Hero Brand). Replace with `<MarketDeltaPill />` using the respective median. Add the import.

- [ ] **Step 2: Edit each mobile row** (`MobileModelRow.tsx`, `MobileBrandRow.tsx`)

Delete the end-aligned grade letter span (line 83 in ModelRow, lines 54-63 in BrandRow). Do NOT replace — mobile rows should stay compact. The median price (already present in the row) is enough context.

- [ ] **Step 3: Type-check**

Run: `cd producto && npx tsc --noEmit 2>&1 | grep mobile`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd producto && git add src/components/makePage/mobile/ src/components/dashboard/mobile/ && git commit -m "refactor(haus-report): remove grade from mobile hero and row variants"
```

---

### Task 11: Clean up context panels (right-column sidebars)

**Files:**
- Modify: `src/components/makePage/context/CarContextPanel.tsx`
- Modify: `src/components/makePage/context/ModelContextPanel.tsx`
- Modify: `src/components/makePage/context/GenerationContextPanel.tsx`
- Modify: `src/components/dashboard/context/BrandContextPanel.tsx`

- [ ] **Step 1: Edit `CarContextPanel.tsx`**

Delete line 32 (`const grade = car.investmentGrade`).
In the Key Metrics 3-column grid (lines 65-75), delete the first column (Grade). Change the grid from 3 columns to 2 columns. The remaining columns (Current Bid, Status) expand to fill.

If a Fair Value range for the car is available, add a new leading block above the 2-column grid:

```tsx
<div className="mb-3">
  <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Fair Value</span>
  <p className="text-[16px] font-bold text-foreground">
    {formatUsdValue(car.fairValueLow)} – {formatUsdValue(car.fairValueHigh)}
  </p>
</div>
```

(Import `formatUsdValue` from `@/components/dashboard/utils/valuation`.)

- [ ] **Step 2: Edit `ModelContextPanel.tsx`**

Delete the grade display at lines 145-146. Replace with a `"Median Sold: $X"` text node sourced from `model.medianPriceUsd`.

- [ ] **Step 3: Edit `GenerationContextPanel.tsx`**

At line 50, delete `const g = car.investmentGrade || "B"` and the variant ranking that uses it (lines 51-52). Replace the ranking with sort by `medianPriceUsd` desc (most expensive variant first).

- [ ] **Step 4: Edit `BrandContextPanel.tsx`**

At lines 113-117, delete the Grade metric block. Replace with:

```tsx
<div>
  <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.medianSold")}</span>
  <p className="text-[16px] font-bold text-foreground">
    {formatUsdValue(brand.medianPriceUsd)}
  </p>
</div>
```

(We add the `brandContext.medianSold` i18n key in Task 16.)

- [ ] **Step 5: Type-check**

Run: `cd producto && npx tsc --noEmit 2>&1 | grep -i "context"`
Expected: zero errors in context files.

- [ ] **Step 6: Commit**

```bash
cd producto && git add src/components/makePage/context/ src/components/dashboard/context/ && git commit -m "refactor(haus-report): replace Grade column in context panels with Fair Value / Median Sold"
```

---

### Task 12: Clean up landing page and auction detail

**Files:**
- Modify: `src/components/landing/FeaturedAuctionsSection.tsx`
- Modify: `src/app/[locale]/auctions/[id]/AuctionDetailClient.tsx`
- Modify: `src/app/api/auctions/[id]/route.ts`
- Modify: `src/app/api/mock-auctions/route.ts`

- [ ] **Step 1: Edit `FeaturedAuctionsSection.tsx`**

Delete the `getGradeBadgeStyle` function (lines 14-25).
Delete the grade badge block (lines 113-121).
Replace with a listing status badge — factual state:

```tsx
{auction.status === "sold" && auction.soldPriceUsd ? (
  <span className="inline-flex items-center gap-1 rounded-full border border-positive/30 bg-positive/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-positive">
    Sold at {formatUsdValue(auction.soldPriceUsd)}
  </span>
) : auction.endTime ? (
  <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-primary">
    Ends {formatRelativeTime(auction.endTime)}
  </span>
) : (
  <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/30 bg-foreground/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-muted-foreground">
    Upcoming
  </span>
)}
```

Add `formatRelativeTime` helper if not present (simple: if endTime - now < 1 day → `"in Xh"`, else `"in Xd"`).

- [ ] **Step 2: Edit `AuctionDetailClient.tsx`**

Search for any grade reference; remove all display + logic. If grade appears as a metric card, remove that card.

- [ ] **Step 3: Edit `api/auctions/[id]/route.ts`**

Delete lines 175 and 238 (the `investmentGrade: curatedCar.investmentGrade === "AAA" ? "EXCELLENT" : ...` mappings). Remove the `investmentGrade` key entirely from the API response body.

- [ ] **Step 4: Edit `api/mock-auctions/route.ts`**

Line 45: delete `investmentGrade: car.investmentGrade,` from the response projection.
Lines 213 and 225: delete the grade-based filter branches entirely. If the route accepted a `?grade=` query param, remove that param from the accepted queries.

- [ ] **Step 5: Type-check + run tests**

Run: `cd producto && npx tsc --noEmit 2>&1 | head -30`
Run: `cd producto && npx vitest run src/`
Expected: zero grade-related errors. Any test that hardcoded grade expectations will fail — update those tests to assert on `medianPriceUsd` or `listingsActive` instead.

- [ ] **Step 6: Commit**

```bash
cd producto && git add src/components/landing/ src/app/[locale]/auctions/ src/app/api/auctions/ src/app/api/mock-auctions/ && git commit -m "refactor(haus-report): remove grade from landing, auction detail, and related API routes"
```

---

### Task 13: Remove grade from AI prompt schema and remaining sidebars

**Files:**
- Modify: `src/lib/ai/prompts.ts` (will be replaced more completely in Phase 4; here just strip grade)
- Modify: `src/components/filters/AdvancedFilters.tsx`
- Modify: `src/components/dashboard/sidebar/DiscoverySidebar.tsx`
- Modify: `src/components/advisor/advisorLanguage.ts`
- Modify: `src/components/advisor/advisorEngine.ts`
- Modify: `src/components/analysis/AnalysisReport.tsx`

- [ ] **Step 1: Edit `src/lib/ai/prompts.ts`**

In `buildVehicleAnalysisPrompt`, delete the `"investmentOutlook"` block entirely from the response schema (lines 136-140 in the JSON instructions). Replace with:

```
  "investmentOutlook": {
    "trend": "<APPRECIATING|STABLE|DECLINING>",
    "reasoning": "<string - 2-3 sentences explaining the investment outlook>"
  },
```

(Trend and reasoning stay; `grade` is removed.)

- [ ] **Step 2: Edit `AdvancedFilters.tsx`**

Delete the `GRADE_OPTIONS` constant (lines 68-72).
Delete the `selectedGrades` state hook.
Delete any reference to `selectedGrades` in the `useEffect` dispatch and in `hasActiveFilters`.
If the filters body rendered a "Grade" section, delete it.

- [ ] **Step 3: Edit `DiscoverySidebar.tsx`**

Delete the `gradeColor` helper (lines 108-115). It was unused.

- [ ] **Step 4: Edit `advisorLanguage.ts` and `advisorEngine.ts`**

Search both files for any `grade` or `investmentGrade` reference. Remove lines that read or format the grade. In chat response templates, replace `"Grade: {grade}"` with a factual sentence like `"Median sold: {median} across {N} comparables."`

- [ ] **Step 5: Edit `AnalysisReport.tsx`**

Delete the `InvestmentGrade` type alias (line 27).
Delete the `GRADE_STYLES` const (lines 70-75).
Delete any JSX that renders the grade pill in section headers. **Preserve the surrounding section structure** — per user direction, the report structure stays, only grade language is removed.

- [ ] **Step 6: Type-check**

Run: `cd producto && npx tsc --noEmit 2>&1 | grep -i "grade\|investmentGrade\|InvestmentGrade"`
Expected: zero remaining references.

- [ ] **Step 7: Commit**

```bash
cd producto && git add src/lib/ai/prompts.ts src/components/filters/ src/components/dashboard/sidebar/ src/components/advisor/ src/components/analysis/ && git commit -m "refactor(haus-report): remove remaining grade references from prompts, filters, advisor, and analysis"
```

---

### Task 14: Audit sweep — grep for any remaining grade references

**Files:** (reads only, then targeted edits)

- [ ] **Step 1: Grep the whole src tree**

Run: `cd producto && grep -rn "investmentGrade\|InvestmentGrade\|GRADE_ORDER\|GRADE_SCORE\|GRADE_STYLES\|computeGrade\|computeWeightedGrade\|getTopPicks\|getCarsByGrade" src/ 2>/dev/null | grep -v "__tests__\|\.test\."`

Review each result. For each hit:
- If it's a variable/function reference, remove it + its consumer line
- If it's a comment, update the comment to reflect current reality

- [ ] **Step 2: Grep for stray "AAA" strings**

Run: `cd producto && grep -rn '"AAA"\|"AA"\|"B+"' src/ 2>/dev/null | grep -v "__tests__\|\.test\."`

Review each. Remove any that are grade-related. (Leave unrelated strings like e.g. `"AAAA"` or `"AA batteries"` if any — context-dependent.)

- [ ] **Step 3: Type-check the entire project**

Run: `cd producto && npx tsc --noEmit`
Expected: **zero errors**. If any remain, fix them before proceeding.

- [ ] **Step 4: Run the full unit test suite**

Run: `cd producto && npm test`
Expected: all tests pass. If a test asserted grade behavior, update it to assert on the replacement metric (median, listings count, etc.).

- [ ] **Step 5: Commit any residual fixes**

```bash
cd producto && git add -u && git commit -m "refactor(haus-report): sweep out residual grade references"
```

---

## Phase 2 — i18n Updates (4 languages)

### Task 15: Delete and rewrite grade-related i18n keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`
- Modify: `messages/de.json`
- Modify: `messages/ja.json`

- [ ] **Step 1: In each of the 4 files, delete these key paths:**

- `sidebar.grade`
- `makePage.header.grade`
- `grades.*` (the entire `grades` block if it exists)
- `dashboard.aaaBrands` (rename to `dashboard.featuredBrands`)
- `dashboard.brandCard.grade`, `dashboard.modelCard.grade`, `dashboard.generationCard.grade`
- `brandContext.grade` (replace with `brandContext.medianSold`)

- [ ] **Step 2: Rewrite these keys:**

- `dashboard.aaaBrands` → rename to `dashboard.featuredBrands`
  - EN: `"Featured Brands"`
  - ES: `"Marcas destacadas"`
  - DE: `"Ausgewählte Marken"`
  - JA: `"注目のブランド"`
- `brandContext.medianSold` (new)
  - EN: `"Median Sold"`
  - ES: `"Mediana vendida"`
  - DE: `"Median Verkaufspreis"`
  - JA: `"中央値"`
- `advisor.singleCar`: remove `"Grade: {grade}"` templating, replace with `"Median: {median} | {comparables} comparables"` (and localized equivalents)
- `advisor.currentCar`: same pattern
- `seo.description`, `seo.descriptionSeries`, `seo.descriptionFallback`: replace `"investment-grade"` with `"collector-grade"` (EN) / `"de colección"` (ES) / `"Sammler-"` (DE) / `"コレクター"` (JA), preserving surrounding text

- [ ] **Step 3: Add new keys for Haus Report UI (append to each language file):**

```json
"report": {
  "hausReport": {
    "title": "Haus Report",
    "available": "Haus Report available",
    "teaserBody": "Specific-car fair value, service history analysis, and the questions to ask before you buy. Unlock for 1 credit.",
    "ctaGenerate": "Generate Haus Report",
    "ctaView": "View Haus Report",
    "cached": "Already generated — cached"
  },
  "fairValue": {
    "specificCarTitle": "Specific-Car Fair Value",
    "baselineSubtitle": "Based on {count} comparable sales",
    "modifiersTitle": "Modifiers applied to this car",
    "noModifiers": "No adjustments applied — this car sits at the comparable baseline"
  },
  "signalsDetected": {
    "title": "Signals Detected",
    "empty": "No signals extracted — see missing signals below"
  },
  "signalsMissing": {
    "title": "Data we couldn't verify",
    "subtitle": "Ask the seller about these before you buy",
    "empty": "All high-value signals were detected in this listing"
  }
}
```

Translate each string into ES/DE/JA for the respective file. Keep key names identical.

- [ ] **Step 4: Lint/validate the JSON files**

Run: `cd producto && node -e "['en','es','de','ja'].forEach(l => JSON.parse(require('fs').readFileSync(\`messages/\${l}.json\`,'utf8')))"`
Expected: no output (silent success).

- [ ] **Step 5: Run next-intl type-check**

Run: `cd producto && npx tsc --noEmit`
Expected: zero errors. (If next-intl generates types from a master message file, regenerate per the project's convention.)

- [ ] **Step 6: Commit**

```bash
cd producto && git add messages/ && git commit -m "i18n(haus-report): remove grade keys, add Haus Report keys across en/es/de/ja"
```

---

## Phase 3 — New Report UI Components (against fixtures)

### Task 16: Build `SignalsDetectedSection` component

**Files:**
- Create: `src/components/report/SignalsDetectedSection.tsx`
- Test: `src/components/report/SignalsDetectedSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/report/SignalsDetectedSection.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { SignalsDetectedSection } from "./SignalsDetectedSection"
import mock from "@/lib/fairValue/__fixtures__/992-gt3-pts-mock.json"
import enMessages from "@/../messages/en.json"
import type { HausReport } from "@/lib/fairValue/types"

function renderWithIntl(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {node}
    </NextIntlClientProvider>
  )
}

describe("SignalsDetectedSection", () => {
  it("renders every detected signal from the fixture", () => {
    const report = mock as HausReport
    renderWithIntl(<SignalsDetectedSection signals={report.signals_detected} />)
    for (const signal of report.signals_detected) {
      expect(screen.getByText(signal.value_display)).toBeInTheDocument()
    }
  })

  it("shows empty state when no signals detected", () => {
    renderWithIntl(<SignalsDetectedSection signals={[]} />)
    expect(screen.getByText(/no signals extracted/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd producto && npx vitest run src/components/report/SignalsDetectedSection.test.tsx`
Expected: Module not found.

- [ ] **Step 3: Implement `SignalsDetectedSection.tsx`**

```tsx
"use client"
import { useTranslations } from "next-intl"
import { CheckCircle2, FileText, Database, User, ExternalLink } from "lucide-react"
import type { DetectedSignal, SignalSourceType } from "@/lib/fairValue/types"

interface Props {
  signals: DetectedSignal[]
}

const SOURCE_ICON: Record<SignalSourceType, typeof FileText> = {
  listing_text: FileText,
  structured_field: Database,
  seller_context: User,
  external: ExternalLink,
}

const SOURCE_LABEL: Record<SignalSourceType, string> = {
  listing_text: "Listing text",
  structured_field: "Structured field",
  seller_context: "Seller context",
  external: "External data",
}

export function SignalsDetectedSection({ signals }: Props) {
  const t = useTranslations("report.signalsDetected")

  if (signals.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-2">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold mb-4">{t("title")}</h2>
      <ul className="space-y-3">
        {signals.map((s) => {
          const Icon = SOURCE_ICON[s.evidence.source_type]
          return (
            <li key={s.key} className="flex items-start gap-3">
              <CheckCircle2 className="size-4 text-positive mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{s.value_display}</p>
                {s.evidence.raw_excerpt && (
                  <p className="mt-1 text-xs text-muted-foreground italic">
                    "{s.evidence.raw_excerpt}"
                  </p>
                )}
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Icon className="size-3" />
                  <span>{SOURCE_LABEL[s.evidence.source_type]}</span>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd producto && npx vitest run src/components/report/SignalsDetectedSection.test.tsx`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
cd producto && git add src/components/report/SignalsDetectedSection.tsx src/components/report/SignalsDetectedSection.test.tsx && git commit -m "feat(haus-report): SignalsDetectedSection component with evidence display"
```

---

### Task 17: Build `SignalsMissingSection` component

**Files:**
- Create: `src/components/report/SignalsMissingSection.tsx`
- Test: `src/components/report/SignalsMissingSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/report/SignalsMissingSection.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { SignalsMissingSection } from "./SignalsMissingSection"
import mock from "@/lib/fairValue/__fixtures__/992-gt3-pts-mock.json"
import sparseMock from "@/lib/fairValue/__fixtures__/991-carrera-sparse-mock.json"
import enMessages from "@/../messages/en.json"
import type { HausReport } from "@/lib/fairValue/types"

function renderWithIntl(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {node}
    </NextIntlClientProvider>
  )
}

describe("SignalsMissingSection", () => {
  it("renders each missing signal as a question", () => {
    const report = sparseMock as HausReport
    renderWithIntl(<SignalsMissingSection signals={report.signals_missing} />)
    expect(screen.getByText(/ask the seller/i)).toBeInTheDocument()
  })

  it("shows 'all detected' state when nothing is missing", () => {
    renderWithIntl(<SignalsMissingSection signals={[]} />)
    expect(screen.getByText(/all high-value signals were detected/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd producto && npx vitest run src/components/report/SignalsMissingSection.test.tsx`

- [ ] **Step 3: Implement**

```tsx
"use client"
import { useTranslations } from "next-intl"
import { HelpCircle } from "lucide-react"
import type { MissingSignal } from "@/lib/fairValue/types"

interface Props {
  signals: MissingSignal[]
}

export function SignalsMissingSection({ signals }: Props) {
  const t = useTranslations("report.signalsMissing")
  const tQuestions = useTranslations("report.questions")

  if (signals.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-2">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
      <h2 className="text-lg font-semibold mb-1">{t("title")}</h2>
      <p className="text-xs text-muted-foreground mb-4">{t("subtitle")}</p>
      <ul className="space-y-2">
        {signals.map((s) => {
          // question_for_seller_i18n_key is "report.questions.<key>" — strip prefix
          const qKey = s.question_for_seller_i18n_key.replace(/^report\.questions\./, "")
          return (
            <li key={s.key} className="flex items-start gap-3">
              <HelpCircle className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">{tQuestions(qKey)}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: Add the questions namespace to i18n**

Append to each `messages/{lang}.json` under `report`:

```json
"questions": {
  "ask_for_service_records": "Ask the seller for documented service history (dates, mileage, and stamps).",
  "remaining_factory_warranty": "Confirm any remaining factory or extended warranty coverage.",
  "accident_disclosure_in_writing": "Request a written statement confirming no prior accidents.",
  "share_carfax_report": "Request a shareable Carfax or Autocheck report link.",
  "is_paint_factory_or_pts": "Confirm whether the paint is a factory color or Paint-to-Sample (code).",
  "how_many_previous_owners": "Confirm the number of previous owners and whether a one-owner claim is verifiable.",
  "confirm_original_paint": "Request confirmation and paint meter readings at the PPI."
}
```

Translate for ES/DE/JA accordingly.

- [ ] **Step 5: Run test — PASS**

Run: `cd producto && npx vitest run src/components/report/SignalsMissingSection.test.tsx`

- [ ] **Step 6: Commit**

```bash
cd producto && git add src/components/report/SignalsMissingSection.tsx src/components/report/SignalsMissingSection.test.tsx messages/ && git commit -m "feat(haus-report): SignalsMissingSection with seller question prompts"
```

---

### Task 18: Build `ModifiersAppliedList` component

**Files:**
- Create: `src/components/report/ModifiersAppliedList.tsx`
- Test: `src/components/report/ModifiersAppliedList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { ModifiersAppliedList } from "./ModifiersAppliedList"
import mock from "@/lib/fairValue/__fixtures__/992-gt3-pts-mock.json"
import enMessages from "@/../messages/en.json"
import type { HausReport } from "@/lib/fairValue/types"

function renderWithIntl(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>{node}</NextIntlClientProvider>
  )
}

describe("ModifiersAppliedList", () => {
  it("renders every applied modifier with its delta percentage", () => {
    const r = mock as HausReport
    renderWithIntl(<ModifiersAppliedList modifiers={r.modifiers_applied} />)
    for (const m of r.modifiers_applied) {
      const sign = m.delta_percent > 0 ? "+" : ""
      expect(screen.getByText(new RegExp(`${sign}${m.delta_percent}%`))).toBeInTheDocument()
    }
  })

  it("renders the 'no modifiers' state when list is empty", () => {
    renderWithIntl(<ModifiersAppliedList modifiers={[]} />)
    expect(screen.getByText(/no adjustments applied/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement**

```tsx
"use client"
import { useTranslations } from "next-intl"
import { ExternalLink } from "lucide-react"
import type { AppliedModifier } from "@/lib/fairValue/types"

interface Props {
  modifiers: AppliedModifier[]
}

export function ModifiersAppliedList({ modifiers }: Props) {
  const t = useTranslations("report.fairValue")
  const tMod = useTranslations("report.modifiers")

  if (modifiers.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground italic">{t("noModifiers")}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border">
      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t("modifiersTitle")}
      </div>
      {modifiers.map((m) => {
        const sign = m.delta_percent > 0 ? "+" : ""
        const tone = m.delta_percent > 0 ? "text-positive" : "text-destructive"
        return (
          <div key={m.key} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {tMod(`${m.key}.name`)}
              </p>
              <p className="text-xs text-muted-foreground">
                {tMod(`${m.key}.description`)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className={`text-sm font-bold ${tone}`}>
                {sign}{m.delta_percent}%
              </span>
              {m.citation_url && (
                <a
                  href={m.citation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                >
                  source <ExternalLink className="size-2.5" />
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Append modifier name/description i18n keys to `messages/{lang}.json`**

Add under `report.modifiers`:

```json
"modifiers": {
  "mileage_delta": { "name": "Mileage vs. comparables", "description": "Adjustment based on mileage relative to comparable sales" },
  "transmission_manual": { "name": "Transmission preference", "description": "Manual vs. PDK premium in this series" },
  "year_within_generation": { "name": "Model year premium", "description": "Position within the generation's production run" },
  "paint_to_sample": { "name": "Paint-to-Sample", "description": "Factory special-order paint color" },
  "service_records_complete": { "name": "Complete service records", "description": "Documented service history with stamps" },
  "low_previous_owners": { "name": "Ownership history", "description": "Low number of previous owners" },
  "original_paint": { "name": "Original paint", "description": "No repaint disclosed, original factory finish" },
  "accident_disclosed": { "name": "Accident disclosure", "description": "Prior accident history disclosed by seller" },
  "modifications_disclosed": { "name": "Aftermarket modifications", "description": "Non-factory parts or modifications disclosed" },
  "documentation_provided": { "name": "Documentation provided", "description": "Window sticker, PPI, or Carfax available" },
  "warranty_remaining": { "name": "Warranty remaining", "description": "Factory or CPO warranty still active" },
  "seller_tier_specialist": { "name": "Porsche specialist seller", "description": "Sold by a curated specialist dealer" }
}
```

Translate for ES/DE/JA.

- [ ] **Step 4: Run test — PASS**

Run: `cd producto && npx vitest run src/components/report/ModifiersAppliedList.test.tsx`

- [ ] **Step 5: Commit**

```bash
cd producto && git add src/components/report/ModifiersAppliedList.tsx src/components/report/ModifiersAppliedList.test.tsx messages/ && git commit -m "feat(haus-report): ModifiersAppliedList with citations and name/description i18n"
```

---

### Task 19: Build `HausReportTeaser` (free-view CTA card)

**Files:**
- Create: `src/components/report/HausReportTeaser.tsx`
- Test: `src/components/report/HausReportTeaser.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { HausReportTeaser } from "./HausReportTeaser"
import enMessages from "@/../messages/en.json"

function renderWithIntl(node: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={enMessages}>{node}</NextIntlClientProvider>)
}

describe("HausReportTeaser", () => {
  it("shows 'Generate' CTA when no report exists", () => {
    const onClick = vi.fn()
    renderWithIntl(<HausReportTeaser reportExists={false} userAlreadyPaid={false} onClick={onClick} />)
    expect(screen.getByRole("button", { name: /generate haus report/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("shows 'View' CTA when report exists (user has not paid)", () => {
    renderWithIntl(<HausReportTeaser reportExists={true} userAlreadyPaid={false} onClick={() => {}} />)
    expect(screen.getByRole("button", { name: /view haus report/i })).toBeInTheDocument()
    expect(screen.getByText(/already generated/i)).toBeInTheDocument()
  })

  it("shows 'View' CTA and no credit copy when user already paid", () => {
    renderWithIntl(<HausReportTeaser reportExists={true} userAlreadyPaid={true} onClick={() => {}} />)
    expect(screen.getByRole("button", { name: /view haus report/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement**

```tsx
"use client"
import { useTranslations } from "next-intl"
import { FileText } from "lucide-react"

interface Props {
  reportExists: boolean
  userAlreadyPaid: boolean
  onClick: () => void
}

export function HausReportTeaser({ reportExists, userAlreadyPaid, onClick }: Props) {
  const t = useTranslations("report.hausReport")
  const cta = reportExists ? t("ctaView") : t("ctaGenerate")

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 flex items-start gap-4">
      <div className="shrink-0 rounded-lg bg-primary/10 p-2">
        <FileText className="size-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{t("available")}</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t("teaserBody")}</p>
        {reportExists && !userAlreadyPaid && (
          <p className="mt-2 text-[10px] text-muted-foreground uppercase tracking-wider">{t("cached")}</p>
        )}
        <button
          onClick={onClick}
          className="mt-3 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {cta}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run — PASS**

Run: `cd producto && npx vitest run src/components/report/HausReportTeaser.test.tsx`

- [ ] **Step 4: Commit**

```bash
cd producto && git add src/components/report/HausReportTeaser.tsx src/components/report/HausReportTeaser.test.tsx && git commit -m "feat(haus-report): HausReportTeaser card for free detail page"
```

---

### Task 20: Wire `HausReportTeaser` into car detail page

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx`

- [ ] **Step 1: Read the current page to find the right insertion point**

Run: `cd producto && grep -n "fairValue\|marketStats\|valuation" src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx | head -20`

Locate the block that displays the market fair value range. The teaser goes immediately after that block.

- [ ] **Step 2: Import + render the teaser**

Add at top of `CarDetailClient.tsx`:

```tsx
import { HausReportTeaser } from "@/components/report/HausReportTeaser"
import { useRouter } from "@/i18n/navigation"
```

Add logic to check report existence. Assume there is a prop or server fetch for `existingReport: HausReport | null` and `userAlreadyPaid: boolean`. If not, extend the page server component (`page.tsx` one directory up) to fetch this and pass as props.

Insert in the JSX after the market stats block:

```tsx
<HausReportTeaser
  reportExists={!!existingReport}
  userAlreadyPaid={userAlreadyPaid}
  onClick={() => router.push(`/cars/${make}/${id}/report`)}
/>
```

- [ ] **Step 3: Extend `page.tsx` to load report existence (server-side)**

In `src/app/[locale]/cars/[make]/[id]/page.tsx`, add a fetch:

```typescript
import { getReportForListing } from "@/lib/reports/queries"
import { hasUserPaidForListing } from "@/lib/credits/supabaseCredits" // or equivalent existing fn

// ... in the page component:
const existingReport = await getReportForListing(id)
const userId = session?.user?.id
const userAlreadyPaid = userId ? await hasUserPaidForListing(userId, id) : false
```

Pass both to the client component.

If `getReportForListing` / `hasUserPaidForListing` don't exist yet, create stubs that return `null` / `false` for now. They will be fully implemented in Phase 4 wiring.

- [ ] **Step 4: Verify dev server renders without error**

Run: `cd producto && npm run dev`
Then navigate to any car detail page. Expected: teaser card appears below the market stats section. Button text should be "Generate Haus Report" when no report exists.

- [ ] **Step 5: Commit**

```bash
cd producto && git add src/app/[locale]/cars/[make]/[id]/ && git commit -m "feat(haus-report): show HausReportTeaser on free car detail page"
```

---

### Task 21: Refactor `ReportClient.tsx` to render `HausReport` shape with fixture

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`
- Modify: `src/app/[locale]/cars/[make]/[id]/report/page.tsx`
- Create: mocked dev path — if URL includes `?mock=992gt3`, inject the fixture instead of DB lookup

- [ ] **Step 1: Update the component props to accept the extended `HausReport`**

At the top of `ReportClient.tsx`, replace the existing `ListingReport` import with:

```tsx
import type { HausReport } from "@/lib/fairValue/types"
```

Update the `ReportClientProps` interface:

```tsx
interface ReportClientProps {
  car: CollectorCar
  similarCars: SimilarCarResult[]
  report: HausReport | null
  marketStats: ModelMarketStats | null
  userCredits: number
}
```

- [ ] **Step 2: Replace the `hasLLM` check**

Find line 135 (`const hasLLM = !!(report?.investment_grade)`). Replace with:

```tsx
const hasSignals = !!(report?.signals_extracted_at)
```

Replace all downstream usages of `hasLLM` with `hasSignals`.

- [ ] **Step 3: Add Specific-Car Fair Value block in Section 1 (Executive Summary)**

In the Executive Summary render block, remove any remaining grade/pill references (grep for `investment_grade` and delete those lines). Add in the position where grade used to be:

```tsx
{report && (
  <div className="rounded-2xl border border-border bg-card p-5">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
      {t("report.fairValue.specificCarTitle")}
    </p>
    <p className="text-2xl font-bold text-foreground">
      {formatUsd(report.specific_car_fair_value_low)} – {formatUsd(report.specific_car_fair_value_high)}
    </p>
    <p className="mt-1 text-xs text-muted-foreground">
      {t("report.fairValue.baselineSubtitle", { count: report.comparables_count })}
    </p>
  </div>
)}
```

- [ ] **Step 4: Insert `SignalsDetectedSection`, `ModifiersAppliedList`, `SignalsMissingSection`**

Import them at the top:

```tsx
import { SignalsDetectedSection } from "@/components/report/SignalsDetectedSection"
import { SignalsMissingSection } from "@/components/report/SignalsMissingSection"
import { ModifiersAppliedList } from "@/components/report/ModifiersAppliedList"
```

Insert:
- `SignalsDetectedSection` between Section 3 (Valuation) and Section 4 (Market Context)
- `ModifiersAppliedList` inside Section 3 (Valuation), after the existing fair value range block
- `SignalsMissingSection` immediately before Section 10 (Verdict)

All three accept props from `report` — if `report` is null, they render empty states.

- [ ] **Step 5: Remove AAA references from Section 10 (Verdict)**

Find the Verdict section and any reference to `investment_grade` / `investmentGrade`. Replace the grade display with a factual synthesis:

```tsx
{report && (
  <div className="text-sm text-foreground">
    {t("report.verdict.factualSummary", {
      deltaPercent: Math.round(
        ((currentPrice - report.specific_car_fair_value_mid) / report.specific_car_fair_value_mid) * 100
      ),
      detected: report.signals_detected.length,
      total: report.signals_detected.length + report.signals_missing.length,
    })}
  </div>
)}
```

Add to i18n:

```json
"verdict": {
  "factualSummary": "Price is {deltaPercent}% vs. specific-car fair value. {detected} of {total} high-value signals detected."
}
```

- [ ] **Step 6: Enable mock-mode via query param**

In `page.tsx` (server), near the existing data fetches:

```typescript
const { searchParams } = new URL(request.url)
const mockName = searchParams.get("mock")
let report: HausReport | null = null
if (mockName === "992gt3") {
  const fixture = (await import("@/lib/fairValue/__fixtures__/992-gt3-pts-mock.json")).default
  report = fixture as HausReport
} else if (mockName === "sparse") {
  const fixture = (await import("@/lib/fairValue/__fixtures__/991-carrera-sparse-mock.json")).default
  report = fixture as HausReport
} else {
  report = await getReportForListing(id)  // returns null for now if not implemented
}
```

- [ ] **Step 7: Visual QA**

Run: `cd producto && npm run dev`
Navigate to `/en/cars/porsche/<any-id>/report?mock=992gt3`. Expected: the full report renders with the fixture data — specific-car fair value visible, 7 detected signals with evidence excerpts, modifiers list with citations linked, 3 missing signals prompting seller questions.

Also test `?mock=sparse` — sparse fixture renders with empty modifiers state and many missing signals.

- [ ] **Step 8: Commit**

```bash
cd producto && git add src/app/[locale]/cars/[make]/[id]/report/ && git commit -m "feat(haus-report): refactor ReportClient to render HausReport shape with signal sections"
```

---

## Phase 4 — Backend Pipeline: Extractors, Gemini, Engine wiring

### Task 22: Add Supabase migrations for `listing_signals` table and `listing_reports` extensions

**Files:**
- Create: `supabase/migrations/20260419_create_listing_signals.sql`
- Create: `supabase/migrations/20260419_extend_listing_reports_haus_report.sql`

- [ ] **Step 1: Write `20260419_create_listing_signals.sql`**

```sql
-- Append-only log of signal extraction runs per listing.
-- One row per extracted signal; grouped by extraction_run_id.
CREATE TABLE IF NOT EXISTS listing_signals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id            uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  extraction_run_id     uuid NOT NULL,
  signal_key            text NOT NULL,
  signal_value_json     jsonb NOT NULL,
  evidence_source_type  text NOT NULL,
  evidence_source_ref   text,
  evidence_raw_excerpt  text,
  evidence_confidence   text NOT NULL,
  extracted_at          timestamptz NOT NULL DEFAULT now(),
  extraction_version    text NOT NULL,

  CONSTRAINT chk_confidence CHECK (evidence_confidence IN ('high','medium','low')),
  CONSTRAINT chk_source_type CHECK (evidence_source_type IN ('listing_text','structured_field','seller_context','external'))
);

CREATE INDEX IF NOT EXISTS idx_listing_signals_listing ON listing_signals(listing_id, extracted_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_signals_run ON listing_signals(extraction_run_id);

ALTER TABLE listing_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read signals" ON listing_signals FOR SELECT USING (true);
CREATE POLICY "Service role inserts signals" ON listing_signals FOR INSERT WITH CHECK (auth.role() = 'service_role');
```

- [ ] **Step 2: Write `20260419_extend_listing_reports_haus_report.sql`**

```sql
-- Extend listing_reports with Haus Report v1 fields (specific-car fair value + signal extraction meta).
-- The legacy investment_grade column stays (nullable, stop writing).
ALTER TABLE listing_reports
  ADD COLUMN IF NOT EXISTS specific_car_fair_value_low   numeric,
  ADD COLUMN IF NOT EXISTS specific_car_fair_value_mid   numeric,
  ADD COLUMN IF NOT EXISTS specific_car_fair_value_high  numeric,
  ADD COLUMN IF NOT EXISTS comparable_layer_used         text,
  ADD COLUMN IF NOT EXISTS comparables_count             integer,
  ADD COLUMN IF NOT EXISTS modifiers_applied_json        jsonb,
  ADD COLUMN IF NOT EXISTS modifiers_total_percent       numeric,
  ADD COLUMN IF NOT EXISTS signals_extracted_at          timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_version            text;
```

- [ ] **Step 3: Apply both migrations via Supabase Dashboard or CLI**

Run from the project root: `npx supabase db push` (if using Supabase CLI), or paste each SQL file into the Supabase Dashboard SQL editor and execute.

Verify in Dashboard:
- `listing_signals` table exists with the 11 columns listed
- `listing_reports` has the 9 new columns

- [ ] **Step 4: Commit**

```bash
cd producto && git add supabase/migrations/ && git commit -m "feat(haus-report): supabase migrations for listing_signals + listing_reports extensions"
```

---

### Task 23: Build the deterministic `structured` extractor (TDD)

**Files:**
- Create: `src/lib/fairValue/extractors/structured.ts`
- Test: `src/lib/fairValue/extractors/structured.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest"
import { extractStructuredSignals } from "./structured"

describe("extractStructuredSignals", () => {
  it("emits a transmission signal from listings.transmission field", () => {
    const signals = extractStructuredSignals({
      id: "x", year: 2022, make: "Porsche", model: "992 GT3",
      mileage: 12000, transmission: "Manual", country: "US",
    } as any)
    const tx = signals.find(s => s.key === "transmission")
    expect(tx).toBeTruthy()
    expect(tx!.value_display).toContain("Manual")
    expect(tx!.evidence.source_type).toBe("structured_field")
  })

  it("emits a mileage signal", () => {
    const signals = extractStructuredSignals({
      id: "x", year: 2022, make: "Porsche", model: "992", mileage: 12000,
    } as any)
    expect(signals.find(s => s.key === "mileage")).toBeTruthy()
  })

  it("emits a year signal", () => {
    const signals = extractStructuredSignals({
      id: "x", year: 2022, make: "Porsche", model: "992",
    } as any)
    expect(signals.find(s => s.key === "year")).toBeTruthy()
  })

  it("does not emit transmission signal when field is null", () => {
    const signals = extractStructuredSignals({
      id: "x", year: 2022, make: "Porsche", model: "992", transmission: null,
    } as any)
    expect(signals.find(s => s.key === "transmission")).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `structured.ts`**

```typescript
import type { DetectedSignal } from "../types"
import type { PricedListingRecord } from "@/lib/reports/types"

export function extractStructuredSignals(listing: PricedListingRecord): DetectedSignal[] {
  const signals: DetectedSignal[] = []

  if (listing.mileage != null) {
    signals.push({
      key: "mileage",
      name_i18n_key: "report.signals.mileage",
      value_display: `${listing.mileage.toLocaleString()} mi`,
      evidence: {
        source_type: "structured_field",
        source_ref: "listings.mileage",
        raw_excerpt: null,
        confidence: "high",
      },
    })
  }

  if (listing.transmission) {
    const isManual = /manual|\bm\/?t\b|stick/i.test(listing.transmission)
    signals.push({
      key: "transmission",
      name_i18n_key: isManual ? "report.signals.transmission_manual" : "report.signals.transmission_pdk",
      value_display: listing.transmission,
      evidence: {
        source_type: "structured_field",
        source_ref: "listings.transmission",
        raw_excerpt: null,
        confidence: "high",
      },
    })
  }

  if (listing.year) {
    signals.push({
      key: "year",
      name_i18n_key: "report.signals.year",
      value_display: String(listing.year),
      evidence: {
        source_type: "structured_field",
        source_ref: "listings.year",
        raw_excerpt: null,
        confidence: "high",
      },
    })
  }

  return signals
}
```

- [ ] **Step 4: Run — PASS**

Run: `cd producto && npx vitest run src/lib/fairValue/extractors/structured.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd producto && git add src/lib/fairValue/extractors/structured.ts src/lib/fairValue/extractors/structured.test.ts && git commit -m "feat(haus-report): structured field extractor (mileage, transmission, year)"
```

---

### Task 24: Build the `seller` extractor with whitelist (TDD)

**Files:**
- Create: `src/lib/fairValue/extractors/seller.ts`
- Test: `src/lib/fairValue/extractors/seller.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest"
import { extractSellerSignal } from "./seller"

describe("extractSellerSignal", () => {
  it("flags a known specialist seller", () => {
    const s = extractSellerSignal({ sellerName: "Canepa", sellerDomain: "canepa.com" })
    expect(s).toBeTruthy()
    expect(s!.key).toBe("seller_tier")
    expect(s!.value_display).toMatch(/specialist/i)
  })

  it("returns null for unknown sellers", () => {
    const s = extractSellerSignal({ sellerName: "John Doe", sellerDomain: null })
    expect(s).toBeNull()
  })

  it("matches domain substring case-insensitively", () => {
    const s = extractSellerSignal({ sellerName: null, sellerDomain: "shop.SLOANCARSLTD.com" })
    expect(s).toBeTruthy()
  })
})
```

- [ ] **Step 2: Implement `seller.ts`**

```typescript
import type { DetectedSignal } from "../types"

// Curated whitelist of Porsche specialist dealers. Expandable over time.
const SPECIALIST_DOMAINS = new Set([
  "canepa.com",
  "sloancarsltd.com",
  "dutchmanmotorcars.com",
  "rmsothebys.com",
  "gooding.com",
  "broadarrowauctions.com",
  "specialauto.com",
])

const SPECIALIST_NAMES = new Set([
  "canepa",
  "sloan cars",
  "dutchman motors",
  "rm sotheby's",
  "gooding & company",
])

export interface SellerInput {
  sellerName?: string | null
  sellerDomain?: string | null
}

export function extractSellerSignal(input: SellerInput): DetectedSignal | null {
  const domain = input.sellerDomain?.toLowerCase() ?? ""
  const name = input.sellerName?.toLowerCase() ?? ""

  const matchedDomain = [...SPECIALIST_DOMAINS].find((d) => domain.includes(d))
  const matchedName = [...SPECIALIST_NAMES].find((n) => name.includes(n))

  if (!matchedDomain && !matchedName) return null

  return {
    key: "seller_tier",
    name_i18n_key: "report.signals.seller_tier_specialist",
    value_display: `Porsche specialist (${input.sellerName ?? matchedDomain ?? "curated dealer"})`,
    evidence: {
      source_type: "seller_context",
      source_ref: "seller_whitelist",
      raw_excerpt: null,
      confidence: "high",
    },
  }
}
```

- [ ] **Step 3: Run — PASS**

Run: `cd producto && npx vitest run src/lib/fairValue/extractors/seller.test.ts`

- [ ] **Step 4: Commit**

```bash
cd producto && git add src/lib/fairValue/extractors/seller.ts src/lib/fairValue/extractors/seller.test.ts && git commit -m "feat(haus-report): seller whitelist extractor for specialist dealer tier"
```

---

### Task 25: Build the Gemini client (`src/lib/ai/gemini.ts`)

**Files:**
- Create: `src/lib/ai/gemini.ts`

- [ ] **Step 1: Install dependency**

Run: `cd producto && npm install @google/generative-ai`

- [ ] **Step 2: Write `gemini.ts`**

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai"

const API_KEY = process.env.GEMINI_API_KEY
const MODEL_ID = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"

if (!API_KEY) {
  // Don't throw at module load — allow build-time/test-time imports without the key.
  console.warn("[gemini] GEMINI_API_KEY is not set; calls will fail at runtime.")
}

interface GenerateJsonOptions {
  systemPrompt?: string
  userPrompt: string
  temperature?: number      // default 0
  maxOutputTokens?: number  // default 2048
}

export interface GeminiJsonResponse<T> {
  ok: true
  data: T
  raw: string
}

export interface GeminiErrorResponse {
  ok: false
  error: string
  raw: string | null
}

/**
 * Generate a JSON response from Gemini. Enforces responseMimeType: application/json.
 * The caller is responsible for validating the returned T matches its schema.
 */
export async function generateJson<T>(opts: GenerateJsonOptions): Promise<GeminiJsonResponse<T> | GeminiErrorResponse> {
  if (!API_KEY) return { ok: false, error: "GEMINI_API_KEY is not configured", raw: null }

  const client = new GoogleGenerativeAI(API_KEY)
  const model = client.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: opts.systemPrompt,
    generationConfig: {
      temperature: opts.temperature ?? 0,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      responseMimeType: "application/json",
    },
  })

  let raw = ""
  try {
    const res = await model.generateContent(opts.userPrompt)
    raw = res.response.text()
    const parsed = JSON.parse(raw) as T
    return { ok: true, data: parsed, raw }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      raw,
    }
  }
}
```

- [ ] **Step 3: Type-check**

Run: `cd producto && npx tsc --noEmit src/lib/ai/gemini.ts`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd producto && git add package.json package-lock.json src/lib/ai/gemini.ts && git commit -m "feat(haus-report): add Gemini JSON client targeting gemini-2.5-flash"
```

---

### Task 26: Build the `text` extractor that calls Gemini (TDD with mocked Gemini)

**Files:**
- Create: `src/lib/ai/prompts.ts` — add new `buildSignalExtractionPrompt` export
- Create: `src/lib/fairValue/extractors/text.ts`
- Test: `src/lib/fairValue/extractors/text.test.ts`

- [ ] **Step 1: Add `buildSignalExtractionPrompt` to `src/lib/ai/prompts.ts`**

Append:

```typescript
export const SIGNAL_EXTRACTION_SYSTEM_PROMPT = `You are a deterministic Porsche fact extractor. You extract ONLY facts explicitly (or near-explicitly) stated in listing descriptions. You NEVER infer, NEVER guess, NEVER use marketing adjectives (like "beautiful", "stunning") as facts. If a field is not stated in the text, return null (or false for booleans). Return ONLY valid JSON matching the requested schema. No prose, no markdown.`

export function buildSignalExtractionPrompt(description: string): string {
  return `Extract structured facts from this Porsche listing description. Return ONLY valid JSON matching this exact schema:

{
  "options": {
    "sport_chrono": boolean | null,
    "pccb": boolean | null,
    "burmester": boolean | null,
    "lwb_seats": boolean | null,
    "carbon_roof": boolean | null,
    "paint_to_sample": { "present": boolean, "color_name": string | null, "pts_code": string | null } | null,
    "factory_rear_spoiler_delete": boolean | null
  },
  "service": {
    "records_mentioned": boolean,
    "stamps_count": number | null,
    "last_major_service_year": number | null,
    "intervals_respected": boolean | null,
    "dealer_serviced": boolean | null
  },
  "ownership": {
    "previous_owners_count": number | null,
    "one_owner_claim": boolean,
    "years_current_owner": number | null,
    "collector_owned_claim": boolean,
    "garage_kept_claim": boolean
  },
  "originality": {
    "matching_numbers_claim": boolean,
    "original_paint_claim": boolean,
    "repaint_disclosed": { "repainted": boolean, "panels_mentioned": string[] } | null,
    "accident_disclosure": "none_mentioned" | "no_accidents_claim" | "prior_accident_disclosed",
    "modifications_disclosed": string[]
  },
  "documentation": {
    "ppi_available": boolean,
    "carfax_linked": boolean,
    "window_sticker_shown": boolean,
    "build_sheet_shown": boolean
  },
  "warranty": {
    "remaining_factory_warranty": boolean | null,
    "cpo_status": boolean
  },
  "listing_completeness": "high" | "medium" | "low",
  "extraction_confidence": "high" | "medium" | "low"
}

Rules:
- Return null (or false) for any field not explicitly mentioned.
- For numeric fields (like stamps_count), extract only if a specific number appears in the text.
- For paint_to_sample, set present=true ONLY if the text explicitly says "paint-to-sample" or "PTS" (case-insensitive). Otherwise present=false.
- Ignore marketing adjectives: "beautiful", "pristine", "stunning" are NOT facts.
- Do not infer matching_numbers_claim unless the text literally says "matching numbers".

Listing description:
"""
${description}
"""`
}
```

- [ ] **Step 2: Write failing test for `text.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { extractTextSignals } from "./text"

vi.mock("@/lib/ai/gemini", () => ({
  generateJson: vi.fn(),
}))

import { generateJson } from "@/lib/ai/gemini"
const generateJsonMock = generateJson as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  generateJsonMock.mockReset()
})

describe("extractTextSignals", () => {
  it("emits detected signals when Gemini returns rich extraction", async () => {
    generateJsonMock.mockResolvedValue({
      ok: true,
      data: {
        options: {
          sport_chrono: true,
          pccb: true,
          burmester: false,
          lwb_seats: false,
          carbon_roof: false,
          paint_to_sample: { present: true, color_name: "Gulf Blue", pts_code: "Y5C" },
          factory_rear_spoiler_delete: false,
        },
        service: { records_mentioned: true, stamps_count: 14, last_major_service_year: 2025, intervals_respected: true, dealer_serviced: true },
        ownership: { previous_owners_count: 1, one_owner_claim: false, years_current_owner: 5, collector_owned_claim: false, garage_kept_claim: true },
        originality: { matching_numbers_claim: true, original_paint_claim: true, repaint_disclosed: null, accident_disclosure: "no_accidents_claim", modifications_disclosed: [] },
        documentation: { ppi_available: true, carfax_linked: false, window_sticker_shown: true, build_sheet_shown: false },
        warranty: { remaining_factory_warranty: false, cpo_status: false },
        listing_completeness: "high",
        extraction_confidence: "high",
      },
      raw: "...",
    })

    const result = await extractTextSignals({
      description: "2022 Porsche 992 GT3 in Paint-to-Sample Gulf Blue (code Y5C). 14 service stamps...",
    })

    expect(result.ok).toBe(true)
    expect(result.signals.find(s => s.key === "paint_to_sample")?.value_display).toContain("Gulf Blue")
    expect(result.signals.find(s => s.key === "service_records")).toBeTruthy()
    expect(result.signals.find(s => s.key === "previous_owners")).toBeTruthy()
    expect(result.signals.find(s => s.key === "original_paint")).toBeTruthy()
    expect(result.signals.find(s => s.key === "documentation")).toBeTruthy()
  })

  it("emits no signals when Gemini returns all null/false (sparse description)", async () => {
    generateJsonMock.mockResolvedValue({
      ok: true,
      data: {
        options: { sport_chrono: false, pccb: false, burmester: false, lwb_seats: false, carbon_roof: false, paint_to_sample: { present: false, color_name: null, pts_code: null }, factory_rear_spoiler_delete: false },
        service: { records_mentioned: false, stamps_count: null, last_major_service_year: null, intervals_respected: null, dealer_serviced: null },
        ownership: { previous_owners_count: null, one_owner_claim: false, years_current_owner: null, collector_owned_claim: false, garage_kept_claim: false },
        originality: { matching_numbers_claim: false, original_paint_claim: false, repaint_disclosed: null, accident_disclosure: "none_mentioned", modifications_disclosed: [] },
        documentation: { ppi_available: false, carfax_linked: false, window_sticker_shown: false, build_sheet_shown: false },
        warranty: { remaining_factory_warranty: false, cpo_status: false },
        listing_completeness: "low",
        extraction_confidence: "high",
      },
      raw: "...",
    })

    const result = await extractTextSignals({ description: "2019 Porsche 911. White. Runs great." })
    expect(result.ok).toBe(true)
    expect(result.signals).toHaveLength(0)
  })

  it("returns ok=false on Gemini error", async () => {
    generateJsonMock.mockResolvedValue({ ok: false, error: "API error", raw: null })
    const result = await extractTextSignals({ description: "anything" })
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 3: Run — FAIL**

- [ ] **Step 4: Implement `text.ts`**

```typescript
import { generateJson } from "@/lib/ai/gemini"
import { buildSignalExtractionPrompt, SIGNAL_EXTRACTION_SYSTEM_PROMPT } from "@/lib/ai/prompts"
import type { DetectedSignal } from "../types"

// JSON schema shape expected back from Gemini (mirrors §5.2 of the spec).
interface ExtractedPayload {
  options: {
    sport_chrono: boolean | null
    pccb: boolean | null
    burmester: boolean | null
    lwb_seats: boolean | null
    carbon_roof: boolean | null
    paint_to_sample: { present: boolean; color_name: string | null; pts_code: string | null } | null
    factory_rear_spoiler_delete: boolean | null
  }
  service: {
    records_mentioned: boolean
    stamps_count: number | null
    last_major_service_year: number | null
    intervals_respected: boolean | null
    dealer_serviced: boolean | null
  }
  ownership: {
    previous_owners_count: number | null
    one_owner_claim: boolean
    years_current_owner: number | null
    collector_owned_claim: boolean
    garage_kept_claim: boolean
  }
  originality: {
    matching_numbers_claim: boolean
    original_paint_claim: boolean
    repaint_disclosed: { repainted: boolean; panels_mentioned: string[] } | null
    accident_disclosure: "none_mentioned" | "no_accidents_claim" | "prior_accident_disclosed"
    modifications_disclosed: string[]
  }
  documentation: {
    ppi_available: boolean
    carfax_linked: boolean
    window_sticker_shown: boolean
    build_sheet_shown: boolean
  }
  warranty: {
    remaining_factory_warranty: boolean | null
    cpo_status: boolean
  }
  listing_completeness: "high" | "medium" | "low"
  extraction_confidence: "high" | "medium" | "low"
}

export interface TextExtractionInput {
  description: string
}

export interface TextExtractionResult {
  ok: boolean
  signals: DetectedSignal[]
  error?: string
  rawPayload?: ExtractedPayload
}

export async function extractTextSignals(input: TextExtractionInput): Promise<TextExtractionResult> {
  const response = await generateJson<ExtractedPayload>({
    systemPrompt: SIGNAL_EXTRACTION_SYSTEM_PROMPT,
    userPrompt: buildSignalExtractionPrompt(input.description),
    temperature: 0,
  })

  if (!response.ok) {
    return { ok: false, signals: [], error: response.error }
  }

  const payload = response.data
  const signals: DetectedSignal[] = []

  // Paint-to-sample
  if (payload.options.paint_to_sample?.present) {
    const pts = payload.options.paint_to_sample
    const color = pts.color_name ?? "unspecified color"
    const code = pts.pts_code ? ` (PTS code ${pts.pts_code})` : ""
    signals.push({
      key: "paint_to_sample",
      name_i18n_key: "report.signals.paint_to_sample",
      value_display: `${color}${code}`,
      evidence: {
        source_type: "listing_text",
        source_ref: "description_text",
        raw_excerpt: null,
        confidence: "high",
      },
    })
  }

  // Service records
  if (payload.service.records_mentioned) {
    const stamps = payload.service.stamps_count != null ? `${payload.service.stamps_count} service stamps` : "service records mentioned"
    const year = payload.service.last_major_service_year ? `, last major service ${payload.service.last_major_service_year}` : ""
    signals.push({
      key: "service_records",
      name_i18n_key: "report.signals.service_records",
      value_display: `${stamps}${year}`,
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Previous owners
  if (payload.ownership.previous_owners_count != null && payload.ownership.previous_owners_count <= 2) {
    signals.push({
      key: "previous_owners",
      name_i18n_key: "report.signals.previous_owners",
      value_display: `${payload.ownership.previous_owners_count} previous owner${payload.ownership.previous_owners_count === 1 ? "" : "s"}`,
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Original paint
  if (payload.originality.original_paint_claim && !payload.originality.repaint_disclosed?.repainted) {
    signals.push({
      key: "original_paint",
      name_i18n_key: "report.signals.original_paint",
      value_display: "Original paint, no repaint disclosed",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Accident disclosed (negative signal)
  if (payload.originality.accident_disclosure === "prior_accident_disclosed") {
    signals.push({
      key: "accident_history",
      name_i18n_key: "report.signals.accident_history",
      value_display: "Prior accident disclosed",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Modifications
  if (payload.originality.modifications_disclosed.length > 0) {
    signals.push({
      key: "modifications",
      name_i18n_key: "report.signals.modifications",
      value_display: `Modifications: ${payload.originality.modifications_disclosed.join(", ")}`,
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Documentation
  const docParts = [
    payload.documentation.ppi_available && "PPI",
    payload.documentation.window_sticker_shown && "window sticker",
    payload.documentation.carfax_linked && "Carfax",
    payload.documentation.build_sheet_shown && "build sheet",
  ].filter(Boolean)
  if (docParts.length > 0) {
    signals.push({
      key: "documentation",
      name_i18n_key: "report.signals.documentation",
      value_display: docParts.join(", ") + " available",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Warranty
  if (payload.warranty.remaining_factory_warranty || payload.warranty.cpo_status) {
    signals.push({
      key: "warranty",
      name_i18n_key: "report.signals.warranty",
      value_display: payload.warranty.cpo_status ? "CPO certified" : "Factory warranty remaining",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  return { ok: true, signals, rawPayload: payload }
}
```

- [ ] **Step 5: Run — PASS**

Run: `cd producto && npx vitest run src/lib/fairValue/extractors/text.test.ts`
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
cd producto && git add src/lib/ai/prompts.ts src/lib/fairValue/extractors/text.ts src/lib/fairValue/extractors/text.test.ts && git commit -m "feat(haus-report): Gemini text signal extractor with mocked unit tests"
```

---

## Phase 5 — Gemini Prompt Validation (mandatory before wiring)

Per `feedback_gemini_prompt_testing` memory: test prompts against real Gemini API with real listings. Save outputs as regression fixtures.

### Task 27: Select 3 test listings from production data

- [ ] **Step 1: Query the database for 3 representative listings**

Run (in Supabase SQL editor or via `psql`):

```sql
-- Rich: 992 GT3 with long description
SELECT id, year, make, model, trim, description_text
FROM listings
WHERE make ILIKE 'porsche'
  AND model ILIKE '%GT3%'
  AND year >= 2022
  AND length(description_text) > 1500
LIMIT 1;

-- Sparse: 991 Carrera with short description
SELECT id, year, make, model, trim, description_text
FROM listings
WHERE make ILIKE 'porsche'
  AND model ILIKE '%911 Carrera%'
  AND year BETWEEN 2012 AND 2019
  AND length(description_text) < 400
LIMIT 1;

-- Challenging: 997 GT3 RS (rare variants likely)
SELECT id, year, make, model, trim, description_text
FROM listings
WHERE make ILIKE 'porsche'
  AND model ILIKE '%GT3 RS%'
  AND year BETWEEN 2007 AND 2011
LIMIT 1;
```

Save the three `(id, description_text)` pairs into local test inputs.

- [ ] **Step 2: Commit a note of the selected listing IDs**

Create `src/lib/ai/__fixtures__/validation-listings.md`:

```markdown
# Gemini validation listings (selected 2026-04-19)

1. Rich 992 GT3: <id>
2. Sparse 991 Carrera: <id>
3. Challenging 997 GT3 RS: <id>

See gemini-signals-*.json for captured outputs.
```

Commit:

```bash
cd producto && git add src/lib/ai/__fixtures__/validation-listings.md && git commit -m "docs(haus-report): record selected listings for Gemini prompt validation"
```

---

### Task 28: Run extraction against each listing and save outputs as regression fixtures

**Files:**
- Create: `scripts/validate-gemini-extraction.ts`
- Create: `src/lib/ai/__fixtures__/gemini-signals-992-gt3.json`
- Create: `src/lib/ai/__fixtures__/gemini-signals-991-carrera.json`
- Create: `src/lib/ai/__fixtures__/gemini-signals-997-gt3rs.json`

- [ ] **Step 1: Write `scripts/validate-gemini-extraction.ts`**

```typescript
#!/usr/bin/env tsx
/**
 * Validates the Gemini signal extraction prompt against real listings.
 * Run: `npx tsx scripts/validate-gemini-extraction.ts`
 * Requires GEMINI_API_KEY in .env.local.
 */
import "dotenv/config"
import { writeFileSync } from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"
import { extractTextSignals } from "@/lib/fairValue/extractors/text"

const LISTING_IDS = [
  { label: "992-gt3", id: process.env.VALIDATION_ID_992_GT3 },
  { label: "991-carrera", id: process.env.VALIDATION_ID_991_CARRERA },
  { label: "997-gt3rs", id: process.env.VALIDATION_ID_997_GT3RS },
]

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  for (const { label, id } of LISTING_IDS) {
    if (!id) { console.log(`Skipping ${label}: no id`); continue }

    const { data: listing, error } = await supabase
      .from("listings")
      .select("id, year, make, model, description_text")
      .eq("id", id)
      .single()

    if (error || !listing) {
      console.error(`Failed to fetch ${label}:`, error); continue
    }

    console.log(`\n=== ${label} (${listing.year} ${listing.model}) ===`)
    console.log(`Description length: ${listing.description_text?.length ?? 0} chars`)

    const result = await extractTextSignals({ description: listing.description_text ?? "" })

    if (!result.ok) {
      console.error(`Extraction failed for ${label}:`, result.error); continue
    }

    const output = {
      listing_id: listing.id,
      listing_label: label,
      extracted_at: new Date().toISOString(),
      signals_count: result.signals.length,
      signals: result.signals,
      raw_payload: result.rawPayload,
    }

    const outPath = path.join("src/lib/ai/__fixtures__", `gemini-signals-${label}.json`)
    writeFileSync(outPath, JSON.stringify(output, null, 2))
    console.log(`✓ Saved ${outPath} — ${result.signals.length} signals`)

    // Print each signal for visual validation
    result.signals.forEach((s) => console.log(`   - ${s.key}: ${s.value_display}`))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Export the three listing IDs as env vars**

Append to `.env.local`:

```
VALIDATION_ID_992_GT3=<id-from-task-27>
VALIDATION_ID_991_CARRERA=<id-from-task-27>
VALIDATION_ID_997_GT3RS=<id-from-task-27>
```

- [ ] **Step 3: Run the script**

Run: `cd producto && npx tsx scripts/validate-gemini-extraction.ts`

Expected console output:
- Each listing fetched successfully
- Each extraction returns `ok: true`
- Signals printed per listing
- Three JSON files saved in `__fixtures__/`

- [ ] **Step 4: Manually audit each output**

For each of the three JSON files, open and verify:
- Every non-null field in `raw_payload` is traceable to a phrase in the listing's `description_text` (cross-check manually — no hallucination)
- No letter grades anywhere in the output
- Boolean fields correctly `true` only when text explicitly claims them
- Numeric fields (stamps_count, owner count) extracted only when a specific number appears

If any extraction hallucinates or mis-parses, iterate on `buildSignalExtractionPrompt` in `src/lib/ai/prompts.ts` and re-run until all three outputs pass inspection.

- [ ] **Step 5: Commit validated fixtures**

```bash
cd producto && git add scripts/validate-gemini-extraction.ts src/lib/ai/__fixtures__/gemini-signals-*.json && git commit -m "test(haus-report): validated Gemini extraction against 3 real listings, regression fixtures committed"
```

---

## Phase 6 — API Route Integration (wire extractors → engine → DB)

### Task 29: Extend `lib/reports/queries.ts` with Haus Report upsert helpers

**Files:**
- Modify: `src/lib/reports/queries.ts` (add helpers if missing; may exist from 2026-03-17 spec)
- Create: `src/lib/reports/queries.test.ts` (unit test for the new helpers, mocking Supabase)

- [ ] **Step 1: Add `saveHausReport` + `saveSignals` functions**

Ensure `src/lib/reports/queries.ts` exports:

```typescript
import type { HausReport, DetectedSignal } from "@/lib/fairValue/types"
import { createSupabaseServerClient } from "@/lib/supabase/server" // adapt to project's server-client helper

export async function saveHausReport(listingId: string, report: Omit<HausReport, "listing_id">): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from("listing_reports").upsert({
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
    updated_at: new Date().toISOString(),
  }, { onConflict: "listing_id" })

  if (error) throw new Error(`saveHausReport failed: ${error.message}`)
}

export async function saveSignals(listingId: string, runId: string, version: string, signals: DetectedSignal[]): Promise<void> {
  if (signals.length === 0) return
  const supabase = createSupabaseServerClient()
  const rows = signals.map((s) => ({
    listing_id: listingId,
    extraction_run_id: runId,
    signal_key: s.key,
    signal_value_json: { value_display: s.value_display, name_i18n_key: s.name_i18n_key },
    evidence_source_type: s.evidence.source_type,
    evidence_source_ref: s.evidence.source_ref,
    evidence_raw_excerpt: s.evidence.raw_excerpt,
    evidence_confidence: s.evidence.confidence,
    extraction_version: version,
  }))
  const { error } = await supabase.from("listing_signals").insert(rows)
  if (error) throw new Error(`saveSignals failed: ${error.message}`)
}
```

- [ ] **Step 2: Write unit test with mocked Supabase client**

```typescript
// src/lib/reports/queries.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}))

import { saveHausReport, saveSignals } from "./queries"
import type { HausReport } from "@/lib/fairValue/types"

describe("saveHausReport", () => {
  it("calls upsert on listing_reports", async () => {
    const report: Omit<HausReport, "listing_id"> = {
      fair_value_low: 100, fair_value_high: 200, median_price: 150,
      specific_car_fair_value_low: 140, specific_car_fair_value_mid: 150, specific_car_fair_value_high: 160,
      comparable_layer_used: "strict", comparables_count: 7,
      signals_detected: [], signals_missing: [],
      modifiers_applied: [], modifiers_total_percent: 0,
      signals_extracted_at: new Date().toISOString(), extraction_version: "v1.0",
    }
    await expect(saveHausReport("listing-id", report)).resolves.toBeUndefined()
  })
})

describe("saveSignals", () => {
  it("no-ops when signals is empty", async () => {
    await expect(saveSignals("listing-id", "run-id", "v1.0", [])).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 3: Run — PASS**

Run: `cd producto && npx vitest run src/lib/reports/queries.test.ts`

- [ ] **Step 4: Commit**

```bash
cd producto && git add src/lib/reports/queries.ts src/lib/reports/queries.test.ts && git commit -m "feat(haus-report): saveHausReport and saveSignals Supabase writers"
```

---

### Task 30: Refactor `/api/analyze` route to orchestrate the pipeline

**Files:**
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Replace the route handler body**

```typescript
// src/app/api/analyze/route.ts
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getReportForListing, saveHausReport, saveSignals } from "@/lib/reports/queries"
import { extractTextSignals } from "@/lib/fairValue/extractors/text"
import { extractStructuredSignals } from "@/lib/fairValue/extractors/structured"
import { extractSellerSignal } from "@/lib/fairValue/extractors/seller"
import { applyModifiers, computeSpecificCarFairValue } from "@/lib/fairValue/engine"
import { MODIFIER_LIBRARY_VERSION } from "@/lib/fairValue/modifiers"
import { fetchPricedListingsForModel } from "@/lib/supabaseLiveListings"
import { computeMarketStats } from "@/lib/marketStats"
import type { HausReport, DetectedSignal, MissingSignal } from "@/lib/fairValue/types"

const EXPECTED_SIGNAL_KEYS = [
  "paint_to_sample", "service_records", "previous_owners",
  "original_paint", "accident_history", "documentation",
  "warranty", "seller_tier", "transmission", "mileage",
]

function deriveMissing(detected: DetectedSignal[]): MissingSignal[] {
  const detectedKeys = new Set(detected.map((s) => s.key))
  return EXPECTED_SIGNAL_KEYS
    .filter((k) => !detectedKeys.has(k))
    .map<MissingSignal>((k) => ({
      key: k,
      name_i18n_key: `report.signals.${k}`,
      question_for_seller_i18n_key: `report.questions.${k}_question`,
    }))
}

export async function POST(request: Request) {
  const body = await request.json()
  const { listingId } = body as { listingId: string }
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 })

  const supabase = createSupabaseServerClient()

  // 1. Check for cached report
  const cached = await getReportForListing(listingId)
  if (cached?.signals_extracted_at) {
    return NextResponse.json({ ok: true, report: cached, cached: true })
  }

  // 2. Fetch listing
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single()
  if (listingErr || !listing) return NextResponse.json({ error: "listing not found" }, { status: 404 })

  // 3. Fetch comparables + compute market stats (existing helpers from 2026-03-17 work)
  const priced = await fetchPricedListingsForModel(listing.make, listing.model)
  const marketStats = computeMarketStats(priced, "strict") // layer picking happens in computeMarketStats
  if (!marketStats) {
    return NextResponse.json({ error: "insufficient market data" }, { status: 422 })
  }

  // 4. Run extractors
  const structuredSignals = extractStructuredSignals(listing as any)
  const sellerSignal = extractSellerSignal({
    sellerName: listing.seller_name ?? null,
    sellerDomain: listing.seller_domain ?? null,
  })
  const textResult = await extractTextSignals({ description: listing.description_text ?? "" })

  const detected: DetectedSignal[] = [
    ...structuredSignals,
    ...(sellerSignal ? [sellerSignal] : []),
    ...(textResult.ok ? textResult.signals : []),
  ]

  // 5. Apply modifiers + compute specific-car fair value
  const baselineUsd = marketStats.primaryFairValueLow + (marketStats.primaryFairValueHigh - marketStats.primaryFairValueLow) / 2
  const { appliedModifiers, totalPercent } = applyModifiers({ baselineUsd, signals: detected })
  const specific = computeSpecificCarFairValue({ baselineUsd, totalPercent })

  // 6. Compose HausReport
  const runId = randomUUID()
  const now = new Date().toISOString()
  const report: HausReport = {
    listing_id: listingId,
    fair_value_low: marketStats.primaryFairValueLow,
    fair_value_high: marketStats.primaryFairValueHigh,
    median_price: baselineUsd,
    specific_car_fair_value_low: specific.low,
    specific_car_fair_value_mid: specific.mid,
    specific_car_fair_value_high: specific.high,
    comparable_layer_used: "strict", // TODO: expose the layer from computeMarketStats
    comparables_count: marketStats.totalDataPoints,
    signals_detected: detected,
    signals_missing: deriveMissing(detected),
    modifiers_applied: appliedModifiers,
    modifiers_total_percent: totalPercent,
    signals_extracted_at: textResult.ok ? now : null,
    extraction_version: MODIFIER_LIBRARY_VERSION,
  }

  // 7. Persist
  await saveHausReport(listingId, report)
  await saveSignals(listingId, runId, MODIFIER_LIBRARY_VERSION, detected)

  return NextResponse.json({ ok: true, report, cached: false })
}
```

- [ ] **Step 2: Verify no type errors**

Run: `cd producto && npx tsc --noEmit src/app/api/analyze/route.ts`
Expected: zero errors. If `fetchPricedListingsForModel` or `computeMarketStats` have different signatures, adapt the calls to match.

- [ ] **Step 3: Commit**

```bash
cd producto && git add src/app/api/analyze/route.ts && git commit -m "feat(haus-report): /api/analyze orchestrates extractors + engine + persistence"
```

---

### Task 31: Replace fixture in `ReportClient.tsx` with API-fetched report

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/page.tsx`
- Modify: `src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx`
- Modify: `src/hooks/useAnalysis.ts` (if exists — adapt to new response shape)

- [ ] **Step 1: Update `page.tsx` to prefer real report, fall back to mock in development**

```typescript
// Only keep mock-mode when explicitly requested via query param (for design iteration).
const mockName = searchParams.get("mock")
let report: HausReport | null = null
if (mockName === "992gt3" || mockName === "sparse") {
  const name = mockName === "992gt3" ? "992-gt3-pts-mock" : "991-carrera-sparse-mock"
  const fixture = (await import(`@/lib/fairValue/__fixtures__/${name}.json`)).default
  report = fixture as HausReport
} else {
  report = await getReportForListing(id)
}
```

- [ ] **Step 2: Update the "Generate" button in `ReportClient.tsx`**

Find the button that triggers report generation. Update its handler:

```typescript
const handleGenerate = async () => {
  setGenerating(true)
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: car.id }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error ?? "generation failed")
    // Reload page so server component re-fetches the now-persisted report
    window.location.reload()
  } catch (err) {
    console.error(err)
    alert("Failed to generate Haus Report. Please try again.")
  } finally {
    setGenerating(false)
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd producto && git add src/app/[locale]/cars/[make]/[id]/ src/hooks/useAnalysis.ts && git commit -m "feat(haus-report): wire ReportClient to real /api/analyze, keep ?mock= for design"
```

---

### Task 32: End-to-end integration smoke test

**Files:**
- Create: `tests/e2e/haus-report.spec.ts` (Playwright)

- [ ] **Step 1: Write a Playwright E2E spec**

```typescript
// tests/e2e/haus-report.spec.ts
import { test, expect } from "@playwright/test"

const TEST_LISTING_ID = process.env.TEST_LISTING_ID ?? ""

test.skip(!TEST_LISTING_ID, "set TEST_LISTING_ID to run")

test("free view shows teaser; paid view shows Haus Report", async ({ page }) => {
  await page.goto(`/en/cars/porsche/${TEST_LISTING_ID}`)

  // Free view: teaser visible, no AAA anywhere
  await expect(page.getByText("Haus Report available")).toBeVisible()
  await expect(page.getByText(/\bAAA\b|Investment Grade/i)).toHaveCount(0)

  // Go to report page with mock fixture for deterministic E2E
  await page.goto(`/en/cars/porsche/${TEST_LISTING_ID}/report?mock=992gt3`)

  await expect(page.getByText(/specific.?car fair value/i)).toBeVisible()
  await expect(page.getByText("Signals Detected")).toBeVisible()
  await expect(page.getByText(/Data we couldn't verify/i)).toBeVisible()
  await expect(page.getByText("+10%")).toBeVisible() // Paint-to-Sample modifier
  await expect(page.getByText(/source/i)).toBeVisible() // citation link
})
```

- [ ] **Step 2: Run**

Run: `cd producto && TEST_LISTING_ID=<any-real-listing-id> npx playwright test haus-report.spec.ts`
Expected: both scenarios pass.

- [ ] **Step 3: Commit**

```bash
cd producto && git add tests/e2e/haus-report.spec.ts && git commit -m "test(haus-report): E2E smoke test for free view teaser + paid report rendering"
```

---

### Task 33: Final audit + shipping checklist

- [ ] **Step 1: Full type-check + test run**

Run: `cd producto && npx tsc --noEmit && npm test && npx playwright test`
Expected: green on all fronts.

- [ ] **Step 2: Final AAA grep**

Run: `cd producto && grep -rn "investmentGrade\|InvestmentGrade\|AAA\|\"AA\"\|\"B+\"" src/ messages/ 2>/dev/null | grep -v "__tests__\|\.test\.\|\.md"`
Expected: zero results.

- [ ] **Step 3: Verify GEMINI_API_KEY + GEMINI_MODEL set in production env**

Manually confirm both vars are present in Vercel Dashboard → Settings → Environment Variables for the `Production` environment. Key should match `.env.local`; `GEMINI_MODEL` should be `gemini-2.5-flash`.

- [ ] **Step 4: Verify migrations applied in production Supabase**

Check production DB: both `listing_signals` table and the `listing_reports` extension columns are present.

- [ ] **Step 5: Final commit + PR**

```bash
cd producto && git push origin Front-monzaaa
# Open a PR from Front-monzaaa against main (or the project's merge target)
```

PR description should reference this plan + the spec and summarize: AAA removed, Haus Report added, Gemini 2.5-flash wired with validated prompts, both fixtures and 3 Gemini regression fixtures committed.

---

## Self-Review Notes (for the implementer)

**Spec coverage check (done while writing):**
- §3 Free view design → Tasks 8–12, 20 ✓
- §4 Haus Report UI sections → Tasks 16–21 ✓
- §5 Signal extraction (sources 1+2+5) → Tasks 23, 24, 26 ✓
- §6 Modifier library → Tasks 2, 3 ✓
- §7 AAA removal → Tasks 6, 7, 9–14 ✓
- §8 Data contracts + SQL → Tasks 1, 22 ✓
- §9 Mock fixtures → Tasks 4, 5 ✓
- §10 Gemini prompt + testing → Tasks 25, 26, 27, 28 ✓
- §11 Phased execution → structure of this plan ✓
- §12 Out of scope — respected (no photos, no Kardex, no user override) ✓

**Type consistency check:**
- `HausReport` shape from Task 1 is referenced identically in Tasks 4, 5, 21, 29, 30, 31 ✓
- `DetectedSignal`, `AppliedModifier`, `MissingSignal`, `SignalEvidence` — same spelling across all tasks ✓
- `MODIFIER_LIBRARY_VERSION` = `"v1.0"` used consistently ✓

**Known trade-offs (implementer's call):**
- `saveHausReport` uses `@/lib/supabase/server` — if that module path doesn't exist, replace with the project's actual server-side Supabase client helper. Task 29 Step 1 note.
- Task 30 has a `TODO: expose the layer from computeMarketStats` — `computeMarketStats` currently doesn't return which layer (strict/series/family) was used. Implementer may need to extend that function in a small pre-task before Task 30 to expose `layer_used` in the result.
- Two modifiers (`warranty_remaining`, `seller_tier_specialist`) have `citation_url: null`. Per spec §14 decision, either find a public source before shipping OR set their `base_percent: 0` so they don't run. Tracked in Task 2 commit note.
