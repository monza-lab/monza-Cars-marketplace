import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { classifyVehicleIdentifier } from "../src/features/scrapers/common/vehicleIdentifier";

type ListingRow = {
  id: string;
  source: string | null;
  source_url: string | null;
  make: string | null;
  status: string | null;
  vin: string | null;
};

type SourceSummary = {
  source: string;
  totalActiveRows: number;
  vinNonNullRows: number;
  vin17Rows: number;
  shortChassisOrSerialRows: number;
  invalidIdentifierRows: number;
  samples: {
    vin17: string[];
    chassisOrSerial: string[];
    invalid: string[];
  };
};

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

function getArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const raw = process.argv.slice(2).find((entry) => entry.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : fallback;
}

function redactIdentifier(input: string): string {
  const normalized = input.toUpperCase().replace(/[\s._-]+/g, "");
  if (normalized.length <= 8) return `${normalized.slice(0, 2)}...${normalized.slice(-2)}`;
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

function looksLikeShortIdentifier(input: string): boolean {
  const normalized = input.toUpperCase().replace(/[\s._-]+/g, "");
  return /^[A-Z0-9]{5,20}$/.test(normalized) && normalized.length !== 17;
}

function addSample(samples: string[], value: string): void {
  if (samples.length >= 5) return;
  const redacted = redactIdentifier(value);
  if (!samples.includes(redacted)) samples.push(redacted);
}

async function fetchRows(make: string, status: string): Promise<ListingRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows: ListingRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from("listings")
      .select("id,source,source_url,make,status,vin")
      .eq("make", make)
      .eq("status", status)
      .range(from, to);

    if (error) throw new Error(`listings query failed: ${error.message}`);
    const page = (data ?? []) as ListingRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function summarize(rows: ListingRow[]): SourceSummary[] {
  const bySource = new Map<string, SourceSummary>();
  for (const row of rows) {
    const source = row.source || "Unknown";
    const summary = bySource.get(source) ?? {
      source,
      totalActiveRows: 0,
      vinNonNullRows: 0,
      vin17Rows: 0,
      shortChassisOrSerialRows: 0,
      invalidIdentifierRows: 0,
      samples: { vin17: [], chassisOrSerial: [], invalid: [] },
    };
    summary.totalActiveRows++;

    const raw = row.vin?.trim();
    if (raw) {
      summary.vinNonNullRows++;
      const classified = classifyVehicleIdentifier(raw);
      if (classified?.kind === "vin_17") {
        summary.vin17Rows++;
        addSample(summary.samples.vin17, raw);
      } else if (looksLikeShortIdentifier(raw)) {
        summary.shortChassisOrSerialRows++;
        addSample(summary.samples.chassisOrSerial, raw);
      } else {
        summary.invalidIdentifierRows++;
        addSample(summary.samples.invalid, raw);
      }
    }

    bySource.set(source, summary);
  }

  return Array.from(bySource.values()).sort((a, b) => b.totalActiveRows - a.totalActiveRows);
}

async function main(): Promise<void> {
  loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFromFile(path.resolve(process.cwd(), ".env"));

  const make = getArg("make", "Porsche");
  const status = getArg("status", "active");
  const rows = await fetchRows(make, status);
  const sources = summarize(rows);

  const artifactDir = path.resolve(process.cwd(), "agents/testscripts/artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactPath = path.join(artifactDir, `vin-retrieval-audit-${stamp}.json`);
  const payload = {
    generated_at: new Date().toISOString(),
    make,
    status,
    total_rows: rows.length,
    sources,
  };
  writeFileSync(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`VIN retrieval audit: make=${make} status=${status}`);
  console.log(`Artifact: ${artifactPath}`);
  console.log("SOURCE | ACTIVE | VIN NON-NULL | VIN-17 | SHORT ID | INVALID");
  for (const source of sources) {
    console.log([
      source.source,
      source.totalActiveRows,
      source.vinNonNullRows,
      source.vin17Rows,
      source.shortChassisOrSerialRows,
      source.invalidIdentifierRows,
    ].join(" | "));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
