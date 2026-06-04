import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchCCHtmlWithScrapling: vi.fn(),
}));

vi.mock("./collectingCarsScrapling", () => ({
  fetchCCHtmlWithScrapling: mocks.fetchCCHtmlWithScrapling,
}));

import { scrapeDetail, type CCarsAuction } from "./collectingCars";

const baseAuction: CCarsAuction = {
  externalId: "cc-test",
  platform: "COLLECTING_CARS",
  title: "1973 Porsche 911",
  make: "Porsche",
  model: "911",
  year: 1973,
  mileage: null,
  mileageUnit: "miles",
  transmission: null,
  engine: null,
  exteriorColor: null,
  interiorColor: null,
  location: null,
  currentBid: null,
  bidCount: 0,
  endTime: null,
  url: "https://collectingcars.com/cars/test",
  imageUrl: null,
  description: null,
  sellerNotes: null,
  status: "active",
  vin: null,
  images: [],
};

describe("Collecting Cars detail identifier extraction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    mocks.fetchCCHtmlWithScrapling.mockReset();
    mocks.fetchCCHtmlWithScrapling.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each([
    ["VIN", "WP0AA299XYS123456", "WP0AA299XYS123456"],
    ["Chassis Number", "9113601234", "9113601234"],
    ["Chassis", "9113601234", "9113601234"],
    ["Serial", "f106-ab 12345", "F106AB12345"],
  ])("extracts %s identifiers", async (label, value, expected) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`
      <html><body><ul class="key-facts"><li>${label}: ${value}</li></ul></body></html>
    `, { status: 200 })) as any);

    const pending = scrapeDetail(baseAuction);
    await vi.advanceTimersByTimeAsync(3000);
    const out = await pending;

    expect(out.vin).toBe(expected);
  });
});
