import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Chainable mock: eq is what resolves to { data, error }
const eq = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq }) }),
  }),
}));

describe("fetchSeriesCounts", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sums live_count per series and skips __null sentinel", async () => {
    eq.mockResolvedValueOnce({
      data: [
        { series: "992", live_count: 10 },
        { series: "992", live_count: 5 },
        { series: "991", live_count: 7 },
        { series: "__null", live_count: 3 },
      ],
      error: null,
    });

    // Dynamic import so vi.resetModules() takes effect each test
    const { fetchSeriesCounts } = await import("./supabaseLiveListings");
    const result = await fetchSeriesCounts("porsche");

    expect(result).toEqual({ "992": 15, "991": 7 });
    // __null should be excluded
    expect(result["__null"]).toBeUndefined();
  });

  it("returns {} and logs console.warn when the MV does not exist", async () => {
    eq.mockResolvedValueOnce({
      data: null,
      error: { message: 'relation "listings_active_counts" does not exist' },
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { fetchSeriesCounts } = await import("./supabaseLiveListings");
    const result = await fetchSeriesCounts("porsche");

    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/listings_active_counts MV missing/);
    expect(errorSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("returns {} and logs console.error on any other Supabase error", async () => {
    eq.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied for table listings_active_counts" },
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { fetchSeriesCounts } = await import("./supabaseLiveListings");
    const result = await fetchSeriesCounts("porsche");

    expect(result).toEqual({});
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][0]).toMatch(/fetchSeriesCounts MV query failed/);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("returns {} when NEXT_PUBLIC_SUPABASE_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const { fetchSeriesCounts } = await import("./supabaseLiveListings");
    const result = await fetchSeriesCounts("porsche");

    expect(result).toEqual({});
    // eq should never have been called
    expect(eq).not.toHaveBeenCalled();
  });

  it("aggregates counts by region and preserves the full series list", async () => {
    eq.mockResolvedValueOnce({
      data: [
        { series: "992", region_by_country: "US", live_count: 3 },
        { series: "992", region_by_country: "EU", live_count: 2 },
        { series: "991", region_by_country: null, live_count: 4 },
        { series: "__null", region_by_country: "US", live_count: 99 },
      ],
      error: null,
    });

    const { fetchSeriesCountsByRegion } = await import("./supabaseLiveListings");
    const result = await fetchSeriesCountsByRegion("porsche");

    expect(result).toEqual({
      all: { "992": 5, "991": 4 },
      US: { "992": 3, "991": 4 },
      UK: {},
      EU: { "992": 2 },
      JP: {},
    });
  });
});
