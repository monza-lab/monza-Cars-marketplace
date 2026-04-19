import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockUpdate = vi.fn();
const mockLimit = vi.fn();
const orCalls: string[] = [];
const orderCalls: Array<{ column: string; options?: Record<string, unknown> }> = [];
const orderedQuery = {
  order: vi.fn((column: string, options?: Record<string, unknown>) => {
    orderCalls.push({ column, options });
    return orderedQuery;
  }),
  limit: mockLimit,
};
const queryAfterOr = {
  eq: vi.fn().mockReturnValue(orderedQuery),
  order: orderedQuery.order,
  limit: mockLimit,
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          or: vi.fn((expr: string) => {
            orCalls.push(expr);
            return queryAfterOr;
          }),
        }),
      }),
      update: mockUpdate,
    })),
  })),
}));

// Mock scraper detail modules (required by buildImageFetcherMap)
vi.mock("@/features/scrapers/auctions/bringATrailerImages", () => ({
  fetchBaTImages: vi.fn(),
}));
vi.mock("@/features/scrapers/autoscout24_collector/detail", () => ({
  parseDetailHtml: vi.fn(),
}));
vi.mock("@/features/scrapers/autotrader_collector/detail", () => ({
  fetchAutoTraderDetail: vi.fn(),
}));
vi.mock("@/features/scrapers/beforward_porsche_collector/detail", () => ({
  parseDetailHtml: vi.fn(),
}));

describe("backfillImages module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    orCalls.length = 0;
    orderCalls.length = 0;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("exports backfillImagesForSource function", async () => {
    const mod = await import("./backfillImages");
    expect(typeof mod.backfillImagesForSource).toBe("function");
  });

  it("returns error when Supabase env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { backfillImagesForSource } = await import("./backfillImages");
    const result = await backfillImagesForSource({
      source: "BaT",
      maxListings: 1,
      delayMs: 0,
      timeBudgetMs: 5000,
    });

    expect(result.errors).toContain("Missing Supabase env vars");
    expect(result.discovered).toBe(0);
  });

  it("marks dead URLs as unsold when source returns 404", async () => {
    // Mock global.fetch to return a 404 response.
    // backfillImages calls fetchHtml(url) -> fetch(url) -> checks response.ok.
    // A 404 causes fetchHtml to throw Error("HTTP 404 for ..."),
    // which matches /\b(404|410)\b/ and triggers the dead URL path.
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 404 })
    );

    // Mock: one active listing with no images
    mockLimit.mockResolvedValueOnce({
      data: [
        {
          id: "dead-1",
          source: "BeForward",
          source_url: "https://example.com/404",
        },
      ],
      error: null,
    });

    // Mock: the update call — capture what it receives
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: updateEq });

    const { backfillImagesForSource } = await import("./backfillImages");
    const result = await backfillImagesForSource({
      source: "BeForward",
      maxListings: 1,
      delayMs: 0,
      timeBudgetMs: 30000,
    });

    // The update should include status: 'unsold'
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "unsold",
      })
    );
    // Verify __dead_url__ sentinel is NOT set
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ images: ["__dead_url__"] })
    );
    expect(result.errors[0]).toContain("Dead URL");
  });

  it("queries with photos_count.lt.2 in addition to empty images", async () => {
    orCalls.length = 0;
    mockLimit.mockResolvedValueOnce({ data: [], error: null });
    const { backfillImagesForSource } = await import("./backfillImages");
    await backfillImagesForSource({
      source: "BaT",
      maxListings: 1,
      delayMs: 0,
      timeBudgetMs: 5000,
    });
    expect(orCalls).toContain("images.is.null,images.eq.{},photos_count.lt.2");
    expect(orderCalls).toEqual([
      {
        column: "photos_count",
        options: { ascending: true, nullsFirst: true },
      },
      {
        column: "updated_at",
        options: { ascending: true },
      },
    ]);
  });

  it("accepts AutoTrader as a backfill source", async () => {
    orCalls.length = 0;
    mockLimit.mockResolvedValueOnce({ data: [], error: null });
    const { backfillImagesForSource } = await import("./backfillImages");
    const result = await backfillImagesForSource({
      source: "AutoTrader",
      maxListings: 1,
      delayMs: 0,
      timeBudgetMs: 30000,
    });

    expect(result.errors).toEqual([]);
    expect(orCalls).toContain("images.is.null,images.eq.{},photos_count.lt.2");
  });

  it("uses the AutoTrader detail helper when backfilling AutoTrader images", async () => {
    const { fetchAutoTraderDetail } = await import("@/features/scrapers/autotrader_collector/detail");
    vi.mocked(fetchAutoTraderDetail).mockResolvedValue({
      title: "2020 Porsche 911 Carrera S",
      price: 89950,
      priceText: "£89,950",
      mileage: 12450,
      mileageUnit: "miles",
      location: "London",
      description: "Example",
      images: [
        "https://m.atcdn.co.uk/a/media/{resize}/hero.jpg",
        "https://m.atcdn.co.uk/a/media/{resize}/one.jpg",
      ],
      vin: null,
      exteriorColor: null,
      interiorColor: null,
      transmission: null,
      engine: null,
      bodyStyle: null,
    });

    mockLimit.mockResolvedValueOnce({
      data: [
        {
          id: "auto-1",
          source: "AutoTrader",
          source_url: "https://www.autotrader.co.uk/car-details/202602099784872",
        },
      ],
      error: null,
    });

    const updateEq = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: updateEq });

    const { backfillImagesForSource } = await import("./backfillImages");
    const result = await backfillImagesForSource({
      source: "AutoTrader",
      maxListings: 1,
      delayMs: 0,
      timeBudgetMs: 30000,
    });

    expect(result.backfilled).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [
          "https://m.atcdn.co.uk/a/media/{resize}/hero.jpg",
          "https://m.atcdn.co.uk/a/media/{resize}/one.jpg",
        ],
        photos_count: 2,
      })
    );
  });
});
