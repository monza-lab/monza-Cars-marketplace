import { NextResponse } from "next/server";
import { backfillImagesForSource } from "@/features/scrapers/common/backfillImages";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const runId = crypto.randomUUID();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  await markScraperRunStarted({
    scraperName: "backfill-images",
    runId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    // Process BaT first (biggest backlog), then BeForward, then AutoScout24
    const sources = ["BaT", "BeForward", "AutoScout24"] as const;
    const results = [];
    let totalBackfilled = 0;
    let totalDiscovered = 0;
    const allErrors: string[] = [];
    const timeBudgetMs = 270_000; // Leave 30s margin for overhead
    const perSourceBudget = Math.floor(timeBudgetMs / sources.length);

    for (const source of sources) {
      // Check if we still have time
      if (Date.now() - startTime > timeBudgetMs) break;

      const remainingMs = timeBudgetMs - (Date.now() - startTime);
      const budget = Math.min(perSourceBudget, remainingMs);

      const result = await backfillImagesForSource({
        source,
        maxListings: 20,
        delayMs: 2000,
        timeBudgetMs: budget,
      });

      results.push(result);
      totalBackfilled += result.backfilled;
      totalDiscovered += result.discovered;
      allErrors.push(...result.errors);
    }

    await recordScraperRun({
      scraper_name: "backfill-images",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: totalDiscovered,
      written: totalBackfilled,
      errors_count: allErrors.length,
      error_messages: allErrors.length > 0 ? allErrors : undefined,
    });

    await clearScraperRunActive("backfill-images");

    return NextResponse.json({
      success: true,
      runId,
      totalDiscovered,
      totalBackfilled,
      results: results.map((r) => ({
        source: r.source,
        discovered: r.discovered,
        backfilled: r.backfilled,
        errors: r.errors,
        durationMs: r.durationMs,
      })),
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/backfill-images] Error:", error);

    await recordScraperRun({
      scraper_name: "backfill-images",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [
        error instanceof Error ? error.message : "Backfill failed",
      ],
    });

    await clearScraperRunActive("backfill-images");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Backfill failed",
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}
