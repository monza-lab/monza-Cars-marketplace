import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

// Mock the dependencies
vi.mock("@/features/scrapers/ferrari_collector/collector", () => ({
  runCollector: vi.fn(),
}));

vi.mock("@/features/scrapers/ferrari_collector/supabase_writer", () => ({
  refreshActiveListings: vi.fn(),
}));

vi.mock("@/features/scrapers/ferrari_collector/historical_backfill", () => ({
  runLightBackfill: vi.fn(),
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn(),
  recordScraperRun: vi.fn(),
  clearScraperRunActive: vi.fn(),
}));

import { runCollector } from "@/features/scrapers/ferrari_collector/collector";
import { refreshActiveListings } from "@/features/scrapers/ferrari_collector/supabase_writer";
import { runLightBackfill } from "@/features/scrapers/ferrari_collector/historical_backfill";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring";

describe("Ferrari Cron Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 401 without valid auth", async () => {
    const request = new Request("http://localhost:3000/api/cron/ferrari", {
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

  it("runs collector pipeline and records success", async () => {
    const mockRefreshResult = {
      checked: 10,
      updated: 2,
      errors: [],
    };

    const mockCollectorResult = {
      runId: "test-run",
      sourceCounts: {
        BaT: {
          discovered: 50,
          written: 10,
        },
      },
      errors: [],
    };

    vi.mocked(refreshActiveListings).mockResolvedValue(mockRefreshResult);
    vi.mocked(runCollector).mockResolvedValue(mockCollectorResult as any);
    vi.mocked(runLightBackfill).mockResolvedValue({
      modelsSearched: 5,
      newModelsFound: 2,
      discovered: 15,
      written: 8,
      skippedExisting: 7,
      errors: [],
      timedOut: false,
      durationMs: 5000,
    });
    vi.mocked(markScraperRunStarted).mockResolvedValue(undefined);
    vi.mocked(recordScraperRun).mockResolvedValue(undefined);
    vi.mocked(clearScraperRunActive).mockResolvedValue(undefined);

    const request = new Request("http://localhost:3000/api/cron/ferrari", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.runId).toBe("test-run");
    expect(data.discovered).toBe(50);
    expect(data.written).toBe(10);
    expect(data.refresh.checked).toBe(10);
    expect(data.refresh.updated).toBe(2);
    expect(data.backfill.discovered).toBe(15);
    expect(data.backfill.written).toBe(8);

    // Verify all functions were called
    expect(markScraperRunStarted).toHaveBeenCalledWith({
      scraperName: "ferrari",
      runId: expect.any(String),
      startedAt: expect.any(String),
      runtime: "vercel_cron",
    });

    expect(refreshActiveListings).toHaveBeenCalled();
    expect(runCollector).toHaveBeenCalledWith({
      mode: "daily",
      dryRun: false,
    });

    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "ferrari",
        success: true,
        discovered: 50,
        written: 10,
        refresh_checked: 10,
        refresh_updated: 2,
      })
    );

    expect(clearScraperRunActive).toHaveBeenCalledWith("ferrari");
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

    const request = new Request("http://localhost:3000/api/cron/ferrari", {
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
        scraper_name: "ferrari",
        success: false,
        discovered: 0,
        written: 0,
        errors_count: 1,
        error_messages: ["Collector failed"],
      })
    );

    expect(clearScraperRunActive).toHaveBeenCalledWith("ferrari");
  });
});
