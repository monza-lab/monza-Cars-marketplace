import { NextResponse } from "next/server";
import { runCollector } from "@/features/beforward_porsche_collector/collector";
import { refreshActiveListings } from "@/features/beforward_porsche_collector/supabase_writer";
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
    // Step 1: Refresh status of existing active listings
    const refreshResult = await refreshActiveListings();

    // Step 2: Discover + ingest with capped config to fit Vercel 5-min limit
    const result = await runCollector({
      maxPages: 3,           // 75 listings (25/page) — enough to catch daily new listings
      summaryOnly: true,     // Skip detail page fetches (biggest time saver)
      concurrency: 6,
      rateLimitMs: 2500,
      checkpointPath: "/tmp/beforward_porsche_collector/checkpoint.json",
      outputPath: "/tmp/beforward_porsche_collector/listings.jsonl",
      dryRun: false,
    });

    await recordScraperRun({
      scraper_name: 'beforward',
      run_id: result.runId,
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      success: true,
      runtime: 'vercel_cron',
      duration_ms: Date.now() - startTime,
      discovered: result.counts.discovered,
      written: result.counts.written,
      errors_count: result.counts.errors,
      refresh_checked: refreshResult.checked,
      refresh_updated: refreshResult.updated,
      error_messages: result.errors.length > 0 ? result.errors : undefined,
    });

    return NextResponse.json({
      success: true,
      runId: result.runId,
      refresh: {
        checked: refreshResult.checked,
        updated: refreshResult.updated,
        errors: refreshResult.errors,
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
