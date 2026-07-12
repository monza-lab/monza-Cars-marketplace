import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

const net = vi.hoisted(() => ({
  fetchHtml: vi.fn(),
}));

const detail = vi.hoisted(() => ({
  parseDetailHtml: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: supabase.createClient,
}));

vi.mock("./net", () => ({
  fetchHtml: net.fetchHtml,
}));

vi.mock("./detail", () => ({
  parseDetailHtml: detail.parseDetailHtml,
}));

import {
  createSupabaseWriter,
  loadCoverageState,
  mapNormalizedListingToListingsRow,
  refreshActiveListings,
  saveCoverageState,
} from "./supabase_writer";
import type { NormalizedListing, ScrapeMeta } from "./types";

function makeListing(overrides: Partial<NormalizedListing> = {}): NormalizedListing {
  return {
    source: "BeForward",
    sourceId: "bf-CC227877",
    sourceUrl: "https://www.beforward.jp/porsche/911/cc227877/id/14244419/",
    title: "2016 PORSCHE 911 991H1 CC227877",
    platform: "BE_FORWARD",
    sellerNotes: "Non Smoker",
    endTime: null,
    startTime: null,
    reserveStatus: null,
    finalPrice: null,
    locationString: "Osaka, Japan",
    year: 2016,
    make: "Porsche",
    model: "911",
    trim: "991H1",
    bodyStyle: null,
    engine: "3,000cc",
    transmission: "Automatic",
    exteriorColor: "White",
    interiorColor: null,
    vin: "WP0ZZZ99ZHS111949",
    sourceVehicleIdentifier: {
      raw: "WP0ZZZ99ZHS111949",
      normalized: "WP0ZZZ99ZHS111949",
      kind: "vin_17",
      sourceLabel: "Chassis No.",
    },
    mileageKm: 51793,
    mileageUnitStored: "km",
    status: "active",
    reserveMet: null,
    listDate: "2026-02-22",
    saleDate: "2026-02-22",
    auctionDate: "2026-02-22",
    auctionHouse: "BeForward",
    descriptionText: null,
    photos: ["https://image-cdn.beforward.jp/large/202602/14244419/CC227877_1ce601b3.jpg"],
    photosCount: 1,
    location: {
      locationRaw: "OSAKA",
      country: "Japan",
      region: null,
      city: "Osaka",
      postalCode: null,
    },
    pricing: {
      hammerPrice: null,
      currentBid: 61160,
      bidCount: null,
      originalCurrency: "USD",
      rawPriceText: "$61160",
    },
    dataQualityScore: 85,
    ...overrides,
  };
}

function makeRefreshClient(statusHtml: string | Error, updates: unknown[] = []) {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));
  const listings = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: "listing-1", source_url: "https://www.beforward.jp/porsche/911/aa/id/1/" }],
              error: null,
            }),
          })),
        })),
      })),
    })),
    update: vi.fn((payload: unknown) => {
      updates.push(payload);
      return { eq: updateEq };
    }),
  };

  supabase.createClient.mockReturnValue({
    from: vi.fn((table: string) => {
      expect(table).toBe("listings");
      return listings;
    }),
  });

  if (statusHtml instanceof Error) {
    net.fetchHtml.mockRejectedValue(statusHtml);
  } else {
    net.fetchHtml.mockResolvedValue(statusHtml);
  }

  return { update, updateEq, updates };
}

function makeWriterClient(previousStatus: string | null = null, previousPhotosCount: number | null = null) {
  const upsert = vi.fn(() => ({
    select: vi.fn(() => ({
      limit: vi.fn().mockResolvedValue({ data: [{ id: "listing-1" }], error: null }),
    })),
  }));
  const insert = vi.fn().mockResolvedValue({ error: null });
  const priceHistoryUpsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === "listings") {
      return {
        select: vi.fn((columns: string) => {
          if (columns === "status" || columns === "status,photos_count") {
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: previousStatus
                      ? [{ status: previousStatus, photos_count: previousPhotosCount }]
                      : [],
                    error: null,
                  }),
                })),
              })),
            };
          }
          return { limit: vi.fn().mockResolvedValue({ error: null }) };
        }),
        upsert,
      };
    }
    if (table === "price_history") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        })),
        insert,
        upsert: priceHistoryUpsert,
      };
    }
    throw new Error(`unexpected table ${table}`);
  });

  supabase.createClient.mockReturnValue({ from });
  return { upsert, insert };
}

const reliableHtml = `${" ".repeat(50_001)} beforward schema.org vehicle`;

describe("beforward_porsche_collector supabase mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  });

  it("maps normalized listing to row shape", () => {
    const listing = makeListing();

    const meta: ScrapeMeta = {
      runId: "run-1",
      scrapeTimestamp: "2026-02-22T00:00:00.000Z",
    };

    const row = mapNormalizedListingToListingsRow(listing, meta);
    expect(row.source).toBe("BeForward");
    expect(row.source_id).toBe("bf-CC227877");
    expect(row.platform).toBe("BE_FORWARD");
    expect(row.current_bid).toBe(61160);
    expect(row.country).toBe("Japan");
  });

  it("does not truncate non-VIN chassis identifiers into vin", () => {
    const listing = makeListing({
      title: "1973 PORSCHE 911",
      year: 1973,
      trim: null,
      engine: "2,400cc",
      transmission: "Manual",
      vin: null,
      sourceVehicleIdentifier: {
        raw: "9113601234",
        normalized: "9113601234",
        kind: "chassis_or_serial",
        sourceLabel: "Chassis No.",
      },
      photos: [],
      photosCount: 0,
      dataQualityScore: 65,
    });

    const row = mapNormalizedListingToListingsRow(listing, {
      runId: "run-1",
      scrapeTimestamp: "2026-02-22T00:00:00.000Z",
    });

    expect(row.vin).toBeNull();
    expect(row.enrichment_meta).toEqual({
      beforward: {
        vehicleIdentifier: {
          raw: "9113601234",
          normalized: "9113601234",
          kind: "chassis_or_serial",
          sourceLabel: "Chassis No.",
        },
      },
    });
  });

  it("maps active rows with status and verification timestamps for reactivation upserts", () => {
    const row = mapNormalizedListingToListingsRow(makeListing({ status: "active" }), {
      runId: "run-1",
      scrapeTimestamp: "2026-02-22T00:00:00.000Z",
    });

    expect(row.status).toBe("active");
    expect(row.updated_at).toBe("2026-02-22T00:00:00.000Z");
    expect(row.scrape_timestamp).toBe("2026-02-22T00:00:00.000Z");
    expect(row.last_verified_at).toEqual(expect.any(String));
  });

  it("persists BeForward OTHER model rows instead of skipping them as invalid", async () => {
    makeWriterClient();
    const writer = createSupabaseWriter();

    const result = await writer.upsertAll(makeListing({
      sourceUrl: "https://www.beforward.jp/porsche/porsche-others/cb893406/id/13958025/",
      sourceId: "bf-CB893406",
      title: "2016 PORSCHE PORSCHE OTHERS",
      model: "OTHER",
    }), {
      runId: "run-1",
      scrapeTimestamp: "2026-06-07T00:00:00.000Z",
    }, false);

    expect(result).toMatchObject({ listingId: "listing-1", wrote: true, currentStatus: "active" });
  });

  it("preserves an existing gallery when a summary-only run carries one thumbnail", async () => {
    const { upsert } = makeWriterClient("active", 20);
    const writer = createSupabaseWriter();

    await writer.upsertAll(makeListing({
      photos: ["https://image-cdn.beforward.jp/medium/202607/15864663/CD906651_1ffb785f.JPG?w=200"],
      photosCount: 1,
    }), {
      runId: "run-summary",
      scrapeTimestamp: "2026-07-12T00:00:00.000Z",
      summaryOnly: true,
    }, false);

    const payload = upsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("images");
    expect(payload).not.toHaveProperty("photos_count");
  });

  it("does not fail the listing write when a concurrent run already inserted the hourly price snapshot", async () => {
    const duplicatePriceHistoryInsert = new Error(
      'duplicate key value violates unique constraint "price_history_pkey"',
    );
    const upsert = vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({ data: [{ id: "listing-1" }], error: null }),
      })),
    }));
    const insert = vi.fn().mockResolvedValue({ error: { message: duplicatePriceHistoryInsert.message } });
    const priceHistoryUpsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "listings") {
        return {
          select: vi.fn((columns: string) => {
            if (columns === "status,photos_count") {
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  })),
                })),
              };
            }
            return { limit: vi.fn().mockResolvedValue({ error: null }) };
          }),
          upsert,
        };
      }
      if (table === "price_history") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
          insert,
          upsert: priceHistoryUpsert,
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    supabase.createClient.mockReturnValue({ from });
    const writer = createSupabaseWriter();

    await expect(writer.upsertAll(makeListing(), {
      runId: "run-1",
      scrapeTimestamp: "2026-06-07T10:42:00.000Z",
    }, false)).resolves.toMatchObject({ listingId: "listing-1", wrote: true });
    expect(priceHistoryUpsert).toHaveBeenCalledWith(expect.objectContaining({
      listing_id: "listing-1",
      time: "2026-06-07T10:00:00.000Z",
    }), { onConflict: "listing_id,time" });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("beforward_porsche_collector coverage state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  });

  it("returns page 1 when coverage state is missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    supabase.createClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    });

    await expect(loadCoverageState()).resolves.toEqual({
      nextPage: 1,
      sourceTotalPages: null,
      completedAt: null,
    });
  });

  it("loads existing coverage state nextPage", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { state: { nextPage: 76, sourceTotalPages: 143, completedAt: null } },
      error: null,
    });
    supabase.createClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    });

    await expect(loadCoverageState()).resolves.toEqual({
      nextPage: 76,
      sourceTotalPages: 143,
      completedAt: null,
    });
  });

  it("saves coverage state with the scraper key", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    supabase.createClient.mockReturnValue({
      from: vi.fn((table: string) => {
        expect(table).toBe("scraper_state");
        return { upsert };
      }),
    });

    await saveCoverageState({ nextPage: 51, sourceTotalPages: 143, completedAt: null });

    expect(upsert).toHaveBeenCalledWith({
      scraper_name: "beforward_coverage",
      state: { nextPage: 51, sourceTotalPages: 143, completedAt: null },
      updated_at: expect.any(String),
    });
  });
});

describe("beforward_porsche_collector active refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  });

  it("does not update status on 403 or 429 responses", async () => {
    const updates: unknown[] = [];
    makeRefreshClient(new Error("HTTP 403 Forbidden"), updates);

    const result403 = await refreshActiveListings({ timeBudgetMs: 10_000 });
    expect(result403.updated).toBe(0);
    expect(updates).toHaveLength(0);

    vi.clearAllMocks();
    makeRefreshClient(new Error("HTTP 429 Too Many Requests"), updates);
    const result429 = await refreshActiveListings({ timeBudgetMs: 10_000 });
    expect(result429.updated).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it("does not update status from short challenge html", async () => {
    const updates: unknown[] = [];
    makeRefreshClient("<html>Access Denied</html>", updates);
    detail.parseDetailHtml.mockReturnValue({
      sourceStatus: "OutOfStock",
      schemaAvailability: "https://schema.org/OutOfStock",
    });

    const result = await refreshActiveListings({ timeBudgetMs: 10_000 });

    expect(result.updated).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it("does not terminalize reliable detail html when status evidence is missing", async () => {
    const updates: unknown[] = [];
    makeRefreshClient(reliableHtml, updates);
    detail.parseDetailHtml.mockReturnValue({
      sourceStatus: null,
      schemaAvailability: null,
    });

    const result = await refreshActiveListings({ timeBudgetMs: 10_000 });

    expect(result.updated).toBe(0);
    expect(result.terminalized).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it("reaffirms in-stock rows as active and updates last_verified_at", async () => {
    const updates: unknown[] = [];
    makeRefreshClient(reliableHtml, updates);
    detail.parseDetailHtml.mockReturnValue({
      sourceStatus: "In-Stock",
      schemaAvailability: "https://schema.org/InStock",
    });

    const result = await refreshActiveListings({ timeBudgetMs: 10_000 });

    expect(result.updated).toBe(1);
    expect(result.terminalized).toBe(0);
    expect(updates[0]).toMatchObject({ status: "active", last_verified_at: expect.any(String) });
  });

  it("terminalizes only explicit out-of-stock on reliable detail html", async () => {
    const updates: unknown[] = [];
    makeRefreshClient(reliableHtml, updates);
    detail.parseDetailHtml.mockReturnValue({
      sourceStatus: "OutOfStock",
      schemaAvailability: "https://schema.org/OutOfStock",
    });

    const result = await refreshActiveListings({ timeBudgetMs: 10_000 });

    expect(result.updated).toBe(1);
    expect(result.terminalized).toBe(1);
    expect(updates[0]).toMatchObject({ status: "delisted", updated_at: expect.any(String) });
  });
});
