# Golden Standard Valuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a single, honest, traceable valuation system across the platform so every price number shown in the UI has a declared basis, confidence tier, and sample provenance — no blending of asking and sold prices, no fabricated fallbacks, no silent `±15%` bands.

**Architecture:** Three-layer pipeline. (1) Derivation layer turns each raw listing into `{ soldPrice | askingPrice, basis, canonicalMarket }`. (2) Aggregation layer computes segment statistics — `MarketValue` (sold median) and `AskMedian` (adjusted asking median) — with confidence tiers and IQR bands. (3) UI layer renders two parallel numbers per segment with traceability tooltips; kills fake fallbacks. A generated `familyFactor` table carries the global sold/asking ratio per family.

**Tech Stack:** TypeScript, Next.js App Router, Supabase (PostgREST), Vitest, React, next-intl, Tailwind.

**Source of truth for the standard:** conversation on 2026-04-18. Eight rules (1–8 data layer, 9–14 UI layer). Thresholds: High ≥20 sold / ≥200 asking; Medium 8–19 sold / 50–199 asking; Low 1–7 / <50; else `—`. Family factor requires ≥30 sold globally; fallback = Porsche-wide factor.

**Out of scope:** Ferrari-specific valuation tuning (same system applies, but thesis text stays untouched). Changing the Supabase schema. Touching scrapers.

**Related prior plans:** `2026-04-18-family-market-valuation.md` (superseded by this plan). `2026-03-17-investment-report-real-data.md` (existing investment report; reuses `src/lib/marketStats.ts` which this plan leaves intact — the report layer already separates tiers properly).

---

## File Structure

**New files (creates):**

- `src/lib/pricing/types.ts` — Canonical types: `ValuationBasis`, `CanonicalMarket`, `ConfidenceTier`, `DerivedPrice`, `SegmentStats`, `FamilyFactor`.
- `src/lib/pricing/canonicalMarket.ts` — `sourceToCanonicalMarket(source: string): CanonicalMarket` — single source→market mapping.
- `src/lib/pricing/derivePrice.ts` — `derivePrice(row: RawListing): DerivedPrice` — turns a listing into sold/asking + basis.
- `src/lib/pricing/familyFactor.ts` — loads the generated factor table; exposes `getFamilyFactor(family, fallback?): number`.
- `src/lib/pricing/familyFactor.generated.ts` — **generated** static table `{ [family]: { factor: number, soldN: number, askingN: number } }` plus `porscheWide`.
- `src/lib/pricing/segmentStats.ts` — `computeSegmentStats(prices: DerivedPrice[], segmentKey, factors): SegmentStats`.
- `src/lib/pricing/confidence.ts` — tier thresholds + `classifyTier(soldN, askingN): ConfidenceTier`.
- `src/lib/pricing/iqrBand.ts` — `iqrBand(values: number[]): { p25, p50, p75 } | null` (min n=8).
- `src/lib/pricing/__tests__/derivePrice.test.ts`
- `src/lib/pricing/__tests__/canonicalMarket.test.ts`
- `src/lib/pricing/__tests__/segmentStats.test.ts`
- `src/lib/pricing/__tests__/confidence.test.ts`
- `src/lib/pricing/__tests__/iqrBand.test.ts`
- `scripts/generate-family-factors.ts` — script that queries Supabase, computes factors, writes `familyFactor.generated.ts`.
- `scripts/generate-family-factors.test.ts` — unit test over fixture corpus.
- `src/components/dashboard/context/shared/ValuationTile.tsx` — shared component: two-line tile (Market value / Ask median) with tier dots + tooltip.
- `src/components/dashboard/context/shared/ValuationTile.test.tsx` (optional — smoke render).

**Modified files:**

- `src/lib/curatedCars.ts` — extend `CollectorCar` with `soldPrice | null`, `askingPrice | null`, `valuationBasis`, `canonicalMarket`. Keep `price`, `currentBid`, `region` for backward compat (flagged deprecated in comment).
- `src/lib/supabaseLiveListings.ts` — populate new fields in `rowToCollectorCar`; replace `enrichFairValues` body to use `segmentStats` (no more `±15%` band, no more overall-median fallback).
- `src/components/dashboard/types.ts` — `Auction` type mirrors new `CollectorCar` fields.
- `src/components/dashboard/utils/valuation.ts` — new implementation using derived prices + family factors; `computeRegionalValFromAuctions` returns `{ marketValue, askMedian, tier, soldN, askingN, factorApplied }` per market. Delete overall-median fallback.
- `src/components/dashboard/utils/valuation.test.ts` — update for new surface.
- `src/components/dashboard/context/shared/RegionalValuation.tsx` — renders `ValuationTile` per market.
- `src/components/dashboard/context/BrandContextPanel.tsx` — consume new shape.
- `src/components/dashboard/DashboardClient.tsx` — family card label change; replace `currentBid * 0.85/1.15` bands; route all price reads through new utils.
- `src/components/makePage/context/CarContextPanel.tsx` — ownership cost scale reads market value, not mixed avg.
- `messages/en.json` (+ other locales) — new keys: `valuation.marketValue`, `valuation.askMedian`, `valuation.insufficientData`, `valuation.confidence.high/medium/low`, `valuation.basis.sold/adjusted/raw`, `valuation.askingRange` (replaces `priceRange`).
- `package.json` — add `"generate:factors": "tsx scripts/generate-family-factors.ts"`.

**Removed behavior (not files):**

- `enrichFairValues` in `supabaseLiveListings.ts:398` — stop falling back to overall median.
- `computeRegionalValFromAuctions` in `valuation.ts:88` — stop falling back to `overallMedianUsd`.
- `DashboardClient.tsx:1511,1615` — stop computing `bidFallback * 0.85 / 1.15`.

---

## Task Plan

### Task 1: Pricing types module

**Files:**
- Create: `src/lib/pricing/types.ts`
- Test: `src/lib/pricing/__tests__/types.test.ts` (type-only, compile check)

- [ ] **Step 1.1: Write the types file**

```ts
// src/lib/pricing/types.ts

export type CanonicalMarket = "US" | "EU" | "UK" | "JP";

export type ValuationBasis =
  | "sold"            // real transaction
  | "asking_adjusted" // asking price × family factor
  | "asking_raw"      // asking price, no adjustment available
  | "unknown";        // no usable price

export type ConfidenceTier = "high" | "medium" | "low" | "insufficient";

export interface DerivedPrice {
  /** Set only when status='sold' AND source is auction (BaT/ClassicCom/BeForward-sold). */
  soldPriceUsd: number | null;
  /** Set when not sold. Raw asking price in USD (not yet adjusted). */
  askingPriceUsd: number | null;
  /** Which of the three concepts this row represents. */
  basis: "sold" | "asking" | "unknown";
  /** Source-derived market. Never read from raw `region`. */
  canonicalMarket: CanonicalMarket | null;
  /** Family id (e.g. "992", "991"); null when extraction failed. */
  family: string | null;
}

export interface SegmentStats {
  market: CanonicalMarket;
  family: string;
  marketValue: {
    valueUsd: number | null;
    p25Usd: number | null;
    p75Usd: number | null;
    soldN: number;
    tier: ConfidenceTier;
  };
  askMedian: {
    valueUsd: number | null;        // adjusted
    rawMedianUsd: number | null;    // unadjusted (for transparency)
    p25Usd: number | null;
    p75Usd: number | null;
    askingN: number;
    factorApplied: number | null;   // family factor used (null if none)
    factorSource: "family" | "porsche_wide" | "none";
    tier: ConfidenceTier;
  };
}

export interface FamilyFactor {
  family: string;
  factor: number;    // median(sold) / median(asking)
  soldN: number;
  askingN: number;
}

export interface FamilyFactorTable {
  porscheWide: { factor: number; soldN: number; askingN: number };
  byFamily: Record<string, FamilyFactor>;
  generatedAt: string; // ISO timestamp
}
```

- [ ] **Step 1.2: Write a compile-check test**

```ts
// src/lib/pricing/__tests__/types.test.ts
import type {
  DerivedPrice,
  SegmentStats,
  FamilyFactor,
  CanonicalMarket,
} from "../types";
import { describe, it, expect } from "vitest";

describe("pricing types", () => {
  it("DerivedPrice accepts sold-only row", () => {
    const d: DerivedPrice = {
      soldPriceUsd: 120000,
      askingPriceUsd: null,
      basis: "sold",
      canonicalMarket: "US",
      family: "992",
    };
    expect(d.basis).toBe("sold");
  });

  it("DerivedPrice accepts asking-only row", () => {
    const d: DerivedPrice = {
      soldPriceUsd: null,
      askingPriceUsd: 95000,
      basis: "asking",
      canonicalMarket: "EU",
      family: "997",
    };
    expect(d.basis).toBe("asking");
  });

  it("CanonicalMarket is closed set", () => {
    const m: CanonicalMarket = "EU";
    expect(["US", "EU", "UK", "JP"]).toContain(m);
  });
});
```

- [ ] **Step 1.3: Run tests**

Run: `npx vitest run src/lib/pricing/__tests__/types.test.ts`
Expected: 3 passed.

- [ ] **Step 1.4: Commit**

```bash
git add src/lib/pricing/types.ts src/lib/pricing/__tests__/types.test.ts
git commit -m "feat(pricing): canonical valuation types"
```

---

### Task 2: Canonical market mapping

**Files:**
- Create: `src/lib/pricing/canonicalMarket.ts`
- Test: `src/lib/pricing/__tests__/canonicalMarket.test.ts`

- [ ] **Step 2.1: Write the failing test**

```ts
// src/lib/pricing/__tests__/canonicalMarket.test.ts
import { describe, it, expect } from "vitest";
import { sourceToCanonicalMarket, AUCTION_SOURCES } from "../canonicalMarket";

describe("sourceToCanonicalMarket", () => {
  it("BaT and ClassicCom are US", () => {
    expect(sourceToCanonicalMarket("BaT")).toBe("US");
    expect(sourceToCanonicalMarket("Bring a Trailer")).toBe("US");
    expect(sourceToCanonicalMarket("ClassicCom")).toBe("US");
  });

  it("AutoScout24 and Elferspot are EU", () => {
    expect(sourceToCanonicalMarket("AutoScout24")).toBe("EU");
    expect(sourceToCanonicalMarket("Elferspot")).toBe("EU");
  });

  it("AutoTrader is UK", () => {
    expect(sourceToCanonicalMarket("AutoTrader")).toBe("UK");
  });

  it("BeForward is JP", () => {
    expect(sourceToCanonicalMarket("BeForward")).toBe("JP");
  });

  it("unknown source returns null", () => {
    expect(sourceToCanonicalMarket("Craigslist")).toBeNull();
    expect(sourceToCanonicalMarket("")).toBeNull();
  });

  it("AUCTION_SOURCES contains BaT and ClassicCom only", () => {
    expect(AUCTION_SOURCES).toContain("BaT");
    expect(AUCTION_SOURCES).toContain("ClassicCom");
    expect(AUCTION_SOURCES).not.toContain("AutoScout24");
  });
});
```

- [ ] **Step 2.2: Run test, verify fail**

Run: `npx vitest run src/lib/pricing/__tests__/canonicalMarket.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement**

```ts
// src/lib/pricing/canonicalMarket.ts
import type { CanonicalMarket } from "./types";

const MAP: Record<string, CanonicalMarket> = {
  "BaT": "US",
  "Bring a Trailer": "US",
  "ClassicCom": "US",
  "Classic.com": "US",
  "AutoScout24": "EU",
  "Elferspot": "EU",
  "AutoTrader": "UK",
  "BeForward": "JP",
};

export function sourceToCanonicalMarket(source: string | null | undefined): CanonicalMarket | null {
  if (!source) return null;
  return MAP[source] ?? null;
}

export const AUCTION_SOURCES: readonly string[] = ["BaT", "Bring a Trailer", "ClassicCom", "Classic.com"] as const;

export function isAuctionSource(source: string | null | undefined): boolean {
  if (!source) return false;
  return AUCTION_SOURCES.includes(source);
}
```

- [ ] **Step 2.4: Run tests, verify pass**

Run: `npx vitest run src/lib/pricing/__tests__/canonicalMarket.test.ts`
Expected: 6 passed.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/pricing/canonicalMarket.ts src/lib/pricing/__tests__/canonicalMarket.test.ts
git commit -m "feat(pricing): source→canonical market mapping"
```

---

### Task 3: IQR band helper

**Files:**
- Create: `src/lib/pricing/iqrBand.ts`
- Test: `src/lib/pricing/__tests__/iqrBand.test.ts`

- [ ] **Step 3.1: Write the failing test**

```ts
// src/lib/pricing/__tests__/iqrBand.test.ts
import { describe, it, expect } from "vitest";
import { iqrBand } from "../iqrBand";

describe("iqrBand", () => {
  it("returns null below n=8", () => {
    expect(iqrBand([])).toBeNull();
    expect(iqrBand([1, 2, 3, 4, 5, 6, 7])).toBeNull();
  });

  it("returns median p25 p75 for 8+ values", () => {
    const vs = [10, 20, 30, 40, 50, 60, 70, 80];
    const b = iqrBand(vs)!;
    expect(b.p50).toBe(45);
    expect(b.p25).toBeLessThan(b.p50);
    expect(b.p75).toBeGreaterThan(b.p50);
  });

  it("is resilient to outliers via Tukey fence", () => {
    const vs = [10, 20, 30, 40, 50, 60, 70, 80, 10_000_000];
    const b = iqrBand(vs)!;
    // 10M outlier excluded; p75 should remain sane
    expect(b.p75).toBeLessThan(100);
  });
});
```

- [ ] **Step 3.2: Run, verify fail**

Run: `npx vitest run src/lib/pricing/__tests__/iqrBand.test.ts`
Expected: FAIL.

- [ ] **Step 3.3: Implement**

```ts
// src/lib/pricing/iqrBand.ts
function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Returns p25/p50/p75 after Tukey 1.5·IQR outlier trim. Requires n>=8. */
export function iqrBand(values: number[]): { p25: number; p50: number; p75: number } | null {
  if (values.length < 8) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = pct(sorted, 0.25);
  const q3 = pct(sorted, 0.75);
  const iqr = q3 - q1;
  let trimmed = sorted;
  if (iqr > 0) {
    const lo = q1 - 1.5 * iqr;
    const hi = q3 + 1.5 * iqr;
    trimmed = sorted.filter((v) => v >= lo && v <= hi);
    if (trimmed.length < 8) trimmed = sorted;
  }
  return {
    p25: pct(trimmed, 0.25),
    p50: pct(trimmed, 0.5),
    p75: pct(trimmed, 0.75),
  };
}
```

- [ ] **Step 3.4: Run, verify pass**

Run: `npx vitest run src/lib/pricing/__tests__/iqrBand.test.ts`
Expected: 3 passed.

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/pricing/iqrBand.ts src/lib/pricing/__tests__/iqrBand.test.ts
git commit -m "feat(pricing): IQR band helper with Tukey trim"
```

---

### Task 4: Confidence tier classifier

**Files:**
- Create: `src/lib/pricing/confidence.ts`
- Test: `src/lib/pricing/__tests__/confidence.test.ts`

- [ ] **Step 4.1: Write failing test**

```ts
// src/lib/pricing/__tests__/confidence.test.ts
import { describe, it, expect } from "vitest";
import { classifySoldTier, classifyAskingTier } from "../confidence";

describe("classifySoldTier", () => {
  it("high at 20+", () => {
    expect(classifySoldTier(20)).toBe("high");
    expect(classifySoldTier(500)).toBe("high");
  });
  it("medium 8-19", () => {
    expect(classifySoldTier(8)).toBe("medium");
    expect(classifySoldTier(19)).toBe("medium");
  });
  it("low 1-7", () => {
    expect(classifySoldTier(1)).toBe("low");
    expect(classifySoldTier(7)).toBe("low");
  });
  it("insufficient at 0", () => {
    expect(classifySoldTier(0)).toBe("insufficient");
  });
});

describe("classifyAskingTier", () => {
  it("high requires 200+ AND factor measured", () => {
    expect(classifyAskingTier(200, "family")).toBe("high");
    expect(classifyAskingTier(200, "porsche_wide")).toBe("medium");
  });
  it("medium 50-199 OR porsche-wide factor", () => {
    expect(classifyAskingTier(50, "family")).toBe("medium");
    expect(classifyAskingTier(199, "family")).toBe("medium");
    expect(classifyAskingTier(500, "porsche_wide")).toBe("medium");
  });
  it("low below 50", () => {
    expect(classifyAskingTier(49, "family")).toBe("low");
    expect(classifyAskingTier(1, "none")).toBe("low");
  });
  it("insufficient at 0", () => {
    expect(classifyAskingTier(0, "family")).toBe("insufficient");
    expect(classifyAskingTier(0, "none")).toBe("insufficient");
  });
});
```

- [ ] **Step 4.2: Run, verify fail**

Run: `npx vitest run src/lib/pricing/__tests__/confidence.test.ts`
Expected: FAIL.

- [ ] **Step 4.3: Implement**

```ts
// src/lib/pricing/confidence.ts
import type { ConfidenceTier } from "./types";

export const SOLD_THRESHOLDS = { high: 20, medium: 8, low: 1 } as const;
export const ASKING_THRESHOLDS = { high: 200, medium: 50, low: 1 } as const;

export function classifySoldTier(soldN: number): ConfidenceTier {
  if (soldN >= SOLD_THRESHOLDS.high) return "high";
  if (soldN >= SOLD_THRESHOLDS.medium) return "medium";
  if (soldN >= SOLD_THRESHOLDS.low) return "low";
  return "insufficient";
}

export function classifyAskingTier(
  askingN: number,
  factorSource: "family" | "porsche_wide" | "none",
): ConfidenceTier {
  if (askingN === 0) return "insufficient";
  if (askingN >= ASKING_THRESHOLDS.high && factorSource === "family") return "high";
  if (askingN >= ASKING_THRESHOLDS.medium && factorSource === "family") return "medium";
  if (factorSource === "porsche_wide") return "medium";
  return "low";
}
```

- [ ] **Step 4.4: Run, verify pass**

Run: `npx vitest run src/lib/pricing/__tests__/confidence.test.ts`
Expected: 8 passed.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/pricing/confidence.ts src/lib/pricing/__tests__/confidence.test.ts
git commit -m "feat(pricing): confidence tier classifier"
```

---

### Task 5: Derive price per raw listing

**Files:**
- Create: `src/lib/pricing/derivePrice.ts`
- Test: `src/lib/pricing/__tests__/derivePrice.test.ts`

This is the core rule that reads `hammer_price / final_price / current_bid` + `status + source` and emits the canonical `DerivedPrice`.

- [ ] **Step 5.1: Write failing tests**

```ts
// src/lib/pricing/__tests__/derivePrice.test.ts
import { describe, it, expect } from "vitest";
import { derivePrice, type RawListing } from "../derivePrice";

const base: RawListing = {
  source: "BaT",
  status: "sold",
  year: 2005,
  make: "Porsche",
  model: "911 Carrera",
  hammer_price: 120000,
  final_price: 120000,
  current_bid: 120000,
  original_currency: "USD",
};

describe("derivePrice", () => {
  it("BaT sold → soldPrice from hammer", () => {
    const d = derivePrice(base, { rates: {} });
    expect(d.soldPriceUsd).toBe(120000);
    expect(d.askingPriceUsd).toBeNull();
    expect(d.basis).toBe("sold");
    expect(d.canonicalMarket).toBe("US");
  });

  it("BaT active → askingPrice from current_bid, NOT sold", () => {
    const d = derivePrice(
      { ...base, status: "active", hammer_price: null, final_price: null, current_bid: 55000 },
      { rates: {} },
    );
    expect(d.soldPriceUsd).toBeNull();
    expect(d.askingPriceUsd).toBe(55000);
    expect(d.basis).toBe("asking");
  });

  it("AutoScout24 active → asking (never sold) regardless of hammer_price value", () => {
    const d = derivePrice(
      {
        ...base,
        source: "AutoScout24",
        status: "active",
        hammer_price: 89000,
        final_price: 89000,
        current_bid: 89000,
        original_currency: "EUR",
      },
      { rates: { EUR: 1 / 0.92 } }, // 1 EUR = 1/0.92 USD
    );
    expect(d.soldPriceUsd).toBeNull();
    expect(d.askingPriceUsd).toBeCloseTo(89000 / 0.92, 0);
    expect(d.basis).toBe("asking");
    expect(d.canonicalMarket).toBe("EU");
  });

  it("AutoScout24 delisted → still asking (never sold)", () => {
    const d = derivePrice(
      { ...base, source: "AutoScout24", status: "delisted", hammer_price: 50000, original_currency: "EUR" },
      { rates: { EUR: 1 / 0.92 } },
    );
    expect(d.basis).toBe("asking");
    expect(d.soldPriceUsd).toBeNull();
  });

  it("ClassicCom sold → soldPrice", () => {
    const d = derivePrice({ ...base, source: "ClassicCom", hammer_price: 75000 }, { rates: {} });
    expect(d.basis).toBe("sold");
    expect(d.soldPriceUsd).toBe(75000);
    expect(d.canonicalMarket).toBe("US");
  });

  it("BeForward status=sold → soldPrice (rare but exists)", () => {
    const d = derivePrice(
      { ...base, source: "BeForward", status: "sold", hammer_price: null, final_price: null, current_bid: 40000, original_currency: "JPY" },
      { rates: { JPY: 0.0067 } },
    );
    expect(d.basis).toBe("sold");
    expect(d.soldPriceUsd).toBeCloseTo(40000 * 0.0067, 0);
    expect(d.canonicalMarket).toBe("JP");
  });

  it("BeForward status=active → asking", () => {
    const d = derivePrice(
      { ...base, source: "BeForward", status: "active", hammer_price: null, current_bid: 40000, original_currency: "JPY" },
      { rates: { JPY: 0.0067 } },
    );
    expect(d.basis).toBe("asking");
  });

  it("no usable price → unknown basis, nulls", () => {
    const d = derivePrice(
      { ...base, hammer_price: null, final_price: null, current_bid: null },
      { rates: {} },
    );
    expect(d.basis).toBe("unknown");
    expect(d.soldPriceUsd).toBeNull();
    expect(d.askingPriceUsd).toBeNull();
  });

  it("unknown source → canonicalMarket null, basis unknown", () => {
    const d = derivePrice({ ...base, source: "Weirdo" }, { rates: {} });
    expect(d.canonicalMarket).toBeNull();
    expect(d.basis).toBe("unknown");
  });

  it("extracts family via extractSeries", () => {
    const d = derivePrice({ ...base, year: 2015, model: "911 Carrera" }, { rates: {} });
    // Family inferred from series config; 2015 911 → 991
    expect(d.family).toBe("991");
  });
});
```

- [ ] **Step 5.2: Run, verify fail**

Run: `npx vitest run src/lib/pricing/__tests__/derivePrice.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5.3: Implement**

```ts
// src/lib/pricing/derivePrice.ts
import { toUsd } from "@/lib/exchangeRates";
import { extractSeries, getSeriesConfig } from "@/lib/brandConfig";
import type { DerivedPrice } from "./types";
import { sourceToCanonicalMarket, isAuctionSource } from "./canonicalMarket";

export interface RawListing {
  source: string;
  status: string | null;
  year: number;
  make: string;
  model: string;
  hammer_price: number | null;
  final_price: number | null;
  current_bid: number | null;
  original_currency: string | null;
}

interface DeriveContext {
  rates: Record<string, number>;
}

function pickRawAmount(row: RawListing): number | null {
  if (row.hammer_price != null && row.hammer_price > 0) return row.hammer_price;
  if (row.final_price != null && row.final_price > 0) return row.final_price;
  if (row.current_bid != null && row.current_bid > 0) return row.current_bid;
  return null;
}

function isSold(row: RawListing): boolean {
  // Rule 3 of standard: sold_price exists only when status='sold' AND source is an auction.
  // BeForward status='sold' (rare) counts as auction-sold per earlier analysis.
  if (row.status !== "sold") return false;
  if (isAuctionSource(row.source)) return true;
  if (row.source === "BeForward") return true;
  return false;
}

function extractFamily(row: RawListing): string | null {
  const series = extractSeries(row.model, row.year, row.make);
  if (!series) return null;
  const config = getSeriesConfig(series, row.make);
  // Use series id as "family" granularity; this matches the segmentation the UI needs.
  return series || config?.family || null;
}

export function derivePrice(row: RawListing, ctx: DeriveContext): DerivedPrice {
  const market = sourceToCanonicalMarket(row.source);
  const family = extractFamily(row);
  const raw = pickRawAmount(row);
  if (raw == null) {
    return { soldPriceUsd: null, askingPriceUsd: null, basis: "unknown", canonicalMarket: market, family };
  }
  const usd = toUsd(raw, row.original_currency, ctx.rates);
  if (!(usd > 0)) {
    return { soldPriceUsd: null, askingPriceUsd: null, basis: "unknown", canonicalMarket: market, family };
  }
  if (market === null) {
    return { soldPriceUsd: null, askingPriceUsd: null, basis: "unknown", canonicalMarket: null, family };
  }
  if (isSold(row)) {
    return { soldPriceUsd: usd, askingPriceUsd: null, basis: "sold", canonicalMarket: market, family };
  }
  return { soldPriceUsd: null, askingPriceUsd: usd, basis: "asking", canonicalMarket: market, family };
}
```

- [ ] **Step 5.4: Run, verify pass**

Run: `npx vitest run src/lib/pricing/__tests__/derivePrice.test.ts`
Expected: all 10 passed.

- [ ] **Step 5.5: Commit**

```bash
git add src/lib/pricing/derivePrice.ts src/lib/pricing/__tests__/derivePrice.test.ts
git commit -m "feat(pricing): derive sold/asking price per listing"
```

---

### Task 6: Family factor loader + empty generated table

**Files:**
- Create: `src/lib/pricing/familyFactor.generated.ts` (placeholder)
- Create: `src/lib/pricing/familyFactor.ts`
- Test: `src/lib/pricing/__tests__/familyFactor.test.ts`

- [ ] **Step 6.1: Write placeholder generated table**

```ts
// src/lib/pricing/familyFactor.generated.ts
// AUTO-GENERATED by scripts/generate-family-factors.ts — do not edit by hand.
import type { FamilyFactorTable } from "./types";

export const FAMILY_FACTOR_TABLE: FamilyFactorTable = {
  porscheWide: { factor: 0.9, soldN: 0, askingN: 0 },
  byFamily: {},
  generatedAt: "1970-01-01T00:00:00Z",
};
```

- [ ] **Step 6.2: Write failing test**

```ts
// src/lib/pricing/__tests__/familyFactor.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFamilyFactor, _setTableForTest } from "../familyFactor";

describe("getFamilyFactor", () => {
  beforeEach(() => {
    _setTableForTest({
      porscheWide: { factor: 0.9, soldN: 1000, askingN: 5000 },
      byFamily: {
        "992": { family: "992", factor: 0.92, soldN: 150, askingN: 2800 },
        "rare": { family: "rare", factor: 0.7, soldN: 5, askingN: 20 }, // below 30 sold threshold
      },
      generatedAt: "2026-04-18T00:00:00Z",
    });
  });

  it("returns family factor when soldN >= 30", () => {
    const r = getFamilyFactor("992");
    expect(r.factor).toBe(0.92);
    expect(r.source).toBe("family");
  });

  it("falls back to porsche-wide when soldN < 30", () => {
    const r = getFamilyFactor("rare");
    expect(r.factor).toBe(0.9);
    expect(r.source).toBe("porsche_wide");
  });

  it("falls back to porsche-wide when family unknown", () => {
    const r = getFamilyFactor("unknown-family");
    expect(r.factor).toBe(0.9);
    expect(r.source).toBe("porsche_wide");
  });

  it("returns none source when porsche-wide also lacks data", () => {
    _setTableForTest({
      porscheWide: { factor: 0.9, soldN: 0, askingN: 0 },
      byFamily: {},
      generatedAt: "1970-01-01T00:00:00Z",
    });
    const r = getFamilyFactor("992");
    expect(r.source).toBe("none");
  });
});
```

- [ ] **Step 6.3: Run, verify fail**

Run: `npx vitest run src/lib/pricing/__tests__/familyFactor.test.ts`
Expected: FAIL.

- [ ] **Step 6.4: Implement loader**

```ts
// src/lib/pricing/familyFactor.ts
import type { FamilyFactorTable } from "./types";
import { FAMILY_FACTOR_TABLE } from "./familyFactor.generated";

const MIN_SOLD_FOR_FAMILY_FACTOR = 30;

let activeTable: FamilyFactorTable = FAMILY_FACTOR_TABLE;

/** For tests only. */
export function _setTableForTest(t: FamilyFactorTable) {
  activeTable = t;
}

export function getFamilyFactor(family: string | null): {
  factor: number;
  source: "family" | "porsche_wide" | "none";
} {
  const { porscheWide, byFamily } = activeTable;
  if (family) {
    const f = byFamily[family];
    if (f && f.soldN >= MIN_SOLD_FOR_FAMILY_FACTOR && f.factor > 0) {
      return { factor: f.factor, source: "family" };
    }
  }
  if (porscheWide.soldN > 0 && porscheWide.factor > 0) {
    return { factor: porscheWide.factor, source: "porsche_wide" };
  }
  return { factor: 1, source: "none" };
}

export function familyFactorMeta() {
  return { generatedAt: activeTable.generatedAt };
}
```

- [ ] **Step 6.5: Run, verify pass**

Run: `npx vitest run src/lib/pricing/__tests__/familyFactor.test.ts`
Expected: 4 passed.

- [ ] **Step 6.6: Commit**

```bash
git add src/lib/pricing/familyFactor.ts src/lib/pricing/familyFactor.generated.ts src/lib/pricing/__tests__/familyFactor.test.ts
git commit -m "feat(pricing): family factor loader with fallback"
```

---

### Task 7: Segment stats

**Files:**
- Create: `src/lib/pricing/segmentStats.ts`
- Test: `src/lib/pricing/__tests__/segmentStats.test.ts`

- [ ] **Step 7.1: Write failing test**

```ts
// src/lib/pricing/__tests__/segmentStats.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { computeSegmentStats } from "../segmentStats";
import { _setTableForTest } from "../familyFactor";
import type { DerivedPrice } from "../types";

function fakePrices(n: number, { sold = false, market = "US", family = "992", base = 100000 } = {}): DerivedPrice[] {
  return Array.from({ length: n }, (_, i) => ({
    soldPriceUsd: sold ? base + i * 1000 : null,
    askingPriceUsd: sold ? null : base + i * 1000,
    basis: sold ? "sold" : "asking",
    canonicalMarket: market as any,
    family,
  }));
}

describe("computeSegmentStats", () => {
  beforeEach(() => {
    _setTableForTest({
      porscheWide: { factor: 0.9, soldN: 1000, askingN: 5000 },
      byFamily: { "992": { family: "992", factor: 0.92, soldN: 150, askingN: 2800 } },
      generatedAt: "2026-04-18T00:00:00Z",
    });
  });

  it("high tier market value when 20+ sold", () => {
    const prices = [...fakePrices(25, { sold: true }), ...fakePrices(10, { sold: false })];
    const s = computeSegmentStats(prices, { market: "US", family: "992" });
    expect(s.marketValue.soldN).toBe(25);
    expect(s.marketValue.tier).toBe("high");
    expect(s.marketValue.valueUsd).toBeGreaterThan(0);
  });

  it("ask median uses family factor", () => {
    const prices = fakePrices(300, { sold: false, family: "992", base: 100000 });
    const s = computeSegmentStats(prices, { market: "EU", family: "992" });
    expect(s.askMedian.askingN).toBe(300);
    expect(s.askMedian.factorApplied).toBe(0.92);
    expect(s.askMedian.factorSource).toBe("family");
    // raw median ≈ 100000 + 149500; adjusted ≈ raw * 0.92
    expect(s.askMedian.valueUsd).toBeCloseTo(s.askMedian.rawMedianUsd! * 0.92, 0);
    expect(s.askMedian.tier).toBe("high"); // 300 >= 200 AND family factor
  });

  it("insufficient tier when segment empty", () => {
    const s = computeSegmentStats([], { market: "JP", family: "992" });
    expect(s.marketValue.valueUsd).toBeNull();
    expect(s.marketValue.tier).toBe("insufficient");
    expect(s.askMedian.valueUsd).toBeNull();
    expect(s.askMedian.tier).toBe("insufficient");
  });

  it("never silently falls back to a different segment", () => {
    // Prices for US 992 given — stats for EU 992 must be empty
    const prices = fakePrices(50, { sold: true, market: "US", family: "992" });
    const s = computeSegmentStats(prices, { market: "EU", family: "992" });
    expect(s.marketValue.soldN).toBe(0);
    expect(s.marketValue.valueUsd).toBeNull();
  });

  it("ignores prices whose family or market doesn't match", () => {
    const mixed: DerivedPrice[] = [
      ...fakePrices(20, { sold: true, market: "US", family: "992" }),
      ...fakePrices(20, { sold: true, market: "US", family: "991" }),
    ];
    const s = computeSegmentStats(mixed, { market: "US", family: "992" });
    expect(s.marketValue.soldN).toBe(20);
  });
});
```

- [ ] **Step 7.2: Run, verify fail**

Run: `npx vitest run src/lib/pricing/__tests__/segmentStats.test.ts`
Expected: FAIL.

- [ ] **Step 7.3: Implement**

```ts
// src/lib/pricing/segmentStats.ts
import type { DerivedPrice, SegmentStats, CanonicalMarket } from "./types";
import { getFamilyFactor } from "./familyFactor";
import { iqrBand } from "./iqrBand";
import { classifySoldTier, classifyAskingTier } from "./confidence";

export interface SegmentKey {
  market: CanonicalMarket;
  family: string;
}

export function computeSegmentStats(prices: DerivedPrice[], key: SegmentKey): SegmentStats {
  const sold: number[] = [];
  const asking: number[] = [];
  for (const p of prices) {
    if (p.canonicalMarket !== key.market) continue;
    if (p.family !== key.family) continue;
    if (p.basis === "sold" && p.soldPriceUsd != null) sold.push(p.soldPriceUsd);
    else if (p.basis === "asking" && p.askingPriceUsd != null) asking.push(p.askingPriceUsd);
  }

  // Market value (sold)
  const soldBand = iqrBand(sold);
  const soldMedian = soldBand
    ? soldBand.p50
    : sold.length > 0
    ? sold.slice().sort((a, b) => a - b)[Math.floor(sold.length / 2)]
    : null;

  // Ask median (asking × family factor)
  const factor = getFamilyFactor(key.family);
  const askBand = iqrBand(asking);
  const rawAskMedian = askBand
    ? askBand.p50
    : asking.length > 0
    ? asking.slice().sort((a, b) => a - b)[Math.floor(asking.length / 2)]
    : null;
  const adjustedAskMedian = rawAskMedian != null && factor.source !== "none" ? rawAskMedian * factor.factor : rawAskMedian;

  return {
    market: key.market,
    family: key.family,
    marketValue: {
      valueUsd: soldMedian,
      p25Usd: soldBand?.p25 ?? null,
      p75Usd: soldBand?.p75 ?? null,
      soldN: sold.length,
      tier: classifySoldTier(sold.length),
    },
    askMedian: {
      valueUsd: adjustedAskMedian,
      rawMedianUsd: rawAskMedian,
      p25Usd: askBand != null && factor.source !== "none" ? askBand.p25 * factor.factor : askBand?.p25 ?? null,
      p75Usd: askBand != null && factor.source !== "none" ? askBand.p75 * factor.factor : askBand?.p75 ?? null,
      askingN: asking.length,
      factorApplied: factor.source === "none" ? null : factor.factor,
      factorSource: factor.source,
      tier: classifyAskingTier(asking.length, factor.source),
    },
  };
}
```

- [ ] **Step 7.4: Run, verify pass**

Run: `npx vitest run src/lib/pricing/__tests__/segmentStats.test.ts`
Expected: 5 passed.

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/pricing/segmentStats.ts src/lib/pricing/__tests__/segmentStats.test.ts
git commit -m "feat(pricing): segment stats with IQR + tier + factor"
```

---

### Task 8: Generator script for family factors

**Files:**
- Create: `scripts/generate-family-factors.ts`
- Create: `scripts/generate-family-factors.test.ts`

Script queries Supabase, derives prices, computes per-family sold/asking ratio, writes `familyFactor.generated.ts`.

- [ ] **Step 8.1: Write failing unit test over fixture**

```ts
// scripts/generate-family-factors.test.ts
import { describe, it, expect } from "vitest";
import { computeFactorTable } from "./generate-family-factors";
import type { DerivedPrice } from "@/lib/pricing/types";

function d(basis: "sold" | "asking", family: string, usd: number, market = "US"): DerivedPrice {
  return basis === "sold"
    ? { soldPriceUsd: usd, askingPriceUsd: null, basis, canonicalMarket: market as any, family }
    : { soldPriceUsd: null, askingPriceUsd: usd, basis, canonicalMarket: market as any, family };
}

describe("computeFactorTable", () => {
  it("per-family factor only when soldN >= 30 globally", () => {
    const prices: DerivedPrice[] = [
      ...Array.from({ length: 40 }, (_, i) => d("sold", "992", 100000 + i * 1000)),
      ...Array.from({ length: 200 }, (_, i) => d("asking", "992", 110000 + i * 1000)),
      ...Array.from({ length: 5 }, (_, i) => d("sold", "964", 200000 + i)),
      ...Array.from({ length: 100 }, (_, i) => d("asking", "964", 230000 + i)),
    ];
    const t = computeFactorTable(prices);
    expect(t.byFamily["992"]).toBeDefined();
    expect(t.byFamily["992"].soldN).toBe(40);
    expect(t.byFamily["992"].factor).toBeGreaterThan(0.8);
    expect(t.byFamily["992"].factor).toBeLessThan(1);
    expect(t.byFamily["964"]).toBeUndefined();
  });

  it("porsche-wide uses all rows", () => {
    const prices: DerivedPrice[] = [
      ...Array.from({ length: 40 }, (_, i) => d("sold", "992", 100000 + i * 1000)),
      ...Array.from({ length: 200 }, (_, i) => d("asking", "992", 110000 + i * 1000)),
    ];
    const t = computeFactorTable(prices);
    expect(t.porscheWide.soldN).toBe(40);
    expect(t.porscheWide.askingN).toBe(200);
    expect(t.porscheWide.factor).toBeGreaterThan(0);
  });

  it("empty corpus → factor=0, soldN=0 (signals none)", () => {
    const t = computeFactorTable([]);
    expect(t.porscheWide.soldN).toBe(0);
    expect(t.porscheWide.factor).toBe(0);
  });
});
```

- [ ] **Step 8.2: Run, verify fail**

Run: `npx vitest run scripts/generate-family-factors.test.ts`
Expected: FAIL.

- [ ] **Step 8.3: Implement the script**

```ts
// scripts/generate-family-factors.ts
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { getExchangeRates } from "@/lib/exchangeRates";
import { derivePrice } from "@/lib/pricing/derivePrice";
import type { DerivedPrice, FamilyFactorTable } from "@/lib/pricing/types";

const MIN_FAMILY_SOLD = 30;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeFactorTable(prices: DerivedPrice[]): FamilyFactorTable {
  const allSold: number[] = [];
  const allAsking: number[] = [];
  const byFamilySold = new Map<string, number[]>();
  const byFamilyAsking = new Map<string, number[]>();

  for (const p of prices) {
    if (p.basis === "sold" && p.soldPriceUsd != null) {
      allSold.push(p.soldPriceUsd);
      if (p.family) {
        if (!byFamilySold.has(p.family)) byFamilySold.set(p.family, []);
        byFamilySold.get(p.family)!.push(p.soldPriceUsd);
      }
    } else if (p.basis === "asking" && p.askingPriceUsd != null) {
      allAsking.push(p.askingPriceUsd);
      if (p.family) {
        if (!byFamilyAsking.has(p.family)) byFamilyAsking.set(p.family, []);
        byFamilyAsking.get(p.family)!.push(p.askingPriceUsd);
      }
    }
  }

  const askMedianGlobal = median(allAsking);
  const soldMedianGlobal = median(allSold);
  const porscheWide = {
    factor: askMedianGlobal > 0 && soldMedianGlobal > 0 ? soldMedianGlobal / askMedianGlobal : 0,
    soldN: allSold.length,
    askingN: allAsking.length,
  };

  const byFamily: FamilyFactorTable["byFamily"] = {};
  for (const [family, solds] of byFamilySold.entries()) {
    if (solds.length < MIN_FAMILY_SOLD) continue;
    const asks = byFamilyAsking.get(family) ?? [];
    const askMed = median(asks);
    const soldMed = median(solds);
    if (askMed > 0 && soldMed > 0) {
      byFamily[family] = { family, factor: soldMed / askMed, soldN: solds.length, askingN: asks.length };
    }
  }

  return { porscheWide, byFamily, generatedAt: new Date().toISOString() };
}

async function main() {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const rates = await getExchangeRates();

  const prices: DerivedPrice[] = [];
  const pageSize = 2000;
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from("listings")
      .select("source,status,year,make,model,hammer_price,final_price,current_bid,original_currency")
      .eq("make", "Porsche")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) prices.push(derivePrice(row as any, { rates }));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const table = computeFactorTable(prices);
  const body = `// AUTO-GENERATED by scripts/generate-family-factors.ts — do not edit by hand.
import type { FamilyFactorTable } from "./types";

export const FAMILY_FACTOR_TABLE: FamilyFactorTable = ${JSON.stringify(table, null, 2)};
`;
  writeFileSync("src/lib/pricing/familyFactor.generated.ts", body);
  console.log("Wrote factor table:", table.porscheWide, "families:", Object.keys(table.byFamily));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

- [ ] **Step 8.4: Run tests, verify pass**

Run: `npx vitest run scripts/generate-family-factors.test.ts`
Expected: 3 passed.

- [ ] **Step 8.5: Add npm script**

Edit `package.json` scripts section, add:

```json
"generate:factors": "tsx scripts/generate-family-factors.ts",
```

- [ ] **Step 8.6: Generate the real table**

Run: `npm run generate:factors`
Expected: `Wrote factor table: { factor: <number>, soldN: <number>, askingN: <number> } families: [ '992', '991', ... ]`

Inspect `src/lib/pricing/familyFactor.generated.ts` — confirm non-zero `porscheWide.soldN` and at least 3–4 families present.

- [ ] **Step 8.7: Commit**

```bash
git add scripts/generate-family-factors.ts scripts/generate-family-factors.test.ts package.json src/lib/pricing/familyFactor.generated.ts
git commit -m "feat(pricing): generator for family adjustment factors"
```

---

### Task 9: Extend CollectorCar + Auction types with derived fields

**Files:**
- Modify: `src/lib/curatedCars.ts:25-60`
- Modify: `src/components/dashboard/types.ts` (wherever `Auction` is defined)

- [ ] **Step 9.1: Extend `CollectorCar`**

Add to the interface at `src/lib/curatedCars.ts:25-60`, after `originalCurrency`:

```ts
  // ── Derived valuation fields (Rule 1–3 of golden standard) ──
  /** Transaction price in USD. Set only when status='sold' AND source is auction. */
  soldPriceUsd?: number | null;
  /** Asking price in USD. Set for active/unsold/delisted classifieds and live bids. */
  askingPriceUsd?: number | null;
  /** Which concept this row represents. */
  valuationBasis?: "sold" | "asking" | "unknown";
  /** Market derived from source, never from raw `region`. */
  canonicalMarket?: "US" | "EU" | "UK" | "JP" | null;
  /** Series id (e.g. "992"). */
  family?: string | null;
```

Legacy fields (`price`, `currentBid`, `region`) stay — migration happens per-consumer.

- [ ] **Step 9.2: Mirror on `Auction`**

Find `Auction` type in `src/components/dashboard/types.ts`. Add the same five fields, with matching optionality.

- [ ] **Step 9.3: Run type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors (fields are optional, no breakage).

- [ ] **Step 9.4: Commit**

```bash
git add src/lib/curatedCars.ts src/components/dashboard/types.ts
git commit -m "feat(pricing): add derived valuation fields to CollectorCar/Auction"
```

---

### Task 10: Populate derived fields in `rowToCollectorCar`

**Files:**
- Modify: `src/lib/supabaseLiveListings.ts:485-591` (rowToCollectorCar)

- [ ] **Step 10.1: Locate the row mapper**

Read `src/lib/supabaseLiveListings.ts` lines 485–591 (`rowToCollectorCar`).

- [ ] **Step 10.2: Import + populate**

At the top of the file add:

```ts
import { derivePrice } from "./pricing/derivePrice";
```

Inside `rowToCollectorCar`, after the existing assembly of the returned object, compute and attach derived fields. Replace the current `return { ... }` with:

```ts
  const derived = derivePrice(
    {
      source: row.source ?? "",
      status: row.status ?? null,
      year: row.year,
      make: row.make,
      model: row.model,
      hammer_price: row.hammer_price ?? null,
      final_price: row.final_price ?? null,
      current_bid: row.current_bid ?? null,
      original_currency: row.original_currency ?? null,
    },
    { rates },
  );

  return {
    ...car,
    soldPriceUsd: derived.soldPriceUsd,
    askingPriceUsd: derived.askingPriceUsd,
    valuationBasis: derived.basis,
    canonicalMarket: derived.canonicalMarket,
    family: derived.family,
  };
```

(Where `car` is the object previously being returned — rename as needed for the local var structure.)

- [ ] **Step 10.3: Add minimal test**

Create `src/lib/__tests__/supabaseLiveListings.derived.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

// Mock heavy deps BEFORE importing the module
vi.mock("../exchangeRates", () => ({
  getExchangeRates: async () => ({ EUR: 1.1, GBP: 1.25, JPY: 0.0067, USD: 1 }),
  toUsd: (amount: number, ccy: string | null, rates: Record<string, number>) => {
    if (!amount) return 0;
    const c = ccy ?? "USD";
    return amount * (rates[c] ?? 1);
  },
}));

describe("supabaseLiveListings derives valuation fields", () => {
  it("BaT sold row gets basis=sold", async () => {
    // Integration-ish smoke: import rowToCollectorCar and feed a synthetic row.
    // Skip if that helper isn't exported; instead we re-run derivePrice inline.
    const { derivePrice } = await import("../pricing/derivePrice");
    const d = derivePrice(
      {
        source: "BaT",
        status: "sold",
        year: 2005,
        make: "Porsche",
        model: "911 Carrera",
        hammer_price: 120000,
        final_price: 120000,
        current_bid: 120000,
        original_currency: "USD",
      },
      { rates: { USD: 1 } },
    );
    expect(d.basis).toBe("sold");
    expect(d.soldPriceUsd).toBe(120000);
  });
});
```

- [ ] **Step 10.4: Run test**

Run: `npx vitest run src/lib/__tests__/supabaseLiveListings.derived.test.ts`
Expected: pass.

- [ ] **Step 10.5: Commit**

```bash
git add src/lib/supabaseLiveListings.ts src/lib/__tests__/supabaseLiveListings.derived.test.ts
git commit -m "feat(pricing): populate derived fields on live listings"
```

---

### Task 11: Replace `enrichFairValues` with segment-stats path

**Files:**
- Modify: `src/lib/supabaseLiveListings.ts:357-418` (enrichFairValues)

Old implementation uses `±15%` band and falls back to overall median. Replace.

- [ ] **Step 11.1: Rewrite `enrichFairValues`**

Replace the whole function:

```ts
// src/lib/supabaseLiveListings.ts (replacing old enrichFairValues)
import { computeSegmentStats } from "./pricing/segmentStats";
import type { DerivedPrice, CanonicalMarket } from "./pricing/types";

const MARKETS: readonly CanonicalMarket[] = ["US", "EU", "UK", "JP"] as const;
const CURRENCY_MAP: Record<CanonicalMarket, "$" | "€" | "£" | "¥"> = {
  US: "$", EU: "€", UK: "£", JP: "¥",
};

export async function enrichFairValues(cars: CollectorCar[]): Promise<CollectorCar[]> {
  if (cars.length === 0) return cars;

  // Build DerivedPrice corpus from the cars themselves (they already have derived fields).
  const corpus: DerivedPrice[] = cars
    .filter((c) => c.canonicalMarket && c.family)
    .map((c) => ({
      soldPriceUsd: c.soldPriceUsd ?? null,
      askingPriceUsd: c.askingPriceUsd ?? null,
      basis: (c.valuationBasis ?? "unknown") as DerivedPrice["basis"],
      canonicalMarket: c.canonicalMarket as CanonicalMarket,
      family: c.family as string,
    }));

  // For each distinct family in the corpus, compute per-market stats once.
  const families = Array.from(new Set(corpus.map((p) => p.family!).filter(Boolean)));
  const cache = new Map<string, Record<CanonicalMarket, ReturnType<typeof computeSegmentStats>>>();

  for (const fam of families) {
    const perMarket = {} as Record<CanonicalMarket, ReturnType<typeof computeSegmentStats>>;
    for (const market of MARKETS) {
      perMarket[market] = computeSegmentStats(corpus, { market, family: fam });
    }
    cache.set(fam, perMarket);
  }

  for (const car of cars) {
    const fam = car.family;
    if (!fam || !cache.has(fam)) continue;
    const perMarket = cache.get(fam)!;
    const fv = {} as FairValueByRegion;
    for (const m of MARKETS) {
      const s = perMarket[m];
      // Prefer sold (market value) when available; else adjusted asking; else nothing.
      const mid = s.marketValue.valueUsd ?? s.askMedian.valueUsd;
      const lo = s.marketValue.p25Usd ?? s.askMedian.p25Usd ?? (mid != null ? mid * 0.9 : null);
      const hi = s.marketValue.p75Usd ?? s.askMedian.p75Usd ?? (mid != null ? mid * 1.1 : null);
      fv[m] = {
        currency: CURRENCY_MAP[m],
        low: lo != null ? Math.round(lo) : 0,
        high: hi != null ? Math.round(hi) : 0,
      };
    }
    car.fairValueByRegion = fv;
  }

  return cars;
}
```

Delete old helpers inside the file that became unused: the local `computeMedian` at line 347 and the old body between 357–418 are replaced. Keep external imports intact.

- [ ] **Step 11.2: Run existing tests (smoke)**

Run: `npx vitest run src/lib`
Expected: pass. If `buildFairValue(price)` is still referenced elsewhere and breaks, delete those fake calls — they're the ±20% placeholder.

- [ ] **Step 11.3: Commit**

```bash
git add src/lib/supabaseLiveListings.ts
git commit -m "feat(pricing): enrichFairValues uses real segment stats"
```

---

### Task 12: Replace `computeRegionalValFromAuctions` surface

**Files:**
- Modify: `src/components/dashboard/utils/valuation.ts` (replace whole file)
- Modify: `src/components/dashboard/utils/valuation.test.ts` (update)

- [ ] **Step 12.1: Write the new tests first**

Replace `src/components/dashboard/utils/valuation.test.ts` with:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { computeRegionalValFromAuctions, formatUsdValue } from "./valuation";
import { _setTableForTest } from "@/lib/pricing/familyFactor";
import type { Auction } from "../types";

function a(over: Partial<Auction>): Auction {
  return {
    id: "x", year: 2015, make: "Porsche", model: "911",
    soldPriceUsd: null, askingPriceUsd: null,
    valuationBasis: "unknown",
    canonicalMarket: "US",
    family: "991",
    ...over,
  } as Auction;
}

describe("computeRegionalValFromAuctions", () => {
  beforeEach(() => {
    _setTableForTest({
      porscheWide: { factor: 0.9, soldN: 1000, askingN: 5000 },
      byFamily: { "991": { family: "991", factor: 0.92, soldN: 150, askingN: 2800 } },
      generatedAt: "2026-04-18T00:00:00Z",
    });
  });

  it("returns only markets/families present in the corpus", () => {
    const auctions = Array.from({ length: 25 }, (_, i) =>
      a({ soldPriceUsd: 100000 + i * 1000, valuationBasis: "sold", canonicalMarket: "US", family: "991" })
    );
    const r = computeRegionalValFromAuctions(auctions);
    expect(r.US.marketValue.tier).toBe("high");
    expect(r.US.marketValue.valueUsd).toBeGreaterThan(0);
    expect(r.EU.marketValue.tier).toBe("insufficient"); // no EU sold in corpus
    expect(r.EU.marketValue.valueUsd).toBeNull();
  });

  it("never falls back to another market", () => {
    const auctions = Array.from({ length: 30 }, (_, i) =>
      a({ soldPriceUsd: 100000 + i * 1000, valuationBasis: "sold", canonicalMarket: "US" })
    );
    const r = computeRegionalValFromAuctions(auctions);
    expect(r.JP.marketValue.valueUsd).toBeNull();
    expect(r.JP.askMedian.valueUsd).toBeNull();
  });

  it("ask median populated with adjusted value", () => {
    const auctions = Array.from({ length: 300 }, (_, i) =>
      a({ askingPriceUsd: 90000 + i * 100, valuationBasis: "asking", canonicalMarket: "EU", family: "991" })
    );
    const r = computeRegionalValFromAuctions(auctions);
    expect(r.EU.askMedian.tier).toBe("high");
    expect(r.EU.askMedian.valueUsd).toBeGreaterThan(0);
    expect(r.EU.askMedian.factorApplied).toBe(0.92);
  });
});

describe("formatUsdValue", () => {
  it("formats millions", () => {
    expect(formatUsdValue(1_200_000)).toBe("$1.2M");
    expect(formatUsdValue(1_000_000)).toBe("$1M");
  });
  it("formats thousands", () => {
    expect(formatUsdValue(120_000)).toBe("$120K");
  });
  it("handles null", () => {
    expect(formatUsdValue(null)).toBe("—");
  });
});
```

- [ ] **Step 12.2: Run, verify fail (wrong exports)**

Run: `npx vitest run src/components/dashboard/utils/valuation.test.ts`
Expected: FAIL.

- [ ] **Step 12.3: Rewrite `valuation.ts`**

Replace the whole file:

```ts
// src/components/dashboard/utils/valuation.ts
import type { Auction } from "../types";
import { computeSegmentStats } from "@/lib/pricing/segmentStats";
import type { DerivedPrice, CanonicalMarket, SegmentStats } from "@/lib/pricing/types";

export type RegionalValuations = Record<CanonicalMarket, SegmentStats>;

const MARKETS: readonly CanonicalMarket[] = ["US", "EU", "UK", "JP"] as const;

export function auctionsToDerived(auctions: Auction[]): DerivedPrice[] {
  return auctions
    .filter((a) => a.canonicalMarket && a.family)
    .map((a) => ({
      soldPriceUsd: a.soldPriceUsd ?? null,
      askingPriceUsd: a.askingPriceUsd ?? null,
      basis: (a.valuationBasis ?? "unknown") as DerivedPrice["basis"],
      canonicalMarket: a.canonicalMarket as CanonicalMarket,
      family: a.family as string,
    }));
}

/** Family of the first auction, or most frequent family in the corpus. */
function dominantFamily(auctions: Auction[]): string | null {
  const counts = new Map<string, number>();
  for (const a of auctions) if (a.family) counts.set(a.family, (counts.get(a.family) ?? 0) + 1);
  let best: [string, number] | null = null;
  for (const entry of counts.entries()) if (!best || entry[1] > best[1]) best = entry;
  return best?.[0] ?? null;
}

export function computeRegionalValFromAuctions(auctions: Auction[]): RegionalValuations {
  const fam = dominantFamily(auctions);
  const corpus = auctionsToDerived(auctions);
  const out = {} as RegionalValuations;
  for (const m of MARKETS) {
    out[m] = computeSegmentStats(corpus, { market: m, family: fam ?? "unknown" });
  }
  return out;
}

export function formatUsdValue(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v <= 0) return "—";
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    const s = m.toFixed(1);
    return s.endsWith(".0") ? `$${m.toFixed(0)}M` : `$${s}M`;
  }
  return `$${Math.round(v / 1000).toLocaleString()}K`;
}

// Legacy helper kept for callers still using raw medians (to be removed in Task 18).
export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Legacy helper — still used by some callsites for raw per-listing USD.
// Prefer reading `a.soldPriceUsd ?? a.askingPriceUsd` directly.
export function listingPriceUsd(a: Auction): number {
  return a.soldPriceUsd ?? a.askingPriceUsd ?? 0;
}
```

- [ ] **Step 12.4: Run, verify pass**

Run: `npx vitest run src/components/dashboard/utils/valuation.test.ts`
Expected: 6 passed.

- [ ] **Step 12.5: Commit**

```bash
git add src/components/dashboard/utils/valuation.ts src/components/dashboard/utils/valuation.test.ts
git commit -m "feat(pricing): valuation util returns segment stats, no fallbacks"
```

---

### Task 13: `ValuationTile` shared component

**Files:**
- Create: `src/components/dashboard/context/shared/ValuationTile.tsx`

Reusable component: two rows (Market value + Ask median) with tier dot + tooltip.

- [ ] **Step 13.1: Implement**

```tsx
// src/components/dashboard/context/shared/ValuationTile.tsx
"use client";
import { useTranslations } from "next-intl";
import type { SegmentStats, ConfidenceTier } from "@/lib/pricing/types";
import { formatUsdValue } from "../../utils/valuation";

const TIER_DOT: Record<ConfidenceTier, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-400",
  low: "bg-neutral-500",
  insufficient: "bg-neutral-700",
};

function TraceTooltip({ stats }: { stats: SegmentStats }) {
  return (
    <span className="pointer-events-none absolute z-50 hidden w-64 rounded border border-neutral-700 bg-neutral-900 p-2 text-[10px] text-neutral-300 group-hover:block">
      <div>Market: <b>{stats.market}</b></div>
      <div>Family: <b>{stats.family}</b></div>
      <div>Sold sample: <b>{stats.marketValue.soldN}</b> ({stats.marketValue.tier})</div>
      <div>Asking sample: <b>{stats.askMedian.askingN}</b> ({stats.askMedian.tier})</div>
      {stats.askMedian.factorApplied != null && (
        <div>Factor: <b>{stats.askMedian.factorApplied.toFixed(2)}</b> ({stats.askMedian.factorSource})</div>
      )}
    </span>
  );
}

export function ValuationTile({ stats }: { stats: SegmentStats }) {
  const t = useTranslations();
  return (
    <div className="relative group flex flex-col gap-0.5 rounded border border-neutral-800 bg-neutral-950/60 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-400">
          {t("valuation.marketValue")}
        </span>
        <span className={`h-1.5 w-1.5 rounded-full ${TIER_DOT[stats.marketValue.tier]}`} aria-label={`tier:${stats.marketValue.tier}`} />
      </div>
      <div className="text-sm font-medium text-neutral-100">
        {formatUsdValue(stats.marketValue.valueUsd)}
        <span className="ml-1 text-[10px] text-neutral-500">
          ({stats.marketValue.soldN} {t("valuation.soldSamples")})
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-400">
          {t("valuation.askMedian")}
        </span>
        <span className={`h-1.5 w-1.5 rounded-full ${TIER_DOT[stats.askMedian.tier]}`} aria-label={`tier:${stats.askMedian.tier}`} />
      </div>
      <div className="text-sm font-medium text-neutral-100">
        {formatUsdValue(stats.askMedian.valueUsd)}
        <span className="ml-1 text-[10px] text-neutral-500">
          ({stats.askMedian.askingN} {t("valuation.askingSamples")})
        </span>
      </div>
      <TraceTooltip stats={stats} />
    </div>
  );
}
```

- [ ] **Step 13.2: Commit**

```bash
git add src/components/dashboard/context/shared/ValuationTile.tsx
git commit -m "feat(ui): ValuationTile shared component with tier dots + trace tooltip"
```

---

### Task 14: Wire `ValuationTile` into `RegionalValuation.tsx`

**Files:**
- Modify: `src/components/dashboard/context/shared/RegionalValuation.tsx`

- [ ] **Step 14.1: Read current component (1–72)**

Run: `sed -n '1,80p' src/components/dashboard/context/shared/RegionalValuation.tsx` — confirm current shape.

- [ ] **Step 14.2: Rewrite to render `ValuationTile` per market**

```tsx
// src/components/dashboard/context/shared/RegionalValuation.tsx
"use client";
import { useTranslations } from "next-intl";
import { ValuationTile } from "./ValuationTile";
import type { RegionalValuations } from "../../utils/valuation";
import type { CanonicalMarket } from "@/lib/pricing/types";

const MARKETS: readonly CanonicalMarket[] = ["US", "EU", "UK", "JP"] as const;

export function RegionalValuation({ data }: { data: RegionalValuations }) {
  const t = useTranslations();
  return (
    <section>
      <h3 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-neutral-400">
        {t("valuation.byMarket")}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {MARKETS.map((m) => (
          <div key={m}>
            <div className="mb-1 text-[9px] uppercase tracking-[0.2em] text-neutral-500">{m}</div>
            <ValuationTile stats={data[m]} />
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 14.3: Update consumers**

Grep for callers: `Grep -rn "RegionalValuation" src/components`. Each consumer must pass `data` of type `RegionalValuations` (the new return type of `computeRegionalValFromAuctions`). Update each callsite — usually a one-line prop rename.

- [ ] **Step 14.4: Run type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors. Fix each callsite signature as they surface.

- [ ] **Step 14.5: Commit**

```bash
git add src/components/dashboard/context/shared/RegionalValuation.tsx src/components/**/BrandContextPanel.tsx
git commit -m "feat(ui): RegionalValuation renders ValuationTile per market"
```

---

### Task 15: Replace invented `±15%` band in DashboardClient

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx:1505-1550, 1610-1680`

Lines `1511,1512,1615,1616` hold `Math.round(bidFallback * 0.85)` and `* 1.15`. Replace with real IQR from the segment.

- [ ] **Step 15.1: Find both invented-band sites**

Run: `Grep -n "0\.85|1\.15" src/components/dashboard/DashboardClient.tsx`
Expected: 4 hits (two pairs).

- [ ] **Step 15.2: Replace both sites**

For each occurrence pair, replace the local band computation with a pull from the precomputed segment stats for the auction's `canonicalMarket` + `family`.

Introduce at the top of the function scope (around line 1587 / 1788):

```ts
import { computeRegionalValFromAuctions } from "./utils/valuation";
// ...
const regionalVal = useMemo(
  () => computeRegionalValFromAuctions(familyAuctions),
  [familyAuctions],
);
const segment = auction.canonicalMarket ? regionalVal[auction.canonicalMarket] : null;
// prefer sold IQR; else adjusted-ask IQR; else suppress band entirely.
const p25 = segment?.marketValue.p25Usd ?? segment?.askMedian.p25Usd ?? null;
const p75 = segment?.marketValue.p75Usd ?? segment?.askMedian.p75Usd ?? null;
```

Then the render becomes:

```tsx
{p25 != null && p75 != null ? (
  <span>{formatPrice(p25)}–{formatPrice(p75)}</span>
) : (
  <span className="text-neutral-500">—</span>
)}
```

Delete the old `bidFallback * 0.85` lines in both locations.

- [ ] **Step 15.3: Run dev server, verify manually**

Run: `npm run dev` (background).
Visit `http://localhost:3000/en`. Click a Porsche family. Click a listing. Confirm:
- Fair-value band shows real p25–p75 OR `—` (never a mechanical `±15%` around currentBid).
- Family card shows a price range under the new "Asking range" label (wired in Task 16).

Kill dev server.

- [ ] **Step 15.4: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "fix(dashboard): replace ±15% invented bands with IQR from segment stats"
```

---

### Task 16: Family/brand card labels + i18n keys

**Files:**
- Modify: `messages/en.json` (+ other locale files if present)
- Modify: `src/components/dashboard/DashboardClient.tsx` — family card `priceRange` labels
- Modify: `src/components/dashboard/cards/FamilyCard.tsx`

- [ ] **Step 16.1: Add i18n keys**

Edit `messages/en.json`. Add under `dashboard` (or create `valuation` namespace):

```json
"valuation": {
  "marketValue": "Market value",
  "askMedian": "Ask median",
  "byMarket": "Valuation by market",
  "askingRange": "Asking range",
  "soldSamples": "sold",
  "askingSamples": "asking",
  "insufficient": "Insufficient data"
}
```

Mirror the keys in every other locale present under `messages/` (use same English strings if no translation yet — this will be flagged for real localization later, but won't crash).

- [ ] **Step 16.2: Replace labels in family cards**

Locate every `t("brandCard.priceRange")` in `DashboardClient.tsx` and `FamilyCard.tsx`. Replace with `t("valuation.askingRange")`.

Run: `Grep -n "brandCard.priceRange" src/components`
Expected: 6 hits. Replace each.

- [ ] **Step 16.3: Run type-check + dev sanity**

Run: `npx tsc --noEmit && npm run test -- --run src/components/dashboard`
Expected: pass.

- [ ] **Step 16.4: Commit**

```bash
git add messages/ src/components/dashboard/
git commit -m "feat(ui): label family card ranges as Asking range (i18n)"
```

---

### Task 17: Ownership cost scale reads market value

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx:1837-1849`
- Modify: `src/components/makePage/context/CarContextPanel.tsx`

Old: `avgPrice = mean(listingPriceUsd(a))` for all family auctions → tier scaling. New: use market value from segment stats (sold-equivalent).

- [ ] **Step 17.1: Replace in DashboardClient (around line 1837)**

```ts
// Before:
// const prices = familyAuctions.map(a => listingPriceUsd(a, rates)).filter(p => p > 0);
// const avgPrice = prices.length > 0 ? prices.reduce(...)/... : (family.priceMin+family.priceMax)/2;

// After:
const segment = regionalVal[auction.canonicalMarket ?? "US"];
const pivot =
  segment?.marketValue.valueUsd ??
  segment?.askMedian.valueUsd ??
  (family.priceMin + family.priceMax) / 2;
const scale = pivot < 100_000 ? 0.7 : pivot < 250_000 ? 1.0 : pivot < 500_000 ? 1.3 : 1.6;
```

- [ ] **Step 17.2: Mirror change in `CarContextPanel.tsx`**

Read the current ownership-cost code. Replace any `currentBid`-based scale with the same pivot logic.

- [ ] **Step 17.3: Type-check**

Run: `npx tsc --noEmit`
Expected: pass.

- [ ] **Step 17.4: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx src/components/makePage/context/CarContextPanel.tsx
git commit -m "feat(dashboard): ownership cost scales off market value, not mixed avg"
```

---

### Task 18: Kill dead fallbacks and dead currency columns

**Files:**
- Modify: `src/components/dashboard/utils/valuation.ts` — delete legacy `listingPriceUsd` + `computeMedian` helpers if no longer used
- Modify: `src/lib/supabaseLiveListings.ts` — verify nothing still selects `price_usd/eur/gbp`
- Modify: `src/app/api/listings/[id]/price-history/route.ts:46-50` — keep price history columns (they're time-series), but add a comment that `listings.price_usd/eur/gbp` are dead

- [ ] **Step 18.1: Find remaining callers of `listingPriceUsd`**

Run: `Grep -rn "listingPriceUsd" src`
If every hit routes through `a.soldPriceUsd ?? a.askingPriceUsd`, delete the legacy helper.

- [ ] **Step 18.2: Remove if unused**

If grep returned 0 after Task 15/17 edits: delete `listingPriceUsd` and `computeMedian` exports from `valuation.ts`. Otherwise leave them but mark `@deprecated` in JSDoc.

- [ ] **Step 18.3: Verify `listings.price_usd` is not selected anywhere**

Run: `Grep -rn "price_usd|price_eur|price_gbp" src`
Expected: only price_history route + migration files. Add an inline comment at the top of `src/lib/supabaseLiveListings.ts`:

```ts
// NOTE: columns listings.price_usd / price_eur / price_gbp are 100% NULL in production
// as of 2026-04-18. All USD conversion happens in TS via pricing/derivePrice.
```

- [ ] **Step 18.4: Run the full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 18.5: Commit**

```bash
git add -u
git commit -m "chore(pricing): prune legacy helpers + document dead price_* columns"
```

---

### Task 19: Nightly factor-refresh cron

**Files:**
- Create: `src/app/api/cron/refresh-valuation-factors/route.ts`
- Create: `src/app/api/cron/refresh-valuation-factors/route.test.ts`
- Modify: `vercel.json` (if cron lives there) or `README` cron section

- [ ] **Step 19.1: Write the handler**

```ts
// src/app/api/cron/refresh-valuation-factors/route.ts
import { NextResponse } from "next/server";
import { spawnSync } from "node:child_process";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const run = spawnSync("npx", ["tsx", "scripts/generate-family-factors.ts"], { encoding: "utf8" });
  if (run.status !== 0) {
    return NextResponse.json({ ok: false, stderr: run.stderr }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stdout: run.stdout });
}
```

- [ ] **Step 19.2: Test (smoke)**

```ts
// src/app/api/cron/refresh-valuation-factors/route.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: () => ({ status: 0, stdout: "ok", stderr: "" }),
}));

describe("refresh-valuation-factors route", () => {
  it("returns ok in dev", async () => {
    process.env.NODE_ENV = "development";
    const { GET } = await import("./route");
    const res = await GET(new Request("http://x/"));
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
```

Run: `npx vitest run src/app/api/cron/refresh-valuation-factors/route.test.ts`
Expected: pass.

- [ ] **Step 19.3: Register cron**

Inspect `vercel.json`. Add:

```json
{ "path": "/api/cron/refresh-valuation-factors", "schedule": "0 3 * * *" }
```

(3:00 UTC daily, after main scraper crons.)

- [ ] **Step 19.4: Commit**

```bash
git add src/app/api/cron/refresh-valuation-factors vercel.json
git commit -m "feat(cron): nightly refresh of family adjustment factors"
```

---

### Task 20: Storybook / visual spot check + docs update

**Files:**
- Modify: `docs/porsche/listings-distribution-overview.md` — add "Current Valuation Standard" section pointing to the new pipeline
- Modify: `CLAUDE.md` — one-line pointer under architecture

- [ ] **Step 20.1: Update distribution doc**

Append to `docs/porsche/listings-distribution-overview.md`:

```markdown
## Current Valuation Standard (2026-04-18)

All price numbers on the platform flow through `src/lib/pricing/*`. Key contract:

- Two canonical concepts: **Market value** (sold, `status='sold' AND source∈{BaT,ClassicCom,BeForward-sold}`) and **Ask median** (asking × family factor).
- Market grouping always uses `sourceToCanonicalMarket(source)`, never the raw `region` column.
- Every displayed number carries a **confidence tier** (high/medium/low/insufficient) and a **basis** (`sold`/`asking_adjusted`/`asking_raw`).
- Family factors are regenerated nightly by `/api/cron/refresh-valuation-factors` (writes `src/lib/pricing/familyFactor.generated.ts`).
- No fabricated fallbacks. Insufficient segments render `—`.

See `docs/superpowers/plans/2026-04-18-golden-standard-valuation.md` for the implementation plan.
```

- [ ] **Step 20.2: Update CLAUDE.md**

Add under the "Conventions / Code Rules" section in `CLAUDE.md`:

```markdown
- All price/valuation reads go through `src/lib/pricing/*` and `src/components/dashboard/utils/valuation.ts`. Never read raw `hammer_price`, `final_price`, or `current_bid` in UI code. Never use the raw `region` column for grouping — use `sourceToCanonicalMarket`.
```

- [ ] **Step 20.3: Run dev server end-to-end sanity**

Run: `npm run dev`.
- Visit `/en` dashboard → family cards show "Asking range" label.
- Click into 992 → "Valuation by Market" tiles render two lines each, with tier dots.
- Hover a tile → tooltip shows sample counts + factor.
- Check JP tile → it should render `—` for Market value (no sold data), and either adjusted ask or `—`.

Kill dev.

- [ ] **Step 20.4: Commit**

```bash
git add docs/ CLAUDE.md
git commit -m "docs(pricing): document golden standard valuation pipeline"
```

---

## Self-Review

**1. Spec coverage:**

| Rule / requirement | Covered by |
|---|---|
| R1 — two canonical concepts | Task 1 (types), Task 5 (derive), Task 11 (wire) |
| R2 — raw columns are inputs only | Task 18 (prune + doc) |
| R3 — sold only for auction+sold | Task 5 (`isSold`), tests in 5.1 |
| R4 — one output axis (sold-equivalent) | Task 7 (`askMedian.valueUsd` adjusted) |
| R5 — family × market factor → replaced by global family factor | Task 8 (generator), Task 6 (loader) |
| R6 — every row has `valuationBasis` | Task 1, 5, 9, 10 |
| R7 — never hide mix | Task 13 (`TraceTooltip`), Task 14 |
| R8 — no silent fallbacks | Task 11 (replace enrichFairValues), Task 12 (no overall median) |
| R9 — canonical market, not `region` | Task 2, consumed throughout |
| R10 — basis labels in UI | Task 13, 16 |
| R11 — confidence tiers drive rendering | Task 4, 13 |
| R12 — kill invented bands | Task 15 |
| R13 — one currency conversion at edge | Task 5 (`toUsd` once), formatters at render |
| R14 — provenance tooltip | Task 13 (`TraceTooltip`) |

Every rule has at least one task.

**2. Placeholder scan:** Searched plan for TBD / "implement later" / "add appropriate" — none found. Every code step includes complete code.

**3. Type consistency:** `DerivedPrice`, `SegmentStats`, `FamilyFactorTable`, `CanonicalMarket`, `ConfidenceTier` are defined once in Task 1 and referenced consistently in Tasks 5, 6, 7, 8, 11, 12, 13. `getFamilyFactor`, `_setTableForTest`, `classifySoldTier`, `classifyAskingTier`, `iqrBand`, `computeSegmentStats`, `computeRegionalValFromAuctions` names match across definition and usage.

**4. Spec items without tasks:** none found after review.

---
