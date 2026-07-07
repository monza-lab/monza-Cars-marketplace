import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseDetailHtml } from "@/features/scrapers/autoscout24_collector/detail";
import {
  AS24_TARGET_FIELDS,
  buildUnusableAs24TargetFieldFilter,
  isUsableTargetFieldValue,
} from "@/features/scrapers/common/enrichmentLoopPolicy";
import {
  clearScraperRunActive,
  clearStaleActiveRun,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type CronSupabaseClient = SupabaseClient<any, any, any, any, any>;

type TargetFieldStatus =
  | "complete"
  | "covered_or_unavailable"
  | "detail_unavailable"
  | "blocked_unverified"
  | "dead_url";

type EnrichmentMeta = Record<string, unknown> & {
  autoscout24?: Record<string, unknown>;
};

type EnrichmentRow = {
  id: string;
  source_url: string;
  title: string | null;
  trim: string | null;
  transmission: string | null;
  body_style: string | null;
  engine: string | null;
  color_exterior: string | null;
  color_interior: string | null;
  vin: string | null;
  description_text: string | null;
  images: string[] | null;
  enrichment_meta: EnrichmentMeta | null;
};

type QueryPageResult = Promise<{
  data: unknown[] | null;
  error: { message: string } | null;
}>;

const COVERED_EXCEPTION_STATUSES = new Set([
  "covered_or_unavailable",
  "detail_unavailable",
  "blocked_unverified",
  "dead_url",
]);

function truncate(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  return value.length <= max ? value : value.slice(0, max);
}

function mergeAutoscout24Meta(
  existing: EnrichmentMeta | null,
  patch: {
    detailAttemptedAt: string;
    targetFieldStatus: TargetFieldStatus;
    missingTargetFields: string[];
  },
): EnrichmentMeta {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  const existingAs24 =
    base.autoscout24 && typeof base.autoscout24 === "object" && !Array.isArray(base.autoscout24)
      ? base.autoscout24
      : {};
  return {
    ...base,
    autoscout24: {
      ...existingAs24,
      detailAttemptedAt: patch.detailAttemptedAt,
      targetFieldStatus: patch.targetFieldStatus,
      missingTargetFields: patch.missingTargetFields,
    },
  };
}

function valueAfterUpdate(row: EnrichmentRow, updates: Record<string, unknown>, field: (typeof AS24_TARGET_FIELDS)[number]): unknown {
  return Object.prototype.hasOwnProperty.call(updates, field) ? updates[field] : row[field];
}

function missingTargetFieldsAfterUpdate(row: EnrichmentRow, updates: Record<string, unknown>): string[] {
  return AS24_TARGET_FIELDS.filter((field) => !isUsableTargetFieldValue(valueAfterUpdate(row, updates, field)));
}

function hasUsableTargetUpdate(updates: Record<string, unknown>): boolean {
  return AS24_TARGET_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(updates, field) && isUsableTargetFieldValue(updates[field]));
}

function hasCoveredTargetException(row: EnrichmentRow): boolean {
  const autoscout24 = row.enrichment_meta?.autoscout24;
  if (!autoscout24 || typeof autoscout24 !== "object" || Array.isArray(autoscout24)) return false;
  const status = autoscout24.targetFieldStatus;
  return typeof status === "string" && COVERED_EXCEPTION_STATUSES.has(status);
}

export async function fetchActionableTargetRows(
  client: CronSupabaseClient,
  limit: number,
  pageSize: number = 1000,
): Promise<EnrichmentRow[]> {
  const actionableRows: EnrichmentRow[] = [];

  for (let from = 0; actionableRows.length < limit; from += pageSize) {
    const { data, error } = await client
      .from("listings")
      .select("id,source_url,title,trim,transmission,body_style,engine,color_exterior,color_interior,vin,description_text,images,enrichment_meta")
      .eq("source", "AutoScout24")
      .eq("status", "active")
      .or(buildUnusableAs24TargetFieldFilter())
      .order("updated_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Target row query failed: ${error.message}`);
    }

    const rows = (data ?? []) as EnrichmentRow[];
    actionableRows.push(...rows.filter((row) => !hasCoveredTargetException(row)));
    if (rows.length < pageSize) break;
  }

  return actionableRows.slice(0, limit);
}

async function countActionableTargetBacklog(client: CronSupabaseClient): Promise<number> {
  let count = 0;
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const query = client
      .from("listings")
      .select("id,source_url,title,trim,transmission,body_style,engine,color_exterior,color_interior,vin,description_text,images,enrichment_meta")
      .eq("source", "AutoScout24")
      .eq("status", "active")
      .or(buildUnusableAs24TargetFieldFilter())
      .order("id", { ascending: true });

    const { data, error } =
      typeof (query as { range?: unknown }).range === "function"
        ? await (query as unknown as { range: (from: number, to: number) => QueryPageResult }).range(from, from + pageSize - 1)
        : await (query as unknown as { limit: (limit: number) => QueryPageResult }).limit(pageSize);

    if (error) throw new Error(`Backlog count query failed: ${error.message}`);
    const rows = (data ?? []) as EnrichmentRow[];
    count += rows.filter((row) => !hasCoveredTargetException(row)).length;
    if (rows.length < pageSize) break;
  }
  return count;
}

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

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

  await clearStaleActiveRun("enrich-details", 10);
  await markScraperRunStarted({
    scraperName: "enrich-details",
    runId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const typedRows = await fetchActionableTargetRows(client, 100);
    const discovered = typedRows.length;
    const targetFieldCandidates = typedRows.filter((row) =>
      AS24_TARGET_FIELDS.some((field) => !isUsableTargetFieldValue(row[field])),
    ).length;
    let targetFieldUpdates = 0;
    let enriched = 0;
    let detailsFetched = 0;
    let blocked = 0;
    let deadUrls = 0;
    const errors: string[] = [];
    const delayMs = 1_000;
    const timeBudgetMs = 240_000;
    let timeBudgetReached = false;

    for (let i = 0; i < typedRows.length; i++) {
      const row = typedRows[i];
      if (Date.now() - startTime > timeBudgetMs) {
        timeBudgetReached = true;
        break;
      }
      if (i > 0) await new Promise((r) => setTimeout(r, delayMs));

      try {
        const response = await fetch(row.source_url, {
          headers: FETCH_HEADERS,
          signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 410) {
            deadUrls++;
            const now = new Date().toISOString();
            await client
              .from("listings")
              .update({
                status: "delisted",
                updated_at: now,
                enrichment_meta: mergeAutoscout24Meta(row.enrichment_meta, {
                  detailAttemptedAt: now,
                  targetFieldStatus: "dead_url",
                  missingTargetFields: missingTargetFieldsAfterUpdate(row, {}),
                }),
              })
              .eq("id", row.id);
            errors.push(`Dead URL (${row.id}): HTTP ${response.status}`);
            continue;
          }
          throw new Error(`HTTP ${response.status} for ${row.source_url}`);
        }

        const html = await response.text();
        if (html.includes("/_sec/cp_challenge") || html.includes("akam") || (html.length < 5000 && !html.includes("listingDetails"))) {
          blocked++;
          const now = new Date().toISOString();
          await client
            .from("listings")
            .update({
              updated_at: now,
              enrichment_meta: mergeAutoscout24Meta(row.enrichment_meta, {
                detailAttemptedAt: now,
                targetFieldStatus: "blocked_unverified",
                missingTargetFields: missingTargetFieldsAfterUpdate(row, {}),
              }),
            })
            .eq("id", row.id);
          errors.push(`Akamai challenge (${row.id}): page blocked`);
          continue;
        }

        let detail;
        try {
          detail = parseDetailHtml(html);
          detailsFetched++;
        } catch (parseErr) {
          errors.push(`Parse error (${row.id}): ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
          const now = new Date().toISOString();
          await client
            .from("listings")
            .update({
              updated_at: now,
              enrichment_meta: mergeAutoscout24Meta(row.enrichment_meta, {
                detailAttemptedAt: now,
                targetFieldStatus: "detail_unavailable",
                missingTargetFields: missingTargetFieldsAfterUpdate(row, {}),
              }),
            })
            .eq("id", row.id);
          continue;
        }

        const update: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
        };
        if (detail.trim) update.trim = truncate(detail.trim, 100);
        if (detail.transmission && isUsableTargetFieldValue(detail.transmission)) update.transmission = truncate(detail.transmission, 100);
        if (detail.bodyStyle) update.body_style = truncate(detail.bodyStyle, 100);
        if (detail.engine && isUsableTargetFieldValue(detail.engine)) update.engine = truncate(detail.engine, 100);
        if (detail.exteriorColor && isUsableTargetFieldValue(detail.exteriorColor)) update.color_exterior = truncate(detail.exteriorColor, 100);
        if (detail.interiorColor) update.color_interior = truncate(detail.interiorColor, 100);
        if (detail.vin) update.vin = truncate(detail.vin, 17);
        if (detail.description) update.description_text = truncate(detail.description, 2000);
        if (detail.images && detail.images.length > 0) {
          update.images = detail.images;
          update.photos_count = detail.images.length;
        }

        const missingTargetFields = missingTargetFieldsAfterUpdate(row, update);
        const newFieldCount = Object.keys(update).length - 2;
        const targetFieldStatus: TargetFieldStatus =
          missingTargetFields.length === 0
            ? "complete"
            : newFieldCount > 0
              ? "covered_or_unavailable"
              : "detail_unavailable";
        update.enrichment_meta = mergeAutoscout24Meta(row.enrichment_meta, {
          detailAttemptedAt: update.updated_at as string,
          targetFieldStatus,
          missingTargetFields,
        });

        const { error: updateErr } = await client
          .from("listings")
          .update(update)
          .eq("id", row.id);

        if (updateErr) {
          errors.push(`Update failed (${row.id}): ${updateErr.message}`);
        } else {
          enriched++;
          if (hasUsableTargetUpdate(update)) targetFieldUpdates++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/\b(403|429)\b/.test(msg) || /cloudflare/i.test(msg)) {
          errors.push(`Circuit-break: ${msg}`);
          break;
        }
        errors.push(`Failed ${row.source_url}: ${msg}`);
      }
    }

    const success = (errors.length === 0 || enriched > 0) || timeBudgetReached;
    const remainingTargetFieldBacklog = await countActionableTargetBacklog(client);

    await recordScraperRun({
      scraper_name: "enrich-details",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered,
      written: enriched,
      errors_count: errors.length,
      details_fetched: detailsFetched,
      error_messages: errors.length > 0 ? errors : undefined,
    });

    await clearScraperRunActive("enrich-details");

    return NextResponse.json({
      success,
      runId,
      discovered,
      enriched,
      targetFieldCandidates,
      targetFieldUpdates,
      detailsFetched,
      remainingTargetFieldBacklog,
      blocked,
      deadUrls,
      errors,
      timeBudgetReached,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/enrich-details] Error:", error);

    await recordScraperRun({
      scraper_name: "enrich-details",
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

    await clearScraperRunActive("enrich-details");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Enrichment failed",
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 },
    );
  }
}
