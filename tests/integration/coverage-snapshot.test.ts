import { describe, expect, it } from "vitest";

import { summarizeCoverageRows } from "../../scripts/coverage-snapshot";

describe("summarizeCoverageRows", () => {
  it("flags a market with zero active rows even when rows exist historically", () => {
    const result = summarizeCoverageRows([
      {
        source: "AutoTrader",
        market: "UK",
        active: 0,
        total: 4687,
        pricedPct: null,
        imagePct: null,
      },
      {
        source: "AutoScout24",
        market: "EU",
        active: 6830,
        total: 32388,
        pricedPct: 100,
        imagePct: 99.4,
      },
    ]);

    expect(result.marketAlerts).toContainEqual({
      market: "UK",
      severity: "critical",
      message: "UK has historical rows but zero active coverage",
    });
  });
});
