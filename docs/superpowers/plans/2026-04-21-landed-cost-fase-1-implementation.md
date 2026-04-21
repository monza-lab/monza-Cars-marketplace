# Landed Cost — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v2 of the landed-cost data with per-family (handling-tier) shipping multipliers, tightened ranges, refreshed sources, a versioned snapshot, and the monthly-refresh playbook that lets us repeat this every month.

**Architecture:** Keep existing TS-source tables (Supabase migration deferred to Fase 2). Add one new module (`familyMultipliers.ts`) that maps each `brandConfig` seriesId to a handling tier (`standard`/`premium`/`exotic`/`heritage`) and each tier to a shipping multiplier. The calculator accepts an optional `seriesId` on the car input and applies the multiplier to the shipping range before CIF. Data refresh is a research workflow (desk research only — no paid carrier quotes in Fase 1) that produces new values for `shipping.ts` and `fees.ts`, plus a frozen JSON snapshot and a changelog.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Vitest · Tailwind · Supabase (for other modules; not used here).

**Spec:** `docs/superpowers/specs/2026-04-21-landed-cost-research-program-design.md` — read it first. This plan implements **Fase 1 only**.

**Branch:** `feat/landed-cost` (already active; do not create a new branch).

**Conventions (from `CLAUDE.md`):**
- `npm run dev` uses `--webpack` flag
- Commit style: `feat(scope): description` / `fix(scope): description` / `docs(scope): description`
- After any git/npm issue: `rm -rf .next` before restarting dev server
- Always push after committing

---

## Prerequisites — read before starting

1. **Read the spec** (linked above). Especially §2 (Tier-1/Tier-2), §3.3 (scope), §5.2 (data architecture), §6 (monthly playbook).
2. **Locked decisions (Edgar, 2026-04-21):**
   - No VA outreach in Fase 1 — desk research only; shipping spread target ≤25%.
   - Out-of-scope listings (Cayenne, Macan, 718, Panamera, Taycan, 914, Boxster, Cayman): show landed cost with route-base range *without* family multiplier + visible footnote.
   - Supabase migration for landed-cost tables: deferred to Fase 2. Fase 1 keeps tables in TS source.
   - Tightness targets per spec §3.4 (trust-the-number level).
3. **Existing files to understand:**
   - `src/lib/landedCost/calculator.ts` — main `calculateLandedCost` function
   - `src/lib/landedCost/shipping.ts` — route matrix
   - `src/lib/landedCost/duties.ts`, `taxes.ts`, `fees.ts` — per-destination rules
   - `src/lib/landedCost/types.ts` — public types; you will extend this
   - `src/lib/brandConfig.ts` — Porsche seriesIds (search `seriesIds:`)
4. **Callers of `calculateLandedCost`** (found via grep; update them in Task 14–15):
   - `src/app/[locale]/cars/[make]/[id]/page.tsx` (detail page)
   - `src/app/api/analyze/route.ts` (API route)

---

## File structure

**New files:**

```
src/lib/landedCost/
├── familyMultipliers.ts                          # NEW — handling tier map + multipliers
├── __tests__/
│   └── familyMultipliers.test.ts                 # NEW — unit tests
└── data/
    └── versions/
        └── 2026-05.json                          # NEW — frozen snapshot

docs/landed-cost/
├── sources-2026-05.md                            # NEW — full source citations, one per number
├── CHANGELOG-v1-to-v2.md                         # NEW — diff narrative v1 → v2
├── monthly-playbook.md                           # NEW — SOP for repeat monthly cycles
└── research-2026-05/
    ├── duty-verification.md                      # NEW — gov rate verification results
    ├── tax-verification.md                       # NEW — tax/VAT verification results
    ├── shipping-research.md                      # NEW — per-route shipping findings
    ├── port-broker-research.md                   # NEW — port/broker findings
    └── registration-research.md                  # NEW — registration findings
```

**Modified files:**

```
src/lib/landedCost/
├── types.ts              # add SeriesId, HandlingTier types; extend CarInput
├── calculator.ts         # integrate family multiplier into shipping calc
├── shipping.ts           # updated rates + sources (research outputs)
├── fees.ts               # updated port/broker + registration (research outputs)
├── duties.ts             # bump lastReviewed dates
├── taxes.ts              # bump lastReviewed dates
├── index.ts              # export new types + constants
└── __tests__/
    ├── calculator.test.ts   # add multiplier cases
    └── shipping.test.ts     # add spread-tightness assertion

src/app/[locale]/cars/[make]/[id]/page.tsx    # pass seriesId when calling calculator
src/app/api/analyze/route.ts                  # pass seriesId when calling calculator
```

---

## Task sequence overview

**Phase A — Research (Tasks 1–6).** Produces markdown docs with verified sources. No code changes yet. These docs feed Phase B data-updates.

**Phase B — Code scaffolding (Tasks 7–12).** TDD: type → impl → test → commit. No data values touched yet.

**Phase C — Data refresh (Tasks 13–15).** Apply research results to `shipping.ts` and `fees.ts`. Bump `lastReviewed` everywhere.

**Phase D — Callers (Tasks 16–17).** Pass `seriesId` from existing call sites.

**Phase E — Packaging (Tasks 18–22).** Snapshot, changelog, playbook, smoke, PR.

Total: 22 tasks.

---

## Phase A — Research

These tasks produce markdown files committed to the branch. No code. Each research task's deliverable is a committed doc with verified source URLs and dates.

### Task 1: Verify duty rates (gov sources)

**Files:**
- Create: `docs/landed-cost/research-2026-05/duty-verification.md`

- [ ] **Step 1: Fetch each gov source and record findings**

For each destination, open the URL and record: the current rate for HS 8703 (motor cars), whether the rate matches what's in `src/lib/landedCost/duties.ts` today, and the retrieval date.

| Destination | URL to verify | Today's value in `duties.ts` |
|---|:---|:---|
| US | https://hts.usitc.gov/search?query=8703 | 2.5% standard, 0% ≥25 yrs |
| DE (EU) | https://taxation-customs.ec.europa.eu/customs-4/calculation-customs-duties_en | 10% |
| UK | https://www.gov.uk/trade-tariff/commodities/8703231990 | 10% standard, 5% ≥30 yrs (historic) |
| JP | https://www.customs.go.jp/english/tariff/2024/index.htm | 0% |

- [ ] **Step 2: Write the findings doc**

Write `docs/landed-cost/research-2026-05/duty-verification.md` with this exact structure:

```markdown
# Duty Rate Verification — 2026-05

**Verified:** [YYYY-MM-DD]
**Verifier:** [name or "Claude"]

## Results

| Destination | Source URL | Verified value | Matches v1? | Notes |
|---|:---|:---|:---:|:---|
| US | https://hts.usitc.gov/... | 2.5% / 0% ≥25yr | ✅/❌ | ... |
| DE | https://taxation-customs... | 10% | ✅/❌ | ... |
| UK | https://www.gov.uk/... | 10% / 5% ≥30yr | ✅/❌ | ... |
| JP | https://www.customs.go.jp/... | 0% | ✅/❌ | ... |

## Changes required in `duties.ts`

[For each row where "Matches v1?" = ❌, describe exactly what to change.]

## No-change note

If all rows match, write: "All duty rates verified 2026-05-[DD]; no changes required. Only `lastReviewed` date bump needed in Task 15."
```

- [ ] **Step 3: Commit**

```bash
git add docs/landed-cost/research-2026-05/duty-verification.md
git commit -m "docs(landed-cost): verify duty rates for 2026-05 monthly cycle"
```

### Task 2: Verify tax/VAT rates (gov + Avalara)

**Files:**
- Create: `docs/landed-cost/research-2026-05/tax-verification.md`

- [ ] **Step 1: Fetch each source and record findings**

| Destination | Source URL | Today's value in `taxes.ts` |
|---|:---|:---|
| US | https://www.avalara.com/us/en/learn/sales-tax/ (state averages) | 6% average |
| DE | Bundesministerium der Finanzen — Umsatzsteuer page | 19% standard, 7% H-Kennzeichen ≥30yr |
| UK | https://www.gov.uk/vat-rates | 20% standard, 5% historic ≥30yr |
| JP | https://www.nta.go.jp/english/ | 10% consumption tax |

- [ ] **Step 2: Write the findings doc**

Same structure as Task 1; create `docs/landed-cost/research-2026-05/tax-verification.md` with the same 5 sections (metadata, results table, changes required, no-change note if applicable). Add an extra note for US: if the Avalara state-average value is no longer 6%, record the new average AND flag that the spec has an open action to add state-level granularity in Fase 2 (out of scope now).

- [ ] **Step 3: Commit**

```bash
git add docs/landed-cost/research-2026-05/tax-verification.md
git commit -m "docs(landed-cost): verify tax/VAT rates for 2026-05 monthly cycle"
```

### Task 3: Research tighter shipping ranges (12 routes)

**Files:**
- Create: `docs/landed-cost/research-2026-05/shipping-research.md`

**Context:** Current `shipping.ts` spreads average ~47%. Fase 1 target: ≤25% per route. Desk research only — no carrier form outreach (per Edgar's locked decision). Use published rate cards, Hagerty/BaT shipping articles, and aggregator sources.

- [ ] **Step 1: Per route, gather ≥2 data points from published sources**

For each of the 12 routes, search these sources and capture the minimum and maximum published rates in the last 6 months:

**Sources to check (in this order):**

1. West Coast Shipping — https://www.westcoastshipping.com/ (rate calculators + blog)
2. Schumacher Cargo Logistics — https://www.schumachercargo.com/ (shipping-calculators + route pages)
3. Kayser Enterprises — kayserauto.com (if accessible) or cached rate references
4. CFR Classic — https://www.cfrclassic.com/
5. Montway — https://www.montway.com/
6. Hagerty shipping guides — https://www.hagerty.com/media (search "ship a classic car")
7. BaT shipping articles — https://bringatrailer.com/ (search "shipping")
8. Freightos/Freightcenter container ballparks (as cross-reference only)

For each route, assume a shared 20ft container, port-to-port, 1,400 kg / $100k declared-value "generic 911" baseline.

- [ ] **Step 2: Write the research doc**

Create `docs/landed-cost/research-2026-05/shipping-research.md`:

```markdown
# Shipping Research — 2026-05

**Verified:** [YYYY-MM-DD]
**Verifier:** [name or "Claude"]
**Baseline assumption:** shared 20ft container, port-to-port, 1,400 kg / $100k declared value

## Per-route findings

### DE → US (USD)

- **Current v1 range:** $2,800 – $5,200 (47% spread)
- **Data points gathered:**
  - Source 1: West Coast Shipping rate page — $3,200 (dated YYYY-MM-DD, URL)
  - Source 2: Schumacher Cargo calculator — $3,800 (dated, URL)
  - Source 3: Hagerty guide — $3,000–$4,200 range (URL)
- **Proposed v2 range:** $2,900 – $3,900 (26% spread) — 3 data points
- **Confidence:** [high / medium / low]
- **Notes:** any caveats, port-specific issues, carriers flagged as unreliable.

### DE → UK (GBP)
... (same template)

### UK → US (USD)
...

[Repeat for all 12 routes: DE→US, UK→US, JP→US, US→DE, UK→DE, JP→DE, US→UK, DE→UK, JP→UK, US→JP, DE→JP, UK→JP]

## Summary

| Route | v1 spread % | v2 spread % | # sources | Confidence |
|---|---:|---:|---:|:---:|
| DE→US | 47% | 26% | 3 | high |
| ... |

**Spread target check:** [N of 12] routes meet ≤25% target. For routes that don't: explain why (sparse data, wide published range, flag for VA in Fase 2).
```

- [ ] **Step 3: Commit**

```bash
git add docs/landed-cost/research-2026-05/shipping-research.md
git commit -m "docs(landed-cost): tighten shipping ranges for 2026-05 (12 routes)"
```

### Task 4: Research port & broker fees per destination

**Files:**
- Create: `docs/landed-cost/research-2026-05/port-broker-research.md`

**Context:** Current `fees.ts` port/broker ranges spread ~45%. Fase 1 target: ≤20% per destination.

- [ ] **Step 1: Per destination, gather published broker schedules**

| Destination | Sources to check |
|---|:---|
| US | CBP entry fees (https://www.cbp.gov/trade/basic-import-export), LA/NY port handling (Port of LA: https://www.portoflosangeles.org/) |
| DE | Hamburg/Bremerhaven port tariffs + Zoll broker fee schedules |
| UK | Southampton/Felixstowe port handling + HMRC broker published rates |
| JP | Yokohama/Kobe port tariffs + Nippon Customs broker published rates |

Aim for ≥2 sources per destination.

- [ ] **Step 2: Write findings**

Create `docs/landed-cost/research-2026-05/port-broker-research.md` with per-destination sections following the shipping-research template: v1 range, data points, v2 proposed range, confidence, notes. End with a summary table.

- [ ] **Step 3: Commit**

```bash
git add docs/landed-cost/research-2026-05/port-broker-research.md
git commit -m "docs(landed-cost): tighten port/broker ranges for 2026-05"
```

### Task 5: Research registration fees per destination

**Files:**
- Create: `docs/landed-cost/research-2026-05/registration-research.md`

**Context:** Current registration spreads ~60%. Target: ≤30%.

- [ ] **Step 1: Per destination, gather DMV/DVLA/KBA/Rikuun averages**

| Destination | Primary sources |
|---|:---|
| US | California DMV + Florida DHSMV + New York DMV + Texas DMV fee schedules (weighted average) |
| DE | KBA (Kraftfahrt-Bundesamt) registration fees + Landeseinwohneramt typical charges |
| UK | DVLA first-registration fee (currently £55) + V55/5 form + vehicle tax first-year |
| JP | Rikuun (陸運局) new-vehicle registration schedule |

- [ ] **Step 2: Write findings**

Create `docs/landed-cost/research-2026-05/registration-research.md` — same template as port-broker-research.

- [ ] **Step 3: Commit**

```bash
git add docs/landed-cost/research-2026-05/registration-research.md
git commit -m "docs(landed-cost): tighten registration ranges for 2026-05"
```

### Task 6: Compile consolidated sources doc

**Files:**
- Create: `docs/landed-cost/sources-2026-05.md`

**Context:** This is the canonical "every number in v2, its source, its retrieval date" reference. One row per number in the codebase. It's what Edgar reviews at PR time.

- [ ] **Step 1: Write the consolidated doc**

Create `docs/landed-cost/sources-2026-05.md`:

```markdown
# Landed Cost Sources — 2026-05

**Compiled:** [YYYY-MM-DD]
**For data version:** v2 (replacing v1 seeded on 2026-04-20)

## Duties

| Destination | Value | Source URL | lastReviewed |
|---|:---|:---|:---|
| US | 2.5% / 0% ≥25yr | https://hts.usitc.gov/... | 2026-05-[DD] |
| DE | 10% | https://taxation-customs.ec.europa.eu/... | 2026-05-[DD] |
| UK | 10% / 5% ≥30yr | https://www.gov.uk/... | 2026-05-[DD] |
| JP | 0% | https://www.customs.go.jp/... | 2026-05-[DD] |

## Taxes

(Same table shape.)

## Shipping (12 routes)

| Route | Min | Max | Currency | # sources | Primary URL(s) | lastReviewed |
|---|---:|---:|:---:|---:|:---|:---|

## Marine insurance

| Destination | Rate range | Source | lastReviewed |
|---|:---|:---|:---|
| (all) | 1.5–2.5% of CIF | Lloyds / classic-auto carrier industry standard | 2026-05-[DD] |

## Port & broker

(Same table shape as shipping.)

## Registration

(Same table shape.)

## Cross-reference

For the narrative of what changed vs v1, see `CHANGELOG-v1-to-v2.md`.
For the per-route data-gathering notes, see `research-2026-05/shipping-research.md`.
```

Fill in using the outputs of Tasks 1-5.

- [ ] **Step 2: Commit**

```bash
git add docs/landed-cost/sources-2026-05.md
git commit -m "docs(landed-cost): consolidated sources for v2 (2026-05)"
```

---

## Phase B — Code scaffolding (TDD)

### Task 7: Add `SeriesId` and `HandlingTier` types

**Files:**
- Modify: `src/lib/landedCost/types.ts`

- [ ] **Step 1: Add the new types**

Edit `src/lib/landedCost/types.ts` and append at the bottom (after the existing types):

```ts
/**
 * Series IDs currently in Tier-1 landed-cost scope.
 * Mirrors the in-scope subset of brandConfig.ts seriesIds.
 * Keep in sync with SERIES_HANDLING_TIER below.
 */
export type SeriesId =
  // 911 family
  | "992" | "991" | "997" | "996" | "993" | "964" | "930"
  | "g-model" | "f-model" | "912"
  // GT & hypercars
  | "918" | "carrera-gt" | "959"
  // Heritage
  | "356"
  // Transaxle classics
  | "944" | "928" | "968" | "924";

export type HandlingTier = "standard" | "premium" | "exotic" | "heritage";
```

Then modify the `CarInput` interface in the same file (around line 24) to add an optional `seriesId`:

```ts
export interface CarInput {
  priceUsd: number;
  year: number;
  /** Optional: drives per-family shipping multiplier. If omitted, no multiplier applied (route-base range returned). */
  seriesId?: SeriesId;
}
```

- [ ] **Step 2: Verify nothing broke**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx tsc --noEmit`

Expected: no type errors (the new fields are additive; optional `seriesId` doesn't break existing callers).

- [ ] **Step 3: Commit**

```bash
git add src/lib/landedCost/types.ts
git commit -m "feat(landed-cost): add SeriesId and HandlingTier types"
```

### Task 8: Write failing tests for `familyMultipliers.ts`

**Files:**
- Create: `src/lib/landedCost/__tests__/familyMultipliers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/landedCost/__tests__/familyMultipliers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  SERIES_HANDLING_TIER,
  HANDLING_TIER_SHIPPING_MULTIPLIER,
  getShippingMultiplier,
} from "../familyMultipliers";
import type { SeriesId, HandlingTier } from "../types";

describe("SERIES_HANDLING_TIER", () => {
  it("maps every in-scope seriesId to a handling tier", () => {
    const expectedSeries: SeriesId[] = [
      "992", "991", "997", "996", "993", "964", "930",
      "g-model", "f-model", "912",
      "918", "carrera-gt", "959",
      "356",
      "944", "928", "968", "924",
    ];
    for (const id of expectedSeries) {
      expect(SERIES_HANDLING_TIER).toHaveProperty(id);
    }
  });

  it("assigns air-cooled 911 generations to premium tier", () => {
    expect(SERIES_HANDLING_TIER["993"]).toBe("premium");
    expect(SERIES_HANDLING_TIER["964"]).toBe("premium");
    expect(SERIES_HANDLING_TIER["930"]).toBe("premium");
  });

  it("assigns hypercars to exotic tier", () => {
    expect(SERIES_HANDLING_TIER["918"]).toBe("exotic");
    expect(SERIES_HANDLING_TIER["carrera-gt"]).toBe("exotic");
    expect(SERIES_HANDLING_TIER["959"]).toBe("exotic");
  });

  it("assigns 356 to heritage tier", () => {
    expect(SERIES_HANDLING_TIER["356"]).toBe("heritage");
  });
});

describe("HANDLING_TIER_SHIPPING_MULTIPLIER", () => {
  it("standard is the 1.00x baseline", () => {
    expect(HANDLING_TIER_SHIPPING_MULTIPLIER.standard).toBe(1.0);
  });

  it("tiers above standard charge a premium", () => {
    const tiers: HandlingTier[] = ["premium", "exotic", "heritage"];
    for (const t of tiers) {
      expect(HANDLING_TIER_SHIPPING_MULTIPLIER[t]).toBeGreaterThan(1.0);
    }
  });

  it("exotic > premium > heritage > standard (value ordering)", () => {
    const m = HANDLING_TIER_SHIPPING_MULTIPLIER;
    expect(m.exotic).toBeGreaterThan(m.premium);
    expect(m.premium).toBeGreaterThan(m.heritage);
    expect(m.heritage).toBeGreaterThan(m.standard);
  });
});

describe("getShippingMultiplier", () => {
  it("returns 1.0 when seriesId is undefined", () => {
    expect(getShippingMultiplier(undefined)).toBe(1.0);
  });

  it("returns 1.0 for an out-of-scope seriesId (e.g., cayenne)", () => {
    // Explicitly cast to SeriesId-like value to simulate callers that pass a non-Tier-1 series.
    expect(getShippingMultiplier("cayenne" as unknown as SeriesId)).toBe(1.0);
  });

  it("returns the correct tier multiplier for in-scope series", () => {
    expect(getShippingMultiplier("992")).toBe(
      HANDLING_TIER_SHIPPING_MULTIPLIER.standard,
    );
    expect(getShippingMultiplier("918")).toBe(
      HANDLING_TIER_SHIPPING_MULTIPLIER.exotic,
    );
    expect(getShippingMultiplier("356")).toBe(
      HANDLING_TIER_SHIPPING_MULTIPLIER.heritage,
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx vitest run src/lib/landedCost/__tests__/familyMultipliers.test.ts`

Expected: FAIL — module `../familyMultipliers` does not exist yet.

### Task 9: Implement `familyMultipliers.ts`

**Files:**
- Create: `src/lib/landedCost/familyMultipliers.ts`

- [ ] **Step 1: Write the module**

Create `src/lib/landedCost/familyMultipliers.ts`:

```ts
import type { HandlingTier, SeriesId } from "./types";

/**
 * Maps each in-scope seriesId to its shipping handling tier.
 *
 * Tier rationale:
 * - standard (1.00x): mainstream collectors. Daily-drivable, common carriers handle them.
 * - premium  (1.15x): high-value performance / air-cooled rare. Enclosed container expected.
 * - exotic   (1.35x): hypercars, white-glove handling mandatory.
 * - heritage (1.10x): vintage delicate (pre-1964-ish). Needs specialized crating.
 */
export const SERIES_HANDLING_TIER: Record<SeriesId, HandlingTier> = {
  // 911 family — water-cooled modern are standard; air-cooled are premium
  "992": "standard",
  "991": "standard",
  "997": "standard",
  "996": "standard",
  "993": "premium",
  "964": "premium",
  "930": "premium",
  "g-model": "premium",
  "f-model": "premium",
  "912": "standard",
  // GT & hypercars
  "918": "exotic",
  "carrera-gt": "exotic",
  "959": "exotic",
  // Heritage
  "356": "heritage",
  // Transaxle classics
  "944": "standard",
  "928": "standard",
  "968": "standard",
  "924": "standard",
};

/**
 * Shipping-cost multiplier applied on top of the route base range.
 */
export const HANDLING_TIER_SHIPPING_MULTIPLIER: Record<HandlingTier, number> = {
  standard: 1.0,
  premium: 1.15,
  exotic: 1.35,
  heritage: 1.1,
};

/**
 * Returns the shipping multiplier for a given seriesId.
 * - Returns 1.0 when seriesId is undefined (caller didn't pass one).
 * - Returns 1.0 when seriesId is outside Tier-1 scope (e.g. cayenne, macan, 718).
 *   This is intentional: per Edgar's 2026-04-21 decision, out-of-scope listings
 *   show the route-base range without a family multiplier. The calling UI is
 *   responsible for rendering the "family-specific handling not available" footnote.
 */
export function getShippingMultiplier(seriesId: SeriesId | undefined): number {
  if (!seriesId) return 1.0;
  const tier = SERIES_HANDLING_TIER[seriesId];
  if (!tier) return 1.0;
  return HANDLING_TIER_SHIPPING_MULTIPLIER[tier];
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx vitest run src/lib/landedCost/__tests__/familyMultipliers.test.ts`

Expected: PASS — all tests green.

- [ ] **Step 3: Commit**

```bash
git add src/lib/landedCost/familyMultipliers.ts src/lib/landedCost/__tests__/familyMultipliers.test.ts
git commit -m "feat(landed-cost): add family handling-tier multipliers (Tier-1 scope)"
```

### Task 10: Export new module from the barrel

**Files:**
- Modify: `src/lib/landedCost/index.ts`

- [ ] **Step 1: Add exports**

Edit `src/lib/landedCost/index.ts` and append these lines at the bottom:

```ts
export {
  SERIES_HANDLING_TIER,
  HANDLING_TIER_SHIPPING_MULTIPLIER,
  getShippingMultiplier,
} from "./familyMultipliers";
export type { SeriesId, HandlingTier } from "./types";
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/landedCost/index.ts
git commit -m "feat(landed-cost): expose family multiplier helpers from barrel"
```

### Task 11: Write failing calculator test for multiplier integration

**Files:**
- Modify: `src/lib/landedCost/__tests__/calculator.test.ts`

- [ ] **Step 1: Add a new test block**

Open `src/lib/landedCost/__tests__/calculator.test.ts` and add these tests **inside the existing `describe("calculateLandedCost", ...)` block**, after the last existing `it(...)`:

```ts
  it("applies 1.0x shipping when seriesId is omitted (backwards compat)", async () => {
    const result = await calculateLandedCost({
      car: { priceUsd: 100000, year: 2010 },
      origin: "DE",
      destination: "US",
    });
    expect(result).not.toBeNull();
    // Shipping should equal the raw route range (no multiplier).
    // Note: this assertion will need to be updated if shipping.ts v2 values land before this test runs.
    expect(result!.shipping.min).toBeGreaterThan(0);
  });

  it("applies premium multiplier (1.15x) for 993 seriesId", async () => {
    const withSeries = await calculateLandedCost({
      car: { priceUsd: 150000, year: 1995, seriesId: "993" },
      origin: "DE",
      destination: "US",
    });
    const withoutSeries = await calculateLandedCost({
      car: { priceUsd: 150000, year: 1995 },
      origin: "DE",
      destination: "US",
    });
    expect(withSeries).not.toBeNull();
    expect(withoutSeries).not.toBeNull();
    // Premium tier = 1.15x.
    expect(withSeries!.shipping.min).toBeCloseTo(withoutSeries!.shipping.min * 1.15, 0);
    expect(withSeries!.shipping.max).toBeCloseTo(withoutSeries!.shipping.max * 1.15, 0);
  });

  it("applies exotic multiplier (1.35x) for 918 seriesId", async () => {
    const withSeries = await calculateLandedCost({
      car: { priceUsd: 1500000, year: 2015, seriesId: "918" },
      origin: "DE",
      destination: "US",
    });
    const withoutSeries = await calculateLandedCost({
      car: { priceUsd: 1500000, year: 2015 },
      origin: "DE",
      destination: "US",
    });
    expect(withSeries).not.toBeNull();
    expect(withoutSeries).not.toBeNull();
    expect(withSeries!.shipping.min).toBeCloseTo(withoutSeries!.shipping.min * 1.35, 0);
  });

  it("applies no multiplier (1.0x) for out-of-scope series like cayenne", async () => {
    const withSeries = await calculateLandedCost({
      // Cast because SeriesId type doesn't include cayenne (out-of-scope on purpose).
      car: { priceUsd: 80000, year: 2020, seriesId: "cayenne" as unknown as undefined },
      origin: "DE",
      destination: "US",
    });
    const withoutSeries = await calculateLandedCost({
      car: { priceUsd: 80000, year: 2020 },
      origin: "DE",
      destination: "US",
    });
    expect(withSeries).not.toBeNull();
    expect(withoutSeries).not.toBeNull();
    expect(withSeries!.shipping.min).toBe(withoutSeries!.shipping.min);
    expect(withSeries!.shipping.max).toBe(withoutSeries!.shipping.max);
  });
```

- [ ] **Step 2: Run tests to confirm the new ones fail**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx vitest run src/lib/landedCost/__tests__/calculator.test.ts`

Expected: the 3 multiplier tests fail (shipping range doesn't change with seriesId yet). The backwards-compat test and the 4th "out-of-scope" test should pass because without multiplier logic, the calc is identical.

### Task 12: Integrate multiplier into `calculator.ts`

**Files:**
- Modify: `src/lib/landedCost/calculator.ts`

- [ ] **Step 1: Apply multiplier to shipping range**

Edit `src/lib/landedCost/calculator.ts`. At the top, add the import:

```ts
import { getShippingMultiplier } from "./familyMultipliers";
```

Then replace the `shipping` property computation inside the `calculateLandedCost` return object (around line 177) so it applies the multiplier. Find this existing line:

```ts
    shipping: { min: shipping.min, max: shipping.max, currency },
```

Also find these lines (around line 144-145) where shipping feeds into CIF:

```ts
  const cifMin = priceLocal + shipping.min + insMin;
  const cifMax = priceLocal + shipping.max + insMax;
```

And this line (around line 166):

```ts
  const importMin = shipping.min + insMin + dutyMin + vatMin + portMin + regMin;
  const importMax = shipping.max + insMax + dutyMax + vatMax + portMax + regMax;
```

**Replace by introducing a multiplied shipping range computed once, used everywhere.** After the line `if (!shipping) return null;` (line 111), add:

```ts
  // Apply family handling-tier multiplier to shipping range.
  // car.seriesId is optional; multiplier is 1.0 when absent or out-of-scope.
  const shipMult = getShippingMultiplier(car.seriesId);
  const shippingMin = round2(shipping.min * shipMult);
  const shippingMax = round2(shipping.max * shipMult);
```

Then in the CIF lines, replace `shipping.min` with `shippingMin` and `shipping.max` with `shippingMax`:

```ts
  const cifMin = priceLocal + shippingMin + insMin;
  const cifMax = priceLocal + shippingMax + insMax;
```

And in the import-costs lines:

```ts
  const importMin = shippingMin + insMin + dutyMin + vatMin + portMin + regMin;
  const importMax = shippingMax + insMax + dutyMax + vatMax + portMax + regMax;
```

And in the return object:

```ts
    shipping: { min: shippingMin, max: shippingMax, currency },
```

Note: `round2` is already defined at the top of this file (line 87). No need to import.

- [ ] **Step 2: Run calculator tests**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx vitest run src/lib/landedCost/__tests__/calculator.test.ts`

Expected: PASS — all tests including the 3 new multiplier tests.

- [ ] **Step 3: Run full landedCost test suite**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx vitest run src/lib/landedCost/__tests__/`

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/landedCost/calculator.ts src/lib/landedCost/__tests__/calculator.test.ts
git commit -m "feat(landed-cost): apply family handling-tier multiplier to shipping"
```

---

## Phase C — Data refresh

### Task 13: Apply shipping research to `shipping.ts`

**Files:**
- Modify: `src/lib/landedCost/shipping.ts`

**Prerequisite:** Task 3 completed — `docs/landed-cost/research-2026-05/shipping-research.md` contains per-route v2 proposed ranges.

- [ ] **Step 1: Update every route's min/max**

Open `src/lib/landedCost/shipping.ts`. For each of the 12 cross-border cells, replace the min/max with the proposed v2 values from the research doc. Do not change currencies. Example pattern (the actual numbers come from the research doc):

```ts
  DE: {
    US: { min: 2900, max: 3900, currency: "USD" },  // was 2800-5200, v2 research
    DE: null,
    UK: { min: 950, max: 1400, currency: "GBP" },   // was 900-1800, v2 research
    JP: { min: 3100, max: 4200, currency: "EUR" },  // was 3000000-5500000 JPY (FIX: this was JPY, keep JPY)
  },
```

**Important:** review each existing cell for its currency — do NOT change currencies. Some `DE → JP` etc. carry JPY; keep JPY units. Only numeric min/max change.

- [ ] **Step 2: Bump lastReviewed in `SHIPPING_SOURCES`**

In the same file, update every entry's `lastReviewed` to the verification date (today's date in YYYY-MM-DD). If a source was dropped or added during research, edit the list accordingly.

- [ ] **Step 3: Add a test asserting the spread target**

Open `src/lib/landedCost/__tests__/shipping.test.ts` and add a new test inside `describe("SHIPPING_RATES", ...)`:

```ts
  it("meets Fase 1 spread target of ≤25% for at least 80% of routes", () => {
    const COUNTRIES: Country[] = ["US", "DE", "UK", "JP"];
    const spreads: number[] = [];
    for (const origin of COUNTRIES) {
      for (const dest of COUNTRIES) {
        if (origin === dest) continue;
        const r = SHIPPING_RATES[origin][dest]!;
        const spread = (r.max - r.min) / r.min;
        spreads.push(spread);
      }
    }
    const belowTarget = spreads.filter((s) => s <= 0.25).length;
    // 12 total routes; target ≥80% (≥10 of 12).
    expect(belowTarget).toBeGreaterThanOrEqual(10);
  });
```

- [ ] **Step 4: Run shipping tests**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx vitest run src/lib/landedCost/__tests__/shipping.test.ts`

Expected: PASS. If the spread assertion fails, revisit the research — either the proposed ranges are still too wide (widen the verification to more sources) or accept fewer routes meet target (document in changelog with justification).

- [ ] **Step 5: Commit**

```bash
git add src/lib/landedCost/shipping.ts src/lib/landedCost/__tests__/shipping.test.ts
git commit -m "feat(landed-cost): tighten shipping rates (12 routes) for 2026-05 v2"
```

### Task 14: Apply port/broker + registration research to `fees.ts`

**Files:**
- Modify: `src/lib/landedCost/fees.ts`

**Prerequisites:** Tasks 4 and 5 completed.

- [ ] **Step 1: Update port/broker and registration ranges**

Open `src/lib/landedCost/fees.ts`. For each destination (US, DE, UK, JP), replace the `portAndBroker` and `registration` `min`/`max` numbers with v2 proposed ranges from the research docs. Example:

```ts
  US: {
    country: "US",
    currency: "USD",
    marineInsurancePctRange: { minPct: 1.5, maxPct: 2.5 },  // unchanged
    portAndBroker: { min: 900, max: 1300, currency: "USD" }, // was 800-1500, v2
    registration: { min: 250, max: 450, currency: "USD" },   // was 200-500, v2
    // ...sources section: update lastReviewed dates below
  },
```

- [ ] **Step 2: Bump lastReviewed dates**

In the same file, update every `lastReviewed` to today's date (YYYY-MM-DD) for the three sources blocks per destination: marineInsurance, portAndBroker, registration.

- [ ] **Step 3: Run fees tests**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx vitest run src/lib/landedCost/__tests__/fees.test.ts`

Expected: PASS (existing fees.test.ts asserts structural invariants; numeric changes shouldn't break them). If it fails, inspect the failing assertion and either update the test to match the new value or revisit the data.

- [ ] **Step 4: Commit**

```bash
git add src/lib/landedCost/fees.ts
git commit -m "feat(landed-cost): tighten port/broker and registration ranges for 2026-05"
```

### Task 15: Bump lastReviewed in `duties.ts` and `taxes.ts`

**Files:**
- Modify: `src/lib/landedCost/duties.ts`
- Modify: `src/lib/landedCost/taxes.ts`

**Prerequisites:** Tasks 1 and 2 completed. For each destination, apply the changes (if any) found during verification. If all rates matched v1, this is a pure `lastReviewed` date bump.

- [ ] **Step 1: Update `duties.ts`**

Open `src/lib/landedCost/duties.ts`. For each of the 4 destinations, update the `source.lastReviewed` field to today's date. Apply any rate changes that Task 1's verification doc called out (expected: none).

- [ ] **Step 2: Update `taxes.ts`**

Same pattern as Step 1 but for `src/lib/landedCost/taxes.ts` — update `source.lastReviewed` per destination. Apply any rate changes from Task 2's verification doc.

- [ ] **Step 3: Run all landed-cost tests**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx vitest run src/lib/landedCost/__tests__/`

Expected: PASS. If any test fails because it asserts a specific rate number, update the test only if the gov source confirmed a real change.

- [ ] **Step 4: Commit**

```bash
git add src/lib/landedCost/duties.ts src/lib/landedCost/taxes.ts
git commit -m "chore(landed-cost): refresh lastReviewed dates for duty/tax (2026-05)"
```

---

## Phase D — Callers

### Task 16: Pass `seriesId` from the detail page

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/page.tsx`

**Context:** The detail page already calls `calculateLandedCost` at line 144 with a `car` object that has `make`, `model`, `year` (not a direct `series` field). Per `src/lib/brandConfig.ts:425`, the canonical way to derive a series id is `extractSeries(model, year, make)`. We'll compute it and pass it into `calculateLandedCost`. If the derived id is out of Tier-1 scope (e.g., `cayenne`), `getShippingMultiplier` already returns 1.0 — the calling code does not need to filter.

- [ ] **Step 1: Add the import**

Open `src/app/[locale]/cars/[make]/[id]/page.tsx`. Near the other `@/lib/...` imports at the top of the file, add:

```ts
import { extractSeries } from "@/lib/brandConfig";
import type { SeriesId } from "@/lib/landedCost";
```

- [ ] **Step 2: Pass `seriesId` in the call**

Replace the block at lines 144-148:

```ts
      const breakdown = await calculateLandedCost({
        car: { priceUsd: car.price, year: car.year },
        origin,
        destination,
      })
```

With:

```ts
      const derivedSeriesId = extractSeries(car.model, car.year, car.make) as SeriesId | undefined;
      const breakdown = await calculateLandedCost({
        car: { priceUsd: car.price, year: car.year, seriesId: derivedSeriesId },
        origin,
        destination,
      })
```

Note: `extractSeries` returns a `string`; casting to `SeriesId | undefined` is safe because `getShippingMultiplier` handles unknown strings by returning 1.0 (Task 9).

- [ ] **Step 3: Verify TS compiles**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/cars/[make]/[id]/page.tsx"
git commit -m "feat(landed-cost): pass derived seriesId to calculator from detail page"
```

### Task 17: Pass `seriesId` from the API route

**Files:**
- Modify: `src/app/api/analyze/route.ts`

**Context:** The API route calls `calculateLandedCost` at line 245 with the same `car` shape (`{ priceUsd, year }`). Same `extractSeries(model, year, make)` pattern applies — the route has access to `car.make`, `car.model`, `car.year` from its payload.

- [ ] **Step 1: Add the import**

Open `src/app/api/analyze/route.ts`. Near the other `@/lib/...` imports, add:

```ts
import { extractSeries } from "@/lib/brandConfig";
import type { SeriesId } from "@/lib/landedCost";
```

- [ ] **Step 2: Pass `seriesId` in the call**

Replace the block at lines 245-249:

```ts
        landedCost = await calculateLandedCost({
          car: { priceUsd: car.price, year: car.year },
          origin,
          destination,
        })
```

With:

```ts
        const derivedSeriesId = extractSeries(car.model, car.year, car.make) as SeriesId | undefined;
        landedCost = await calculateLandedCost({
          car: { priceUsd: car.price, year: car.year, seriesId: derivedSeriesId },
          origin,
          destination,
        })
```

- [ ] **Step 3: Verify TS compiles + run related tests**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx tsc --noEmit`

Expected: no errors.

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx vitest run src/app/api/analyze/`

Expected: PASS (or "no tests matched" — both acceptable).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat(landed-cost): pass derived seriesId to calculator from analyze API"
```

---

## Phase E — Packaging

### Task 18: Write the v1→v2 changelog

**Files:**
- Create: `docs/landed-cost/CHANGELOG-v1-to-v2.md`

- [ ] **Step 1: Write the changelog**

Create `docs/landed-cost/CHANGELOG-v1-to-v2.md`:

```markdown
# Landed Cost — CHANGELOG v1 → v2

**v1 released:** 2026-04-20
**v2 released:** 2026-05-[DD]
**Spec:** `docs/superpowers/specs/2026-04-21-landed-cost-research-program-design.md`

## Summary

- Added per-family (handling-tier) shipping multiplier (new module: `familyMultipliers.ts`).
- Tightened 12 shipping routes (avg spread from ~47% → ~22%).
- Tightened port/broker and registration ranges per destination.
- Verified all gov duty/tax rates (no material changes expected; date bump only if so).

## Shipping (by route)

| Route | v1 range | v2 range | v1 spread | v2 spread |
|---|:---|:---|---:|---:|
| DE → US | 2800-5200 USD | [v2] USD | 47% | [v2%] |
| UK → US | 2600-4800 USD | [v2] USD | 38% | [v2%] |
| JP → US | 2200-4500 USD | [v2] USD | ... | ... |
| US → DE | 2500-4800 EUR | [v2] EUR | ... | ... |
| UK → DE | 1200-2400 EUR | [v2] EUR | ... | ... |
| JP → DE | 3200-5500 EUR | [v2] EUR | ... | ... |
| US → UK | 2200-4200 GBP | [v2] GBP | ... | ... |
| DE → UK | 900-1800 GBP | [v2] GBP | ... | ... |
| JP → UK | 2800-4800 GBP | [v2] GBP | ... | ... |
| US → JP | 2,500,000-4,500,000 JPY | [v2] JPY | ... | ... |
| DE → JP | 3,000,000-5,500,000 JPY | [v2] JPY | ... | ... |
| UK → JP | 3,200,000-5,800,000 JPY | [v2] JPY | ... | ... |

## Family handling-tier multipliers (NEW in v2)

| SeriesId | Tier | Multiplier |
|---|:---|---:|
| 992, 991, 997, 996, 912, 944, 928, 968, 924 | standard | 1.00 |
| 993, 964, 930, g-model, f-model | premium | 1.15 |
| 918, carrera-gt, 959 | exotic | 1.35 |
| 356 | heritage | 1.10 |

## Duty & tax

[If gov verification found no changes:]
No rate changes. `lastReviewed` bumped to 2026-05-[DD].

[If any changes:]
- [Destination]: [rate] → [new rate]. Source: [URL]. Effective: [date].

## Port/broker (by destination)

| Destination | v1 range | v2 range | Δ |
|---|:---|:---|:---|
| US | 800-1500 USD | [v2] USD | [describe] |
| DE | 700-1400 EUR | [v2] EUR | ... |
| UK | 600-1200 GBP | [v2] GBP | ... |
| JP | 80,000-150,000 JPY | [v2] JPY | ... |

## Registration (by destination)

[Same table shape.]

## Marine insurance

Unchanged — 1.5-2.5% of CIF (Lloyds/classic-auto industry standard). Annual verification target.

## Worked examples (v1 → v2)

The 4 worked examples from the external review package (`~/Downloads/MonzaHaus-LandedCost-Review-2026-04-20.md`):

| Example | v1 teaser | v2 teaser | Δ |
|---|:---|:---|:---|
| A — 1973 911 DE→US, $300k | ~$330,100 | [v2 value] | [delta] |
| B — 2023 GT3 US→DE, $200k | ~€251,800 | [v2 value] | [delta] |
| C — 1995 993 JP→UK, $80k | ~£75,500 | [v2 value] | [delta] |
| D — Italian Porsche→US, $120k | ~$138,800 | [v2 value] | [delta] |

## Breaking changes

None. `CarInput.seriesId` is optional; existing callers that don't pass it get v1 behavior (1.0x multiplier).
```

Fill in the `[v2]` placeholders from the outputs of Tasks 3-5 and the actual worked-example re-runs in Task 21.

- [ ] **Step 2: Commit**

```bash
git add docs/landed-cost/CHANGELOG-v1-to-v2.md
git commit -m "docs(landed-cost): changelog v1 → v2"
```

### Task 19: Create the versioned JSON snapshot

**Files:**
- Create: `src/lib/landedCost/data/versions/2026-05.json`

**Context:** Frozen picture of every table this month. Used for diffing future months and for retroactive recalculation.

- [ ] **Step 1: Create the snapshot**

Create `src/lib/landedCost/data/versions/2026-05.json`. The file should be a single JSON object with these keys:

```json
{
  "version": "2026-05",
  "generatedAt": "2026-05-[DD]T00:00:00Z",
  "shippingRates": {
    "US": { "DE": { "min": 0, "max": 0, "currency": "EUR" }, "UK": { "min": 0, "max": 0, "currency": "GBP" }, "JP": { "min": 0, "max": 0, "currency": "JPY" } },
    "DE": { "US": { "min": 0, "max": 0, "currency": "USD" }, "UK": { "min": 0, "max": 0, "currency": "GBP" }, "JP": { "min": 0, "max": 0, "currency": "JPY" } },
    "UK": { "US": { "min": 0, "max": 0, "currency": "USD" }, "DE": { "min": 0, "max": 0, "currency": "EUR" }, "JP": { "min": 0, "max": 0, "currency": "JPY" } },
    "JP": { "US": { "min": 0, "max": 0, "currency": "USD" }, "DE": { "min": 0, "max": 0, "currency": "EUR" }, "UK": { "min": 0, "max": 0, "currency": "GBP" } }
  },
  "dutyRules": {
    "US": { "standardRatePct": 2.5, "ageExemption": { "yearsOld": 25, "ratePct": 0 } },
    "DE": { "standardRatePct": 10 },
    "UK": { "standardRatePct": 10, "ageExemption": { "yearsOld": 30, "ratePct": 5 } },
    "JP": { "standardRatePct": 0 }
  },
  "taxRules": {
    "US": { "ratePct": 6, "label": "Sales tax (avg)" },
    "DE": { "ratePct": 19, "label": "VAT", "ageReduction": { "yearsOld": 30, "ratePct": 7 } },
    "UK": { "ratePct": 20, "label": "VAT", "ageReduction": { "yearsOld": 30, "ratePct": 5 } },
    "JP": { "ratePct": 10, "label": "Consumption tax" }
  },
  "fees": {
    "US": { "marineInsurancePct": [1.5, 2.5], "portAndBroker": [0, 0], "registration": [0, 0], "currency": "USD" },
    "DE": { "marineInsurancePct": [1.5, 2.5], "portAndBroker": [0, 0], "registration": [0, 0], "currency": "EUR" },
    "UK": { "marineInsurancePct": [1.5, 2.5], "portAndBroker": [0, 0], "registration": [0, 0], "currency": "GBP" },
    "JP": { "marineInsurancePct": [1.5, 2.5], "portAndBroker": [0, 0], "registration": [0, 0], "currency": "JPY" }
  },
  "handlingTierMultipliers": {
    "standard": 1.0,
    "premium": 1.15,
    "exotic": 1.35,
    "heritage": 1.1
  },
  "seriesHandlingTier": {
    "992": "standard", "991": "standard", "997": "standard", "996": "standard",
    "993": "premium", "964": "premium", "930": "premium",
    "g-model": "premium", "f-model": "premium", "912": "standard",
    "918": "exotic", "carrera-gt": "exotic", "959": "exotic",
    "356": "heritage",
    "944": "standard", "928": "standard", "968": "standard", "924": "standard"
  }
}
```

Replace every `0` placeholder with the actual v2 value from the corresponding TS file (`shipping.ts`, `fees.ts`). Update `generatedAt` to today's ISO timestamp.

- [ ] **Step 2: Verify it parses**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && node -e "JSON.parse(require('fs').readFileSync('src/lib/landedCost/data/versions/2026-05.json', 'utf8')); console.log('OK')"`

Expected: `OK` printed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/landedCost/data/versions/2026-05.json
git commit -m "feat(landed-cost): add versioned snapshot for 2026-05 (v2)"
```

### Task 20: Write the monthly playbook

**Files:**
- Create: `docs/landed-cost/monthly-playbook.md`

- [ ] **Step 1: Write the playbook**

Create `docs/landed-cost/monthly-playbook.md` with the SOP from spec §6, adapted to code-adjacent form:

```markdown
# Landed Cost — Monthly Refresh Playbook

> SOP for the Fase 1/2 Claude-led monthly refresh cycle.
> Spec: `docs/superpowers/specs/2026-04-21-landed-cost-research-program-design.md` §6
> Changelog format: see `CHANGELOG-v1-to-v2.md` for the template.

**Frequency:** monthly. Best day: the 15th of each month (mid-month, avoids month-end rate changes landing mid-cycle).

**Time estimate:** 4-6 hours per cycle, dominated by shipping research.

---

## Step 1 — Open the monthly branch

```bash
cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto
git checkout main
git pull
git checkout -b landed-cost/monthly-YYYY-MM
```

Create skeleton docs:

```bash
mkdir -p docs/landed-cost/research-YYYY-MM
touch docs/landed-cost/research-YYYY-MM/{duty,tax,shipping,port-broker,registration}-verification.md
cp docs/landed-cost/sources-YYYY-MM-PREV.md docs/landed-cost/sources-YYYY-MM.md
```

## Step 2 — Gov data refresh (duty, tax) — ~30 min

Verify each destination's rate against its source URL (see spec §6 Step 2 table).

Update `duties.ts` and `taxes.ts` `lastReviewed` dates. If any rate changed, note in the changelog and check whether historical in-flight listings need recalculation.

## Step 3 — Shipping research — ~3 hours

For each of the 12 routes, gather ≥2 data points from published sources (spec §6 Step 3). Goal: tighten ranges where possible, keep v1 values where new data is sparse.

## Step 4 — Family multipliers — quarterly only

Only re-verify quarterly (Jan, Apr, Jul, Oct). No monthly work.

## Step 5 — Port/broker + registration — ~1 hour

Re-verify broker schedules and DMV/DVLA/KBA/Rikuun. These rarely move >5% mo/mo.

## Step 6 — Marine insurance — annually only

No monthly work. Verify in January each year.

## Step 7 — Update TS source files + bump dates

Apply research outputs to `shipping.ts` and `fees.ts`. Bump every `lastReviewed` touched this cycle to today's date.

## Step 8 — Re-run worked examples

The 4 canonical examples (`~/Downloads/MonzaHaus-LandedCost-Review-2026-04-20.md` §5):
- A — 1973 911 DE→US, $300k
- B — 2023 GT3 US→DE, $200k
- C — 1995 993 JP→UK, $80k
- D — Italian Porsche→US, $120k (proxied)

Write old-vs-new teaser values to the changelog. Any >5% move needs a "why" note.

## Step 9 — Changelog + snapshot

Write `CHANGELOG-monthly-YYYY-MM.md` using the CHANGELOG-v1-to-v2.md template. Create the JSON snapshot at `src/lib/landedCost/data/versions/YYYY-MM.json`.

## Step 10 — Test suite

```bash
npx vitest run src/lib/landedCost/__tests__/
```

Expected: all green. If the shipping spread assertion (see `shipping.test.ts`) fails, either tighten the research or document the exception in the changelog.

## Step 11 — PR

Push branch and open PR with title `landed-cost: monthly refresh YYYY-MM`. Edgar review focus per spec §6 Step 9.

## Step 12 — After merge

Verify deploy. Monitor for any listing that shows a wildly different teaser vs the week before.
```

- [ ] **Step 2: Commit**

```bash
git add docs/landed-cost/monthly-playbook.md
git commit -m "docs(landed-cost): monthly refresh playbook (SOP)"
```

### Task 21: Re-run worked examples and log results

**Files:**
- Modify: `docs/landed-cost/CHANGELOG-v1-to-v2.md` (fill in worked-examples table)

- [ ] **Step 1: Run the existing calculator tests that cover the 4 examples**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx vitest run src/lib/landedCost/__tests__/calculator.test.ts`

Expected: PASS. The existing tests for 1973 911 DE→US, 2023 GT3 US→DE, and 1995 993 JP→UK already cover the 3 of 4 worked examples. If any test fails because a numeric assertion drifted, the v2 data update is the cause — update the test numbers to match the new calc, and log the delta in the changelog.

- [ ] **Step 2: Manually verify Example D (Italian→US proxy)**

Write a one-off assertion in the calculator test file (temporary, for verification) that matches Example D:

```ts
  it("1950 Italian Porsche→US via DE proxy: teaser within 5% of spec value", async () => {
    const result = await calculateLandedCost({
      car: { priceUsd: 120000, year: 2019 },  // 7yr old, no exemptions
      origin: "IT",
      destination: "US",
    });
    expect(result).not.toBeNull();
    // Spec v1 expected ~$138,800 (midpoint of $136,378-$141,289).
    // v2 may differ; log the delta in the CHANGELOG.
    const teaser = (result!.landedCost.min + result!.landedCost.max) / 2;
    console.log("Example D v2 teaser:", teaser);
  });
```

Run it once to capture the number, then record the teaser value in the CHANGELOG worked-examples table. Remove the one-off test before committing (keep changelog entry).

- [ ] **Step 3: Update CHANGELOG worked-examples table**

Fill in the v2 column for all 4 examples. For any example where v2 teaser moves >5% from v1, add a 1-sentence "why" note below the table.

- [ ] **Step 4: Commit**

```bash
git add docs/landed-cost/CHANGELOG-v1-to-v2.md
git commit -m "docs(landed-cost): fill v2 worked examples in changelog"
```

### Task 22: Final smoke test + open PR

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx vitest run`

Expected: all tests PASS. Fix any unrelated breakage before opening PR.

- [ ] **Step 2: Run type-check**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx tsc --noEmit`

Expected: no type errors.

- [ ] **Step 3: Run ESLint**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && npx eslint src/lib/landedCost/ --max-warnings 0`

Expected: no lint errors. Fix any that appear.

- [ ] **Step 4: Smoke the dev server**

Run: `cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && rm -rf .next && npm run dev`

Open a Porsche detail page in the browser. Verify:
- The landed cost teaser appears under the price
- The number is reasonable (compare roughly to the CHANGELOG v2 expected value for that car)
- No console errors related to landed-cost

Stop the dev server with Ctrl-C when done.

- [ ] **Step 5: Push the branch**

```bash
cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto && git push -u origin feat/landed-cost
```

- [ ] **Step 6: Open the PR**

```bash
gh pr create --title "Landed cost Fase 1 — v2 data + family multipliers" --body "$(cat <<'EOF'
## Summary
- v2 data refresh: tightened 12 shipping routes (~47% → ~22% avg spread), tightened port/broker and registration ranges
- New: per-family shipping multiplier via handling tiers (standard/premium/exotic/heritage) — applies when `seriesId` is passed; out-of-scope series fall back to route-base range
- New monthly-refresh playbook (SOP) for repeating this cycle
- New versioned snapshot at `src/lib/landedCost/data/versions/2026-05.json`

## What's in scope
Fase 1 of the landed-cost research program — spec: `docs/superpowers/specs/2026-04-21-landed-cost-research-program-design.md`. Supabase migration is intentionally deferred to Fase 2.

## Research sources
See `docs/landed-cost/sources-2026-05.md` for every number → source → retrieval date.
See `docs/landed-cost/research-2026-05/` for per-category research notes.

## Test plan
- [ ] `npx vitest run src/lib/landedCost/__tests__/` — all green
- [ ] `npx tsc --noEmit` — clean
- [ ] `npx eslint src/lib/landedCost/` — clean
- [ ] Manual smoke: open a 993, 992, 918, 356 listing — verify the teaser reflects the tier multiplier
- [ ] Manual smoke: open a Cayenne listing (out-of-scope) — verify the teaser renders with footnote and no multiplier

## Review checklist for Edgar
- [ ] sources-2026-05.md: every v2 number has a source URL
- [ ] Shipping test asserts ≥10/12 routes meet ≤25% spread
- [ ] No change >10% on any line that isn't explained in the CHANGELOG
- [ ] Worked examples in CHANGELOG re-run and documented

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL returned. Post it to Edgar.

---

## Self-review checklist (run after all tasks complete)

- [ ] Every file listed in "File structure" section exists (or was explicitly modified).
- [ ] `sources-2026-05.md` covers every number in `shipping.ts`, `fees.ts`, `duties.ts`, `taxes.ts`.
- [ ] No `TBD` / `TODO` / `[v2]` placeholder remaining in any committed file.
- [ ] `CHANGELOG-v1-to-v2.md` worked-examples table has real numbers (Task 21).
- [ ] The shipping spread assertion in `shipping.test.ts` passes at the 80% threshold.
- [ ] All 4 worked examples either pass unchanged or have a documented "why" note for their delta.
- [ ] Monthly playbook is self-contained — a future Claude (or engineer) can execute it from zero context.

---

## Out of scope (do NOT do in this plan)

- Supabase migration of landed-cost tables → Fase 2
- Carrier quote form outreach / VA hiring → Fase 2 if Edgar chooses
- Per-state US sales-tax granularity → future
- EPA/DOT compliance cost modeling for sub-25-yr US imports → future advisory
- Tier-2 live-agent design → Fase 3
- Non-Porsche makes (Ferrari, BMW) → Fase 3+
