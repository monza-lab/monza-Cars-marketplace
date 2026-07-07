import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshStaleListings: vi.fn(),
  runAutoScout24Collector: vi.fn(),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "./route";

vi.mock("@/features/scrapers/autoscout24_collector/collector", () => ({
  runAutoScout24Collector: mocks.runAutoScout24Collector,
}));

vi.mock("@/features/scrapers/autoscout24_collector/supabase_writer", () => ({
  refreshStaleListings: mocks.refreshStaleListings,
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  recordScraperRun: mocks.recordScraperRun,
  markScraperRunStarted: mocks.markScraperRunStarted,
  clearScraperRunActive: mocks.clearScraperRunActive,
}));

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/autoscout24", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/autoscout24", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  function collectorResult(overrides: Record<string, unknown> = {}) {
    return {
      runId: "run-1",
      shardsCompleted: 4,
      shardsTotal: 4,
      counts: {
        discovered: 100,
        written: 95,
        errors: 0,
        detailsFetched: 0,
        normalized: 100,
        skippedDuplicate: 5,
        akamaiBlocked: 0,
      },
      errors: [],
      ...overrides,
    };
  }

  it("returns 200 with success=true and runs stale-refresh on full coverage", async () => {
    mocks.runAutoScout24Collector.mockResolvedValueOnce(collectorResult());
    mocks.refreshStaleListings.mockResolvedValueOnce({ checked: 10, updated: 2, errors: [] });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.refresh.skipped).toBe(false);
    expect(mocks.refreshStaleListings).toHaveBeenCalledTimes(1);
    expect(mocks.recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, errors_count: 0 }),
    );
  });

  it("skips stale-refresh when shard coverage is low (avoids false-delisting)", async () => {
    mocks.runAutoScout24Collector.mockResolvedValueOnce(
      collectorResult({ shardsCompleted: 10, shardsTotal: 41 }),
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.refresh.skipped).toBe(true);
    expect(body.refresh.reason).toMatch(/coverage/i);
    expect(mocks.refreshStaleListings).not.toHaveBeenCalled();
  });

  it("returns 500 with success=false when writes fail (e.g. null source_url)", async () => {
    mocks.runAutoScout24Collector.mockResolvedValueOnce(
      collectorResult({
        counts: {
          discovered: 100, written: 94, errors: 6, detailsFetched: 0,
          normalized: 100, skippedDuplicate: 5, akamaiBlocked: 0,
        },
        errors: [
          'Write error: Supabase listings upsert failed: null value in column "source_url"',
        ],
      }),
    );
    mocks.refreshStaleListings.mockResolvedValueOnce({ checked: 0, updated: 0, errors: [] });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(mocks.recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, errors_count: 6 }),
    );
  });

  it("returns a 500 when the collector throws a hard failure", async () => {
    mocks.refreshStaleListings.mockResolvedValueOnce({ checked: 0, updated: 0, errors: [] });
    mocks.runAutoScout24Collector.mockRejectedValueOnce(
      new Error(
        "AutoScout24 hard failure (repeated Akamai blocks): discovered=0, written=0, akamaiBlocked=5, detailsFetched=0, normalized=0, shardsCompleted=0/4, errors=Aborting: 5 consecutive Akamai blocks",
      ),
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/hard failure/i);
    expect(mocks.recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error_messages: [expect.stringMatching(/hard failure/i)],
      }),
    );
    expect(mocks.clearScraperRunActive).toHaveBeenCalledWith("autoscout24");
  });
});
