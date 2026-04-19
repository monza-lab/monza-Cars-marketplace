import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/features/scrapers/autotrader_collector/collector", () => ({
  runCollector: vi.fn(),
}));

vi.mock("@/features/scrapers/autotrader_collector/supabase_writer", () => ({
  refreshActiveListings: vi.fn(),
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn(),
  recordScraperRun: vi.fn(),
  clearScraperRunActive: vi.fn(),
}));

import { runCollector } from "@/features/scrapers/autotrader_collector/collector";
import { refreshActiveListings } from "@/features/scrapers/autotrader_collector/supabase_writer";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring";

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/autotrader", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/autotrader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    vi.mocked(refreshActiveListings).mockResolvedValue({
      checked: 3,
      updated: 1,
      errors: [],
    });
  });

  it("returns a non-success result when the collector produces no output", async () => {
    vi.mocked(runCollector).mockResolvedValue({
      runId: "autotrader-run",
      sourceCounts: {
        AutoTrader: {
          discovered: 0,
          autotraderKept: 0,
          skippedMissingRequired: 0,
          written: 0,
          errored: 0,
          retried: 0,
        },
      },
      errors: [],
    } as any);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.successReason).toBe("no_collector_output");
    expect(data.discovered).toBe(0);
    expect(data.written).toBe(0);
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "autotrader",
        success: false,
        errors_count: 1,
      })
    );
    expect(clearScraperRunActive).toHaveBeenCalledWith("autotrader");
  });

  it("keeps success true when the collector returns output without errors", async () => {
    vi.mocked(runCollector).mockResolvedValue({
      runId: "autotrader-run",
      sourceCounts: {
        AutoTrader: {
          discovered: 4,
          autotraderKept: 4,
          skippedMissingRequired: 0,
          written: 2,
          errored: 0,
          retried: 0,
        },
      },
      errors: [],
    } as any);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.successReason).toBe("collector_output_present");
    expect(data.discovered).toBe(4);
    expect(data.written).toBe(2);
    expect(markScraperRunStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        scraperName: "autotrader",
        runtime: "vercel_cron",
      })
    );
    expect(clearScraperRunActive).toHaveBeenCalledWith("autotrader");
  });
});
