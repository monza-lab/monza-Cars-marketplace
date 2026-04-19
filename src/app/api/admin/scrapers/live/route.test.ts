import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getRecentRuns: vi.fn(),
  getDailyAggregates: vi.fn(),
  getDataQuality: vi.fn(),
  getLatestRunPerScraper: vi.fn(),
  getActiveRuns: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/features/scrapers/common/monitoring/queries", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/scrapers/common/monitoring/queries")
  >("@/features/scrapers/common/monitoring/queries");

  return {
    ...actual,
    getRecentRuns: mocks.getRecentRuns,
    getDailyAggregates: mocks.getDailyAggregates,
    getDataQuality: mocks.getDataQuality,
    getLatestRunPerScraper: mocks.getLatestRunPerScraper,
    getActiveRuns: mocks.getActiveRuns,
  };
});

import { GET } from "./route";

function makeSupabaseClient(email: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: email ? { email } : null,
        },
      }),
    },
  };
}

describe("GET /api/admin/scrapers/live", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns latestRunHealth alongside the existing latestRuns payload", async () => {
    const porscheRun = {
      id: "row-1",
      scraper_name: "porsche",
      run_id: "run-1",
      started_at: "2026-04-18T08:00:00.000Z",
      finished_at: "2026-04-18T08:05:00.000Z",
      success: true,
      runtime: "vercel_cron",
      duration_ms: 300000,
      discovered: 12,
      written: 0,
      errors_count: 0,
    };
    const ferrariRun = {
      id: "row-2",
      scraper_name: "ferrari",
      run_id: "run-2",
      started_at: "2026-04-18T07:00:00.000Z",
      finished_at: "2026-04-18T07:03:00.000Z",
      success: true,
      runtime: "vercel_cron",
      duration_ms: 180000,
      discovered: 5,
      written: 5,
      errors_count: 0,
      image_coverage: {
        withImages: 5,
        missingImages: 0,
      },
    };

    mocks.createClient.mockResolvedValue(makeSupabaseClient("caposk8@hotmail.com"));
    mocks.getRecentRuns.mockResolvedValue([porscheRun, ferrariRun]);
    mocks.getDailyAggregates.mockResolvedValue([]);
    mocks.getDataQuality.mockResolvedValue([]);
    mocks.getLatestRunPerScraper.mockResolvedValue(
      new Map([
        ["porsche", porscheRun],
        ["ferrari", ferrariRun],
      ])
    );
    mocks.getActiveRuns.mockResolvedValue(new Map());

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe(200);
    expect(body.data.latestRuns).toMatchObject({
      porsche: {
        run_id: "run-1",
        discovered: 12,
        written: 0,
      },
      ferrari: {
        run_id: "run-2",
        discovered: 5,
        written: 5,
      },
    });
    expect(body.data.latestRunHealth).toEqual({
      porsche: {
        state: "degraded",
        reason: "zero_output",
        flags: [],
      },
      ferrari: {
        state: "healthy",
        reason: "ok",
        flags: [],
      },
    });
    expect(body.data.activeRuns).toEqual({});
    expect(body.data).toEqual(
      expect.objectContaining({
        recentRuns: [porscheRun, ferrariRun],
        dailyAggregates: [],
        dataQuality: [],
        latestRuns: expect.any(Object),
        latestRunHealth: expect.any(Object),
        activeRuns: {},
        generatedAt: expect.any(String),
      })
    );
  });
});
