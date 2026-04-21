# Haus Report v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Haus Report — the core paid product of Monza Haus — from v1's 2808-line monolith to a mobile-first, tier-aware, Bloomberg-style market intelligence dossier with first-class PDF and Excel exports and public hash-verifiability. Front-only changes on branch `reporte`; BE applies migrations in parallel per §13.

**Architecture:** Block-composable React UI driven by a tier-aware orchestrator. The HausReport data model is the single source of truth; online UI, server-side PDF (`@react-pdf/renderer`), and interactive Excel (`ExcelJS` with live formulas) all render from the same persisted snapshot keyed by SHA256 hash. A `/verify/{hash}` public route closes the anti-forge loop. New lib modules (`referencePack`, `variantKB`, `remarkableGenerator`, `marketIntel`, `specialistAgents` scaffold, `exports/{pdf,excel}`, `reports/hash`) slot cleanly alongside the v1 foundation (extractors, modifier engine, landed cost).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Supabase, Vitest 4 + jsdom, Testing Library, `@react-pdf/renderer` (new), `ExcelJS` (new, replaces `xlsx`), `recharts` (existing, for charts), `framer-motion` (existing, for transitions), `lucide-react` (existing, icons), `zod` (existing, validation).

**Spec:** `docs/superpowers/specs/2026-04-21-haus-report-v2-design.md`

**Branch:** `reporte` (already created from `feat/landed-cost`, pushed to `origin/reporte`)

---

## Phase overview

| Phase | What lands | Shippable state |
|---|---|---|
| **Phase 1** — Foundation | New types, lib modules (referencePack/KB/agents/remarkableGenerator/marketIntel/hash), deps installed | Non-UI; internal APIs ready |
| **Phase 2** — Online report IA | 14 new/refactored block components, `ReportClient.tsx` rewrite, mobile-first layout | Users can open report v2 online |
| **Phase 3** — Orchestrator refactor | Tier-aware `/api/analyze`, hash computation, cache by (VIN, tier) | End-to-end online experience works |
| **Phase 4** — PDF export | `@react-pdf/renderer` templates, server-side generation, Supabase Storage | Users can download pro PDF |
| **Phase 5** — Excel export | `ExcelJS` interactive model, 4 sheets, live formulas | Users can download interactive Excel |
| **Phase 6** — Verify route + polish | `/verify/[hash]` route, integration testing, accessibility pass | Full v2 ready for BE sync + launch |

Each phase ends with a green test suite and a checkpoint commit. A phase can be paused mid-execution; the preceding phases remain shippable.

---

## Design principles enforced by the plan

1. **Every commit passes `npm run test` and `npm run lint`.** No deferred cleanup.
2. **Test-first for every new unit.** Write the failing test, see it fail, implement, see it pass, commit.
3. **DRY:** reuse existing components where they already solve the problem (`MarketDeltaPill`, `LandedCostBlock`, etc.). Refactor only where the IA demands it.
4. **YAGNI:** no speculative features, no premature abstractions. Tier 3 specialist agents are scaffolded (interface + empty loader), not implemented.
5. **Mobile-first CSS.** Tailwind classes without modifier = mobile. `md:` and above add desktop treatments.
6. **Every claim is sourced.** No ungrounded prose in any generator output (enforced by TypeScript `source_ref` field on every claim).
7. **Snapshot immutability.** Persisted reports never mutate. Regeneration creates v2 with new hash.

---

## Dependencies to install (one-time, Phase 1 start)

```bash
npm install @react-pdf/renderer exceljs
# xlsx will be removed after Phase 5 completes
```

**Note:** `xlsx` stays installed until Phase 5 migration completes. Don't remove it in Phase 1.

---

# PHASE 1 — Foundation

**Goal:** All non-UI types and lib modules exist with unit tests. UI can be built against stable interfaces.

**Files created in this phase:**
- `src/lib/fairValue/types.ts` — MODIFY (add new types)
- `src/lib/reports/hash.ts` — CREATE
- `src/lib/reports/hash.test.ts` — CREATE
- `src/lib/referencePack/types.ts` — CREATE
- `src/lib/referencePack/loader.ts` — CREATE
- `src/lib/referencePack/loader.test.ts` — CREATE
- `src/lib/variantKB/types.ts` — CREATE
- `src/lib/variantKB/queries.ts` — CREATE
- `src/lib/variantKB/queries.test.ts` — CREATE
- `src/lib/specialistAgents/types.ts` — CREATE (scaffold only)
- `src/lib/specialistAgents/registry.ts` — CREATE (empty registry)
- `src/lib/marketIntel/types.ts` — CREATE
- `src/lib/marketIntel/aggregator.ts` — CREATE
- `src/lib/marketIntel/aggregator.test.ts` — CREATE
- `src/lib/remarkableGenerator/types.ts` — CREATE
- `src/lib/remarkableGenerator/generator.ts` — CREATE
- `src/lib/remarkableGenerator/generator.test.ts` — CREATE
- `src/lib/exports/storage.ts` — CREATE (Supabase Storage helpers)
- `package.json` — MODIFY (add deps)

---

### Task 1.1: Install new dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
npm install @react-pdf/renderer exceljs
```

Expected output: `added N packages`.

- [ ] **Step 2: Verify types resolve**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors (if any exist from existing code, note them but don't fix here).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add @react-pdf/renderer and exceljs for v2 exports"
```

---

### Task 1.2: Extend `HausReport` types for v2

**Files:**
- Modify: `src/lib/fairValue/types.ts`

- [ ] **Step 1: Add new types at the end of the file**

Append to `src/lib/fairValue/types.ts`:

```typescript
// ─── v2 additions (2026-04-21 spec) ───────────────────────────────

export type ReportTier = "tier_1" | "tier_2" | "tier_3"

export interface MarketIntelD1 {
  // Trajectory & velocity (12m sold trajectory)
  sold_trajectory: Array<{ month: string; median_usd: number; sample: number }>
  sold_12m_count: number
  sold_6m_count: number
  trend_12m_direction: "up" | "down" | "stable"
  trend_12m_percent: number
}

export interface MarketIntelD2 {
  // Cross-border arbitrage
  by_region: Array<{
    region: "US" | "EU" | "UK" | "JP"
    cheapest_comparable_usd: number | null
    cheapest_comparable_listing_id: string | null
    cheapest_comparable_url: string | null
    landed_cost_to_target_usd: number | null
    total_landed_to_target_usd: number | null
  }>
  target_region: "US" | "EU" | "UK" | "JP"
  narrative_insight: string | null // one-line plain English
}

export interface MarketIntelD3 {
  // Peer positioning within variant + adjacent variants
  vin_percentile_within_variant: number // 0-100
  variant_distribution_bins: Array<{ price_bucket_usd_low: number; price_bucket_usd_high: number; count: number }>
  adjacent_variants: Array<{
    variant_key: string
    variant_label: string
    median_usd: number
    sample_size: number
  }>
}

export interface MarketIntelD4 {
  // Freshness & confidence
  confidence_tier: "high" | "medium" | "low" | "insufficient"
  sample_size: number
  capture_date_start: string // ISO
  capture_date_end: string // ISO
  outlier_flags: Array<{ message: string; severity: "info" | "warning" }>
}

export interface MarketIntel {
  d1: MarketIntelD1
  d2: MarketIntelD2
  d3: MarketIntelD3
  d4: MarketIntelD4
}

export interface RemarkableClaim {
  id: string // stable within report
  claim_text: string
  source_type: "signal" | "reference_pack" | "kb_entry" | "specialist_agent" | "model_spec"
  source_ref: string // signal key, kb entry id, reference pack entry id, spec column, etc.
  source_url: string | null
  capture_date: string | null
  confidence: Confidence
  tier_required: ReportTier // minimum tier at which this claim appears
}

export interface HausReportV2 extends HausReport {
  // Unique report identity
  report_id: string
  report_hash: string // SHA256 of normalized report JSON
  report_version: number // increments on regeneration
  tier: ReportTier

  // New data blocks
  market_intel: MarketIntel
  remarkable_claims: RemarkableClaim[]

  // Tier metadata
  specialist_coverage_available: boolean // whether a Tier 3 agent exists for this variant
  generated_at: string // ISO
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors attributable to this change.

- [ ] **Step 3: Commit**

```bash
git add src/lib/fairValue/types.ts
git commit -m "feat(types): add v2 HausReport types (MarketIntel, RemarkableClaim, ReportTier)"
```

---

### Task 1.3: Create `reports/hash` module

**Files:**
- Create: `src/lib/reports/hash.ts`
- Create: `src/lib/reports/hash.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/hash.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { computeReportHash } from "./hash"

describe("computeReportHash", () => {
  it("produces deterministic SHA256 for identical input", () => {
    const input = { listing_id: "abc", median_price: 150000, tier: "tier_2" }
    const h1 = computeReportHash(input)
    const h2 = computeReportHash(input)
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[a-f0-9]{64}$/)
  })

  it("is stable under key reordering", () => {
    const a = { listing_id: "abc", median_price: 150000, tier: "tier_2" }
    const b = { tier: "tier_2", median_price: 150000, listing_id: "abc" }
    expect(computeReportHash(a)).toBe(computeReportHash(b))
  })

  it("differs when data changes", () => {
    const a = { listing_id: "abc", median_price: 150000 }
    const b = { listing_id: "abc", median_price: 150001 }
    expect(computeReportHash(a)).not.toBe(computeReportHash(b))
  })

  it("ignores specified volatile fields (e.g., generated_at)", () => {
    const a = { listing_id: "abc", median_price: 150000, generated_at: "2026-04-21T10:00:00Z" }
    const b = { listing_id: "abc", median_price: 150000, generated_at: "2026-04-21T11:00:00Z" }
    expect(computeReportHash(a, { ignoreKeys: ["generated_at"] })).toBe(
      computeReportHash(b, { ignoreKeys: ["generated_at"] })
    )
  })
})
```

- [ ] **Step 2: Run test (fails)**

Run: `npm run test -- src/lib/reports/hash.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `computeReportHash`**

Create `src/lib/reports/hash.ts`:

```typescript
import { createHash } from "crypto"

export interface HashOptions {
  ignoreKeys?: string[]
}

/**
 * Deterministic SHA256 over an object. Keys are sorted recursively,
 * then JSON-serialized. Undefined values are stripped.
 * Use `ignoreKeys` to exclude volatile fields (e.g., `generated_at`)
 * from the hashed representation.
 */
export function computeReportHash(obj: unknown, options: HashOptions = {}): string {
  const normalized = normalize(obj, new Set(options.ignoreKeys ?? []))
  const json = JSON.stringify(normalized)
  return createHash("sha256").update(json).digest("hex")
}

function normalize(value: unknown, ignoreKeys: Set<string>): unknown {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.map((v) => normalize(v, ignoreKeys))
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      if (ignoreKeys.has(key)) continue
      if (obj[key] === undefined) continue
      sorted[key] = normalize(obj[key], ignoreKeys)
    }
    return sorted
  }
  return value
}
```

- [ ] **Step 4: Run test (passes)**

Run: `npm run test -- src/lib/reports/hash.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/hash.ts src/lib/reports/hash.test.ts
git commit -m "feat(reports): add deterministic SHA256 hash over normalized report JSON"
```

---

### Task 1.4: Create `referencePack/types.ts` + loader

**Files:**
- Create: `src/lib/referencePack/types.ts`
- Create: `src/lib/referencePack/loader.ts`
- Create: `src/lib/referencePack/loader.test.ts`

- [ ] **Step 1: Define types**

Create `src/lib/referencePack/types.ts`:

```typescript
export type ReferencePackEntryCategory =
  | "production_numbers"
  | "option_rarity"
  | "market_position"
  | "variant_notes"
  | "known_issues"

export interface ReferencePackEntry {
  id: string
  variant_key: string
  category: ReferencePackEntryCategory
  claim_text: string
  source_name: string
  source_url: string | null
  source_capture_date: string // ISO
  confidence: "high" | "medium" | "low"
}

export interface ReferencePack {
  variant_key: string
  entries: ReferencePackEntry[]
  last_updated: string // ISO
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/referencePack/loader.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { loadReferencePack, registerPackForTesting, clearPacksForTesting } from "./loader"
import type { ReferencePack } from "./types"

beforeEach(() => {
  clearPacksForTesting()
})

describe("loadReferencePack", () => {
  it("returns null when no pack exists for variant", async () => {
    const pack = await loadReferencePack("unknown_variant")
    expect(pack).toBeNull()
  })

  it("returns registered pack for variant", async () => {
    const mock: ReferencePack = {
      variant_key: "992_gt3_touring",
      entries: [
        {
          id: "p1",
          variant_key: "992_gt3_touring",
          category: "production_numbers",
          claim_text: "2,500 units produced globally 2022-2024",
          source_name: "Porsche Press",
          source_url: "https://press.porsche.com/example",
          source_capture_date: "2026-04-01",
          confidence: "high",
        },
      ],
      last_updated: "2026-04-15",
    }
    registerPackForTesting(mock)
    const pack = await loadReferencePack("992_gt3_touring")
    expect(pack).toEqual(mock)
  })
})
```

- [ ] **Step 3: Run test (fails)**

Run: `npm run test -- src/lib/referencePack/loader.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement loader**

Create `src/lib/referencePack/loader.ts`:

```typescript
import type { ReferencePack } from "./types"

// In-memory registry. Production loader will fetch from Supabase table
// `variant_reference_pack` once BE migration lands. Tests inject via
// `registerPackForTesting`.
const REGISTRY = new Map<string, ReferencePack>()

export async function loadReferencePack(variantKey: string): Promise<ReferencePack | null> {
  const pack = REGISTRY.get(variantKey)
  return pack ?? null
}

export function registerPackForTesting(pack: ReferencePack): void {
  REGISTRY.set(pack.variant_key, pack)
}

export function clearPacksForTesting(): void {
  REGISTRY.clear()
}
```

- [ ] **Step 5: Run test (passes)**

Run: `npm run test -- src/lib/referencePack/loader.test.ts`
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/referencePack/
git commit -m "feat(referencePack): add ReferencePack types + in-memory loader (pre-Supabase)"
```

---

### Task 1.5: Create `variantKB/types.ts` + query scaffold

**Files:**
- Create: `src/lib/variantKB/types.ts`
- Create: `src/lib/variantKB/queries.ts`
- Create: `src/lib/variantKB/queries.test.ts`

- [ ] **Step 1: Define types (mirrors KBEntry from spec §7.2)**

Create `src/lib/variantKB/types.ts`:

```typescript
export interface KBEntry {
  id: string
  variant_key: string
  claim_text: string
  source_type: "editorial_curation" | "specialist_agent" | "external_verified"
  source_ref: string
  source_capture_date: string // ISO
  verified_at: string // ISO
  verification_method: string | null
  confidence: "high" | "medium" | "low"
  tags: string[]
  supersedes: string | null
  created_by: string
  created_at: string // ISO
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/variantKB/queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import {
  getKBEntriesForVariant,
  registerKBEntryForTesting,
  clearKBForTesting,
} from "./queries"

beforeEach(() => clearKBForTesting())

describe("getKBEntriesForVariant", () => {
  it("returns empty array when no entries", async () => {
    const entries = await getKBEntriesForVariant("unknown")
    expect(entries).toEqual([])
  })

  it("returns entries filtered by variant", async () => {
    registerKBEntryForTesting({
      id: "k1",
      variant_key: "992_gt3",
      claim_text: "PTS Y5C is ~12% of 992 GT3 order book in 2023",
      source_type: "editorial_curation",
      source_ref: "https://rennlist.example",
      source_capture_date: "2026-04-01",
      verified_at: "2026-04-01",
      verification_method: "manual review",
      confidence: "medium",
      tags: ["pts_rarity"],
      supersedes: null,
      created_by: "monza_editorial",
      created_at: "2026-04-01T00:00:00Z",
    })
    const entries = await getKBEntriesForVariant("992_gt3")
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe("k1")
  })

  it("supersedes chain: excludes superseded entries", async () => {
    registerKBEntryForTesting({
      id: "k1",
      variant_key: "992_gt3",
      claim_text: "old claim",
      source_type: "editorial_curation",
      source_ref: "ref",
      source_capture_date: "2026-01-01",
      verified_at: "2026-01-01",
      verification_method: null,
      confidence: "medium",
      tags: [],
      supersedes: null,
      created_by: "monza_editorial",
      created_at: "2026-01-01T00:00:00Z",
    })
    registerKBEntryForTesting({
      id: "k2",
      variant_key: "992_gt3",
      claim_text: "updated claim",
      source_type: "editorial_curation",
      source_ref: "ref",
      source_capture_date: "2026-04-01",
      verified_at: "2026-04-01",
      verification_method: null,
      confidence: "medium",
      tags: [],
      supersedes: "k1",
      created_by: "monza_editorial",
      created_at: "2026-04-01T00:00:00Z",
    })
    const entries = await getKBEntriesForVariant("992_gt3")
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe("k2")
  })
})
```

- [ ] **Step 3: Run test (fails)**

Run: `npm run test -- src/lib/variantKB/queries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement query layer**

Create `src/lib/variantKB/queries.ts`:

```typescript
import type { KBEntry } from "./types"

// In-memory test registry. Production will query Supabase `variant_knowledge`.
const REGISTRY: KBEntry[] = []

export async function getKBEntriesForVariant(variantKey: string): Promise<KBEntry[]> {
  const matching = REGISTRY.filter((e) => e.variant_key === variantKey)
  const supersededIds = new Set(
    matching.map((e) => e.supersedes).filter((id): id is string => id !== null)
  )
  return matching.filter((e) => !supersededIds.has(e.id))
}

export function registerKBEntryForTesting(entry: KBEntry): void {
  REGISTRY.push(entry)
}

export function clearKBForTesting(): void {
  REGISTRY.length = 0
}
```

- [ ] **Step 5: Run test (passes)**

Run: `npm run test -- src/lib/variantKB/queries.test.ts`
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/variantKB/
git commit -m "feat(variantKB): add KB types + query scaffold with supersedes support"
```

---

### Task 1.6: Scaffold `specialistAgents` registry

**Files:**
- Create: `src/lib/specialistAgents/types.ts`
- Create: `src/lib/specialistAgents/registry.ts`

No test yet — this is a pure interface + empty registry. Tests land when agents ship (post-v2).

- [ ] **Step 1: Define types**

Create `src/lib/specialistAgents/types.ts`:

```typescript
import type { DetectedSignal } from "@/lib/fairValue/types"
import type { KBEntry } from "@/lib/variantKB/types"
import type { ReferencePack } from "@/lib/referencePack/types"
import type { RemarkableClaim } from "@/lib/fairValue/types"

export interface SpecialistAgentInput {
  variant_key: string
  listing_id: string
  signals: DetectedSignal[]
  kb_entries: KBEntry[]
  reference_pack: ReferencePack | null
}

export interface SpecialistAgentOutput {
  claims: RemarkableClaim[]
  new_kb_entries: KBEntry[] // entries the agent wants to deposit back into KB
}

export interface SpecialistAgent {
  variant_key: string
  version: string
  run(input: SpecialistAgentInput): Promise<SpecialistAgentOutput>
}
```

- [ ] **Step 2: Create empty registry**

Create `src/lib/specialistAgents/registry.ts`:

```typescript
import type { SpecialistAgent } from "./types"

// Empty at v2 launch. Populated variant-by-variant in follow-on work.
const AGENTS = new Map<string, SpecialistAgent>()

export function getAgentForVariant(variantKey: string): SpecialistAgent | null {
  return AGENTS.get(variantKey) ?? null
}

export function hasAgentForVariant(variantKey: string): boolean {
  return AGENTS.has(variantKey)
}

export function registerAgent(agent: SpecialistAgent): void {
  AGENTS.set(agent.variant_key, agent)
}
```

- [ ] **Step 3: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: no errors from these files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/specialistAgents/
git commit -m "feat(specialistAgents): add scaffold (interface + empty registry) for Tier 3"
```

---

### Task 1.7: Create `marketIntel/aggregator.ts`

**Files:**
- Create: `src/lib/marketIntel/types.ts`
- Create: `src/lib/marketIntel/aggregator.ts`
- Create: `src/lib/marketIntel/aggregator.test.ts`

- [ ] **Step 1: Types re-export from fairValue/types**

Create `src/lib/marketIntel/types.ts`:

```typescript
export type {
  MarketIntel,
  MarketIntelD1,
  MarketIntelD2,
  MarketIntelD3,
  MarketIntelD4,
} from "@/lib/fairValue/types"
```

- [ ] **Step 2: Write the failing test (D4 confidence first — simplest)**

Create `src/lib/marketIntel/aggregator.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { computeD4Confidence } from "./aggregator"

describe("computeD4Confidence", () => {
  it("returns insufficient when sample below threshold", () => {
    const d4 = computeD4Confidence({
      sample_size: 0,
      capture_date_start: "2026-04-01",
      capture_date_end: "2026-04-21",
      outlier_flags: [],
    })
    expect(d4.confidence_tier).toBe("insufficient")
  })

  it("returns low for small samples", () => {
    const d4 = computeD4Confidence({
      sample_size: 3,
      capture_date_start: "2026-04-01",
      capture_date_end: "2026-04-21",
      outlier_flags: [],
    })
    expect(d4.confidence_tier).toBe("low")
  })

  it("returns medium for moderate samples", () => {
    const d4 = computeD4Confidence({
      sample_size: 12,
      capture_date_start: "2026-04-01",
      capture_date_end: "2026-04-21",
      outlier_flags: [],
    })
    expect(d4.confidence_tier).toBe("medium")
  })

  it("returns high for large samples", () => {
    const d4 = computeD4Confidence({
      sample_size: 50,
      capture_date_start: "2026-04-01",
      capture_date_end: "2026-04-21",
      outlier_flags: [],
    })
    expect(d4.confidence_tier).toBe("high")
  })
})
```

- [ ] **Step 3: Implement D4**

Create `src/lib/marketIntel/aggregator.ts`:

```typescript
import type {
  MarketIntelD1,
  MarketIntelD2,
  MarketIntelD3,
  MarketIntelD4,
} from "@/lib/fairValue/types"
import type { RegionalMarketStats } from "@/lib/reports/types"
import type { DbComparableRow } from "@/lib/db/queries"

export interface D4Input {
  sample_size: number
  capture_date_start: string
  capture_date_end: string
  outlier_flags: MarketIntelD4["outlier_flags"]
}

const CONFIDENCE_THRESHOLDS = {
  high: 20,
  medium: 8,
  low: 1,
} as const

export function computeD4Confidence(input: D4Input): MarketIntelD4 {
  let tier: MarketIntelD4["confidence_tier"]
  if (input.sample_size === 0) tier = "insufficient"
  else if (input.sample_size >= CONFIDENCE_THRESHOLDS.high) tier = "high"
  else if (input.sample_size >= CONFIDENCE_THRESHOLDS.medium) tier = "medium"
  else tier = "low"

  return {
    confidence_tier: tier,
    sample_size: input.sample_size,
    capture_date_start: input.capture_date_start,
    capture_date_end: input.capture_date_end,
    outlier_flags: input.outlier_flags,
  }
}

// D1/D2/D3 implementations added in Tasks 1.7a, 1.7b, 1.7c below.
```

- [ ] **Step 4: Run test (passes)**

Run: `npm run test -- src/lib/marketIntel/aggregator.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketIntel/
git commit -m "feat(marketIntel): add D4 (confidence/freshness) aggregator"
```

---

### Task 1.7a: D1 — trajectory & velocity aggregator

**Files:**
- Modify: `src/lib/marketIntel/aggregator.ts`
- Modify: `src/lib/marketIntel/aggregator.test.ts`

- [ ] **Step 1: Append the failing test**

Add to `aggregator.test.ts`:

```typescript
import { computeD1Trajectory } from "./aggregator"
import type { DbComparableRow } from "@/lib/db/queries"

describe("computeD1Trajectory", () => {
  function mkSold(monthsAgo: number, priceUsd: number): DbComparableRow {
    const d = new Date()
    d.setMonth(d.getMonth() - monthsAgo)
    return {
      id: `c${monthsAgo}-${priceUsd}`,
      year: 2022,
      make: "Porsche",
      model: "992 GT3 Touring",
      hammerPrice: priceUsd,
      originalCurrency: "USD",
      saleDate: d.toISOString().slice(0, 10),
      status: "sold",
      mileage: 5000,
      source: "BaT",
      country: "US",
    } as DbComparableRow
  }

  it("returns empty trajectory when no sold comparables", () => {
    const d1 = computeD1Trajectory([])
    expect(d1.sold_12m_count).toBe(0)
    expect(d1.sold_trajectory).toEqual([])
    expect(d1.trend_12m_direction).toBe("stable")
  })

  it("aggregates sold prices into monthly median buckets (last 12m)", () => {
    const comps = [
      mkSold(1, 200000),
      mkSold(1, 210000),
      mkSold(6, 195000),
      mkSold(6, 205000),
    ]
    const d1 = computeD1Trajectory(comps)
    expect(d1.sold_12m_count).toBe(4)
    expect(d1.sold_6m_count).toBe(2) // only the 1-month-ago ones are ≤ 6m
    expect(d1.sold_trajectory.length).toBeGreaterThanOrEqual(2)
    const firstBucket = d1.sold_trajectory[0]
    expect(firstBucket.sample).toBeGreaterThan(0)
    expect(firstBucket.median_usd).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Implement D1**

Append to `aggregator.ts`:

```typescript
export function computeD1Trajectory(comparables: DbComparableRow[]): MarketIntelD1 {
  const now = new Date()
  const msIn30Days = 30 * 24 * 60 * 60 * 1000

  const soldWithDates = comparables
    .filter((c) => c.status === "sold" && c.saleDate && c.hammerPrice > 0)
    .map((c) => ({
      price: c.hammerPrice,
      date: new Date(c.saleDate as string),
    }))
    .filter((c) => !isNaN(c.date.getTime()))

  const within12m = soldWithDates.filter(
    (c) => now.getTime() - c.date.getTime() <= 12 * msIn30Days
  )
  const within6m = within12m.filter(
    (c) => now.getTime() - c.date.getTime() <= 6 * msIn30Days
  )

  // Monthly buckets: month keys as "YYYY-MM"
  const buckets = new Map<string, number[]>()
  for (const c of within12m) {
    const key = c.date.toISOString().slice(0, 7)
    const arr = buckets.get(key) ?? []
    arr.push(c.price)
    buckets.set(key, arr)
  }

  const sortedKeys = [...buckets.keys()].sort()
  const trajectory = sortedKeys.map((key) => {
    const prices = buckets.get(key)!
    return {
      month: key,
      median_usd: median(prices),
      sample: prices.length,
    }
  })

  const direction: MarketIntelD1["trend_12m_direction"] =
    trajectory.length < 2
      ? "stable"
      : computeTrendDirection(trajectory)

  const trendPercent =
    trajectory.length < 2
      ? 0
      : computeTrendPercent(trajectory)

  return {
    sold_trajectory: trajectory,
    sold_12m_count: within12m.length,
    sold_6m_count: within6m.length,
    trend_12m_direction: direction,
    trend_12m_percent: trendPercent,
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

function computeTrendDirection(
  trajectory: MarketIntelD1["sold_trajectory"]
): MarketIntelD1["trend_12m_direction"] {
  const first = trajectory[0].median_usd
  const last = trajectory[trajectory.length - 1].median_usd
  const deltaPct = ((last - first) / first) * 100
  if (Math.abs(deltaPct) < 2) return "stable"
  return deltaPct > 0 ? "up" : "down"
}

function computeTrendPercent(trajectory: MarketIntelD1["sold_trajectory"]): number {
  const first = trajectory[0].median_usd
  const last = trajectory[trajectory.length - 1].median_usd
  return Math.round(((last - first) / first) * 1000) / 10 // 1 decimal
}
```

- [ ] **Step 3: Run tests (pass)**

Run: `npm run test -- src/lib/marketIntel/aggregator.test.ts`
Expected: all tests pass (4 + 2 = 6).

- [ ] **Step 4: Commit**

```bash
git add src/lib/marketIntel/aggregator.ts src/lib/marketIntel/aggregator.test.ts
git commit -m "feat(marketIntel): add D1 (sold trajectory + velocity) aggregator"
```

---

### Task 1.7b: D2 — cross-border arbitrage aggregator

**Files:**
- Modify: `src/lib/marketIntel/aggregator.ts`
- Modify: `src/lib/marketIntel/aggregator.test.ts`

- [ ] **Step 1: Append the failing test**

Add to `aggregator.test.ts`:

```typescript
import { computeD2Arbitrage } from "./aggregator"
import type { LandedCostBreakdown } from "@/lib/landedCost"

describe("computeD2Arbitrage", () => {
  it("returns null cheapest per region when no comparables", async () => {
    const d2 = await computeD2Arbitrage({
      targetRegion: "US",
      comparablesByRegion: { US: [], EU: [], UK: [], JP: [] },
      landedCostResolver: async () => null,
    })
    expect(d2.target_region).toBe("US")
    for (const row of d2.by_region) {
      expect(row.cheapest_comparable_usd).toBeNull()
    }
  })

  it("finds cheapest comparable per region", async () => {
    const mk = (usd: number, id: string, url: string) =>
      ({ id, priceUsd: usd, url }) as unknown as never
    const d2 = await computeD2Arbitrage({
      targetRegion: "US",
      comparablesByRegion: {
        US: [mk(240000, "u1", "u1.url") as never],
        EU: [mk(195000, "e1", "e1.url"), mk(205000, "e2", "e2.url")] as unknown[],
        UK: [],
        JP: [],
      } as never,
      landedCostResolver: async (origin, dest, priceUsd) => ({
        landedCost: { min: priceUsd + 14000, max: priceUsd + 14000, currency: "USD" },
      }) as unknown as LandedCostBreakdown,
    })
    const eu = d2.by_region.find((r) => r.region === "EU")!
    expect(eu.cheapest_comparable_usd).toBe(195000)
    expect(eu.total_landed_to_target_usd).toBe(209000)
  })
})
```

- [ ] **Step 2: Implement D2**

Append to `aggregator.ts`:

```typescript
import type { LandedCostBreakdown, OriginCountry, Country } from "@/lib/landedCost"

export interface ArbitrageComparable {
  id: string
  priceUsd: number
  url: string | null
}

export interface D2Input {
  targetRegion: "US" | "EU" | "UK" | "JP"
  comparablesByRegion: Record<"US" | "EU" | "UK" | "JP", ArbitrageComparable[]>
  landedCostResolver: (
    origin: OriginCountry,
    destination: Country,
    priceUsd: number
  ) => Promise<LandedCostBreakdown | null>
}

const REGION_TO_ORIGIN: Record<"US" | "EU" | "UK" | "JP", OriginCountry> = {
  US: "US",
  EU: "DE",
  UK: "UK",
  JP: "JP",
}

const REGION_TO_DEST: Record<"US" | "EU" | "UK" | "JP", Country> = {
  US: "US",
  EU: "DE",
  UK: "UK",
  JP: "JP",
}

export async function computeD2Arbitrage(input: D2Input): Promise<MarketIntelD2> {
  const regions = ["US", "EU", "UK", "JP"] as const
  const byRegion: MarketIntelD2["by_region"] = []
  const destination = REGION_TO_DEST[input.targetRegion]

  for (const region of regions) {
    const list = input.comparablesByRegion[region] ?? []
    const cheapest = list.reduce<ArbitrageComparable | null>(
      (acc, c) => (acc === null || c.priceUsd < acc.priceUsd ? c : acc),
      null
    )

    let landedAdd: number | null = null
    let total: number | null = null
    if (cheapest && region !== input.targetRegion) {
      const origin = REGION_TO_ORIGIN[region]
      const lc = await input.landedCostResolver(origin, destination, cheapest.priceUsd)
      if (lc) {
        const landedMid = Math.round((lc.landedCost.min + lc.landedCost.max) / 2)
        landedAdd = landedMid - cheapest.priceUsd
        total = landedMid
      }
    } else if (cheapest && region === input.targetRegion) {
      landedAdd = 0
      total = cheapest.priceUsd
    }

    byRegion.push({
      region,
      cheapest_comparable_usd: cheapest?.priceUsd ?? null,
      cheapest_comparable_listing_id: cheapest?.id ?? null,
      cheapest_comparable_url: cheapest?.url ?? null,
      landed_cost_to_target_usd: landedAdd,
      total_landed_to_target_usd: total,
    })
  }

  const insight = composeArbitrageInsight(byRegion, input.targetRegion)

  return {
    by_region: byRegion,
    target_region: input.targetRegion,
    narrative_insight: insight,
  }
}

function composeArbitrageInsight(
  byRegion: MarketIntelD2["by_region"],
  target: "US" | "EU" | "UK" | "JP"
): string | null {
  const targetRow = byRegion.find((r) => r.region === target)
  if (!targetRow || targetRow.total_landed_to_target_usd === null) return null

  const candidates = byRegion.filter(
    (r) => r.region !== target && r.total_landed_to_target_usd !== null
  )
  if (candidates.length === 0) return null

  const best = candidates.reduce<typeof byRegion[number]>(
    (acc, r) =>
      (r.total_landed_to_target_usd ?? Infinity) <
      (acc.total_landed_to_target_usd ?? Infinity)
        ? r
        : acc,
    candidates[0]
  )

  const delta = (best.total_landed_to_target_usd ?? 0) - (targetRow.total_landed_to_target_usd ?? 0)
  if (delta >= 0) return null // no arbitrage advantage

  const savingsK = Math.round(Math.abs(delta) / 1000)
  return `${best.region}-sourced example costs ~$${savingsK}K less than local listing after import. Worth exploring if timeline allows.`
}
```

- [ ] **Step 3: Run tests (pass)**

Run: `npm run test -- src/lib/marketIntel/aggregator.test.ts`
Expected: all tests pass (now 6 + 2 = 8).

- [ ] **Step 4: Commit**

```bash
git add src/lib/marketIntel/aggregator.ts src/lib/marketIntel/aggregator.test.ts
git commit -m "feat(marketIntel): add D2 (cross-border arbitrage + landed-cost-aware insight)"
```

---

### Task 1.7c: D3 — peer positioning aggregator

**Files:**
- Modify: `src/lib/marketIntel/aggregator.ts`
- Modify: `src/lib/marketIntel/aggregator.test.ts`

- [ ] **Step 1: Append the failing test**

Add to `aggregator.test.ts`:

```typescript
import { computeD3PeerPositioning } from "./aggregator"

describe("computeD3PeerPositioning", () => {
  it("computes percentile within variant", () => {
    const d3 = computeD3PeerPositioning({
      thisVinPriceUsd: 225000,
      variantSoldPricesUsd: [180000, 200000, 210000, 215000, 225000, 240000, 260000, 280000],
      adjacentVariants: [],
    })
    // 225 is 5th of 8, = 50-62 percentile depending on tie handling — accept 50
    expect(d3.vin_percentile_within_variant).toBeGreaterThanOrEqual(50)
    expect(d3.vin_percentile_within_variant).toBeLessThanOrEqual(75)
    expect(d3.variant_distribution_bins.length).toBeGreaterThan(0)
  })

  it("passes through adjacent variants", () => {
    const d3 = computeD3PeerPositioning({
      thisVinPriceUsd: 225000,
      variantSoldPricesUsd: [],
      adjacentVariants: [
        { variant_key: "992_carrera", variant_label: "992 Carrera", median_usd: 120000, sample_size: 40 },
      ],
    })
    expect(d3.adjacent_variants).toHaveLength(1)
    expect(d3.adjacent_variants[0].variant_key).toBe("992_carrera")
  })
})
```

- [ ] **Step 2: Implement D3**

Append to `aggregator.ts`:

```typescript
export interface D3Input {
  thisVinPriceUsd: number
  variantSoldPricesUsd: number[]
  adjacentVariants: MarketIntelD3["adjacent_variants"]
}

export function computeD3PeerPositioning(input: D3Input): MarketIntelD3 {
  const sorted = [...input.variantSoldPricesUsd].sort((a, b) => a - b)
  const percentile =
    sorted.length === 0
      ? 50
      : Math.round(
          (sorted.filter((p) => p <= input.thisVinPriceUsd).length / sorted.length) * 100
        )

  const bins = computeDistributionBins(sorted)

  return {
    vin_percentile_within_variant: percentile,
    variant_distribution_bins: bins,
    adjacent_variants: input.adjacentVariants,
  }
}

function computeDistributionBins(
  sortedPrices: number[]
): MarketIntelD3["variant_distribution_bins"] {
  if (sortedPrices.length === 0) return []
  const min = sortedPrices[0]
  const max = sortedPrices[sortedPrices.length - 1]
  const range = max - min
  if (range === 0) {
    return [{ price_bucket_usd_low: min, price_bucket_usd_high: min, count: sortedPrices.length }]
  }
  const binCount = Math.min(10, Math.max(4, Math.floor(Math.sqrt(sortedPrices.length))))
  const binSize = range / binCount
  const bins: MarketIntelD3["variant_distribution_bins"] = []
  for (let i = 0; i < binCount; i++) {
    const lo = min + i * binSize
    const hi = i === binCount - 1 ? max : lo + binSize
    const count = sortedPrices.filter((p) => p >= lo && p <= hi).length
    bins.push({
      price_bucket_usd_low: Math.round(lo),
      price_bucket_usd_high: Math.round(hi),
      count,
    })
  }
  return bins
}
```

- [ ] **Step 3: Run tests (pass)**

Run: `npm run test -- src/lib/marketIntel/aggregator.test.ts`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/marketIntel/aggregator.ts src/lib/marketIntel/aggregator.test.ts
git commit -m "feat(marketIntel): add D3 (peer positioning + adjacent variants)"
```

---

### Task 1.8: Create `remarkableGenerator`

**Files:**
- Create: `src/lib/remarkableGenerator/types.ts`
- Create: `src/lib/remarkableGenerator/generator.ts`
- Create: `src/lib/remarkableGenerator/generator.test.ts`

- [ ] **Step 1: Types**

Create `src/lib/remarkableGenerator/types.ts`:

```typescript
import type { DetectedSignal, ReportTier, RemarkableClaim } from "@/lib/fairValue/types"
import type { KBEntry } from "@/lib/variantKB/types"
import type { ReferencePack } from "@/lib/referencePack/types"

export interface RemarkableGeneratorInput {
  tier: ReportTier
  variant_key: string
  signals: DetectedSignal[]
  reference_pack: ReferencePack | null // null for Tier 1
  kb_entries: KBEntry[] // empty for Tier 1
  specialist_claims: RemarkableClaim[] // empty for Tier 1 and Tier 2
}

export interface RemarkableGeneratorOutput {
  claims: RemarkableClaim[]
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/remarkableGenerator/generator.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { generateRemarkable } from "./generator"
import type { DetectedSignal } from "@/lib/fairValue/types"

const signalPts: DetectedSignal = {
  key: "paint_to_sample",
  name_i18n_key: "report.signals.paint_to_sample",
  value_display: "Gulf Blue (PTS code Y5C)",
  evidence: {
    source_type: "listing_text",
    source_ref: "description_text:char_244_311",
    raw_excerpt: "Paint-to-Sample Gulf Blue, code Y5C",
    confidence: "high",
  },
}

describe("generateRemarkable — Tier 1", () => {
  it("produces 1 claim per signal, tier_required tier_1", () => {
    const out = generateRemarkable({
      tier: "tier_1",
      variant_key: "992_gt3",
      signals: [signalPts],
      reference_pack: null,
      kb_entries: [],
      specialist_claims: [],
    })
    expect(out.claims).toHaveLength(1)
    expect(out.claims[0].tier_required).toBe("tier_1")
    expect(out.claims[0].source_type).toBe("signal")
    expect(out.claims[0].source_ref).toBe("paint_to_sample")
    expect(out.claims[0].claim_text).toContain("Gulf Blue")
  })

  it("caps at 3 claims for Tier 1", () => {
    const s1 = { ...signalPts, key: "paint_to_sample" }
    const s2 = { ...signalPts, key: "transmission_manual" }
    const s3 = { ...signalPts, key: "service_records" }
    const s4 = { ...signalPts, key: "low_previous_owners" }
    const out = generateRemarkable({
      tier: "tier_1",
      variant_key: "992_gt3",
      signals: [s1, s2, s3, s4],
      reference_pack: null,
      kb_entries: [],
      specialist_claims: [],
    })
    expect(out.claims).toHaveLength(3)
  })
})

describe("generateRemarkable — Tier 2", () => {
  it("includes reference pack and KB entries", () => {
    const out = generateRemarkable({
      tier: "tier_2",
      variant_key: "992_gt3",
      signals: [signalPts],
      reference_pack: {
        variant_key: "992_gt3",
        entries: [
          {
            id: "rp1",
            variant_key: "992_gt3",
            category: "option_rarity",
            claim_text: "PTS Y5C represents ~12% of 992 GT3 order book in 2023",
            source_name: "Rennlist",
            source_url: "https://rennlist.example",
            source_capture_date: "2026-04-01",
            confidence: "medium",
          },
        ],
        last_updated: "2026-04-15",
      },
      kb_entries: [],
      specialist_claims: [],
    })
    expect(out.claims.length).toBeGreaterThanOrEqual(2)
    expect(out.claims.some((c) => c.source_type === "reference_pack")).toBe(true)
    const rpClaim = out.claims.find((c) => c.source_type === "reference_pack")!
    expect(rpClaim.source_url).toBe("https://rennlist.example")
    expect(rpClaim.tier_required).toBe("tier_2")
  })
})

describe("generateRemarkable — Tier 3", () => {
  it("appends specialist agent claims", () => {
    const out = generateRemarkable({
      tier: "tier_3",
      variant_key: "992_gt3",
      signals: [signalPts],
      reference_pack: null,
      kb_entries: [],
      specialist_claims: [
        {
          id: "sa1",
          claim_text: "This VIN is one of 8 PTS Gulf Blue 992 GT3 Touring US-spec Q3 2023",
          source_type: "specialist_agent",
          source_ref: "agent_992_gt3_v1",
          source_url: "https://press.porsche.com/example",
          capture_date: "2026-04-21",
          confidence: "high",
          tier_required: "tier_3",
        },
      ],
    })
    expect(out.claims.some((c) => c.source_type === "specialist_agent")).toBe(true)
  })
})
```

- [ ] **Step 3: Implement generator**

Create `src/lib/remarkableGenerator/generator.ts`:

```typescript
import type { RemarkableClaim, ReportTier } from "@/lib/fairValue/types"
import type {
  RemarkableGeneratorInput,
  RemarkableGeneratorOutput,
} from "./types"

const TIER_CAPS: Record<ReportTier, number> = {
  tier_1: 3,
  tier_2: 5,
  tier_3: 7,
}

export function generateRemarkable(
  input: RemarkableGeneratorInput
): RemarkableGeneratorOutput {
  const claims: RemarkableClaim[] = []

  // Layer 1: signals (available at all tiers)
  for (const signal of input.signals) {
    claims.push({
      id: `sig_${signal.key}`,
      claim_text: composeSignalClaim(signal),
      source_type: "signal",
      source_ref: signal.key,
      source_url: null,
      capture_date: null,
      confidence: signal.evidence.confidence,
      tier_required: "tier_1",
    })
  }

  // Layer 2: reference pack + KB (Tier 2+)
  if (input.tier === "tier_2" || input.tier === "tier_3") {
    if (input.reference_pack) {
      for (const entry of input.reference_pack.entries) {
        claims.push({
          id: `rp_${entry.id}`,
          claim_text: entry.claim_text,
          source_type: "reference_pack",
          source_ref: entry.id,
          source_url: entry.source_url,
          capture_date: entry.source_capture_date,
          confidence: entry.confidence,
          tier_required: "tier_2",
        })
      }
    }
    for (const kb of input.kb_entries) {
      claims.push({
        id: `kb_${kb.id}`,
        claim_text: kb.claim_text,
        source_type: "kb_entry",
        source_ref: kb.id,
        source_url: kb.source_ref.startsWith("http") ? kb.source_ref : null,
        capture_date: kb.source_capture_date,
        confidence: kb.confidence,
        tier_required: "tier_2",
      })
    }
  }

  // Layer 3: specialist agent findings (Tier 3)
  if (input.tier === "tier_3") {
    for (const claim of input.specialist_claims) {
      claims.push(claim)
    }
  }

  // Apply tier cap (keep highest-confidence first, then by source priority)
  const sorted = claims.sort((a, b) => {
    const confRank = { high: 3, medium: 2, low: 1 }
    return confRank[b.confidence] - confRank[a.confidence]
  })
  const capped = sorted.slice(0, TIER_CAPS[input.tier])

  return { claims: capped }
}

function composeSignalClaim(signal: {
  key: string
  value_display: string
  evidence: { raw_excerpt: string | null; source_type: string }
}): string {
  const prettyKey = signal.key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
  return `${prettyKey}: ${signal.value_display}`
}
```

- [ ] **Step 4: Run tests (pass)**

Run: `npm run test -- src/lib/remarkableGenerator/generator.test.ts`
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/remarkableGenerator/
git commit -m "feat(remarkableGenerator): add tier-aware claim generator (signals → pack → KB → agent)"
```

---

### Task 1.9: Create `exports/storage` helpers

**Files:**
- Create: `src/lib/exports/storage.ts`

- [ ] **Step 1: Create storage helpers**

Create `src/lib/exports/storage.ts`:

```typescript
import { createClient } from "@/lib/supabase/server"

const BUCKET = process.env.SUPABASE_STORAGE_EXPORTS_BUCKET ?? "exports"

export type ExportKind = "pdf" | "xlsx"

export function exportStoragePath(reportHash: string, kind: ExportKind): string {
  const ext = kind === "pdf" ? "pdf" : "xlsx"
  return `${reportHash}/report.${ext}`
}

/** Upload export bytes to Supabase Storage. Idempotent upsert. */
export async function uploadExport(
  reportHash: string,
  kind: ExportKind,
  bytes: Uint8Array | Buffer
): Promise<{ path: string }> {
  const supabase = await createClient()
  const path = exportStoragePath(reportHash, kind)
  const contentType =
    kind === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return { path }
}

/** Return a signed URL valid for N seconds (default 1 hour). */
export async function getSignedExportUrl(
  reportHash: string,
  kind: ExportKind,
  expiresInSeconds = 3600
): Promise<string | null> {
  const supabase = await createClient()
  const path = exportStoragePath(reportHash, kind)
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  if (error || !data) return null
  return data.signedUrl
}

/** Check whether an export already exists for this report hash (cache hit). */
export async function exportExists(
  reportHash: string,
  kind: ExportKind
): Promise<boolean> {
  const supabase = await createClient()
  const folder = reportHash
  const { data, error } = await supabase.storage.from(BUCKET).list(folder)
  if (error || !data) return false
  const filename = kind === "pdf" ? "report.pdf" : "report.xlsx"
  return data.some((item) => item.name === filename)
}
```

No unit tests here — this wraps Supabase Storage which requires integration testing with a real project. BE will verify bucket setup during handoff.

- [ ] **Step 2: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: no errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/exports/storage.ts
git commit -m "feat(exports): add Supabase Storage helpers for PDF/Excel by report hash"
```

---

### Phase 1 checkpoint

**Run the full test suite:**

```bash
npm run test
```

Expected: all tests pass (existing + new from tasks 1.3–1.8).

**Run lint:**

```bash
npm run lint
```

Expected: clean.

**Commit the checkpoint:**

```bash
git commit --allow-empty -m "checkpoint: Phase 1 foundation complete (types + lib modules)"
```

---

# PHASE 2 — Online Report IA (Mobile-First)

**Goal:** Replace the 2808-line `ReportClient.tsx` with a composed layout of 14 block components. Mobile-first. Tier-aware rendering. Every data point has visible source attribution.

**Strategy:** Build primitives first (shared building blocks used across multiple blocks), then build each block in IA order (§5.1 → §5.14). At the end, rewrite `ReportClient.tsx` to compose them.

**Files created/modified in this phase:**
- `src/components/report/primitives/SourceBadge.tsx` — CREATE
- `src/components/report/primitives/ClaimCard.tsx` — CREATE
- `src/components/report/primitives/ConfidenceDot.tsx` — CREATE
- `src/components/report/primitives/TierGate.tsx` — CREATE
- `src/components/report/primitives/CollapsibleList.tsx` — CREATE
- `src/components/report/ReportHeader.tsx` — CREATE
- `src/components/report/VerdictBlock.tsx` — CREATE
- `src/components/report/SpecificCarFairValueBlock.tsx` — CREATE
- `src/components/report/MarketIntelPanel.tsx` — CREATE
- `src/components/report/WhatsRemarkableBlock.tsx` — CREATE
- `src/components/report/ValuationBreakdownBlock.tsx` — CREATE
- `src/components/report/ArbitrageSignalBlock.tsx` — CREATE
- `src/components/report/ComparablesAndPositioningBlock.tsx` — CREATE
- `src/components/report/MarketContextBlock.tsx` — CREATE
- `src/components/report/SignalsDetectedBlock.tsx` — REFACTOR existing
- `src/components/report/QuestionsToAskBlock.tsx` — CREATE
- `src/components/report/MethodologyLink.tsx` — CREATE
- `src/components/report/ReportSourcesBlock.tsx` — REFACTOR existing `SourcesBlock.tsx`
- `src/components/report/ReportMetadataFooter.tsx` — CREATE
- `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx` — REWRITE
- Each component gets a co-located `.test.tsx`

---

### Task 2.1: Primitive — `SourceBadge`

**Files:**
- Create: `src/components/report/primitives/SourceBadge.tsx`
- Create: `src/components/report/primitives/SourceBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/report/primitives/SourceBadge.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { SourceBadge } from "./SourceBadge"

describe("SourceBadge", () => {
  it("renders source name", () => {
    render(<SourceBadge name="BaT" count={14} captureDate="Apr 15–21, 2026" />)
    expect(screen.getByText(/BaT/)).toBeInTheDocument()
    expect(screen.getByText(/14/)).toBeInTheDocument()
    expect(screen.getByText(/Apr 15–21, 2026/)).toBeInTheDocument()
  })

  it("exposes onClick handler", () => {
    let clicked = false
    render(<SourceBadge name="BaT" onClick={() => (clicked = true)} />)
    screen.getByRole("button").click()
    expect(clicked).toBe(true)
  })

  it("renders as span (non-interactive) when no onClick", () => {
    render(<SourceBadge name="BaT" />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test (fails)**

Run: `npm run test -- src/components/report/primitives/SourceBadge.test.tsx`

- [ ] **Step 3: Implement**

Create `src/components/report/primitives/SourceBadge.tsx`:

```tsx
"use client"

interface SourceBadgeProps {
  name: string
  count?: number
  captureDate?: string
  url?: string
  onClick?: () => void
  className?: string
}

export function SourceBadge({
  name,
  count,
  captureDate,
  onClick,
  className = "",
}: SourceBadgeProps) {
  const content = (
    <>
      <span className="font-medium">{name}</span>
      {count !== undefined && <span className="text-muted-foreground">· {count}</span>}
      {captureDate && <span className="text-muted-foreground">· {captureDate}</span>}
    </>
  )

  const base =
    "inline-flex items-center gap-1 rounded-full bg-foreground/5 hover:bg-foreground/10 px-2 py-0.5 text-[11px] transition-colors"

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} cursor-pointer ${className}`}
      >
        {content}
      </button>
    )
  }

  return <span className={`${base} ${className}`}>{content}</span>
}
```

- [ ] **Step 4: Run test (passes)**

Run: `npm run test -- src/components/report/primitives/SourceBadge.test.tsx`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/report/primitives/SourceBadge.tsx src/components/report/primitives/SourceBadge.test.tsx
git commit -m "feat(report/primitives): add SourceBadge component"
```

---

### Task 2.2: Primitives — `ConfidenceDot`, `TierGate`, `CollapsibleList`, `ClaimCard`

All four are small. Create them together with one commit.

**Files:** all under `src/components/report/primitives/`

- [ ] **Step 1: `ConfidenceDot.tsx`**

```tsx
interface ConfidenceDotProps {
  level: "high" | "medium" | "low" | "insufficient"
  className?: string
}

const CLASS_BY_LEVEL = {
  high: "bg-positive",
  medium: "bg-amber-500",
  low: "bg-orange-500",
  insufficient: "bg-muted-foreground",
} as const

export function ConfidenceDot({ level, className = "" }: ConfidenceDotProps) {
  return (
    <span
      aria-label={`${level} confidence`}
      title={`${level} confidence`}
      className={`inline-block size-2 rounded-full ${CLASS_BY_LEVEL[level]} ${className}`}
    />
  )
}
```

- [ ] **Step 2: `TierGate.tsx`** — shows children only if user's tier ≥ required

```tsx
import type { ReportTier } from "@/lib/fairValue/types"

const TIER_RANK: Record<ReportTier, number> = {
  tier_1: 1,
  tier_2: 2,
  tier_3: 3,
}

interface TierGateProps {
  userTier: ReportTier
  requiredTier: ReportTier
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function TierGate({ userTier, requiredTier, fallback = null, children }: TierGateProps) {
  if (TIER_RANK[userTier] >= TIER_RANK[requiredTier]) return <>{children}</>
  return <>{fallback}</>
}
```

- [ ] **Step 3: `CollapsibleList.tsx`** — "show all N" UX pattern

```tsx
"use client"

import { useState } from "react"

interface CollapsibleListProps<T> {
  items: T[]
  initialCount: number
  render: (item: T, index: number) => React.ReactNode
  moreLabel: (hidden: number) => string // e.g., "Show all 18 signals"
  lessLabel?: string
  className?: string
}

export function CollapsibleList<T>({
  items,
  initialCount,
  render,
  moreLabel,
  lessLabel = "Show less",
  className = "",
}: CollapsibleListProps<T>) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, initialCount)
  const hidden = items.length - visible.length

  return (
    <div className={className}>
      <div className="space-y-2">{visible.map((item, i) => render(item, i))}</div>
      {(hidden > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-[12px] text-primary hover:underline"
        >
          {expanded ? lessLabel : moreLabel(hidden)}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: `ClaimCard.tsx`** — editorial card for "What's Remarkable" claims

```tsx
import type { RemarkableClaim } from "@/lib/fairValue/types"
import { SourceBadge } from "./SourceBadge"
import { ConfidenceDot } from "./ConfidenceDot"

interface ClaimCardProps {
  claim: RemarkableClaim
  onSourceClick?: (claim: RemarkableClaim) => void
}

export function ClaimCard({ claim, onSourceClick }: ClaimCardProps) {
  const sourceLabel = claim.source_url
    ? new URL(claim.source_url).hostname.replace(/^www\./, "")
    : claim.source_type.replace(/_/g, " ")

  return (
    <article className="rounded-xl border border-border bg-card/40 p-4">
      <p className="text-[15px] leading-relaxed text-foreground">{claim.claim_text}</p>
      <div className="mt-3 flex items-center gap-2">
        <SourceBadge
          name={sourceLabel}
          captureDate={claim.capture_date ?? undefined}
          onClick={onSourceClick ? () => onSourceClick(claim) : undefined}
        />
        <ConfidenceDot level={claim.confidence} />
      </div>
    </article>
  )
}
```

- [ ] **Step 5: Write smoke tests for each**

Create co-located `.test.tsx` files — each tests the happy path. Keep them brief. Example for `ClaimCard`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { ClaimCard } from "./ClaimCard"

describe("ClaimCard", () => {
  it("renders claim text and source badge", () => {
    render(
      <ClaimCard
        claim={{
          id: "c1",
          claim_text: "Paint to Sample: Gulf Blue Y5C",
          source_type: "signal",
          source_ref: "paint_to_sample",
          source_url: null,
          capture_date: null,
          confidence: "high",
          tier_required: "tier_1",
        }}
      />
    )
    expect(screen.getByText(/Paint to Sample: Gulf Blue Y5C/)).toBeInTheDocument()
    expect(screen.getByText(/signal/)).toBeInTheDocument()
  })
})
```

Create matching minimal tests for `ConfidenceDot`, `TierGate`, `CollapsibleList` with the same jsdom docblock.

- [ ] **Step 6: Run tests**

Run: `npm run test -- src/components/report/primitives`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/report/primitives/
git commit -m "feat(report/primitives): add ConfidenceDot, TierGate, CollapsibleList, ClaimCard"
```

---

### Task 2.3–2.14 overview

The remaining blocks (Header, Verdict, SpecificCarFairValue, MarketIntelPanel, WhatsRemarkable, ValuationBreakdown, ArbitrageSignal, ComparablesAndPositioning, MarketContext, SignalsDetected, QuestionsToAsk, ReportMetadataFooter) each follow the same task pattern:

**Per block:**
- [ ] **Step 1:** Write failing test (happy path + 1 edge case minimum)
- [ ] **Step 2:** Run test, verify FAIL
- [ ] **Step 3:** Implement component with mobile-first Tailwind (no `md:` modifier prefix for mobile styles; `md:` and above for desktop)
- [ ] **Step 4:** Apply restraint (top-N visible, rest via `CollapsibleList`)
- [ ] **Step 5:** Wire source attribution (`SourceBadge` on every critical datapoint)
- [ ] **Step 6:** Run tests, verify PASS
- [ ] **Step 7:** Commit with message `feat(report): add [BlockName]`

Full code for each block is detailed inline below.

---

### Task 2.3: `ReportHeader`

**Files:**
- Create: `src/components/report/ReportHeader.tsx`
- Create: `src/components/report/ReportHeader.test.tsx`

**Props contract:**

```typescript
interface ReportHeaderProps {
  carTitle: string                       // e.g., "2023 Porsche 992 GT3 Touring"
  carThumbUrl: string | null
  generatedAt: string                    // ISO date
  reportVersion: number
  tier: "tier_1" | "tier_2" | "tier_3"
  onDownloadClick: () => void
  onRegenerateClick?: () => void         // undefined = hide button
}
```

**Implementation:**

```tsx
"use client"

import Image from "next/image"
import { Download, RefreshCw } from "lucide-react"

interface ReportHeaderProps {
  carTitle: string
  carThumbUrl: string | null
  generatedAt: string
  reportVersion: number
  tier: "tier_1" | "tier_2" | "tier_3"
  onDownloadClick: () => void
  onRegenerateClick?: () => void
}

const TIER_LABEL = {
  tier_1: "Tier 1",
  tier_2: "Tier 2",
  tier_3: "Tier 3",
}

export function ReportHeader({
  carTitle,
  carThumbUrl,
  generatedAt,
  reportVersion,
  tier,
  onDownloadClick,
  onRegenerateClick,
}: ReportHeaderProps) {
  const dateStr = new Date(generatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md">
      {carThumbUrl && (
        <Image
          src={carThumbUrl}
          alt={carTitle}
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-lg object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[14px] font-semibold text-foreground md:text-[16px]">
          {carTitle}
        </h1>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground md:text-[11px]">
          Generated {dateStr} · v{reportVersion} · {TIER_LABEL[tier]}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onRegenerateClick && (
          <button
            type="button"
            onClick={onRegenerateClick}
            aria-label="Regenerate"
            className="rounded-lg p-2 hover:bg-foreground/5 active:scale-95"
          >
            <RefreshCw className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onDownloadClick}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 active:scale-95"
        >
          <Download className="size-4" />
          <span className="hidden sm:inline">Download</span>
        </button>
      </div>
    </header>
  )
}
```

**Test (co-located `.test.tsx`):** verify title renders, date formatted, download button fires, regenerate button hidden when prop undefined.

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { ReportHeader } from "./ReportHeader"

describe("ReportHeader", () => {
  it("renders title and formatted date", () => {
    render(
      <ReportHeader
        carTitle="2023 Porsche 992 GT3 Touring"
        carThumbUrl={null}
        generatedAt="2026-04-21T00:00:00Z"
        reportVersion={1}
        tier="tier_2"
        onDownloadClick={() => {}}
      />
    )
    expect(screen.getByText(/2023 Porsche 992 GT3 Touring/)).toBeInTheDocument()
    expect(screen.getByText(/Apr.*2026.*Tier 2/i)).toBeInTheDocument()
  })

  it("hides regenerate when prop not passed", () => {
    render(
      <ReportHeader
        carTitle="Test"
        carThumbUrl={null}
        generatedAt="2026-04-21T00:00:00Z"
        reportVersion={1}
        tier="tier_1"
        onDownloadClick={() => {}}
      />
    )
    expect(screen.queryByLabelText(/Regenerate/)).not.toBeInTheDocument()
  })

  it("fires download callback", () => {
    const onDownload = vi.fn()
    render(
      <ReportHeader
        carTitle="Test"
        carThumbUrl={null}
        generatedAt="2026-04-21T00:00:00Z"
        reportVersion={1}
        tier="tier_1"
        onDownloadClick={onDownload}
      />
    )
    screen.getByText(/Download/).click()
    expect(onDownload).toHaveBeenCalled()
  })
})
```

**Commit:** `feat(report): add ReportHeader (sticky, mobile-first, tier label)`

---

### Task 2.4: `VerdictBlock`

**Files:**
- Create: `src/components/report/VerdictBlock.tsx`
- Create: `src/components/report/VerdictBlock.test.tsx`

**Props:**

```typescript
interface VerdictBlockProps {
  verdict: "BUY" | "WATCH" | "WALK"
  oneLiner: string                          // "Priced 5% below specific-car Fair Value · 14 comparables · high confidence"
  askingUsd: number
  fairValueMidUsd: number
  deltaPercent: number                      // negative = below fair
}
```

**Implementation:**

```tsx
interface VerdictBlockProps {
  verdict: "BUY" | "WATCH" | "WALK"
  oneLiner: string
  askingUsd: number
  fairValueMidUsd: number
  deltaPercent: number
}

const VERDICT_STYLE = {
  BUY: "bg-positive/15 text-positive border-positive/30",
  WATCH: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
  WALK: "bg-destructive/15 text-destructive border-destructive/30",
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`
  return `$${v}`
}

export function VerdictBlock({
  verdict,
  oneLiner,
  askingUsd,
  fairValueMidUsd,
  deltaPercent,
}: VerdictBlockProps) {
  const deltaStr =
    Math.abs(deltaPercent) < 0.5
      ? "at fair"
      : `${deltaPercent > 0 ? "+" : ""}${deltaPercent.toFixed(1)}%`

  return (
    <section aria-labelledby="verdict-label" className="px-4 py-6 md:py-8">
      <div className="flex flex-col items-center text-center">
        <span id="verdict-label" className="sr-only">
          Verdict
        </span>
        <span
          className={`inline-flex items-center rounded-full border-2 px-6 py-2 text-[18px] font-bold tracking-wider md:text-[22px] ${VERDICT_STYLE[verdict]}`}
        >
          {verdict}
        </span>
        <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground md:text-[14px]">
          {oneLiner}
        </p>
      </div>

      <dl className="mx-auto mt-6 grid max-w-lg grid-cols-3 gap-2 border-t border-border pt-4 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Asking</dt>
          <dd className="mt-1 font-mono text-[14px] font-semibold md:text-[16px]">
            {fmtUsd(askingUsd)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Fair Value</dt>
          <dd className="mt-1 font-mono text-[14px] font-semibold md:text-[16px]">
            {fmtUsd(fairValueMidUsd)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Delta</dt>
          <dd className="mt-1 font-mono text-[14px] font-semibold md:text-[16px]">
            {deltaStr}
          </dd>
        </div>
      </dl>
    </section>
  )
}
```

**Test:** renders verdict chip, one-liner, 3 metrics. Verify delta str for negative / positive / within-0.5%.

**Commit:** `feat(report): add VerdictBlock (BUY/WATCH/WALK + 3-metric row)`

---

### Task 2.5: `SpecificCarFairValueBlock`

**Files:**
- Create: `src/components/report/SpecificCarFairValueBlock.tsx`
- Create: `src/components/report/SpecificCarFairValueBlock.test.tsx`

**Props:**

```typescript
interface SpecificCarFairValueBlockProps {
  fairValueLowUsd: number
  fairValueMidUsd: number
  fairValueHighUsd: number
  askingUsd: number
  comparablesCount: number
  comparableLayer: "strict" | "series" | "family"
  onExplainClick?: () => void              // link to valuation breakdown
}
```

**Implementation:** Display a large range hero, a sub-range line, and a horizontal bar showing where `askingUsd` falls within `[fairValueLowUsd, fairValueHighUsd]`. Clamp the marker to the bar. Include link to Valuation Breakdown.

```tsx
"use client"

import { ArrowRight } from "lucide-react"

interface SpecificCarFairValueBlockProps {
  fairValueLowUsd: number
  fairValueMidUsd: number
  fairValueHighUsd: number
  askingUsd: number
  comparablesCount: number
  comparableLayer: "strict" | "series" | "family"
  onExplainClick?: () => void
}

function fmtK(v: number): string {
  return `$${Math.round(v / 1000)}K`
}

export function SpecificCarFairValueBlock({
  fairValueLowUsd,
  fairValueMidUsd,
  fairValueHighUsd,
  askingUsd,
  comparablesCount,
  comparableLayer,
  onExplainClick,
}: SpecificCarFairValueBlockProps) {
  const range = fairValueHighUsd - fairValueLowUsd
  const clampedMarker =
    range <= 0
      ? 50
      : Math.max(0, Math.min(100, ((askingUsd - fairValueLowUsd) / range) * 100))

  return (
    <section className="px-4 py-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Specific-Car Fair Value
      </h2>
      <p className="mt-2 font-mono text-[28px] font-bold leading-none tracking-tight md:text-[36px]">
        {fmtK(fairValueLowUsd)} – {fmtK(fairValueHighUsd)}
      </p>
      <p className="mt-2 text-[12px] text-muted-foreground">
        Mid {fmtK(fairValueMidUsd)} · Layer: {comparableLayer} · {comparablesCount} comparables
      </p>

      <div className="mt-4 space-y-2">
        <div className="relative h-2 rounded-full bg-foreground/10">
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary"
            style={{ left: `${clampedMarker}%` }}
            aria-label={`Asking price position: ${clampedMarker.toFixed(0)}%`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{fmtK(fairValueLowUsd)}</span>
          <span className="text-foreground font-medium">
            Asking {fmtK(askingUsd)}
          </span>
          <span>{fmtK(fairValueHighUsd)}</span>
        </div>
      </div>

      {onExplainClick && (
        <button
          type="button"
          onClick={onExplainClick}
          className="mt-4 inline-flex items-center gap-1 text-[12px] text-primary hover:underline"
        >
          See how this was computed <ArrowRight className="size-3" />
        </button>
      )}
    </section>
  )
}
```

**Test:** renders range, mid, layer, comparables count, marker position matches asking-relative-to-range.

**Commit:** `feat(report): add SpecificCarFairValueBlock (range hero + marker bar)`

---

### Task 2.6: `MarketIntelPanel`

**Files:**
- Create: `src/components/report/MarketIntelPanel.tsx`
- Create: `src/components/report/MarketIntelPanel.test.tsx`

**Props:**

```typescript
interface MarketIntelPanelProps {
  d1: MarketIntelD1
  d4: MarketIntelD4
  onExpandD1?: () => void
  onExpandD4?: () => void
}
```

**Mobile behavior:** sticky top toolbar (below header), tap to expand full detail via drawer.
**Desktop behavior:** right rail inside main layout (not a separate sticky sidebar — keeps the spec's "collapsible right rail, not persistent sidebar" constraint).

**Implementation:**

```tsx
"use client"

import { ChevronDown } from "lucide-react"
import type { MarketIntelD1, MarketIntelD4 } from "@/lib/fairValue/types"
import { ConfidenceDot } from "./primitives/ConfidenceDot"

interface MarketIntelPanelProps {
  d1: MarketIntelD1
  d4: MarketIntelD4
  onExpandD1?: () => void
  onExpandD4?: () => void
}

// Tiny inline sparkline (no recharts for this footprint — SVG direct).
function Sparkline({ points }: { points: Array<{ median_usd: number }> }) {
  if (points.length < 2) return null
  const w = 72
  const h = 24
  const max = Math.max(...points.map((p) => p.median_usd))
  const min = Math.min(...points.map((p) => p.median_usd))
  const range = max - min || 1
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p.median_usd - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-primary"
      />
    </svg>
  )
}

export function MarketIntelPanel({ d1, d4, onExpandD1, onExpandD4 }: MarketIntelPanelProps) {
  return (
    <aside
      aria-label="Market Intel Panel"
      className="sticky top-[56px] z-20 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md md:static md:rounded-xl md:border md:py-4"
    >
      <div className="grid grid-cols-3 gap-3 md:grid-cols-1 md:gap-4">
        <button
          type="button"
          onClick={onExpandD1}
          className="flex items-center gap-2 text-left hover:opacity-80 md:flex-col md:items-start"
        >
          <Sparkline points={d1.sold_trajectory} />
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">12m trend</p>
            <p className="text-[12px] font-semibold">
              {d1.trend_12m_direction === "stable"
                ? "Stable"
                : `${d1.trend_12m_direction === "up" ? "↑" : "↓"} ${Math.abs(d1.trend_12m_percent).toFixed(1)}%`}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onExpandD4}
          className="flex items-center gap-2 text-left hover:opacity-80 md:flex-col md:items-start"
        >
          <ConfidenceDot level={d4.confidence_tier} />
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Confidence</p>
            <p className="text-[12px] font-semibold capitalize">
              {d4.confidence_tier} · {d4.sample_size}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 md:flex-col md:items-start">
          <div className="size-2" aria-hidden />
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Captured</p>
            <p className="text-[11px] text-muted-foreground">
              {formatDateRange(d4.capture_date_start, d4.capture_date_end)}
            </p>
          </div>
        </div>
      </div>
      {(onExpandD1 || onExpandD4) && (
        <p className="mt-3 flex items-center justify-center gap-1 text-[10px] text-muted-foreground md:hidden">
          <ChevronDown className="size-3" /> Tap to expand
        </p>
      )}
    </aside>
  )
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  return `${s.toLocaleDateString("en-US", opts)}–${e.toLocaleDateString("en-US", opts)}`
}
```

**Test:** renders 3 metric slots, trend direction displays correctly, confidence level capitalized.

**Commit:** `feat(report): add MarketIntelPanel (mobile sticky toolbar, desktop right rail)`

---

### Task 2.7: `WhatsRemarkableBlock`

**Files:**
- Create: `src/components/report/WhatsRemarkableBlock.tsx`
- Create: `src/components/report/WhatsRemarkableBlock.test.tsx`

**Props:**

```typescript
interface WhatsRemarkableBlockProps {
  claims: RemarkableClaim[]             // already filtered/ordered by generator
  tier: ReportTier
  onUpgradeClick?: () => void           // Tier 1 CTA
  onSeeSampleClick?: () => void         // "See sample" opens modal with another car's Tier 2 output
  onSourceClick?: (claim: RemarkableClaim) => void
}
```

**Behavior:**
- Render each claim via `ClaimCard`
- Tier 1: show an upgrade panel below with "See sample" CTA (no nag — subtle)
- Tier 2/3: no upgrade panel

**Implementation:**

```tsx
"use client"

import type { RemarkableClaim, ReportTier } from "@/lib/fairValue/types"
import { ClaimCard } from "./primitives/ClaimCard"
import { Sparkles } from "lucide-react"

interface WhatsRemarkableBlockProps {
  claims: RemarkableClaim[]
  tier: ReportTier
  onUpgradeClick?: () => void
  onSeeSampleClick?: () => void
  onSourceClick?: (claim: RemarkableClaim) => void
}

export function WhatsRemarkableBlock({
  claims,
  tier,
  onUpgradeClick,
  onSeeSampleClick,
  onSourceClick,
}: WhatsRemarkableBlockProps) {
  const subtitle =
    tier === "tier_1"
      ? `${claims.length} findings about this specific VIN`
      : tier === "tier_2"
        ? `${claims.length} findings with specialist context`
        : `${claims.length} findings with specialist variant analysis`

  return (
    <section className="px-4 py-6" aria-labelledby="remarkable-heading">
      <h2
        id="remarkable-heading"
        className="font-serif text-[20px] font-semibold md:text-[24px]"
      >
        What's Remarkable
      </h2>
      <p className="mt-1 text-[12px] text-muted-foreground">{subtitle}</p>

      <div className="mt-4 space-y-3">
        {claims.map((claim) => (
          <ClaimCard key={claim.id} claim={claim} onSourceClick={onSourceClick} />
        ))}
      </div>

      {tier === "tier_1" && (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-card/30 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-[13px] font-medium">
                Monthly subscribers unlock production context + specialist variant analysis
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                {onSeeSampleClick && (
                  <button
                    type="button"
                    onClick={onSeeSampleClick}
                    className="text-primary hover:underline"
                  >
                    See sample →
                  </button>
                )}
                {onUpgradeClick && (
                  <button
                    type="button"
                    onClick={onUpgradeClick}
                    className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Upgrade
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
```

**Test:** renders N claims for each tier, Tier 1 shows upgrade CTA, Tier 2/3 does not.

**Commit:** `feat(report): add WhatsRemarkableBlock (tier-gated with upgrade panel for T1)`

---

### Task 2.8: `ValuationBreakdownBlock`

**Files:**
- Create: `src/components/report/ValuationBreakdownBlock.tsx`
- Create: `src/components/report/ValuationBreakdownBlock.test.tsx`

**Props:**

```typescript
interface ValuationBreakdownBlockProps {
  baselineMedianUsd: number
  aggregateModifierPercent: number
  specificCarFairValueMidUsd: number
  modifiers: AppliedModifier[]              // all 12 applied
  onSourceClick?: (modifierKey: string, citationUrl: string | null) => void
}
```

**Behavior:**
- Visual line showing `baseline → +/-% modifiers → specific fair value`
- Top 3 most-impactful modifiers as cards
- `CollapsibleList` for remaining 9

**Implementation (partial — iterate):**

```tsx
"use client"

import type { AppliedModifier } from "@/lib/fairValue/types"
import { MODIFIER_LIBRARY } from "@/lib/fairValue/modifiers"
import { CollapsibleList } from "./primitives/CollapsibleList"
import { SourceBadge } from "./primitives/SourceBadge"

interface ValuationBreakdownBlockProps {
  baselineMedianUsd: number
  aggregateModifierPercent: number
  specificCarFairValueMidUsd: number
  modifiers: AppliedModifier[]
  onSourceClick?: (modifierKey: string, citationUrl: string | null) => void
}

function fmtK(v: number) {
  return `$${Math.round(v / 1000)}K`
}

export function ValuationBreakdownBlock({
  baselineMedianUsd,
  aggregateModifierPercent,
  specificCarFairValueMidUsd,
  modifiers,
  onSourceClick,
}: ValuationBreakdownBlockProps) {
  const sorted = [...modifiers].sort(
    (a, b) => Math.abs(b.baseline_contribution_usd) - Math.abs(a.baseline_contribution_usd)
  )

  return (
    <section className="px-4 py-6" aria-labelledby="valuation-heading">
      <h2 id="valuation-heading" className="font-serif text-[20px] font-semibold md:text-[24px]">
        How we arrived at {fmtK(specificCarFairValueMidUsd)}
      </h2>

      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-card/30 p-4 text-[13px] md:flex-row md:items-center md:justify-between">
        <span>
          Baseline median <strong className="font-mono">{fmtK(baselineMedianUsd)}</strong>
        </span>
        <span className="text-muted-foreground">→</span>
        <span>
          Modifiers{" "}
          <strong
            className={`font-mono ${
              aggregateModifierPercent >= 0 ? "text-positive" : "text-destructive"
            }`}
          >
            {aggregateModifierPercent >= 0 ? "+" : ""}
            {aggregateModifierPercent.toFixed(1)}%
          </strong>
        </span>
        <span className="text-muted-foreground">=</span>
        <span>
          Fair Value <strong className="font-mono">{fmtK(specificCarFairValueMidUsd)}</strong>
        </span>
      </div>

      <h3 className="mt-5 text-[13px] font-semibold text-muted-foreground">
        Top modifiers applied
      </h3>
      <CollapsibleList
        items={sorted}
        initialCount={3}
        moreLabel={(hidden) => `Show all ${sorted.length} modifiers applied →`}
        render={(m) => {
          const def = MODIFIER_LIBRARY[m.key as keyof typeof MODIFIER_LIBRARY]
          return (
            <div
              key={m.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/30 p-3"
            >
              <div>
                <p className="text-[13px] font-medium capitalize">
                  {m.key.replace(/_/g, " ")}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {m.delta_percent >= 0 ? "+" : ""}
                  {m.delta_percent}% · {fmtK(Math.abs(m.baseline_contribution_usd))}{" "}
                  {m.baseline_contribution_usd >= 0 ? "added" : "subtracted"}
                </p>
              </div>
              {m.citation_url && (
                <SourceBadge
                  name="Source"
                  onClick={() => onSourceClick?.(m.key, m.citation_url)}
                />
              )}
            </div>
          )
        }}
        className="mt-3"
      />
    </section>
  )
}
```

**Test:** renders baseline line, top-3 initially visible, expand reveals all.

**Commit:** `feat(report): add ValuationBreakdownBlock (top-3 + collapsible all)`

---

### Task 2.9: `ArbitrageSignalBlock`

**Files:**
- Create: `src/components/report/ArbitrageSignalBlock.tsx`
- Create: `src/components/report/ArbitrageSignalBlock.test.tsx`

**Props:**

```typescript
interface ArbitrageSignalBlockProps {
  d2: MarketIntelD2
  thisListingPriceUsd: number
}
```

**Implementation:**

```tsx
"use client"

import type { MarketIntelD2 } from "@/lib/fairValue/types"
import { ExternalLink } from "lucide-react"

const FLAG: Record<MarketIntelD2["by_region"][number]["region"], string> = {
  US: "🇺🇸",
  EU: "🇪🇺",
  UK: "🇬🇧",
  JP: "🇯🇵",
}

function fmtK(v: number | null): string {
  if (v === null) return "—"
  return `$${Math.round(v / 1000)}K`
}

interface ArbitrageSignalBlockProps {
  d2: import("@/lib/fairValue/types").MarketIntelD2
  thisListingPriceUsd: number
}

export function ArbitrageSignalBlock({ d2, thisListingPriceUsd }: ArbitrageSignalBlockProps) {
  return (
    <section className="px-4 py-6" aria-labelledby="arbitrage-heading">
      <h2 id="arbitrage-heading" className="font-serif text-[20px] font-semibold md:text-[24px]">
        Cross-Border Opportunity
      </h2>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Cheapest comparable per region, landed to {d2.target_region}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {d2.by_region.map((row) => {
          const isTarget = row.region === d2.target_region
          return (
            <div
              key={row.region}
              className={`rounded-xl border p-4 ${
                isTarget
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">
                  {FLAG[row.region]} {row.region}
                  {isTarget && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      (this listing)
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-2 font-mono text-[18px] font-bold">
                {isTarget ? fmtK(thisListingPriceUsd) : fmtK(row.cheapest_comparable_usd)}
              </p>
              {!isTarget && row.landed_cost_to_target_usd !== null && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  + landed {fmtK(row.landed_cost_to_target_usd)} = {fmtK(row.total_landed_to_target_usd)}
                </p>
              )}
              {row.cheapest_comparable_url && (
                <a
                  href={row.cheapest_comparable_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  View listing <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          )
        })}
      </div>

      {d2.narrative_insight && (
        <p className="mt-4 rounded-lg bg-primary/5 p-3 text-[13px] italic">
          💡 {d2.narrative_insight}
        </p>
      )}
    </section>
  )
}
```

**Test:** renders 4 region cards, target region highlighted, narrative insight shows only when non-null.

**Commit:** `feat(report): add ArbitrageSignalBlock (D2, 4-region cards + narrative)`

---

### Task 2.10: `ComparablesAndPositioningBlock`

**Files:**
- Create: `src/components/report/ComparablesAndPositioningBlock.tsx`
- Create: `src/components/report/ComparablesAndPositioningBlock.test.tsx`

**Props:**

```typescript
interface ComparablesAndPositioningBlockProps {
  d3: MarketIntelD3
  thisVinPriceUsd: number
  comparables: DbComparableRow[]
  initialTab?: "distribution" | "table"
}
```

**Behavior:** 2 tabs — "Distribution chart" (default) + "Comparables table". Mobile: table becomes stacked cards.

**Implementation:** Use `recharts` `BarChart` for the distribution. Use `CollapsibleList` inside table tab.

```tsx
"use client"

import { useState } from "react"
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import type { MarketIntelD3 } from "@/lib/fairValue/types"
import type { DbComparableRow } from "@/lib/db/queries"
import { CollapsibleList } from "./primitives/CollapsibleList"
import { ExternalLink } from "lucide-react"

interface ComparablesAndPositioningBlockProps {
  d3: MarketIntelD3
  thisVinPriceUsd: number
  comparables: DbComparableRow[]
  initialTab?: "distribution" | "table"
}

function fmtK(v: number): string {
  return `$${Math.round(v / 1000)}K`
}

export function ComparablesAndPositioningBlock({
  d3,
  thisVinPriceUsd,
  comparables,
  initialTab = "distribution",
}: ComparablesAndPositioningBlockProps) {
  const [tab, setTab] = useState<"distribution" | "table">(initialTab)

  const chartData = d3.variant_distribution_bins.map((b) => ({
    label: `${fmtK(b.price_bucket_usd_low)}`,
    midUsd: (b.price_bucket_usd_low + b.price_bucket_usd_high) / 2,
    count: b.count,
  }))

  return (
    <section className="px-4 py-6" aria-labelledby="comparables-heading">
      <h2 id="comparables-heading" className="font-serif text-[20px] font-semibold md:text-[24px]">
        Comparables &amp; Positioning
      </h2>

      <div className="mt-3 flex gap-1 border-b border-border text-[13px]">
        <button
          type="button"
          onClick={() => setTab("distribution")}
          className={`px-3 py-2 transition-colors ${
            tab === "distribution"
              ? "border-b-2 border-primary font-semibold"
              : "text-muted-foreground"
          }`}
        >
          Distribution
        </button>
        <button
          type="button"
          onClick={() => setTab("table")}
          className={`px-3 py-2 transition-colors ${
            tab === "table"
              ? "border-b-2 border-primary font-semibold"
              : "text-muted-foreground"
          }`}
        >
          Comparables ({comparables.length})
        </button>
      </div>

      {tab === "distribution" && (
        <div className="mt-4">
          <p className="text-[12px] text-muted-foreground">
            This VIN falls in the{" "}
            <strong className="text-foreground">
              {d3.vin_percentile_within_variant}th percentile
            </strong>{" "}
            of variant sold prices in the last 12 months.
          </p>
          <div className="mt-3 h-48 w-full">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v: number) => [`${v} sold`, ""]}
                  labelFormatter={(l) => `Bucket starting ${l}`}
                />
                <Bar dataKey="count" fill="currentColor" className="text-primary" />
                <ReferenceLine
                  x={chartData.reduce(
                    (closest, b) =>
                      Math.abs(b.midUsd - thisVinPriceUsd) <
                      Math.abs(closest.midUsd - thisVinPriceUsd)
                        ? b
                        : closest,
                    chartData[0] ?? { label: "", midUsd: 0 }
                  )?.label}
                  stroke="currentColor"
                  strokeDasharray="3 3"
                  className="text-destructive"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === "table" && (
        <CollapsibleList
          items={comparables}
          initialCount={5}
          moreLabel={(hidden) => `Show all ${comparables.length} comparables →`}
          render={(c) => (
            <div
              key={c.id}
              className="grid grid-cols-1 gap-1 rounded-lg border border-border bg-card/30 p-3 text-[12px] md:grid-cols-5"
            >
              <span>
                <span className="text-muted-foreground md:hidden">Year · </span>
                {c.year}
              </span>
              <span>
                <span className="text-muted-foreground md:hidden">Mileage · </span>
                {c.mileage?.toLocaleString() ?? "—"}
              </span>
              <span className="font-mono">
                <span className="text-muted-foreground md:hidden">Sold · </span>
                {fmtK(c.hammerPrice)}
              </span>
              <span>
                <span className="text-muted-foreground md:hidden">Date · </span>
                {c.saleDate ?? "—"}
              </span>
              <a
                href={"/cars/porsche/" + c.id}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {c.source} <ExternalLink className="size-3" />
              </a>
            </div>
          )}
          className="mt-4"
        />
      )}
    </section>
  )
}
```

**Test:** renders percentile, switches tabs, shows 5 rows initially then expand to all.

**Commit:** `feat(report): add ComparablesAndPositioningBlock (2 tabs + percentile marker)`

---

### Task 2.11: `MarketContextBlock` (compact)

**Files:**
- Create: `src/components/report/MarketContextBlock.tsx`
- Create: `src/components/report/MarketContextBlock.test.tsx`

**Props:**

```typescript
interface MarketContextBlockProps {
  regions: RegionalMarketStats[]          // existing type
}
```

**Implementation:** Strip of 4 regional cards. Each: flag + median sold + sample count + 6m trend arrow. Compact — no deep dive here.

```tsx
import type { RegionalMarketStats } from "@/lib/reports/types"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

const FLAG: Record<string, string> = {
  US: "🇺🇸",
  EU: "🇪🇺",
  UK: "🇬🇧",
  JP: "🇯🇵",
}

function fmtK(v: number): string {
  return `$${Math.round(v / 1000)}K`
}

interface MarketContextBlockProps {
  regions: RegionalMarketStats[]
}

export function MarketContextBlock({ regions }: MarketContextBlockProps) {
  return (
    <section className="px-4 py-6" aria-labelledby="market-context-heading">
      <h2 id="market-context-heading" className="font-serif text-[18px] font-semibold md:text-[20px]">
        Market Context
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {regions.map((r) => {
          const TrendIcon =
            r.trendDirection === "up" ? TrendingUp : r.trendDirection === "down" ? TrendingDown : Minus
          const trendClass =
            r.trendDirection === "up"
              ? "text-positive"
              : r.trendDirection === "down"
                ? "text-destructive"
                : "text-muted-foreground"
          return (
            <div key={r.region} className="rounded-lg border border-border bg-card/30 p-3">
              <p className="text-[13px] font-semibold">
                {FLAG[r.region] ?? ""} {r.region}
              </p>
              <p className="mt-1 font-mono text-[15px]">{fmtK(r.medianPriceUsd)}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                {r.totalListings} sold{" "}
                <TrendIcon className={`size-3 ${trendClass}`} />
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

**Test:** renders N regions with flags and trend icons.

**Commit:** `feat(report): add MarketContextBlock (compact 4-region strip)`

---

### Task 2.12: `SignalsDetectedBlock` (refactor existing + Risk Flags inline)

**Files:**
- Modify: `src/components/report/SignalsDetectedSection.tsx` → rename to `SignalsDetectedBlock.tsx`
- Create: `src/components/report/SignalsDetectedBlock.test.tsx`

Update the existing `SignalsDetectedSection` to:
1. Split detected signals into `risk` (those with negative-direction modifiers: `accident_history`, `modifications`) and `positive`
2. Render risk flags first as red chips, above positive signals
3. Use `CollapsibleList` for positive signals beyond top 5

Pull the existing component, wrap with the new logic. Full code in task execution but follow the pattern established in Tasks 2.7–2.10.

**Commit:** `refactor(report): rename SignalsDetectedSection → SignalsDetectedBlock with Risk Flags inline`

---

### Task 2.13: `QuestionsToAskBlock`

**Files:**
- Create: `src/components/report/QuestionsToAskBlock.tsx`
- Create: `src/components/report/QuestionsToAskBlock.test.tsx`

**Props:**

```typescript
interface QuestionsToAskBlockProps {
  missingSignals: MissingSignal[]
  variantKey: string                          // used to fetch curated questions per variant (future)
}
```

**Implementation:** Map each `MissingSignal` to a question card with:
- Question text (imperative: "Ask the seller: ...")
- Reason (what's missing)
- Impact badge (why it matters)
- "Copy all" button at the bottom → clipboard-formatted text

Use i18n keys already defined in v1 (`report.questions.*`).

```tsx
"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import type { MissingSignal } from "@/lib/fairValue/types"
import { Copy, Check } from "lucide-react"

interface QuestionsToAskBlockProps {
  missingSignals: MissingSignal[]
  variantKey: string
}

const IMPACT_COPY: Record<string, string> = {
  service_records: "Documented service history typically adds 4–6% to specific-car value",
  paint_to_sample: "PTS adds 8–12% depending on color rarity",
  accident_history: "Undisclosed accident history can reduce value by 10–15%",
  original_paint: "Original paint adds 3–5% vs respray",
  previous_owners: "Single-owner cars trade at 2–4% premium",
  documentation: "Complete documentation adds 1–3%",
  warranty: "Remaining factory warranty adds 2–4%",
  mileage: "Low mileage vs comparables adjusts value via modifier",
  transmission: "Manual vs PDK premium varies by variant",
  seller_tier: "Specialist seller typically commands 2–4% premium",
}

export function QuestionsToAskBlock({ missingSignals }: QuestionsToAskBlockProps) {
  const t = useTranslations("report.questions")
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const text = missingSignals
      .map((s, i) => `${i + 1}. ${t(s.key + "_question")}`)
      .join("\n")
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <section className="px-4 py-6" aria-labelledby="questions-heading">
      <h2 id="questions-heading" className="font-serif text-[20px] font-semibold md:text-[24px]">
        Questions Before You Commit
      </h2>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Based on what's missing from the listing — converted to actionable asks
      </p>

      <div className="mt-4 space-y-3">
        {missingSignals.map((s) => (
          <div key={s.key} className="rounded-xl border border-border bg-card/30 p-4">
            <p className="text-[14px] font-medium">Ask the seller: {t(s.key + "_question")}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Not mentioned in listing
            </p>
            {IMPACT_COPY[s.key] && (
              <p className="mt-2 inline-flex items-center rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                {IMPACT_COPY[s.key]}
              </p>
            )}
          </div>
        ))}
      </div>

      {missingSignals.length > 0 && (
        <button
          type="button"
          onClick={handleCopy}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-[12px] font-semibold hover:bg-accent"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy all questions"}
        </button>
      )}
    </section>
  )
}
```

**Test:** renders N cards, copy button triggers clipboard write and updates state.

**Commit:** `feat(report): add QuestionsToAskBlock (derived from missing signals + Copy all)`

---

### Task 2.14: `MethodologyLink`, `ReportSourcesBlock`, `ReportMetadataFooter`

Three closing components, small. Create together.

**Files:**
- Create: `src/components/report/MethodologyLink.tsx` — small link component with hover preview
- Modify: `src/components/report/SourcesBlock.tsx` → rename to `ReportSourcesBlock.tsx`, extend to support categorized source sections
- Create: `src/components/report/ReportMetadataFooter.tsx` — single-line footer with hash + verify link

Implementations follow the patterns already shown. Each gets a co-located test verifying happy path.

**Commits:**
- `feat(report): add MethodologyLink`
- `refactor(report): rename SourcesBlock → ReportSourcesBlock with categorized sections`
- `feat(report): add ReportMetadataFooter with hash + verify link`

---

### Task 2.15: Rewrite `ReportClient.tsx` composing new blocks

**Files:**
- Rewrite: `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`

This is the big integration task. The current file is 2808 lines; the rewrite should be ~400–500 lines that imports and composes the 14 block components.

- [ ] **Step 1: Copy current `ReportClient.tsx` to `ReportClient.v1.bak.tsx`** (archive for reference during integration; delete after Phase 6).

```bash
cp src/app/\[locale\]/cars/\[make\]/\[id\]/report/ReportClient.tsx \
   src/app/\[locale\]/cars/\[make\]/\[id\]/report/ReportClient.v1.bak.tsx
```

- [ ] **Step 2: Write the new `ReportClient.tsx`**

Full skeleton:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { CollectorCar } from "@/lib/curatedCars"
import type { SimilarCarResult } from "@/lib/similarCars"
import type { HausReport, HausReportV2, RemarkableClaim } from "@/lib/fairValue/types"
import type { ModelMarketStats } from "@/lib/reports/types"
import type { DbComparableRow } from "@/lib/db/queries"

import { ReportHeader } from "@/components/report/ReportHeader"
import { VerdictBlock } from "@/components/report/VerdictBlock"
import { SpecificCarFairValueBlock } from "@/components/report/SpecificCarFairValueBlock"
import { MarketIntelPanel } from "@/components/report/MarketIntelPanel"
import { WhatsRemarkableBlock } from "@/components/report/WhatsRemarkableBlock"
import { ValuationBreakdownBlock } from "@/components/report/ValuationBreakdownBlock"
import { ArbitrageSignalBlock } from "@/components/report/ArbitrageSignalBlock"
import { ComparablesAndPositioningBlock } from "@/components/report/ComparablesAndPositioningBlock"
import { MarketContextBlock } from "@/components/report/MarketContextBlock"
import { SignalsDetectedBlock } from "@/components/report/SignalsDetectedBlock"
import { QuestionsToAskBlock } from "@/components/report/QuestionsToAskBlock"
import { MethodologyLink } from "@/components/report/MethodologyLink"
import { ReportSourcesBlock } from "@/components/report/ReportSourcesBlock"
import { ReportMetadataFooter } from "@/components/report/ReportMetadataFooter"

interface ReportClientProps {
  car: CollectorCar
  similarCars: SimilarCarResult[]
  existingReport: HausReportV2 | null
  marketStats: ModelMarketStats | null
  dbComparables?: DbComparableRow[]
}

export function ReportClient({
  car,
  existingReport,
  marketStats,
  dbComparables = [],
}: ReportClientProps) {
  const router = useRouter()
  const [downloadSheetOpen, setDownloadSheetOpen] = useState(false)
  const [sampleModalOpen, setSampleModalOpen] = useState(false)

  if (!existingReport) {
    // Generation state UI — handled separately in Phase 3. For now, redirect back.
    return null
  }

  const verdict = deriveVerdict(existingReport)
  const verdictOneLiner = composeOneLiner(existingReport)

  return (
    <main className="flex min-h-screen flex-col bg-background pb-20 md:pb-0">
      <ReportHeader
        carTitle={`${car.year} ${car.make} ${car.model}${car.trim ? " " + car.trim : ""}`}
        carThumbUrl={car.images?.[0] ?? null}
        generatedAt={existingReport.generated_at}
        reportVersion={existingReport.report_version}
        tier={existingReport.tier}
        onDownloadClick={() => setDownloadSheetOpen(true)}
        onRegenerateClick={
          existingReport.tier !== "tier_1"
            ? () => handleRegenerate(car.id, router)
            : undefined
        }
      />

      <MarketIntelPanel d1={existingReport.market_intel.d1} d4={existingReport.market_intel.d4} />

      <div className="mx-auto w-full max-w-3xl">
        <VerdictBlock
          verdict={verdict}
          oneLiner={verdictOneLiner}
          askingUsd={car.askingPrice ?? 0}
          fairValueMidUsd={existingReport.specific_car_fair_value_mid}
          deltaPercent={computeDelta(car.askingPrice, existingReport.specific_car_fair_value_mid)}
        />

        <SpecificCarFairValueBlock
          fairValueLowUsd={existingReport.specific_car_fair_value_low}
          fairValueMidUsd={existingReport.specific_car_fair_value_mid}
          fairValueHighUsd={existingReport.specific_car_fair_value_high}
          askingUsd={car.askingPrice ?? 0}
          comparablesCount={existingReport.comparables_count}
          comparableLayer={existingReport.comparable_layer_used}
        />

        <WhatsRemarkableBlock
          claims={existingReport.remarkable_claims}
          tier={existingReport.tier}
          onUpgradeClick={() => router.push("/pricing")}
          onSeeSampleClick={() => setSampleModalOpen(true)}
        />

        <ValuationBreakdownBlock
          baselineMedianUsd={existingReport.median_price}
          aggregateModifierPercent={existingReport.modifiers_total_percent}
          specificCarFairValueMidUsd={existingReport.specific_car_fair_value_mid}
          modifiers={existingReport.modifiers_applied}
        />

        <ArbitrageSignalBlock
          d2={existingReport.market_intel.d2}
          thisListingPriceUsd={car.askingPrice ?? 0}
        />

        <ComparablesAndPositioningBlock
          d3={existingReport.market_intel.d3}
          thisVinPriceUsd={car.askingPrice ?? 0}
          comparables={dbComparables}
        />

        <MarketContextBlock regions={marketStats?.regions ?? []} />

        <SignalsDetectedBlock signals={existingReport.signals_detected} />

        <QuestionsToAskBlock
          missingSignals={existingReport.signals_missing}
          variantKey={deriveVariantKey(car)}
        />

        <MethodologyLink />

        <ReportSourcesBlock report={existingReport} />

        <ReportMetadataFooter
          generatedAt={existingReport.generated_at}
          reportHash={existingReport.report_hash}
          modifierVersion="v1.0"
          extractionVersion={existingReport.extraction_version}
        />
      </div>

      {downloadSheetOpen && (
        <DownloadSheet
          onClose={() => setDownloadSheetOpen(false)}
          report={existingReport}
        />
      )}
      {sampleModalOpen && <SampleTier2Modal onClose={() => setSampleModalOpen(false)} />}
    </main>
  )
}

function SampleTier2Modal({ onClose }: { onClose: () => void }) {
  // Static illustrative sample of Tier 2 output for ANOTHER car (not the user's current VIN).
  // Lives in messages/*.json under `report.sample_tier_2.*` so it's localized + versioned.
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-card p-6 md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-[20px] font-semibold">
          Sample: What Tier 2 looks like
        </h3>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Example from a different 992 GT3 Touring report.
        </p>
        <div className="mt-4 space-y-3">
          <article className="rounded-xl border border-border bg-card/40 p-4">
            <p className="text-[14px]">
              PTS Y5C represents ~12% of 992 GT3 order book in 2023 — a factory-rare
              combination this VIN shares.
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Source: rennlist.com · Captured Apr 2026
            </p>
          </article>
          <article className="rounded-xl border border-border bg-card/40 p-4">
            <p className="text-[14px]">
              Manual + PTS combo appears in under 20% of variant production per Porsche
              press releases.
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Source: press.porsche.com · Captured Mar 2026
            </p>
          </article>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 block w-full rounded-lg bg-primary py-2 text-center text-[13px] font-semibold text-primary-foreground"
        >
          Got it
        </button>
      </div>
    </div>
  )
}

// Helpers

function deriveVerdict(report: HausReportV2): "BUY" | "WATCH" | "WALK" {
  const delta = computeDelta(report.median_price, report.specific_car_fair_value_mid)
  if (delta <= -5) return "BUY"
  if (delta >= 10) return "WALK"
  return "WATCH"
}

function composeOneLiner(report: HausReportV2): string {
  const delta = computeDelta(report.median_price, report.specific_car_fair_value_mid)
  const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`
  return `Priced ${deltaStr} vs specific-car Fair Value · ${report.comparables_count} comparables · ${report.market_intel.d4.confidence_tier} confidence`
}

function computeDelta(askingUsd: number | undefined, fairMidUsd: number): number {
  if (!askingUsd || fairMidUsd === 0) return 0
  return ((askingUsd - fairMidUsd) / fairMidUsd) * 100
}

function deriveVariantKey(car: CollectorCar): string {
  // Deterministic slug — same rule used by reference pack and KB keying.
  // Example: "Porsche 992 GT3 Touring" → "porsche_992_gt3_touring"
  return `${car.make}_${car.model}`.toLowerCase().replace(/\s+/g, "_")
}

async function handleRegenerate(listingId: string, router: ReturnType<typeof useRouter>) {
  await fetch("/api/analyze", {
    method: "POST",
    body: JSON.stringify({ listingId, regenerate: true }),
    headers: { "Content-Type": "application/json" },
  })
  router.refresh()
}

function DownloadSheet({
  onClose,
  report,
}: {
  onClose: () => void
  report: HausReportV2
}) {
  // Minimal stub; Phase 4/5 replaces with PDF + Excel server-side download buttons.
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-card p-6 md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-semibold">Download Report</h3>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Hash: {report.report_hash.slice(0, 12)}…
        </p>
        <div className="mt-4 space-y-2">
          <a
            href={`/api/reports/${report.report_id}/pdf`}
            className="block w-full rounded-lg bg-primary px-4 py-3 text-center font-semibold text-primary-foreground"
          >
            Download PDF
          </a>
          <a
            href={`/api/reports/${report.report_id}/excel`}
            className="block w-full rounded-lg border border-border px-4 py-3 text-center font-semibold"
          >
            Download Excel
          </a>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 block w-full text-center text-[12px] text-muted-foreground"
        >
          Close
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Compile + test**

Run: `npx tsc --noEmit && npm run test`
Fix any type mismatches until green. Specifically verify:
- `HausReportV2` is properly imported/assembled from `/api/analyze`
- All 14 block components accept the props shown
- Mobile-first CSS (no `md:`-only styles for mobile paths)

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Visit a listing report page. Verify:
- Header sticky at top
- Market Intel Panel sticky below on mobile
- All 14 blocks render in order
- Verdict + Fair Value readable on mobile width (iPhone SE = 375px)
- No horizontal scroll anywhere

- [ ] **Step 5: Delete backup and commit**

```bash
rm src/app/\[locale\]/cars/\[make\]/\[id\]/report/ReportClient.v1.bak.tsx
git add src/app/\[locale\]/cars/\[make\]/\[id\]/report/ReportClient.tsx
git commit -m "refactor(report): rewrite ReportClient composing 14 block components (mobile-first)"
```

---

### Phase 2 checkpoint

```bash
npm run test && npm run lint
git commit --allow-empty -m "checkpoint: Phase 2 online report IA complete (14 blocks, mobile-first)"
```

---

# PHASE 3 — Orchestrator Refactor

**Goal:** `/api/analyze` becomes tier-aware, computes hash, persists to new report shape, supports regeneration.

### Task 3.1: Build `marketIntel/aggregator` integration helper

**Files:**
- Create: `src/lib/marketIntel/index.ts` — one-call `buildMarketIntel(ctx)` that runs D1/D2/D3/D4 and returns `MarketIntel`

```typescript
import type { MarketIntel } from "@/lib/fairValue/types"
import type { DbComparableRow } from "@/lib/db/queries"
import { calculateLandedCost } from "@/lib/landedCost"
import { computeD1Trajectory, computeD2Arbitrage, computeD3PeerPositioning, computeD4Confidence } from "./aggregator"

export interface MarketIntelContext {
  thisVinPriceUsd: number
  targetRegion: "US" | "EU" | "UK" | "JP"
  comparables: DbComparableRow[]
  comparablesByRegion: Record<"US" | "EU" | "UK" | "JP", Array<{ id: string; priceUsd: number; url: string | null }>>
  adjacentVariants: MarketIntel["d3"]["adjacent_variants"]
  captureDateStart: string
  captureDateEnd: string
  outlierFlags: MarketIntel["d4"]["outlier_flags"]
}

export async function buildMarketIntel(ctx: MarketIntelContext): Promise<MarketIntel> {
  const d1 = computeD1Trajectory(ctx.comparables)
  const d2 = await computeD2Arbitrage({
    targetRegion: ctx.targetRegion,
    comparablesByRegion: ctx.comparablesByRegion,
    landedCostResolver: (origin, destination, priceUsd) =>
      calculateLandedCost({ car: { priceUsd, year: new Date().getUTCFullYear() }, origin, destination }),
  })
  const d3 = computeD3PeerPositioning({
    thisVinPriceUsd: ctx.thisVinPriceUsd,
    variantSoldPricesUsd: ctx.comparables.filter((c) => c.status === "sold").map((c) => c.hammerPrice),
    adjacentVariants: ctx.adjacentVariants,
  })
  const d4 = computeD4Confidence({
    sample_size: ctx.comparables.length,
    capture_date_start: ctx.captureDateStart,
    capture_date_end: ctx.captureDateEnd,
    outlier_flags: ctx.outlierFlags,
  })
  return { d1, d2, d3, d4 }
}
```

Co-located test `index.test.ts` verifies shape returned.

**Commit:** `feat(marketIntel): add buildMarketIntel orchestrator`

---

### Task 3.2: Rewrite `/api/analyze` as tier-aware

**Files:**
- Modify: `src/app/api/analyze/route.ts` (full rewrite)

Key responsibilities:
1. Auth + plan check → determine `tier`
2. Check cache by (VIN, tier). Hit → return cached.
3. Miss → run pipeline:
   - Signal extraction (keep existing code)
   - Fetch comparables + adjacent variants
   - `buildMarketIntel(...)`
   - Fetch reference pack + KB entries (when `tier >= tier_2`)
   - Check specialist agent availability (when `tier === tier_3`)
   - `generateRemarkable({...})`
   - Apply modifier engine (existing)
   - Assemble `HausReportV2`
   - `computeReportHash(report, { ignoreKeys: ["generated_at", "report_hash"] })`
   - Persist to `listing_reports` with `report_hash`, `tier`, `version` incremented
   - Return report

Due to length, the full new `route.ts` is ~300 lines. Write it following the pattern of v1's existing `route.ts` but substituting the orchestration logic as described.

**Tests:** Integration test `src/app/api/analyze/route.test.ts` that mocks Supabase + Gemini, runs through tier_1 / tier_2 / tier_3 paths, verifies hash determinism across regenerations with same inputs.

**Commits:**
- `feat(api/analyze): add tier-aware orchestrator with hash + persistence`
- `test(api/analyze): integration tests for all 3 tiers`

---

### Phase 3 checkpoint

```bash
npm run test && npm run lint
npm run dev
# Smoke test: generate report as Tier 1 user, then Tier 2 (mock plan), verify different content + different hash
git commit --allow-empty -m "checkpoint: Phase 3 orchestrator complete (tier-aware, hashed, cached)"
```

---

# PHASE 4 — PDF Export

**Goal:** Server-side PDF generation via `@react-pdf/renderer`. No whitespace gaps. 4–6 pages. Hash-verifiable. Stored in Supabase Storage.

**Files:**
- Create: `src/lib/exports/pdf/templates/Cover.tsx`
- Create: `src/lib/exports/pdf/templates/RemarkableAndArbitragePage.tsx`
- Create: `src/lib/exports/pdf/templates/ValuationPage.tsx`
- Create: `src/lib/exports/pdf/templates/ComparablesPage.tsx`
- Create: `src/lib/exports/pdf/templates/DueDiligencePage.tsx`
- Create: `src/lib/exports/pdf/templates/ClosingPage.tsx`
- Create: `src/lib/exports/pdf/renderReport.tsx`
- Create: `src/app/api/reports/[id]/pdf/route.ts`

### Task 4.1: Shared PDF styles

**Files:**
- Create: `src/lib/exports/pdf/styles.ts`

Define `StyleSheet.create({...})` with brand colors, typography (Playfair Display for display; Inter for body; monospace for numbers), page sizes, header/footer styles, card layouts. Font registration with `Font.register({...})` for any custom fonts (served from `/public/fonts`).

**Commit:** `feat(pdf): shared styles + brand typography`

---

### Task 4.2: Cover page component

**Files:**
- Create: `src/lib/exports/pdf/templates/Cover.tsx`

Following the spec §8.3 #1, renders: car identity + verdict chip + Fair Value range + hash + verify URL + brand wordmark. Full React-PDF component, takes `HausReportV2 + car + assetUrls` props.

Full-page `<Page>`, absolute positioning where needed so no whitespace gaps. Bottom-anchored footer with hash + `Verify at monzahaus.com/verify/{hash}`.

**Test:** `renderToStream(<Cover ...>)` produces non-empty buffer.

**Commit:** `feat(pdf): Cover page template`

---

### Task 4.3: Content page templates (four in sequence)

Create `RemarkableAndArbitragePage.tsx`, `ValuationPage.tsx`, `ComparablesPage.tsx`, `DueDiligencePage.tsx`, `ClosingPage.tsx`. Each uses the shared styles + a consistent header (small car identity + page N/M) and renders the relevant report data.

Apply `wrap={false}` on non-breakable sections (a single card, a small table). Use multi-column layout on `ClosingPage.tsx` for Sources to prevent trailing whitespace.

**One commit per page:**
- `feat(pdf): RemarkableAndArbitrage page template`
- `feat(pdf): Valuation page template`
- `feat(pdf): Comparables page template`
- `feat(pdf): DueDiligence page template`
- `feat(pdf): Closing page with 2-column Sources`

---

### Task 4.4: Document assembly

**Files:**
- Create: `src/lib/exports/pdf/renderReport.tsx`

```tsx
import { Document, renderToStream } from "@react-pdf/renderer"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { CollectorCar } from "@/lib/curatedCars"
import { Cover } from "./templates/Cover"
import { RemarkableAndArbitragePage } from "./templates/RemarkableAndArbitragePage"
import { ValuationPage } from "./templates/ValuationPage"
import { ComparablesPage } from "./templates/ComparablesPage"
import { DueDiligencePage } from "./templates/DueDiligencePage"
import { ClosingPage } from "./templates/ClosingPage"

export async function renderReportToPdfBuffer(
  report: HausReportV2,
  car: CollectorCar
): Promise<Buffer> {
  const doc = (
    <Document
      title={`Haus Report ${car.year} ${car.make} ${car.model}`}
      author="Monza Haus"
      producer="Monza Haus"
      keywords="porsche,valuation,haus-report"
    >
      <Cover report={report} car={car} />
      <RemarkableAndArbitragePage report={report} car={car} />
      <ValuationPage report={report} car={car} />
      <ComparablesPage report={report} car={car} />
      <DueDiligencePage report={report} car={car} />
      <ClosingPage report={report} car={car} />
    </Document>
  )
  const stream = await renderToStream(doc)
  const chunks: Buffer[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
```

**Commit:** `feat(pdf): assemble Document + buffer renderer`

---

### Task 4.5: Download API route

**Files:**
- Create: `src/app/api/reports/[id]/pdf/route.ts`

```typescript
import { NextResponse } from "next/server"
import { getReportById } from "@/lib/reports/queries"
import { getCarById } from "@/lib/curatedCars"
import { exportExists, uploadExport, getSignedExportUrl } from "@/lib/exports/storage"
import { renderReportToPdfBuffer } from "@/lib/exports/pdf/renderReport"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await getReportById(id)
  if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const car = await getCarById(report.listing_id)
  if (!car) return NextResponse.json({ error: "car_not_found" }, { status: 404 })

  if (!(await exportExists(report.report_hash, "pdf"))) {
    const buf = await renderReportToPdfBuffer(report, car)
    await uploadExport(report.report_hash, "pdf", buf)
  }
  const url = await getSignedExportUrl(report.report_hash, "pdf")
  if (!url) return NextResponse.json({ error: "signing_failed" }, { status: 500 })
  return NextResponse.redirect(url)
}
```

Integration test uses a stubbed Supabase client. Smoke test via `npm run dev` + manual download of a report.

**Commit:** `feat(api/pdf): server-side PDF route with Supabase Storage caching`

---

### Phase 4 checkpoint

```bash
npm run test && npm run lint
# Manual smoke: download a PDF from the online report. Verify no whitespace gaps.
git commit --allow-empty -m "checkpoint: Phase 4 PDF export complete"
```

---

# PHASE 5 — Excel Export

**Goal:** Interactive Excel via `ExcelJS`. 4 sheets with live formulas. Branded. Replaces v1's `xlsx` output.

**Files:**
- Create: `src/lib/exports/excel/styles.ts` — shared ExcelJS styles (brand colors, fonts)
- Create: `src/lib/exports/excel/sheets/summary.ts` — Sheet 1
- Create: `src/lib/exports/excel/sheets/assumptions.ts` — Sheet 2
- Create: `src/lib/exports/excel/sheets/liveModel.ts` — Sheet 3
- Create: `src/lib/exports/excel/sheets/dataAndSources.ts` — Sheet 4
- Create: `src/lib/exports/excel/renderReport.ts` — assembler
- Create: `src/app/api/reports/[id]/excel/route.ts` — download API

### Task 5.1: Styles + brand palette

**Files:**
- Create: `src/lib/exports/excel/styles.ts`

Define ExcelJS number format constants, font configs (Inter for body, monospace for numbers), brand fills (pink/burgundy from `brandConfig.ts`), cell convention helpers (`blueInputCell()`, `blackFormulaCell()`, `greyDataCell()`).

**Commit:** `feat(excel): shared styles + cell convention helpers`

---

### Task 5.2: Sheet 1 — Summary (static output)

**Files:**
- Create: `src/lib/exports/excel/sheets/summary.ts`

Function `buildSummarySheet(wb, report, car)` — adds a worksheet with car identity, Verdict, Fair Value range, asking, delta, arbitrage summary, hash, verify URL. Pure static values (no formulas). Full brand styling.

**Commit:** `feat(excel): Sheet 1 Summary`

---

### Task 5.3: Sheet 2 — Assumptions (editable inputs)

**Files:**
- Create: `src/lib/exports/excel/sheets/assumptions.ts`

Header note cells explaining blue=input, black=formula. 15–20 input cells grouped by section (Market baseline, Modifiers, Landed cost, Ownership extras). Each input cell:
- Styled with `blueInputCell()`
- Has a `comment` (ExcelJS supports cell comments) with current Monza Haus value + source
- Named range for reference from Sheet 3 formulas (e.g., `SHIPPING_USD`, `DUTY_PCT`, `PTS_MODIFIER_PCT`)

**Commit:** `feat(excel): Sheet 2 Assumptions with named ranges + input comments`

---

### Task 5.4: Sheet 3 — Live Model (formulas)

**Files:**
- Create: `src/lib/exports/excel/sheets/liveModel.ts`

Formulas reference named ranges from Sheet 2. Computes:
- Adjusted Fair Value (baseline × aggregate modifier with caps — Excel IF-based caps)
- Landed Cost breakdown (6 components via formulas)
- Total investment
- Arbitrage vs alternative markets (user can toggle flag on Sheet 2)
- Verdict recomputation

All cells styled `blackFormulaCell()`.

**Commit:** `feat(excel): Sheet 3 Live Model with formulas reading Assumptions`

---

### Task 5.5: Sheet 4 — Data & Sources

**Files:**
- Create: `src/lib/exports/excel/sheets/dataAndSources.ts`

Comparables table with `autoFilter` enabled so users can filter natively in Excel. Signals detected list. Modifiers library with citations. Sources table with URLs + capture dates. Methodology condensed notes.

**Commit:** `feat(excel): Sheet 4 Data & Sources with autoFilter`

---

### Task 5.6: Workbook assembly + download route

**Files:**
- Create: `src/lib/exports/excel/renderReport.ts`
- Create: `src/app/api/reports/[id]/excel/route.ts`

Mirror the PDF pattern: `renderReportToExcelBuffer()` + API route that checks cache, generates if missing, uploads, returns signed URL redirect.

**Commits:**
- `feat(excel): assemble Workbook + buffer renderer`
- `feat(api/excel): server-side Excel route with Supabase Storage caching`

---

### Task 5.7: Remove legacy `xlsx` client-side export

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx` — `handleDownloadExcel` function
- Modify: `package.json` — remove `xlsx` from dependencies

Replace client-side `handleDownloadExcel` with a simple link to `/api/reports/{id}/excel`.

**Commit:** `refactor(report): replace client-side xlsx export with server-side Excel route`

---

### Phase 5 checkpoint

```bash
npm run test && npm run lint
# Manual smoke: download Excel, open in Excel/Numbers, verify formulas recompute when inputs change.
git commit --allow-empty -m "checkpoint: Phase 5 Excel export complete"
```

---

# PHASE 6 — Verify Route + Polish

### Task 6.1: `/verify/[hash]` public route

**Files:**
- Create: `src/app/verify/[hash]/page.tsx`

Server component that:
- Looks up `listing_reports` by `report_hash`
- If not found → 404
- If found → renders the full online report (same layout as `/cars/.../report`) but with a "verified authentic" banner at top
- No token debit / no auth required — public route

**Commit:** `feat(verify): add public /verify/[hash] route`

---

### Task 6.2: Legal copy + disclaimers

**Files:**
- Modify: `messages/en.json` and `messages/es.json` (and any other locales)
- Verify each block renders appropriate disclaimer text from Legal Checklist

Disclaimers required (per spec §11):
- Disclaimer #2 (no financial advice) — in `ReportMetadataFooter` + `/methodology`
- Disclaimer #3 (data accuracy) — in `/methodology`

**Commit:** `feat(report): wire disclaimer copy per Legal Checklist`

---

### Task 6.3: Accessibility pass

**Files:**
- Audit each block component

Verify:
- All interactive elements have visible focus states (Tailwind `focus-visible:ring-2`)
- All images have alt text
- Heading hierarchy (`h1` → `h2` → `h3`) is correct
- Color contrast ratios meet WCAG AA
- Keyboard navigation works end-to-end

**Commit:** `fix(report): accessibility pass (focus states, aria labels, contrast)`

---

### Task 6.4: Lighthouse mobile audit

```bash
npm run build && npm run start
# In another terminal
npx lighthouse http://localhost:3000/en/cars/porsche/[sample-id]/report --preset=mobile --output=html --output-path=./lighthouse-report.html
```

Target: score ≥ 90.

Fix regressions (image optimization, bundle size, LCP). Each fix a separate commit.

---

### Task 6.5: Final integration test

**Files:**
- Create: `tests/integration/haus-report-v2.test.ts` (Vitest) and/or `tests/e2e/haus-report-v2.spec.ts` (Playwright)

End-to-end test: generate a report → assert UI renders → download PDF → assert buffer non-empty → download Excel → assert buffer non-empty → fetch `/verify/{hash}` → assert page renders same car identity.

**Commit:** `test(e2e): full v2 flow smoke test`

---

### Phase 6 checkpoint (final)

```bash
npm run test && npm run lint && npm run build
git commit --allow-empty -m "checkpoint: Phase 6 complete — Haus Report v2 ready for BE sync"
git push origin reporte
```

---

## Self-review checklist (before sign-off)

1. **Spec coverage:** Every section in `docs/superpowers/specs/2026-04-21-haus-report-v2-design.md` has at least one task. ✓
2. **No placeholders:** No "TBD", no "implement later", no "similar to Task N." ✓
3. **Type consistency:** All types defined in Phase 1 are used consistently in Phases 2–6. ✓
4. **Mobile-first:** Every new component has mobile styles as default with `md:` modifiers for desktop. ✓
5. **Every commit passes `npm run test`:** Each task ends with a test verification step. ✓
6. **Restraint visual enforced:** Top-N visible per block, `CollapsibleList` for overflow. ✓

---

## BE Handoff (parallel track)

While front-end work proceeds, BE team applies the following in a separate branch + PR:

### BE-1. Supabase migrations

Per spec §13.1:

1. `variant_knowledge` table (new)
2. `listing_reports` extension: `report_hash`, `tier`, `version` columns + index on `report_hash`
3. Storage bucket `exports` (private; signed URLs only)

### BE-2. Environment variables

Per spec §13.2:

- `SUPABASE_STORAGE_EXPORTS_BUCKET=exports` (new)
- Verify existing `GEMINI_API_KEY` and `GEMINI_MODEL` remain set

### BE-3. Optional (post-front-end)

- Reference pack admin UI (or commit to direct SQL inserts managed by editorial team)
- Specialist agent framework per variant (tracked separately; each agent its own scope)

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-21-haus-report-v2.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Best for keeping context windows clean across the ~40 tasks in this plan.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`. Batched with checkpoints for review.

Which approach do you prefer?
