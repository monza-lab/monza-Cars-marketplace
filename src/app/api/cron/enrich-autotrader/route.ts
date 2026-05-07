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

function truncate(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  return value.length <= max ? value : value.slice(0, max);
}

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
    const TIME_BUDGET_MS = 270_000; // 4.5 min — must finish before Vercel's maxDuration=300s
    let consecutiveFailures = 0;
    const BATCH_SIZE = 200;
    const MAX_BATCHES = 5;
    let batches = 0;
    let timeBudgetReached = false;

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
          timeBudgetReached = true;
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
          const images = detail.images ?? [];

          const update: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if (detail.price != null && detail.price > 0) {
            update.current_bid = detail.price;
            update.hammer_price = detail.price;
          }
          if (detail.engine) update.engine = truncate(detail.engine, 100);
          if (detail.transmission) update.transmission = truncate(detail.transmission, 100);
          if (detail.mileage != null) {
            // Convert miles to km for consistency
            const mileageKm = detail.mileageUnit === "km"
              ? detail.mileage
              : Math.round(detail.mileage * 1.609344);
            update.mileage = mileageKm;
            update.mileage_unit = "km";
          }
          if (detail.exteriorColor) update.color_exterior = truncate(detail.exteriorColor, 100);
          if (detail.interiorColor) update.color_interior = truncate(detail.interiorColor, 100);
          if (detail.bodyStyle) update.body_style = truncate(detail.bodyStyle, 100);
          if (detail.vin) update.vin = truncate(detail.vin, 17);
          if (detail.description) update.description_text = truncate(detail.description, 2000);
          if (images.length > 0) {
            update.images = images;
            update.photos_count = images.length;
          }

          const detailHasRecoverableData =
            detail.price != null ||
            detail.mileage != null ||
            images.length > 0 ||
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

    const written = enriched + demoted;
    const noWrittenRows = discovered > 0 && written === 0 && errors.length === 0;

    if (noWrittenRows) {
      errors.push("Zero output: AutoTrader enrichment discovered rows but wrote none");
    }

    const success = (written > 0 || errors.length === 0) || timeBudgetReached;
    const successReason = timeBudgetReached
      ? "time_budget_reached"
      : noWrittenRows
        ? "no_written_rows"
        : written > 0
          ? "enrichment_progress"
          : errors.length === 0
            ? "no_rows_to_process"
            : "errors_present";

    await recordScraperRun({
      scraper_name: "enrich-autotrader",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered,
      written,
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
        demoted,
        written,
        errors,
        timeBudgetReached,
        successReason,
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
