import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { parseDetailHtml } from "../src/features/scrapers/beforward_porsche_collector/detail";
import {
  computeTotalPages,
  discoverPage,
} from "../src/features/scrapers/beforward_porsche_collector/discover";
import {
  fetchHtml,
  getDomainFromUrl,
  PerDomainRateLimiter,
  withRetry,
} from "../src/features/scrapers/beforward_porsche_collector/net";
import { fetchBFHtmlWithScrapling } from "../src/features/scrapers/beforward_porsche_collector/scrapling";
import { mapStatus } from "../src/features/scrapers/beforward_porsche_collector/normalize";
import { hasExplicitStatusEvidence } from "../src/features/scrapers/beforward_porsche_collector/supabase_writer";

const TERMINAL_STATUSES = ["delisted", "sold", "unsold"] as const;
const DEFAULT_SAMPLE_SIZE = 20;
const SOURCE = "BeForward";
const FETCH_TIMEOUT_MS = 15_000;

type TerminalStatus = (typeof TERMINAL_STATUSES)[number];
type SourceClassification = "live" | "terminal" | "ambiguous";

type ListingCountRow = {
  status: string | null;
  country: string | null;
};

type TerminalSampleRow = {
  id: string;
  source_url: string | null;
  status: TerminalStatus | string | null;
  country: string | null;
  last_verified_at: string | null;
  updated_at: string | null;
  title: string | null;
};

type ClassifiedSample = TerminalSampleRow & {
  classification: SourceClassification;
  evidence: string;
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

function parseSampleSize(argv: string[]): number {
  const raw = argv.find((arg) => arg.startsWith("--sample="))?.slice("--sample=".length);
  const parsed = raw ? parseInt(raw, 10) : DEFAULT_SAMPLE_SIZE;
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("--sample must be a non-negative integer");
  }
  return Math.min(parsed, 100);
}

function createSupabaseReadClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchAllCountRows(client: SupabaseClient): Promise<ListingCountRow[]> {
  const rows: ListingCountRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("listings")
      .select("status,country")
      .eq("source", SOURCE)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Supabase listings count read failed: ${error.message}`);
    rows.push(...((data ?? []) as ListingCountRow[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchTerminalSample(client: SupabaseClient, sampleSize: number): Promise<TerminalSampleRow[]> {
  if (sampleSize === 0) return [];

  const { data, error } = await client
    .from("listings")
    .select("id,source_url,status,country,last_verified_at,updated_at,title")
    .eq("source", SOURCE)
    .in("status", [...TERMINAL_STATUSES])
    .order("last_verified_at", { ascending: false })
    .limit(sampleSize);

  if (error) throw new Error(`Supabase terminal sample read failed: ${error.message}`);
  return (data ?? []) as TerminalSampleRow[];
}

function countBy(rows: ListingCountRow[], key: keyof ListingCountRow): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const value = row[key]?.trim() || "Unknown";
    out[value] = (out[value] ?? 0) + 1;
  }
  return sortRecord(out);
}

function countByStatusAndCountry(rows: ListingCountRow[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const status = row.status?.trim() || "Unknown";
    const country = row.country?.trim() || "Unknown";
    out[status] ??= {};
    out[status][country] = (out[status][country] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(out)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([status, countries]) => [status, sortRecord(countries)]),
  );
}

function sortRecord(input: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)));
}

function terminalCount(statusCounts: Record<string, number>): number {
  return TERMINAL_STATUSES.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0);
}

async function fetchSourceHtml(url: string, limiter: PerDomainRateLimiter): Promise<string> {
  const scraplingHtml = (await fetchBFHtmlWithScrapling(url)) ?? (await fetchBFHtmlWithScrapling(url));
  if (scraplingHtml) return scraplingHtml;

  await limiter.waitForDomain(getDomainFromUrl(url));
  const { value } = await withRetry(() => fetchHtml(url, FETCH_TIMEOUT_MS), {
    retries: 1,
    baseDelayMs: 2000,
  });
  return value;
}

function classifyHtml(html: string): { classification: SourceClassification; evidence: string } {
  if (isAmbiguousBeForwardHtml(html)) {
    return { classification: "ambiguous", evidence: `ambiguous_html:${html.length}` };
  }

  const parsed = parseDetailHtml(html);
  if (!hasExplicitStatusEvidence(parsed.sourceStatus, parsed.schemaAvailability)) {
    return { classification: "ambiguous", evidence: "missing_status_evidence" };
  }
  const status = mapStatus(parsed.sourceStatus, parsed.schemaAvailability);
  if (status === "active") {
    return {
      classification: "live",
      evidence: `sourceStatus=${parsed.sourceStatus ?? "null"};schemaAvailability=${parsed.schemaAvailability ?? "null"}`,
    };
  }

  return {
    classification: "terminal",
    evidence: `mappedStatus=${status};sourceStatus=${parsed.sourceStatus ?? "null"};schemaAvailability=${parsed.schemaAvailability ?? "null"}`,
  };
}

function isAmbiguousBeForwardHtml(html: string): boolean {
  const lower = html.toLowerCase();
  if (html.length < 50_000) return true;
  if (lower.includes("captcha") || lower.includes("_challenge") || lower.includes("access denied")) return true;
  return !/beforward/i.test(html) || !/schema\.org|ga_sale_status|vehicle/i.test(html);
}

function classifyFetchError(error: unknown): { classification: SourceClassification; evidence: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b(404|410)\b/.test(message)) {
    return { classification: "terminal", evidence: message.slice(0, 160) };
  }
  return { classification: "ambiguous", evidence: message.slice(0, 160) };
}

async function classifySamples(rows: TerminalSampleRow[]): Promise<ClassifiedSample[]> {
  const limiter = new PerDomainRateLimiter(1500);
  const out: ClassifiedSample[] = [];

  for (const row of rows) {
    if (!row.source_url) {
      out.push({ ...row, classification: "ambiguous", evidence: "missing_source_url" });
      continue;
    }

    try {
      const html = await fetchSourceHtml(row.source_url, limiter);
      const result = classifyHtml(html);
      out.push({ ...row, ...result });
    } catch (error) {
      out.push({ ...row, ...classifyFetchError(error) });
    }
  }

  return out;
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 10_000) / 100;
}

async function main(): Promise<void> {
  const sampleSize = parseSampleSize(process.argv.slice(2));
  const generatedAt = new Date().toISOString();
  const limiter = new PerDomainRateLimiter(1500);

  loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFromFile(path.resolve(process.cwd(), ".env"));

  const [sourcePage, client] = await Promise.all([
    discoverPage({ page: 1, limiter, timeoutMs: FETCH_TIMEOUT_MS }),
    Promise.resolve(createSupabaseReadClient()),
  ]);

  const sourceTotal = sourcePage.totalResults ?? null;
  const sourcePages =
    sourceTotal !== null
      ? Math.max(sourcePage.pageCount, computeTotalPages(sourceTotal, sourcePage.listings.length || 25))
      : sourcePage.pageCount;

  const countRows = await fetchAllCountRows(client);
  const statusCounts = countBy(countRows, "status");
  const countryCounts = countBy(countRows, "country");
  const statusCountryCounts = countByStatusAndCountry(countRows);
  const terminalRows = await fetchTerminalSample(client, sampleSize);
  const classifiedSamples = await classifySamples(terminalRows);

  const dbActive = statusCounts.active ?? 0;
  const dbTerminal = terminalCount(statusCounts);
  const activeJapan = statusCountryCounts.active?.Japan ?? 0;
  const terminalSampleLive = classifiedSamples.filter((sample) => sample.classification === "live").length;
  const terminalSampleTerminal = classifiedSamples.filter((sample) => sample.classification === "terminal").length;
  const terminalSampleAmbiguous = classifiedSamples.filter((sample) => sample.classification === "ambiguous").length;
  const coverageGap = sourceTotal === null ? null : Math.max(0, pct(sourceTotal - dbActive, sourceTotal));

  const payload = {
    generatedAt,
    source: SOURCE,
    sourceTotal,
    sourcePages,
    sourceTotalPages: sourcePages,
    sourcePageOneListings: sourcePage.listings.length,
    dbTotal: countRows.length,
    dbActive,
    dbTerminal,
    activeJapan,
    coverageGap,
    statusCounts,
    countryCounts,
    statusCountryCounts,
    terminalSample: {
      requested: sampleSize,
      checked: classifiedSamples.length,
      live: terminalSampleLive,
      terminal: terminalSampleTerminal,
      ambiguous: terminalSampleAmbiguous,
      rows: classifiedSamples,
    },
  };

  const artifactDir = path.resolve(process.cwd(), "agents", "testscripts", "artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(
    artifactDir,
    `beforward-accuracy-${generatedAt.replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log("BeForward Accuracy Audit");
  console.log(`sourceTotal=${sourceTotal ?? "unknown"}`);
  console.log(`sourcePages=${sourcePages}`);
  console.log(`dbActive=${dbActive}`);
  console.log(`dbTerminal=${dbTerminal}`);
  console.log(`activeJapan=${activeJapan}`);
  console.log(`terminalSampleLive=${terminalSampleLive}`);
  console.log(`coverageGap=${coverageGap === null ? "unknown" : `${coverageGap}%`}`);
  console.log(`artifact=${artifactPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
