import { describe, expect, it } from "vitest";

import {
  RARITY_SCORE_VERSION,
  parseListingRaritySignals,
  scoreListingRarity,
} from "./listingRarity";

describe("listing rarity scoring", () => {
  it("uses a version marker so backfills can refresh stale scores", () => {
    expect(RARITY_SCORE_VERSION).toBe("listing-rarity-v3");
  });

  it("scores explicit rare factory build signals deterministically", () => {
    const rarity = scoreListingRarity({
      year: 2022,
      model: "992 GT3",
      title: "2022 Porsche 992 GT3 Touring Paint-to-Sample",
      descriptionText:
        "Paint-to-Sample Gulf Blue. PCCB, bucket seats, accident-free, original paint, one owner, 3,200 miles.",
      mileage: 3200,
      mileageUnit: "mi",
    });

    expect(rarity).toEqual({
      score: 100,
      tier: "unique",
      signals: [
        "paint_to_sample",
        "pccb",
        "bucket_seats",
        "accident_free",
        "original_paint",
        "low_owner_count",
        "low_mileage",
        "gt_model",
      ],
    });
  });

  it("recognizes headline-only halo models that should lead the active feed", () => {
    expect(scoreListingRarity({
      year: 1988,
      model: "959SC",
      trim: "by Canepa",
      title: "1988 Porsche 959SC by Canepa",
      mileage: 2448,
      mileageUnit: "mi",
    })).toMatchObject({
      tier: "unique",
      signals: expect.arrayContaining(["hypercar", "limited_edition", "low_mileage"]),
    });

    expect(scoreListingRarity({
      year: 2024,
      model: "911",
      trim: "S/T Heritage Design",
      title: "2024 Porsche 911 S/T Heritage Design",
      mileage: 2253,
      mileageUnit: "mi",
    })).toMatchObject({
      tier: "very_rare",
      signals: expect.arrayContaining(["homologation_special", "limited_edition", "low_mileage"]),
    });

    expect(scoreListingRarity({
      year: 2024,
      model: "718 Boxster",
      trim: "Spyder RS Weissach",
      title: "Smyrna Green 2024 Porsche 718 Spyder RS Weissach",
      mileage: 2300,
      mileageUnit: "mi",
    })).toMatchObject({
      tier: "very_rare",
      signals: expect.arrayContaining(["homologation_special", "weissach_package", "low_mileage"]),
    });
  });

  it("parses mileage from marketplace titles when the numeric field is absent", () => {
    expect(parseListingRaritySignals({
      title: "2,100-Mile Slate Gray 2022 Porsche 911 GT3 Touring 6-Speed",
      mileage: null,
    })).toEqual(expect.arrayContaining(["low_mileage", "gt_model", "manual_transmission"]));

    expect(parseListingRaritySignals({
      title: "741-Kilometer, RoW 1989 Porsche 911 Narrow-Body Speedster",
      mileage: null,
    })).toEqual(expect.arrayContaining(["low_mileage", "homologation_special"]));
  });

  it("keeps ordinary base models behind rare Porsche variants", () => {
    const ordinary = scoreListingRarity({
      year: 2006,
      model: "Cayman",
      title: "2006 Porsche Cayman S 6-Speed",
      mileage: 143232,
      mileageUnit: "mi",
    });

    const rare = scoreListingRarity({
      year: 2012,
      model: "Cayman",
      trim: "R 6-Speed",
      title: "25k-Mile 2012 Porsche Cayman R 6-Speed",
      mileage: 25000,
      mileageUnit: "mi",
    });

    expect(rare.score).toBeGreaterThan(ordinary.score);
    expect(ordinary.tier).toBe("common");
  });

  it("does not promote ordinary cars from unrelated rare-model text in descriptions", () => {
    const rarity = scoreListingRarity({
      year: 2012,
      model: "911",
      trim: "Turbo",
      title: "2012 Porsche 911 Turbo",
      descriptionText:
        "Marketplace page footer: Carrera GT, 959, GT3 RS, Spyder RS, Speedster, S/T Heritage Design.",
      mileage: 42000,
      mileageUnit: "mi",
    });

    expect(rarity.signals).toEqual(["turbo_heritage"]);
    expect(rarity.tier).toBe("common");
  });
});
