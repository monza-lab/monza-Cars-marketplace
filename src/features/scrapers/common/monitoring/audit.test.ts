import { describe, expect, it } from "vitest";
import type { ActiveScraperRun, ScraperRun } from "./types";
import { summarizeScraperHealth } from "./audit";
import {
  applyAutoscout24HealthGates,
  applyVinEnrichmentHealthGates,
  buildElferspotPriceCoverage,
  buildCoverageHealthIssues,
  hasAutoscout24ShardSaturationWarning,
} from "../../../../../scripts/scraper-health-audit";

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
  it("keeps numeric availability separate from source-resolved price coverage", () => {
    expect(buildElferspotPriceCoverage(100, 39, 19)).toEqual({
      numeric: 39,
      resolved: 58,
      unresolved: 42,
      numericPct: 39,
      resolvedPct: 58,
    });
  });

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
    expect(summary.notes).toContain("Latest run had errors");
  });

  it("recovers to working when the latest run is clean even if older runs had errors", () => {
    const now = Date.now();
    const summary = summarizeScraperHealth(
      {
        scraperName: "autoscout24",
        label: "AutoScout24",
        cadence: "external",
      },
      [
        makeRun({
          scraper_name: "autoscout24",
          finished_at: new Date(now).toISOString(),
          written: 1050,
          errors_count: 0,
        }),
        makeRun({
          scraper_name: "autoscout24",
          finished_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
          written: 800,
          errors_count: 30,
        }),
      ],
      undefined,
      now,
    );

    expect(summary.totalErrors).toBe(30);
    expect(summary.status).toBe("working");
    expect(summary.notes).not.toContain("Recent runs had errors");
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

  it("marks Elferspot degraded when target-field coverage is below threshold", () => {
    const summary = summarizeScraperHealth(
      {
        scraperName: "elferspot",
        label: "Elferspot",
        cadence: "daily",
        cronPath: "/api/cron/elferspot",
      },
      [makeRun({ scraper_name: "elferspot", written: 10, errors_count: 0 })],
      undefined,
      Date.now(),
      {
        source: "Elferspot",
        activeTotal: 100,
        targetFields: {
          color_exterior: { filled: 95, coveredOrExcepted: 95, missing: 5, pct: 95 },
          engine: { filled: 96, coveredOrExcepted: 96, missing: 4, pct: 96 },
          transmission: { filled: 94, coveredOrExcepted: 94, missing: 6, pct: 94 },
        },
      },
    );

    expect(summary.status).toBe("degraded");
    expect(summary.notes.join("; ")).toContain("Elferspot target-field coverage below 100%");
  });

  it("marks Elferspot degraded until source-resolved price coverage reaches 100%", () => {
    const summary = summarizeScraperHealth(
      {
        scraperName: "elferspot",
        label: "Elferspot",
        cadence: "daily",
        cronPath: "/api/cron/elferspot",
      },
      [makeRun({ scraper_name: "elferspot", written: 10, errors_count: 0 })],
      undefined,
      Date.now(),
      {
        source: "Elferspot",
        activeTotal: 100,
        targetFields: {
          color_exterior: { filled: 100, coveredOrExcepted: 100, missing: 0, pct: 100 },
          engine: { filled: 100, coveredOrExcepted: 100, missing: 0, pct: 100 },
          transmission: { filled: 100, coveredOrExcepted: 100, missing: 0, pct: 100 },
        },
        priceCoverage: {
          numeric: 39,
          resolved: 58,
          unresolved: 42,
          numericPct: 39,
          resolvedPct: 58,
        },
      },
    );

    expect(summary.status).toBe("degraded");
    expect(summary.notes.join("; ")).toContain("Elferspot resolved price coverage 58% (42 unresolved)");
    expect(summary.notes.join("; ")).toContain("numeric price availability 39%");
  });

  it("marks AutoScout24 degraded when target-field coverage is below 100%", () => {
    const summary = summarizeScraperHealth(
      {
        scraperName: "autoscout24",
        label: "AutoScout24",
        cadence: "external",
      },
      [makeRun({ scraper_name: "autoscout24", written: 10, errors_count: 0 })],
      undefined,
      Date.now(),
      {
        source: "AutoScout24",
        activeTotal: 100,
        targetFields: {
          color_exterior: { filled: 99, coveredOrExcepted: 99, missing: 1, pct: 99 },
          engine: { filled: 100, coveredOrExcepted: 100, missing: 0, pct: 100 },
          transmission: { filled: 100, coveredOrExcepted: 100, missing: 0, pct: 100 },
        },
      },
    );

    const gated = applyAutoscout24HealthGates(summary, [makeRun({ scraper_name: "autoscout24", written: 10 })]);

    expect(gated.status).toBe("degraded");
    expect(gated.notes.join("; ")).toContain("AutoScout24 target-field coverage below 100%");
  });

  it("marks AutoScout24 degraded when shard saturation warnings are present", () => {
    const runs = [
      makeRun({
        scraper_name: "autoscout24",
        written: 10,
        errors_count: 0,
      }) as ScraperRun & {
        metadata: { warnings: Array<{ event: string; shard: string; message: string }> };
      },
    ];
    runs[0].metadata = {
      warnings: [
        {
          event: "discover.shard_saturated",
          shard: "macan-all",
          message: "Shard reached 20-page limit. Some listings may be missed.",
        },
      ],
    };
    const summary = summarizeScraperHealth(
      {
        scraperName: "autoscout24",
        label: "AutoScout24",
        cadence: "external",
      },
      runs,
      undefined,
      Date.now(),
      {
        source: "AutoScout24",
        activeTotal: 100,
        targetFields: {
          color_exterior: { filled: 100, coveredOrExcepted: 100, missing: 0, pct: 100 },
          engine: { filled: 100, coveredOrExcepted: 100, missing: 0, pct: 100 },
          transmission: { filled: 100, coveredOrExcepted: 100, missing: 0, pct: 100 },
        },
      },
    );

    expect(hasAutoscout24ShardSaturationWarning(runs)).toBe(true);

    const gated = applyAutoscout24HealthGates(summary, runs);

    expect(gated.status).toBe("degraded");
    expect(gated.notes.join("; ")).toContain("AutoScout24 shard saturation warning present");
  });

  it("keeps VIN enrichment working when recent zero-write runs found no eligible VIN queue", () => {
    const runs = [
      makeRun({ scraper_name: "enrich-vin", discovered: 0, written: 0, errors_count: 0 }),
      makeRun({ scraper_name: "enrich-vin", discovered: 0, written: 0, errors_count: 0 }),
    ];
    const summary = summarizeScraperHealth(
      {
        scraperName: "enrich-vin",
        label: "VIN Enrichment",
        cadence: "daily",
        cronPath: "/api/cron/enrich-vin",
      },
      runs,
      undefined,
    );

    expect(summary.status).toBe("zero-write");

    const gated = applyVinEnrichmentHealthGates(summary, runs);

    expect(gated.status).toBe("working");
    expect(gated.notes.join("; ")).toContain("VIN enrichment queue exhausted");
  });

  it("marks VIN enrichment degraded when the latest run records a classified decoder zero-write", () => {
    const now = Date.now();
    const runs = [
      makeRun({
        scraper_name: "enrich-vin",
        finished_at: new Date(now).toISOString(),
        discovered: 500,
        written: 0,
        errors_count: 0,
        error_messages: ["vin_zero_write:decode_failed"],
      }),
      makeRun({
        scraper_name: "enrich-vin",
        finished_at: new Date(now - 60_000).toISOString(),
        discovered: 500,
        written: 1,
        errors_count: 0,
      }),
    ];
    const summary = summarizeScraperHealth(
      {
        scraperName: "enrich-vin",
        label: "VIN Enrichment",
        cadence: "daily",
        cronPath: "/api/cron/enrich-vin",
      },
      runs,
      undefined,
      now,
    );

    expect(summary.status).toBe("working");

    const gated = applyVinEnrichmentHealthGates(summary, runs);

    expect(gated.status).toBe("degraded");
    expect(gated.notes.join("; ")).toContain("VIN enrichment latest run decode_failed");
  });

  it("maps DB coverage alerts into health issues", () => {
    const issues = buildCoverageHealthIssues({
      generatedAt: "2026-07-09T00:00:00.000Z",
      rows: [],
      markets: [],
      marketAlerts: [{
        market: "UK",
        severity: "critical",
        message: "UK has historical rows but zero active coverage",
      }],
      sourceAlerts: [{
        source: "ClassicCom",
        severity: "degraded",
        message: "ClassicCom price coverage is below 50% (37.6%)",
      }],
    });

    expect(issues).toEqual([
      {
        scope: "market",
        key: "UK",
        severity: "critical",
        message: "UK has historical rows but zero active coverage",
      },
      {
        scope: "source",
        key: "ClassicCom",
        severity: "degraded",
        message: "ClassicCom price coverage is below 50% (37.6%)",
      },
    ]);
  });
});
