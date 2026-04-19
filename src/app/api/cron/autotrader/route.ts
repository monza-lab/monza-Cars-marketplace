import { NextResponse } from "next/server";
import { runCollector } from "@/features/scrapers/autotrader_collector/collector";
import { refreshActiveListings } from "@/features/scrapers/autotrader_collector/supabase_writer";
import { GET as enrichAutoTrader } from "@/app/api/cron/enrich-autotrader/route";
import { backfillImagesForSource } from "@/features/scrapers/common/backfillImages";
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

    const backfillResult = await backfillImagesForSource({
      source: "AutoTrader",
      maxListings: 40,
      delayMs: 1000,
      timeBudgetMs: 90_000,
    });

    const enrichResponse = await enrichAutoTrader(
      new Request("http://localhost/api/cron/enrich-autotrader", {
        method: "GET",
        headers: { authorization: authHeader ?? "" },
      })
    );
    const enrichText = await enrichResponse.text();
    let enrichment: Record<string, unknown> | null = null;
    try {
      enrichment = JSON.parse(enrichText) as Record<string, unknown>;
    } catch {
      enrichment = { status: enrichResponse.status, body: enrichText.slice(0, 1000) };
    }

    const totalWritten = Object.values(result.sourceCounts).reduce(
      (sum, c) => sum + c.written,
      0
    );
    const totalDiscovered = Object.values(result.sourceCounts).reduce(
      (sum, c) => sum + c.discovered,
      0
    );

    if (totalDiscovered === 0 && totalWritten === 0) {
      const zeroOutputError = "Zero output: AutoTrader discovered and wrote no rows";

      await recordScraperRun({
        scraper_name: 'autotrader',
        run_id: result.runId,
        started_at: startedAtIso,
        finished_at: new Date().toISOString(),
        success: false,
        runtime: 'vercel_cron',
        duration_ms: Date.now() - startTime,
        discovered: totalDiscovered,
        written: totalWritten,
        errors_count: 1 + backfillResult.errors.length,
        refresh_checked: refreshResult.checked,
        refresh_updated: refreshResult.updated,
        source_counts: result.sourceCounts,
        error_messages: [zeroOutputError, ...backfillResult.errors],
      });

      await clearScraperRunActive("autotrader");

      return NextResponse.json(
        {
          success: false,
          error: zeroOutputError,
          enrichment,
          refresh: {
            checked: refreshResult.checked,
            updated: refreshResult.updated,
            errors: refreshResult.errors,
          },
          backfill: {
            source: backfillResult.source,
            discovered: backfillResult.discovered,
            backfilled: backfillResult.backfilled,
            errors: backfillResult.errors,
            durationMs: backfillResult.durationMs,
          },
          discovered: totalDiscovered,
          written: totalWritten,
          sourceCounts: result.sourceCounts,
          errors: result.errors,
          duration: `${Date.now() - startTime}ms`,
        },
        { status: 500 }
      );
    }

    await recordScraperRun({
      scraper_name: 'autotrader',
      run_id: result.runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: 'vercel_cron',
      duration_ms: Date.now() - startTime,
      discovered: totalDiscovered,
      written: totalWritten,
      errors_count: result.errors.length + backfillResult.errors.length,
      refresh_checked: refreshResult.checked,
      refresh_updated: refreshResult.updated,
      source_counts: result.sourceCounts,
      error_messages: result.errors.length > 0 || backfillResult.errors.length > 0
        ? [...result.errors, ...backfillResult.errors]
        : undefined,
    });

    await clearScraperRunActive("autotrader");
    invalidateDashboardCache();

    return NextResponse.json({
      success: true,
      runId: result.runId,
      enrichment,
      refresh: {
        checked: refreshResult.checked,
        updated: refreshResult.updated,
        errors: refreshResult.errors,
      },
      backfill: {
        source: backfillResult.source,
        discovered: backfillResult.discovered,
        backfilled: backfillResult.backfilled,
        errors: backfillResult.errors,
        durationMs: backfillResult.durationMs,
      },
      discovered: totalDiscovered,
      written: totalWritten,
      sourceCounts: result.sourceCounts,
      errors: result.errors,
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
