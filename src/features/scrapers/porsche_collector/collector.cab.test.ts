import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedListing } from "./types";

const state = vi.hoisted(() => ({
  written: [] as NormalizedListing[],
}));

vi.mock("@/features/scrapers/auctions/carsAndBids", () => ({
  scrapeCarsAndBids: vi.fn(async () => ({
    errors: [],
    auctions: [
      {
        externalId: "cab-3pGnz5yn",
        url: "https://carsandbids.com/auctions/3pGnz5yn/2016-porsche-boxster-spyder",
        title: "2016 Porsche Boxster Spyder",
        make: "Porsche",
        model: "Boxster Spyder",
        year: 2016,
        mileage: null,
        mileageUnit: "miles",
        currentBid: 55000,
        bidCount: 12,
        endTime: new Date("2026-05-20T20:00:00.000Z"),
        imageUrl: "https://cdn.carsandbids.com/cab-live.jpg",
        images: ["https://cdn.carsandbids.com/cab-live.jpg"],
        status: "active",
      },
    ],
  })),
}));

vi.mock("@/features/scrapers/auctions/bringATrailer", () => ({
  scrapeBringATrailer: vi.fn(async () => ({ auctions: [], errors: [] })),
}));

vi.mock("@/features/scrapers/auctions/collectingCars", () => ({
  scrapeCollectingCars: vi.fn(async () => ({ auctions: [], errors: [] })),
}));

vi.mock("@/features/scrapers/common/scraper", () => ({
  fetchAuctionData: vi.fn(async () => ({
    title: null,
    status: null,
    rawPriceText: null,
    currentBid: null,
    bidCount: null,
    endTime: null,
  })),
}));

vi.mock("@/features/scrapers/common/terminalStatus", () => ({
  createTerminalStatusClient: vi.fn(() => ({})),
  fetchTerminalStatusSourceIds: vi.fn(async () => new Set<string>()),
}));

vi.mock("./checkpoint", () => ({
  loadCheckpoint: vi.fn(async () => ({ sources: {} })),
  saveCheckpoint: vi.fn(async () => undefined),
  updateSourceCheckpoint: vi.fn((checkpoint) => checkpoint),
}));

vi.mock("./supabase_writer", () => ({
  createSupabaseWriter: vi.fn(() => ({
    upsertAll: async (listing: NormalizedListing) => {
      state.written.push(listing);
      return { listingId: "test", wrote: true };
    },
  })),
  createDryRunWriter: vi.fn(() => ({
    upsertAll: async (listing: NormalizedListing) => {
      state.written.push(listing);
      return { listingId: "dry_run", wrote: false };
    },
  })),
}));

import { runPorscheCollector } from "./collector";

describe("porsche collector Cars & Bids card fallback data", () => {
  beforeEach(() => {
    state.written = [];
  });

  it("keeps C&B card-level bid, status, and images when detail fetch has no data", async () => {
    const result = await runPorscheCollector({
      mode: "daily",
      make: "Porsche",
      endedWindowDays: 90,
      maxActivePagesPerSource: 1,
      maxEndedPagesPerSource: 0,
      scrapeDetails: false,
      checkpointPath: "test-checkpoint.json",
      dryRun: true,
      sources: ["CarsAndBids"],
    });

    expect(result.sourceCounts.CarsAndBids.written).toBe(1);
    expect(state.written).toHaveLength(1);
    expect(state.written[0].status).toBe("active");
    expect(state.written[0].pricing.currentBid).toBe(55000);
    expect(state.written[0].pricing.bidCount).toBe(12);
    expect(state.written[0].photos).toEqual(["https://cdn.carsandbids.com/cab-live.jpg"]);
    expect(state.written[0].photosCount).toBe(1);
  });
});
