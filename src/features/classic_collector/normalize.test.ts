import { describe, it, expect } from "vitest";
import {
  mapStatus,
  parseUSLocation,
  parseAuctionHouse,
  normalizeMileageToKm,
  scoreDataQuality,
  normalizeListing,
  normalizeListingFromSummary,
  toUtcDateOnly,
  buildLocationString,
} from "./normalize";
import type { ListingSummary, DetailParsed, ClassicComRawListing, ScrapeMeta } from "./types";

/* ------------------------------------------------------------------ */
/*  mapStatus                                                          */
/* ------------------------------------------------------------------ */

describe("mapStatus", () => {
  it("maps 'sold' saleResult to sold", () => {
    expect(mapStatus("sold", "ended")).toBe("sold");
  });

  it("maps 'not_sold' saleResult to unsold", () => {
    expect(mapStatus("not_sold", "ended")).toBe("unsold");
  });

  it("maps 'bid_to' saleResult to active", () => {
    expect(mapStatus("bid_to", null)).toBe("active");
  });

  it("maps 'forsale' status to active", () => {
    expect(mapStatus(null, "forsale")).toBe("active");
  });

  it("maps 'for_sale' status to active", () => {
    expect(mapStatus(null, "for_sale")).toBe("active");
  });

  it("maps 'withdrawn' status to delisted", () => {
    expect(mapStatus(null, "withdrawn")).toBe("delisted");
  });

  it("defaults to active when both null", () => {
    expect(mapStatus(null, null)).toBe("active");
  });

  it("saleResult takes priority over status", () => {
    expect(mapStatus("sold", "active")).toBe("sold");
  });
});

/* ------------------------------------------------------------------ */
/*  parseUSLocation                                                    */
/* ------------------------------------------------------------------ */

describe("parseUSLocation", () => {
  it("parses 'Scottsdale, AZ'", () => {
    const loc = parseUSLocation("Scottsdale, AZ");
    expect(loc.country).toBe("US");
    expect(loc.region).toBe("Arizona");
    expect(loc.city).toBe("Scottsdale");
    expect(loc.postalCode).toBeNull();
  });

  it("parses 'Los Angeles, CA 90210'", () => {
    const loc = parseUSLocation("Los Angeles, CA 90210");
    expect(loc.country).toBe("US");
    expect(loc.region).toBe("California");
    expect(loc.city).toBe("Los Angeles");
    expect(loc.postalCode).toBe("90210");
  });

  it("parses 'New York, NY'", () => {
    const loc = parseUSLocation("New York, NY");
    expect(loc.region).toBe("New York");
    expect(loc.city).toBe("New York");
  });

  it("parses state abbreviation only", () => {
    const loc = parseUSLocation("TX");
    expect(loc.region).toBe("Texas");
    expect(loc.city).toBeNull();
  });

  it("parses 'DC'", () => {
    const loc = parseUSLocation("DC");
    expect(loc.region).toBe("District of Columbia");
  });

  it("handles null input", () => {
    const loc = parseUSLocation(null);
    expect(loc.country).toBe("US");
    expect(loc.region).toBeNull();
    expect(loc.city).toBeNull();
  });

  it("handles empty string", () => {
    const loc = parseUSLocation("");
    expect(loc.country).toBe("US");
    expect(loc.region).toBeNull();
  });

  it("handles ZIP+4 format", () => {
    const loc = parseUSLocation("Miami, FL 33101-1234");
    expect(loc.postalCode).toBe("33101");
    expect(loc.region).toBe("Florida");
  });

  it("handles unknown format as city", () => {
    const loc = parseUSLocation("Some Random Place");
    expect(loc.city).toBe("Some Random Place");
    expect(loc.region).toBeNull();
  });

  it("parses 'Miami, Florida, USA' (classic.com format)", () => {
    const loc = parseUSLocation("Miami, Florida, USA");
    expect(loc.country).toBe("US");
    expect(loc.region).toBe("Florida");
    expect(loc.city).toBe("Miami");
    expect(loc.locationRaw).toBe("Miami, Florida, USA");
  });

  it("parses 'Scottsdale, Arizona, USA'", () => {
    const loc = parseUSLocation("Scottsdale, Arizona, USA");
    expect(loc.country).toBe("US");
    expect(loc.region).toBe("Arizona");
    expect(loc.city).toBe("Scottsdale");
  });

  it("parses 'Los Angeles, California, USA'", () => {
    const loc = parseUSLocation("Los Angeles, California, USA");
    expect(loc.country).toBe("US");
    expect(loc.region).toBe("California");
    expect(loc.city).toBe("Los Angeles");
  });

  it("parses 'New York, New York, USA'", () => {
    const loc = parseUSLocation("New York, New York, USA");
    expect(loc.country).toBe("US");
    expect(loc.region).toBe("New York");
    expect(loc.city).toBe("New York");
  });
});

/* ------------------------------------------------------------------ */
/*  parseAuctionHouse                                                  */
/* ------------------------------------------------------------------ */

describe("parseAuctionHouse", () => {
  it("normalizes 'bring a trailer'", () => {
    expect(parseAuctionHouse("bring a trailer")).toBe("Bring a Trailer");
  });

  it("normalizes 'BaT'", () => {
    expect(parseAuctionHouse("BaT")).toBe("Bring a Trailer");
  });

  it("normalizes 'RM Sotheby's'", () => {
    expect(parseAuctionHouse("RM Sotheby's")).toBe("RM Sotheby's");
  });

  it("normalizes 'mecum'", () => {
    expect(parseAuctionHouse("mecum")).toBe("Mecum Auctions");
  });

  it("normalizes 'gooding & company'", () => {
    expect(parseAuctionHouse("gooding & company")).toBe("Gooding & Company");
  });

  it("normalizes 'barrett-jackson'", () => {
    expect(parseAuctionHouse("barrett-jackson")).toBe("Barrett-Jackson");
  });

  it("normalizes 'cars and bids'", () => {
    expect(parseAuctionHouse("cars and bids")).toBe("Cars & Bids");
  });

  it("passes through unknown houses as-is", () => {
    expect(parseAuctionHouse("Some Dealer")).toBe("Some Dealer");
  });

  it("returns 'Classic.com' for null", () => {
    expect(parseAuctionHouse(null)).toBe("Classic.com");
  });

  it("returns 'Classic.com' for empty string", () => {
    expect(parseAuctionHouse("")).toBe("Classic.com");
  });

  it("handles whitespace", () => {
    expect(parseAuctionHouse("  Bonhams  ")).toBe("Bonhams");
  });
});

/* ------------------------------------------------------------------ */
/*  normalizeMileageToKm                                               */
/* ------------------------------------------------------------------ */

describe("normalizeMileageToKm", () => {
  it("converts miles to km", () => {
    expect(normalizeMileageToKm(10000, "miles")).toBe(16093);
  });

  it("keeps km as-is", () => {
    expect(normalizeMileageToKm(10000, "km")).toBe(10000);
  });

  it("defaults to miles conversion when unit is null", () => {
    expect(normalizeMileageToKm(10000, null)).toBe(16093);
  });

  it("returns null for null mileage", () => {
    expect(normalizeMileageToKm(null, "miles")).toBeNull();
  });

  it("returns null for negative mileage", () => {
    expect(normalizeMileageToKm(-100, "miles")).toBeNull();
  });

  it("handles zero mileage", () => {
    expect(normalizeMileageToKm(0, "miles")).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  scoreDataQuality                                                   */
/* ------------------------------------------------------------------ */

describe("scoreDataQuality", () => {
  it("returns 100 for perfect data", () => {
    expect(scoreDataQuality({
      year: 2023,
      model: "911",
      vin: "WP0AC2A98PS230517",
      auctionHouse: "Bring a Trailer",
      saleDate: "2024-01-15",
      country: "US",
      photosCount: 10,
      hasPrice: true,
    })).toBe(100);
  });

  it("returns 0 for empty data", () => {
    expect(scoreDataQuality({
      year: null,
      model: null,
      vin: null,
      auctionHouse: null,
      saleDate: null,
      country: null,
      photosCount: 0,
      hasPrice: false,
    })).toBe(0);
  });

  it("gives 15 points for valid VIN", () => {
    const withVin = scoreDataQuality({
      year: null, model: null, vin: "WP0AC2A98PS230517",
      auctionHouse: null, saleDate: null, country: null, photosCount: 0, hasPrice: false,
    });
    const withoutVin = scoreDataQuality({
      year: null, model: null, vin: null,
      auctionHouse: null, saleDate: null, country: null, photosCount: 0, hasPrice: false,
    });
    expect(withVin - withoutVin).toBe(15);
  });

  it("gives 10 points for known auction house", () => {
    const with_ = scoreDataQuality({
      year: null, model: null, vin: null,
      auctionHouse: "BaT", saleDate: null, country: null, photosCount: 0, hasPrice: false,
    });
    expect(with_).toBe(10);
  });

  it("gives 0 for 'Unknown' auction house", () => {
    const score = scoreDataQuality({
      year: null, model: null, vin: null,
      auctionHouse: "Unknown", saleDate: null, country: null, photosCount: 0, hasPrice: false,
    });
    expect(score).toBe(0);
  });

  it("gives 0 for 'Classic.com' auction house (fallback default)", () => {
    const score = scoreDataQuality({
      year: null, model: null, vin: null,
      auctionHouse: "Classic.com", saleDate: null, country: null, photosCount: 0, hasPrice: false,
    });
    expect(score).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  normalizeListing                                                   */
/* ------------------------------------------------------------------ */

describe("normalizeListing", () => {
  const meta: ScrapeMeta = {
    scrapeTimestamp: "2026-02-27T12:00:00.000Z",
    runId: "test-run-001",
  };

  function makeSummary(overrides?: Partial<ListingSummary>): ListingSummary {
    return {
      sourceUrl: "https://www.classic.com/veh/2023-porsche-911-gt3-WP0AC2A98PS230517-WYG0PA4/",
      classicComId: "WYG0PA4",
      title: "2023 Porsche 911 GT3",
      year: 2023,
      make: "Porsche",
      model: "911",
      vin: "WP0AC2A98PS230517",
      price: 225000,
      auctionHouse: "Bring a Trailer",
      status: "forsale",
      thumbnailUrl: null,
      ...overrides,
    };
  }

  function makeRaw(overrides?: Partial<ClassicComRawListing>): ClassicComRawListing {
    return {
      id: "WYG0PA4",
      title: "2023 Porsche 911 GT3",
      year: 2023,
      make: "Porsche",
      model: "911",
      trim: "GT3",
      vin: "WP0AC2A98PS230517",
      mileage: 5000,
      mileageUnit: "miles",
      price: 225000,
      currency: "USD",
      status: "forsale",
      auctionHouse: "Bring a Trailer",
      auctionDate: null,
      location: "Scottsdale, AZ",
      images: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
      url: "https://www.classic.com/veh/2023-porsche-911-gt3-WP0AC2A98PS230517-WYG0PA4/",
      description: "Well-maintained GT3 with sport chrono package.",
      exteriorColor: "GT Silver Metallic",
      interiorColor: "Black",
      engine: "4.0L Flat-6",
      transmission: "6-Speed Manual",
      bodyStyle: "Coupe",
      bidCount: null,
      reserveStatus: null,
      saleResult: null,
      hammerPrice: null,
      endTime: null,
      startTime: null,
      ...overrides,
    };
  }

  it("normalizes a complete listing", () => {
    const result = normalizeListing({
      summary: makeSummary(),
      detail: { raw: makeRaw() },
      meta,
    });

    expect(result).not.toBeNull();
    expect(result!.source).toBe("ClassicCom");
    expect(result!.platform).toBe("CLASSIC_COM");
    expect(result!.sourceId).toBe("classic-WP0AC2A98PS230517");
    expect(result!.year).toBe(2023);
    expect(result!.make).toBe("Porsche");
    expect(result!.model).toBe("911");
    expect(result!.trim).toBe("GT3");
    expect(result!.vin).toBe("WP0AC2A98PS230517");
    expect(result!.auctionHouse).toBe("Bring a Trailer");
    expect(result!.location.region).toBe("Arizona");
    expect(result!.location.city).toBe("Scottsdale");
    expect(result!.mileageKm).toBe(8047);
    expect(result!.pricing.originalCurrency).toBe("USD");
    expect(result!.status).toBe("active");
    // Active listing has no saleDate, so max score = 85 (100 - 15 for missing saleDate)
    expect(result!.dataQualityScore).toBe(85);
  });

  it("returns null when title is missing", () => {
    const result = normalizeListing({
      summary: makeSummary({ title: "" }),
      detail: { raw: makeRaw({ title: "" }) },
      meta,
    });
    expect(result).toBeNull();
  });

  it("returns null when year is missing", () => {
    const result = normalizeListing({
      summary: makeSummary({ year: null }),
      detail: { raw: makeRaw({ year: null }) },
      meta,
    });
    expect(result).toBeNull();
  });

  it("maps sold status and sets finalPrice", () => {
    const result = normalizeListing({
      summary: makeSummary(),
      detail: { raw: makeRaw({ saleResult: "sold", hammerPrice: 210000 }) },
      meta,
    });
    expect(result!.status).toBe("sold");
    expect(result!.finalPrice).toBe(210000);
  });
});

/* ------------------------------------------------------------------ */
/*  normalizeListingFromSummary                                        */
/* ------------------------------------------------------------------ */

describe("normalizeListingFromSummary", () => {
  const meta: ScrapeMeta = {
    scrapeTimestamp: "2026-02-27T12:00:00.000Z",
    runId: "test-run-001",
  };

  it("normalizes from summary data only", () => {
    const result = normalizeListingFromSummary({
      summary: {
        sourceUrl: "https://www.classic.com/veh/2023-porsche-911-gt3-WP0AC2A98PS230517-WYG0PA4/",
        classicComId: "WYG0PA4",
        title: "2023 Porsche 911 GT3",
        year: 2023,
        make: "Porsche",
        model: "911",
        vin: "WP0AC2A98PS230517",
        price: 225000,
        auctionHouse: "BaT",
        status: "forsale",
        thumbnailUrl: null,
      },
      meta,
    });

    expect(result).not.toBeNull();
    expect(result!.sourceId).toBe("classic-WP0AC2A98PS230517");
    expect(result!.status).toBe("active");
    expect(result!.photos).toHaveLength(0);
    expect(result!.auctionHouse).toBe("Bring a Trailer");
  });

  it("returns null when year is missing", () => {
    const result = normalizeListingFromSummary({
      summary: {
        sourceUrl: "https://www.classic.com/veh/test/",
        classicComId: null,
        title: "Porsche 911",
        year: null,
        make: "Porsche",
        model: "911",
        vin: null,
        price: null,
        auctionHouse: null,
        status: null,
        thumbnailUrl: null,
      },
      meta,
    });
    expect(result).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

describe("toUtcDateOnly", () => {
  it("formats date as YYYY-MM-DD", () => {
    expect(toUtcDateOnly(new Date("2026-02-27T15:30:00Z"))).toBe("2026-02-27");
  });
});

describe("buildLocationString", () => {
  it("builds 'City, State, US'", () => {
    expect(buildLocationString({
      locationRaw: "Scottsdale, AZ",
      country: "US",
      region: "Arizona",
      city: "Scottsdale",
      postalCode: null,
    })).toBe("Scottsdale, Arizona, US");
  });

  it("returns null for empty location", () => {
    expect(buildLocationString({
      locationRaw: null,
      country: "Unknown",
      region: null,
      city: null,
      postalCode: null,
    })).toBeNull();
  });
});
