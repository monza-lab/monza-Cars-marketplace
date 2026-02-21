import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

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

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function arg(name: string): string | undefined {
  const raw = process.argv.slice(2).find((entry) => entry.startsWith(`--${name}=`));
  return raw ? raw.slice(name.length + 3) : undefined;
}

async function audit(): Promise<void> {
  const supabase = client();
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactDir = path.resolve(process.cwd(), "agents/testscripts/artifacts");
  mkdirSync(artifactDir, { recursive: true });

  const listingCounts = await supabase.from("listings").select("source,status", { count: "exact", head: false }).eq("make", "Porsche");
  const tables = ["pricing", "vehicle_specs", "auction_info", "location_data", "photos_media", "provenance_data", "price_history"];
  const tableCounts: Record<string, number | null> = {};
  for (const table of tables) {
    const result = await supabase.from(table).select("listing_id", { count: "exact", head: true });
    tableCounts[table] = result.count ?? null;
  }

  const payload = {
    generated_at: new Date().toISOString(),
    project_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    listings_count: listingCounts.count ?? null,
    source_status_sample: (listingCounts.data ?? []).slice(0, 20),
    child_table_counts: tableCounts,
  };
  const jsonPath = path.join(artifactDir, `db-audit-${now}.json`);
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(jsonPath);
}

async function quality(): Promise<void> {
  const supabase = client();
  const artifactDir = path.resolve(process.cwd(), "agents/testscripts/artifacts");
  mkdirSync(artifactDir, { recursive: true });

  const rows = await supabase
    .from("listings")
    .select("id,source,make,model,year,vin,hammer_price,final_price")
    .eq("make", "Porsche")
    .limit(Number(arg("limit") ?? 1000));
  if (rows.error) throw new Error(rows.error.message);

  const dataset = rows.data ?? [];
  const report = {
    generated_at: new Date().toISOString(),
    rows: dataset.length,
    missing_vin: dataset.filter((row) => !row.vin).length,
    missing_price: dataset.filter((row) => row.hammer_price == null && row.final_price == null).length,
    invalid_year: dataset.filter((row) => !row.year || row.year < 1948 || row.year > new Date().getUTCFullYear() + 1).length,
    non_porsche: dataset.filter((row) => row.make !== "Porsche").length,
  };
  const outputPath = path.join(artifactDir, "db-quality-porsche.json");
  writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(outputPath);
}

async function security(): Promise<void> {
  const supabase = client();
  const artifactDir = path.resolve(process.cwd(), "agents/testscripts/artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const targetTables = ["listings", "pricing", "vehicle_specs", "auction_info", "location_data", "photos_media", "provenance_data", "price_history"];
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const anonClient = (process.env.NEXT_PUBLIC_SUPABASE_URL && anonKey)
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  const tableChecks: Array<Record<string, unknown>> = [];
  for (const table of targetTables) {
    const serviceRead = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);
    const anonRead = anonClient
      ? await anonClient.from(table).select("*", { head: true, count: "exact" }).limit(1)
      : null;
    tableChecks.push({
      table,
      service_role_read_ok: !serviceRead.error,
      service_role_error: serviceRead.error?.message ?? null,
      anon_read_ok: anonRead ? !anonRead.error : null,
      anon_error: anonRead?.error?.message ?? null,
      inferred_exposure: anonRead ? (!anonRead.error ? "public-readable-or-rls-disabled" : "restricted") : "unknown-no-anon-key",
    });
  }

  const payload = {
    generated_at: new Date().toISOString(),
    note: "Uses service-role vs anon read probes per public table; infers exposure without custom RPC.",
    has_service_role: Boolean(serviceKey),
    has_anon_key: Boolean(anonKey),
    table_checks: tableChecks,
  };
  const outputPath = path.join(artifactDir, "db-security-advisors.json");
  writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(outputPath);
}

async function main(): Promise<void> {
  const command = arg("cmd") ?? "audit";
  if (command === "audit") return await audit();
  if (command === "quality") return await quality();
  if (command === "security") return await security();
  throw new Error(`Unknown --cmd=${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
