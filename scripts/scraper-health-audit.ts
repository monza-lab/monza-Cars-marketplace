import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  summarizeScraperHealth,
  type ScraperHealthSummary,
  type ScraperJobSpec,
  type ScraperTargetFieldCoverage,
} from "../src/features/scrapers/common/monitoring/audit";
import { ASSURANCE_AUDIT_JOB_SPECS } from "../src/features/scrapers/common/assurance/manifest";
import type { ActiveScraperRun, ScraperRun } from "../src/features/scrapers/common/monitoring/types";
import { ELFERSPOT_RESOLVED_NON_NUMERIC_PRICE_STATUSES } from "../src/features/scrapers/elferspot_collector/coverage";
import {
  fetchCoverageRows,
  summarizeCoverageRows,
  type CoverageAlert,
  type CoverageSummary,
} from "./coverage-snapshot";

type AuditSupabaseClient = SupabaseClient<any, any, any, any, any>;

export type CoverageHealthIssue = {
  scope: "market" | "source";
  key: string;
  severity: CoverageAlert["severity"];
  message: string;
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

loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFromFile(path.resolve(process.cwd(), ".env"));

const JOB_SPECS: ScraperJobSpec[] = ASSURANCE_AUDIT_JOB_SPECS;

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const raw = process.argv.slice(2).find((entry) => entry.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : undefined;
}

function getFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

function formatStatus(status: string): string {
  switch (status) {
    case "working":
      return "WORKING";
    case "zero-write":
      return "ZERO-WRITE";
    case "degraded":
      return "DEGRADED";
    case "failed":
      return "FAILED";
    case "stale":
      return "STALE";
    case "stuck":
      return "STUCK";
    default:
      return "IDLE";
  }
}

function statusRank(status: string): number {
  switch (status) {
    case "failed":
      return 4;
    case "stuck":
      return 3;
    case "stale":
      return 3;
    case "degraded":
      return 2;
    case "zero-write":
      return 1;
    case "working":
      return 0;
    default:
      return 0;
  }
}

async function countRows(query: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

type TargetCoverageSpec = {
  source: string;
  sourceFilter: string;
  metaNamespace: "elferspot" | "autoscout24";
  fields: readonly string[];
  exceptionStatuses: readonly string[];
};

const TARGET_COVERAGE_SPECS = {
  elferspot: {
    source: "Elferspot",
    sourceFilter: "Elferspot",
    metaNamespace: "elferspot",
    fields: ["color_exterior", "engine", "transmission"],
    exceptionStatuses: ["covered_or_unavailable", "detail_unavailable", "blocked_unverified"],
  },
  autoscout24: {
    source: "AutoScout24",
    sourceFilter: "AutoScout24",
    metaNamespace: "autoscout24",
    fields: ["color_exterior", "engine", "transmission"],
    exceptionStatuses: ["covered_or_unavailable", "detail_unavailable", "blocked_unverified", "dead_url"],
  },
} as const satisfies Record<string, TargetCoverageSpec>;

const PLACEHOLDER_TARGET_VALUES = ["Not specified", "Unknown", "N/A", "-"] as const;
const PLACEHOLDER_FILTER = `("${PLACEHOLDER_TARGET_VALUES.join('","')}")`;

async function fetchTargetCoverage(
  supabase: AuditSupabaseClient,
  spec: TargetCoverageSpec,
): Promise<ScraperTargetFieldCoverage> {
  const base = () =>
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("source", spec.sourceFilter)
      .eq("status", "active");
  const activeTotal = await countRows(base());
  const targetFields: ScraperTargetFieldCoverage["targetFields"] = {};

  for (const field of spec.fields) {
    const filled = await countRows(
      base()
        .not(field, "is", null)
        .neq(field, "")
        .not(field, "in", PLACEHOLDER_FILTER),
    );
    const excepted = await countRows(
      base()
        .or(`${field}.is.null,${field}.eq.,${field}.in.${PLACEHOLDER_FILTER}`)
        .in(`enrichment_meta->${spec.metaNamespace}->>targetFieldStatus`, spec.exceptionStatuses),
    );
    const coveredOrExcepted = filled + excepted;
    targetFields[field] = {
      filled,
      coveredOrExcepted,
      missing: Math.max(0, activeTotal - coveredOrExcepted),
      pct: activeTotal === 0 ? 100 : Math.round((coveredOrExcepted / activeTotal) * 1000) / 10,
    };
  }

  return { source: spec.source, activeTotal, targetFields };
}

export function buildElferspotPriceCoverage(
  activeTotal: number,
  numeric: number,
  resolvedNonNumeric: number,
): NonNullable<ScraperTargetFieldCoverage["priceCoverage"]> {
  const resolved = Math.min(activeTotal, numeric + resolvedNonNumeric);
  const pct = (value: number) => activeTotal === 0 ? 100 : Math.round((value / activeTotal) * 1000) / 10;
  return {
    numeric,
    resolved,
    unresolved: Math.max(0, activeTotal - resolved),
    numericPct: pct(numeric),
    resolvedPct: pct(resolved),
  };
}

async function fetchElferspotTargetCoverage(supabase: AuditSupabaseClient): Promise<ScraperTargetFieldCoverage> {
  const coverage = await fetchTargetCoverage(supabase, TARGET_COVERAGE_SPECS.elferspot);
  const base = () => supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("source", "Elferspot")
    .eq("status", "active");
  const [numeric, resolvedNonNumeric] = await Promise.all([
    countRows(base().not("hammer_price", "is", null)),
    countRows(
      base()
        .is("hammer_price", null)
        .in(
          "enrichment_meta->elferspot->>priceStatus",
          [...ELFERSPOT_RESOLVED_NON_NUMERIC_PRICE_STATUSES],
        ),
    ),
  ]);
  coverage.priceCoverage = buildElferspotPriceCoverage(
    coverage.activeTotal,
    numeric,
    resolvedNonNumeric,
  );
  return coverage;
}

function fetchAutoscout24TargetCoverage(supabase: AuditSupabaseClient): Promise<ScraperTargetFieldCoverage> {
  return fetchTargetCoverage(supabase, TARGET_COVERAGE_SPECS.autoscout24);
}

export function hasAutoscout24ShardSaturationWarning(runs: ScraperRun[]): boolean {
  const warningPattern = /shard[_\s-]?saturat|20-page limit|reached .*page limit/i;

  function scan(value: unknown): boolean {
    if (typeof value === "string") return warningPattern.test(value);
    if (Array.isArray(value)) return value.some(scan);
    if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some(scan);
    return false;
  }

  return runs.some((run) => scan(run as ScraperRun & Record<string, unknown>));
}

export function applyAutoscout24HealthGates(
  summary: ScraperHealthSummary,
  runs: ScraperRun[],
): ScraperHealthSummary {
  if (summary.scraperName !== "autoscout24" || summary.status === "failed" || summary.status === "stuck") {
    return summary;
  }

  const notes = [...summary.notes];
  let status = summary.status;
  const targetCoverageBelow100 =
    summary.targetFieldCoverage &&
    Object.values(summary.targetFieldCoverage.targetFields).some((field) => field.pct < 100);

  if (targetCoverageBelow100) {
    status = "degraded";
    notes.push("AutoScout24 target-field coverage below 100%");
  }

  if (hasAutoscout24ShardSaturationWarning(runs)) {
    status = "degraded";
    notes.push("AutoScout24 shard saturation warning present");
  }

  return status === summary.status && notes.length === summary.notes.length
    ? summary
    : { ...summary, status, notes };
}

export function applyVinEnrichmentHealthGates(
  summary: ScraperHealthSummary,
  runs: ScraperRun[],
): ScraperHealthSummary {
  if (summary.scraperName !== "enrich-vin") {
    return summary;
  }

  const latestRun = [...runs].sort(
    (left, right) => Date.parse(right.finished_at) - Date.parse(left.finished_at),
  )[0];
  const latestZeroWriteReason = latestRun?.error_messages?.find((message) =>
    /^vin_zero_write:(decode_failed|no_new_fields)$/.test(message),
  )?.replace("vin_zero_write:", "");

  if (latestZeroWriteReason && summary.status !== "failed" && summary.status !== "stuck") {
    return {
      ...summary,
      status: "degraded",
      notes: [
        ...summary.notes,
        `VIN enrichment latest run ${latestZeroWriteReason}`,
      ],
    };
  }

  if (summary.status !== "zero-write") {
    return summary;
  }

  const hasOnlyEmptyQueueRuns = runs.length > 0 && runs.every((run) =>
    run.success
    && (run.discovered ?? 0) === 0
    && (run.written ?? 0) === 0
    && (run.errors_count ?? 0) === 0
  );

  if (!hasOnlyEmptyQueueRuns) {
    return summary;
  }

  return {
    ...summary,
    status: "working",
    notes: [
      ...summary.notes.filter((note) => note !== "Recent runs wrote nothing"),
      "VIN enrichment queue exhausted",
    ],
  };
}

export function buildCoverageHealthIssues(summary: CoverageSummary): CoverageHealthIssue[] {
  return [
    ...summary.marketAlerts.map((alert) => ({
      scope: "market" as const,
      key: String(alert.market ?? "UNKNOWN"),
      severity: alert.severity,
      message: alert.message,
    })),
    ...summary.sourceAlerts.map((alert) => ({
      scope: "source" as const,
      key: String(alert.source ?? "UNKNOWN"),
      severity: alert.severity,
      message: alert.message,
    })),
  ];
}

async function main(): Promise<void> {
  const daysBack = Number(getArg("days") ?? "3");
  const strict = getFlag("strict");
  const jsonOnly = getFlag("json");
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env vars");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: runs, error: runsError }, { data: activeRuns, error: activeError }] = await Promise.all([
    supabase
      .from("scraper_runs")
      .select("*")
      .gte("finished_at", since)
      .order("finished_at", { ascending: false }),
    supabase
      .from("scraper_active_runs")
      .select("scraper_name,run_id,started_at,runtime,updated_at"),
  ]);

  if (runsError) throw new Error(`scraper_runs query failed: ${runsError.message}`);
  if (activeError) throw new Error(`scraper_active_runs query failed: ${activeError.message}`);

  const groupedRuns = new Map<string, ScraperRun[]>();
  for (const run of (runs ?? []) as ScraperRun[]) {
    const list = groupedRuns.get(run.scraper_name) ?? [];
    list.push(run);
    groupedRuns.set(run.scraper_name, list);
  }

  const activeByName = new Map<string, ActiveScraperRun>();
  for (const active of (activeRuns ?? []) as ActiveScraperRun[]) {
    activeByName.set(active.scraper_name, active);
  }

  const [elferspotTargetCoverage, autoscout24TargetCoverage, coverageRows] = await Promise.all([
    fetchElferspotTargetCoverage(supabase),
    fetchAutoscout24TargetCoverage(supabase),
    fetchCoverageRows(),
  ]);
  const coverage = summarizeCoverageRows(coverageRows);
  const coverageIssues = buildCoverageHealthIssues(coverage);

  const summaries = JOB_SPECS.map((spec) => {
    const specRuns = groupedRuns.get(spec.scraperName) ?? [];
    const summary = summarizeScraperHealth(
      spec,
      specRuns,
      activeByName.get(spec.scraperName),
      Date.now(),
      spec.scraperName === "elferspot"
        ? elferspotTargetCoverage
        : spec.scraperName === "autoscout24"
          ? autoscout24TargetCoverage
          : undefined,
    );

    return applyVinEnrichmentHealthGates(
      applyAutoscout24HealthGates(summary, specRuns),
      specRuns,
    );
  });

  const jobIssues = summaries.filter((summary) => statusRank(summary.status) > 0);
  const artifactDir = path.resolve(process.cwd(), "agents/testscripts/artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactPath = path.join(artifactDir, `scraper-health-audit-${stamp}.json`);
  const payload = {
    generated_at: new Date().toISOString(),
    window_days: daysBack,
    since,
    issue_count: jobIssues.length + coverageIssues.length,
    job_issue_count: jobIssues.length,
    coverage_issue_count: coverageIssues.length,
    summaries,
    coverage,
    coverage_issues: coverageIssues,
  };
  writeFileSync(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  if (!jsonOnly) {
    console.log(`Scraper health audit for the last ${daysBack} days`);
    console.log(`Artifact: ${artifactPath}`);
    console.log("");
    console.log("SCRAPER | STATUS | RUNS | WRITTEN | ERRORS | LAST RUN | NOTES");
    for (const summary of summaries) {
      const notes = summary.notes.length > 0 ? summary.notes.join("; ") : "-";
      console.log(
        [
          summary.scraperName,
          formatStatus(summary.status),
          String(summary.runsInWindow),
          String(summary.totalWritten),
          String(summary.totalErrors),
          summary.lastRunAt ?? "-",
          notes,
        ].join(" | "),
      );
    }
    console.log("");
    console.log(`Jobs with issues: ${jobIssues.length}`);
    console.log(`Coverage issues: ${coverageIssues.length}`);
    for (const issue of coverageIssues) {
      console.log(`${issue.severity.toUpperCase()}: ${issue.scope}:${issue.key} | ${issue.message}`);
    }
  }

  if (strict && (jobIssues.length > 0 || coverageIssues.length > 0)) {
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1] ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
