import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

// Mock the dependencies
vi.mock("@/features/scrapers/beforward_porsche_collector/collector", () => ({
  runCollector: vi.fn(),
}));

vi.mock("@/features/scrapers/beforward_porsche_collector/supabase_writer", () => ({
  refreshActiveListings: vi.fn(),
  loadCoverageState: vi.fn(),
  saveCoverageState: vi.fn(),
}));

vi.mock("@/features/scrapers/beforward_porsche_collector/backfill", () => ({
  backfillMissingImages: vi.fn(),
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn(),
  recordScraperRun: vi.fn(),
  clearScraperRunActive: vi.fn(),
  clearStaleActiveRun: vi.fn(),
}));

vi.mock("@/lib/dashboardCache", () => ({
  invalidateDashboardCache: vi.fn(),
}));

import { runCollector } from "@/features/scrapers/beforward_porsche_collector/collector";
import {
  loadCoverageState,
  refreshActiveListings,
  saveCoverageState,
} from "@/features/scrapers/beforward_porsche_collector/supabase_writer";
import { backfillMissingImages } from "@/features/scrapers/beforward_porsche_collector/backfill";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
  clearStaleActiveRun,
} from "@/features/scrapers/common/monitoring";

describe("BeForward Cron Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    vi.mocked(loadCoverageState).mockResolvedValue({
      nextPage: 1,
      sourceTotalPages: null,
      completedAt: null,
    });
    vi.mocked(saveCoverageState).mockResolvedValue(undefined);
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
      terminalized: 1,
      errors: [],
    };

    const mockCollectorResult = {
      runId: "bf-run",
      totalResults: 75,
      pageCount: 3,
      processedPages: 3,
      counts: {
        discovered: 75,
        detailsFetched: 0,
        writeAttempts: 75,
        normalized: 75,
        written: 20,
        skippedInvalid: 0,
        dryRunSkipped: 0,
        reactivated: 0,
        terminalized: 0,
        errors: 0,
      },
      sourceTotalPages: 20,
      plannedStartPage: 1,
      plannedEndPage: 5,
      coveragePercent: 25,
      coverageLimited: true,
      coverageReason: "max_pages",
      errors: [],
      outputPath: "/tmp/beforward_listings.jsonl",
    };

    const mockBackfillResult = {
      discovered: 15,
      backfilled: 10,
      errors: [],
    };

    vi.mocked(refreshActiveListings).mockResolvedValue(mockRefreshResult);
    vi.mocked(runCollector).mockResolvedValue(mockCollectorResult);
    vi.mocked(backfillMissingImages).mockResolvedValue(mockBackfillResult);
    vi.mocked(markScraperRunStarted).mockResolvedValue(undefined);
    vi.mocked(recordScraperRun).mockResolvedValue(undefined);
    vi.mocked(clearScraperRunActive).mockResolvedValue(undefined);
    vi.mocked(clearStaleActiveRun).mockResolvedValue(undefined);

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
    expect(data.mode).toBe("fresh");
    expect(data.pageCount).toBe(3);
    expect(data.processedPages).toBe(3);
    expect(data.sourceTotalPages).toBe(20);
    expect(data.plannedStartPage).toBe(1);
    expect(data.plannedEndPage).toBe(5);
    expect(data.coverageLimited).toBe(true);
    expect(data.counts.discovered).toBe(75);
    expect(data.counts.written).toBe(20);
    expect(data.counts.errors).toBe(0);
    expect(data.refresh.checked).toBe(10);
    expect(data.refresh.updated).toBe(2);
    expect(data.refresh.terminalized).toBe(1);
    expect(data.backfill.discovered).toBe(15);
    expect(data.backfill.backfilled).toBe(10);

    // Verify all functions were called
    expect(clearStaleActiveRun).toHaveBeenCalledWith("beforward", 10);

    expect(markScraperRunStarted).toHaveBeenCalledWith({
      scraperName: "beforward",
      runId: expect.any(String),
      startedAt: expect.any(String),
      runtime: "vercel_cron",
    });

    expect(refreshActiveListings).toHaveBeenCalled();

    expect(runCollector).toHaveBeenCalledWith({
      maxPages: 8,
      maxDetails: 0,
      summaryOnly: true,
      concurrency: 3,
      rateLimitMs: 6000,
      checkpointPath: "/tmp/beforward_fresh_checkpoint.json",
      outputPath: "/tmp/beforward_fresh_listings.jsonl",
      dryRun: false,
    });

    expect(backfillMissingImages).toHaveBeenCalledWith(
      expect.objectContaining({
        timeBudgetMs: expect.any(Number),
        maxListings: 8,
        rateLimitMs: 3500,
        timeoutMs: 15_000,
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
        error_messages: ["coverage_limited: processed pages 1-5 of 20"],
      })
    );

    expect(clearScraperRunActive).toHaveBeenCalledWith("beforward");
  });

  it("runs bounded coverage mode when requested", async () => {
    vi.mocked(refreshActiveListings).mockResolvedValue({
      checked: 0,
      updated: 0,
      terminalized: 0,
      errors: [],
    });
    vi.mocked(loadCoverageState).mockResolvedValue({
      nextPage: 26,
      sourceTotalPages: 143,
      completedAt: null,
    });
    vi.mocked(runCollector).mockResolvedValue({
      runId: "bf-coverage-run",
      totalResults: 3553,
      pageCount: 50,
      processedPages: 25,
      sourceTotalPages: 143,
      plannedStartPage: 26,
      plannedEndPage: 50,
      coveragePercent: 17.48,
      coverageLimited: true,
      coverageReason: "max_pages",
      counts: {
        discovered: 625,
        detailsFetched: 0,
        normalized: 625,
        writeAttempts: 625,
        written: 600,
        skippedInvalid: 25,
        dryRunSkipped: 0,
        reactivated: 3,
        terminalized: 0,
        errors: 0,
      },
      errors: [],
      outputPath: "/tmp/beforward_coverage_listings.jsonl",
    });
    vi.mocked(backfillMissingImages).mockResolvedValue({ discovered: 0, backfilled: 0, errors: [] });

    const request = new Request("http://localhost:3000/api/cron/beforward?mode=coverage", {
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(loadCoverageState).toHaveBeenCalled();
    expect(runCollector).toHaveBeenCalledWith(expect.objectContaining({
      startPage: 26,
      maxPages: 25,
      summaryOnly: true,
      maxDetails: 0,
      rateLimitMs: 3000,
      checkpointPath: "/tmp/beforward_coverage_checkpoint.json",
      outputPath: "/tmp/beforward_coverage_listings.jsonl",
    }));
    expect(saveCoverageState).toHaveBeenCalledWith({
      nextPage: 51,
      sourceTotalPages: 143,
      completedAt: null,
    });

    const data = await response.json();
    expect(data.mode).toBe("coverage");
  });

  it("records failure when collector throws", async () => {
    const testError = new Error("Collector failed");

    vi.mocked(refreshActiveListings).mockResolvedValue({
      checked: 10,
      updated: 2,
      terminalized: 0,
      errors: [],
    });

    vi.mocked(runCollector).mockRejectedValue(testError);
    vi.mocked(markScraperRunStarted).mockResolvedValue(undefined);
    vi.mocked(recordScraperRun).mockResolvedValue(undefined);
    vi.mocked(clearScraperRunActive).mockResolvedValue(undefined);
    vi.mocked(clearStaleActiveRun).mockResolvedValue(undefined);

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
    expect(clearStaleActiveRun).toHaveBeenCalledWith("beforward", 10);

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
