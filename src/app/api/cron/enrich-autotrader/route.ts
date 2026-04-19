import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAutoTraderDetail } from "@/features/scrapers/autotrader_collector/detail";
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { success: false, error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  await markScraperRunStarted({
    scraperName: "enrich-autotrader",
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
      .eq("source", "AutoTrader")
      .eq("status", "active")
      .is("engine", null)
      .order("updated_at", { ascending: true })
      .limit(100);

    if (fetchErr || !rows) {
      throw new Error(fetchErr?.message ?? "No rows returned");
    }

    const discovered = rows.length;
    let enriched = 0;
    const errors: string[] = [];
    const DELAY_MS = 1_000;
    const TIME_BUDGET_MS = 270_000;
    let consecutiveFailures = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (Date.now() - startTime > TIME_BUDGET_MS) {
        errors.push(`Time budget reached after ${enriched} enrichments`);
        break;
      }

      if (consecutiveFailures >= 5) {
        errors.push(`Circuit-break: ${consecutiveFailures} consecutive failures`);
        break;
      }

      if (i > 0) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      try {
        const detail = await fetchAutoTraderDetail(row.source_url);

        const update: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (detail.engine) update.engine = detail.engine;
        if (detail.transmission) update.transmission = detail.transmission;
        if (detail.mileage != null) {
          // Convert miles to km for consistency
          update.mileage_km = detail.mileageUnit === "km"
            ? detail.mileage
            : Math.round(detail.mileage * 1.609344);
        }
        if (detail.exteriorColor) update.color_exterior = detail.exteriorColor;
        if (detail.vin) update.vin = detail.vin;
        if (detail.description) update.description_text = detail.description;

        const newFieldCount = Object.keys(update).length - 1;
        if (newFieldCount > 0) {
          const { error: updateErr } = await client
            .from("listings")
            .update(update)
            .eq("id", row.id);

          if (updateErr) {
            errors.push(`Update failed (${row.id}): ${updateErr.message}`);
            consecutiveFailures++;
          } else {
            enriched++;
            consecutiveFailures = 0;
          }
        } else {
          // Mark as attempted
          await client
            .from("listings")
            .update({ engine: "", updated_at: new Date().toISOString() })
            .eq("id", row.id);
          consecutiveFailures = 0;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        consecutiveFailures++;

        if (/\b(403|429)\b/.test(msg) || /cloudflare/i.test(msg)) {
          errors.push(`Circuit-break: ${msg}`);
          break;
        }

        errors.push(`Failed ${row.source_url}: ${msg}`);
      }
    }

    const success = errors.length === 0 && !(discovered > 0 && enriched === 0);
    const errorMessages = success
      ? (errors.length > 0 ? errors : undefined)
      : [
          ...errors,
          ...(discovered > 0 && enriched === 0
            ? ["AutoTrader enrichment discovered listings but wrote nothing."]
            : []),
        ];

    await recordScraperRun({
      scraper_name: "enrich-autotrader",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered,
      written: enriched,
      errors_count: errorMessages?.length ?? 0,
      error_messages: errorMessages,
    });

    await clearScraperRunActive("enrich-autotrader");

    return NextResponse.json({
      success,
      runId,
      discovered,
      enriched,
      errors,
      successReason: success ? "enrichment_progress" : "no_written_rows",
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/enrich-autotrader] Error:", error);

    await recordScraperRun({
      scraper_name: "enrich-autotrader",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [error instanceof Error ? error.message : "Enrichment failed"],
    });

    await clearScraperRunActive("enrich-autotrader");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Enrichment failed",
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}
