import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Chainable mock: eq is what resolves to { data, error }
const eq = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq }) }),
  }),
}));

describe("fetchLiveListingAggregateCounts", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("happy path — sums counts into platform and location buckets", async () => {
    eq.mockResolvedValueOnce({
      data: [
        { source: "BaT",         region_by_country: "US", live_count: 100 },
        { source: "AutoScout24", region_by_country: "EU", live_count:  60 },
        { source: "Elferspot",   region_by_country: "EU", live_count:  20 },
        { source: "AutoTrader",  region_by_country: "UK", live_count:  15 },
        { source: "BeForward",   region_by_country: "JP", live_count:  10 },
        { source: "ClassicCom",  region_by_country: "US", live_count:  25 },
      ],
      error: null,
    });

    const { fetchLiveListingAggregateCounts } = await import("./supabaseLiveListings");
    const result = await fetchLiveListingAggregateCounts();

    expect(result.liveNow).toBe(230);
    expect(result.regionTotalsByPlatform).toEqual({ all: 230, US: 125, EU: 80, UK: 15, JP: 10 });
    expect(result.regionTotalsByLocation).toEqual({ all: 230, US: 125, EU: 80, UK: 15, JP: 10 });
  });

  it("NULL country falls back to US for location totals", async () => {
    eq.mockResolvedValueOnce({
      data: [
        { source: "BaT", region_by_country: null, live_count: 50 },
      ],
      error: null,
    });

    const { fetchLiveListingAggregateCounts } = await import("./supabaseLiveListings");
    const result = await fetchLiveListingAggregateCounts();

    expect(result.liveNow).toBe(50);
    expect(result.regionTotalsByLocation.US).toBe(50);
    expect(result.regionTotalsByLocation.EU).toBe(0);
    expect(result.regionTotalsByLocation.UK).toBe(0);
    expect(result.regionTotalsByLocation.JP).toBe(0);
  });

  it("MV missing → returns zero object and logs console.warn (not console.error)", async () => {
    eq.mockResolvedValueOnce({
      data: null,
      error: { message: 'relation "listings_active_counts" does not exist' },
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { fetchLiveListingAggregateCounts } = await import("./supabaseLiveListings");
    const result = await fetchLiveListingAggregateCounts();

    expect(result).toEqual({
      liveNow: 0,
      regionTotalsByPlatform: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 },
      regionTotalsByLocation: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 },
    });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/listings_active_counts MV missing/);
    expect(errorSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("env missing → returns zero object without calling Supabase", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const { fetchLiveListingAggregateCounts } = await import("./supabaseLiveListings");
    const result = await fetchLiveListingAggregateCounts();

    expect(result).toEqual({
      liveNow: 0,
      regionTotalsByPlatform: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 },
      regionTotalsByLocation: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 },
    });
    expect(eq).not.toHaveBeenCalled();
  });
});
