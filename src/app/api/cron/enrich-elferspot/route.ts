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
    scraperName: "enrich-elferspot",
    runId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Query Elferspot active listings missing description (proxy for unenriched)
    const { data: rows, error: fetchErr } = await client
      .from("listings")
      .select("id,source_url")
      .eq("source", "Elferspot")
      .eq("status", "active")
      .is("description_text", null)
      .order("updated_at", { ascending: true })
      .limit(50);

    if (fetchErr || !rows) {
      throw new Error(fetchErr?.message ?? "No rows returned");
    }

    const discovered = rows.length;
    let enriched = 0;
    const errors: string[] = [];
    const DELAY_MS = 5_000;
    const TIME_BUDGET_MS = 270_000;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (Date.now() - startTime > TIME_BUDGET_MS) {
        errors.push(`Time budget reached after ${enriched} enrichments`);
        break;
      }

      if (i > 0) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      try {
        const detail = await fetchDetailPage(row.source_url);

        if (!detail) {
          await client
            .from("listings")
            .update({ description_text: "", updated_at: new Date().toISOString() })
            .eq("id", row.id);
          continue;
        }

        const update: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
        };

        if (detail.price) {
          update.hammer_price = detail.price;
          update.current_bid = detail.price;
          update.original_currency = detail.currency;
        }
        if (detail.mileageKm) {
          update.mileage = detail.mileageKm;
          update.mileage_unit = "km";
        }
        if (detail.transmission) update.transmission = detail.transmission;
        if (detail.bodyType) update.body_style = detail.bodyType;
        if (detail.engine) update.engine = detail.engine;
        if (detail.colorExterior) update.color_exterior = detail.colorExterior;
        if (detail.colorInterior) update.color_interior = detail.colorInterior;
        if (detail.vin) update.vin = detail.vin;
        if (detail.descriptionText) update.description_text = detail.descriptionText;
        if (detail.images && detail.images.length > 0) {
          update.images = detail.images;
          update.photos_count = detail.images.length;
        }
        // seller_name and seller_type columns don't exist in listings table
        if (detail.location) update.location = detail.location;
        if (detail.locationCountry) update.country = detail.locationCountry;

        const newFieldCount = Object.keys(update).length - 2; // minus updated_at, last_verified_at
        if (newFieldCount > 0) {
          const { error: updateErr } = await client
            .from("listings")
            .update(update)
            .eq("id", row.id);

          if (updateErr) {
            errors.push(`Update failed (${row.id}): ${updateErr.message}`);
          } else {
            enriched++;
          }
        } else {
          await client
            .from("listings")
            .update({ description_text: "", updated_at: new Date().toISOString() })
            .eq("id", row.id);
        }
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
      scraper_name: "enrich-elferspot",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered,
      written: enriched,
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors : undefined,
    });

    await clearScraperRunActive("enrich-elferspot");

    return NextResponse.json({
      success: true,
      runId,
      discovered,
      enriched,
      errors,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/enrich-elferspot] Error:", error);

    await recordScraperRun({
      scraper_name: "enrich-elferspot",
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

    await clearScraperRunActive("enrich-elferspot");

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
