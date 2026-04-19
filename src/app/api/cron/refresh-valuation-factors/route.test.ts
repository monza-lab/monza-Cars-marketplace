import { describe, it, expect, vi, beforeEach } from "vitest";

const mockChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  range: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
};
const invalidateDashboardCache = vi.fn();
const storeDashboardRegionalValuationByFamily = vi.fn(async () => undefined);

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => mockChain),
  })),
}));

vi.mock("@/lib/dashboardCache", () => ({
  invalidateDashboardCache,
}));

vi.mock("@/lib/dashboardValuationCache", () => ({
  storeDashboardRegionalValuationByFamily,
}));

vi.mock("@/lib/exchangeRates", async () => ({
  getExchangeRates: async () => ({ USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.25 }),
  toUsd: (amount: number, currency: string | null | undefined, rates: Record<string, number>) => {
    if (!amount || amount <= 0) return 0;
    const cur = currency?.toUpperCase();
    if (!cur || cur === "USD") return amount;
    const rate = rates[cur];
    return rate ? amount / rate : amount;
  },
}));

describe("refresh-valuation-factors route", () => {
  beforeEach(() => {
    // NODE_ENV is read-only, skip it
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-key";
  });

  it("returns a factor table JSON response in dev", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://x/"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty("table.porscheWide");
    expect(body).toHaveProperty("table.byFamily");
    expect(storeDashboardRegionalValuationByFamily).toHaveBeenCalledTimes(1);
    expect(invalidateDashboardCache).toHaveBeenCalledTimes(1);
  });
});
