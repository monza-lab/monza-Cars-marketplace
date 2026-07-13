import { describe, expect, it } from "vitest";

import { computeRankingVariant } from "./rankingEnrichment";

describe("ranking variant enrichment", () => {
  it.each([
    [2019, "911 Speedster", "Speedster", "2019 Porsche 911 Speedster", "991:speedster"],
    [1989, "911 Carrera 3.2", "WTL", "1989 Porsche 911 Carrera 3.2 WTL", "g-model:carrera-3.2-wtl"],
    [1993, "911 Turbo", "WLS", "1993 Porsche 911 Turbo WLS", "964:turbo-wls"],
    [1998, "911 Turbo S", "WLS II", "1998 Porsche 911 Turbo S WLS II", "993:turbo-wls-2"],
  ])("maps %s %s to a canonical ranking variant", (year, model, trim, title, expected) => {
    expect(computeRankingVariant({ year, make: "Porsche", model, trim, title })).toBe(expected);
  });

  it("falls back to the canonical series when the variant is not recognized", () => {
    expect(computeRankingVariant({
      year: 2019,
      make: "Porsche",
      model: "911 Uncatalogued Commission",
      trim: null,
      title: "2019 Porsche 911 Uncatalogued Commission",
    })).toBe("992:__other");
  });
});
