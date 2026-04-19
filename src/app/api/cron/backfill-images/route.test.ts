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

  it("processes all four sources and records success", async () => {
    const mockResults = [
      {
        source: "BaT",
        discovered: 10,
        backfilled: 8,
        imageCoverage: { withImages: 8, missingImages: 0, deadUrls: 0 },
        errors: [],
        durationMs: 1000,
      },
      {
        source: "BeForward",
        discovered: 5,
        backfilled: 5,
        imageCoverage: { withImages: 5, missingImages: 0, deadUrls: 0 },
        errors: [],
        durationMs: 800,
      },
      {
        source: "AutoScout24",
        discovered: 3,
        backfilled: 3,
        imageCoverage: { withImages: 3, missingImages: 0, deadUrls: 0 },
        errors: [],
        durationMs: 600,
      },
      {
        source: "AutoTrader",
        discovered: 4,
        backfilled: 4,
        imageCoverage: { withImages: 4, missingImages: 0, deadUrls: 0 },
        errors: [],
        durationMs: 700,
      },
    ];

    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[0]);
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[1]);
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[2]);
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[3]);

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
    expect(data.partialSuccess).toBe(false);
    expect(data.totalDiscovered).toBe(22);
    expect(data.totalBackfilled).toBe(20);
    expect(data.imageCoverageBySource).toEqual(
      expect.objectContaining({
        BaT: expect.objectContaining({ withImages: 8, missingImages: 0, deadUrls: 0 }),
        BeForward: expect.objectContaining({ withImages: 5, missingImages: 0, deadUrls: 0 }),
        AutoScout24: expect.objectContaining({ withImages: 3, missingImages: 0, deadUrls: 0 }),
        AutoTrader: expect.objectContaining({ withImages: 4, missingImages: 0, deadUrls: 0 }),
      })
    );
    expect((data.results as unknown[])).toHaveLength(4);

    // Verify backfillImagesForSource was called for each source
    expect(backfillImagesForSource).toHaveBeenCalledTimes(4);
    expect(backfillImagesForSource).toHaveBeenNthCalledWith(1, {
      source: "BaT",
      maxListings: 20,
      delayMs: 2000,
      timeBudgetMs: expect.any(Number),
    });
    expect(backfillImagesForSource).toHaveBeenNthCalledWith(2, {
      source: "BeForward",
      maxListings: 60,
      delayMs: 2000,
      timeBudgetMs: expect.any(Number),
    });
    expect(backfillImagesForSource).toHaveBeenNthCalledWith(3, {
      source: "AutoScout24",
      maxListings: 20,
      delayMs: 2000,
      timeBudgetMs: expect.any(Number),
    });
    expect(backfillImagesForSource).toHaveBeenNthCalledWith(4, {
      source: "AutoTrader",
      maxListings: 40,
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
        discovered: 22,
        written: 20,
        errors_count: 0,
        image_coverage: expect.objectContaining({
            BaT: expect.objectContaining({
              withImages: 8,
              missingImages: 0,
              deadUrls: 0,
            }),
            AutoTrader: expect.objectContaining({
              withImages: 4,
              missingImages: 0,
              deadUrls: 0,
            }),
          }),
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
        durationMs: 1000,
      },
      {
        source: "BeForward",
        discovered: 5,
        backfilled: 4,
        errors: ["Connection timeout for listing 456"],
        durationMs: 800,
      },
      {
        source: "AutoScout24",
        discovered: 3,
        backfilled: 3,
        errors: [],
        durationMs: 600,
      },
      {
        source: "AutoTrader",
        discovered: 4,
        backfilled: 4,
        errors: [],
        durationMs: 700,
      },
    ];

    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[0]);
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[1]);
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[2]);
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[3]);

    const request = new Request("http://localhost:3000/api/cron/backfill-images", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.partialSuccess).toBe(true);
    expect(data.totalDiscovered).toBe(22);
    expect(data.totalBackfilled).toBe(19);

    // Verify partial results are in response
    const results = data.results as Array<{
      errors: string[];
    }>;
    expect(results[0].errors).toEqual(["Failed to process listing 123"]);
    expect(results[1].errors).toEqual(["Connection timeout for listing 456"]);
    expect(results[2].errors).toEqual([]);
    expect(results[3].errors).toEqual([]);

    // Verify errors were recorded
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "backfill-images",
        success: false,
        discovered: 22,
        written: 19,
        errors_count: 2,
        error_messages: [
          "Failed to process listing 123",
          "Connection timeout for listing 456",
        ],
      })
    );
  });

  it("respects time budget and stops processing if exceeded", async () => {
    // All four sources process without hitting time limit
    vi.mocked(backfillImagesForSource)
      .mockResolvedValueOnce({
        source: "BaT",
        discovered: 10,
        backfilled: 8,
        errors: [],
        durationMs: 50000,
      })
      .mockResolvedValueOnce({
        source: "BeForward",
        discovered: 5,
        backfilled: 5,
        errors: [],
        durationMs: 50000,
      })
      .mockResolvedValueOnce({
        source: "AutoScout24",
        discovered: 3,
        backfilled: 3,
        errors: [],
        durationMs: 50000,
      })
      .mockResolvedValueOnce({
        source: "AutoTrader",
        discovered: 4,
        backfilled: 4,
        errors: [],
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
    expect(data.partialSuccess).toBe(false);

    // Should have processed all sources
    expect(backfillImagesForSource).toHaveBeenCalledTimes(4);
    expect((data.results as unknown[])).toHaveLength(4);
  });

  it("includes runId in success response", async () => {
    vi.mocked(backfillImagesForSource)
      .mockResolvedValueOnce({
        source: "BaT",
        discovered: 10,
        backfilled: 8,
        errors: [],
        durationMs: 1000,
      })
      .mockResolvedValueOnce({
        source: "BeForward",
        discovered: 5,
        backfilled: 5,
        errors: [],
        durationMs: 800,
      })
      .mockResolvedValueOnce({
        source: "AutoScout24",
        discovered: 3,
        backfilled: 3,
        errors: [],
        durationMs: 600,
      })
      .mockResolvedValueOnce({
        source: "AutoTrader",
        discovered: 4,
        backfilled: 4,
        errors: [],
        durationMs: 400,
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
    expect(data.partialSuccess).toBe(false);
    expect(data.runId).toBeDefined();
    expect(typeof data.runId).toBe("string");
    expect((data.runId as string).length).toBeGreaterThan(0);
  });
});
