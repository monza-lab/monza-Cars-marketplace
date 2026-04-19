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
