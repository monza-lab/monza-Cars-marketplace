import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type FieldName = "color_exterior" | "engine" | "transmission";

const FIELDS: FieldName[] = ["color_exterior", "engine", "transmission"];
const EXCEPTION_STATUSES = ["covered_or_unavailable", "detail_unavailable", "blocked_unverified"];

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

function baseQuery() {
  return supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("source", "Elferspot")
    .eq("status", "active");
}

async function countRows(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countField(field: FieldName) {
  const total = await countRows(baseQuery());
  const filled = await countRows(baseQuery().not(field, "is", null).neq(field, ""));
  const excepted = await countRows(
    baseQuery()
      .or(`${field}.is.null,${field}.eq.`)
      .in("enrichment_meta->elferspot->>targetFieldStatus", EXCEPTION_STATUSES),
  );
  const coveredOrExcepted = filled + excepted;
  return {
    filled,
    excepted,
    coveredOrExcepted,
    missing: Math.max(0, total - coveredOrExcepted),
    pct: total === 0 ? 100 : Math.round((coveredOrExcepted / total) * 1000) / 10,
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const recentSince = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const totalActive = await countRows(baseQuery());
  const recentActive = await countRows(baseQuery().gte("scrape_timestamp", recentSince));
  const fields: Record<FieldName, Awaited<ReturnType<typeof countField>>> = {
    color_exterior: await countField("color_exterior"),
    engine: await countField("engine"),
    transmission: await countField("transmission"),
  };
  const missingCondition = "color_exterior.is.null,color_exterior.eq.,engine.is.null,engine.eq.,transmission.is.null,transmission.eq.";
  const activeMissingAny = await countRows(baseQuery().or(missingCondition));
  const recentMissingAny = await countRows(baseQuery().gte("scrape_timestamp", recentSince).or(missingCondition));
  const { data: samples, error: samplesError } = await supabase
    .from("listings")
    .select("id,source_url,color_exterior,engine,transmission,enrichment_meta,scrape_timestamp,updated_at")
    .eq("source", "Elferspot")
    .eq("status", "active")
    .or(missingCondition)
    .order("updated_at", { ascending: true })
    .limit(20);

  if (samplesError) throw new Error(samplesError.message);

  const payload = {
    generatedAt,
    recentSince,
    totalActive,
    recentActive,
    fields,
    activeMissingAny,
    recentMissingAny,
    samples: samples ?? [],
  };

  const artifactDir = path.resolve(process.cwd(), "agents", "testscripts", "artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, `elferspot-field-coverage-${generatedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ ...payload, artifactPath }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
