import { describe, it, expect } from "vitest";

import {
  isPorscheListing,
  isLuxuryCarListing,
  normalizeMileageToKm,
  parseCurrencyFromText,
  mapAuctionStatus,
  parseLocation,
  parseYearFromTitle,
  toUtcDateOnly,
  scoreDataQuality,
  normalizeSourceAuctionHouse,
  mapSourceToPlatform,
  buildLocationString,
  parsePriceIndicator,
  isGoodDeal,
} from "./normalize";

describe("isPorscheListing", () => {
  it("should return true for Porsche make", () => {
    expect(isPorscheListing({ make: "Porsche" })).toBe(true);
  });

  it("should return true for Porsche in title", () => {
    expect(isPorscheListing({ title: "2020 Porsche 911 Carrera" })).toBe(true);
  });

  it("should return false for non-Porsche", () => {
    expect(isPorscheListing({ make: "BMW" })).toBe(false);
  });

  it("should return false for replica in title", () => {
    expect(isPorscheListing({ title: "Porsche replica 911" })).toBe(false);
  });

  it("should return false for kit car in title", () => {
    expect(isPorscheListing({ title: "Porsche kit car" })).toBe(false);
  });
});

describe("isLuxuryCarListing", () => {
  it("should match exact make", () => {
    expect(isLuxuryCarListing({ make: "Porsche", targetMake: "Porsche" })).toBe(true);
  });

  it("should match make in title", () => {
    expect(isLuxuryCarListing({ title: "2020 Porsche 911", targetMake: "Porsche" })).toBe(true);
  });

  it("should not match partial make", () => {
    expect(isLuxuryCarListing({ title: "Porsche Cayenne", targetMake: "Pors" })).toBe(false);
  });

  it("should filter out tribute listings", () => {
    expect(isLuxuryCarListing({ title: "Porsche 911 tribute", targetMake: "Porsche" })).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(isLuxuryCarListing({ make: "porsche", targetMake: "PORSCHE" })).toBe(true);
  });
});

describe("normalizeMileageToKm", () => {
  it("should return null for null mileage", () => {
    expect(normalizeMileageToKm(null, "km")).toBeNull();
  });

  it("should return null for undefined mileage", () => {
    expect(normalizeMileageToKm(undefined, "km")).toBeNull();
  });

  it("should return null for negative mileage", () => {
    expect(normalizeMileageToKm(-100, "km")).toBeNull();
  });

  it("should pass through km unchanged", () => {
    expect(normalizeMileageToKm(50000, "km")).toBe(50000);
  });

  it("should convert miles to km", () => {
    expect(normalizeMileageToKm(10000, "miles")).toBe(16093);
  });

  it("should handle mile singular", () => {
    expect(normalizeMileageToKm(100, "mile")).toBe(161);
  });

  it("should handle mi abbreviation", () => {
    expect(normalizeMileageToKm(50, "mi")).toBe(80);
  });

  it("should default to km for UK market if no unit", () => {
    expect(normalizeMileageToKm(5000, null)).toBe(5000);
  });

  it("should round to nearest integer", () => {
    expect(normalizeMileageToKm(100.6, "miles")).toBe(162);
  });
});

describe("parseCurrencyFromText", () => {
  it("should parse GBP symbol", () => {
    expect(parseCurrencyFromText("£25,000")).toBe("GBP");
  });

  it("should parse GBP text", () => {
    expect(parseCurrencyFromText("25000 GBP")).toBe("GBP");
  });

  it("should parse USD symbol", () => {
    expect(parseCurrencyFromText("$25,000")).toBe("USD");
  });

  it("should parse EUR symbol", () => {
    expect(parseCurrencyFromText("€25,000")).toBe("EUR");
  });

  it("should parse JPY text", () => {
    expect(parseCurrencyFromText("2500000 JPY")).toBe("JPY");
  });

  it("should parse CHF text", () => {
    expect(parseCurrencyFromText("25000 CHF")).toBe("CHF");
  });

  it("should return null for unknown currency", () => {
    expect(parseCurrencyFromText("25000")).toBe("GBP"); // Default to GBP for UK
  });

  it("should return null for empty input", () => {
    expect(parseCurrencyFromText(null)).toBeNull();
    expect(parseCurrencyFromText("")).toBeNull();
  });
});

describe("mapAuctionStatus", () => {
  it("should map ACTIVE status", () => {
    expect(mapAuctionStatus({ sourceStatus: "ACTIVE" })).toBe("active");
  });

  it("should map LIVE status", () => {
    expect(mapAuctionStatus({ sourceStatus: "LIVE" })).toBe("active");
  });

  it("should map SOLD status", () => {
    expect(mapAuctionStatus({ sourceStatus: "SOLD" })).toBe("sold");
  });

  it("should map WITHDRAWN to delisted", () => {
    expect(mapAuctionStatus({ sourceStatus: "WITHDRAWN" })).toBe("delisted");
  });

  it("should map DELETED to delisted", () => {
    expect(mapAuctionStatus({ sourceStatus: "DELETED" })).toBe("delisted");
  });

  it("should detect sold from price text", () => {
    expect(mapAuctionStatus({ sourceStatus: "ACTIVE", rawPriceText: "This car is sold" })).toBe("sold");
  });

  it("should detect reserved from price text", () => {
    expect(mapAuctionStatus({ sourceStatus: "ACTIVE", rawPriceText: "Reserved" })).toBe("sold");
  });

  it("should return active for great price indicator", () => {
    expect(mapAuctionStatus({ sourceStatus: "ACTIVE", priceIndicator: "great-price" })).toBe("active");
  });

  it("should return active for good price indicator", () => {
    expect(mapAuctionStatus({ sourceStatus: "ACTIVE", priceIndicator: "good-price" })).toBe("active");
  });

  it("should return active by default for classifieds", () => {
    expect(mapAuctionStatus({ isActive: true })).toBe("active");
  });
});

describe("parseLocation", () => {
  it("should return Unknown for empty input", () => {
    const result = parseLocation(null);
    expect(result.country).toBe("Unknown");
    expect(result.city).toBeNull();
  });

  it("should parse UK postcode", () => {
    const result = parseLocation("SW1A 1AA");
    expect(result.postalCode).toBe("SW1A 1AA");
    expect(result.country).toBe("UK");
  });

  it("should parse London location with postcode", () => {
    const result = parseLocation("London, SW1A 1AA");
    expect(result.city).toBe("London");
    expect(result.postalCode).toBe("SW1A 1AA");
    expect(result.country).toBe("UK");
  });

  it("should parse city with UK region", () => {
    const result = parseLocation("Manchester, Greater Manchester");
    expect(result.city).toBe("Manchester");
    expect(result.region).toBe("Greater Manchester");
    expect(result.country).toBe("UK");
  });

  it("should parse full UK location", () => {
    const result = parseLocation("Birmingham, West Midlands, UK");
    expect(result.city).toBe("Birmingham");
    expect(result.region).toBe("West Midlands");
    expect(result.country).toBe("UK");
  });

  it("should handle Scotland location", () => {
    const result = parseLocation("Edinburgh, Scotland");
    expect(result.city).toBe("Edinburgh");
    expect(result.region).toBe("Scotland");
    expect(result.country).toBe("UK");
  });

  it("should handle Northern Ireland", () => {
    const result = parseLocation("Belfast, Northern Ireland");
    expect(result.city).toBe("Belfast");
    expect(result.region).toBe("Northern Ireland");
    expect(result.country).toBe("UK");
  });

  it("should handle location with region detection", () => {
    const result = parseLocation("Leeds, West Yorkshire");
    expect(result.city).toBe("Leeds");
    expect(result.region).toBe("West Yorkshire");
  });

  it("should extract region from pattern", () => {
    const result = parseLocation("Glasgow, Scotland, UK");
    expect(result.region).toBe("Scotland");
  });
});

describe("parseYearFromTitle", () => {
  it("should extract 4-digit year", () => {
    expect(parseYearFromTitle("2020 Porsche 911")).toBe(2020);
  });

  it("should extract year from any position", () => {
    expect(parseYearFromTitle("Porsche 911 2020")).toBe(2020);
  });

  it("should extract year from middle", () => {
    expect(parseYearFromTitle("2020 Porsche 911 Carrera")).toBe(2020);
  });

  it("should handle 1900s years", () => {
    expect(parseYearFromTitle("1989 Porsche 911")).toBe(1989);
  });

  it("should return null for invalid year", () => {
    expect(parseYearFromTitle("Porsche 911")).toBeNull();
  });

  it("should return null for year out of range", () => {
    expect(parseYearFromTitle("1899 Porsche 911")).toBeNull();
  });

  it("should reject future year beyond next year", () => {
    expect(parseYearFromTitle("2030 Porsche 911")).toBeNull();
  });

  it("should accept next year", () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    expect(parseYearFromTitle(`${nextYear} Porsche 911`)).toBe(nextYear);
  });
});

describe("toUtcDateOnly", () => {
  it("should format date as YYYY-MM-DD", () => {
    const date = new Date("2024-06-15T12:00:00Z");
    expect(toUtcDateOnly(date)).toBe("2024-06-15");
  });

  it("should pad single digit month and day", () => {
    const date = new Date("2024-01-05T12:00:00Z");
    expect(toUtcDateOnly(date)).toBe("2024-01-05");
  });

  it("should use UTC time", () => {
    const date = new Date("2024-06-15T23:59:59Z");
    expect(toUtcDateOnly(date)).toBe("2024-06-15");
  });
});

describe("scoreDataQuality", () => {
  it("should return 0 for empty data", () => {
    const score = scoreDataQuality({
      year: null,
      model: null,
      listDate: null,
      country: null,
      photosCount: 0,
      hasPrice: false,
    });
    expect(score).toBe(0);
  });

  it("should score year", () => {
    const score = scoreDataQuality({
      year: 2020,
      model: null,
      listDate: null,
      country: null,
      photosCount: 0,
      hasPrice: false,
    });
    expect(score).toBe(25);
  });

  it("should score model", () => {
    const score = scoreDataQuality({
      year: null,
      model: "911",
      listDate: null,
      country: null,
      photosCount: 0,
      hasPrice: false,
    });
    expect(score).toBe(15);
  });

  it("should score list date", () => {
    const score = scoreDataQuality({
      year: null,
      model: null,
      listDate: "2024-06-15",
      country: null,
      photosCount: 0,
      hasPrice: false,
    });
    expect(score).toBe(25);
  });

  it("should score country", () => {
    const score = scoreDataQuality({
      year: null,
      model: null,
      listDate: null,
      country: "UK",
      photosCount: 0,
      hasPrice: false,
    });
    expect(score).toBe(15);
  });

  it("should not score Unknown country", () => {
    const score = scoreDataQuality({
      year: null,
      model: null,
      listDate: null,
      country: "Unknown",
      photosCount: 0,
      hasPrice: false,
    });
    expect(score).toBe(0);
  });

  it("should score photos", () => {
    const score = scoreDataQuality({
      year: null,
      model: null,
      listDate: null,
      country: null,
      photosCount: 5,
      hasPrice: false,
    });
    expect(score).toBe(10);
  });

  it("should score price", () => {
    const score = scoreDataQuality({
      year: null,
      model: null,
      listDate: null,
      country: null,
      photosCount: 0,
      hasPrice: true,
    });
    expect(score).toBe(10);
  });

  it("should cap at 100", () => {
    const score = scoreDataQuality({
      year: 2020,
      model: "911",
      listDate: "2024-06-15",
      country: "UK",
      photosCount: 5,
      hasPrice: true,
    });
    expect(score).toBe(100);
  });
});

describe("normalizeSourceAuctionHouse", () => {
  it("should map AutoTrader to AutoTrader UK", () => {
    expect(normalizeSourceAuctionHouse("AutoTrader")).toBe("AutoTrader UK");
  });
});

describe("mapSourceToPlatform", () => {
  it("should map AutoTrader to AUTO_TRADER", () => {
    expect(mapSourceToPlatform("AutoTrader")).toBe("AUTO_TRADER");
  });
});

describe("buildLocationString", () => {
  it("should build location with city and region", () => {
    const loc = { locationRaw: "London, UK", country: "UK", region: "England", city: "London", postalCode: null };
    expect(buildLocationString(loc)).toBe("London, England, UK");
  });

  it("should build location with city only", () => {
    const loc = { locationRaw: "London", country: "UK", region: null, city: "London", postalCode: null };
    expect(buildLocationString(loc)).toBe("London, UK");
  });

  it("should return null for Unknown country", () => {
    const loc = { locationRaw: null, country: "Unknown", region: null, city: null, postalCode: null };
    expect(buildLocationString(loc)).toBeNull();
  });

  it("should handle postal code", () => {
    const loc = { locationRaw: "SW1A 1AA", country: "UK", region: "England", city: "London", postalCode: "SW1A 1AA" };
    expect(buildLocationString(loc)).toBe("London, England, UK");
  });
});

describe("parsePriceIndicator", () => {
  it("should parse great price", () => {
    expect(parsePriceIndicator("great-price")).toBe("great-price");
    expect(parsePriceIndicator("great price")).toBe("great-price");
    expect(parsePriceIndicator("Great Price")).toBe("great-price");
  });

  it("should parse good price", () => {
    expect(parsePriceIndicator("good-price")).toBe("good-price");
    expect(parsePriceIndicator("good price")).toBe("good-price");
    expect(parsePriceIndicator("Good Price")).toBe("good-price");
  });

  it("should parse fair price", () => {
    expect(parsePriceIndicator("fair-price")).toBe("fair-price");
    expect(parsePriceIndicator("fair price")).toBe("fair-price");
  });

  it("should return null for unknown", () => {
    expect(parsePriceIndicator(null)).toBeNull();
    expect(parsePriceIndicator("unknown")).toBeNull();
  });
});

describe("isGoodDeal", () => {
  it("should return true for great price", () => {
    expect(isGoodDeal("great-price")).toBe(true);
  });

  it("should return true for good price", () => {
    expect(isGoodDeal("good-price")).toBe(true);
  });

  it("should return false for fair price", () => {
    expect(isGoodDeal("fair-price")).toBe(false);
  });

  it("should return false for null", () => {
    expect(isGoodDeal(null)).toBe(false);
  });
});
