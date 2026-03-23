import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockUpdate = vi.fn();
const mockLimit = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            // When source !== "all", .eq("source", x) is called after .or()
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: mockLimit,
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: mockLimit,
            }),
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
vi.mock("@/features/scrapers/beforward_porsche_collector/detail", () => ({
  parseDetailHtml: vi.fn(),
}));

describe("backfillImages module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
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
});
