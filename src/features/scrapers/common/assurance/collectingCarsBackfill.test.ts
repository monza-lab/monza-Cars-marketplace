import { describe, expect, it } from "vitest";

import { collectingCarsDiscoveryConfig as ferrariConfig } from "../../ferrari_collector/discover";
import { collectingCarsDiscoveryConfig as porscheConfig } from "../../porsche_collector/discover";

describe.each([
  ["Porsche", porscheConfig],
  ["Ferrari", ferrariConfig],
] as const)("%s CollectingCars backfill discovery", (make, configFor) => {
  it("uses the current sold /buy route and accepts /for-sale detail URLs", () => {
    const config = configFor(make.toLowerCase());

    expect(config.candidates[0]).toBe(
      `https://collectingcars.com/buy?query=${make.toLowerCase()}&stage=sold`,
    );
    expect(config.pathPrefixes).toContain("/for-sale/");
  });
});
