import { describe, expect, it } from "vitest";

import { mapNormalizedListingToListingsRow } from "./supabase_writer";
import type { NormalizedListing, ScrapeMeta } from "./types";

describe("beforward_porsche_collector supabase mapping", () => {
  it("maps normalized listing to row shape", () => {
    const listing: NormalizedListing = {
      source: "BeForward",
      sourceId: "bf-CC227877",
      sourceUrl: "https://www.beforward.jp/porsche/911/cc227877/id/14244419/",
      title: "2016 PORSCHE 911 991H1 CC227877",
      platform: "BE_FORWARD",
      sellerNotes: "Non Smoker",
      endTime: null,
      startTime: null,
      reserveStatus: null,
      finalPrice: null,
      locationString: "Osaka, Japan",
      year: 2016,
      make: "Porsche",
      model: "911",
      trim: "991H1",
      bodyStyle: null,
      engine: "3,000cc",
      transmission: "Automatic",
      exteriorColor: "White",
      interiorColor: null,
      vin: "WP0ZZZ99ZHS111949",
      mileageKm: 51793,
      mileageUnitStored: "km",
      status: "active",
      reserveMet: null,
      listDate: "2026-02-22",
      saleDate: "2026-02-22",
      auctionDate: "2026-02-22",
      auctionHouse: "BeForward",
      descriptionText: null,
      photos: ["https://image-cdn.beforward.jp/large/202602/14244419/CC227877_1ce601b3.jpg"],
      photosCount: 1,
      location: {
        locationRaw: "OSAKA",
        country: "Japan",
        region: null,
        city: "Osaka",
        postalCode: null,
      },
      pricing: {
        hammerPrice: null,
        currentBid: 61160,
        bidCount: null,
        originalCurrency: "USD",
        rawPriceText: "$61160",
      },
      dataQualityScore: 85,
    };

    const meta: ScrapeMeta = {
      runId: "run-1",
      scrapeTimestamp: "2026-02-22T00:00:00.000Z",
    };

    const row = mapNormalizedListingToListingsRow(listing, meta);
    expect(row.source).toBe("BeForward");
    expect(row.source_id).toBe("bf-CC227877");
    expect(row.platform).toBe("BE_FORWARD");
    expect(row.current_bid).toBe(61160);
    expect(row.country).toBe("Japan");
  });
});
