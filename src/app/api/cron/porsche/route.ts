import { NextResponse } from "next/server";
import { runCollector } from "@/features/porsche_collector/collector";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/lib/scraper-monitoring";

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
    // Step 1: Discover and ingest new active listings via BaT
    // scrapeBringATrailer returns rich data (title, make, model, year) from listing pages,
    // then isLuxuryCarListing pre-filters to Porsche-only before per-listing fetches.
    // With 3 pages (~60 listings) filtered to ~5-15 Porsche = well within 300s budget.
    const result = await runCollector({
      mode: "daily",
      sources: ["BaT"],
      maxActivePagesPerSource: 3,
      maxEndedPagesPerSource: 0,
      scrapeDetails: false,
      timeBudgetMs: 270_000,
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

    // Step 2: Refresh skipped on Vercel cron — GitHub Actions handles full refresh
    const refreshResult = { checked: 0, updated: 0, errors: [] as string[] };

    const allErrors = [...result.errors];

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
