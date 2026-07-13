import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Client } from "pg";

import {
  evaluateListing,
  type AssuranceListingRow,
  type UnresolvedReason,
} from "./completeness";
import {
  ASSURANCE_SOURCES,
  getAssuranceSource,
  type AssuranceField,
  type AssuranceSourceId,
} from "./manifest";

export interface CommandResult {
  id: string;
  ok: boolean;
  durationMs: number;
  summary: string;
}

export interface CanaryResult extends CommandResult {
  source: AssuranceSourceId;
}

export interface RepairQueueItem {
  listingId: string;
  source: AssuranceSourceId;
  sourceUrl: string | null;
  field: AssuranceField;
  reason: UnresolvedReason;
  repairJobIds: string[];
}

export interface SourceAssuranceSummary {
  source: AssuranceSourceId;
  activeListings: number;
  requiredFields: number;
  populatedFields: number;
  resolvedFields: number;
  unresolvedFields: number;
  unavailableFields: number;
  rawCompletenessPct: number;
  contractResolutionPct: number;
}

export interface SourceWeeklyComparison {
  source: AssuranceSourceId;
  rawCompletenessDeltaPct: number;
  contractResolutionDeltaPct: number;
  unavailableFieldsDelta: number;
  unresolvedFieldsDelta: number;
  rawCompletenessRegression: boolean;
}

export interface WeeklyComparison {
  previousGeneratedAt: string;
  sources: SourceWeeklyComparison[];
}

export interface ScraperAssuranceReport {
  generatedAt: string;
  outcome: "healthy" | "repaired" | "blocked";
  inventory: {
    declaredSources: string[];
    observedDatabaseSources: string[];
    unknownDatabaseSources: string[];
  };
  totals: {
    activeListings: number;
    requiredFields: number;
    populatedFields: number;
    resolvedFields: number;
    unresolvedFields: number;
    rawCompletenessPct: number;
    contractResolutionPct: number;
  };
  sources: SourceAssuranceSummary[];
  repairQueue: RepairQueueItem[];
  canaries: CanaryResult[];
  tests: CommandResult[];
  comparison?: WeeklyComparison;
}

type DbListingRow = AssuranceListingRow & {
  photos_count?: number | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

const ACTIVE_LISTINGS_SQL = `
  SELECT id, source, source_id, source_url, title, make, model, year, status,
         listing_price, current_bid, hammer_price, final_price, sold_price,
         original_currency, images, photos_count, location, city, region, country,
         vin, trim, engine, transmission, mileage, mileage_unit,
         color_exterior, color_interior, body_style, description_text,
         enrichment_meta, created_at, updated_at
  FROM public.listings
  WHERE status::text = 'active'
  ORDER BY source, id
`;

function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function roundDelta(value: number): number {
  return Math.round(value * 10) / 10;
}

function emptySourceSummary(source: AssuranceSourceId): SourceAssuranceSummary {
  return {
    source,
    activeListings: 0,
    requiredFields: 0,
    populatedFields: 0,
    resolvedFields: 0,
    unresolvedFields: 0,
    unavailableFields: 0,
    rawCompletenessPct: 100,
    contractResolutionPct: 100,
  };
}

export function buildAssuranceReport(
  rows: AssuranceListingRow[],
  canaries: CanaryResult[] = [],
  now = new Date(),
  tests: CommandResult[] = [],
  repaired = false,
): ScraperAssuranceReport {
  const declaredSources = ASSURANCE_SOURCES.map((source) => source.id).sort();
  const observedDatabaseSources = Array.from(new Set(
    rows.map((row) => row.source?.trim()).filter((source): source is string => Boolean(source)),
  )).sort();
  const unknownDatabaseSources = observedDatabaseSources.filter((source) => !getAssuranceSource(source));
  const sourcesById = new Map(
    ASSURANCE_SOURCES.map((source) => [source.id, emptySourceSummary(source.id)]),
  );
  const repairQueue: RepairQueueItem[] = [];

  for (const row of rows) {
    const source = row.source ? getAssuranceSource(row.source) : undefined;
    if (!source) continue;
    const evaluation = evaluateListing(row, source, now);
    const summary = sourcesById.get(source.id)!;
    summary.activeListings += 1;
    summary.requiredFields += evaluation.requiredFields;
    summary.populatedFields += evaluation.populatedFields;
    summary.resolvedFields += evaluation.resolvedFields;
    summary.unresolvedFields += evaluation.unresolved.length;
    summary.unavailableFields += evaluation.fields.filter(
      (field) => field.resolved && !field.populated && field.state === "unavailable_at_source",
    ).length;
    repairQueue.push(...evaluation.unresolved.map((field) => ({
      listingId: row.id,
      source: source.id,
      sourceUrl: row.source_url,
      field: field.field,
      reason: field.reason,
      repairJobIds: [...source.repairJobIds],
    })));
  }

  const sources = Array.from(sourcesById.values())
    .map((source) => ({
      ...source,
      rawCompletenessPct: percentage(source.populatedFields, source.requiredFields),
      contractResolutionPct: percentage(source.resolvedFields, source.requiredFields),
    }))
    .sort((a, b) => a.source.localeCompare(b.source));
  repairQueue.sort((a, b) => (
    a.source.localeCompare(b.source)
    || a.listingId.localeCompare(b.listingId)
    || a.field.localeCompare(b.field)
  ));

  const totals = sources.reduce((aggregate, source) => ({
    activeListings: aggregate.activeListings + source.activeListings,
    requiredFields: aggregate.requiredFields + source.requiredFields,
    populatedFields: aggregate.populatedFields + source.populatedFields,
    resolvedFields: aggregate.resolvedFields + source.resolvedFields,
    unresolvedFields: aggregate.unresolvedFields + source.unresolvedFields,
  }), {
    activeListings: 0,
    requiredFields: 0,
    populatedFields: 0,
    resolvedFields: 0,
    unresolvedFields: 0,
  });
  const blocked = unknownDatabaseSources.length > 0
    || totals.unresolvedFields > 0
    || canaries.some((canary) => !canary.ok)
    || tests.some((test) => !test.ok);

  return {
    generatedAt: now.toISOString(),
    outcome: blocked ? "blocked" : repaired ? "repaired" : "healthy",
    inventory: { declaredSources, observedDatabaseSources, unknownDatabaseSources },
    totals: {
      ...totals,
      activeListings: rows.length,
      rawCompletenessPct: percentage(totals.populatedFields, totals.requiredFields),
      contractResolutionPct: percentage(totals.resolvedFields, totals.requiredFields),
    },
    sources,
    repairQueue,
    canaries: [...canaries],
    tests: [...tests],
  };
}

export function compareAssuranceReports(
  current: ScraperAssuranceReport,
  previous: ScraperAssuranceReport,
): WeeklyComparison {
  const previousBySource = new Map(previous.sources.map((source) => [source.source, source]));
  return {
    previousGeneratedAt: previous.generatedAt,
    sources: current.sources.map((source) => {
      const prior = previousBySource.get(source.source) ?? emptySourceSummary(source.source);
      const rawCompletenessDeltaPct = roundDelta(source.rawCompletenessPct - prior.rawCompletenessPct);
      const unavailableFieldsDelta = source.unavailableFields - prior.unavailableFields;
      return {
        source: source.source,
        rawCompletenessDeltaPct,
        contractResolutionDeltaPct: roundDelta(
          source.contractResolutionPct - prior.contractResolutionPct,
        ),
        unavailableFieldsDelta,
        unresolvedFieldsDelta: source.unresolvedFields - prior.unresolvedFields,
        rawCompletenessRegression: rawCompletenessDeltaPct < -0.1 && unavailableFieldsDelta === 0,
      };
    }),
  };
}

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

export async function fetchActiveListings(): Promise<AssuranceListingRow[]> {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env"));
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const client = new Client({
    connectionString,
    ssl: /sslmode=disable/i.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await client.query(ACTIVE_LISTINGS_SQL) as { rows: DbListingRow[] };
    await client.query("COMMIT");
    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

export function readPreviousAssuranceReport(
  artifactDir = path.resolve(process.cwd(), "agents/testscripts/artifacts"),
): ScraperAssuranceReport | undefined {
  if (!existsSync(artifactDir)) return undefined;
  const latest = readdirSync(artifactDir)
    .filter((name) => /^scraper-assurance-.*\.json$/.test(name))
    .sort()
    .at(-1);
  if (!latest) return undefined;
  return JSON.parse(readFileSync(path.join(artifactDir, latest), "utf8")) as ScraperAssuranceReport;
}

export function persistAssuranceReport(
  report: ScraperAssuranceReport,
  artifactDir = path.resolve(process.cwd(), "agents/testscripts/artifacts"),
): string {
  mkdirSync(artifactDir, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const artifactPath = path.join(artifactDir, `scraper-assurance-${stamp}.json`);
  writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return artifactPath;
}
