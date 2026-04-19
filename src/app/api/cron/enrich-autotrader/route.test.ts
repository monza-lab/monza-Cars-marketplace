import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock Supabase
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      or: vi.fn().mockReturnValue({
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
vi.mock("@/features/scrapers/autotrader_collector/detail", () => ({
  fetchAutoTraderDetail: vi.fn(),
}));

// Mock monitoring
vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from "@supabase/supabase-js";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring";
import { fetchAutoTraderDetail } from "@/features/scrapers/autotrader_collector/detail";

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/enrich-autotrader", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/enrich-autotrader", () => {
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
        scraperName: "enrich-autotrader",
        runtime: "vercel_cron",
      })
    );
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "enrich-autotrader",
        success: true,
      })
    );
    expect(clearScraperRunActive).toHaveBeenCalledWith("enrich-autotrader");
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

  it("writes images and photos_count when detail pages return a gallery", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ id: "row-1", source_url: "https://www.autotrader.co.uk/car-details/202602099784872" }],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ limit });
    const or = vi.fn().mockReturnValue({ order });
    const eq2 = vi.fn().mockReturnValue({ or });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });

    vi.mocked(fetchAutoTraderDetail).mockResolvedValue({
      title: "2020 Porsche 911 Carrera S",
      price: 89950,
      priceText: "£89,950",
      mileage: 12450,
      mileageUnit: "miles",
      location: "London",
      description: "Example",
      images: [
        "https://m.atcdn.co.uk/a/media/hero.jpg",
        "https://m.atcdn.co.uk/a/media/one.jpg",
      ],
      vin: null,
      exteriorColor: null,
      interiorColor: null,
      transmission: null,
      engine: null,
      bodyStyle: null,
    });

    vi.mocked(createClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        select,
        update: mockUpdate,
      })),
    } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [
          "https://m.atcdn.co.uk/a/media/hero.jpg",
          "https://m.atcdn.co.uk/a/media/one.jpg",
        ],
        photos_count: 2,
      })
    );
  });
});
