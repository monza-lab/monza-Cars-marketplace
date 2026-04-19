import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must be before imports) ──────────────────────────────────

const mockUpdate = vi.fn();
const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("./detail", () => ({
  fetchAndParseDetail: vi.fn(),
}));

vi.mock("./net", () => ({
  NavigationRateLimiter: class {
    async waitBeforeNavigation() {}
  },
}));

import { backfillMissingImages } from "./backfill";
import { fetchAndParseDetail } from "./detail";

const mockFetch = vi.mocked(fetchAndParseDetail);

// ── Helpers ─────────────────────────────────────────────────────────

const orCalls: string[] = [];
const eqCalls: Array<[string, unknown]> = [];
const rangeCalls: Array<[number, number]> = [];

type MockRow = {
  id: string;
  source_url: string;
  current_bid?: number | null;
  mileage?: number | null;
  engine?: string | null;
  transmission?: string | null;
  images?: string[] | null;
  photos_count?: number | null;
  description_text?: string | null;
  seller_notes?: string | null;
  vin?: string | null;
  location?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  auction_house?: string | null;
  auction_date?: string | null;
  body_style?: string | null;
  color_exterior?: string | null;
  color_interior?: string | null;
  end_time?: string | null;
  start_time?: string | null;
  title?: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  series?: string | null;
  bid_count?: number | null;
};

function setupSupabaseMock(rows: MockRow[] | MockRow[][] | null, error?: string) {
  const pages = rows === null
    ? null
    : Array.isArray(rows[0]) ? (rows as MockRow[][]) : [rows as MockRow[]];
  let pageIndex = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === "listings") {
      const query: any = {
        select: () => query,
        eq: (field: string, value: unknown) => {
          eqCalls.push([field, value]);
          return query;
        },
        or: (expr: string) => {
          orCalls.push(expr);
          return query;
        },
        order: () => query,
        update: (data: Record<string, unknown>) => {
          mockUpdate(data);
          return {
            eq: () => Promise.resolve({ error: null }),
          };
        },
        range: (from: number, to: number) => {
          rangeCalls.push([from, to]);
          const data = pages === null ? null : (pages[pageIndex++] ?? []);
          return Promise.resolve({
            data,
            error: error ? { message: error } : null,
          });
        },
        limit: () => {
          const data = pages === null ? null : (pages[pageIndex++] ?? []);
          return Promise.resolve({
            data,
            error: error ? { message: error } : null,
          });
        },
      };
      return query;
    }
    return {};
  });
}

function makeRow(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: "row-1",
    source_url: "https://www.classic.com/veh/2023-porsche-911-gt3-rs/abc123",
    current_bid: null,
    mileage: null,
    engine: null,
    transmission: null,
    images: null,
    photos_count: null,
    description_text: null,
    seller_notes: null,
    vin: null,
    location: null,
    city: null,
    region: null,
    country: null,
    auction_house: null,
    auction_date: null,
    body_style: null,
    color_exterior: null,
    color_interior: null,
    end_time: null,
    start_time: null,
    title: "2023 Porsche 911 GT3 RS",
    year: 2023,
    make: "Porsche",
    model: "911 GT3 RS",
    series: null,
    bid_count: null,
    ...overrides,
  };
}

const mockPage = {} as any; // Playwright Page mock (not actually navigated in tests)

const SAMPLE_ROWS = [
  { id: "row-1", source_url: "https://www.classic.com/veh/2023-porsche-911-gt3-rs/abc123" },
  { id: "row-2", source_url: "https://www.classic.com/veh/2019-porsche-718-cayman/def456" },
];

// ── Tests ───────────────────────────────────────────────────────────

describe("classic backfillMissingImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orCalls.length = 0;
    eqCalls.length = 0;
    rangeCalls.length = 0;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("queries with the broader Classic backfill fields", async () => {
    setupSupabaseMock([]);
    await backfillMissingImages({ page: mockPage, timeBudgetMs: 5000, runId: "test" });
    expect(orCalls).toContain(
      "current_bid.is.null,mileage.is.null,engine.is.null,transmission.is.null,description_text.is.null,seller_notes.is.null,vin.is.null,location.is.null,city.is.null,region.is.null,country.is.null,auction_house.is.null,auction_date.is.null,body_style.is.null,color_exterior.is.null,color_interior.is.null,bid_count.is.null,end_time.is.null,series.is.null,images.is.null,images.eq.{},photos_count.lt.2",
    );
    expect(eqCalls).not.toContainEqual(["status", "active"]);
  });

  it("backfills listings that have images on their detail page", async () => {
    setupSupabaseMock([makeRow({ id: "row-1" }), makeRow({ id: "row-2", source_url: "https://www.classic.com/veh/2019-porsche-718-cayman/def456" })]);
    mockFetch
      .mockResolvedValueOnce({
        raw: { images: ["https://images.classic.com/vehicles/img1.jpg", "https://images.classic.com/vehicles/img2.jpg"], description: "Beautiful car" },
      } as any)
      .mockResolvedValueOnce({
        raw: { images: ["https://images.classic.com/vehicles/img3.jpg"], description: "Another beautiful car" },
      } as any);

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.discovered).toBe(2);
    expect(result.backfilled).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        images: ["https://images.classic.com/vehicles/img1.jpg", "https://images.classic.com/vehicles/img2.jpg"],
        photos_count: 2,
      }),
    );
  });

  it("backfills current_bid, mileage, engine, transmission and images from the detail page", async () => {
    setupSupabaseMock([makeRow()]);
    mockFetch.mockResolvedValueOnce({
      raw: {
        price: 245000,
        mileage: 18450,
        engine: "4.0L Flat-6",
        transmission: "7-Speed PDK",
        images: ["https://images.classic.com/vehicles/detail-1.jpg"],
        description: "Original example with detailed notes",
        vin: "WP0CA298X5L001385",
        location: "Miami, Florida, USA",
        auctionHouse: "Gooding & Company",
        auctionDate: "Jan 4, 2026",
        bodyStyle: "Coupe",
        exteriorColor: "White",
        interiorColor: "Black",
        endTime: "2026-01-04T15:00:00.000Z",
        startTime: "2026-01-03T15:00:00.000Z",
      },
    } as any);

    await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        current_bid: 245000,
        mileage: 18450,
        engine: "4.0L Flat-6",
        transmission: "7-Speed PDK",
        images: ["https://images.classic.com/vehicles/detail-1.jpg"],
        photos_count: 1,
        description_text: "Original example with detailed notes",
        seller_notes: "Original example with detailed notes",
        vin: "WP0CA298X5L001385",
        location: "Miami, Florida, USA",
        city: "Miami",
        region: "Florida",
        country: "US",
        auction_house: "Gooding & Company",
        auction_date: "Jan 4, 2026",
        body_style: "Coupe",
        color_exterior: "White",
        color_interior: "Black",
        end_time: "2026-01-04T15:00:00.000Z",
        start_time: "2026-01-03T15:00:00.000Z",
      }),
    );
  });

  it("uses the Classic sentinel when a listing has no numeric price", async () => {
    setupSupabaseMock([makeRow({ current_bid: null, mileage: null, engine: null, transmission: null, images: null })]);
    mockFetch.mockResolvedValueOnce({
      raw: {
        price: null,
        hammerPrice: null,
        mileage: null,
        engine: null,
        transmission: null,
        images: [],
        description: null,
      },
    } as any);

    await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        current_bid: -1,
      }),
    );
  });

  it("still backfills listings whose detail page has no images when other fields are recoverable", async () => {
    setupSupabaseMock([makeRow(), makeRow({ id: "row-2", source_url: "https://www.classic.com/veh/2019-porsche-718-cayman/def456" })]);
    mockFetch
      .mockResolvedValueOnce({ raw: { images: [] } } as any)
      .mockResolvedValueOnce({
        raw: { images: ["https://images.classic.com/vehicles/img.jpg"] },
      } as any);

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.discovered).toBe(2);
    expect(result.backfilled).toBe(2);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it("circuit-breaks on Cloudflare challenge", async () => {
    setupSupabaseMock([makeRow(), makeRow({ id: "row-2", source_url: "https://www.classic.com/veh/2019-porsche-718-cayman/def456" })]);
    mockFetch.mockRejectedValueOnce(new Error("Cloudflare challenge not resolved"));

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Circuit-break.*Cloudflare/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("stops when time budget is exhausted", async () => {
    setupSupabaseMock([makeRow(), makeRow({ id: "row-2", source_url: "https://www.classic.com/veh/2019-porsche-718-cayman/def456" })]);

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 0,
      runId: "test-run",
    });

    expect(result.discovered).toBe(2);
    expect(result.backfilled).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns early when no listings need backfill", async () => {
    setupSupabaseMock([]);

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.discovered).toBe(0);
    expect(result.backfilled).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("handles missing Supabase env vars", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.errors).toContain("Missing Supabase env vars");
  });

  it("handles Supabase query errors gracefully", async () => {
    setupSupabaseMock(null, "Connection timeout");

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.errors).toContain("Connection timeout");
    expect(result.discovered).toBe(0);
  });

  it("continues on non-blocking fetch errors", async () => {
    setupSupabaseMock([makeRow(), makeRow({ id: "row-2", source_url: "https://www.classic.com/veh/2019-porsche-718-cayman/def456" })]);
    mockFetch
      .mockRejectedValueOnce(new Error("Navigation timeout"))
      .mockResolvedValueOnce({
        raw: { images: ["https://images.classic.com/vehicles/img.jpg"] },
      } as any);

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.backfilled).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Navigation timeout/);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("passes correct options to fetchAndParseDetail", async () => {
    setupSupabaseMock([makeRow()]);
    mockFetch.mockResolvedValueOnce({
      raw: { images: ["https://images.classic.com/vehicles/img.jpg"] },
    } as any);

    await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      pageTimeoutMs: 15_000,
      runId: "test-run-123",
    });

    expect(mockFetch).toHaveBeenCalledWith({
      page: mockPage,
      url: SAMPLE_ROWS[0].source_url,
      pageTimeoutMs: 15_000,
      runId: "test-run-123",
    });
  });

  it("sweeps multiple batches until the rows are exhausted", async () => {
    setupSupabaseMock([
      [makeRow({ id: "row-1" })],
      [makeRow({ id: "row-2", source_url: "https://www.classic.com/veh/2019-porsche-718-cayman/def456" })],
      [],
    ]);
    mockFetch
      .mockResolvedValueOnce({ raw: { images: ["https://images.classic.com/vehicles/1.jpg"] } } as any)
      .mockResolvedValueOnce({ raw: { images: ["https://images.classic.com/vehicles/2.jpg"] } } as any);

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 120_000,
      runId: "test-run",
      batchSize: 1,
    });

    expect(result.discovered).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(rangeCalls.length).toBeGreaterThanOrEqual(2);
  });
});
