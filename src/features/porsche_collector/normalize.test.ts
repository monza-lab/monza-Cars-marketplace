import { describe, it, expect } from "vitest";

import {
  buildLocationString,
  isPorscheListing,
  mapAuctionStatus,
  mapReserveStatus,
  mapReserveStatusFromString,
  mapSourceToPlatform,
  normalizeMileageToKm,
  parseCurrencyFromText,
  parseLocation,
} from "./normalize";

describe("porsche_collector normalize", () => {
  it("detects Porsche listings and rejects replicas", () => {
    expect(isPorscheListing({ title: "2003 Porsche 911 Turbo" })).toBe(true);
    expect(isPorscheListing({ title: "1973 Porsche 911 Carrera RS" })).toBe(true);
    expect(isPorscheListing({ title: "Porsche 550 replica" })).toBe(false);
    expect(isPorscheListing({ title: "Porsche-powered track car" })).toBe(false);
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

  it("maps source to platform enum", () => {
    expect(mapSourceToPlatform("BaT")).toBe("BRING_A_TRAILER");
    expect(mapSourceToPlatform("CarsAndBids")).toBe("CARS_AND_BIDS");
    expect(mapSourceToPlatform("CollectingCars")).toBe("COLLECTING_CARS");
  });

  it("maps reserve status from boolean", () => {
    expect(mapReserveStatus(true)).toBe("RESERVE_MET");
    expect(mapReserveStatus(false)).toBe("RESERVE_NOT_MET");
    expect(mapReserveStatus(null)).toBeNull();
  });

  it("maps reserve status from string", () => {
    expect(mapReserveStatusFromString("NO_RESERVE")).toBe("NO_RESERVE");
    expect(mapReserveStatusFromString("RESERVE_MET")).toBe("RESERVE_MET");
    expect(mapReserveStatusFromString("RESERVE_NOT_MET")).toBe("RESERVE_NOT_MET");
    expect(mapReserveStatusFromString("RESERVE NOT MET")).toBe("RESERVE_NOT_MET");
    expect(mapReserveStatusFromString("no-reserve")).toBe("NO_RESERVE");
    expect(mapReserveStatusFromString(null)).toBeNull();
    expect(mapReserveStatusFromString("unknown")).toBeNull();
  });

  it("builds location string from NormalizedLocation", () => {
    expect(buildLocationString({
      locationRaw: "Austin, TX",
      country: "USA",
      region: "TX",
      city: "Austin",
      postalCode: null,
    })).toBe("Austin, TX, USA");

    expect(buildLocationString({
      locationRaw: null,
      country: "Unknown",
      region: null,
      city: null,
      postalCode: null,
    })).toBeNull();

    expect(buildLocationString({
      locationRaw: "Paris, France",
      country: "France",
      region: null,
      city: "Paris",
      postalCode: null,
    })).toBe("Paris, France");
  });
});
