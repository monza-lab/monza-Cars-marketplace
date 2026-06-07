import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import {
  AS24_TARGET_FIELDS,
  isUsableTargetFieldValue,
} from "../src/features/scrapers/common/enrichmentLoopPolicy";

type FieldName = (typeof AS24_TARGET_FIELDS)[number];

type ListingRow = {
  id: string;
  source_url: string | null;
  trim: string | null;
  color_exterior: string | null;
  engine: string | null;
  transmission: string | null;
  enrichment_meta: Record<string, unknown> | null;
  scrape_timestamp: string | null;
  updated_at: string | null;
};

const EXCEPTION_STATUSES = new Set([
  "covered_or_unavailable",
  "detail_unavailable",
  "blocked_unverified",
  "dead_url",
]);

function loadEnvFromFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function getTargetFieldStatus(row: ListingRow): string | null {
  const autoscout24 = row.enrichment_meta?.autoscout24;
  if (!autoscout24 || typeof autoscout24 !== "object" || Array.isArray(autoscout24)) return null;
  const status = (autoscout24 as Record<string, unknown>).targetFieldStatus;
  return typeof status === "string" ? status : null;
}

function isExcepted(row: ListingRow): boolean {
  const status = getTargetFieldStatus(row);
  return status !== null && EXCEPTION_STATUSES.has(status);
}

function missingFields(row: ListingRow): FieldName[] {
  return AS24_TARGET_FIELDS.filter((field) => !isUsableTargetFieldValue(row[field]));
}

function pct(covered: number, total: number): number {
  return total === 0 ? 100 : Math.round((covered / total) * 1000) / 10;
}

async function fetchAllRows(): Promise<ListingRow[]> {
  loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFromFile(path.resolve(process.cwd(), ".env"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows: ListingRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("listings")
      .select("id,source_url,trim,color_exterior,engine,transmission,enrichment_meta,scrape_timestamp,updated_at")
      .eq("source", "AutoScout24")
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as ListingRow[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const recentSinceMs = Date.now() - 72 * 60 * 60 * 1000;
  const rows = await fetchAllRows();
  const totalActive = rows.length;
  const recentRows = rows.filter((row) => {
    const timestamp = row.scrape_timestamp ?? row.updated_at;
    return timestamp ? new Date(timestamp).getTime() >= recentSinceMs : false;
  });

  const fieldCoverage = Object.fromEntries(
    AS24_TARGET_FIELDS.map((field) => {
      const usable = rows.filter((row) => isUsableTargetFieldValue(row[field])).length;
      const excepted = rows.filter((row) => !isUsableTargetFieldValue(row[field]) && isExcepted(row)).length;
      return [field, { usable, excepted, missing: totalActive - usable - excepted, pct: pct(usable + excepted, totalActive) }];
    }),
  ) as Record<FieldName, { usable: number; excepted: number; missing: number; pct: number }>;

  const recentCoverage = Object.fromEntries(
    AS24_TARGET_FIELDS.map((field) => {
      const usable = recentRows.filter((row) => isUsableTargetFieldValue(row[field])).length;
      const excepted = recentRows.filter((row) => !isUsableTargetFieldValue(row[field]) && isExcepted(row)).length;
      return [field, { usable, excepted, missing: recentRows.length - usable - excepted, pct: pct(usable + excepted, recentRows.length) }];
    }),
  ) as typeof fieldCoverage;

  const rowsMissingTargets = rows.filter((row) => missingFields(row).length > 0 && !isExcepted(row));
  const trimSetButMissingTargets = rowsMissingTargets.filter((row) => row.trim !== null).length;
  const placeholderRows = rows.filter((row) =>
    AS24_TARGET_FIELDS.some((field) => typeof row[field] === "string" && row[field]!.trim() !== "" && !isUsableTargetFieldValue(row[field])),
  );
  const trimSentinelSamples = rowsMissingTargets
    .filter((row) => row.trim === "")
    .slice(0, 20)
    .map((row) => ({
      id: row.id,
      source_url: row.source_url,
      missingTargetFields: missingFields(row),
      color_exterior: row.color_exterior,
      engine: row.engine,
      transmission: row.transmission,
      targetFieldStatus: getTargetFieldStatus(row),
    }));

  const payload = {
    generatedAt,
    totalActive,
    fieldCoverage,
    recent72HourCoverage: {
      totalActive: recentRows.length,
      fields: recentCoverage,
    },
    trimSetButTargetFieldsMissing: trimSetButMissingTargets,
    placeholderTargetValueRows: placeholderRows.length,
    trimSentinelMissingTargetSamples: trimSentinelSamples,
    remainingTargetFieldBacklog: rowsMissingTargets.length,
  };

  console.table(
    AS24_TARGET_FIELDS.map((field) => ({
      field,
      coverage: `${fieldCoverage[field].pct.toFixed(1)}%`,
      usable: fieldCoverage[field].usable,
      excepted: fieldCoverage[field].excepted,
      missing: fieldCoverage[field].missing,
      recent72h: `${recentCoverage[field].pct.toFixed(1)}%`,
    })),
  );
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
