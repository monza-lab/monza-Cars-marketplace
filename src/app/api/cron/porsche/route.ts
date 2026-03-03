import { NextResponse } from "next/server";
import { runCollector } from "@/features/porsche_collector/collector";
import { refreshActiveListings } from "@/features/porsche_collector/supabase_writer";
import { runLightBackfill, type LightBackfillResult } from "@/features/porsche_collector/historical_backfill";
import { recordScraperRun } from "@/lib/scraper-monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Vercel

export async function GET(request: Request) {
  const startTime = Date.now();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Step 1: Refresh status of existing active listings (mark ended auctions as sold/unsold)
    // Cap to 50 listings to avoid timeout
    const refreshResult = await refreshActiveListings({ maxListings: 50 });

    // Step 2: Discover and ingest new active listings (capped for Vercel)
    const result = await runCollector({
      mode: "daily",
      maxActivePagesPerSource: 2,
      maxEndedPagesPerSource: 0,   // skip ended pages on Vercel — backfill covers these
      scrapeDetails: false,        // summary-only to stay within time budget
      dryRun: false,
    });

    const totalWritten = Object.values(result.sourceCounts).reduce(
      (sum, c) => sum + c.written,
      0
    );
    const totalDiscovered = Object.values(result.sourceCounts).reduce(
      (sum, c) => sum + c.discovered,
      0
    );

    // Step 3: Light backfill of recently sold listings (last 30 days)
    let backfillResult: LightBackfillResult | null = null;
    let backfillError: string | null = null;

    const elapsedMs = Date.now() - startTime;
    const remainingMs = maxDuration * 1000 - elapsedMs - 10_000; // 10s safety buffer

    if (remainingMs > 30_000) {
      try {
        backfillResult = await runLightBackfill({
          windowDays: 30,
          maxListingsPerModel: 3,
          timeBudgetMs: Math.min(remainingMs, 120_000),
        });
      } catch (error) {
        backfillError = error instanceof Error ? error.message : "Backfill failed";
        console.error("[cron/porsche] Backfill error (non-fatal):", error);
      }
    } else {
      backfillError = `Skipped: only ${Math.round(remainingMs / 1000)}s remaining`;
    }

    const allErrors = [
      ...result.errors,
      ...(backfillResult?.errors ?? []),
      ...(backfillError ? [backfillError] : []),
    ];

    await recordScraperRun({
      scraper_name: 'porsche',
      run_id: result.runId,
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      success: true,
      runtime: 'vercel_cron',
      duration_ms: Date.now() - startTime,
      discovered: totalDiscovered,
      written: totalWritten,
      errors_count: allErrors.length,
      refresh_checked: refreshResult.checked,
      refresh_updated: refreshResult.updated,
      source_counts: result.sourceCounts,
      backfill_discovered: backfillResult?.discovered,
      backfill_written: backfillResult?.written,
      error_messages: allErrors.length > 0 ? allErrors : undefined,
    });

    return NextResponse.json({
      success: true,
      runId: result.runId,
      refresh: {
        checked: refreshResult.checked,
        updated: refreshResult.updated,
        errors: refreshResult.errors,
      },
      discovered: totalDiscovered,
      written: totalWritten,
      sourceCounts: result.sourceCounts,
      errors: result.errors,
      backfill: backfillResult
        ? {
            modelsSearched: backfillResult.modelsSearched,
            newModelsFound: backfillResult.newModelsFound,
            discovered: backfillResult.discovered,
            written: backfillResult.written,
            skippedExisting: backfillResult.skippedExisting,
            errors: backfillResult.errors,
            timedOut: backfillResult.timedOut,
            durationMs: backfillResult.durationMs,
          }
        : { skipped: true, reason: backfillError },
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/porsche] Error:", error);

    await recordScraperRun({
      scraper_name: 'porsche',
      run_id: 'unknown',
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      success: false,
      runtime: 'vercel_cron',
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [error instanceof Error ? error.message : "Collector failed"],
    });

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
