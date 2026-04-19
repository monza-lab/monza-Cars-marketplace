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

    const discoveredRows = new Set<string>();
    let enriched = 0;
    let demoted = 0;
    const errors: string[] = [];
    const DELAY_MS = 0;
    const TIME_BUDGET_MS = 600_000;
    let consecutiveFailures = 0;
    const BATCH_SIZE = 200;
    const MAX_BATCHES = 20;
    let batches = 0;

    while (Date.now() - startTime <= TIME_BUDGET_MS && batches < MAX_BATCHES) {
      const { data: rows, error: fetchErr } = await client
        .from("listings")
        .select("id,source_url,current_bid,mileage,images,engine,transmission,vin,color_exterior,description_text,status")
        .eq("source", "AutoTrader")
        .eq("status", "active")
        .lt("updated_at", startedAtIso)
        .or("current_bid.is.null,current_bid.lte.0,engine.is.null,transmission.is.null,vin.is.null,color_exterior.is.null,mileage.is.null,description_text.is.null,images.is.null,images.eq.{},photos_count.lt.10")
        .order("photos_count", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: true })
        .limit(BATCH_SIZE);

      if (fetchErr || !rows) {
        throw new Error(fetchErr?.message ?? "No rows returned");
      }

      if (rows.length === 0) break;
      batches++;

      let batchEnriched = 0;
      let batchDemoted = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        discoveredRows.add(row.id);

        if (Date.now() - startTime > TIME_BUDGET_MS) {
          errors.push(`Time budget reached after ${enriched} enrichments`);
          break;
        }

        if (consecutiveFailures >= 5) {
          errors.push(`Circuit-break: ${consecutiveFailures} consecutive failures`);
          break;
        }

        if (i > 0 && DELAY_MS > 0) {
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }

        try {
          const detail = await fetchAutoTraderDetail(row.source_url);

          const update: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if (detail.price != null && detail.price > 0) {
            update.current_bid = detail.price;
            update.hammer_price = detail.price;
          }
          if (detail.engine) update.engine = detail.engine;
          if (detail.transmission) update.transmission = detail.transmission;
          if (detail.mileage != null) {
            // Convert miles to km for consistency
            const mileageKm = detail.mileageUnit === "km"
              ? detail.mileage
              : Math.round(detail.mileage * 1.609344);
            update.mileage = mileageKm;
            update.mileage_unit = "km";
          }
          if (detail.exteriorColor) update.color_exterior = detail.exteriorColor;
          if (detail.interiorColor) update.color_interior = detail.interiorColor;
          if (detail.bodyStyle) update.body_style = detail.bodyStyle;
          if (detail.vin) update.vin = detail.vin;
          if (detail.description) update.description_text = detail.description;
          if (detail.images.length > 0) {
            update.images = detail.images;
            update.photos_count = detail.images.length;
          }

          const detailHasRecoverableData =
            detail.price != null ||
            detail.mileage != null ||
            detail.images.length > 0 ||
            detail.engine != null ||
            detail.transmission != null ||
            detail.vin != null ||
            detail.exteriorColor != null ||
            detail.description != null;

          if (Object.keys(update).length > 1) {
            const { error: updateErr } = await client
              .from("listings")
              .update(update)
              .eq("id", row.id);

            if (updateErr) {
              errors.push(`Update failed (${row.id}): ${updateErr.message}`);
              consecutiveFailures++;
            } else {
              enriched++;
              batchEnriched++;
              consecutiveFailures = 0;
            }
          } else if (!detailHasRecoverableData) {
            const { error: demoteErr } = await client
              .from("listings")
              .update({
                status: "unsold",
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);

            if (demoteErr) {
              errors.push(`Demote failed (${row.id}): ${demoteErr.message}`);
              consecutiveFailures++;
            } else {
              demoted++;
              batchDemoted++;
              consecutiveFailures = 0;
            }
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

      if (batchEnriched === 0 && batchDemoted === 0) {
        break;
      }
    }

    const discovered = discoveredRows.size;

    if (discovered > 0 && enriched === 0 && errors.length === 0) {
      errors.push("Zero output: AutoTrader enrichment discovered rows but wrote none");
    }

    const success = errors.length === 0 && !(discovered > 0 && enriched === 0);

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
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors : undefined,
    });

    await clearScraperRunActive("enrich-autotrader");

    return NextResponse.json(
      {
        success,
        runId,
        discovered,
        enriched,
        errors,
        duration: `${Date.now() - startTime}ms`,
      },
      { status: success ? 200 : 500 }
    );
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
