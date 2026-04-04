import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
let mockRows: Array<{ id: string; source_url: string }> = [];
let mockSelectError: string | null = null;
const mockSelect = vi.fn();

function setMockRows(rows: Array<{ id: string; source_url: string }>) {
  mockRows = rows;
  mockSelect.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockRows,
              error: mockSelectError ? { message: mockSelectError } : null,
            }),
          }),
        }),
      }),
    }),
  });
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
    })),
  })),
}));

vi.mock("@/features/scrapers/beforward_porsche_collector/detail", () => ({
  parseDetailHtml: vi.fn(),
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
    setMockRows([]);
    mockSelectError = null;
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

  it("treats dead URLs as warnings and still succeeds", async () => {
    setMockRows([
      { id: "row-1", source_url: "https://www.beforward.jp/porsche/911/id/1/" },
    ]);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as any);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.delisted).toBe(1);
    expect(data.warnings?.length ?? 0).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });
});
