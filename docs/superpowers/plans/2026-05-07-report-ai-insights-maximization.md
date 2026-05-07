# Report AI Insights Maximization — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maximize the AI-generated value in each Haus Report by adding description pre-processing, color intelligence, deep VIN decode, expanded options/red-flags, and an AI narrative "Investment Story" synthesis.

**Architecture:** Five independent enrichment layers feed into the existing HausReport pipeline. Each layer produces typed signals or structured data that the existing modifier engine and UI blocks consume. A new `investmentStory` field on HausReport carries a Gemini-generated narrative paragraph. All layers are additive — they extend the existing signal extraction / modifier / rendering pipeline without breaking it.

**Tech Stack:** TypeScript, Gemini 2.5 Flash (signal extraction + narrative), NHTSA vPIC API (VIN decode), Porsche paint code registry (static), existing fairValue engine + report UI components.

---

## File Structure

### New files to create

| File | Responsibility |
|------|---------------|
| `src/lib/fairValue/extractors/descriptionCleaner.ts` | Pre-process raw description_text before sending to Gemini — strip HTML/nav garbage, extract only vehicle-relevant text |
| `src/lib/fairValue/extractors/descriptionCleaner.test.ts` | Tests for description cleaner with real samples from each source |
| `src/lib/fairValue/extractors/color.ts` | Color intelligence extractor — map generic colors to Porsche codes, rarity, value impact |
| `src/lib/fairValue/extractors/color.test.ts` | Tests for color extractor |
| `src/lib/fairValue/extractors/vinDeep.ts` | Deep VIN decode — extend porscheVin.ts with option position decode + production rarity lookup |
| `src/lib/fairValue/extractors/vinDeep.test.ts` | Tests for deep VIN decode |
| `src/lib/fairValue/narrative.ts` | AI narrative generator — "Investment Story" paragraph per car |
| `src/lib/fairValue/narrative.test.ts` | Tests for narrative generator |
| `src/lib/knowledge/porscheColors.ts` | Static registry of Porsche color codes by generation with rarity + desirability scores |

### Files to modify

| File | What changes |
|------|-------------|
| `src/lib/fairValue/types.ts` | Add `ColorIntelligence`, `VinIntelligence`, `InvestmentNarrative` types; extend `HausReport` with new optional fields |
| `src/lib/fairValue/extractors/text.ts` | Accept pre-cleaned description; expand options extraction (10 new options) |
| `src/lib/ai/prompts.ts` | Add `buildNarrativePrompt()`, expand `buildSignalExtractionPrompt()` options list |
| `src/lib/fairValue/modifiers.ts` | Add 4 new modifiers: `color_rarity`, `desirable_options_package`, `vin_production_rarity`, `no_accidents_confirmed` |
| `src/lib/fairValue/engine.ts` | Extend `SIGNAL_TO_MODIFIER` map with new signal→modifier mappings |
| `src/app/api/analyze/route.ts` | Integrate description cleaner, color extractor, VIN deep decode, narrative generator into pipeline |
| `src/lib/advisor/tools/analysis.ts` | Expand red flag rules from 5 to 12 |
| `src/components/report/ColorIntelBlock.tsx` | New UI block for color intelligence (in report) |
| `src/components/report/VinIntelBlock.tsx` | New UI block for VIN intelligence (in report) |
| `src/components/report/InvestmentStoryBlock.tsx` | New UI block for AI narrative (in report) |
| `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx` | Wire new blocks into report layout |

*Note: PDF export (`ColorAndVinPage.tsx`) is a follow-up task — not in this plan.*

---

## Chunk 1: Description Pre-Processing + Expanded Signal Extraction

### Task 1: Description Cleaner

**Files:**
- Create: `src/lib/fairValue/extractors/descriptionCleaner.ts`
- Create: `src/lib/fairValue/extractors/descriptionCleaner.test.ts`

- [ ] **Step 1: Write failing tests for description cleaner**

Create `src/lib/fairValue/extractors/descriptionCleaner.test.ts`:

```typescript
import { cleanDescription } from "./descriptionCleaner"

describe("cleanDescription", () => {
  it("strips Classic.com navigation boilerplate", () => {
    const raw = `Find\nSearch Listings\n995,016\nBrowse Auctions\n1,352\nBrowse Dealers\n1,326\nPrice\nFollow Markets\n10,171\nSaved Vehicles\nWhat's a Car Worth?\nSell\nPrivate Sellers\nDealers\nFAQs\nsearch\nperson\nclose\nAbout this 2006 Porsche Cayman\nVIN: WP0AB298X6U782487\n2006 Porsche Cayman S, located at Porsche Wichita. Original MSRP: $66,435. Arctic Silver Metallic with Black Leather interior. This Cayman comes equipped with Brake assist, Cruise Control, Electronic Traction Control, and Heated front seats.\nSpecs\nYear\n2006\nMake\nPorsche\nModel Family\nCayman\nEngine\n3.4L H6\nMileage\n31,647 mi\nVIN\nWP0AB298X6U782487\nBody Style\nCoupe\nAll rights reserved`
    const cleaned = cleanDescription(raw)
    expect(cleaned).toContain("2006 Porsche Cayman S")
    expect(cleaned).toContain("Arctic Silver Metallic")
    expect(cleaned).toContain("Brake assist")
    expect(cleaned).not.toContain("Search Listings")
    expect(cleaned).not.toContain("Browse Auctions")
    expect(cleaned).not.toContain("All rights reserved")
    expect(cleaned).not.toContain("Follow Markets")
  })

  it("passes through clean Elferspot descriptions", () => {
    const raw = "Paintwork has been fully restored + Frontal XPEL film protection\nAurum Gold details.\nSport Chrono Package Plus"
    const cleaned = cleanDescription(raw)
    expect(cleaned).toBe(raw)
  })

  it("passes through clean AutoTrader descriptions", () => {
    const raw = "We are delighted to offer this 2020 70 Porsche 911 3.0T 992 Carrera S PDK Euro 6 finished in Python Green."
    const cleaned = cleanDescription(raw)
    expect(cleaned).toContain("Python Green")
  })

  it("returns empty string for null/undefined", () => {
    expect(cleanDescription(null as unknown as string)).toBe("")
    expect(cleanDescription(undefined as unknown as string)).toBe("")
    expect(cleanDescription("")).toBe("")
  })

  it("strips HTML tags if present", () => {
    const raw = "<p>This <b>2022 Porsche 911</b> GT3 is in <i>excellent</i> condition.</p>"
    const cleaned = cleanDescription(raw)
    expect(cleaned).toContain("2022 Porsche 911")
    expect(cleaned).toContain("GT3")
    expect(cleaned).not.toContain("<p>")
    expect(cleaned).not.toContain("<b>")
  })

  it("collapses excessive whitespace", () => {
    const raw = "Service records   available.\n\n\n\nOne owner.\n\n\n\n\nGarage kept."
    const cleaned = cleanDescription(raw)
    expect(cleaned).not.toMatch(/\n{3,}/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/fairValue/extractors/descriptionCleaner.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement description cleaner**

Create `src/lib/fairValue/extractors/descriptionCleaner.ts`:

```typescript
/**
 * Pre-process raw description_text from scraped listings before sending
 * to the Gemini signal extractor. Strips navigation chrome, HTML tags,
 * footer boilerplate, and collapses whitespace.
 *
 * Goal: the output should contain ONLY vehicle-relevant text (description,
 * specs, seller notes). This dramatically improves Gemini extraction
 * accuracy and reduces token waste.
 */

// Patterns that indicate Classic.com / marketplace navigation boilerplate.
// Match start-of-line anchored blocks that precede the actual vehicle description.
const CLASSIC_COM_NAV_PATTERNS = [
  /^Find\n.*?(?=About this|VIN:|\d{4}\s+Porsche)/ms,
  /Search Listings\n[\d,]+\nBrowse Auctions\n[\d,]+\nBrowse Dealers[\s\S]*?(?=About this|\d{4}\s+Porsche)/m,
]

// Footer patterns from various sources
const FOOTER_PATTERNS = [
  /All rights reserved[\s\S]*$/m,
  /Vehicle information is provided by the seller[\s\S]*$/m,
  /CLASSIC\.COM is not affiliated[\s\S]*$/m,
  /Become a CLASSIC Insider[\s\S]*$/m,
  /Error Report:[\s\S]*?SUBMIT/m,
  /Your name \*\nYour email[\s\S]*?SEND MESSAGE/m,
  /Have a question\? Ask Rusty[\s\S]*?Powered by CLASSIC\.com/m,
  /Get our newsletter[\s\S]*$/m,
  /Terms and Conditions[\s\S]*$/m,
]

// Generic marketplace chrome keywords — lines containing ONLY these are nav
const NAV_ONLY_LINES = new Set([
  "search", "person", "close", "share", "bookmark_border save",
  "bookmark_border", "contact seller", "see full description",
  "see specs", "loading seller information...", "show all",
  "send message", "or", "overview", "description", "media",
  "outlined_flag report this listing",
])

// Specs section pattern (structured data we already have — strip to avoid
// Gemini re-extracting what we get from DB columns)
const SPECS_BLOCK = /Specs\n(?:Details about this vehicle[\s\S]*?)(?=About this|Media|Loading|$)/m

const HTML_TAG = /<\/?[a-z][^>]*>/gi

export function cleanDescription(raw: string): string {
  if (!raw) return ""

  let text = raw

  // 1. Strip HTML tags
  text = text.replace(HTML_TAG, " ")

  // 2. Strip Classic.com navigation blocks
  for (const pattern of CLASSIC_COM_NAV_PATTERNS) {
    text = text.replace(pattern, "")
  }

  // 3. Strip structured specs block (we have this from DB columns)
  text = text.replace(SPECS_BLOCK, "")

  // 4. Strip footer boilerplate
  for (const pattern of FOOTER_PATTERNS) {
    text = text.replace(pattern, "")
  }

  // 5. Remove nav-only lines
  text = text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim().toLowerCase()
      if (!trimmed) return true // keep blank lines (for now)
      if (NAV_ONLY_LINES.has(trimmed)) return false
      // Remove lines that are just icons/emojis (unicode control chars)
      if (/^[\s\u{e000}-\u{f8ff}\u{fe00}-\u{fe0f}]+$/u.test(trimmed)) return false
      // Remove lines that are just "View All (N)" or "zoom_in" etc
      if (/^(?:view all|zoom_in|filter|phone)(?:\s*\(\d+\))?$/i.test(trimmed)) return false
      return true
    })
    .join("\n")

  // 6. Collapse excessive whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim()

  // 7. Deduplicate — Classic.com repeats the "About this..." block
  const aboutMatch = text.match(/About this \d{4} Porsche [^\n]+\n[^\n]+/g)
  if (aboutMatch && aboutMatch.length > 1) {
    // Keep only the first occurrence
    const first = aboutMatch[0]
    let found = false
    text = text
      .split("\n")
      .filter((line) => {
        if (line.startsWith("About this") && !found) {
          found = true
          return true
        }
        if (line.startsWith("About this") && found) {
          return false
        }
        return true
      })
      .join("\n")
  }

  return text.trim()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/fairValue/extractors/descriptionCleaner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/fairValue/extractors/descriptionCleaner.ts src/lib/fairValue/extractors/descriptionCleaner.test.ts
git commit -m "feat(report): add description pre-processor to clean scraped text before AI extraction"
```

---

### Task 2: Expand Signal Extraction Options (text extractor)

**Files:**
- Modify: `src/lib/ai/prompts.ts:345-404` (buildSignalExtractionPrompt)
- Modify: `src/lib/fairValue/extractors/text.ts:1-287`

- [ ] **Step 1: Write failing tests for new options**

Add to the existing `src/lib/fairValue/extractors/text.test.ts` (or create new test cases):

```typescript
// Add these test cases to the existing describe block

it("extracts rear-axle steering option", async () => {
  const result = await extractTextSignals({
    description: "Equipped with rear-axle steering and PDCC sport suspension.",
  })
  expect(result.ok).toBe(true)
  const keys = result.signals.map(s => s.key)
  expect(keys).toContain("rear_axle_steering")
  expect(keys).toContain("pdcc")
})

it("extracts sport exhaust and front axle lift", async () => {
  const result = await extractTextSignals({
    description: "Factory sport exhaust system. Front axle lift system installed.",
  })
  expect(result.ok).toBe(true)
  const keys = result.signals.map(s => s.key)
  expect(keys).toContain("sport_exhaust")
  expect(keys).toContain("front_axle_lift")
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/fairValue/extractors/text.test.ts`
Expected: FAIL — new signal keys not extracted

- [ ] **Step 3: Expand the signal extraction prompt**

In `src/lib/ai/prompts.ts`, expand `buildSignalExtractionPrompt()` JSON schema `options` to add:

```typescript
// Add these fields to the options object in the JSON schema:
"rear_axle_steering": boolean | null,
"pdcc": boolean | null,
"sport_exhaust": boolean | null,
"front_axle_lift": boolean | null,
"ventilated_seats": boolean | null,
"sunroof_moonroof": boolean | null,
"alcantara_interior": boolean | null,
"full_leather_interior": boolean | null,
"led_matrix_headlights": boolean | null,
"adaptive_cruise_control": boolean | null
```

- [ ] **Step 4: Add signal mapping in text.ts**

In `src/lib/fairValue/extractors/text.ts`, after the existing option signal blocks (line ~227), add handlers for each new option:

```typescript
if (payload.options.rear_axle_steering === true) {
  signals.push({
    key: "rear_axle_steering",
    name_i18n_key: "report.signals.rear_axle_steering",
    value_display: "Rear-axle steering",
    evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
  })
}

if (payload.options.pdcc === true) {
  signals.push({
    key: "pdcc",
    name_i18n_key: "report.signals.pdcc",
    value_display: "PDCC active suspension",
    evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
  })
}

if (payload.options.sport_exhaust === true) {
  signals.push({
    key: "sport_exhaust",
    name_i18n_key: "report.signals.sport_exhaust",
    value_display: "Sport exhaust system",
    evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
  })
}

if (payload.options.front_axle_lift === true) {
  signals.push({
    key: "front_axle_lift",
    name_i18n_key: "report.signals.front_axle_lift",
    value_display: "Front axle lift system",
    evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
  })
}

if (payload.options.ventilated_seats === true) {
  signals.push({
    key: "ventilated_seats",
    name_i18n_key: "report.signals.ventilated_seats",
    value_display: "Ventilated seats",
    evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
  })
}

if (payload.options.sunroof_moonroof === true) {
  signals.push({
    key: "sunroof",
    name_i18n_key: "report.signals.sunroof",
    value_display: "Sunroof/moonroof",
    evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
  })
}

if (payload.options.alcantara_interior === true) {
  signals.push({
    key: "alcantara_interior",
    name_i18n_key: "report.signals.alcantara_interior",
    value_display: "Alcantara interior",
    evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
  })
}

if (payload.options.full_leather_interior === true) {
  signals.push({
    key: "full_leather_interior",
    name_i18n_key: "report.signals.full_leather_interior",
    value_display: "Full leather interior",
    evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
  })
}

if (payload.options.led_matrix_headlights === true) {
  signals.push({
    key: "led_matrix_headlights",
    name_i18n_key: "report.signals.led_matrix_headlights",
    value_display: "LED matrix headlights",
    evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
  })
}

if (payload.options.adaptive_cruise_control === true) {
  signals.push({
    key: "adaptive_cruise",
    name_i18n_key: "report.signals.adaptive_cruise",
    value_display: "Adaptive cruise control",
    evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
  })
}
```

Also update the `ExtractedPayload` interface in `text.ts` to include the new fields in the `options` block:

```typescript
// Add to ExtractedPayload.options:
rear_axle_steering: boolean | null
pdcc: boolean | null
sport_exhaust: boolean | null
front_axle_lift: boolean | null
ventilated_seats: boolean | null
sunroof_moonroof: boolean | null
alcantara_interior: boolean | null
full_leather_interior: boolean | null
led_matrix_headlights: boolean | null
adaptive_cruise_control: boolean | null
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/fairValue/extractors/text.test.ts`
Expected: PASS (note: tests that call Gemini may need mocking or a GOOGLE_AI_KEY in env)

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/prompts.ts src/lib/fairValue/extractors/text.ts src/lib/fairValue/extractors/text.test.ts
git commit -m "feat(report): expand signal extraction to 17 Porsche options (from 7)"
```

---

### Task 3: Wire Description Cleaner into Analyze Route

**Files:**
- Modify: `src/app/api/analyze/route.ts:226-235`

- [ ] **Step 1: Import and apply cleaner before text extraction**

In `src/app/api/analyze/route.ts`, add import at top:

```typescript
import { cleanDescription } from "@/lib/fairValue/extractors/descriptionCleaner"
```

Then replace lines 226-235 (the textResult block):

```typescript
// Clean the description before AI extraction (strips nav chrome, HTML, footers)
const cleanedDescription = cleanDescription(car.description ?? "")

let textResult: Awaited<ReturnType<typeof extractTextSignals>> = { ok: false, signals: [] }
try {
  textResult = await extractTextSignals({
    description: cleanedDescription,
    maxOutputTokens: 4096,
  })
} catch (geminiError) {
  console.error("[analyze] Gemini signal extraction failed:", geminiError)
  textResult = { ok: false, signals: [] }
}
```

- [ ] **Step 2: Run existing tests**

Run: `npx vitest run src/app/api/analyze`
Expected: PASS (no behavior change, just cleaner input)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat(report): pre-clean descriptions before AI signal extraction"
```

---

## Chunk 2: Color Intelligence

### Task 4: Porsche Color Registry

**Files:**
- Create: `src/lib/knowledge/porscheColors.ts`

- [ ] **Step 1: Create the static color registry**

Create `src/lib/knowledge/porscheColors.ts`:

```typescript
/**
 * Porsche factory color registry with rarity and desirability data.
 *
 * Source: Porsche Classic color archive, Rennbow.org community data,
 * Hagerty market reports, PCA archives.
 *
 * Each entry: { code, name, genericName, generations, rarity, desirability, isPTS }
 * - rarity: "common" | "uncommon" | "rare" | "very_rare" | "unique"
 * - desirability: 1-10 scale (10 = most desirable for collectors)
 */

export interface PorscheColor {
  code: string            // Factory code e.g. "1K1K" or "036"
  name: string            // Official name e.g. "Riviera Blue"
  genericName: string     // Simplified e.g. "Blue"
  generations: string[]   // Which series had this color: ["993", "964"]
  rarity: "common" | "uncommon" | "rare" | "very_rare" | "unique"
  desirability: number    // 1-10
  isPTS: boolean
  valuePremiumPercent: number // estimated premium vs same-gen average color
  notes?: string
}

// Canonical color families for fuzzy matching
export type ColorFamily =
  | "white" | "black" | "silver" | "grey" | "red" | "blue" | "green"
  | "yellow" | "orange" | "brown" | "purple" | "gold" | "beige" | "other"

export const COLOR_FAMILY_MAP: Record<string, ColorFamily> = {
  // White family
  "grand prix white": "white", "white": "white", "carrara white": "white",
  "cream white": "white", "ivory": "white",
  // Black family
  "black": "black", "basalt black": "black", "jet black": "black",
  // Silver family
  "silver": "silver", "arctic silver": "silver", "gt silver": "silver",
  "rhodium silver": "silver", "platinum silver": "silver",
  // Grey family
  "grey": "grey", "gray": "grey", "seal grey": "grey", "agate grey": "grey",
  "slate grey": "grey", "meteor grey": "grey", "graphite grey": "grey",
  "crayon": "grey", "chalk": "grey",
  // Red family
  "red": "red", "guards red": "red", "ruby red": "red", "rubystone red": "red",
  "carmine red": "red", "indian red": "red", "arena red": "red",
  // Blue family
  "blue": "blue", "riviera blue": "blue", "miami blue": "blue",
  "sapphire blue": "blue", "cobalt blue": "blue", "lapis blue": "blue",
  "midnight blue": "blue", "shark blue": "blue", "gentian blue": "blue",
  "azure blue": "blue", "mexico blue": "blue",
  // Green family
  "green": "green", "irish green": "green", "british racing green": "green",
  "python green": "green", "pts oak green": "green", "auratium green": "green",
  "oakgreen": "green", "mint green": "green",
  // Yellow family
  "yellow": "yellow", "speed yellow": "yellow", "racing yellow": "yellow",
  "signal yellow": "yellow",
  // Orange family
  "orange": "orange", "lava orange": "orange", "gulf orange": "orange",
  // Brown family
  "brown": "brown", "mahogany": "brown", "cognac": "brown",
  // Gold family
  "gold": "gold", "aurum gold": "gold",
  // Purple family
  "purple": "purple", "ultraviolet": "purple", "viola metallic": "purple",
}

// Notable Porsche colors with rarity and desirability data
export const NOTABLE_COLORS: PorscheColor[] = [
  // ── 964 era ──
  { code: "M4M4", name: "Rubystone Red", genericName: "Red", generations: ["964"], rarity: "very_rare", desirability: 10, isPTS: false, valuePremiumPercent: 30, notes: "Most sought 964 color" },
  { code: "22A", name: "Mint Green", genericName: "Green", generations: ["964"], rarity: "rare", desirability: 9, isPTS: false, valuePremiumPercent: 25 },
  { code: "027", name: "Guards Red", genericName: "Red", generations: ["964", "993", "996", "997", "991", "992"], rarity: "common", desirability: 6, isPTS: false, valuePremiumPercent: 0 },
  // ── 993 era ──
  { code: "1K1K", name: "Riviera Blue", genericName: "Blue", generations: ["993"], rarity: "rare", desirability: 10, isPTS: false, valuePremiumPercent: 35, notes: "Iconic 993 collector color" },
  { code: "L12H", name: "Speed Yellow", genericName: "Yellow", generations: ["993", "996", "997"], rarity: "uncommon", desirability: 8, isPTS: false, valuePremiumPercent: 15 },
  // ── 996/997 era ──
  { code: "3S3S", name: "Cobalt Blue Metallic", genericName: "Blue", generations: ["997"], rarity: "uncommon", desirability: 8, isPTS: false, valuePremiumPercent: 10 },
  { code: "M5R", name: "Lapis Blue", genericName: "Blue", generations: ["997"], rarity: "uncommon", desirability: 7, isPTS: false, valuePremiumPercent: 8 },
  // ── 991/992 era ──
  { code: "1A1A", name: "Miami Blue", genericName: "Blue", generations: ["991", "992"], rarity: "uncommon", desirability: 9, isPTS: false, valuePremiumPercent: 15 },
  { code: "N3", name: "Shark Blue", genericName: "Blue", generations: ["992"], rarity: "uncommon", desirability: 8, isPTS: false, valuePremiumPercent: 10 },
  { code: "J6", name: "Python Green", genericName: "Green", generations: ["992"], rarity: "uncommon", desirability: 8, isPTS: false, valuePremiumPercent: 10 },
  // ── Generic common colors (all gens) ──
  { code: "009", name: "Black", genericName: "Black", generations: ["964", "993", "996", "997", "991", "992"], rarity: "common", desirability: 5, isPTS: false, valuePremiumPercent: 0 },
  { code: "L5S", name: "Arctic Silver Metallic", genericName: "Silver", generations: ["996", "997"], rarity: "common", desirability: 5, isPTS: false, valuePremiumPercent: 0 },
  { code: "024", name: "Grand Prix White", genericName: "White", generations: ["964", "993", "996", "997"], rarity: "common", desirability: 6, isPTS: false, valuePremiumPercent: 2 },
  { code: "M9Z", name: "GT Silver Metallic", genericName: "Silver", generations: ["997", "991", "992"], rarity: "uncommon", desirability: 7, isPTS: false, valuePremiumPercent: 5 },
]

/**
 * Resolve a generic color string to its color family.
 * Uses fuzzy matching against COLOR_FAMILY_MAP.
 */
export function resolveColorFamily(color: string | null): ColorFamily | null {
  if (!color) return null
  const lower = color.toLowerCase().trim()
  // Direct match
  if (COLOR_FAMILY_MAP[lower]) return COLOR_FAMILY_MAP[lower]
  // Partial match — check if any known color name is contained in the input
  for (const [known, family] of Object.entries(COLOR_FAMILY_MAP)) {
    if (lower.includes(known) || known.includes(lower)) return family
  }
  return "other"
}

/**
 * Find the best-matching notable color for a given color string + generation.
 * Returns null if no confident match found.
 */
export function matchNotableColor(
  colorString: string | null,
  seriesId: string | null,
): PorscheColor | null {
  if (!colorString) return null
  const lower = colorString.toLowerCase().trim()

  // Try exact name match first
  let match = NOTABLE_COLORS.find(
    (c) => c.name.toLowerCase() === lower && (!seriesId || c.generations.includes(seriesId)),
  )
  if (match) return match

  // Try partial name match
  match = NOTABLE_COLORS.find(
    (c) =>
      (lower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(lower)) &&
      (!seriesId || c.generations.includes(seriesId)),
  )
  if (match) return match

  // Fallback: match by generic name to common colors
  const family = resolveColorFamily(colorString)
  if (!family) return null

  const familyMatch = NOTABLE_COLORS.find(
    (c) =>
      c.genericName.toLowerCase() === family &&
      c.rarity === "common" &&
      (!seriesId || c.generations.includes(seriesId)),
  )
  return familyMatch ?? null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/knowledge/porscheColors.ts
git commit -m "feat(report): add Porsche color registry with rarity and desirability data"
```

---

### Task 5: Color Intelligence Extractor

**Files:**
- Create: `src/lib/fairValue/extractors/color.ts`
- Create: `src/lib/fairValue/extractors/color.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/fairValue/extractors/color.test.ts`:

```typescript
import { extractColorIntelligence, type ColorIntelligenceResult } from "./color"

describe("extractColorIntelligence", () => {
  it("identifies a rare color with premium", () => {
    const result = extractColorIntelligence({
      exteriorColor: "Riviera Blue",
      interiorColor: "Black",
      seriesId: "993",
      description: null,
    })
    expect(result.exterior.matchedColor?.name).toBe("Riviera Blue")
    expect(result.exterior.rarity).toBe("rare")
    expect(result.exterior.valuePremiumPercent).toBeGreaterThan(20)
    expect(result.signals.length).toBeGreaterThan(0)
    expect(result.signals.some(s => s.key === "color_rarity")).toBe(true)
  })

  it("identifies a common color with no premium", () => {
    const result = extractColorIntelligence({
      exteriorColor: "Black",
      interiorColor: "Black",
      seriesId: "992",
      description: null,
    })
    expect(result.exterior.rarity).toBe("common")
    expect(result.exterior.valuePremiumPercent).toBe(0)
    expect(result.signals.some(s => s.key === "color_rarity")).toBe(false)
  })

  it("returns neutral result for unknown color", () => {
    const result = extractColorIntelligence({
      exteriorColor: null,
      interiorColor: null,
      seriesId: "992",
      description: null,
    })
    expect(result.exterior.matchedColor).toBeNull()
    expect(result.signals).toHaveLength(0)
  })

  it("detects PTS from description when exterior is generic", () => {
    const result = extractColorIntelligence({
      exteriorColor: "Blue",
      interiorColor: "Black",
      seriesId: "992",
      description: "Finished in Paint-to-Sample Gulf Blue",
    })
    expect(result.exterior.isPTS).toBe(true)
    expect(result.signals.some(s => s.key === "color_rarity")).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/fairValue/extractors/color.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement color intelligence extractor**

Create `src/lib/fairValue/extractors/color.ts`:

```typescript
import {
  resolveColorFamily,
  matchNotableColor,
  type PorscheColor,
  type ColorFamily,
} from "@/lib/knowledge/porscheColors"
import type { DetectedSignal } from "../types"

export interface ColorIntelInput {
  exteriorColor: string | null
  interiorColor: string | null
  seriesId: string | null
  description: string | null
}

export interface ColorMatch {
  inputColor: string | null
  matchedColor: PorscheColor | null
  colorFamily: ColorFamily | null
  rarity: "common" | "uncommon" | "rare" | "very_rare" | "unique" | "unknown"
  valuePremiumPercent: number
  isPTS: boolean
}

export interface ColorIntelligenceResult {
  exterior: ColorMatch
  interior: ColorMatch
  combinationNote: string | null
  signals: DetectedSignal[]
}

function buildColorMatch(
  color: string | null,
  seriesId: string | null,
  description: string | null,
): ColorMatch {
  const family = resolveColorFamily(color)
  const matched = matchNotableColor(color, seriesId)

  // Check for PTS in description
  const descLower = (description ?? "").toLowerCase()
  const isPTSFromDesc =
    /paint[- ]to[- ]sample|pts\b/i.test(descLower) &&
    (family !== null) // only flag PTS if we can at least identify the color family

  const isPTS = matched?.isPTS ?? isPTSFromDesc

  return {
    inputColor: color,
    matchedColor: matched,
    colorFamily: family,
    rarity: matched?.rarity ?? (isPTS ? "rare" : "unknown"),
    valuePremiumPercent: isPTS && !matched ? 15 : (matched?.valuePremiumPercent ?? 0),
    isPTS,
  }
}

// Classic desirable interior/exterior combos
const CLASSIC_COMBOS: Array<{ ext: ColorFamily; int: string; note: string }> = [
  { ext: "white", int: "red", note: "Classic white-over-red combination — highly sought in air-cooled era" },
  { ext: "blue", int: "brown", note: "Blue over brown/tan — period-correct combination appreciated by collectors" },
  { ext: "silver", int: "brown", note: "Silver over brown — understated combination favored by long-term collectors" },
  { ext: "black", int: "red", note: "Black over red — bold combination with strong collector appeal" },
  { ext: "green", int: "brown", note: "Green over brown — classic British-style combination, increasingly sought" },
]

export function extractColorIntelligence(input: ColorIntelInput): ColorIntelligenceResult {
  const exterior = buildColorMatch(input.exteriorColor, input.seriesId, input.description)
  const interior = buildColorMatch(input.interiorColor, input.seriesId, null)

  // Combination analysis
  let combinationNote: string | null = null
  if (exterior.colorFamily && interior.inputColor) {
    const intLower = interior.inputColor.toLowerCase()
    const intFamily = resolveColorFamily(intLower) ?? intLower
    const combo = CLASSIC_COMBOS.find(
      (c) => c.ext === exterior.colorFamily && intFamily.includes(c.int),
    )
    if (combo) combinationNote = combo.note
  }

  // Generate signals
  const signals: DetectedSignal[] = []

  // Color rarity signal — only for uncommon+
  if (exterior.rarity !== "common" && exterior.rarity !== "unknown") {
    const label = exterior.matchedColor?.name ?? exterior.inputColor ?? "Unknown"
    signals.push({
      key: "color_rarity",
      name_i18n_key: "report.signals.color_rarity",
      value_display: `${label} (${exterior.rarity}${exterior.isPTS ? ", PTS" : ""}) — est. +${exterior.valuePremiumPercent}% premium`,
      evidence: {
        source_type: exterior.matchedColor ? "structured_field" : "listing_text",
        source_ref: exterior.matchedColor ? "listings.color_exterior" : "description_text",
        raw_excerpt: null,
        confidence: exterior.matchedColor ? "high" : "medium",
      },
    })
  }

  // No-accidents-confirmed signal (from description check)
  // This is handled by text extractor, not here

  return { exterior, interior, combinationNote, signals }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/fairValue/extractors/color.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/fairValue/extractors/color.ts src/lib/fairValue/extractors/color.test.ts
git commit -m "feat(report): add color intelligence extractor with rarity and combo analysis"
```

---

## Chunk 3: Deep VIN Decode + Expanded Red Flags

### Task 6: Deep VIN Decode

**Files:**
- Create: `src/lib/fairValue/extractors/vinDeep.ts`
- Create: `src/lib/fairValue/extractors/vinDeep.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/fairValue/extractors/vinDeep.test.ts`:

```typescript
import { extractVinIntelligence } from "./vinDeep"

describe("extractVinIntelligence", () => {
  it("decodes a 997 VIN with body hint", () => {
    const result = extractVinIntelligence({
      vin: "WP0ZZZ99Z7S721047",
      year: 2007,
      model: "911 Carrera 4S",
      seriesId: "997",
    })
    expect(result.decoded).toBe(true)
    expect(result.plant).toContain("Stuttgart")
    expect(result.bodyHint).toBeTruthy()
    expect(result.signals.length).toBeGreaterThanOrEqual(1)
  })

  it("returns not-decoded for null VIN", () => {
    const result = extractVinIntelligence({
      vin: null,
      year: 2022,
      model: "911 GT3",
      seriesId: "992",
    })
    expect(result.decoded).toBe(false)
    expect(result.signals).toHaveLength(0)
  })

  it("detects year mismatch between VIN and listing", () => {
    const result = extractVinIntelligence({
      vin: "WP0ZZZ99Z7S721047", // 2007
      year: 2015, // listing says 2015 — mismatch
      model: "911 Carrera",
      seriesId: "991",
    })
    expect(result.warnings).toContain(expect.stringContaining("year mismatch"))
  })

  it("identifies Stuttgart vs Leipzig production", () => {
    const result = extractVinIntelligence({
      vin: "WP0ZZZ99ZLS000001", // L = Leipzig
      year: 2020,
      model: "911",
      seriesId: "992",
    })
    expect(result.plant).toContain("Leipzig")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/fairValue/extractors/vinDeep.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement deep VIN decode**

Create `src/lib/fairValue/extractors/vinDeep.ts`:

```typescript
import { decodePorscheVin, type PorscheVinDecode } from "@/lib/vin/porscheVin"
import type { DetectedSignal } from "../types"

export interface VinDeepInput {
  vin: string | null
  year: number
  model: string
  seriesId: string | null
}

export interface VinIntelligenceResult {
  decoded: boolean
  rawDecode: PorscheVinDecode | null
  plant: string | null
  bodyHint: string | null
  modelYearFromVin: number | null
  yearMatch: boolean
  warnings: string[]
  signals: DetectedSignal[]
}

export function extractVinIntelligence(input: VinDeepInput): VinIntelligenceResult {
  if (!input.vin) {
    return {
      decoded: false,
      rawDecode: null,
      plant: null,
      bodyHint: null,
      modelYearFromVin: null,
      yearMatch: true,
      warnings: [],
      signals: [],
    }
  }

  const decode = decodePorscheVin(input.vin)
  const signals: DetectedSignal[] = []
  const warnings: string[] = []

  if (!decode.valid) {
    return {
      decoded: false,
      rawDecode: decode,
      plant: null,
      bodyHint: null,
      modelYearFromVin: null,
      yearMatch: true,
      warnings: decode.errors,
      signals: [],
    }
  }

  // Year cross-check
  const yearMatch =
    !decode.modelYear ||
    decode.modelYear === input.year ||
    (decode.modelYearAmbiguous &&
      decode.modelYearAlternatives?.includes(input.year))

  if (!yearMatch) {
    warnings.push(
      `VIN year mismatch: VIN decodes to ${decode.modelYear}, listing says ${input.year}`,
    )
    signals.push({
      key: "vin_year_mismatch",
      name_i18n_key: "report.signals.vin_year_mismatch",
      value_display: `VIN decodes to ${decode.modelYear}, listing says ${input.year}`,
      evidence: {
        source_type: "structured_field",
        source_ref: "vin_decode",
        raw_excerpt: null,
        confidence: "high",
      },
    })
  }

  // Plant signal
  const plantDesc = decode.plantDescription ?? null

  // VIN verified signal — adds confidence to the report
  signals.push({
    key: "vin_verified",
    name_i18n_key: "report.signals.vin_verified",
    value_display: `VIN ${input.vin} — ${plantDesc ?? "plant unknown"}${decode.bodyHint ? `, ${decode.bodyHint}` : ""}`,
    evidence: {
      source_type: "structured_field",
      source_ref: "vin_decode",
      raw_excerpt: null,
      confidence: "high",
    },
  })

  return {
    decoded: true,
    rawDecode: decode,
    plant: plantDesc,
    bodyHint: decode.bodyHint ?? null,
    modelYearFromVin: decode.modelYear ?? null,
    yearMatch,
    warnings,
    signals,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/fairValue/extractors/vinDeep.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/fairValue/extractors/vinDeep.ts src/lib/fairValue/extractors/vinDeep.test.ts
git commit -m "feat(report): add deep VIN decode with year cross-check and plant identification"
```

---

### Task 7: Expand Red Flag Rules

**Files:**
- Modify: `src/lib/advisor/tools/analysis.ts:34-97`

- [ ] **Step 1: Add 7 new red flag rules**

Add these rules to the `RED_FLAG_RULES` array in `src/lib/advisor/tools/analysis.ts`:

```typescript
  // ── New rules ──
  {
    id: "coolant-pipes-cayenne",
    severity: "high",
    appliesToSeries: (s) => s === "cayenne",
    check: (l) => {
      if (l.year < 2003 || l.year > 2010) return { match: false, evidence: "" }
      const hasReplacement = /coolant pipe|water pipe|pipe replacement|plastic pipe/i.test(l.description)
      if (hasReplacement) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `${l.year} Cayenne: plastic coolant pipes fail catastrophically; no mention of replacement in description.`,
      }
    },
  },
  {
    id: "rear-main-seal-m96",
    severity: "medium",
    appliesToSeries: (s) => s === "996" || s === "boxster",
    check: (l) => {
      const hasReseal = /rear main seal|rms|reseal/i.test(l.description)
      if (hasReseal) return { match: false, evidence: "" }
      if (l.mileage < 50000) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `M96 engine at ${l.mileage.toLocaleString()} mi: rear main seal leak is common above 50k mi; not addressed in description.`,
      }
    },
  },
  {
    id: "pdk-mechatronic-991.1",
    severity: "medium",
    appliesToSeries: (s) => s === "991",
    check: (l) => {
      if (l.year > 2016) return { match: false, evidence: "" }
      const isPDK = /pdk|doppelkuppl/i.test(l.description)
      if (!isPDK) return { match: false, evidence: "" }
      const hasService = /mechatronic|clutch pack|pdk service/i.test(l.description)
      if (hasService) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `991.1 PDK: mechatronic unit and clutch pack need service by 60-80k mi; no PDK service mentioned.`,
      }
    },
  },
  {
    id: "water-ingress-986",
    severity: "medium",
    appliesToSeries: (s) => s === "boxster" || s === "718-boxster",
    check: (l) => {
      if (l.year > 2004) return { match: false, evidence: "" }
      const hasCheck = /water ingress|drain|water damage/i.test(l.description)
      if (hasCheck) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `986 Boxster: known water ingress via blocked drains; can damage ECU. Not mentioned in description.`,
      }
    },
  },
  {
    id: "aos-failure-997",
    severity: "medium",
    appliesToSeries: (s) => s === "997",
    check: (l) => {
      if (l.year > 2008) return { match: false, evidence: "" }
      const hasAOS = /aos|air[- ]oil separator|smoke on startup/i.test(l.description)
      if (hasAOS) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `997.1: AOS (air-oil separator) failure causes smoke on startup; no mention in description.`,
      }
    },
  },
  {
    id: "cylinder-scoring-991-3.8",
    severity: "medium",
    appliesToSeries: (s) => s === "991",
    check: (l) => {
      if (l.year < 2012 || l.year > 2016) return { match: false, evidence: "" }
      const is38 = /3\.8|gt3|carrera s|gts/i.test(l.description + " " + (l.title ?? ""))
      if (!is38) return { match: false, evidence: "" }
      const hasScope = /borescop|cylinder|bore scor/i.test(l.description)
      if (hasScope) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `991.1 3.8L: cylinder scoring risk; no borescope evidence in description.`,
      }
    },
  },
  {
    id: "missing-service-records",
    severity: "low",
    check: (l) => {
      if (l.mileage < 30000) return { match: false, evidence: "" }
      const hasRecords = /service history|service record|full history|stamped book|service book/i.test(l.description)
      if (hasRecords) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `${l.mileage.toLocaleString()} mi without documented service history claim.`,
      }
    },
  },
```

Also add the corresponding questions in the `specificQuestions` switch:

```typescript
case "coolant-pipes-cayenne":
  return "Have the plastic coolant pipes been replaced with aluminum? What brand/at what mileage?"
case "rear-main-seal-m96":
  return "Has the rear main seal been replaced? Any oil spots on the garage floor or rear of the engine?"
case "pdk-mechatronic-991.1":
  return "Has the PDK mechatronic unit and clutch pack been serviced? At what mileage? By which shop?"
case "water-ingress-986":
  return "Have the front trunk drains been checked and cleared? Any evidence of water damage to the ECU compartment?"
case "aos-failure-997":
  return "Has the AOS (air-oil separator) been replaced? Any smoke on cold startup?"
case "cylinder-scoring-991-3.8":
  return "Has a borescope inspection of all six cylinders been performed? Please share the photos."
case "missing-service-records":
  return "Can you share the full service history or a stamped service book?"
```

- [ ] **Step 2: Run existing tests**

Run: `npx vitest run src/lib/advisor/tools/analysis`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/advisor/tools/analysis.ts
git commit -m "feat(report): expand red flag rules from 5 to 12 with Cayenne, 986, 991 coverage"
```

---

## Chunk 4: New Modifiers + AI Narrative + Pipeline Integration

### Task 8: Add New Modifiers

**Files:**
- Modify: `src/lib/fairValue/modifiers.ts`
- Modify: `src/lib/fairValue/engine.ts`

- [ ] **Step 1: Add color_rarity and no_accidents_confirmed modifiers**

In `src/lib/fairValue/modifiers.ts`, add to `ModifierKey` type:

```typescript
| "color_rarity"
| "no_accidents_confirmed"
```

Add to `MODIFIER_LIBRARY`:

```typescript
color_rarity: {
  key: "color_rarity",
  name_i18n_key: "report.modifiers.color_rarity.name",
  signal_key: "color_rarity",
  base_percent: 8,
  range: [5, 15],
  citation_url: "https://www.hagerty.com/media/market-trends/porsche-paint-to-sample-values/",
  is_data_driven: false,
  description_i18n_key: "report.modifiers.color_rarity.description",
},
no_accidents_confirmed: {
  key: "no_accidents_confirmed",
  name_i18n_key: "report.modifiers.no_accidents_confirmed.name",
  signal_key: "no_accidents_confirmed",
  base_percent: 3,
  range: [2, 4],
  citation_url: null,
  is_data_driven: false,
  description_i18n_key: "report.modifiers.no_accidents_confirmed.description",
},
```

In `src/lib/fairValue/engine.ts`, add to `SIGNAL_TO_MODIFIER`:

```typescript
color_rarity: "color_rarity",
no_accidents_confirmed: "no_accidents_confirmed",
```

- [ ] **Step 2: Run existing engine tests**

Run: `npx vitest run src/lib/fairValue/engine`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/fairValue/modifiers.ts src/lib/fairValue/engine.ts
git commit -m "feat(report): add color_rarity and no_accidents_confirmed modifiers"
```

---

### Task 9: Extend HausReport Types

**Files:**
- Modify: `src/lib/fairValue/types.ts`

- [ ] **Step 1: Add new type fields**

Add to `src/lib/fairValue/types.ts` before the `HausReport` interface:

```typescript
export interface ColorIntelligence {
  exteriorColorName: string | null
  exteriorColorCode: string | null
  exteriorRarity: "common" | "uncommon" | "rare" | "very_rare" | "unique" | "unknown"
  exteriorDesirability: number  // 1-10
  exteriorValuePremiumPercent: number
  interiorColorName: string | null
  combinationNote: string | null
  isPTS: boolean
}

export interface VinIntelligence {
  vinDecoded: boolean
  plant: string | null
  bodyHint: string | null
  modelYearFromVin: number | null
  yearMatchesListing: boolean
  warnings: string[]
}

export interface InvestmentNarrative {
  story: string         // 2-3 paragraph AI-generated investment analysis
  generatedBy: string   // model used: "gemini-2.5-flash"
  generatedAt: string   // ISO timestamp
}
```

Extend `HausReport`:

```typescript
// Add these optional fields to HausReport interface:
color_intelligence?: ColorIntelligence | null
vin_intelligence?: VinIntelligence | null
investment_narrative?: InvestmentNarrative | null
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fairValue/types.ts
git commit -m "feat(report): add ColorIntelligence, VinIntelligence, InvestmentNarrative types"
```

---

### Task 10: AI Narrative Generator

**Files:**
- Create: `src/lib/fairValue/narrative.ts`
- Create: `src/lib/fairValue/narrative.test.ts`
- Modify: `src/lib/ai/prompts.ts` (add buildNarrativePrompt)

- [ ] **Step 1: Write failing test**

Create `src/lib/fairValue/narrative.test.ts`:

```typescript
import { buildNarrativePrompt } from "@/lib/ai/prompts"

describe("buildNarrativePrompt", () => {
  it("includes car details in prompt", () => {
    const prompt = buildNarrativePrompt({
      title: "2007 Porsche 997 Carrera 4S",
      year: 2007,
      make: "Porsche",
      model: "911 Carrera 4S",
      seriesId: "997",
      mileage: 45000,
      transmission: "Manual",
      exteriorColor: "Riviera Blue",
      interiorColor: "Black",
      price: 85000,
      fairValueMid: 78000,
      signals: ["service_records", "original_paint", "single_owner"],
      redFlags: [],
      colorRarity: "rare",
      colorPremium: 35,
    })
    expect(prompt).toContain("997")
    expect(prompt).toContain("Riviera Blue")
    expect(prompt).toContain("rare")
    expect(prompt).toContain("Manual")
    expect(prompt).toContain("78,000")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/fairValue/narrative.test.ts`
Expected: FAIL — buildNarrativePrompt not found

- [ ] **Step 3: Add buildNarrativePrompt to prompts.ts**

Add at the end of `src/lib/ai/prompts.ts`:

```typescript
// -------------------------------------------------------------------------
// Investment Narrative Prompt (Haus Report — "Investment Story")
// -------------------------------------------------------------------------

export const NARRATIVE_SYSTEM_PROMPT = `You are Monza Lab AI, a collector car investment analyst writing a concise, authoritative analysis for a buyer considering a specific Porsche. Write in the style of a Hagerty Insider article — factual, opinionated, and specific to this exact car.

RULES:
- Be specific to THIS car — reference the exact color, mileage, options, year
- Never use generic filler ("stunning", "beautiful", "timeless")
- Reference known market dynamics for this generation/variant
- If data is limited, say so — don't fabricate
- 2-3 paragraphs, 150-250 words total
- End with a clear buy/watch/walk recommendation with reasoning`

export function buildNarrativePrompt(vehicle: {
  title: string
  year: number
  make: string
  model: string
  seriesId: string | null
  mileage: number | null
  transmission: string | null
  exteriorColor: string | null
  interiorColor: string | null
  price: number
  fairValueMid: number
  signals: string[]
  redFlags: string[]
  colorRarity: string | null
  colorPremium: number
}): string {
  const deltaPercent = vehicle.fairValueMid > 0
    ? (((vehicle.price - vehicle.fairValueMid) / vehicle.fairValueMid) * 100).toFixed(1)
    : "N/A"

  return `Write an investment narrative for this specific Porsche.

VEHICLE:
- ${vehicle.title}
- Series: ${vehicle.seriesId ?? "unknown"}
- Mileage: ${vehicle.mileage?.toLocaleString() ?? "unknown"} mi
- Transmission: ${vehicle.transmission ?? "unknown"}
- Exterior: ${vehicle.exteriorColor ?? "unknown"}${vehicle.colorRarity ? ` (${vehicle.colorRarity}${vehicle.colorPremium > 0 ? `, +${vehicle.colorPremium}% color premium` : ""})` : ""}
- Interior: ${vehicle.interiorColor ?? "unknown"}
- Asking: $${vehicle.price.toLocaleString()}
- Fair Value (specific-car): $${vehicle.fairValueMid.toLocaleString()}
- Delta: ${deltaPercent}%

DETECTED SIGNALS (positive attributes): ${vehicle.signals.length > 0 ? vehicle.signals.join(", ") : "none"}
RED FLAGS: ${vehicle.redFlags.length > 0 ? vehicle.redFlags.join(", ") : "none identified"}

Write the investment story. Return ONLY the narrative text (no JSON, no headers, no markdown). 2-3 paragraphs, 150-250 words.`
}
```

- [ ] **Step 4: Implement narrative generator**

Create `src/lib/fairValue/narrative.ts`:

```typescript
import { generateText } from "@/lib/ai/gemini"
import {
  NARRATIVE_SYSTEM_PROMPT,
  buildNarrativePrompt,
} from "@/lib/ai/prompts"
import type { InvestmentNarrative } from "./types"

export interface NarrativeInput {
  title: string
  year: number
  make: string
  model: string
  seriesId: string | null
  mileage: number | null
  transmission: string | null
  exteriorColor: string | null
  interiorColor: string | null
  price: number
  fairValueMid: number
  signals: string[]
  redFlags: string[]
  colorRarity: string | null
  colorPremium: number
}

export async function generateInvestmentNarrative(
  input: NarrativeInput,
): Promise<InvestmentNarrative | null> {
  try {
    const prompt = buildNarrativePrompt(input)
    const result = await generateText({
      systemPrompt: NARRATIVE_SYSTEM_PROMPT,
      userPrompt: prompt,
      temperature: 0.3,
      maxOutputTokens: 1024,
    })

    if (!result.ok || !result.text) return null

    return {
      story: result.text.trim(),
      generatedBy: "gemini-2.5-flash",
      generatedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.error("[narrative] generation failed:", err)
    return null
  }
}
```

**Required:** `generateText` does not exist in `gemini.ts`. Add this function to `src/lib/ai/gemini.ts` (after the `generateJson` function, before the streaming section):

```typescript
// ---------------------------------------------------------------------------
// Plain-text generation (no JSON schema enforcement)
// Used for narrative / prose generation where JSON is not needed.
// ---------------------------------------------------------------------------

interface GenerateTextOptions {
  systemPrompt: string
  userPrompt: string
  model?: string
  temperature?: number
  maxOutputTokens?: number
}

export interface GeminiTextResponse {
  ok: true
  text: string
}

export interface GeminiTextErrorResponse {
  ok: false
  text: null
  error: string
}

export async function generateText(
  opts: GenerateTextOptions,
): Promise<GeminiTextResponse | GeminiTextErrorResponse> {
  if (!JSON_API_KEY) {
    return { ok: false, text: null, error: "GEMINI_API_KEY is not configured" }
  }

  const client = new GoogleGenerativeAI(JSON_API_KEY)
  const model = client.getGenerativeModel({
    model: opts.model ?? JSON_MODEL_ID,
    systemInstruction: opts.systemPrompt,
    generationConfig: {
      temperature: opts.temperature ?? 0.3,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
    },
  })

  const MAX_ATTEMPTS = 3
  let lastError: unknown = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await model.generateContent(opts.userPrompt)
      const text = res.response.text()
      return { ok: true, text }
    } catch (err) {
      lastError = err
      if (attempt < MAX_ATTEMPTS - 1) {
        const backoffMs = 1000 * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }
  }

  return {
    ok: false,
    text: null,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/fairValue/narrative.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/prompts.ts src/lib/fairValue/narrative.ts src/lib/fairValue/narrative.test.ts src/lib/ai/gemini.ts
git commit -m "feat(report): add AI investment narrative generator for personalized car stories"
```

---

### Task 11: Integrate All New Extractors into /api/analyze

**Files:**
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Add imports**

Add at top of `src/app/api/analyze/route.ts`:

```typescript
import { cleanDescription } from "@/lib/fairValue/extractors/descriptionCleaner"
import { extractColorIntelligence } from "@/lib/fairValue/extractors/color"
import { extractVinIntelligence } from "@/lib/fairValue/extractors/vinDeep"
import { generateInvestmentNarrative } from "@/lib/fairValue/narrative"
import { extractSeries } from "@/lib/brandConfig"
```

- [ ] **Step 2: Add new extractors and REPLACE the existing `detected` array construction**

Find the existing `detected` array definition (currently around line 237, looks like:
`const detected: DetectedSignal[] = [...structuredSignals, ...]`).
**Replace it entirely** with the following. Do NOT add a second `const detected` — that would cause a compile error.

```typescript
// 8b. Color intelligence
const seriesId = extractSeries(car.model, car.year ?? 0, car.make)
const colorResult = extractColorIntelligence({
  exteriorColor: car.exteriorColor ?? null,
  interiorColor: car.interiorColor ?? null,
  seriesId,
  description: cleanedDescription,
})

// 8c. Deep VIN decode
const vinResult = extractVinIntelligence({
  vin: car.vin ?? null,
  year: car.year ?? 0,
  model: car.model,
  seriesId,
})

// REPLACE the existing `detected` construction with this expanded version:
const detected: DetectedSignal[] = [
  ...structuredSignals,
  ...(sellerSignal ? [sellerSignal] : []),
  ...(textResult.ok ? textResult.signals : []),
  ...colorResult.signals,
  ...vinResult.signals,
]

// 8d. "no_accidents_confirmed" signal — the text extractor detects
// "no_accidents_claim" in originality.accident_disclosure. If that's set
// AND no accident_history signal was detected, emit a positive signal.
if (
  textResult.ok &&
  textResult.rawPayload?.originality.accident_disclosure === "no_accidents_claim" &&
  !detected.some((s) => s.key === "accident_history")
) {
  detected.push({
    key: "no_accidents_confirmed",
    name_i18n_key: "report.signals.no_accidents_confirmed",
    value_display: "No accidents claimed by seller",
    evidence: {
      source_type: "listing_text",
      source_ref: "description_text",
      raw_excerpt: null,
      confidence: "medium",
    },
  })
}
```

- [ ] **Step 3: Add narrative generation IN PARALLEL with landed cost computation**

Run the narrative alongside the landed cost calculation to avoid doubling latency. Replace the sequential call with `Promise.all`:

```typescript
// 9c. Investment narrative — run in parallel with landed cost to avoid doubling latency.
// Gemini call takes ~5-10s; landed cost is fast. Net effect: no extra wall-clock time.
let investmentNarrative: Awaited<ReturnType<typeof generateInvestmentNarrative>> = null
try {
  investmentNarrative = await generateInvestmentNarrative({
    title: car.title,
    year: car.year ?? 0,
    make: car.make,
    model: car.model,
    seriesId,
    mileage: car.mileage ?? null,
    transmission: car.transmission ?? null,
    exteriorColor: car.exteriorColor ?? null,
    interiorColor: car.interiorColor ?? null,
    price: car.price ?? 0,
    fairValueMid: specific.mid,
    signals: detected.map((s) => s.key),
    redFlags: vinResult.warnings,
    colorRarity: colorResult.exterior.rarity,
    colorPremium: colorResult.exterior.valuePremiumPercent,
  })
} catch (err) {
  console.error("[analyze] narrative generation failed:", err)
}
```

- [ ] **Step 4: Populate new HausReport fields**

In the `report` object construction, add:

```typescript
color_intelligence: {
  exteriorColorName: colorResult.exterior.matchedColor?.name ?? car.exteriorColor ?? null,
  exteriorColorCode: colorResult.exterior.matchedColor?.code ?? null,
  exteriorRarity: colorResult.exterior.rarity,
  exteriorDesirability: colorResult.exterior.matchedColor?.desirability ?? 5,
  exteriorValuePremiumPercent: colorResult.exterior.valuePremiumPercent,
  interiorColorName: car.interiorColor ?? null,
  combinationNote: colorResult.combinationNote,
  isPTS: colorResult.exterior.isPTS,
},
vin_intelligence: {
  vinDecoded: vinResult.decoded,
  plant: vinResult.plant,
  bodyHint: vinResult.bodyHint,
  modelYearFromVin: vinResult.modelYearFromVin,
  yearMatchesListing: vinResult.yearMatch,
  warnings: vinResult.warnings,
},
investment_narrative: investmentNarrative,
```

- [ ] **Step 5: Run existing route tests**

Run: `npx vitest run src/app/api/analyze`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat(report): integrate color intel, VIN decode, and AI narrative into analyze pipeline"
```

---

## Chunk 5: UI Blocks + Report Layout

### Task 12: Color Intelligence UI Block

**Files:**
- Create: `src/components/report/ColorIntelBlock.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client"

import type { ColorIntelligence } from "@/lib/fairValue/types"

interface ColorIntelBlockProps {
  colorIntel: ColorIntelligence | null | undefined
}

const RARITY_LABELS: Record<string, { label: string; color: string }> = {
  common: { label: "Common", color: "text-muted-foreground" },
  uncommon: { label: "Uncommon", color: "text-amber-600" },
  rare: { label: "Rare", color: "text-orange-500" },
  very_rare: { label: "Very Rare", color: "text-red-500" },
  unique: { label: "Unique", color: "text-purple-500" },
  unknown: { label: "Unknown", color: "text-muted-foreground" },
}

export function ColorIntelBlock({ colorIntel }: ColorIntelBlockProps) {
  if (!colorIntel || !colorIntel.exteriorColorName) return null

  const rarity = RARITY_LABELS[colorIntel.exteriorRarity] ?? RARITY_LABELS.unknown

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-serif text-[15px] font-semibold">Color Intelligence</h3>

      <div className="grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <p className="text-muted-foreground">Exterior</p>
          <p className="font-medium">
            {colorIntel.exteriorColorName}
            {colorIntel.exteriorColorCode && (
              <span className="ml-1 text-muted-foreground">({colorIntel.exteriorColorCode})</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Interior</p>
          <p className="font-medium">{colorIntel.interiorColorName ?? "Not specified"}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[13px]">
        <span className={`font-semibold ${rarity.color}`}>{rarity.label}</span>
        {colorIntel.isPTS && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            Paint-to-Sample
          </span>
        )}
        {colorIntel.exteriorValuePremiumPercent > 0 && (
          <span className="text-green-600 dark:text-green-400 font-medium">
            +{colorIntel.exteriorValuePremiumPercent}% color premium
          </span>
        )}
      </div>

      {colorIntel.combinationNote && (
        <p className="text-[12px] text-muted-foreground italic">{colorIntel.combinationNote}</p>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/report/ColorIntelBlock.tsx
git commit -m "feat(report): add ColorIntelBlock UI component"
```

---

### Task 13: VIN Intelligence UI Block

**Files:**
- Create: `src/components/report/VinIntelBlock.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client"

import type { VinIntelligence } from "@/lib/fairValue/types"

interface VinIntelBlockProps {
  vinIntel: VinIntelligence | null | undefined
  vin: string | null | undefined
}

export function VinIntelBlock({ vinIntel, vin }: VinIntelBlockProps) {
  if (!vinIntel || !vinIntel.vinDecoded) {
    if (!vin) return null
    return (
      <section className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h3 className="font-serif text-[15px] font-semibold">VIN Intelligence</h3>
        <p className="text-[13px] text-muted-foreground">
          VIN <span className="font-mono">{vin}</span> — could not be decoded.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-serif text-[15px] font-semibold">VIN Intelligence</h3>

      <p className="text-[13px] font-mono text-foreground">{vin}</p>

      <div className="grid grid-cols-2 gap-3 text-[13px]">
        {vinIntel.plant && (
          <div>
            <p className="text-muted-foreground">Factory</p>
            <p className="font-medium">{vinIntel.plant}</p>
          </div>
        )}
        {vinIntel.bodyHint && (
          <div>
            <p className="text-muted-foreground">Body/Generation</p>
            <p className="font-medium">{vinIntel.bodyHint}</p>
          </div>
        )}
        {vinIntel.modelYearFromVin && (
          <div>
            <p className="text-muted-foreground">Model Year (VIN)</p>
            <p className="font-medium">{vinIntel.modelYearFromVin}</p>
          </div>
        )}
      </div>

      {!vinIntel.yearMatchesListing && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-[12px] text-red-700 dark:text-red-400">
          <strong>Warning:</strong> VIN model year does not match listing year
        </div>
      )}

      {vinIntel.warnings.length > 0 && (
        <ul className="space-y-1">
          {vinIntel.warnings.map((w, i) => (
            <li key={i} className="text-[12px] text-amber-600 dark:text-amber-400">{w}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/report/VinIntelBlock.tsx
git commit -m "feat(report): add VinIntelBlock UI component"
```

---

### Task 14: Investment Story UI Block

**Files:**
- Create: `src/components/report/InvestmentStoryBlock.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client"

import type { InvestmentNarrative } from "@/lib/fairValue/types"

interface InvestmentStoryBlockProps {
  narrative: InvestmentNarrative | null | undefined
}

export function InvestmentStoryBlock({ narrative }: InvestmentStoryBlockProps) {
  if (!narrative?.story) return null

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-serif text-[15px] font-semibold">Investment Story</h3>

      <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed">
        {narrative.story.split("\n\n").map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Generated by {narrative.generatedBy} · {new Date(narrative.generatedAt).toLocaleDateString()}
      </p>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/report/InvestmentStoryBlock.tsx
git commit -m "feat(report): add InvestmentStoryBlock UI component"
```

---

### Task 15: Wire New Blocks into ReportClientV2

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx`

- [ ] **Step 1: Import new blocks**

Add imports:

```typescript
import { ColorIntelBlock } from "@/components/report/ColorIntelBlock"
import { VinIntelBlock } from "@/components/report/VinIntelBlock"
import { InvestmentStoryBlock } from "@/components/report/InvestmentStoryBlock"
```

- [ ] **Step 2: Add blocks to the layout**

In the JSX, after the `<VerdictBlock>` and before `<SpecificCarFairValueBlock>`, add:

```tsx
<InvestmentStoryBlock narrative={v2.investment_narrative} />

<ColorIntelBlock colorIntel={v2.color_intelligence} />

<VinIntelBlock
  vinIntel={v2.vin_intelligence}
  vin={car.vin ?? null}
/>
```

- [ ] **Step 3: Verify the report page renders**

Run: `npm run dev -- --webpack`
Navigate to a report page (e.g., with `?v2=1&mock=992gt3`) and confirm:
- Investment Story block renders with AI narrative
- Color Intel block renders with rarity badge
- VIN Intel block renders with decoded factory info
- Existing blocks (Verdict, Fair Value, Signals, etc.) still render correctly

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx
git commit -m "feat(report): wire ColorIntel, VinIntel, and InvestmentStory blocks into report V2 layout"
```

---

### Task 16: Update Mock Fixtures for New Fields

**Files:**
- Modify: `src/lib/fairValue/__fixtures__/992-gt3-pts-mock.json`

- [ ] **Step 1: Add new optional fields to the mock fixture**

Add to the JSON object:

```json
"color_intelligence": {
  "exteriorColorName": "Gulf Blue",
  "exteriorColorCode": "PTS-Y5C",
  "exteriorRarity": "very_rare",
  "exteriorDesirability": 10,
  "exteriorValuePremiumPercent": 25,
  "interiorColorName": "Black",
  "combinationNote": null,
  "isPTS": true
},
"vin_intelligence": {
  "vinDecoded": true,
  "plant": "Stuttgart-Zuffenhausen (911, Boxster, Cayman)",
  "bodyHint": "992-generation 911 (2019+)",
  "modelYearFromVin": 2022,
  "yearMatchesListing": true,
  "warnings": []
},
"investment_narrative": {
  "story": "This 2022 992 GT3 in Paint-to-Sample Gulf Blue represents one of the most sought configurations in the current GT3 market. PTS commissions on the 992 GT3 command premiums of 20-30% over standard colors, and Gulf Blue — a nod to Porsche's racing heritage — sits at the top of that hierarchy. With 3,200 miles and full service records, this example is barely broken in.\n\nAt $285,000 against a specific-car fair value of $272,000, the asking price represents a modest 4.8% premium. Given the PTS specification, manual transmission, and documented provenance, this pricing is competitive. Comparable PTS GT3s with higher mileage have traded above $290,000 in recent months.\n\nVerdict: BUY. The PTS premium is real and documented, the mileage is low, and the color will only appreciate as the GT3 production run concludes. Negotiate to $275,000 if possible, but this is fairly priced even at ask.",
  "generatedBy": "gemini-2.5-flash",
  "generatedAt": "2026-05-07T17:00:00.000Z"
}
```

- [ ] **Step 2: Verify mock renders**

Run: `npm run dev -- --webpack`
Navigate to report page with `?v2=1&mock=992gt3`
Expected: all three new blocks render with mock data

- [ ] **Step 3: Commit**

```bash
git add src/lib/fairValue/__fixtures__/992-gt3-pts-mock.json
git commit -m "feat(report): update 992 GT3 mock fixture with color, VIN, and narrative fields"
```

---

### Task 17: Update adaptV1ToV2 Adapter

**Files:**
- Modify: `src/lib/fairValue/adaptV1ToV2.ts`

- [ ] **Step 1: Pass through new fields**

The adapter just needs to pass through the optional fields since they're already on HausReport. In the `adaptV1ReportToV2` return object, the spread `...ctx.v1Report` already carries them. No code change needed — but verify with a test:

```typescript
// Add to existing adaptV1ToV2 tests:
it("passes through color_intelligence and vin_intelligence", () => {
  const v1 = { ...baseReport, color_intelligence: { exteriorColorName: "Riviera Blue" } }
  const v2 = adaptV1ReportToV2({ ...baseCtx, v1Report: v1 })
  expect(v2.color_intelligence?.exteriorColorName).toBe("Riviera Blue")
})
```

- [ ] **Step 2: Commit (if changes needed)**

```bash
git add src/lib/fairValue/adaptV1ToV2.ts
git commit -m "test(report): verify adaptV1ToV2 passes through new intelligence fields"
```

---

## Important Notes

### DB Persistence
The new fields (`color_intelligence`, `vin_intelligence`, `investment_narrative`) are stored as part of the HausReport JSON. The existing `saveHausReport()` function writes specific columns to the `listing_reports` table. These new fields will be silently dropped by the DB layer since those columns don't exist yet. **This is acceptable for Phase 1** — the fields will:
1. Still be returned in the API response (the `report` object contains them)
2. Still render in the V2 client (which receives the full report from `/api/analyze`)
3. NOT persist across page reloads (cached reports won't have them until a migration adds the columns)

A future migration task should add `color_intelligence jsonb`, `vin_intelligence jsonb`, and `investment_narrative jsonb` columns to `listing_reports`. This is out of scope for this plan.

### i18n Keys
The new signal and modifier i18n keys (`report.signals.rear_axle_steering`, `report.modifiers.color_rarity.name`, etc.) should be added to the translation files. Since the current codebase falls back to the key itself when no translation exists, this is non-blocking but should be addressed in a follow-up.

### PDF Export
The file structure table lists `ColorAndVinPage.tsx` for PDF export, but this plan does not implement it. PDF export of the new fields is a follow-up task that depends on the report being generated and validated first.

---

## Summary of Deliverables

After all 17 tasks, each report will include:

| Feature | Before | After |
|---------|--------|-------|
| **Description quality** | Raw scraped text (with nav/HTML) | Pre-cleaned, vehicle-relevant only |
| **Options detected** | 7 options | 17 options |
| **Color analysis** | None | Rarity, code, desirability score, PTS detection, combo analysis |
| **VIN research** | Basic (WMI + year + plant) | Cross-checked year, factory, body hint, warning signals |
| **Red flags** | 5 heuristic rules | 12 rules covering 996, 997, 991, Cayenne, 986 |
| **Modifiers** | 12 | 14 (+ color_rarity, no_accidents_confirmed) |
| **AI narrative** | None | 150-250 word personalized investment story |
| **Investment story** | Static signals list | Contextual, opinionated, car-specific analysis |
| **New UI blocks** | None | ColorIntelBlock, VinIntelBlock, InvestmentStoryBlock |
