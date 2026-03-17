import { NextResponse } from "next/server";
import { runClassicComCollector } from "@/features/scrapers/classic_collector/collector";
import { refreshStaleListings } from "@/features/scrapers/classic_collector/supabase_writer";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

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
    const result = await runClassicComCollector({
      mode: "daily",
      make: "Porsche",
      location: "US",
      status: "forsale",
      maxPages: 5,
      maxListings: 120,
      headless: true,
      proxyServer: process.env.DECODO_PROXY_URL,
      proxyUsername: process.env.DECODO_PROXY_USER,
      proxyPassword: process.env.DECODO_PROXY_PASS,
      navigationDelayMs: 2000,
      pageTimeoutMs: 20000,
      checkpointPath: "/tmp/classic_collector/checkpoint.json",
      outputPath: "/tmp/classic_collector/listings.jsonl",
      dryRun: false,
      timeBudgetMs: 270_000,
      summaryOnly: true,    // skip detail page fetches on Vercel
      skipMonitoring: true, // cron route handles monitoring
    });

    // Step 2: Mark stale listings as delisted (runs AFTER discover)
    const refreshResult = await refreshStaleListings({ staleDays: 7, maxUpdates: 100 });

    await recordScraperRun({
      scraper_name: "classic",
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
      bot_blocked: result.counts.cloudflareBlocked,
      refresh_checked: refreshResult.checked,
      refresh_updated: refreshResult.updated,
      backfill_discovered: result.counts.backfillDiscovered,
      backfill_written: result.counts.backfillWritten,
      error_messages: result.errors.length > 0 ? result.errors : undefined,
    });

    await clearScraperRunActive("classic");

    return NextResponse.json({
      success: true,
      runId: result.runId,
      refresh: {
        checked: refreshResult.checked,
        updated: refreshResult.updated,
        errors: refreshResult.errors,
      },
      totalResults: result.totalResults,
      counts: result.counts,
      errors: result.errors,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/classic] Error:", error);

    await recordScraperRun({
      scraper_name: "classic",
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

    await clearScraperRunActive("classic");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Collector failed",
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}
