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
    expect(t.byFamily["992"].factor).toBeGreaterThan(0.5);
    expect(t.byFamily["992"].factor).toBeLessThan(0.7);
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
