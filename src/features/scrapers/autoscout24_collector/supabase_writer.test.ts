import { describe, it, expect } from "vitest";
import { mapNormalizedListingToListingsRow } from "./supabase_writer";
import type { NormalizedListing, ScrapeMeta } from "./types";

function makeListing(overrides: Partial<NormalizedListing> = {}): NormalizedListing {
  return {
    source: "AutoScout24",
    sourceId: "test-id",
    sourceUrl: "https://www.autoscout24.com/offers/test",
    title: "2020 Porsche 911 Carrera",
    make: "Porsche",
    model: "911",
    trim: null,
    year: 2020,
    bodyStyle: null,
    exteriorColor: null,
    interiorColor: null,
    mileageKm: 10000,
    mileageUnitStored: "km",
    vin: null,
    pricing: { hammerPrice: 100000, originalCurrency: "EUR", currentBid: null, bidCount: 0 },
    location: { country: "DE", region: null, city: null },
    auctionHouse: null,
    auctionDate: null,
    saleDate: null,
    listDate: null,
    status: "active",
    reserveMet: null,
    photosCount: 0,
    descriptionText: null,
    dataQualityScore: 0.5,
    platform: "AutoScout24",
    reserveStatus: null,
    sellerNotes: null,
    photos: [],
    engine: null,
    transmission: null,
    endTime: null,
    startTime: null,
    finalPrice: null,
    locationString: null,
    ...overrides,
  } as NormalizedListing;
}

const meta: ScrapeMeta = {
  scrapeTimestamp: "2026-05-07T00:00:00.000Z",
  runtime: "cli",
  runId: "test-run",
};

describe("mapNormalizedListingToListingsRow", () => {
  it("truncates make, model, trim, vin, engine, transmission to VARCHAR limits", () => {
    const listing = makeListing({
      make: "A".repeat(150),
      model: "B".repeat(150),
      trim: "C".repeat(150),
      vin: "WVWZZZ3CZWE123456789", // 20 chars
      engine: "D".repeat(150),
      transmission: "E".repeat(150),
    });

    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect((row.make as string).length).toBe(100);
    expect((row.model as string).length).toBe(100);
    expect((row.trim as string).length).toBe(100);
    expect((row.vin as string).length).toBe(17);
    expect((row.engine as string).length).toBe(100);
    expect((row.transmission as string).length).toBe(100);
  });

  it("truncates body_style, color_exterior, color_interior to 100", () => {
    const listing = makeListing({
      bodyStyle: "F".repeat(120),
      exteriorColor: "G".repeat(130),
      interiorColor: "H".repeat(110),
    });

    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect((row.body_style as string).length).toBe(100);
    expect((row.color_exterior as string).length).toBe(100);
    expect((row.color_interior as string).length).toBe(100);
  });

  it("passes through short values unchanged", () => {
    const listing = makeListing({
      make: "Porsche",
      model: "911",
      trim: "Carrera S",
      vin: "WP0AB2A99LS12345",
      engine: "3.0L Flat-6",
      transmission: "PDK",
    });

    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect(row.make).toBe("Porsche");
    expect(row.model).toBe("911");
    expect(row.trim).toBe("Carrera S");
    expect(row.vin).toBe("WP0AB2A99LS12345");
    expect(row.engine).toBe("3.0L Flat-6");
    expect(row.transmission).toBe("PDK");
  });

  it("omits nullable detail-only fields when normalized listing values are null", () => {
    const listing = makeListing({
      make: "Porsche",
      model: "911",
      trim: null,
      vin: null,
      engine: null,
      transmission: null,
      bodyStyle: null,
      exteriorColor: null,
      interiorColor: null,
      descriptionText: null,
      auctionDate: null,
      saleDate: null,
      listDate: null,
      reserveMet: null,
      reserveStatus: null,
      finalPrice: null,
      locationString: null,
    });

    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect(row).not.toHaveProperty("trim");
    expect(row).not.toHaveProperty("body_style");
    expect(row).not.toHaveProperty("color_exterior");
    expect(row).not.toHaveProperty("color_interior");
    expect(row).not.toHaveProperty("engine");
    expect(row).not.toHaveProperty("vin");
    expect(row).not.toHaveProperty("description_text");
    expect(row).not.toHaveProperty("transmission");

    expect(row.auction_date).toBeNull();
    expect(row.sale_date).toBeNull();
    expect(row.list_date).toBeNull();
    expect(row.reserve_met).toBeNull();
    expect(row.reserve_status).toBeNull();
    expect(row.final_price).toBeNull();
    expect(row.location).toBeNull();
  });

  it("preserves transmission from search summary when available", () => {
    const listing = makeListing({ transmission: "Manual" });

    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect(row.transmission).toBe("Manual");
  });

  it("omits empty and placeholder target fields that would erase usable details", () => {
    const listing = makeListing({
      exteriorColor: "",
      engine: "Not specified",
      transmission: "-",
    });

    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect(row).not.toHaveProperty("color_exterior");
    expect(row).not.toHaveProperty("engine");
    expect(row).not.toHaveProperty("transmission");
  });
});
