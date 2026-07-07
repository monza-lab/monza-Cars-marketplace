import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchActionableTargetRows, GET } from "./route";

// Mock Supabase
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockOr = vi.fn().mockReturnValue({
  order: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
});
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      is: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      or: mockOr,
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
  clearStaleActiveRun: vi.fn().mockResolvedValue(undefined),
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
    expect(mockOr).toHaveBeenCalledWith(
      'color_exterior.is.null,color_exterior.eq.,color_exterior.in.("Not specified","Unknown","N/A","-"),engine.is.null,engine.eq.,engine.in.("Not specified","Unknown","N/A","-"),transmission.is.null,transmission.eq.,transmission.in.("Not specified","Unknown","N/A","-")',
    );
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

  it("records metadata without using trim as a sentinel when no fields are extracted", async () => {
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
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: [{
                  id: "test-id",
                  source_url: "https://www.autoscout24.com/offers/test",
                  title: "Porsche 911",
                  trim: null,
                  transmission: "Manual",
                  body_style: null,
                  engine: null,
                  color_exterior: null,
                  color_interior: null,
                  vin: null,
                  description_text: null,
                  images: [],
                  enrichment_meta: { keep: true },
                }],
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
      text: vi.fn().mockResolvedValue("<html><body>listingDetails empty page</body></html>"),
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

    expect(mockUpdate).toHaveBeenCalled();
    const updatePayload = mockUpdate.mock.calls.at(-1)?.[0];
    expect(updatePayload).not.toHaveProperty("trim");
    expect(updatePayload.enrichment_meta).toMatchObject({
      keep: true,
      autoscout24: {
        targetFieldStatus: "detail_unavailable",
        missingTargetFields: ["color_exterior", "engine"],
      },
    });
    expect(data).toMatchObject({
      targetFieldCandidates: 1,
      targetFieldUpdates: 0,
      detailsFetched: 1,
      blocked: 0,
      deadUrls: 0,
    });
  });

  it("merges target metadata and counts target field updates", async () => {
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: [{
                  id: "test-id",
                  source_url: "https://www.autoscout24.com/offers/test",
                  title: "Porsche 911",
                  trim: "",
                  transmission: "Manual",
                  body_style: null,
                  engine: null,
                  color_exterior: null,
                  color_interior: null,
                  vin: null,
                  description_text: null,
                  images: [],
                  enrichment_meta: { autoscout24: { previous: "kept" } },
                }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue("<html><body>listingDetails full page</body></html>"),
    }) as unknown as typeof fetch;

    vi.mocked(parseDetailHtml).mockReturnValue({
      title: "", price: null, currency: null, year: null, make: null, model: null,
      trim: "Carrera", mileageKm: null, transmission: null, fuelType: null, engine: "3.0L",
      power: null, bodyStyle: null, exteriorColor: "Black", interiorColor: null,
      vin: null, location: null, country: null, region: null, sellerType: null,
      sellerName: null, description: null, images: [], firstRegistration: null, features: [],
    });

    const response = await GET(makeRequest());
    const data = await response.json();
    const updatePayload = mockUpdate.mock.calls.at(-1)?.[0];

    expect(updatePayload).toMatchObject({
      trim: "Carrera",
      engine: "3.0L",
      color_exterior: "Black",
      enrichment_meta: {
        autoscout24: {
          previous: "kept",
          targetFieldStatus: "complete",
          missingTargetFields: [],
        },
      },
    });
    expect(data.targetFieldCandidates).toBe(1);
    expect(data.targetFieldUpdates).toBe(1);
  });

  it("continues paging when covered exceptions crowd out actionable target rows", async () => {
    const coveredRow = {
      id: "covered",
      source_url: "https://www.autoscout24.com/offers/covered",
      title: "Porsche 911",
      trim: null,
      transmission: "Manual",
      body_style: null,
      engine: null,
      color_exterior: null,
      color_interior: null,
      vin: null,
      description_text: null,
      images: [],
      enrichment_meta: {
        autoscout24: {
          targetFieldStatus: "covered_or_unavailable",
        },
      },
    };
    const actionableRow = {
      ...coveredRow,
      id: "actionable",
      source_url: "https://www.autoscout24.com/offers/actionable",
      enrichment_meta: null,
    };
    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: [coveredRow, coveredRow], error: null })
      .mockResolvedValueOnce({ data: [actionableRow], error: null });
    const order = vi.fn().mockReturnValue({ range });
    const or = vi.fn().mockReturnValue({ order });
    const eqStatus = vi.fn().mockReturnValue({ or });
    const eqSource = vi.fn().mockReturnValue({ eq: eqStatus });
    const select = vi.fn().mockReturnValue({ eq: eqSource });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    await expect(fetchActionableTargetRows(client, 1, 2)).resolves.toEqual([actionableRow]);
    expect(range).toHaveBeenNthCalledWith(1, 0, 1);
    expect(range).toHaveBeenNthCalledWith(2, 2, 3);
  });
});
