import { describe, expect, it } from "vitest";
import type { DashboardAuction } from "@/lib/dashboardCache";
import { applyFilters, normalizeTransmission } from "./applyFilters";
import { EMPTY_FILTERS, type ClassicFilters } from "./types";

function makeCar(overrides: Partial<DashboardAuction>): DashboardAuction {
  return {
    id: "test-1",
    title: "2023 Porsche 911 GT3 Touring",
    make: "Porsche",
    model: "911",
    year: 2023,
    trim: "GT3 Touring",
    price: 210000,
    currentBid: 210000,
    bidCount: 4,
    viewCount: 0,
    watchCount: 0,
    status: "ACTIVE",
    endTime: "2026-12-31T00:00:00.000Z",
    platform: "BRING_A_TRAILER",
    engine: "4.0L Flat-6",
    transmission: "Six-Speed Manual Transaxle",
    exteriorColor: null,
    mileage: 12000,
    mileageUnit: "mi",
    location: "San Francisco, CA",
    region: "US",
    description: null,
    images: [],
    analysis: null,
    priceHistory: [],
    ...overrides,
  };
}

const f = (patch: Partial<ClassicFilters> = {}): ClassicFilters => ({
  ...EMPTY_FILTERS,
  ...patch,
});

describe("normalizeTransmission", () => {
  it("classifies PDK variants", () => {
    expect(normalizeTransmission("PDK")).toBe("pdk");
    expect(normalizeTransmission("Seven-Speed PDK Transaxle")).toBe("pdk");
    expect(normalizeTransmission("Seven-Speed PDK Dual-Clutch Transaxle")).toBe("pdk");
    expect(normalizeTransmission("8-Speed Dual-Clutch")).toBe("pdk");
  });

  it("classifies automatics, including AMT / semi-auto / tiptronic", () => {
    expect(normalizeTransmission("Automatic")).toBe("automatic");
    expect(normalizeTransmission("Tiptronic")).toBe("automatic");
    expect(normalizeTransmission("Semi-automatic")).toBe("automatic");
    expect(normalizeTransmission("Automated Manual Transmission (AMT)")).toBe(
      "automatic",
    );
  });

  it("classifies manuals and hyphenated '-speed' phrasings", () => {
    expect(normalizeTransmission("Manual")).toBe("manual");
    expect(normalizeTransmission("Six-Speed Manual Transaxle")).toBe("manual");
    expect(normalizeTransmission("Manual/Standard")).toBe("manual");
  });

  it("returns null for missing or placeholder data", () => {
    expect(normalizeTransmission(null)).toBeNull();
    expect(normalizeTransmission("")).toBeNull();
    expect(normalizeTransmission("—")).toBeNull();
    expect(normalizeTransmission("Fabspeed Exhaust System")).toBeNull();
  });
});

describe("applyFilters — status", () => {
  const live = makeCar({ id: "a", status: "ACTIVE" });
  const ending = makeCar({ id: "b", status: "ENDING_SOON" });
  const sold = makeCar({ id: "c", status: "ENDED" });
  const cars = [live, ending, sold];

  it("defaults to all", () => {
    expect(applyFilters(cars, f()).length).toBe(3);
  });
  it("filters to live (active + ending soon)", () => {
    const ids = applyFilters(cars, f({ status: "live" })).map((c) => c.id);
    expect(ids.sort()).toEqual(["a", "b"]);
  });
  it("filters to sold", () => {
    const ids = applyFilters(cars, f({ status: "sold" })).map((c) => c.id);
    expect(ids).toEqual(["c"]);
  });
});

describe("applyFilters — series + variants", () => {
  const gt3 = makeCar({
    id: "gt3",
    year: 2023,
    model: "911",
    trim: "GT3 Touring",
    title: "2023 Porsche 911 GT3 Touring",
  });
  const carrera = makeCar({
    id: "carrera",
    year: 2020,
    model: "911",
    trim: "Carrera S",
    title: "2020 Porsche 911 Carrera S",
  });
  const turboS = makeCar({
    id: "turbo",
    year: 2022,
    model: "911",
    trim: "Turbo S",
    title: "2022 Porsche 911 Turbo S",
  });
  const cars = [gt3, carrera, turboS];

  it("series filter 992 keeps all three (all are 992 by year)", () => {
    expect(applyFilters(cars, f({ series: ["992"] })).length).toBe(3);
  });

  it("variant filter gt3-touring only keeps the GT3 Touring", () => {
    const ids = applyFilters(cars, f({ variants: ["gt3-touring"] })).map((c) => c.id);
    expect(ids).toEqual(["gt3"]);
  });

  it("variant filter turbo-s only keeps the Turbo S", () => {
    const ids = applyFilters(cars, f({ variants: ["turbo-s"] })).map((c) => c.id);
    expect(ids).toEqual(["turbo"]);
  });
});

describe("applyFilters — 718 mid-engine disambiguation", () => {
  const spyder = makeCar({
    id: "spyder",
    year: 2024,
    model: "718 Spyder RS",
    trim: null,
    title: "Porsche 718 Spyder RS",
  });
  const gt4 = makeCar({
    id: "gt4",
    year: 2022,
    model: "718",
    trim: null,
    title: "Porsche 718 GT4 RS 4.0I PDK",
  });

  it("series filter 718-boxster catches Spyder variants", () => {
    const ids = applyFilters([spyder, gt4], f({ series: ["718-boxster"] })).map(
      (c) => c.id,
    );
    expect(ids).toContain("spyder");
    expect(ids).not.toContain("gt4");
  });

  it("series filter 718-cayman catches GT4 variants", () => {
    const ids = applyFilters([spyder, gt4], f({ series: ["718-cayman"] })).map(
      (c) => c.id,
    );
    expect(ids).toContain("gt4");
  });
});

describe("applyFilters — ranges", () => {
  const a = makeCar({ id: "a", year: 2010, currentBid: 50000, mileage: 80000 });
  const b = makeCar({ id: "b", year: 2018, currentBid: 120000, mileage: 30000 });
  const c = makeCar({ id: "c", year: 2024, currentBid: 250000, mileage: 5000 });
  const cars = [a, b, c];

  it("year range", () => {
    const ids = applyFilters(cars, f({ yearMin: 2015, yearMax: 2020 })).map(
      (x) => x.id,
    );
    expect(ids).toEqual(["b"]);
  });

  it("price max only (cap)", () => {
    const ids = applyFilters(cars, f({ priceMax: 100000 })).map((x) => x.id);
    expect(ids).toEqual(["a"]);
  });

  it("mileage max (sub-10K)", () => {
    const ids = applyFilters(cars, f({ mileageMax: 10000 })).map((x) => x.id);
    expect(ids).toEqual(["c"]);
  });
});

describe("applyFilters — transmission", () => {
  const manual = makeCar({ id: "m", transmission: "Six-Speed Manual Transaxle" });
  const pdk = makeCar({ id: "p", transmission: "Seven-Speed PDK Transaxle" });
  const amt = makeCar({ id: "amt", transmission: "Automated Manual Transmission (AMT)" });
  const tiptronic = makeCar({ id: "tip", transmission: "Eight-Speed Tiptronic S Automatic" });
  const unknown = makeCar({ id: "u", transmission: "—" });
  const cars = [manual, pdk, amt, tiptronic, unknown];

  it("manual filter keeps only true manuals", () => {
    const ids = applyFilters(cars, f({ transmission: ["manual"] })).map((x) => x.id);
    expect(ids.sort()).toEqual(["m"]);
  });

  it("automatic filter catches AMT and Tiptronic", () => {
    const ids = applyFilters(cars, f({ transmission: ["automatic"] })).map((x) => x.id);
    expect(ids.sort()).toEqual(["amt", "tip"]);
  });

  it("pdk filter keeps only PDK", () => {
    const ids = applyFilters(cars, f({ transmission: ["pdk"] })).map((x) => x.id);
    expect(ids).toEqual(["p"]);
  });

  it("hides cars with unknown transmission when filter is active", () => {
    const ids = applyFilters(cars, f({ transmission: ["manual"] })).map((x) => x.id);
    expect(ids).not.toContain("u");
  });
});

describe("applyFilters — region (canonicalMarket)", () => {
  // Filter compares against `canonicalMarket` (normalized "US"|"EU"|"UK"|"JP"),
  // not against the raw `region` column which can be a country name like
  // "United States" or "Germany".
  const us = makeCar({ id: "us", canonicalMarket: "US" });
  const uk = makeCar({ id: "uk", canonicalMarket: "UK" });
  const eu = makeCar({ id: "eu", canonicalMarket: "EU" });
  const jp = makeCar({ id: "jp", canonicalMarket: "JP" });
  const cars = [us, uk, eu, jp];

  it("single region", () => {
    const ids = applyFilters(cars, f({ region: ["US"] })).map((c) => c.id);
    expect(ids).toEqual(["us"]);
  });
  it("multi region", () => {
    const ids = applyFilters(cars, f({ region: ["US", "UK"] })).map((c) => c.id).sort();
    expect(ids).toEqual(["uk", "us"]);
  });
  it("excludes cars without canonicalMarket when filter active", () => {
    const carsWithNull = [
      makeCar({ id: "a", canonicalMarket: "US" }),
      makeCar({ id: "b", canonicalMarket: null }),
    ];
    const out = applyFilters(carsWithNull, f({ region: ["US"] }));
    expect(out.map((c) => c.id)).toEqual(["a"]);
  });
  it("returns all cars when no region filter is set", () => {
    const out = applyFilters(cars, f({ region: [] }));
    expect(out).toHaveLength(4);
  });
});

describe("applyFilters — text search (enriched haystack)", () => {
  const gt3Touring = makeCar({
    id: "gt3t",
    year: 2023,
    model: "911",
    trim: "GT3 Touring",
    title: "2023 Porsche 911 GT3 Touring",
    transmission: "Six-Speed Manual Transaxle",
  });
  const carreraPDK = makeCar({
    id: "c4s",
    year: 2020,
    model: "911",
    trim: "Carrera 4S",
    title: "2020 Porsche 911 Carrera 4S",
    transmission: "Seven-Speed PDK Transaxle",
  });
  const bareDealerListing = makeCar({
    id: "bare",
    year: 2022,
    model: "911",
    trim: null,
    title: "Porsche 911",
    transmission: "Automatic",
  });
  const cars = [gt3Touring, carreraPDK, bareDealerListing];

  it("finds by variant label (‘GT3 Touring’)", () => {
    const ids = applyFilters(cars, f({ q: "gt3 touring" })).map((c) => c.id);
    expect(ids).toEqual(["gt3t"]);
  });

  it("finds by normalized transmission keyword (‘manual’)", () => {
    const ids = applyFilters(cars, f({ q: "manual" })).map((c) => c.id);
    expect(ids).toEqual(["gt3t"]);
  });

  it("finds by PDK keyword", () => {
    const ids = applyFilters(cars, f({ q: "pdk" })).map((c) => c.id);
    expect(ids).toEqual(["c4s"]);
  });

  it("finds by series label even if title is bare", () => {
    // All three are 992 by year — filtering by "992" should match all.
    const ids = applyFilters(cars, f({ q: "992" })).map((c) => c.id).sort();
    expect(ids.sort()).toEqual(["bare", "c4s", "gt3t"]);
  });

  it("requires every token to match (AND semantics)", () => {
    // "manual gt3" matches gt3t (has both). carreraPDK lacks "manual".
    const ids = applyFilters(cars, f({ q: "manual gt3" })).map((c) => c.id);
    expect(ids).toEqual(["gt3t"]);
  });
});

describe("applyFilters — sorting", () => {
  const cheap = makeCar({ id: "cheap", currentBid: 50000, year: 2010 });
  const mid = makeCar({ id: "mid", currentBid: 120000, year: 2018 });
  const expensive = makeCar({ id: "expensive", currentBid: 300000, year: 2024 });
  const cars = [mid, cheap, expensive];

  it("price descending", () => {
    const ids = applyFilters(cars, f({ sort: "priceDesc" })).map((c) => c.id);
    expect(ids).toEqual(["expensive", "mid", "cheap"]);
  });

  it("price ascending", () => {
    const ids = applyFilters(cars, f({ sort: "priceAsc" })).map((c) => c.id);
    expect(ids).toEqual(["cheap", "mid", "expensive"]);
  });

  it("year newest first", () => {
    const ids = applyFilters(cars, f({ sort: "yearDesc" })).map((c) => c.id);
    expect(ids).toEqual(["expensive", "mid", "cheap"]);
  });
});

