import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import {
  clearScraperRunActive,
  clearStaleActiveRun,
  markScraperRunStarted,
  recordScraperRun,
} from "./record";

afterEach(() => {
  delete process.env.SCRAPER_ASSURANCE_CANARY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  mocks.createClient.mockReset();
});

describe("scraper monitoring in assurance canary mode", () => {
  it("does not construct or call Supabase for any monitoring write", async () => {
    process.env.SCRAPER_ASSURANCE_CANARY = "1";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

    await markScraperRunStarted({
      scraperName: "autotrader",
      runId: "run-1",
      startedAt: "2026-07-13T12:00:00.000Z",
      runtime: "cli",
    });
    await clearStaleActiveRun("autotrader");
    await clearScraperRunActive("autotrader");
    await recordScraperRun({
      scraper_name: "autotrader",
      run_id: "run-1",
      started_at: "2026-07-13T12:00:00.000Z",
      finished_at: "2026-07-13T12:01:00.000Z",
      success: true,
      runtime: "cli",
      duration_ms: 60_000,
      discovered: 1,
      written: 0,
      errors_count: 0,
    });

    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
