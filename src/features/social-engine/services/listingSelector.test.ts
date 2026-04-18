import { describe, it, expect } from "vitest";
import { computeQualityScore, matchesCollectorThesis } from "./listingSelector";
import type { ListingRow } from "../types";

function mockListing(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    id: "test-id",
    title: "2004 Porsche 911 GT3",
    year: 2004,
    make: "Porsche",
    model: "911",
    trim: "GT3",
    platform: "BRING_A_TRAILER",
    photos_count: 20,
    data_quality_score: 85,
    images: ["https://x.com/1.jpg"],
    final_price: null,
    current_bid: 150000,
    engine: "3.6-Liter Mezger Flat-Six",
    transmission: "Six-Speed Manual Transaxle",
    mileage: 40000,
    color_exterior: "Cobalt Blue",
    color_interior: null,
    location: "US",
    reserve_status: null,
    seller_notes: null,
    status: "active",
    created_at: "2026-04-15T00:00:00Z",
    ...overrides,
  };
}

describe("matchesCollectorThesis", () => {
  it("accepts GT3 by trim", () => {
    expect(matchesCollectorThesis(mockListing({ trim: "GT3" }))).toBe(true);
  });

  it("accepts RS by trim", () => {
    expect(matchesCollectorThesis(mockListing({ trim: "Carrera RS" }))).toBe(true);
  });

  it("accepts Speedster by title", () => {
    expect(matchesCollectorThesis(mockListing({ trim: null, title: "Porsche 911 Speedster" }))).toBe(true);
  });

  it("rejects modern Cayenne", () => {
    const l = mockListing({ trim: null, title: "Cayenne E-Hybrid", model: "Cayenne", year: 2024 });
    expect(matchesCollectorThesis(l)).toBe(false);
  });

  it("rejects Taycan 4S (RS false-positive)", () => {
    const l = mockListing({ trim: null, title: "Taycan 4S Cross Turismo", model: "Taycan", year: 2023 });
    expect(matchesCollectorThesis(l)).toBe(false);
  });
});

describe("computeQualityScore", () => {
  it("BaT GT3 with rich data scores high", () => {
    const score = computeQualityScore(mockListing());
    expect(score).toBeGreaterThan(70);
  });

  it("AS24 with null engine scores lower than BaT", () => {
    const as24 = computeQualityScore(mockListing({
      platform: "AUTO_SCOUT_24", engine: null, color_exterior: null,
    }));
    const bat = computeQualityScore(mockListing());
    expect(as24).toBeLessThan(bat);
  });
});
