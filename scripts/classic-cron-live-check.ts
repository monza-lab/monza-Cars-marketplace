import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
};

type PgClientConstructor = new (options: { connectionString: string; ssl: { rejectUnauthorized: boolean } }) => PgClient;

type Mode = "before" | "after" | "trigger-cron";

type StatusCount = {
  status: string | null;
  count: number;
};

type RunRow = {
  run_id: string;
  started_at: string;
  finished_at: string | null;
  success: boolean | null;
  runtime: string | null;
  discovered: number | null;
  written: number | null;
  errors_count: number | null;
  refresh_checked: number | null;
  refresh_updated: number | null;
  error_messages: string[] | null;
};

type RefreshWindow = {
  window_start: string | null;
  window_end: string | null;
  runs: number;
  total_refresh_checked: number;
  total_refresh_updated: number;
  rows: RunRow[];
};

type CronResponse = {
  ok: boolean;
  status: number;
  body: unknown;
};

type Snapshot = {
  generated_at: string;
  mode: Mode;
  status_counts: StatusCount[];
  recent_runs: RunRow[];
  refresh_window: RefreshWindow;
  assessment: {
    status: "PASS" | "WARN" | "FAIL";
    notes: string[];
  };
  cron_response?: CronResponse;
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

function getMode(): Mode {
  const args = process.argv.slice(2);
  if (args.includes("--trigger-cron")) return "trigger-cron";
  if (args.includes("--after")) return "after";
  return "before";
}

function latestBeforeArtifact(): string | null {
  const dir = path.resolve(process.cwd(), "agents/testscripts/artifacts");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((file: string) => /^classic-cron-live-before-.*\.json$/.test(file))
    .sort();
  const latest = files.at(-1);
  return latest ? path.join(dir, latest) : null;
}

function activeCount(rows: StatusCount[]): number {
  return rows.find((row) => row.status === "active")?.count ?? 0;
}

async function triggerCron(): Promise<CronResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!baseUrl || !secret) throw new Error("Missing NEXT_PUBLIC_APP_URL or CRON_SECRET");

  const response = await fetch(new URL("/api/cron/classic", baseUrl), {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

async function withPg<T>(fn: (client: PgClient) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL missing");
  const require = createRequire(import.meta.url);
  const { Client } = require("pg") as { Client: PgClientConstructor };
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function supabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchStatusCounts(): Promise<StatusCount[]> {
  if (process.env.DATABASE_URL) {
    return withPg(async (client) => {
      const result = await client.query<{ status: string | null; count: string }>(
        "select status, count(*)::text as count from listings where source = 'ClassicCom' group by status order by status",
      );
      return result.rows.map((row) => ({ status: row.status, count: Number(row.count) }));
    });
  }

  const supabase = supabaseClient();
  const statuses = ["active", "delisted", "sold", "unsold"];
  const rows: StatusCount[] = [];
  for (const status of statuses) {
    const { count, error } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("source", "ClassicCom")
      .eq("status", status);
    if (error) throw new Error(`Classic ${status} count failed: ${error.message}`);
    if ((count ?? 0) > 0) rows.push({ status, count: count ?? 0 });
  }
  return rows;
}

async function fetchRuns(limit: number, opts?: { refreshOnly?: boolean; runtime?: string }): Promise<RunRow[]> {
  const select = [
    "run_id",
    "started_at",
    "finished_at",
    "success",
    "runtime",
    "discovered",
    "written",
    "errors_count",
    "refresh_checked",
    "refresh_updated",
    "error_messages",
  ].join(",");

  if (process.env.DATABASE_URL) {
    return withPg(async (client) => {
      const refreshClause = opts?.refreshOnly ? "and coalesce(refresh_updated, 0) > 0" : "";
      const runtimeClause = opts?.runtime ? "and runtime = $2" : "";
      const values = opts?.runtime ? [limit, opts.runtime] : [limit];
      const result = await client.query<RunRow>(
        `select ${select}
         from scraper_runs
         where scraper_name = 'classic' ${refreshClause} ${runtimeClause}
         order by finished_at desc nulls last
         limit $1`,
        values,
      );
      return result.rows;
    });
  }

  let query = supabaseClient()
    .from("scraper_runs")
    .select(select)
    .eq("scraper_name", "classic")
    .order("finished_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (opts?.refreshOnly) query = query.gt("refresh_updated", 0);
  if (opts?.runtime) query = query.eq("runtime", opts.runtime);
  const { data, error } = await query;
  if (error) throw new Error(`Classic scraper_runs query failed: ${error.message}`);
  return ((data ?? []) as unknown[]).map((row) => row as RunRow);
}

function summarizeRefreshWindow(rows: RunRow[]): RefreshWindow {
  return {
    window_start: rows.at(-1)?.finished_at ?? null,
    window_end: rows[0]?.finished_at ?? null,
    runs: rows.length,
    total_refresh_checked: rows.reduce((sum, row) => sum + (row.refresh_checked ?? 0), 0),
    total_refresh_updated: rows.reduce((sum, row) => sum + (row.refresh_updated ?? 0), 0),
    rows,
  };
}

function assess(mode: Mode, statusCounts: StatusCount[], cronRuns: RunRow[], cronResponse?: CronResponse): Snapshot["assessment"] {
  const notes: string[] = [];
  const latest = cronRuns[0];
  const active = activeCount(statusCounts);

  let beforeActive: number | null = null;
  if (mode === "after") {
    const beforePath = latestBeforeArtifact();
    if (beforePath) {
      const before = JSON.parse(readFileSync(beforePath, "utf8")) as Snapshot;
      beforeActive = activeCount(before.status_counts);
      notes.push(`before_active=${beforeActive}`);
    }
  }

  if (cronResponse) {
    notes.push(`trigger_status=${cronResponse.status}`);
    if (!cronResponse.ok) return { status: "FAIL", notes };
  }

  notes.push(`active=${active}`);
  if (latest) {
    notes.push(`latest_success=${latest.success}`);
    notes.push(`latest_discovered=${latest.discovered ?? 0}`);
    notes.push(`latest_written=${latest.written ?? 0}`);
    notes.push(`latest_refresh_updated=${latest.refresh_updated ?? 0}`);
  }

  if (latest && latest.success === false) return { status: "FAIL", notes };
  if (beforeActive !== null && active < beforeActive - 100) return { status: "FAIL", notes };
  if (latest && (latest.discovered ?? 0) === 0 && (latest.refresh_updated ?? 0) > 0) return { status: "FAIL", notes };
  if (beforeActive !== null && active >= beforeActive && latest?.success === true) return { status: "PASS", notes };
  if (latest && latest.success === true && (latest.written ?? 0) > 0) return { status: "WARN", notes };
  if (mode === "before") return { status: "WARN", notes };
  return { status: "WARN", notes };
}

function printSnapshot(snapshot: Snapshot): void {
  console.log("## classic_status_counts");
  console.table(snapshot.status_counts);
  console.log("## classic_recent_runs");
  console.table(snapshot.recent_runs);
  console.log("## classic_refresh_window");
  console.table([{
    window_start: snapshot.refresh_window.window_start,
    window_end: snapshot.refresh_window.window_end,
    runs: snapshot.refresh_window.runs,
    total_refresh_checked: snapshot.refresh_window.total_refresh_checked,
    total_refresh_updated: snapshot.refresh_window.total_refresh_updated,
  }]);
  console.table(snapshot.refresh_window.rows);
  console.log("## assessment");
  console.log(snapshot.assessment.status);
  for (const note of snapshot.assessment.notes) console.log(`- ${note}`);
}

async function main(): Promise<void> {
  loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFromFile(path.resolve(process.cwd(), ".env"));

  const mode = getMode();
  const cronResponse = mode === "trigger-cron" ? await triggerCron() : undefined;
  const [statusCounts, recentRuns, cronRuns, refreshRows] = await Promise.all([
    fetchStatusCounts(),
    fetchRuns(10),
    fetchRuns(10, { runtime: "vercel_cron" }),
    fetchRuns(10, { refreshOnly: true }),
  ]);
  const refreshWindow = summarizeRefreshWindow(refreshRows);

  const snapshot: Snapshot = {
    generated_at: new Date().toISOString(),
    mode,
    status_counts: statusCounts,
    recent_runs: recentRuns,
    refresh_window: refreshWindow,
    assessment: assess(mode, statusCounts, cronRuns, cronResponse),
    ...(cronResponse ? { cron_response: cronResponse } : {}),
  };

  const artifactDir = path.resolve(process.cwd(), "agents/testscripts/artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const stamp = snapshot.generated_at.replace(/[:.]/g, "-");
  const artifactPath = path.join(artifactDir, `classic-cron-live-${mode}-${stamp}.json`);
  writeFileSync(artifactPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  printSnapshot(snapshot);
  console.log(`artifact=${artifactPath}`);

  if (snapshot.assessment.status === "FAIL") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
