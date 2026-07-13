import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

import { ASSURANCE_SOURCES } from "../src/features/scrapers/common/assurance/manifest";
import { sourceToCanonicalMarket } from "../src/lib/pricing/canonicalMarket";
import type { CanonicalMarket } from "../src/lib/pricing/types";

export type CoverageSeverity = "critical" | "degraded";

export type CoverageRow = {
  source: string;
  market: CanonicalMarket | "UNKNOWN";
  active: number;
  total: number;
  pricedPct: number | null;
  imagePct: number | null;
  vinPct?: number | null;
  enginePct?: number | null;
  transmissionPct?: number | null;
  new24h?: number;
  updated24h?: number;
  lastCreatedAt?: string | null;
  lastUpdatedAt?: string | null;
};

export type CoverageAlert = {
  market?: CanonicalMarket | "UNKNOWN";
  source?: string;
  severity: CoverageSeverity;
  message: string;
};

export type CoverageSummary = {
  generatedAt: string;
  rows: CoverageRow[];
  markets: Array<{
    market: CanonicalMarket | "UNKNOWN";
    active: number;
    total: number;
    pricedPct: number | null;
    imagePct: number | null;
  }>;
  marketAlerts: CoverageAlert[];
  sourceAlerts: CoverageAlert[];
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

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function weightedPct(rows: CoverageRow[], key: "pricedPct" | "imagePct"): number | null {
  const denominator = rows.reduce((sum, row) => sum + row.active, 0);
  if (denominator <= 0) return null;
  const numerator = rows.reduce((sum, row) => {
    const value = row[key];
    if (value == null) return sum;
    return sum + (row.active * value) / 100;
  }, 0);
  return pct(numerator, denominator);
}

function buildMarketRows(rows: CoverageRow[]): CoverageSummary["markets"] {
  const byMarket = new Map<CanonicalMarket | "UNKNOWN", CoverageRow[]>();
  for (const row of rows) {
    byMarket.set(row.market, [...(byMarket.get(row.market) ?? []), row]);
  }
  return Array.from(byMarket.entries())
    .map(([market, marketRows]) => ({
      market,
      active: marketRows.reduce((sum, row) => sum + row.active, 0),
      total: marketRows.reduce((sum, row) => sum + row.total, 0),
      pricedPct: weightedPct(marketRows, "pricedPct"),
      imagePct: weightedPct(marketRows, "imagePct"),
    }))
    .sort((a, b) => b.active - a.active || a.market.localeCompare(b.market));
}

function buildMarketAlerts(markets: CoverageSummary["markets"]): CoverageAlert[] {
  return markets.flatMap((market) => {
    if (market.total > 0 && market.active === 0) {
      return [{
        market: market.market,
        severity: "critical" as const,
        message: `${market.market} has historical rows but zero active coverage`,
      }];
    }
    return [];
  });
}

function buildSourceAlerts(rows: CoverageRow[]): CoverageAlert[] {
  const alerts: CoverageAlert[] = [];
  const declaredSources = new Set<string>(ASSURANCE_SOURCES.map((source) => source.id));
  for (const row of rows) {
    if (!declaredSources.has(row.source)) {
      alerts.push({
        source: row.source,
        severity: "critical",
        message: `${row.source} is present in listings but absent from the assurance manifest`,
      });
    }
    if (row.total > 0 && row.active === 0) {
      alerts.push({
        source: row.source,
        severity: "critical",
        message: `${row.source} has historical rows but zero active listings`,
      });
    }
    if (row.source === "ClassicCom" && row.active > 0 && (row.pricedPct ?? 100) < 50) {
      alerts.push({
        source: row.source,
        severity: "degraded",
        message: `ClassicCom price coverage is below 50% (${row.pricedPct ?? 0}%)`,
      });
    }
  }
  return alerts;
}

export function summarizeCoverageRows(rows: CoverageRow[]): CoverageSummary {
  const observedSources = new Set(rows.map((row) => row.source));
  const zeroRows: CoverageRow[] = ASSURANCE_SOURCES
    .filter((source) => !observedSources.has(source.id))
    .map((source) => ({
      source: source.id,
      market: sourceToCanonicalMarket(source.id) ?? "UNKNOWN",
      active: 0,
      total: 0,
      pricedPct: null,
      imagePct: null,
    }));
  const sortedRows = [...rows, ...zeroRows]
    .sort((a, b) => b.active - a.active || a.source.localeCompare(b.source));
  const markets = buildMarketRows(sortedRows);
  return {
    generatedAt: new Date().toISOString(),
    rows: sortedRows,
    markets,
    marketAlerts: buildMarketAlerts(markets),
    sourceAlerts: buildSourceAlerts(sortedRows),
  };
}

type DbCoverageRow = {
  source: string;
  active: number | string;
  total: number | string;
  priced: number | string;
  with_images: number | string;
  with_vin: number | string;
  with_engine: number | string;
  with_transmission: number | string;
  new_24h: number | string;
  updated_24h: number | string;
  last_created_at: Date | string | null;
  last_updated_at: Date | string | null;
};

function toIso(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function numberValue(value: number | string): number {
  return Number(value) || 0;
}

function mapDbRow(row: DbCoverageRow): CoverageRow {
  const active = numberValue(row.active);
  const total = numberValue(row.total);
  const source = row.source;
  return {
    source,
    market: sourceToCanonicalMarket(source) ?? "UNKNOWN",
    active,
    total,
    pricedPct: pct(numberValue(row.priced), active),
    imagePct: pct(numberValue(row.with_images), active),
    vinPct: pct(numberValue(row.with_vin), active),
    enginePct: pct(numberValue(row.with_engine), active),
    transmissionPct: pct(numberValue(row.with_transmission), active),
    new24h: numberValue(row.new_24h),
    updated24h: numberValue(row.updated_24h),
    lastCreatedAt: toIso(row.last_created_at),
    lastUpdatedAt: toIso(row.last_updated_at),
  };
}

export async function fetchCoverageRows(): Promise<CoverageRow[]> {
  loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFromFile(path.resolve(process.cwd(), ".env"));
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: /sslmode=disable/i.test(process.env.DATABASE_URL) ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        source,
        COUNT(*) FILTER (WHERE status::text = 'active') AS active,
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE status::text = 'active'
            AND COALESCE(listing_price, sold_price, hammer_price, final_price::numeric, current_bid::numeric) > 0
        ) AS priced,
        COUNT(*) FILTER (
          WHERE status::text = 'active'
            AND (COALESCE(cardinality(images), 0) > 0 OR COALESCE(photos_count, 0) > 0)
        ) AS with_images,
        COUNT(*) FILTER (WHERE status::text = 'active' AND NULLIF(vin, '') IS NOT NULL) AS with_vin,
        COUNT(*) FILTER (WHERE status::text = 'active' AND NULLIF(engine, '') IS NOT NULL) AS with_engine,
        COUNT(*) FILTER (WHERE status::text = 'active' AND NULLIF(transmission, '') IS NOT NULL) AS with_transmission,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS new_24h,
        COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '24 hours') AS updated_24h,
        MAX(created_at) AS last_created_at,
        MAX(updated_at) AS last_updated_at
      FROM listings
      WHERE source IS NOT NULL
      GROUP BY source
      ORDER BY active DESC, source ASC
    `) as { rows: DbCoverageRow[] };
    return rows.map(mapDbRow);
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const summary = summarizeCoverageRows(await fetchCoverageRows());
  const artifactDir = path.resolve(process.cwd(), "agents/testscripts/artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const stamp = summary.generatedAt.replace(/[:.]/g, "-");
  const artifactPath = path.join(artifactDir, `coverage-snapshot-${stamp}.json`);
  writeFileSync(artifactPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`Coverage snapshot written: ${artifactPath}`);
  console.log(`Markets: ${summary.markets.map((market) => `${market.market}=${market.active}`).join(", ")}`);
  const alerts = [...summary.marketAlerts, ...summary.sourceAlerts];
  console.log(`Alerts: ${alerts.length}`);
  for (const alert of alerts) {
    console.log(`${alert.severity.toUpperCase()}: ${alert.message}`);
  }
}

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
