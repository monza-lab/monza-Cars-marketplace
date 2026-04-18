import { describe, it, expect, vi } from "vitest";

const or = vi.fn();

vi.mock("@supabase/supabase-js", () => {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: (clause: string) => { or(clause); return chain; },
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    createClient: () => ({ from: () => chain }),
  };
});

describe("querySourceBucket (collapsed OR)", () => {
  it("issues exactly one source/platform OR per canonical source", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
    vi.resetModules();
    const { fetchLiveListingsAsCollectorCars } = await import("./supabaseLiveListings");
    await fetchLiveListingsAsCollectorCars({ make: "Porsche", limit: 50, includeAllSources: true, includePriceHistory: false });

    const bucketCalls = or.mock.calls.filter(([clause]) => typeof clause === "string" && clause.includes("source.in.("));
    // One per canonical source in ALL_QUERY_SOURCES (BaT, AutoScout24, AutoTrader, BeForward, CarsAndBids, CollectingCars, ClassicCom, Elferspot)
    expect(bucketCalls).toHaveLength(8);
  });
});
