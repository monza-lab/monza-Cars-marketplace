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
    const prices = fakePrices(300, { sold: false, market: "EU", family: "992", base: 100000 });
    const s = computeSegmentStats(prices, { market: "EU", family: "992" });
    expect(s.askMedian.askingN).toBe(300);
    expect(s.askMedian.factorApplied).toBe(0.92);
    expect(s.askMedian.factorSource).toBe("family");
    expect(s.askMedian.valueUsd).toBeCloseTo(s.askMedian.rawMedianUsd! * 0.92, 0);
    expect(s.askMedian.tier).toBe("high");
  });

  it("insufficient tier when segment empty", () => {
    const s = computeSegmentStats([], { market: "JP", family: "992" });
    expect(s.marketValue.valueUsd).toBeNull();
    expect(s.marketValue.tier).toBe("insufficient");
    expect(s.askMedian.valueUsd).toBeNull();
    expect(s.askMedian.tier).toBe("insufficient");
  });

  it("never silently falls back to a different segment", () => {
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
