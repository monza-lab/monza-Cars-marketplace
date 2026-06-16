import { NextResponse } from "next/server";
import { backfillMissingImages } from "@/features/scrapers/beforward_porsche_collector/backfill";
import { runCollector } from "@/features/scrapers/beforward_porsche_collector/collector";
import {
  loadCoverageState,
  refreshActiveListings,
  saveCoverageState,
} from "@/features/scrapers/beforward_porsche_collector/supabase_writer";
import {
  clearScraperRunActive,
  clearStaleActiveRun,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";
import { invalidateDashboardCache } from "@/lib/dashboardCache";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type CronMode = "fresh" | "coverage";

const PROFILES = {
  coverage: {
    maxPages: 25,
    summaryOnly: true,
    maxDetails: 0,
    backfillMaxListings: 0,
    refreshBudgetMs: 45_000,
    rateLimitMs: 3000,
  },
  fresh: {
    maxPages: 5,
    summaryOnly: true,
    maxDetails: 0,
    backfillMaxListings: 8,
    refreshBudgetMs: 60_000,
    rateLimitMs: 3500,
  },
} as const;

export async function GET(request: Request) {
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const liveRunId = crypto.randomUUID();
  const url = new URL(request.url);
  const mode: CronMode = url.searchParams.get("mode") === "coverage" ? "coverage" : "fresh";
  const profile = PROFILES[mode];

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  await clearStaleActiveRun("beforward", 10);

  await markScraperRunStarted({
    scraperName: "beforward",
    runId: liveRunId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    const refreshResult = await refreshActiveListings({ timeBudgetMs: profile.refreshBudgetMs });
    const coverageState = mode === "coverage" ? await loadCoverageState() : null;

    const result = await runCollector({
      startPage: coverageState?.nextPage,
      maxPages: profile.maxPages,
      maxDetails: profile.maxDetails,
      summaryOnly: profile.summaryOnly,
      concurrency: 3,
      rateLimitMs: profile.rateLimitMs,
      checkpointPath: mode === "coverage"
        ? "/tmp/beforward_coverage_checkpoint.json"
        : "/tmp/beforward_fresh_checkpoint.json",
      outputPath: mode === "coverage"
        ? "/tmp/beforward_coverage_listings.jsonl"
        : "/tmp/beforward_fresh_listings.jsonl",
      dryRun: false,
    });

    if (mode === "coverage") {
      const nextPage = result.plannedEndPage >= result.sourceTotalPages
        ? 1
        : result.plannedEndPage + 1;
      await saveCoverageState({
        nextPage,
        sourceTotalPages: result.sourceTotalPages,
        completedAt: nextPage === 1 ? new Date().toISOString() : null,
      });
    }

    const elapsedMs = Date.now() - startTime;
    const remainingMs = 290_000 - elapsedMs;
    let backfillResult = { discovered: 0, backfilled: 0, errors: [] as string[] };

    if (remainingMs > 30_000 && profile.backfillMaxListings > 0) {
      backfillResult = await backfillMissingImages({
        timeBudgetMs: Math.min(remainingMs - 15_000, 120_000),
        maxListings: profile.backfillMaxListings,
        rateLimitMs: 3500,
        timeoutMs: 15_000,
        runId: result.runId,
      });
    }

    const totalWritten = result.counts.written + backfillResult.backfilled + refreshResult.updated;
    const isSuccess = totalWritten > 0 || result.errors.length === 0;
    const coverageMessages = result.coverageLimited
      ? [`coverage_limited: processed pages ${result.plannedStartPage}-${result.plannedEndPage} of ${result.sourceTotalPages}`]
      : [];
    const errorMessages = [...coverageMessages, ...result.errors];

    await recordScraperRun({
      scraper_name: "beforward",
      run_id: result.runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: isSuccess,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: result.counts.discovered,
      written: result.counts.written,
      errors_count: result.counts.errors,
      refresh_checked: refreshResult.checked,
      refresh_updated: refreshResult.updated,
      backfill_discovered: backfillResult.discovered,
      backfill_written: backfillResult.backfilled,
      error_messages: errorMessages.length > 0 ? errorMessages : undefined,
    });

    await clearScraperRunActive("beforward");
    invalidateDashboardCache();

    return NextResponse.json({
      success: isSuccess,
      mode,
      runId: result.runId,
      refresh: {
        checked: refreshResult.checked,
        updated: refreshResult.updated,
        terminalized: refreshResult.terminalized,
        errors: refreshResult.errors,
      },
      backfill: {
        discovered: backfillResult.discovered,
        backfilled: backfillResult.backfilled,
        errors: backfillResult.errors,
      },
      totalResults: result.totalResults,
      pageCount: result.pageCount,
      sourceTotalPages: result.sourceTotalPages,
      plannedStartPage: result.plannedStartPage,
      plannedEndPage: result.plannedEndPage,
      coveragePercent: result.coveragePercent,
      coverageLimited: result.coverageLimited,
      processedPages: result.processedPages,
      counts: {
        ...result.counts,
        terminalized: result.counts.terminalized + refreshResult.terminalized,
      },
      errors: result.errors,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/beforward] Error:", error);

    await recordScraperRun({
      scraper_name: "beforward",
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

    await clearScraperRunActive("beforward");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Collector failed",
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 },
    );
  }
}
