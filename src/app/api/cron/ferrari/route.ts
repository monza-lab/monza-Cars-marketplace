import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runCollector } from "@/features/scrapers/ferrari_collector/collector";
import { refreshActiveListings } from "@/features/scrapers/ferrari_collector/supabase_writer";
import { runLightBackfill, type LightBackfillResult } from "@/features/scrapers/ferrari_collector/historical_backfill";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";
import { refreshListingsActiveCounts } from "@/features/scrapers/common/refreshCounts";

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
    scraperName: "ferrari",
    runId: liveRunId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    // Step 1: Refresh status of existing active listings (mark ended auctions as sold/unsold)
    const refreshResult = await refreshActiveListings({ timeBudgetMs: 60_000 });

    // Step 2: Discover and ingest new active listings (skip detail scraping to fit time budget)
    const collectorBudget = (maxDuration * 1000) - (Date.now() - startTime) - 60_000; // reserve 60s for backfill+recording
    const result = await runCollector({
      mode: "daily",
      dryRun: false,
      scrapeDetails: false,
      maxEndedPagesPerSource: 2,
      timeBudgetMs: Math.max(collectorBudget, 30_000),
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
          maxListingsPerModel: 1,
          timeBudgetMs: Math.min(remainingMs - 10_000, 90_000),
        });
      } catch (error) {
        backfillError = error instanceof Error ? error.message : "Backfill failed";
        console.error("[cron/ferrari] Backfill error (non-fatal):", error);
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
      scraper_name: 'ferrari',
      run_id: result.runId,
      started_at: startedAtIso,
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

    await clearScraperRunActive("ferrari");

    const supabaseForRefresh = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    await refreshListingsActiveCounts(supabaseForRefresh);

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
    console.error("[cron/ferrari] Error:", error);

    await recordScraperRun({
      scraper_name: 'ferrari',
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

    await clearScraperRunActive("ferrari");

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
