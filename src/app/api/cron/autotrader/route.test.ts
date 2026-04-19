import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshActiveListings: vi.fn(),
  runCollector: vi.fn(),
  enrichAutoTrader: vi.fn(),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "./route";
import { backfillImagesForSource } from "@/features/scrapers/common/backfillImages";

vi.mock("@/features/scrapers/autotrader_collector/supabase_writer", () => ({
  refreshActiveListings: mocks.refreshActiveListings,
}));

vi.mock("@/features/scrapers/autotrader_collector/collector", () => ({
  runCollector: mocks.runCollector,
}));

vi.mock("@/features/scrapers/common/backfillImages", () => ({
  backfillImagesForSource: vi.fn().mockResolvedValue({
    source: "AutoTrader",
    discovered: 0,
    backfilled: 0,
    errors: [],
    durationMs: 0,
  }),
}));

vi.mock("@/app/api/cron/enrich-autotrader/route", () => ({
  GET: mocks.enrichAutoTrader,
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  recordScraperRun: mocks.recordScraperRun,
  markScraperRunStarted: mocks.markScraperRunStarted,
  clearScraperRunActive: mocks.clearScraperRunActive,
}));

vi.mock("@/lib/dashboardCache", () => ({
  invalidateDashboardCache: vi.fn(),
}));

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
  });

  it("fails loudly when discovery and writes are both zero", async () => {
    mocks.refreshActiveListings.mockResolvedValueOnce({ checked: 0, updated: 0, errors: [] });
    mocks.runCollector.mockResolvedValueOnce({
      runId: "run-1",
      sourceCounts: { AutoTrader: { discovered: 0, written: 0 } },
      errors: [],
    });
    mocks.enrichAutoTrader.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, discovered: 0, enriched: 0 }), {
        status: 200,
      })
    );

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/zero output/i);
    expect(mocks.recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error_messages: [expect.stringMatching(/zero output/i)],
      })
    );
  });

  it("runs the AutoTrader backfill step", async () => {
    mocks.refreshActiveListings.mockResolvedValueOnce({ checked: 0, updated: 0, errors: [] });
    mocks.runCollector.mockResolvedValueOnce({
      runId: "run-2",
      sourceCounts: { AutoTrader: { discovered: 1, written: 1 } },
      errors: [],
    });
    mocks.enrichAutoTrader.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, discovered: 0, enriched: 0 }), {
        status: 200,
      })
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(backfillImagesForSource).toHaveBeenCalledWith(
      expect.objectContaining({ source: "AutoTrader" })
    );
    expect(mocks.enrichAutoTrader).toHaveBeenCalled();
    expect(body.backfill).toEqual(
      expect.objectContaining({
        source: "AutoTrader",
      })
    );
  });
});
