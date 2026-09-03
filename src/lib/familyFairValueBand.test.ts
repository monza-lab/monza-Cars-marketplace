import { describe, expect, it } from "vitest";

import {
  bandBracketsPrice,
  familyBandLabel,
  isFamilyBandRepresentative,
  isPostProductionClassic,
  resolveFamilyBandLabel,
} from "./familyFairValueBand";

describe("family fair-value band eligibility", () => {
  it("withholds the family band from the special variants that broke the grid", () => {
    const specials = [
      { year: 1992, model: "964 Carrera RS", trim: "Carrera RS", title: "1992 Porsche 911 Carrera RS", family: "964" },
      { year: 2011, model: "911 GT3 RS", trim: "GT3 RS", title: "2011 Porsche 911 GT3 RS 4.0", family: "997" },
      { year: 2018, model: "911 GT2 RS", trim: "Clubsport", title: "Porsche 991.2 GT2 RS Clubsport", family: "991" },
      { year: 2015, model: "918 Spyder", trim: "918 Spyder", title: "2015 Porsche 918 Spyder", family: "918-spyder" },
      { year: 1957, model: "356 A 1600 Speedster", trim: "Speedster", title: "Porsche 356 A 1600 Speedster", family: "356" },
      { year: 1995, model: "993 Carrera RS", trim: "Carrera RS", title: "Porsche 993 Carrera RS", family: "993" },
    ];

    for (const listing of specials) {
      expect(isFamilyBandRepresentative(listing)).toBe(false);
    }
  });

  it("keeps the family band for ordinary cars of the family", () => {
    expect(
      isFamilyBandRepresentative({
        year: 2020,
        model: "911 Carrera S",
        trim: "Carrera S",
        title: "2020 Porsche 911 Carrera S",
        family: "992",
      }),
    ).toBe(true);
  });

  it("treats a replica and a post-production 356 as not described by the band", () => {
    const replica = {
      year: 1985,
      model: "356 speedster",
      trim: null,
      title: "1985 Porsche 356 speedster",
      family: "356",
    };
    const tribute = {
      year: 1981,
      model: "911 2.8 RSR Martini Replika",
      trim: null,
      title: "1981 Porsche 911 2.8 RSR Martini Replika 3.2",
      family: "g-model",
    };

    expect(isPostProductionClassic(replica)).toBe(true);
    expect(isFamilyBandRepresentative(replica)).toBe(false);
    expect(isFamilyBandRepresentative(tribute)).toBe(false);
    expect(isPostProductionClassic({ ...replica, year: 1957 })).toBe(false);
  });

  it("requires the band to bracket the car's own price", () => {
    const band = { low: 37_000, high: 88_000 };

    expect(bandBracketsPrice(band, 60_000)).toBe(true);
    expect(bandBracketsPrice(band, 120_000)).toBe(true);
    expect(bandBracketsPrice(band, 425_000)).toBe(false);
    expect(bandBracketsPrice(band, 5_000)).toBe(false);
    // POA makes no comparison, so it cannot be contradicted.
    expect(bandBracketsPrice(band, null)).toBe(true);
    expect(bandBracketsPrice(band, 0)).toBe(true);
  });

  it("labels a surviving band as the family's range, using brandConfig", () => {
    expect(familyBandLabel("964")).toBe("964 family");
    expect(familyBandLabel("g-model")).toBe("G-Model family");
    expect(familyBandLabel(null)).toBeNull();
    expect(familyBandLabel("not-a-series")).toBeNull();
  });

  it("resolves the single display gate end to end", () => {
    const ordinary = {
      year: 1989,
      model: "911 Carrera 3.2",
      trim: "Carrera",
      title: "1989 Porsche 911 Carrera 3.2",
      family: "g-model",
    };

    expect(resolveFamilyBandLabel(ordinary, { low: 42_000, high: 75_000 }, 68_000)).toBe(
      "G-Model family",
    );
    // The 911 SC at $140K sits far above the G-model band.
    expect(resolveFamilyBandLabel(ordinary, { low: 42_000, high: 75_000 }, 140_000)).toBeNull();
    // A 964 RS never carries the 964 band, whatever the price.
    expect(
      resolveFamilyBandLabel(
        { year: 1992, model: "964 Carrera RS", trim: "Carrera RS", title: "1992 Porsche 964 Carrera RS", family: "964" },
        { low: 85_000, high: 172_000 },
        396_000,
      ),
    ).toBeNull();
    expect(resolveFamilyBandLabel(ordinary, null, 68_000)).toBeNull();
    expect(resolveFamilyBandLabel(ordinary, { low: 0, high: 0 }, 68_000)).toBeNull();
  });
});
