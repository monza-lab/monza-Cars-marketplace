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

  it("includes every assurance source and alerts on unregistered database sources", () => {
    const result = summarizeCoverageRows([
      {
        source: "UnregisteredMarket",
        market: "UNKNOWN",
        active: 3,
        total: 3,
        pricedPct: 100,
        imagePct: 100,
      },
    ]);

    expect(result.rows.filter((row) => row.source !== "UnregisteredMarket")).toHaveLength(8);
    expect(result.rows).toContainEqual(expect.objectContaining({ source: "BaT", active: 0, total: 0 }));
    expect(result.sourceAlerts).toContainEqual({
      source: "UnregisteredMarket",
      severity: "critical",
      message: "UnregisteredMarket is present in listings but absent from the assurance manifest",
    });
  });
});
