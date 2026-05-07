import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

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

vi.mock("@/features/scrapers/beforward_porsche_collector/detail", () => ({
  parseDetailHtml: vi.fn(() => ({
    trim: "Sport Classic",
    engine: "3.0L Flat-6",
    transmission: "Manual",
    exteriorColor: "Guards Red",
    vin: "WP0ZZZ99Z",
    fuel: "Gasoline",
  })),
}));

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

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/enrich-beforward", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/enrich-beforward", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("<html><body>ok</body></html>", { status: 200 })
    );
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
        scraperName: "enrich-beforward",
        runtime: "vercel_cron",
      })
    );
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "enrich-beforward",
        success: true,
      })
    );
    expect(clearScraperRunActive).toHaveBeenCalledWith("enrich-beforward");
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

  it("truncates long VIN and fields to fit VARCHAR constraints", async () => {
    // Mock parseDetailHtml to return oversized values
    const detailMod = await import("@/features/scrapers/beforward_porsche_collector/detail");
    vi.mocked(detailMod.parseDetailHtml).mockReturnValueOnce({
      trim: "A".repeat(150), // exceeds VARCHAR(100)
      engine: "B".repeat(120),
      transmission: "C".repeat(110),
      exteriorColor: "D".repeat(105),
      vin: "WVWZZZ3CZWE123456789", // 20 chars, exceeds VARCHAR(17)
      fuel: "Gasoline",
      images: [],
    } as any);

    const row = {
      id: "bef-trunc",
      source_url: "https://example.com/be-forward/trunc",
      images: [],
    };

    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [row], error: null }),
            }),
          }),
        }),
      }),
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const updatePayload = mockUpdate.mock.calls.at(-1)?.[0];
    expect(updatePayload).toBeDefined();
    expect(updatePayload.trim.length).toBe(100);
    expect(updatePayload.engine.length).toBe(100);
    expect(updatePayload.transmission.length).toBe(100);
    expect(updatePayload.color_exterior.length).toBe(100);
    expect(updatePayload.vin.length).toBe(17);
    expect(updatePayload.vin).toBe("WVWZZZ3CZWE123456");
  });

  it("does not write a missing fuel column", async () => {
    const row = {
      id: "bef-1",
      source_url: "https://example.com/be-forward/1",
    };

    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [row], error: null }),
            }),
          }),
        }),
      }),
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const updatePayload = mockUpdate.mock.calls.at(-1)?.[0];
    expect(updatePayload).toBeDefined();
    expect(updatePayload).not.toHaveProperty("fuel_type");
    expect(updatePayload).not.toHaveProperty("fuel");
    expect(updatePayload).toMatchObject({
      trim: "Sport Classic",
      engine: "3.0L Flat-6",
      transmission: "Manual",
      color_exterior: "Guards Red",
      vin: "WP0ZZZ99Z",
    });
  });
});
