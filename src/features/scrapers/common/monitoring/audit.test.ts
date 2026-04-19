import { describe, expect, it } from "vitest";
import type { ActiveScraperRun, ScraperRun } from "./types";
import { summarizeScraperHealth } from "./audit";

function makeRun(overrides: Partial<ScraperRun> = {}): ScraperRun {
  return {
    id: "1",
    scraper_name: "autotrader",
    run_id: "run-1",
    started_at: new Date(Date.now() - 60_000).toISOString(),
    finished_at: new Date().toISOString(),
    success: true,
    runtime: "vercel_cron",
    duration_ms: 1_000,
    discovered: 0,
    written: 0,
    errors_count: 0,
    refresh_checked: undefined,
    refresh_updated: undefined,
    details_fetched: undefined,
    normalized: undefined,
    skipped_duplicate: undefined,
    bot_blocked: undefined,
    backfill_discovered: undefined,
    backfill_written: undefined,
    source_counts: undefined,
    error_messages: undefined,
    ...overrides,
  };
}

describe("summarizeScraperHealth", () => {
  it("marks successful zero-output runs with no errors as zero-write", () => {
    const summary = summarizeScraperHealth(
      {
        scraperName: "autotrader",
        label: "AutoTrader",
        cadence: "daily",
        cronPath: "/api/cron/autotrader",
      },
      [makeRun()],
      undefined,
    );

    expect(summary.status).toBe("zero-write");
    expect(summary.notes).toContain("Recent runs wrote nothing");
  });

  it("marks successful runs with errors as degraded", () => {
    const summary = summarizeScraperHealth(
      {
        scraperName: "backfill-images",
        label: "Image Backfill",
        cadence: "daily",
        cronPath: "/api/cron/backfill-images",
      },
      [makeRun({ errors_count: 2, error_messages: ["HTTP 403"] })],
      undefined,
    );

    expect(summary.status).toBe("degraded");
    expect(summary.notes).toContain("Recent runs had errors");
  });

  it("marks active runs that stopped updating as stuck", () => {
    const activeRun: ActiveScraperRun = {
      scraper_name: "validate",
      run_id: "run-2",
      started_at: new Date(Date.now() - 45 * 60_000).toISOString(),
      runtime: "vercel_cron",
      updated_at: new Date(Date.now() - 45 * 60_000).toISOString(),
    };

    const summary = summarizeScraperHealth(
      {
        scraperName: "validate",
        label: "Validator",
        cadence: "daily",
        cronPath: "/api/cron/validate",
      },
      [makeRun({ written: 1, errors_count: 0 })],
      activeRun,
    );

    expect(summary.status).toBe("stuck");
    expect(summary.notes).toContain("Active run last updated 45 minutes ago");
  });
});
