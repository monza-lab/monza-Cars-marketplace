import { describe, expect, it } from "vitest";
import type { ActiveScraperRun, ScraperRun } from "./types";
import { getScraperHealthLabel, getScraperHealthState } from "./health";

function makeRun(overrides: Partial<ScraperRun> = {}): ScraperRun {
  return {
    id: "1",
    scraper_name: "porsche",
    run_id: "run-1",
    started_at: new Date(Date.now() - 60_000).toISOString(),
    finished_at: new Date().toISOString(),
    success: true,
    runtime: "vercel_cron",
    duration_ms: 1_000,
    discovered: 10,
    written: 2,
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

describe("scraper health helpers", () => {
  it("classifies a live run as running", () => {
    const activeRun: ActiveScraperRun = {
      scraper_name: "porsche",
      run_id: "live-1",
      started_at: new Date(Date.now() - 10_000).toISOString(),
      runtime: "vercel_cron",
      updated_at: new Date().toISOString(),
    };

    expect(getScraperHealthState(makeRun(), activeRun)).toBe("running");
    expect(getScraperHealthLabel("running")).toBe("RUNNING");
  });

  it("classifies a success with no discovered or written rows as zero-output-success", () => {
    const run = makeRun({ discovered: 0, written: 0, errors_count: 0 });

    expect(getScraperHealthState(run)).toBe("zero-output-success");
    expect(getScraperHealthLabel("zero-output-success")).toBe("ZERO OUTPUT");
  });

  it("classifies a success with errors or zero writes as degraded", () => {
    expect(getScraperHealthState(makeRun({ errors_count: 2 }))).toBe("degraded");
    expect(getScraperHealthState(makeRun({ discovered: 4, written: 0 }))).toBe("degraded");
  });

  it("classifies failed runs as failed", () => {
    expect(getScraperHealthState(makeRun({ success: false }))).toBe("failed");
    expect(getScraperHealthLabel("failed")).toBe("FAILED");
  });
});
