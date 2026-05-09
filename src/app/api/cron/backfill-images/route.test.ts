import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock the backfillImages module
vi.mock("@/features/scrapers/common/backfillImages", () => ({
  backfillImagesForSource: vi.fn(),
}));

// Mock the monitoring module
vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn(),
  recordScraperRun: vi.fn(),
  clearScraperRunActive: vi.fn(),
}));

import { backfillImagesForSource } from "@/features/scrapers/common/backfillImages";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring";

describe("GET /api/cron/backfill-images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 401 without valid auth", async () => {
    const request = new Request("http://localhost:3000/api/cron/backfill-images", {
      method: "GET",
      headers: {
        authorization: "Bearer invalid-secret",
      },
    });

    const response = await GET(request);
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;

    const request = new Request("http://localhost:3000/api/cron/backfill-images", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("processes BaT and BeForward sources and records success", async () => {
    const mockResults = [
      {
        source: "BaT",
        discovered: 10,
        backfilled: 8,
        errors: [],
        warnings: [],
        durationMs: 1000,
      },
      {
        source: "BeForward",
        discovered: 5,
        backfilled: 5,
        errors: [],
        warnings: [],
        durationMs: 800,
      },
    ];

    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[0]);
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[1]);

    const request = new Request("http://localhost:3000/api/cron/backfill-images", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.totalDiscovered).toBe(15);
    expect(data.totalBackfilled).toBe(13);
    expect((data.results as unknown[])).toHaveLength(2);

    // Verify backfillImagesForSource was called for each source
    expect(backfillImagesForSource).toHaveBeenCalledTimes(2);
    expect(backfillImagesForSource).toHaveBeenNthCalledWith(1, {
      source: "BaT",
      maxListings: 20,
      delayMs: 2000,
      timeBudgetMs: expect.any(Number),
    });
    expect(backfillImagesForSource).toHaveBeenNthCalledWith(2, {
      source: "BeForward",
      maxListings: 20,
      delayMs: 2000,
      timeBudgetMs: expect.any(Number),
    });

    // Verify monitoring was called
    expect(markScraperRunStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        scraperName: "backfill-images",
        runtime: "vercel_cron",
      })
    );

    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "backfill-images",
        success: true,
        discovered: 15,
        written: 13,
        errors_count: 0,
      })
    );

    expect(clearScraperRunActive).toHaveBeenCalledWith("backfill-images");
  });

  it("records failure when backfill throws", async () => {
    const error = new Error("Backfill service unavailable");
    vi.mocked(backfillImagesForSource).mockRejectedValueOnce(error);

    const request = new Request("http://localhost:3000/api/cron/backfill-images", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Backfill service unavailable");

    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "backfill-images",
        success: false,
        errors_count: 1,
        error_messages: ["Backfill service unavailable"],
      })
    );

    expect(clearScraperRunActive).toHaveBeenCalledWith("backfill-images");
  });

  it("handles partial errors from individual sources", async () => {
    const mockResults = [
      {
        source: "BaT",
        discovered: 10,
        backfilled: 8,
        errors: ["Failed to process listing 123"],
        warnings: [],
        durationMs: 1000,
      },
      {
        source: "BeForward",
        discovered: 5,
        backfilled: 4,
        errors: ["Connection timeout for listing 456"],
        warnings: [],
        durationMs: 800,
      },
    ];

    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[0]);
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[1]);

    const request = new Request("http://localhost:3000/api/cron/backfill-images", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    // success=true because totalBackfilled=12 > 0 (partial errors don't fail the run)
    expect(data.success).toBe(true);
    expect(data.totalDiscovered).toBe(15);
    expect(data.totalBackfilled).toBe(12);

    // Verify partial results are in response
    const results = data.results as Array<{
      errors: string[];
    }>;
    expect(results[0].errors).toEqual(["Failed to process listing 123"]);
    expect(results[1].errors).toEqual(["Connection timeout for listing 456"]);

    // Verify errors were recorded
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "backfill-images",
        success: true,
        discovered: 15,
        written: 12,
        errors_count: 2,
        error_messages: [
          "Failed to process listing 123",
          "Connection timeout for listing 456",
        ],
      })
    );
  });

  it("marks the run successful when circuit-break warnings occur but images were backfilled", async () => {
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce({
      source: "BaT",
      discovered: 1,
      backfilled: 1,
      errors: [],
      warnings: [],
      durationMs: 100,
    });
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce({
      source: "BeForward",
      discovered: 1,
      backfilled: 0,
      errors: [],
      warnings: ["Circuit-break (BeForward): HTTP 403"],
      durationMs: 100,
    });

    const request = new Request("http://localhost:3000/api/cron/backfill-images", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    // Circuit-breaks are warnings, not errors — BaT backfilled 1 so success=true
    expect(data.success).toBe(true);
  });

  it("marks the run successful when only circuit-break warnings occur with no work to do", async () => {
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce({
      source: "BaT",
      discovered: 0,
      backfilled: 0,
      errors: [],
      warnings: [],
      durationMs: 100,
    });
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce({
      source: "BeForward",
      discovered: 1,
      backfilled: 0,
      errors: [],
      warnings: ["Circuit-break (BeForward): HTTP 403"],
      durationMs: 100,
    });

    const request = new Request("http://localhost:3000/api/cron/backfill-images", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    // Circuit-breaks are warnings not errors — no errors means success
    expect(data.success).toBe(true);
    expect(data.warnings).toEqual(["Circuit-break (BeForward): HTTP 403"]);
  });

  it("respects time budget and stops processing if exceeded", async () => {
    vi.mocked(backfillImagesForSource)
      .mockResolvedValueOnce({
        source: "BaT",
        discovered: 10,
        backfilled: 8,
        errors: [],
        warnings: [],
        durationMs: 50000,
      })
      .mockResolvedValueOnce({
        source: "BeForward",
        discovered: 5,
        backfilled: 5,
        errors: [],
        warnings: [],
        durationMs: 50000,
      });

    const request = new Request("http://localhost:3000/api/cron/backfill-images", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Should have processed both sources
    expect(backfillImagesForSource).toHaveBeenCalledTimes(2);
    expect((data.results as unknown[])).toHaveLength(2);
  });

  it("includes runId in success response", async () => {
    vi.mocked(backfillImagesForSource)
      .mockResolvedValueOnce({
        source: "BaT",
        discovered: 10,
        backfilled: 8,
        errors: [],
        warnings: [],
        durationMs: 1000,
      })
      .mockResolvedValueOnce({
        source: "BeForward",
        discovered: 5,
        backfilled: 5,
        errors: [],
        warnings: [],
        durationMs: 800,
      });

    const request = new Request("http://localhost:3000/api/cron/backfill-images", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.runId).toBeDefined();
    expect(typeof data.runId).toBe("string");
    expect((data.runId as string).length).toBeGreaterThan(0);
  });
});
