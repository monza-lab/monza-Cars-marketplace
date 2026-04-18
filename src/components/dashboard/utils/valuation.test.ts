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
    expect(r.EU.marketValue.tier).toBe("insufficient");
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
