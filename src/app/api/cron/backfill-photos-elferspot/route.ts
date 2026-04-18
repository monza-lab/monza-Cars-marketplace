import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchDetailPage } from "@/features/scrapers/elferspot_collector/detail";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DELAY_MS = 2_500;
const TIME_BUDGET_MS = 270_000;
const MAX_LISTINGS = 80;

export async function GET(request: Request) {
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const runId = crypto.randomUUID();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ success: false, error: "Missing Supabase env vars" }, { status: 500 });
  }

  await markScraperRunStarted({
    scraperName: "backfill-photos-elferspot",
    runId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error: fetchErr } = await client
      .from("listings")
      .select("id,source_url")
      .eq("source", "Elferspot")
      .eq("status", "active")
      .or("images.is.null,images.eq.{},photos_count.lt.2")
      .order("updated_at", { ascending: true })
      .limit(MAX_LISTINGS);

    if (fetchErr || !rows) throw new Error(fetchErr?.message ?? "No rows returned");

    const discovered = rows.length;
    let backfilled = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        errors.push(`Time budget reached after ${backfilled} backfills`);
        break;
      }
      if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS));

      const row = rows[i];
      try {
        const detail = await fetchDetailPage(row.source_url);
        const images = detail?.images ?? [];

        // Only overwrite when we have MORE than the single thumbnail fallback.
        if (images.length < 2) continue;

        const { error: updateErr } = await client
          .from("listings")
          .update({
            images,
            photos_count: images.length,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        if (updateErr) errors.push(`Update failed (${row.id}): ${updateErr.message}`);
        else backfilled++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/\b(404|410)\b/.test(msg)) {
          await client
            .from("listings")
            .update({ status: "delisted", updated_at: new Date().toISOString() })
            .eq("id", row.id);
          errors.push(`Delisted (${row.id}): ${msg}`);
          continue;
        }
        if (/\b(403|429)\b/.test(msg)) {
          errors.push(`Circuit-break: ${msg}`);
          break;
        }
        errors.push(`Failed ${row.source_url}: ${msg}`);
      }
    }

    await recordScraperRun({
      scraper_name: "backfill-photos-elferspot",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered,
      written: backfilled,
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors : undefined,
    });
    await clearScraperRunActive("backfill-photos-elferspot");

    return NextResponse.json({
      success: true,
      runId,
      discovered,
      backfilled,
      errors,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    await recordScraperRun({
      scraper_name: "backfill-photos-elferspot",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [error instanceof Error ? error.message : "Backfill failed"],
    });
    await clearScraperRunActive("backfill-photos-elferspot");
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 },
    );
  }
}
