import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchCaBHtmlWithScrapling: vi.fn(),
}));

vi.mock("./carsAndBidsScrapling", () => ({
  fetchCaBHtmlWithScrapling: mocks.fetchCaBHtmlWithScrapling,
}));

import { scrapeDetail, type CaBAuction } from "./carsAndBids";

const baseAuction: CaBAuction = {
  externalId: "cab-test",
  platform: "CARS_AND_BIDS",
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
  url: "https://carsandbids.com/auctions/test",
  imageUrl: null,
  description: null,
  sellerNotes: null,
  status: "active",
  vin: null,
  images: [],
};

describe("Cars & Bids detail identifier extraction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    mocks.fetchCaBHtmlWithScrapling.mockReset();
    mocks.fetchCaBHtmlWithScrapling.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each([
    ["VIN", "WP0AA299XYS123456", "WP0AA299XYS123456"],
    ["Chassis", "9113601234", "9113601234"],
    ["Frame", "f106-ab 12345", "F106AB12345"],
  ])("extracts %s identifiers", async (label, value, expected) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`
      <html><body><ul class="quick-facts"><li>${label}: ${value}</li></ul></body></html>
    `, { status: 200 })) as any);

    const pending = scrapeDetail(baseAuction);
    await vi.advanceTimersByTimeAsync(2500);
    const out = await pending;

    expect(out.vin).toBe(expected);
  });
});
