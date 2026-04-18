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
      proxyServer: process.env.DECODO_PROXY_URL,
      proxyUsername: process.env.DECODO_PROXY_USER,
      proxyPassword: process.env.DECODO_PROXY_PASS,
      navigationDelayMs: 2000,
      pageTimeoutMs: 20000,
      scrapeDetails: false,
      checkpointPath: "/tmp/autoscout24_collector/checkpoint.json",
      outputPath: "/tmp/autoscout24_collector/listings.jsonl",
      dryRun: false,
      timeBudgetMs: 270_000,
      skipMonitoring: true, // cron route handles monitoring
    });

    // Step 2: Mark stale listings as delisted (runs AFTER discover)
    const refreshResult = await refreshStaleListings({ staleDays: 14, maxUpdates: 200 });

    await recordScraperRun({
      scraper_name: "autoscout24",
      run_id: result.runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: result.counts.discovered,
      written: result.counts.written,
      errors_count: result.counts.errors,
      details_fetched: result.counts.detailsFetched,
      normalized: result.counts.normalized,
      skipped_duplicate: result.counts.skippedDuplicate,
      bot_blocked: result.counts.akamaiBlocked,
      refresh_checked: refreshResult.checked,
      refresh_updated: refreshResult.updated,
      error_messages: result.errors.length > 0 ? result.errors : undefined,
    });

    await clearScraperRunActive("autoscout24");
    invalidateDashboardCache();

    return NextResponse.json({
      success: true,
      runId: result.runId,
      refresh: {
        checked: refreshResult.checked,
        updated: refreshResult.updated,
        errors: refreshResult.errors,
      },
      countries,
      shardsCompleted: result.shardsCompleted,
      shardsTotal: result.shardsTotal,
      counts: result.counts,
      errors: result.errors,
      duration: `${Date.now() - startTime}ms`,
    });
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
