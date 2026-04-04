import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshActiveListings: vi.fn(),
  runCollector: vi.fn(),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "./route";

vi.mock("@/features/scrapers/autotrader_collector/supabase_writer", () => ({
  refreshActiveListings: mocks.refreshActiveListings,
}));

vi.mock("@/features/scrapers/autotrader_collector/collector", () => ({
  runCollector: mocks.runCollector,
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  recordScraperRun: mocks.recordScraperRun,
  markScraperRunStarted: mocks.markScraperRunStarted,
  clearScraperRunActive: mocks.clearScraperRunActive,
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
});
