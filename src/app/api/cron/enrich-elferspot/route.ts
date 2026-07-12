import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classifyVehicleIdentifier, type VehicleIdentifier } from "@/features/scrapers/common/vehicleIdentifier";
import { fetchDetailPage } from "@/features/scrapers/elferspot_collector/detail";
import { ELFERSPOT_RESOLVED_NON_NUMERIC_PRICE_STATUSES } from "@/features/scrapers/elferspot_collector/coverage";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PRICE_COVERED_STATUS_FILTER = `(${ELFERSPOT_RESOLVED_NON_NUMERIC_PRICE_STATUSES.map((status) => `"${status}"`).join(",")})`;
const DESCRIPTION_COVERED_STATUS_FILTER = `("missing","detail_unavailable","blocked_unverified")`;
const TARGET_FIELD_COVERED_STATUS_FILTER = `("covered_or_unavailable","detail_unavailable","blocked_unverified")`;
const TARGET_FIELD_PLACEHOLDER_FILTER = `("Not specified","Unknown","N/A","-")`;
const TARGET_FIELD_FILTER = [
  `color_exterior.is.null`,
  `color_exterior.eq.`,
  `color_exterior.in.${TARGET_FIELD_PLACEHOLDER_FILTER}`,
  `engine.is.null`,
  `engine.eq.`,
  `engine.in.${TARGET_FIELD_PLACEHOLDER_FILTER}`,
  `transmission.is.null`,
  `transmission.eq.`,
  `transmission.in.${TARGET_FIELD_PLACEHOLDER_FILTER}`,
].join(",");
const VIN_COVERED_STATUS_FILTER = `("present","chassis_or_serial","not_listed")`;

type EnrichmentMeta = {
  elferspot?: {
    priceStatus?: string;
    descriptionStatus?: string;
    targetFieldStatus?: string;
    vinStatus?: "present" | "chassis_or_serial" | "not_listed";
    missingTargetFields?: string[];
    vehicleIdentifier?: VehicleIdentifier;
    checkedAt?: string;
  };
};

export type EnrichmentRow = {
  id: string;
  source_url: string;
  enrichment_meta: EnrichmentMeta | null;
};

type SupabaseClientLike = {
  from: (table: "listings") => any;
};

export function buildElferspotMeta(
  existingMeta: EnrichmentMeta | null,
  update: {
    priceStatus?: string;
    descriptionStatus?: string;
    targetFieldStatus?: string;
    vinStatus?: "present" | "chassis_or_serial" | "not_listed";
    missingTargetFields?: string[];
    vehicleIdentifier?: VehicleIdentifier;
    checkedAt?: string;
  },
) {
  return {
    ...(existingMeta ?? {}),
    elferspot: {
      ...(existingMeta?.elferspot ?? {}),
      ...update,
      checkedAt: update.checkedAt ?? new Date().toISOString(),
    },
  };
}

export function resolveBatchLimit(request: Request): number {
  const raw = new URL(request.url).searchParams.get("limit");
  const parsed = raw ? Number.parseInt(raw, 10) : 250;
  if (!Number.isFinite(parsed) || parsed <= 0) return 250;
  return Math.min(parsed, 300);
}

export function resolveDelayMs(request: Request): number {
  const raw = new URL(request.url).searchParams.get("delayMs");
  const parsed = raw ? Number.parseInt(raw, 10) : 1000;
  if (!Number.isFinite(parsed) || parsed < 0) return 1000;
  return Math.min(parsed, 5000);
}

export function mergeRowsForEnrichment(
  targetRows: EnrichmentRow[],
  descriptionRows: EnrichmentRow[],
  vinRows: EnrichmentRow[],
  priceRows: EnrichmentRow[],
  limit: number,
): EnrichmentRow[] {
  const rows: EnrichmentRow[] = [];
  const seen = new Set<string>();

  for (const bucket of [priceRows, targetRows, descriptionRows, vinRows]) {
    for (const row of bucket) {
      if (seen.has(row.id)) continue;
      rows.push(row);
      seen.add(row.id);
      if (rows.length >= limit) return rows;
    }
  }

  return rows;
}

export function resolveElferspotVin(raw: string | null | undefined): {
  vin?: string;
  vehicleIdentifier?: VehicleIdentifier;
  vinStatus: "present" | "chassis_or_serial" | "not_listed";
} {
  if (!raw?.trim()) return { vinStatus: "not_listed" };

  const vin = classifyVehicleIdentifier(raw, "VIN");
  if (vin?.kind === "vin_17") {
    return { vin: vin.normalized, vinStatus: "present" };
  }
  const identifier = classifyVehicleIdentifier(raw, "Chassis");
  if (identifier) {
    return { vehicleIdentifier: identifier, vinStatus: "chassis_or_serial" };
  }
  return { vinStatus: "not_listed" };
}

async function fetchRows(client: SupabaseClientLike, filter: "target" | "description" | "vin" | "price", limit: number) {
  const q = client
    .from("listings")
    .select("id,source_url,enrichment_meta")
    .eq("source", "Elferspot")
    .eq("status", "active")
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (filter === "target") {
    return q
      .or(TARGET_FIELD_FILTER)
      .or(
        `enrichment_meta->elferspot->>targetFieldStatus.is.null,enrichment_meta->elferspot->>targetFieldStatus.not.in.${TARGET_FIELD_COVERED_STATUS_FILTER}`,
      );
  }

  if (filter === "description") {
    return q.or(
      `description_text.is.null,description_text.eq.,enrichment_meta->elferspot->>descriptionStatus.is.null,enrichment_meta->elferspot->>descriptionStatus.not.in.${DESCRIPTION_COVERED_STATUS_FILTER}`,
    );
  }

  if (filter === "vin") {
    return q
      .or("vin.is.null,vin.eq.")
      .or(
        `enrichment_meta->elferspot->>vinStatus.is.null,enrichment_meta->elferspot->>vinStatus.not.in.${VIN_COVERED_STATUS_FILTER}`,
      );
  }

  return q
    .is("hammer_price", null)
    .or(
      `enrichment_meta->elferspot->>priceStatus.is.null,enrichment_meta->elferspot->>priceStatus.not.in.${PRICE_COVERED_STATUS_FILTER}`,
    );
}

function missingTargetFields(update: Record<string, unknown>) {
  const missing: string[] = [];
  if (!update.color_exterior) missing.push("color_exterior");
  if (!update.engine) missing.push("engine");
  if (!update.transmission) missing.push("transmission");
  return missing;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const batchLimit = resolveBatchLimit(request);
  const delayMs = resolveDelayMs(request);
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

    const [targetRows, descriptionRows, vinRows, priceRows] = await Promise.all([
      fetchRows(client, "target", batchLimit),
      fetchRows(client, "description", batchLimit),
      fetchRows(client, "vin", batchLimit),
      fetchRows(client, "price", batchLimit),
    ]);
    if (targetRows.error || !targetRows.data) {
      throw new Error(targetRows.error?.message ?? "No target-field rows returned");
    }
    if (descriptionRows.error || !descriptionRows.data) {
      throw new Error(descriptionRows.error?.message ?? "No description rows returned");
    }
    if (vinRows.error || !vinRows.data) {
      throw new Error(vinRows.error?.message ?? "No VIN rows returned");
    }
    if (priceRows.error || !priceRows.data) {
      throw new Error(priceRows.error?.message ?? "No price rows returned");
    }

    const rows = mergeRowsForEnrichment(
      targetRows.data as EnrichmentRow[],
      descriptionRows.data as EnrichmentRow[],
      vinRows.data as EnrichmentRow[],
      priceRows.data as EnrichmentRow[],
      batchLimit,
    );
    const discovered = rows.length;
    const targetFieldCandidates = (targetRows.data as EnrichmentRow[]).length;
    const priceCandidates = (priceRows.data as EnrichmentRow[]).length;
    const vinCandidates = (vinRows.data as EnrichmentRow[]).length;
    let targetFieldUpdates = 0;
    let targetFieldProcessed = 0;
    let priceProcessed = 0;
    const targetRowIds = new Set((targetRows.data as EnrichmentRow[]).map((row) => row.id));
    const priceRowIds = new Set((priceRows.data as EnrichmentRow[]).map((row) => row.id));
    let enriched = 0;
    const errors: string[] = [];
    const TIME_BUDGET_MS = 270_000;
    let timeBudgetReached = false;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (Date.now() - startTime > TIME_BUDGET_MS) {
        timeBudgetReached = true;
        break;
      }

      if (i > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
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
        const existingMeta = row.enrichment_meta ?? {};

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
        const vinAudit = resolveElferspotVin(detail.vin);
        if (vinAudit.vin) update.vin = vinAudit.vin;
        update.enrichment_meta = buildElferspotMeta(existingMeta, {
          vinStatus: vinAudit.vinStatus,
          ...(vinAudit.vehicleIdentifier ? { vehicleIdentifier: vinAudit.vehicleIdentifier } : {}),
        });
        if (detail.descriptionText) update.description_text = detail.descriptionText;
        if (detail.images && detail.images.length > 0) {
          update.images = detail.images;
          update.photos_count = detail.images.length;
        }
        // seller_name and seller_type columns don't exist in listings table
        if (detail.location) update.location = detail.location;
        if (detail.locationCountry) update.country = detail.locationCountry;
        if (detail.priceStatus !== "unknown" || detail.descriptionStatus === "present") {
          update.enrichment_meta = buildElferspotMeta(
            (update.enrichment_meta as EnrichmentMeta | null) ?? existingMeta,
            {
              priceStatus: detail.priceStatus,
              descriptionStatus: detail.descriptionStatus,
            },
          );
        }

        const targetMissing = missingTargetFields(update);
        update.enrichment_meta = buildElferspotMeta(
          (update.enrichment_meta as EnrichmentMeta | null) ?? existingMeta,
          {
            targetFieldStatus: "covered_or_unavailable",
            missingTargetFields: targetMissing,
          },
        );

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
            if (detail.colorExterior || detail.engine || detail.transmission) targetFieldUpdates++;
            if (targetRowIds.has(row.id)) targetFieldProcessed++;
            if (priceRowIds.has(row.id)) priceProcessed++;
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
          await client
            .from("listings")
            .update({
              enrichment_meta: buildElferspotMeta(row.enrichment_meta, {
                priceStatus: "blocked_unverified",
                descriptionStatus: row.enrichment_meta?.elferspot?.descriptionStatus ?? "missing",
                targetFieldStatus: "blocked_unverified",
              }),
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          errors.push(`Circuit-break: ${msg}`);
          break;
        }

        await client
          .from("listings")
          .update({
            enrichment_meta: buildElferspotMeta(row.enrichment_meta, {
              priceStatus: "detail_unavailable",
              descriptionStatus: row.enrichment_meta?.elferspot?.descriptionStatus ?? "missing",
              targetFieldStatus: "detail_unavailable",
            }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        errors.push(`Failed ${row.source_url}: ${msg}`);
      }
    }

    const success = errors.length === 0 || timeBudgetReached;

    await recordScraperRun({
      scraper_name: "enrich-elferspot",
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

    await clearScraperRunActive("enrich-elferspot");

    return NextResponse.json({
      success,
      runId,
      discovered,
      enriched,
      targetFieldCandidates,
      targetFieldUpdates,
      targetFieldProcessed,
      priceCandidates,
      priceProcessed,
      vinCandidates,
      remainingTargetFieldBacklog: Math.max(0, targetFieldCandidates - targetFieldProcessed),
      errors,
      timeBudgetReached,
      successReason: timeBudgetReached
        ? "time_budget_reached"
        : errors.length === 0
          ? "all_rows_enriched"
          : "errors_present",
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
