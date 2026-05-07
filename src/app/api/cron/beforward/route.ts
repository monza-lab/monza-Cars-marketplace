import { NextResponse } from "next/server";
import { runCollector } from "@/features/scrapers/beforward_porsche_collector/collector";
import { refreshActiveListings } from "@/features/scrapers/beforward_porsche_collector/supabase_writer";
import { backfillMissingImages } from "@/features/scrapers/beforward_porsche_collector/backfill";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";
import { invalidateDashboardCache } from "@/lib/dashboardCache";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Vercel

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
    scraperName: "beforward",
    runId: liveRunId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    // Step 1: Refresh status of existing active listings
    const refreshResult = await refreshActiveListings({ timeBudgetMs: 60_000 });

    // Step 2: Discover + ingest with capped config to fit Vercel 5-min limit
    const result = await runCollector({
      maxPages: 3,           // 75 listings (25/page) — enough to catch daily new listings
      summaryOnly: true,     // Skip detail page fetches (biggest time saver)
      concurrency: 3,
      rateLimitMs: 4000,
      checkpointPath: "/tmp/beforward_checkpoint.json",
      outputPath: "/tmp/beforward_listings.jsonl",
      dryRun: false,
    });

    // Step 3: Backfill images for listings scraped with summaryOnly
    const elapsedMs = Date.now() - startTime;
    const remainingMs = 290_000 - elapsedMs; // 10s safety for metrics
    let backfillResult = { discovered: 0, backfilled: 0, errors: [] as string[] };

    if (remainingMs > 30_000) {
      backfillResult = await backfillMissingImages({
        timeBudgetMs: Math.min(remainingMs - 15_000, 120_000),
        maxListings: 8,
        rateLimitMs: 3500,
        timeoutMs: 15_000,
        runId: result.runId,
      });
    }

    await recordScraperRun({
      scraper_name: 'beforward',
      run_id: result.runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: result.counts.discovered > 0,
      runtime: 'vercel_cron',
      duration_ms: Date.now() - startTime,
      discovered: result.counts.discovered,
      written: result.counts.written,
      errors_count: result.counts.errors,
      refresh_checked: refreshResult.checked,
      refresh_updated: refreshResult.updated,
      backfill_discovered: backfillResult.discovered,
      backfill_written: backfillResult.backfilled,
      error_messages: result.errors.length > 0 ? result.errors : undefined,
    });

    await clearScraperRunActive("beforward");
    invalidateDashboardCache();

    const isSuccess = result.counts.discovered > 0;
    return NextResponse.json({
      success: isSuccess,
      runId: result.runId,
      refresh: {
        checked: refreshResult.checked,
        updated: refreshResult.updated,
        errors: refreshResult.errors,
      },
      backfill: {
        discovered: backfillResult.discovered,
        backfilled: backfillResult.backfilled,
        errors: backfillResult.errors,
      },
      totalResults: result.totalResults,
      pageCount: result.pageCount,
      processedPages: result.processedPages,
      counts: result.counts,
      errors: result.errors,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/beforward] Error:", error);

    await recordScraperRun({
      scraper_name: 'beforward',
      run_id: 'unknown',
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: 'vercel_cron',
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [error instanceof Error ? error.message : "Collector failed"],
    });

    await clearScraperRunActive("beforward");

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
