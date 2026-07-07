import { NextResponse } from "next/server";
import { runAutoScout24Collector } from "@/features/scrapers/autoscout24_collector/collector";
import { refreshStaleListings } from "@/features/scrapers/autoscout24_collector/supabase_writer";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";
import type { AS24CountryCode } from "@/features/scrapers/autoscout24_collector/types";
import { invalidateDashboardCache } from "@/lib/dashboardCache";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Vercel Pro

/**
 * Rotate countries by day-of-week (UTC) to stay within time budget.
 *
 * Sunday:    D (Germany)              — largest market, own day
 * Monday:    A + L (Austria + Luxembourg)
 * Tuesday:   B + NL (Belgium + Netherlands)
 * Wednesday: E (Spain)
 * Thursday:  F (France)
 * Friday:    I (Italy)
 * Saturday:  D (Germany again)        — extra coverage
 */
function getCountriesForToday(): AS24CountryCode[] {
  const dayOfWeek = new Date().getUTCDay(); // 0=Sun, 1=Mon, ...
  const schedule: Record<number, AS24CountryCode[]> = {
    0: ["D"],           // Sunday
    1: ["A", "L"],      // Monday
    2: ["B", "NL"],     // Tuesday
    3: ["E"],           // Wednesday
    4: ["F"],           // Thursday
    5: ["I"],           // Friday
    6: ["D"],           // Saturday
  };
  return schedule[dayOfWeek] ?? ["D"];
}

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
    scraperName: "autoscout24",
    runId: liveRunId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  const countries = getCountriesForToday();

  try {
    const result = await runAutoScout24Collector({
      mode: "daily",
      make: "Porsche",
      countries,
      maxPagesPerShard: 5,
      maxListings: 500,
      headless: true,
      navigationDelayMs: 2000,
      pageTimeoutMs: 20000,
      scrapeDetails: false,
      checkpointPath: "/tmp/autoscout24_collector/checkpoint.json",
      outputPath: "/tmp/autoscout24_collector/listings.jsonl",
      dryRun: false,
      timeBudgetMs: 270_000,
      skipMonitoring: true, // cron route handles monitoring
    });

    // Step 2: Mark stale listings as delisted (runs AFTER discover) —
    // but ONLY when this run covered enough shards. Delisting after a partial
    // run (e.g. 10/41 shards) would false-delist live cars never seen this run.
    const coverageRatio =
      result.shardsTotal > 0 ? result.shardsCompleted / result.shardsTotal : 1;
    const REFRESH_MIN_COVERAGE = 0.5;
    let refreshResult: { checked: number; updated: number; errors: string[] } = {
      checked: 0,
      updated: 0,
      errors: [],
    };
    let refreshSkippedReason: string | null = null;
    if (coverageRatio >= REFRESH_MIN_COVERAGE) {
      refreshResult = await refreshStaleListings({ staleDays: 14, maxUpdates: 200 });
    } else {
      refreshSkippedReason = `stale-delist skipped: shard coverage ${result.shardsCompleted}/${result.shardsTotal} (${Math.round(coverageRatio * 100)}%) below ${REFRESH_MIN_COVERAGE * 100}% threshold`;
      console.warn(`[cron/autoscout24] ${refreshSkippedReason}`);
    }

    // Derive success from real errors instead of hardcoding true.
    // AS24 counts.errors are genuine write/normalize failures (e.g. null
    // source_url upserts); skips are counted separately (skippedDuplicate).
    const errorsCount = result.counts.errors + refreshResult.errors.length;
    const success =
      result.counts.errors === 0 &&
      result.errors.length === 0 &&
      refreshResult.errors.length === 0;
    const errorMessages = [...result.errors, ...refreshResult.errors];

    await recordScraperRun({
      scraper_name: "autoscout24",
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
      skipped_duplicate: result.counts.skippedDuplicate,
      bot_blocked: result.counts.akamaiBlocked,
      refresh_checked: refreshResult.checked,
      refresh_updated: refreshResult.updated,
      error_messages: errorMessages.length > 0 ? errorMessages : undefined,
    });

    await clearScraperRunActive("autoscout24");
    invalidateDashboardCache();

    return NextResponse.json(
      {
        success,
        runId: result.runId,
        refresh: {
          checked: refreshResult.checked,
          updated: refreshResult.updated,
          skipped: refreshSkippedReason !== null,
          reason: refreshSkippedReason,
          errors: refreshResult.errors,
        },
        countries,
        shardsCompleted: result.shardsCompleted,
        shardsTotal: result.shardsTotal,
        counts: result.counts,
        errors: result.errors,
        duration: `${Date.now() - startTime}ms`,
      },
      { status: success ? 200 : 500 },
    );
  } catch (error) {
    console.error("[cron/autoscout24] Error:", error);

    await recordScraperRun({
      scraper_name: "autoscout24",
      run_id: "unknown",
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

    await clearScraperRunActive("autoscout24");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Collector failed",
        countries,
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}
