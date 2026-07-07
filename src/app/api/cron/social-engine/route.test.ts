import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  runWorker: vi.fn(),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/social-engine/workers/worker", () => ({
  runWorker: mocks.runWorker,
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  recordScraperRun: mocks.recordScraperRun,
  markScraperRunStarted: mocks.markScraperRunStarted,
  clearScraperRunActive: mocks.clearScraperRunActive,
}));

import { GET } from "./route";

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/social-engine", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  }) as unknown as import("next/server").NextRequest;
}

describe("GET /api/cron/social-engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 401 without valid auth", async () => {
    const response = await GET(makeRequest("wrong"));
    expect(response.status).toBe(401);
    expect(mocks.markScraperRunStarted).not.toHaveBeenCalled();
  });

  it("records a successful run and maps worker metrics", async () => {
    mocks.runWorker.mockResolvedValueOnce({
      candidates: 12, afterGate1: 8, afterGate2: 5, draftsCreated: 5, errors: [],
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    expect(mocks.markScraperRunStarted).toHaveBeenCalledWith(
      expect.objectContaining({ scraperName: "social-engine" }),
    );
    expect(mocks.recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "social-engine",
        success: true,
        discovered: 12,
        written: 5,
        errors_count: 0,
      }),
    );
    expect(mocks.clearScraperRunActive).toHaveBeenCalledWith("social-engine");
  });

  it("records failure (500) when the worker reports errors", async () => {
    mocks.runWorker.mockResolvedValueOnce({
      candidates: 4, afterGate1: 2, afterGate2: 1, draftsCreated: 0,
      errors: [{ listing_id: "l1", stage: "gate2", message: "boom" }],
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
    expect(mocks.recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({ scraper_name: "social-engine", success: false, errors_count: 1 }),
    );
  });

  it("records failure (500) when the worker throws", async () => {
    mocks.runWorker.mockRejectedValueOnce(new Error("worker crashed"));

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
    expect(mocks.recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({ scraper_name: "social-engine", success: false }),
    );
    expect(mocks.clearScraperRunActive).toHaveBeenCalledWith("social-engine");
  });
});
