import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("scraper dashboard monitoring inventory", () => {
  it("renders the AutoTrader delist job that writes monitoring records", () => {
    const source = readFileSync(
      "src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx",
      "utf8",
    );

    expect(source.match(/"autotrader-delist-check"/g)).toHaveLength(4);
    expect(source).toContain('"autotrader-delist-check": "AutoTrader Delist Check"');
    expect(source).toContain('"autotrader-delist-check": "Windows Task"');
  });
});
