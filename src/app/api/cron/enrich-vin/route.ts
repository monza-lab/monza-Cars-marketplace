import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { decodeVinsInBatches } from "@/features/scrapers/common/nhtsaVinDecoder";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring/record";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // VIN decode is fast — 60s is plenty

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
    scraperName: "enrich-vin",
    runId,
    startedAt,
    runtime: "vercel_cron",
  });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get up to 500 active listings with VINs but missing fields
    const { data: listings, error } = await supabase
      .from("listings")
      .select("id, vin, engine, transmission, body_style")
      .not("vin", "is", null)
      .neq("vin", "")
      .or("engine.is.null,transmission.is.null,body_style.is.null")
      .eq("status", "active")
      .limit(500);

    if (error) throw new Error(`Query error: ${error.message}`);

    const discovered = listings.length;
    if (discovered === 0) {
      await recordScraperRun({
        scraper_name: "enrich-vin",
        run_id: runId,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        success: true,
        runtime: "vercel_cron",
        duration_ms: Date.now() - startTime,
        discovered: 0,
        written: 0,
        errors_count: 0,
      });
      await clearScraperRunActive("enrich-vin");
      return NextResponse.json({ success: true, runId, discovered: 0, written: 0 });
    }

    const vins = listings.map((l) => l.vin as string);
    const decoded = await decodeVinsInBatches(vins, { delayMs: 1000 });

    let written = 0;
    const errors: string[] = [];

    for (const listing of listings) {
      const fields = decoded.get(listing.vin);
      if (!fields) continue;

      const updates: Record<string, string> = {};
      if (!listing.engine && fields.engine) updates.engine = fields.engine;
      if (!listing.transmission && fields.transmission) updates.transmission = fields.transmission;
      if (!listing.body_style && fields.bodyStyle) updates.body_style = fields.bodyStyle;

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
      scraper_name: "enrich-vin",
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
    await clearScraperRunActive("enrich-vin");

    return NextResponse.json({
      success: true,
      runId,
      duration: `${Date.now() - startTime}ms`,
      discovered,
      decoded: decoded.size,
      written,
      errors: errors.slice(0, 10),
    });
  } catch (err: any) {
    await recordScraperRun({
      scraper_name: "enrich-vin",
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
    await clearScraperRunActive("enrich-vin");
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
