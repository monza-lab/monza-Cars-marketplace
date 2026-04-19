import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  parseEngineFromText,
  parseTransmissionFromText,
  parseBodyStyleFromText,
  parseTrimFromText,
} from "@/features/scrapers/common/titleEnrichment";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring/record";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Title parsing is CPU-only, very fast

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const runId = crypto.randomUUID();
  const startedAt = new Date(startTime).toISOString();

  await markScraperRunStarted({
    scraperName: "enrich-titles",
    runId,
    startedAt,
    runtime: "vercel_cron",
  });

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: listings, error } = await supabase
      .from("listings")
      .select("id, title, engine, transmission, body_style, trim")
      .or("engine.is.null,transmission.is.null,body_style.is.null,trim.is.null")
      .eq("status", "active")
      .not("title", "is", null)
      .order("updated_at", { ascending: true })
      .limit(1000);

    if (error) throw new Error(`Query error: ${error.message}`);

    const discovered = listings.length;
    let written = 0;
    const errors: string[] = [];

    for (const listing of listings) {
      const title = listing.title as string;
      const updates: Record<string, string> = {};

      if (!listing.engine) {
        const engine = parseEngineFromText(title);
        if (engine) updates.engine = engine;
      }
      if (!listing.transmission) {
        const transmission = parseTransmissionFromText(title);
        if (transmission) updates.transmission = transmission;
      }
      if (!listing.body_style) {
        const bodyStyle = parseBodyStyleFromText(title);
        if (bodyStyle) updates.body_style = bodyStyle;
      }
      if (!listing.trim) {
        const trim = parseTrimFromText(title);
        if (trim) updates.trim = trim;
      }

      if (Object.keys(updates).length === 0) continue;

      const { error: updateErr } = await supabase
        .from("listings")
        .update(updates)
        .eq("id", listing.id);

      if (updateErr) {
        errors.push(`${listing.id}: ${updateErr.message}`);
        continue;
      }
      written++;
    }

    await recordScraperRun({
      scraper_name: "enrich-titles",
      run_id: runId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered,
      written,
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors : undefined,
    });
    await clearScraperRunActive("enrich-titles");

    return NextResponse.json({
      success: true,
      runId,
      duration: `${Date.now() - startTime}ms`,
      discovered,
      written,
      errors: errors.slice(0, 10),
    });
  } catch (err: any) {
    await recordScraperRun({
      scraper_name: "enrich-titles",
      run_id: runId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [err.message],
    });
    await clearScraperRunActive("enrich-titles");
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
