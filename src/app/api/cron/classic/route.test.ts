import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runClassicComCollector: vi.fn(),
  getClassicMonitoringState: vi.fn((input: { counts: { errors: number; written: number }; errors: string[] }) => {
    const uncountedErrors = input.errors.filter((message) =>
      !message.startsWith("Write error") && !message.startsWith("Normalize failed")
    ).length;
    const errorsCount = input.counts.errors + uncountedErrors;
    const errorMessages = [...input.errors];
    if (errorMessages.length === 0 && input.counts.errors > 0) {
      errorMessages.push(`Classic collector reported ${input.counts.errors} errors`);
    }

    return {
      success: errorsCount === 0 || input.counts.written > 0,
      errorsCount,
      errorMessages: errorMessages.length > 0 ? errorMessages : undefined,
    };
  }),
  refreshStaleListings: vi.fn(),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
  invalidateDashboardCache: vi.fn(),
}));

import { GET } from "./route";

vi.mock("@/features/scrapers/classic_collector/collector", () => ({
  runClassicComCollector: mocks.runClassicComCollector,
  getClassicMonitoringState: mocks.getClassicMonitoringState,
}));

vi.mock("@/features/scrapers/classic_collector/supabase_writer", () => ({
  refreshStaleListings: mocks.refreshStaleListings,
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  recordScraperRun: mocks.recordScraperRun,
  markScraperRunStarted: mocks.markScraperRunStarted,
  clearScraperRunActive: mocks.clearScraperRunActive,
}));

vi.mock("@/lib/dashboardCache", () => ({
  invalidateDashboardCache: mocks.invalidateDashboardCache,
}));

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/classic", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

function makeCollectorResult(overrides: Record<string, unknown> = {}) {
  return {
    runId: "classic-route-run",
    totalResults: 750,
    counts: {
      discovered: 750,
      written: 25,
      errors: 0,
      detailsFetched: 0,
      normalized: 750,
      cloudflareBlocked: 0,
    },
    errors: [],
    outputPath: "/tmp/classic_collector/listings.jsonl",
    ...overrides,
  };
}

describe("GET /api/cron/classic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("uses one run id across active marker, collector config, and scraper run record", async () => {
    mocks.runClassicComCollector.mockImplementationOnce((config) =>
      Promise.resolve(makeCollectorResult({ runId: config.runId })),
    );
    mocks.refreshStaleListings.mockResolvedValueOnce({ checked: 0, updated: 0, errors: [] });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const startedRunId = mocks.markScraperRunStarted.mock.calls[0][0].runId;
    expect(mocks.runClassicComCollector).toHaveBeenCalledWith(expect.objectContaining({ runId: startedRunId }));
    expect(mocks.recordScraperRun).toHaveBeenCalledWith(expect.objectContaining({ run_id: startedRunId }));
    expect(body.runId).toBe(startedRunId);
  });

  it("records collector errors as failed when nothing was written", async () => {
    mocks.runClassicComCollector.mockResolvedValueOnce(
      makeCollectorResult({
        counts: {
          discovered: 0,
          written: 0,
          errors: 0,
          detailsFetched: 0,
          normalized: 0,
          cloudflareBlocked: 0,
        },
        errors: ["Fatal: discovery failed"],
      }),
    );
    mocks.refreshStaleListings.mockResolvedValueOnce({
      checked: 0,
      updated: 0,
      errors: [],
      skipped: true,
      reason: "Classic discovery 0 below stale refresh threshold 700",
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(mocks.recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errors_count: 1,
        error_messages: [
          "Fatal: discovery failed",
          "Classic discovery 0 below stale refresh threshold 700",
        ],
      }),
    );
  });

  it("records count-only collector errors as failed when nothing was written", async () => {
    mocks.runClassicComCollector.mockResolvedValueOnce(
      makeCollectorResult({
        counts: {
          discovered: 5,
          written: 0,
          errors: 2,
          detailsFetched: 0,
          normalized: 0,
          cloudflareBlocked: 0,
        },
        errors: [],
      }),
    );
    mocks.refreshStaleListings.mockResolvedValueOnce({ checked: 0, updated: 0, errors: [] });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(mocks.recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errors_count: 2,
      }),
    );
  });

  it("counts mixed collector count errors and message-only errors", async () => {
    mocks.runClassicComCollector.mockResolvedValueOnce(
      makeCollectorResult({
        counts: {
          discovered: 5,
          written: 0,
          errors: 2,
          detailsFetched: 0,
          normalized: 0,
          cloudflareBlocked: 0,
        },
        errors: ["Fatal: browser crashed after partial errors"],
      }),
    );
    mocks.refreshStaleListings.mockResolvedValueOnce({ checked: 0, updated: 0, errors: [] });

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(mocks.recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errors_count: 3,
        error_messages: ["Fatal: browser crashed after partial errors"],
      }),
    );
  });

  it("records stale refresh errors even when the collector has no errors", async () => {
    mocks.runClassicComCollector.mockResolvedValueOnce(makeCollectorResult());
    mocks.refreshStaleListings.mockResolvedValueOnce({
      checked: 10,
      updated: 0,
      errors: ["Supabase update failed"],
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(mocks.recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errors_count: 1,
        error_messages: ["Supabase update failed"],
      }),
    );
  });

  it("uses the active marker run id when the collector throws", async () => {
    mocks.runClassicComCollector.mockRejectedValueOnce(new Error("Collector failed"));

    const response = await GET(makeRequest());
    const body = await response.json();
    const startedRunId = mocks.markScraperRunStarted.mock.calls[0][0].runId;

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.runId).toBe(startedRunId);
    expect(mocks.recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        run_id: startedRunId,
        success: false,
      }),
    );
  });
});
