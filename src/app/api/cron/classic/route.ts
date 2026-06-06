import { NextResponse } from "next/server";
import { getClassicMonitoringState, runClassicComCollector } from "@/features/scrapers/classic_collector/collector";
import { refreshStaleListings } from "@/features/scrapers/classic_collector/supabase_writer";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";
import { invalidateDashboardCache } from "@/lib/dashboardCache";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Vercel Pro

export async function GET(request: Request) {
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const liveRunId = crypto.randomUUID();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  await markScraperRunStarted({
    scraperName: "classic",
    runId: liveRunId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    // Vercel cron = lightweight discovery-only (no Python → no Scrapling).
    // Full detail-enriched collection runs via GHA workflow at 04:00 UTC
    // using Scrapling (95%+ detail success, 0 CF blocks, no proxy needed).
    // This cron supplements GHA by catching new listings between runs.
    const result = await runClassicComCollector({
      mode: "daily",
      make: "Porsche",
      location: "US",
      status: "forsale",
      maxPages: 25,
      maxListings: 750,
      headless: true,
      navigationDelayMs: 2000,
      pageTimeoutMs: 20000,
      checkpointPath: "/tmp/classic_collector/checkpoint.json",
      outputPath: "/tmp/classic_collector/listings.jsonl",
      dryRun: false,
      runId: liveRunId,
      timeBudgetMs: 270_000,
      summaryOnly: true,    // no Scrapling on Vercel → summary-only discovery
      skipMonitoring: true, // cron route handles monitoring
    });

    // Step 2: Mark stale listings as delisted only when discovery coverage is high enough.
    const refreshResult = await refreshStaleListings({
      staleDays: 10,
      maxUpdates: 100,
      discoveredCount: result.counts.discovered,
      minDiscoveryForRefresh: 700,
    });
    const collectorMonitoring = getClassicMonitoringState({
      counts: result.counts,
      errors: result.errors,
    });
    const errorsCount = collectorMonitoring.errorsCount + refreshResult.errors.length;
    const runSucceeded = collectorMonitoring.success;
    const refreshFailed = refreshResult.errors.length > 0;
    const success = runSucceeded && !refreshFailed;
    const hardErrors = [...(collectorMonitoring.errorMessages ?? []), ...refreshResult.errors];
    if (hardErrors.length > 0 && refreshResult.reason) {
      hardErrors.push(refreshResult.reason);
    }
    const errorMessages = hardErrors.length > 0 ? hardErrors : undefined;

    await recordScraperRun({
      scraper_name: "classic",
      run_id: result.runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: result.counts.discovered,
      written: result.counts.written,
      errors_count: errorsCount,
      details_fetched: result.counts.detailsFetched,
      normalized: result.counts.normalized,
      bot_blocked: result.counts.cloudflareBlocked,
      refresh_checked: refreshResult.checked,
      refresh_updated: refreshResult.updated,
      backfill_discovered: result.counts.backfillDiscovered,
      backfill_written: result.counts.backfillWritten,
      error_messages: errorMessages,
    });

    await clearScraperRunActive("classic");
    invalidateDashboardCache();

    return NextResponse.json(
      {
        success,
        runId: result.runId,
        refresh: {
          checked: refreshResult.checked,
          updated: refreshResult.updated,
          skipped: refreshResult.skipped ?? false,
          reason: refreshResult.reason ?? null,
          errors: refreshResult.errors,
        },
        totalResults: result.totalResults,
        counts: result.counts,
        errors: result.errors,
        duration: `${Date.now() - startTime}ms`,
      },
      { status: success ? 200 : 500 },
    );
  } catch (error) {
    console.error("[cron/classic] Error:", error);

    await recordScraperRun({
      scraper_name: "classic",
      run_id: liveRunId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [error instanceof Error ? error.message : "Collector failed"],
    });

    await clearScraperRunActive("classic");

    return NextResponse.json(
      {
        success: false,
        runId: liveRunId,
        error: error instanceof Error ? error.message : "Collector failed",
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}
