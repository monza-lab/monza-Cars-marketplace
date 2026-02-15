import { describe, it, expect } from "vitest";

import type { NormalizedListing, ScrapeMeta } from "./types";
import { mapNormalizedListingToListingsRow } from "./supabase_writer";

describe("ferrari_collector supabase mapping", () => {
  const listing: NormalizedListing = {
    source: "BaT",
    sourceId: "bat-2003-ferrari-360-modena",
    sourceUrl: "https://bringatrailer.com/listing/2003-ferrari-360-modena/",
    title: "2003 Ferrari 360 Modena",
    platform: "BRING_A_TRAILER",
    sellerNotes: "Recently serviced at authorized dealer",
    endTime: new Date("2026-02-20T18:00:00Z"),
    startTime: new Date("2026-02-14T00:00:00Z"),
    reserveStatus: null,
    finalPrice: null,
    locationString: "Austin, TX, USA",
    year: 2003,
    make: "Ferrari",
    model: "360",
    trim: "Modena",
    bodyStyle: null,
    engine: "3.6L V8",
    transmission: "6-Speed Manual",
    exteriorColor: "Red",
    interiorColor: "Tan",
    vin: null,
    mileageKm: 16093,
    mileageUnitStored: "km",
    status: "active",
    reserveMet: null,
    listDate: "2026-02-14",
    saleDate: "2026-02-20",
    auctionDate: "2026-02-20",
    auctionHouse: "Bring a Trailer",
    descriptionText: null,
    photos: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
    photosCount: 2,
    location: {
      locationRaw: "Austin, TX",
      country: "USA",
      region: "TX",
      city: "Austin",
      postalCode: null,
    },
    pricing: {
      hammerPrice: null,
      currentBid: 123000,
      bidCount: 12,
      originalCurrency: "USD",
      rawPriceText: "$123,000",
    },
    dataQualityScore: 80,
  };

  const meta: ScrapeMeta = {
    runId: "run-1",
    scrapeTimestamp: "2026-02-14T12:34:56.000Z",
  };

  it("maps NormalizedListing into listings row shape", () => {
    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect(row.source).toBe("BaT");
    expect(row.source_id).toBe("bat-2003-ferrari-360-modena");
    expect(row.source_url).toBe("https://bringatrailer.com/listing/2003-ferrari-360-modena/");
    expect(row.make).toBe("Ferrari");
    expect(row.model).toBe("360");
    expect(row.mileage_unit).toBe("km");
    expect(row.country).toBe("USA");
    expect(row.status).toBe("active");
    expect(row.scrape_timestamp).toBe(meta.scrapeTimestamp);
    expect(row.updated_at).toBe(meta.scrapeTimestamp);
  });

  it("maps new Auction-model aligned columns", () => {
    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect(row.title).toBe("2003 Ferrari 360 Modena");
    expect(row.platform).toBe("BRING_A_TRAILER");
    expect(row.current_bid).toBe(123000);
    expect(row.bid_count).toBe(12);
    expect(row.reserve_status).toBeNull();
    expect(row.seller_notes).toBe("Recently serviced at authorized dealer");
    expect(row.images).toEqual(["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"]);
    expect(row.engine).toBe("3.6L V8");
    expect(row.transmission).toBe("6-Speed Manual");
    expect(row.end_time).toBe("2026-02-20T18:00:00.000Z");
    expect(row.start_time).toBe("2026-02-14T00:00:00.000Z");
    expect(row.final_price).toBeNull();
    expect(row.location).toBe("Austin, TX, USA");
  });

  it("maps sold listing with finalPrice", () => {
    const soldListing: NormalizedListing = {
      ...listing,
      status: "sold",
      finalPrice: 145000,
      reserveStatus: "RESERVE_MET",
      pricing: {
        ...listing.pricing,
        hammerPrice: 145000,
      },
    };

    const row = mapNormalizedListingToListingsRow(soldListing, meta);

    expect(row.final_price).toBe(145000);
    expect(row.reserve_status).toBe("RESERVE_MET");
    expect(row.hammer_price).toBe(145000);
  });
});
