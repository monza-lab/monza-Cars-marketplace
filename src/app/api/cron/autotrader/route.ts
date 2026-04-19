import { NextResponse } from "next/server";
import { runCollector } from "@/features/scrapers/autotrader_collector/collector";
import { refreshActiveListings } from "@/features/scrapers/autotrader_collector/supabase_writer";
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
    scraperName: "autotrader",
    runId: liveRunId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    // Step 1: Refresh status of existing active listings
    const refreshResult = await refreshActiveListings();

    // Step 2: Discover and ingest new active listings via AutoTrader GraphQL
    const result = await runCollector({
      mode: "daily",
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
    const hasCollectorOutput = totalDiscovered > 0 || totalWritten > 0;
    const allErrors = [...result.errors, ...refreshResult.errors];
    const success = hasCollectorOutput && allErrors.length === 0;
    const successReason = !hasCollectorOutput
      ? "no_collector_output"
      : allErrors.length > 0
        ? "collector_errors"
        : "collector_output_present";
    const errorMessages = !hasCollectorOutput && allErrors.length === 0
      ? ["AutoTrader cron produced no discovered or written listings; verify the upstream gateway and filters."]
      : allErrors;

    await recordScraperRun({
      scraper_name: 'autotrader',
      run_id: result.runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success,
      runtime: 'vercel_cron',
      duration_ms: Date.now() - startTime,
      discovered: totalDiscovered,
      written: totalWritten,
      errors_count: errorMessages.length,
      refresh_checked: refreshResult.checked,
      refresh_updated: refreshResult.updated,
      source_counts: result.sourceCounts,
      error_messages: errorMessages.length > 0 ? errorMessages : undefined,
    });

    await clearScraperRunActive("autotrader");

    return NextResponse.json({
      success,
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
      successReason,
      backfill: { skipped: true, reason: "Not implemented for AutoTrader" },
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/autotrader] Error:", error);

    await recordScraperRun({
      scraper_name: 'autotrader',
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

    await clearScraperRunActive("autotrader");

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
