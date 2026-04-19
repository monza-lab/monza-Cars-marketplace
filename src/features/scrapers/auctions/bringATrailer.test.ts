import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchBaTDetailHtmlWithScrapling: vi.fn(),
}));

vi.mock("./batScrapling", () => ({
  canUseBaTScraplingFallback: () => true,
  fetchBaTDetailHtmlWithScrapling: mocks.fetchBaTDetailHtmlWithScrapling,
}));

import { scrapeDetail } from "./bringATrailer";

const baseAuction = {
  externalId: "bat-test",
  platform: "BRING_A_TRAILER",
  title: "1998 Ferrari 550 Maranello Spider",
  make: "Ferrari",
  model: "550 Maranello",
  year: 1998,
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
  url: "https://bringatrailer.com/listing/test/",
  imageUrl: null,
  description: null,
  sellerNotes: null,
  status: "active",
  vin: null,
  images: [],
  reserveStatus: null,
  bodyStyle: null,
};

const primaryHtml = `
  <html><body>
    <div class="essentials">
      <li>17k Miles Shown on Replacement Speedometer</li>
      <li>Transmission: 6-Speed Manual</li>
      <li>Chassis: WP0AA299XYS123456</li>
      <li>Rosso Corsa Paint</li>
      <li>Black Leather Upholstery</li>
      <li>4.9L Flat-12</li>
      <li>Spider</li>
    </div>
    <div class="current-bid-value">$185,000</div>
    <div class="number-bids-value">12 bids</div>
    <div class="post-excerpt">Fresh service and sorted example.</div>
    <div class="seller-story">Seller notes here</div>
    <div class="listing-available-info">Reserve met</div>
    <img src="https://cdn.bringatrailer.com/wp-content/uploads/test.jpg" width="1200" height="800" />
  </body></html>
`;

const fallbackHtml = `
  <html><body>
    <div class="essentials">
      <li>Chassis: WP0AA299XYS123456</li>
      <li>Guards Red Paint</li>
      <li>Black Leather Upholstery</li>
      <li>4.9L Flat-12</li>
      <li>6-Speed Manual</li>
      <li>Spider</li>
    </div>
  </body></html>
`;

const fallbackDescriptionHtml = `
  <html><body>
    <div class="post-excerpt">Showing 36,000 miles on the odometer.</div>
    <div class="essentials">
      <li>Chassis: WP0AA299XYS123456</li>
      <li>Guards Red Paint</li>
      <li>Black Leather Upholstery</li>
      <li>4.9L Flat-12</li>
      <li>6-Speed Manual</li>
      <li>Spider</li>
    </div>
  </body></html>
`;

describe("BaT detail recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(primaryHtml, { status: 200 })) as any);
    mocks.fetchBaTDetailHtmlWithScrapling.mockReset();
    mocks.fetchBaTDetailHtmlWithScrapling.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not let mileage-like text overwrite transmission and recovers essentials fields", async () => {
    const pending = scrapeDetail(baseAuction as any);
    await vi.advanceTimersByTimeAsync(2500);
    const out = await pending;

    expect(out.mileage).toBe(17000);
    expect(out.transmission).toBe("6-Speed Manual");
    expect(out.vin).toBe("WP0AA299XYS123456");
    expect(out.exteriorColor).toBe("Rosso Corsa");
    expect(out.interiorColor).toBe("Black Leather");
    expect(out.engine).toBe("4.9L Flat-12");
    expect(out.bodyStyle).toBe("Spider");
    expect(out.currentBid).toBe(185000);
    expect(out.bidCount).toBe(12);
    expect(out.reserveStatus).toBe("RESERVE_MET");
    expect(out.sellerNotes).toBe("Seller notes here");
    expect(out.images).toHaveLength(1);
  });

  it("uses Scrapling when the HTTP fetch leaves key BaT fields missing", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(`
      <html><body>
        <div class="post-content">no specs here</div>
        <div class="current-bid-value">$175,000</div>
      </body></html>
    `, { status: 200 }) as any);
    mocks.fetchBaTDetailHtmlWithScrapling.mockResolvedValueOnce(fallbackHtml);

    const pending = scrapeDetail(baseAuction as any);
    await vi.advanceTimersByTimeAsync(2500);
    const out = await pending;

    expect(mocks.fetchBaTDetailHtmlWithScrapling).toHaveBeenCalledTimes(1);
    expect(out.vin).toBe("WP0AA299XYS123456");
    expect(out.exteriorColor).toBe("Guards Red");
    expect(out.interiorColor).toBe("Black Leather");
    expect(out.engine).toBe("4.9L Flat-12");
    expect(out.transmission).toBe("6-Speed Manual");
    expect(out.bodyStyle).toBe("Spider");
    expect(out.currentBid).toBe(175000);
  });

  it("lets higher-confidence Scrapling mileage replace weaker primary mileage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`
      <html><body>
        <h1>17k-Mile 1998 Ferrari 550 Maranello Spider</h1>
        <div class="post-excerpt">Auction notes only.</div>
      </body></html>
    `, { status: 200 })) as any);
    mocks.fetchBaTDetailHtmlWithScrapling.mockResolvedValueOnce(fallbackDescriptionHtml);

    const pending = scrapeDetail(baseAuction as any);
    await vi.advanceTimersByTimeAsync(2500);
    const out = await pending;

    expect(mocks.fetchBaTDetailHtmlWithScrapling).toHaveBeenCalledTimes(1);
    expect(out.mileage).toBe(36000);
    expect(out.mileageUnit).toBe("miles");
  });
});
