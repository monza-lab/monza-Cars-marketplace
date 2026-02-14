import { describe, it, expect } from "vitest";

import {
  isFerrariListing,
  normalizeMileageToKm,
  parseCurrencyFromText,
  mapAuctionStatus,
  parseLocation,
} from "./normalize";

describe("ferrari_collector normalize", () => {
  it("detects Ferrari listings and rejects Dino/replicas", () => {
    expect(isFerrariListing({ title: "2003 Ferrari 360 Modena" })).toBe(true);
    expect(isFerrariListing({ title: "1973 Ferrari Dino 246 GTS" })).toBe(false);
    expect(isFerrariListing({ title: "Ferrari 458 replica" })).toBe(false);
    expect(isFerrariListing({ title: "Ferrari-powered track car" })).toBe(false);
  });

  it("normalizes mileage to km", () => {
    expect(normalizeMileageToKm(10000, "miles")).toBe(16093);
    expect(normalizeMileageToKm(42000, "km")).toBe(42000);
    expect(normalizeMileageToKm(10000, "")).toBe(null);
  });

  it("parses currency symbols", () => {
    expect(parseCurrencyFromText("$123,000")).toBe("USD");
    expect(parseCurrencyFromText("\u00a3123,000")).toBe("GBP");
    expect(parseCurrencyFromText("\u20ac123,000")).toBe("EUR");
    expect(parseCurrencyFromText("123,000")).toBe(null);
  });

  it("maps statuses", () => {
    expect(mapAuctionStatus({ sourceStatus: "ACTIVE" })).toBe("active");
    expect(mapAuctionStatus({ sourceStatus: "SOLD" })).toBe("sold");
    expect(mapAuctionStatus({ sourceStatus: "NO_SALE" })).toBe("unsold");
    expect(mapAuctionStatus({ sourceStatus: "ENDED", currentBid: 100 })).toBe("sold");
    expect(mapAuctionStatus({ sourceStatus: "ENDED", currentBid: null })).toBe("unsold");

    // Unknown status but close time already passed
    expect(
      mapAuctionStatus({
        sourceStatus: null,
        currentBid: 25000,
        endTime: new Date("2020-01-01T00:00:00Z"),
        now: new Date("2020-01-02T00:00:00Z"),
      }),
    ).toBe("sold");
  });

  it("parses location best-effort", () => {
    expect(parseLocation("Austin, TX")).toEqual({
      locationRaw: "Austin, TX",
      country: "USA",
      region: "TX",
      city: "Austin",
      postalCode: null,
    });

    expect(parseLocation("London, UK").country).toBe("UK");
    expect(parseLocation("Paris, France").country).toBe("France");
    expect(parseLocation(null).country).toBe("Unknown");
  });
});
