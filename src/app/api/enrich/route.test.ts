import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock exchangeRates BEFORE importing route
vi.mock("@/lib/exchangeRates", () => ({
  getExchangeRates: vi.fn().mockResolvedValue({
    EUR: 0.92,
    GBP: 0.79,
    JPY: 149.5,
  }),
}));

// Mock Supabase
const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockSelectSold = vi.fn().mockResolvedValue({
  data: [
    { id: "a", make: "Porsche", model: "911", year: 2020, hammer_price: 100000, status: "sold" },
    { id: "b", make: "Porsche", model: "911", year: 2021, hammer_price: 120000, status: "sold" },
  ],
  error: null,
});
const mockSelectNoThesis = vi.fn().mockResolvedValue({ data: [], error: null });

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "pricing") {
        return { upsert: mockUpsert };
      }
      if (table === "listings") {
        return {
          select: vi.fn(() => ({
            not: vi.fn(() => ({
              eq: mockSelectSold,
            })),
            is: vi.fn(() => ({
              limit: mockSelectNoThesis,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      return {};
    }),
  })),
}));

describe("POST /api/enrich", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.CRON_SECRET = "test-secret";
  });

  it("uses getExchangeRates for EUR/GBP conversion instead of hardcoded rates", async () => {
    const { getExchangeRates } = await import("@/lib/exchangeRates");
    const { POST } = await import("./route");

    const request = new Request("http://localhost/api/enrich", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    await POST(request);

    expect(getExchangeRates).toHaveBeenCalled();
  });
});
