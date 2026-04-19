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

  it("processes all three sources and records success", async () => {
    const mockResults = [
      {
        source: "BaT",
        discovered: 10,
        backfilled: 8,
        errors: [],
        durationMs: 1000,
      },
      {
        source: "BeForward",
        discovered: 5,
        backfilled: 5,
        errors: [],
        durationMs: 800,
      },
      {
        source: "AutoScout24",
        discovered: 3,
        backfilled: 3,
        errors: [],
        durationMs: 600,
      },
    ];

    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[0]);
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[1]);
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[2]);

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
    expect(data.totalDiscovered).toBe(18);
    expect(data.totalBackfilled).toBe(16);
    expect((data.results as unknown[])).toHaveLength(3);

    // Verify backfillImagesForSource was called for each source
    expect(backfillImagesForSource).toHaveBeenCalledTimes(3);
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
    expect(backfillImagesForSource).toHaveBeenNthCalledWith(3, {
      source: "AutoScout24",
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
        discovered: 18,
        written: 16,
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
    ];

    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[0]);
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[1]);
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce(mockResults[2]);

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
    expect(data.totalDiscovered).toBe(18);
    expect(data.totalBackfilled).toBe(15);

    // Verify partial results are in response
    const results = data.results as Array<{
      errors: string[];
    }>;
    expect(results[0].errors).toEqual(["Failed to process listing 123"]);
    expect(results[1].errors).toEqual(["Connection timeout for listing 456"]);
    expect(results[2].errors).toEqual([]);

    // Verify errors were recorded
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "backfill-images",
        success: false,
        discovered: 18,
        written: 15,
        errors_count: 2,
        error_messages: [
          "Failed to process listing 123",
          "Connection timeout for listing 456",
        ],
      })
    );
  });

  it("marks the run unsuccessful when a source returns errors", async () => {
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce({
      source: "BaT",
      discovered: 1,
      backfilled: 1,
      errors: [],
      durationMs: 100,
    });
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce({
      source: "BeForward",
      discovered: 1,
      backfilled: 0,
      errors: ["Circuit-break: HTTP 403"],
      durationMs: 100,
    });
    vi.mocked(backfillImagesForSource).mockResolvedValueOnce({
      source: "AutoScout24",
      discovered: 0,
      backfilled: 0,
      errors: [],
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
    expect(data.success).toBe(false);
  });

  it("respects time budget and stops processing if exceeded", async () => {
    // All three sources process without hitting time limit
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

    // Should have processed all sources
    expect(backfillImagesForSource).toHaveBeenCalledTimes(3);
    expect((data.results as unknown[])).toHaveLength(3);
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
