import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock Supabase
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      is: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  }),
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
    })),
  })),
}));

// Mock detail parser
vi.mock("@/features/scrapers/autoscout24_collector/detail", () => ({
  parseDetailHtml: vi.fn(),
}));

// Mock monitoring
vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

import { parseDetailHtml } from "@/features/scrapers/autoscout24_collector/detail";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring";

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/enrich-details", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/enrich-details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("returns 401 without valid auth", async () => {
    const response = await GET(makeRequest("wrong"));
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  it("returns 200 with empty results when no listings need enrichment", async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.discovered).toBe(0);
    expect(data.enriched).toBe(0);
  });

  it("calls monitoring lifecycle functions", async () => {
    await GET(makeRequest());

    expect(markScraperRunStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        scraperName: "enrich-details",
        runtime: "vercel_cron",
      })
    );
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "enrich-details",
        success: true,
      })
    );
    expect(clearScraperRunActive).toHaveBeenCalledWith("enrich-details");
  });

  it("returns 500 when Supabase env vars missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain("Supabase");
  });

  it("includes duration in response", async () => {
    const response = await GET(makeRequest());
    const data = await response.json();
    expect(data.duration).toMatch(/^\d+ms$/);
  });

  it("marks listing as attempted when no fields extracted", async () => {
    // Mock returning a listing
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{ id: "test-id", source_url: "https://www.autoscout24.com/offers/test" }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    // Mock fetch returning valid HTML
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue("<html><body>empty page</body></html>"),
    }) as unknown as typeof fetch;

    // Mock parseDetailHtml returning no useful fields
    const { parseDetailHtml } = await import("@/features/scrapers/autoscout24_collector/detail");
    vi.mocked(parseDetailHtml).mockReturnValue({
      title: "", price: null, currency: null, year: null, make: null, model: null,
      trim: null, mileageKm: null, transmission: null, fuelType: null, engine: null,
      power: null, bodyStyle: null, exteriorColor: null, interiorColor: null,
      vin: null, location: null, country: null, region: null, sellerType: null,
      sellerName: null, description: null, images: [], firstRegistration: null, features: [],
    });

    const response = await GET(makeRequest());
    const data = await response.json();
    expect(data.success).toBe(true);

    // Should have called update with trim = '' even though no fields extracted
    expect(mockUpdate).toHaveBeenCalled();
  });
});
