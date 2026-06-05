import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  parseEngineFromText,
  parseTransmissionFromText,
  parseBodyStyleFromText,
  parseTrimFromText,
} from "@/features/scrapers/common/titleEnrichment";
import { buildMissingAnyFilter } from "@/features/scrapers/common/enrichmentLoopPolicy";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring/record";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Title parsing is CPU-only, very fast
const TITLE_BATCH_SIZE = 1000;
const MAX_TITLE_CANDIDATES = 5000;

function truncate(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  return value.length <= max ? value : value.slice(0, max);
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

    const missingTitleFields = buildMissingAnyFilter([
      { field: "engine", type: "text" },
      { field: "transmission", type: "text" },
      { field: "body_style", type: "text" },
      { field: "trim", type: "text" },
    ]);

    const listings: Array<{
      id: string;
      title: string | null;
      engine: string | null;
      transmission: string | null;
      body_style: string | null;
      trim: string | null;
    }> = [];
    for (let offset = 0; offset < MAX_TITLE_CANDIDATES; offset += TITLE_BATCH_SIZE) {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, engine, transmission, body_style, trim")
        .or(missingTitleFields)
        .eq("status", "active")
        .not("title", "is", null)
        .order("updated_at", { ascending: true })
        .range(offset, offset + TITLE_BATCH_SIZE - 1);

      if (error) throw new Error(`Query error: ${error.message}`);
      listings.push(...(data ?? []));
      if (!data || data.length < TITLE_BATCH_SIZE) break;
    }

    const discovered = listings.length;
    let written = 0;
    const errors: string[] = [];

    for (const listing of listings) {
      const title = listing.title as string;
      const updates: Record<string, string> = {};

      if (!listing.engine) {
        const engine = parseEngineFromText(title);
        if (engine) updates.engine = truncate(engine, 100)!;
      }
      if (!listing.transmission) {
        const transmission = parseTransmissionFromText(title);
        if (transmission) updates.transmission = truncate(transmission, 100)!;
      }
      if (!listing.body_style) {
        const bodyStyle = parseBodyStyleFromText(title);
        if (bodyStyle) updates.body_style = truncate(bodyStyle, 100)!;
      }
      if (!listing.trim) {
        const trim = parseTrimFromText(title);
        if (trim) updates.trim = truncate(trim, 100)!;
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

    const success = errors.length === 0 || written > 0;

    await recordScraperRun({
      scraper_name: "enrich-titles",
      run_id: runId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      success,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered,
      written,
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors : undefined,
    });
    await clearScraperRunActive("enrich-titles");

    return NextResponse.json({
      success,
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
