import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("@/features/scrapers/common/listingValidator", () => ({
  validateListing: vi.fn(() => ({ valid: true })),
}));

import { createSupabaseWriter } from "./supabase_writer";
import type { NormalizedListing, ScrapeMeta } from "./types";

function makeListing(overrides: Partial<NormalizedListing> = {}): NormalizedListing {
  return {
    source: "ClassicCom",
    sourceId: "classic-123",
    sourceUrl: "https://www.classic.com/veh/2023-porsche-911-gt3-WP0AC2A98PS230517-abc1234/",
    title: "2023 Porsche 911 GT3",
    platform: "CLASSIC_COM",
    sellerNotes: null,
    endTime: null,
    startTime: null,
    reserveStatus: null,
    finalPrice: null,
    locationString: null,
    year: 2023,
    make: "Porsche",
    model: "911",
    trim: null,
    bodyStyle: null,
    engine: null,
    transmission: null,
    exteriorColor: null,
    interiorColor: null,
    vin: "WP0AC2A98PS230517",
    mileageKm: null,
    mileageUnitStored: "km",
    status: "active",
    reserveMet: null,
    listDate: "2026-04-18",
    saleDate: null,
    auctionDate: null,
    auctionHouse: "Classic.com",
    descriptionText: null,
    photos: ["https://images.classic.com/vehicles/new-1.jpg"],
    photosCount: 1,
    location: {
      locationRaw: null,
      country: "US",
      region: null,
      city: null,
      postalCode: null,
    },
    pricing: {
      hammerPrice: null,
      currentBid: null,
      bidCount: null,
      originalCurrency: "USD",
      rawPriceText: null,
    },
    dataQualityScore: 80,
    ...overrides,
  };
}

const meta: ScrapeMeta = {
  runId: "run-1",
  scrapeTimestamp: "2026-04-18T12:00:00.000Z",
};

describe("classic_collector supabase writer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("falls back to source_url update and preserves existing images", async () => {
    const update = vi.fn(() => ({
      eq: () => ({
        select: () => ({
          limit: () => Promise.resolve({
            data: [{ id: "existing-row" }],
            error: null,
          }),
        }),
      }),
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table !== "listings") return {};

      return {
        upsert: () => ({
          select: () => ({
            limit: () => Promise.resolve({
              data: null,
              error: { message: 'duplicate key value violates unique constraint "listings_source_url_key"' },
            }),
          }),
        }),
        select: () => ({
          eq: () => ({
            limit: () => Promise.resolve({
              data: [{ id: "existing-row", images: ["https://images.classic.com/vehicles/existing.jpg"] }],
              error: null,
            }),
          }),
        }),
        update,
        from: mockFrom,
      };
    });

    const writer = createSupabaseWriter();
    const result = await writer.upsertAll(makeListing(), meta, false);

    expect(result).toEqual({ listingId: "existing-row", wrote: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [
          "https://images.classic.com/vehicles/existing.jpg",
          "https://images.classic.com/vehicles/new-1.jpg",
        ],
        photos_count: 2,
      }),
    );
  });
});
