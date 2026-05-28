import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock Supabase
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockOr = vi.fn().mockResolvedValue({ data: [], error: null });
const mockIs = vi.fn().mockReturnValue({ or: mockOr });
const mockLimit = vi.fn().mockReturnValue({ or: mockOr, is: mockIs });
const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrder });
const mockEqSource = vi.fn().mockReturnValue({ eq: mockEqStatus });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSource });
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock detail parser
vi.mock("@/features/scrapers/elferspot_collector/detail", () => ({
  fetchDetailPage: vi.fn(),
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

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/enrich-elferspot", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/enrich-elferspot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("returns 401 without valid auth", async () => {
    const response = await GET(makeRequest("wrong"));
    expect(response.status).toBe(401);
  });

  it("returns 200 with empty results when no listings need enrichment", async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.discovered).toBe(0);
    expect(data.enriched).toBe(0);
    expect(mockOr).toHaveBeenCalledWith("description_text.is.null,description_text.eq.");
    expect(mockIs).toHaveBeenCalledWith("hammer_price", null);
    expect(mockOr).toHaveBeenCalledWith(
      'enrichment_meta->elferspot->>priceStatus.is.null,enrichment_meta->elferspot->>priceStatus.not.in.("sold","price_on_request","hidden","not_listed","detail_unavailable","blocked_unverified")'
    );
  });

  it("queries missing descriptions before price-only gaps", async () => {
    await GET(makeRequest());

    expect(mockFrom).toHaveBeenCalledWith("listings");
    expect(mockOr).toHaveBeenCalledWith("description_text.is.null,description_text.eq.");
  });

  it("calls monitoring lifecycle functions", async () => {
    await GET(makeRequest());
    expect(markScraperRunStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        scraperName: "enrich-elferspot",
        runtime: "vercel_cron",
      })
    );
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "enrich-elferspot",
        success: true,
      })
    );
    expect(clearScraperRunActive).toHaveBeenCalledWith("enrich-elferspot");
  });

  it("returns 500 when Supabase env vars missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain("Supabase");
  });
});
