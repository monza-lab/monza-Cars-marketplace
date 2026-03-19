import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

// Mock the dependencies
vi.mock("@/features/scrapers/beforward_porsche_collector/collector", () => ({
  runCollector: vi.fn(),
}));

vi.mock("@/features/scrapers/beforward_porsche_collector/supabase_writer", () => ({
  refreshActiveListings: vi.fn(),
}));

vi.mock("@/features/scrapers/beforward_porsche_collector/backfill", () => ({
  backfillMissingImages: vi.fn(),
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn(),
  recordScraperRun: vi.fn(),
  clearScraperRunActive: vi.fn(),
}));

import { runCollector } from "@/features/scrapers/beforward_porsche_collector/collector";
import { refreshActiveListings } from "@/features/scrapers/beforward_porsche_collector/supabase_writer";
import { backfillMissingImages } from "@/features/scrapers/beforward_porsche_collector/backfill";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring";

describe("BeForward Cron Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 401 without valid auth", async () => {
    const request = new Request("http://localhost:3000/api/cron/beforward", {
      method: "GET",
      headers: {
        authorization: "Bearer wrong-secret",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
  });

  it("runs collector with capped config and records success", async () => {
    const mockRefreshResult = {
      checked: 10,
      updated: 2,
      errors: [],
    };

    const mockCollectorResult = {
      runId: "bf-run",
      totalResults: 75,
      pageCount: 3,
      processedPages: 3,
      counts: {
        discovered: 75,
        written: 20,
        errors: 0,
      },
      errors: [],
    };

    const mockBackfillResult = {
      discovered: 15,
      backfilled: 10,
      errors: [],
    };

    vi.mocked(refreshActiveListings).mockResolvedValue(mockRefreshResult);
    vi.mocked(runCollector).mockResolvedValue(mockCollectorResult as any);
    vi.mocked(backfillMissingImages).mockResolvedValue(mockBackfillResult);
    vi.mocked(markScraperRunStarted).mockResolvedValue(undefined);
    vi.mocked(recordScraperRun).mockResolvedValue(undefined);
    vi.mocked(clearScraperRunActive).mockResolvedValue(undefined);

    const request = new Request("http://localhost:3000/api/cron/beforward", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.runId).toBe("bf-run");
    expect(data.totalResults).toBe(75);
    expect(data.pageCount).toBe(3);
    expect(data.processedPages).toBe(3);
    expect(data.counts.discovered).toBe(75);
    expect(data.counts.written).toBe(20);
    expect(data.counts.errors).toBe(0);
    expect(data.refresh.checked).toBe(10);
    expect(data.refresh.updated).toBe(2);
    expect(data.backfill.discovered).toBe(15);
    expect(data.backfill.backfilled).toBe(10);

    // Verify all functions were called
    expect(markScraperRunStarted).toHaveBeenCalledWith({
      scraperName: "beforward",
      runId: expect.any(String),
      startedAt: expect.any(String),
      runtime: "vercel_cron",
    });

    expect(refreshActiveListings).toHaveBeenCalled();

    expect(runCollector).toHaveBeenCalledWith({
      maxPages: 3,
      summaryOnly: true,
      concurrency: 6,
      rateLimitMs: 3500,
      checkpointPath: "/tmp/beforward_porsche_collector/checkpoint.json",
      outputPath: "/tmp/beforward_porsche_collector/listings.jsonl",
      dryRun: false,
    });

    expect(backfillMissingImages).toHaveBeenCalledWith(
      expect.objectContaining({
        timeBudgetMs: expect.any(Number),
        maxListings: 15,
        rateLimitMs: 3500,
        timeoutMs: 20_000,
        runId: "bf-run",
      })
    );

    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "beforward",
        success: true,
        discovered: 75,
        written: 20,
        refresh_checked: 10,
        refresh_updated: 2,
        backfill_discovered: 15,
        backfill_written: 10,
      })
    );

    expect(clearScraperRunActive).toHaveBeenCalledWith("beforward");
  });

  it("records failure when collector throws", async () => {
    const testError = new Error("Collector failed");

    vi.mocked(refreshActiveListings).mockResolvedValue({
      checked: 10,
      updated: 2,
      errors: [],
    });

    vi.mocked(runCollector).mockRejectedValue(testError);
    vi.mocked(markScraperRunStarted).mockResolvedValue(undefined);
    vi.mocked(recordScraperRun).mockResolvedValue(undefined);
    vi.mocked(clearScraperRunActive).mockResolvedValue(undefined);

    const request = new Request("http://localhost:3000/api/cron/beforward", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Collector failed");

    // Verify error was recorded
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "beforward",
        success: false,
        discovered: 0,
        written: 0,
        errors_count: 1,
        error_messages: ["Collector failed"],
      })
    );

    expect(clearScraperRunActive).toHaveBeenCalledWith("beforward");
  });
});
