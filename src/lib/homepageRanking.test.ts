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
    const significant = listing("z-significant-classic", {
      year: 1992,
      rarityScore: 100,
      model: "964 Carrera RS",
      trim: "Carrera RS",
      title: "1992 Porsche 964 Carrera RS",
      raritySignals: ["historic_classic_icon", "homologation_special", "classic_significance"],
    });
    const scarceModern = listing("a-scarce-modern", {
      rarityScore: 96,
      model: "911 GT3 RS",
      trim: "GT3 RS",
      title: "2019 Porsche 911 GT3 RS",
      raritySignals: ["gt_model", "homologation_special"],
    });
    const commonModern = Array.from({ length: 20 }, (_, index) => listing(`common-${index}`, {
      rarityScore: 10,
      model: "911 Carrera",
      trim: "Carrera",
      title: `2019 Porsche 911 Carrera ${index}`,
      raritySignals: [],
    }));
    const rows = [significant, scarceModern, ...commonModern];

    const ranked = rankHomepageListings(rows, buildHomepageRankingContext(rows), { limit: rows.length });

    expect(ranked[0].listing.id).toBe("z-significant-classic");
  });

  it("orders a foundational classic icon ahead of a tied hypercar", () => {
    const hypercar = listing("a-hypercar", {
      year: 2015,
      model: "918 Spyder",
      trim: "918 Spyder",
      title: "2015 Porsche 918 Spyder",
      rarityScore: 100,
      raritySignals: ["hypercar"],
    });
    const classicIcon = listing("z-classic-icon", {
      year: 1957,
      model: "356 Speedster",
      trim: "Speedster",
      title: "1957 Porsche 356 A Speedster",
      rarityScore: 100,
      raritySignals: ["historic_classic_icon", "classic_significance"],
    });

    const ranked = rankHomepageListings([hypercar, classicIcon], undefined, { limit: 2 });

    expect(ranked.map((row) => row.listing.id)).toEqual(["z-classic-icon", "a-hypercar"]);
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

  it("preserves the explicit server homepage rank when a client filters the ranked rows", () => {
    const rows = [
      { id: "score-first", endTime: "2026-07-20T00:00:00.000Z", rarityScore: 100, homepageScore: 120, homepageRank: 2 },
      { id: "ranked-first", endTime: "2026-08-20T00:00:00.000Z", rarityScore: 80, homepageScore: 90, homepageRank: 1 },
    ];

    expect(rows.sort(compareHomepageOrdering).map((row) => row.id)).toEqual([
      "ranked-first",
      "score-first",
    ]);
  });

  it("paces at least five classics and three modern specials through the first ten", () => {
    const classicConfigs = [
      [1957, "356 Speedster", "Speedster"],
      [1973, "911 Carrera RS", "Carrera RS"],
      [1987, "911 Turbo 3.3", "Turbo"],
      [1992, "964 Carrera RS", "Carrera RS"],
      [1995, "993 Carrera RS", "Carrera RS"],
      [1989, "911 Speedster", "Speedster"],
    ] as const;
    const classics = classicConfigs.map(([year, model, trim], index) => listing(`classic-${index}`, {
      year,
      model,
      trim,
      title: `${year} Porsche ${model}`,
      rarityScore: 90 - index,
      raritySignals: index < 2 ? ["historic_classic_icon", "classic_significance"] : ["classic_significance"],
    }));
    const modernSpecialConfigs = [
      [2015, "918 Spyder", "918 Spyder", "hypercar"],
      [2019, "911 Speedster", "Speedster", "homologation_special"],
      [2024, "911 GT3 RS", "GT3 RS", "gt_model"],
      [2024, "718 Spyder RS", "Spyder RS", "homologation_special"],
    ] as const;
    const modernSpecials = modernSpecialConfigs.map(([year, model, trim, signal], index) => listing(`modern-special-${index}`, {
      year,
      model,
      trim,
      title: `${year} Porsche ${model}`,
      rarityScore: 100 - index,
      raritySignals: [signal],
    }));
    const ordinary = Array.from({ length: 8 }, (_, index) => listing(`ordinary-${index}`, {
      model: index % 2 === 0 ? "911 Carrera" : "718 Cayman",
      trim: index % 2 === 0 ? "Carrera" : "Cayman",
      title: `2019 Porsche ordinary ${index}`,
      rarityScore: 99 - index,
      raritySignals: [],
    }));

    const ranked = rankHomepageListings([...ordinary, ...modernSpecials, ...classics], undefined, { limit: 10 });
    const ids = ranked.map((row) => row.listing.id);

    expect(ids.filter((id) => id.startsWith("classic-")).length).toBeGreaterThanOrEqual(5);
    expect(ids.filter((id) => id.startsWith("modern-special-")).length).toBeGreaterThanOrEqual(3);
    expect(ranked.map((row) => row.homepageRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("guarantees twenty classics and ten modern specials across the first fifty", () => {
    const classicVariants = [
      [1957, "356 Speedster", "Speedster"],
      [1973, "911 Carrera RS", "Carrera RS"],
      [1987, "911 Turbo 3.3", "Turbo"],
      [1992, "964 Carrera RS", "Carrera RS"],
      [1995, "993 Carrera RS", "Carrera RS"],
    ] as const;
    const classics = classicVariants.flatMap(([year, model, trim], variantIndex) =>
      Array.from({ length: 5 }, (_, index) => listing(`classic-${variantIndex}-${index}`, {
        year,
        model,
        trim,
        title: `${year} Porsche ${model} example ${index}`,
        rarityScore: 82 - index,
        raritySignals: variantIndex < 2 ? ["historic_classic_icon", "classic_significance"] : ["classic_significance"],
      })),
    );
    const modernVariants = [
      [2015, "918 Spyder", "918 Spyder", "hypercar"],
      [2019, "911 Speedster", "Speedster", "homologation_special"],
      [2024, "911 GT3 RS", "GT3 RS", "gt_model"],
    ] as const;
    const modernSpecials = modernVariants.flatMap(([year, model, trim, signal], variantIndex) =>
      Array.from({ length: 5 }, (_, index) => listing(`modern-special-${variantIndex}-${index}`, {
        year,
        model,
        trim,
        title: `${year} Porsche ${model} example ${index}`,
        rarityScore: 95 - index,
        raritySignals: [signal],
      })),
    );
    const ordinaryConfigs = [
      [2019, "911 Carrera", "Carrera"],
      [2019, "718 Cayman", "Cayman"],
      [2019, "718 Boxster", "Boxster"],
      [2019, "911 Targa", "Targa"],
    ] as const;
    const ordinary = ordinaryConfigs.flatMap(([year, model, trim], variantIndex) =>
      Array.from({ length: 10 }, (_, index) => listing(`ordinary-${variantIndex}-${index}`, {
        year,
        model,
        trim,
        title: `${year} Porsche ${model} example ${index}`,
        rarityScore: 99,
        raritySignals: [],
      })),
    );

    const ranked = rankHomepageListings([...ordinary, ...modernSpecials, ...classics], undefined, { limit: 50 });
    const ids = ranked.map((row) => row.listing.id);
    const variantCounts = new Map<string, number>();
    for (const row of ranked) {
      variantCounts.set(row.variantKey, (variantCounts.get(row.variantKey) ?? 0) + 1);
    }

    expect(ids.filter((id) => id.startsWith("classic-")).length).toBeGreaterThanOrEqual(20);
    expect(ids.filter((id) => id.startsWith("modern-special-")).length).toBeGreaterThanOrEqual(10);
    expect(Math.max(...variantCounts.values())).toBeLessThanOrEqual(5);
  });
});
