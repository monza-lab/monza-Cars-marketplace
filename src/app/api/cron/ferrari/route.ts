import { NextResponse } from "next/server";
import { runCollector } from "@/features/ferrari_collector/collector";
import { refreshActiveListings } from "@/features/ferrari_collector/supabase_writer";
import { runLightBackfill, type LightBackfillResult } from "@/features/ferrari_collector/historical_backfill";

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
    const refreshResult = await refreshActiveListings();

    // Step 2: Discover and ingest new active listings
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
        console.error("[cron/ferrari] Backfill error (non-fatal):", error);
      }
    } else {
      backfillError = `Skipped: only ${Math.round(remainingMs / 1000)}s remaining`;
    }

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
