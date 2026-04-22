import { describe, expect, it } from "vitest";
import { aggregateRegionalValuationByFamily, isRegionalValByFamily } from "./dashboardValuationCache";

describe("dashboard valuation cache aggregation", () => {
  it("groups segment stats by family and keeps all market buckets", () => {
    const payload = aggregateRegionalValuationByFamily([
      {
        soldPriceUsd: 300000,
        askingPriceUsd: null,
        basis: "sold",
        canonicalMarket: "US",
        family: "992",
      },
      {
        soldPriceUsd: null,
        askingPriceUsd: 285000,
        basis: "asking",
        canonicalMarket: "EU",
        family: "992",
      },
      {
        soldPriceUsd: 330000,
        askingPriceUsd: null,
        basis: "sold",
        canonicalMarket: "US",
        family: "991",
      },
    ]);

    expect(Object.keys(payload).sort()).toEqual(["991", "992"]);
    expect(payload["992"]).toHaveProperty("US");
    expect(payload["992"]).toHaveProperty("EU");
    expect(payload["992"]).toHaveProperty("UK");
    expect(payload["992"]).toHaveProperty("JP");
    expect(payload["991"]).toHaveProperty("US");
  });

  it("rejects malformed cache payloads", () => {
    expect(isRegionalValByFamily({})).toBe(false);
    expect(isRegionalValByFamily({ "992": { US: null } })).toBe(false);
  });
});
