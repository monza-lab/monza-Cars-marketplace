import { describe, expect, it } from "vitest";

import {
  buildHomepageRankingContext,
  buildHomepageRankingContextFromSupply,
  compareHomepageOrdering,
  rankHomepageListings,
  type HomepageRankingListing,
} from "./homepageRanking";

function listing(
  id: string,
  overrides: Partial<HomepageRankingListing> = {},
): HomepageRankingListing {
  return {
    id,
    year: 2019,
    make: "Porsche",
    model: "911 Speedster",
    trim: "Speedster",
    title: `2019 Porsche 911 Speedster ${id}`,
    vin: null,
    mileage: 1000,
    exteriorColor: "Silver",
    rarityScore: 88,
    raritySignals: ["homologation_special"],
    images: ["https://example.com/car.jpg"],
    endTime: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("homepage ranking", () => {
  it("builds a ranking context from database variant counts", () => {
    const context = buildHomepageRankingContextFromSupply({
      "991:speedster": 2,
      "992:carrera": 20,
      "g-model:speedster": 1,
    });

    expect(context.supplyByVariant.get("991:speedster")).toBe(2);
    expect(context.maxModernVariantSupply).toBe(20);
  });

  it("deduplicates cross-source VINs before calculating variant supply", () => {
    const rows = [
      listing("a", { vin: "WP0ZZZ99ZKS152001" }),
      listing("b", { vin: "wp0zzz99zks152001" }),
      listing("c", { vin: "WP0ZZZ99ZKS152002" }),
    ];

    const context = buildHomepageRankingContext(rows);
    const ranked = rankHomepageListings(rows, context, { limit: 3 });

    expect(ranked[0].marketSupplyCount).toBe(2);
  });

  it("caps live-market scarcity at fifteen points and applies it only to recognized modern variants", () => {
    const rareModern = listing("rare", { model: "911 Speedster", trim: "Speedster" });
    const commonModern = Array.from({ length: 20 }, (_, index) =>
      listing(`common-${index}`, {
        model: "911 Carrera",
        trim: "Carrera",
        title: `2019 Porsche 911 Carrera ${index}`,
      }),
    );
    const unknown = listing("unknown", {
      model: "Mystery Special",
      trim: "One-off wording",
      title: "2019 Porsche Mystery Special",
    });
    const classic = listing("classic", {
      year: 1989,
      model: "911 Speedster",
      title: "1989 Porsche 911 Speedster",
    });
    const rows = [rareModern, ...commonModern, unknown, classic];

    const ranked = rankHomepageListings(rows, buildHomepageRankingContext(rows), {
      limit: rows.length,
    });
    const byId = new Map(ranked.map((row) => [row.listing.id, row]));

    expect(byId.get("rare")?.marketScarcityScore).toBe(15);
    expect(byId.get("common-0")?.marketScarcityScore).toBeLessThan(15);
    expect(byId.get("unknown")?.marketScarcityScore).toBe(0);
    expect(byId.get("classic")?.marketScarcityScore).toBe(0);
  });

  it("keeps intrinsic collector significance ahead of market scarcity", () => {
    const significant = listing("significant", {
      rarityScore: 95,
      model: "911 GT3 RS",
      trim: "GT3 RS",
      title: "2019 Porsche 911 GT3 RS",
    });
    const scarceOrdinary = listing("scarce-ordinary", {
      rarityScore: 65,
      model: "911 Carrera T",
      trim: "Carrera T",
      title: "2019 Porsche 911 Carrera T",
    });
    const rows = [significant, scarceOrdinary];

    const ranked = rankHomepageListings(rows, buildHomepageRankingContext(rows), { limit: 2 });

    expect(ranked[0].listing.id).toBe("significant");
  });

  it("penalizes missing photography and produces deterministic ties", () => {
    const complete = listing("a-complete", { images: ["https://example.com/a.jpg"] });
    const noPhoto = listing("z-no-photo", { images: [] });
    const rows = [noPhoto, complete];

    const ranked = rankHomepageListings(rows, buildHomepageRankingContext(rows), { limit: 2 });

    expect(ranked.map((row) => row.listing.id)).toEqual(["a-complete", "z-no-photo"]);
  });

  it("limits a single canonical variant to two places in the first ten", () => {
    const speedsters = Array.from({ length: 6 }, (_, index) =>
      listing(`speedster-${index}`, { rarityScore: 100 - index }),
    );
    const alternativesConfig = [
      ["911 GT3 RS", "GT3 RS"],
      ["911 Carrera T", "Carrera T"],
      ["911 Turbo S", "Turbo S"],
      ["911 GT3 Touring", "GT3 Touring"],
      ["911 R", "911 R"],
      ["911 GT2 RS", "GT2 RS"],
      ["911 Targa", "Targa"],
      ["911 Carrera 4 GTS", "Carrera 4 GTS"],
    ] as const;
    const alternatives = alternativesConfig.map(([model, trim], index) =>
      listing(`alternative-${index}`, {
        rarityScore: 89 - index,
        model,
        trim,
        title: `2019 Porsche ${model}`,
      }),
    );
    const rows = [...speedsters, ...alternatives];

    const ranked = rankHomepageListings(rows, buildHomepageRankingContext(rows), { limit: 10 });
    const speedsterCount = ranked.filter((row) => row.variantKey.endsWith(":speedster")).length;

    expect(speedsterCount).toBeLessThanOrEqual(2);
  });

  it("preserves the server homepage score when a client filters the ranked rows", () => {
    const rows = [
      { id: "ending-first", endTime: "2026-07-20T00:00:00.000Z", rarityScore: 99 },
      { id: "ranked-first", endTime: "2026-08-20T00:00:00.000Z", rarityScore: 80, homepageScore: 110 },
    ];

    expect(rows.sort(compareHomepageOrdering).map((row) => row.id)).toEqual([
      "ranked-first",
      "ending-first",
    ]);
  });
});
