import { NextResponse } from "next/server"
import { runElferspotCollector } from "@/features/scrapers/elferspot_collector/collector"
import { clearScraperRunActive, markScraperRunStarted, recordScraperRun } from "@/features/scrapers/common/monitoring"
import { invalidateDashboardCache } from "@/lib/dashboardCache"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: Request) {
  const startTime = Date.now()
  const startedAtIso = new Date(startTime).toISOString()
  const runId = crypto.randomUUID()

  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  await markScraperRunStarted({ scraperName: "elferspot", runId, startedAt: startedAtIso, runtime: "vercel_cron" })

  try {
    const result = await runElferspotCollector({
      maxPages: 25,
      maxListings: 3500,
      scrapeDetails: false,
      delayMs: 10_000,
      checkpointPath: "/tmp/elferspot_collector/checkpoint.json",
      outputPath: "/tmp/elferspot_collector/listings.jsonl",
      dryRun: false,
      language: "en",
    })

    await recordScraperRun({
      scraper_name: "elferspot",
      run_id: result.runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: result.counts.discovered,
      written: result.counts.written,
      errors_count: result.counts.errors,
      error_messages: result.errors.length > 0 ? result.errors : undefined,
    })

    await clearScraperRunActive("elferspot")
    invalidateDashboardCache()

    return NextResponse.json({
      success: true,
      runId: result.runId,
      discovered: result.counts.discovered,
      written: result.counts.written,
      errors: result.errors,
      duration: `${Date.now() - startTime}ms`,
    })
  } catch (error) {
    console.error("[cron/elferspot] Error:", error)
    await recordScraperRun({
      scraper_name: "elferspot", run_id: runId, started_at: startedAtIso,
      finished_at: new Date().toISOString(), success: false, runtime: "vercel_cron",
      duration_ms: Date.now() - startTime, discovered: 0, written: 0, errors_count: 1,
      error_messages: [error instanceof Error ? error.message : "Collection failed"],
    })
    await clearScraperRunActive("elferspot")
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Collection failed", duration: `${Date.now() - startTime}ms` }, { status: 500 })
  }
}
