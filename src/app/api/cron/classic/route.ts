import { NextResponse } from "next/server";
import { runClassicComCollector } from "@/features/classic_collector/collector";
import { recordScraperRun } from "@/lib/scraper-monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Vercel Pro

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
    const result = await runClassicComCollector({
      mode: "daily",
      make: "Porsche",
      location: "US",
      status: "forsale",
      maxPages: 2,
      maxListings: 50,
      headless: true,
      proxyServer: process.env.DECODO_PROXY_URL,
      proxyUsername: process.env.DECODO_PROXY_USER,
      proxyPassword: process.env.DECODO_PROXY_PASS,
      navigationDelayMs: 2000,
      pageTimeoutMs: 20000,
      checkpointPath: "/tmp/classic_collector/checkpoint.json",
      outputPath: "/tmp/classic_collector/listings.jsonl",
      dryRun: false,
      timeBudgetMs: 270_000,
      skipMonitoring: true, // cron route handles monitoring
    });

    await recordScraperRun({
      scraper_name: "classic",
      run_id: result.runId,
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: result.counts.discovered,
      written: result.counts.written,
      errors_count: result.counts.errors,
      details_fetched: result.counts.detailsFetched,
      normalized: result.counts.normalized,
      bot_blocked: result.counts.cloudflareBlocked,
      error_messages: result.errors.length > 0 ? result.errors : undefined,
    });

    return NextResponse.json({
      success: true,
      runId: result.runId,
      totalResults: result.totalResults,
      counts: result.counts,
      errors: result.errors,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/classic] Error:", error);

    await recordScraperRun({
      scraper_name: "classic",
      run_id: "unknown",
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
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
