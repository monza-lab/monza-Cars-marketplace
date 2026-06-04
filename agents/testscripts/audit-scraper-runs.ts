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

function arg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

type RunRow = {
  id: string;
  scraper_name: string;
  run_id: string;
  started_at: string;
  finished_at: string;
  success: boolean;
  runtime: string;
  duration_ms: number;
  discovered: number;
  written: number;
  errors_count: number;
  refresh_checked: number | null;
  refresh_updated: number | null;
  details_fetched: number | null;
  normalized: number | null;
  skipped_duplicate: number | null;
  bot_blocked: number | null;
  backfill_discovered: number | null;
  backfill_written: number | null;
  source_counts: unknown;
  error_messages: string[] | null;
};

type ActiveRow = {
  scraper_name: string;
  run_id: string;
  started_at: string;
  runtime: string;
  updated_at: string;
};

function addToMap<T extends Record<string, unknown>>(map: Map<string, T>, key: string, make: () => T): T {
  const existing = map.get(key);
  if (existing) return existing;
  const created = make();
  map.set(key, created);
  return created;
}

async function main(): Promise<void> {
  loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFromFile(path.resolve(process.cwd(), ".env"));

  const since = arg("since", "2026-05-11T00:00:00.000Z");
  const until = arg("until", new Date().toISOString());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const select = [
    "id",
    "scraper_name",
    "run_id",
    "started_at",
    "finished_at",
    "success",
    "runtime",
    "duration_ms",
    "discovered",
    "written",
    "errors_count",
    "refresh_checked",
    "refresh_updated",
    "details_fetched",
    "normalized",
    "skipped_duplicate",
    "bot_blocked",
    "backfill_discovered",
    "backfill_written",
    "source_counts",
    "error_messages",
  ].join(",");

  const [{ data: runs, error: runsError }, { data: activeRuns, error: activeError }] = await Promise.all([
    supabase
      .from("scraper_runs")
      .select(select)
      .gte("finished_at", since)
      .lte("finished_at", until)
      .order("finished_at", { ascending: false })
      .limit(5000),
    supabase
      .from("scraper_active_runs")
      .select("scraper_name,run_id,started_at,runtime,updated_at")
      .order("updated_at", { ascending: false }),
  ]);

  if (runsError) throw new Error(`scraper_runs query failed: ${runsError.message}`);
  if (activeError) throw new Error(`scraper_active_runs query failed: ${activeError.message}`);

  const rows = (runs ?? []) as unknown as RunRow[];
  const active = (activeRuns ?? []) as unknown as ActiveRow[];
  const byScraperRuntime = new Map<string, Record<string, unknown>>();
  const byDay = new Map<string, Record<string, unknown>>();

  for (const run of rows) {
    const keyName = `${run.scraper_name}|${run.runtime}`;
    const item = addToMap(byScraperRuntime, keyName, () => ({
      scraper: run.scraper_name,
      runtime: run.runtime,
      runs: 0,
      success: 0,
      failed: 0,
      discovered: 0,
      written: 0,
      errors: 0,
      duration_sum_ms: 0,
      avg_duration_ms: 0,
      last_finished_at: null,
      last_success: null,
    }));
    item.runs = Number(item.runs) + 1;
    item.success = Number(item.success) + (run.success ? 1 : 0);
    item.failed = Number(item.failed) + (run.success ? 0 : 1);
    item.discovered = Number(item.discovered) + (run.discovered ?? 0);
    item.written = Number(item.written) + (run.written ?? 0);
    item.errors = Number(item.errors) + (run.errors_count ?? 0);
    item.duration_sum_ms = Number(item.duration_sum_ms) + (run.duration_ms ?? 0);
    if (!item.last_finished_at || Date.parse(run.finished_at) > Date.parse(String(item.last_finished_at))) {
      item.last_finished_at = run.finished_at;
      item.last_success = run.success;
    }

    const dayKey = `${run.finished_at.slice(0, 10)}|${run.scraper_name}|${run.runtime}`;
    const daily = addToMap(byDay, dayKey, () => ({
      date: run.finished_at.slice(0, 10),
      scraper: run.scraper_name,
      runtime: run.runtime,
      runs: 0,
      success: 0,
      failed: 0,
      written: 0,
      errors: 0,
    }));
    daily.runs = Number(daily.runs) + 1;
    daily.success = Number(daily.success) + (run.success ? 1 : 0);
    daily.failed = Number(daily.failed) + (run.success ? 0 : 1);
    daily.written = Number(daily.written) + (run.written ?? 0);
    daily.errors = Number(daily.errors) + (run.errors_count ?? 0);
  }

  const summary = [...byScraperRuntime.values()]
    .map((item): Record<string, unknown> => ({
      ...item,
      avg_duration_ms: Math.round(Number(item.duration_sum_ms) / Math.max(1, Number(item.runs))),
      duration_sum_ms: undefined,
    }))
    .sort((left, right) => String(left.scraper).localeCompare(String(right.scraper)) || String(left.runtime).localeCompare(String(right.runtime)));

  const daily = [...byDay.values()].sort(
    (left, right) =>
      String(right.date).localeCompare(String(left.date)) ||
      String(left.scraper).localeCompare(String(right.scraper)) ||
      String(left.runtime).localeCompare(String(right.runtime)),
  );

  const failures = rows
    .filter((run) => !run.success || (run.errors_count ?? 0) > 0)
    .map((run) => ({
      scraper: run.scraper_name,
      runtime: run.runtime,
      finished_at: run.finished_at,
      success: run.success,
      discovered: run.discovered,
      written: run.written,
      errors: run.errors_count,
      duration_ms: run.duration_ms,
      error_messages: run.error_messages ?? [],
    }));

  const zeroWrites = rows
    .filter((run) => run.success && (run.written ?? 0) === 0)
    .map((run) => ({
      scraper: run.scraper_name,
      runtime: run.runtime,
      finished_at: run.finished_at,
      discovered: run.discovered,
      errors: run.errors_count,
      duration_ms: run.duration_ms,
    }));

  const artifactDir = path.resolve(process.cwd(), "agents/testscripts/artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const safeSince = since.replace(/[:.]/g, "-");
  const artifactPath = path.join(artifactDir, `scraper-run-log-${safeSince}.json`);
  const payload = {
    generated_at: new Date().toISOString(),
    since,
    until,
    run_count: rows.length,
    active_runs: active,
    summary,
    daily,
    failures,
    zero_writes: zeroWrites,
    runs: rows,
  };
  writeFileSync(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ artifactPath, ...payload, runs: undefined }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
