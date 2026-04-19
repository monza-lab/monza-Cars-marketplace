import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

// Mock dependencies
vi.mock("@/features/scrapers/porsche_collector/collector", () => ({
  runCollector: vi.fn(),
}));

vi.mock("@/features/scrapers/porsche_collector/supabase_writer", () => ({
  refreshActiveListings: vi.fn(),
}));

vi.mock("@/features/scrapers/porsche_collector/historical_backfill", () => ({
  runLightBackfill: vi.fn(),
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn(),
  recordScraperRun: vi.fn(),
  clearScraperRunActive: vi.fn(),
}));

vi.mock("@/features/scrapers/common/refreshCounts", () => ({
  refreshListingsActiveCounts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/dashboardCache", () => ({
  invalidateDashboardCache: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({})),
}));

import { runCollector } from "@/features/scrapers/porsche_collector/collector";
import { refreshActiveListings } from "@/features/scrapers/porsche_collector/supabase_writer";
import { runLightBackfill } from "@/features/scrapers/porsche_collector/historical_backfill";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring";

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/porsche", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

function mockDefaults() {
  vi.mocked(refreshActiveListings).mockResolvedValue({
    checked: 15,
    updated: 3,
    errors: [],
  });

  vi.mocked(runCollector).mockResolvedValue({
    runId: "test-porsche-run",
    sourceCounts: {
      BaT: { discovered: 30, porscheKept: 30, skippedMissingRequired: 0, written: 8, errored: 0, retried: 0 },
    },
    errors: [],
  } as any);

  vi.mocked(runLightBackfill).mockResolvedValue({
    modelsSearched: ["911", "Cayenne", "Boxster"],
    newModelsFound: ["Taycan"],
    discovered: 12,
    written: 5,
    skippedExisting: 7,
    errors: [],
    timedOut: false,
    durationMs: 8000,
  });

  vi.mocked(markScraperRunStarted).mockResolvedValue(undefined);
  vi.mocked(recordScraperRun).mockResolvedValue(undefined);
  vi.mocked(clearScraperRunActive).mockResolvedValue(undefined);
}

describe("GET /api/cron/porsche", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  // ─── Auth tests ───

  it("returns 401 without valid auth", async () => {
    const response = await GET(makeRequest("wrong"));
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  // ─── Happy path ───

  it("runs full pipeline: refresh + collect (BaT only) + backfill", async () => {
    mockDefaults();

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.runId).toBe("test-porsche-run");
    expect(data.discovered).toBe(30);
    expect(data.written).toBe(8);

    // Refresh metrics
    expect(data.refresh.checked).toBe(15);
    expect(data.refresh.updated).toBe(3);

    // Backfill metrics
    expect(data.backfill.discovered).toBe(12);
    expect(data.backfill.written).toBe(5);
    expect(data.backfill.modelsSearched).toEqual(["911", "Cayenne", "Boxster"]);
  });

  it("calls runCollector with BaT only", async () => {
    mockDefaults();
    await GET(makeRequest());

    expect(runCollector).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "daily",
        sources: ["BaT"],
        maxActivePagesPerSource: 2,
        scrapeDetails: false,
        dryRun: false,
      })
    );
  });

  it("calls runLightBackfill with correct config", async () => {
    mockDefaults();
    await GET(makeRequest());

    expect(runLightBackfill).toHaveBeenCalledWith(
      expect.objectContaining({
        windowDays: 30,
        maxListingsPerModel: 1,
        timeBudgetMs: expect.any(Number),
      })
    );
  });

  it("records scraper run with backfill metrics", async () => {
    mockDefaults();
    await GET(makeRequest());

    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "porsche",
        success: true,
        discovered: 30,
        written: 8,
        refresh_checked: 15,
        refresh_updated: 3,
        backfill_discovered: 12,
        backfill_written: 5,
      })
    );
  });

  it("calls monitoring lifecycle functions in order", async () => {
    mockDefaults();
    await GET(makeRequest());

    expect(markScraperRunStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        scraperName: "porsche",
        runtime: "vercel_cron",
      })
    );
    expect(clearScraperRunActive).toHaveBeenCalledWith("porsche");
  });

  // ─── Error handling ───

  it("records failure when collector throws", async () => {
    vi.mocked(refreshActiveListings).mockResolvedValue({
      checked: 5, updated: 0, errors: [],
    });
    vi.mocked(runCollector).mockRejectedValue(new Error("Network error"));
    vi.mocked(markScraperRunStarted).mockResolvedValue(undefined);
    vi.mocked(recordScraperRun).mockResolvedValue(undefined);
    vi.mocked(clearScraperRunActive).mockResolvedValue(undefined);

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Network error");

    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "porsche",
        success: false,
        errors_count: 1,
        error_messages: ["Network error"],
      })
    );

    expect(clearScraperRunActive).toHaveBeenCalledWith("porsche");
  });

  it("marks the run unsuccessful when sources are returning 403s", async () => {
    vi.mocked(refreshActiveListings).mockResolvedValue({
      checked: 5,
      updated: 0,
      errors: ["Refresh failed for https://example.com: HTTP 403"],
    });
    vi.mocked(runCollector).mockResolvedValue({
      runId: "403-run",
      sourceCounts: {
        BaT: { discovered: 10, porscheKept: 10, skippedMissingRequired: 0, written: 0, errored: 1, retried: 0 },
        CarsAndBids: { discovered: 8, porscheKept: 8, skippedMissingRequired: 0, written: 0, errored: 1, retried: 0 },
        CollectingCars: { discovered: 6, porscheKept: 6, skippedMissingRequired: 0, written: 0, errored: 1, retried: 0 },
      },
      errors: ["CarsAndBids: HTTP 403", "CollectingCars: HTTP 403"],
    } as any);
    vi.mocked(runLightBackfill).mockResolvedValue({
      modelsSearched: ["911"],
      newModelsFound: [],
      discovered: 0,
      written: 0,
      skippedExisting: 0,
      errors: [],
      timedOut: false,
      durationMs: 0,
    });

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.successReason).toBe("source_errors_present");
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "porsche",
        success: false,
        errors_count: expect.any(Number),
      })
    );
  });

  it("marks the run unsuccessful when source errors are present", async () => {
    mockDefaults();
    vi.mocked(runCollector).mockResolvedValueOnce({
      runId: "test-porsche-run",
      sourceCounts: {
        BaT: { discovered: 30, porscheKept: 30, skippedMissingRequired: 0, written: 8, errored: 1, retried: 0 },
        CarsAndBids: { discovered: 10, porscheKept: 10, skippedMissingRequired: 0, written: 3, errored: 0, retried: 0 },
        CollectingCars: { discovered: 5, porscheKept: 5, skippedMissingRequired: 0, written: 2, errored: 0, retried: 0 },
      },
      errors: ["CarsAndBids 403"],
    } as any);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "porsche",
        success: false,
      })
    );
  });

  it("handles backfill error as non-fatal — still returns 200", async () => {
    mockDefaults();
    vi.mocked(runLightBackfill).mockRejectedValue(new Error("Backfill timeout"));

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.backfill).toEqual(
      expect.objectContaining({ skipped: true, reason: "Backfill timeout" })
    );
  });

  it("includes duration in response", async () => {
    mockDefaults();
    const response = await GET(makeRequest());
    const data = await response.json();
    expect(data.duration).toMatch(/^\d+ms$/);
  });
});
