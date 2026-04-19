import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock Supabase
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
const mockOrder = vi.fn();
mockOrder.mockReturnValue({ order: mockOrder, limit: mockLimit });
const mockOr = vi.fn().mockReturnValue({ order: mockOrder, limit: mockLimit });
const mockLt = vi.fn().mockReturnValue({ or: mockOr, order: mockOrder, limit: mockLimit });
const mockEq2 = vi.fn().mockReturnValue({ lt: mockLt, or: mockOr, is: mockLt, order: mockOrder, limit: mockLimit });
const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2, lt: mockLt, is: mockLt });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });

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
    expect(data.successReason).toBe("enrichment_progress");
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

  it("returns 200 when discovered rows are successfully demoted", async () => {
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: "at-1", source_url: "https://example.com/1" }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });
    vi.mocked(fetchAutoTraderDetail).mockResolvedValueOnce({} as any);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.successReason).toBe("enrichment_progress");
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "enrich-autotrader",
        success: true,
        written: 1,
      })
    );
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

  it("writes current_bid, mileage, and images when recoverable data exists", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: updateEq });
    mockLimit
      .mockResolvedValueOnce({
        data: [
          {
            id: "row-1",
            source_url: "https://www.autotrader.co.uk/car-details/202209029381504",
            current_bid: null,
            mileage: null,
            images: null,
            engine: null,
            transmission: null,
            vin: null,
            color_exterior: null,
            description_text: null,
            status: "active",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    const detailModule = await import("@/features/scrapers/autotrader_collector/detail");
    vi.mocked(detailModule.fetchAutoTraderDetail).mockResolvedValue({
      title: "2016 Porsche 911",
      price: 87500,
      priceText: "£87,500",
      mileage: 18000,
      mileageUnit: "miles",
      location: "LUTON • 32 miles away",
      description: "Great car",
      images: ["https://m.atcdn.co.uk/a/media/one.jpg"],
      vin: null,
      exteriorColor: null,
      interiorColor: null,
      transmission: null,
      engine: null,
      bodyStyle: null,
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        current_bid: 87500,
        hammer_price: 87500,
        mileage: 28968,
        mileage_unit: "km",
        images: ["https://m.atcdn.co.uk/a/media/one.jpg"],
        photos_count: 1,
      })
    );
    expect(updateEq).toHaveBeenCalledWith(
      "id",
      "row-1"
    );
  });
});
