import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import {
  summarizeScraperHealth,
  type ScraperJobSpec,
} from "../src/features/scrapers/common/monitoring/audit";
import type { ActiveScraperRun, ScraperRun } from "../src/features/scrapers/common/monitoring/types";

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

const JOB_SPECS: ScraperJobSpec[] = [
  { scraperName: "ferrari", label: "Ferrari Collector", cadence: "daily", cronPath: "/api/cron/ferrari" },
  { scraperName: "porsche", label: "Porsche Collector", cadence: "daily", cronPath: "/api/cron/porsche" },
  { scraperName: "autotrader", label: "AutoTrader Collector", cadence: "daily", cronPath: "/api/cron/autotrader" },
  { scraperName: "beforward", label: "BeForward Collector", cadence: "daily", cronPath: "/api/cron/beforward" },
  { scraperName: "classic", label: "Classic.com Collector", cadence: "external" },
  { scraperName: "autoscout24", label: "AutoScout24 Collector", cadence: "external" },
  { scraperName: "elferspot", label: "Elferspot Collector", cadence: "daily", cronPath: "/api/cron/elferspot" },
  { scraperName: "backfill-images", label: "Image Backfill", cadence: "daily", cronPath: "/api/cron/backfill-images" },
  { scraperName: "bat-detail", label: "BaT Detail Scraper", cadence: "external" },
  { scraperName: "validate", label: "Listing Validator", cadence: "daily", cronPath: "/api/cron/validate" },
  { scraperName: "cleanup", label: "Cleanup", cadence: "daily", cronPath: "/api/cron/cleanup" },
  { scraperName: "enrich-vin", label: "VIN Enrichment", cadence: "daily", cronPath: "/api/cron/enrich-vin" },
  { scraperName: "enrich-titles", label: "Title Enrichment", cadence: "daily", cronPath: "/api/cron/enrich-titles" },
  { scraperName: "enrich-details", label: "AS24 Detail Enrichment", cadence: "daily", cronPath: "/api/cron/enrich-details" },
  { scraperName: "enrich-autotrader", label: "AutoTrader Enrichment", cadence: "daily", cronPath: "/api/cron/enrich-autotrader" },
  { scraperName: "enrich-beforward", label: "BeForward Enrichment", cadence: "daily", cronPath: "/api/cron/enrich-beforward" },
  { scraperName: "enrich-elferspot", label: "Elferspot Enrichment", cadence: "daily", cronPath: "/api/cron/enrich-elferspot" },
  { scraperName: "enrich-details-bulk", label: "AS24 Bulk Detail Enrichment", cadence: "external" },
  { scraperName: "liveness-check", label: "Liveness Check", cadence: "external" },
];

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
      .select("scraper_name,run_id,started_at,finished_at,success,runtime,duration_ms,discovered,written,errors_count,error_messages")
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

  const summaries = JOB_SPECS.map((spec) =>
    summarizeScraperHealth(
      spec,
      groupedRuns.get(spec.scraperName) ?? [],
      activeByName.get(spec.scraperName),
    ),
  );

  const issues = summaries.filter((summary) => statusRank(summary.status) > 0);
  const artifactDir = path.resolve(process.cwd(), "agents/testscripts/artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactPath = path.join(artifactDir, `scraper-health-audit-${stamp}.json`);
  const payload = {
    generated_at: new Date().toISOString(),
    window_days: daysBack,
    since,
    issue_count: issues.length,
    summaries,
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
    console.log(`Jobs with issues: ${issues.length}`);
  }

  if (strict && issues.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
