import { NextResponse } from "next/server";
import { runCollector } from "@/features/scrapers/porsche_collector/collector";
import { refreshActiveListings } from "@/features/scrapers/porsche_collector/supabase_writer";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

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
    scraperName: "porsche",
    runId: liveRunId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    // Step 1: Refresh existing active BaT Porsche listings
    // Re-scrapes each URL to detect sold/unsold/delisted status changes.
    // Budget: 60s max, 30 listings max, 1.5-2.5s delay between requests.
    const REFRESH_BUDGET_MS = 60_000;
    const refreshResult = await refreshActiveListings({
      maxListings: 30,
      timeBudgetMs: REFRESH_BUDGET_MS,
    });

    const refreshDurationMs = Date.now() - startTime;
    console.log(
      `[cron/porsche] Refresh done in ${refreshDurationMs}ms: checked=${refreshResult.checked}, updated=${refreshResult.updated}, errors=${refreshResult.errors.length}`
    );

    // Step 2: Discover and ingest new active listings via BaT
    // Subtract refresh duration from collector budget to stay within 300s Vercel limit.
    const remainingBudgetMs = Math.max(270_000 - refreshDurationMs, 30_000);
    const result = await runCollector({
      mode: "daily",
      sources: ["BaT"],
      maxActivePagesPerSource: 3,
      maxEndedPagesPerSource: 0,
      scrapeDetails: false,
      timeBudgetMs: remainingBudgetMs,
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

    const allErrors = [...result.errors, ...refreshResult.errors];

    await recordScraperRun({
      scraper_name: 'porsche',
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
      error_messages: allErrors.length > 0 ? allErrors : undefined,
    });

    await clearScraperRunActive("porsche");

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
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/porsche] Error:", error);

    await recordScraperRun({
      scraper_name: 'porsche',
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

    await clearScraperRunActive("porsche");

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
