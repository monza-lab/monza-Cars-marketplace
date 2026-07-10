import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { decodeVinsInBatches } from "@/features/scrapers/common/nhtsaVinDecoder";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring/record";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // VIN decode is fast — 120s for larger batches

export type VinEnrichmentZeroWriteReason =
  | "queue_exhausted"
  | "decode_failed"
  | "no_new_fields"
  | null;

export function classifyVinEnrichmentOutcome(input: {
  discovered: number;
  decoded: number;
  written: number;
  errors: readonly string[];
}): {
  zeroWriteReason: VinEnrichmentZeroWriteReason;
  queueExhausted: boolean;
  degraded: boolean;
} {
  if (input.written > 0) {
    return { zeroWriteReason: null, queueExhausted: false, degraded: input.errors.length > 0 };
  }

  if (input.discovered === 0) {
    return { zeroWriteReason: "queue_exhausted", queueExhausted: true, degraded: false };
  }

  if (input.decoded === 0) {
    return { zeroWriteReason: "decode_failed", queueExhausted: false, degraded: true };
  }

  return { zeroWriteReason: "no_new_fields", queueExhausted: false, degraded: true };
}

export function isVinDecodeCandidate(input: { vin: string | null; year: number | null }): boolean {
  if (!input.vin || input.year == null || input.year < 1981) return false;
  const vin = input.vin.trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return false;
  if (!/^WP[01]/.test(vin)) return false;
  if (vin.slice(3, 6) === "ZZZ") return false;
  return true;
}

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

    // Get active post-1981 listings with NHTSA-decodeable VINs but missing fields.
    const { data: listings, error } = await supabase
      .from("listings")
      .select("id, vin, year, engine, transmission, body_style")
      .not("vin", "is", null)
      .neq("vin", "")
      .gte("year", 1981)
      .like("vin", "_________________")
      .or("engine.is.null,transmission.is.null,body_style.is.null")
      .eq("status", "active")
      .order("updated_at", { ascending: true })
      .limit(1000);

    if (error) throw new Error(`Query error: ${error.message}`);

    const candidates = listings
      .filter((listing) => isVinDecodeCandidate({ vin: listing.vin, year: listing.year }))
      .slice(0, 500);
    const discovered = candidates.length;
    if (discovered === 0) {
      const outcome = classifyVinEnrichmentOutcome({
        discovered: 0,
        decoded: 0,
        written: 0,
        errors: [],
      });
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
      return NextResponse.json({
        success: true,
        runId,
        discovered: 0,
        decoded: 0,
        written: 0,
        ...outcome,
      });
    }

    const vins = candidates.map((l) => (l.vin as string).trim().toUpperCase());
    const decoded = await decodeVinsInBatches(vins, { delayMs: 1000 });

    let written = 0;
    const errors: string[] = [];

    for (const listing of candidates) {
      const vin = (listing.vin as string).trim().toUpperCase();
      const fields = decoded.get(vin);
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

    const outcome = classifyVinEnrichmentOutcome({
      discovered,
      decoded: decoded.size,
      written,
      errors,
    });

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
      error_messages: errors.length > 0
        ? errors
        : outcome.zeroWriteReason && outcome.zeroWriteReason !== "queue_exhausted"
          ? [`vin_zero_write:${outcome.zeroWriteReason}`]
          : undefined,
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
      ...outcome,
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
