import { NextRequest, NextResponse } from "next/server";
import { runWorker } from "@/features/social-engine/workers/worker";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const runId = crypto.randomUUID();

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await markScraperRunStarted({
    scraperName: "social-engine",
    runId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    const result = await runWorker();
    const success = result.errors.length === 0;

    await recordScraperRun({
      scraper_name: "social-engine",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: result.candidates,
      written: result.draftsCreated,
      errors_count: result.errors.length,
      error_messages:
        result.errors.length > 0
          ? result.errors.map((e) => `${e.listing_id} [${e.stage}]: ${e.message}`)
          : undefined,
    });
    await clearScraperRunActive("social-engine");

    return NextResponse.json(result, { status: success ? 200 : 500 });
  } catch (error) {
    console.error("[cron/social-engine] Error:", error);
    const message = error instanceof Error ? error.message : "Worker failed";

    await recordScraperRun({
      scraper_name: "social-engine",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [message],
    });
    await clearScraperRunActive("social-engine");

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
