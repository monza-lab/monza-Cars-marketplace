import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

export type RestoreAutoTraderOptions = {
  days: number;
  apply: boolean;
  limit: number;
};

export function parseRestoreAutoTraderArgs(args: string[]): RestoreAutoTraderOptions {
  const options: RestoreAutoTraderOptions = {
    days: 7,
    apply: false,
    limit: 0,
  };

  for (const arg of args) {
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key === "days" && value) options.days = Math.max(1, Number.parseInt(value, 10) || options.days);
    if (key === "limit" && value) options.limit = Math.max(0, Number.parseInt(value, 10) || 0);
  }

  return options;
}

function loadEnv(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (process.env[key]) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadEnv();
  const options = parseRestoreAutoTraderArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const since = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000).toISOString();

  let query = client
    .from("listings")
    .select("id,title,source_url,created_at,updated_at", { count: "exact" })
    .eq("source", "AutoTrader")
    .eq("status", "delisted")
    .or(`created_at.gte.${since},updated_at.gte.${since}`)
    .order("updated_at", { ascending: false });

  if (options.limit > 0) query = query.limit(options.limit);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const candidates = data ?? [];
  console.log(`AutoTrader restore candidates: ${count ?? candidates.length}`);
  console.log(`Window: last ${options.days} day(s), apply: ${options.apply}, limit: ${options.limit || "ALL"}`);
  for (const row of candidates.slice(0, 10)) {
    console.log(`- ${row.id} | ${row.updated_at} | ${(row.title ?? "").slice(0, 90)} | ${row.source_url}`);
  }

  if (!options.apply) {
    console.log("Dry run only. Re-run with --apply to restore candidates to active.");
    return;
  }

  if (candidates.length === 0) {
    console.log("No candidates to restore.");
    return;
  }

  const ids = candidates.map((row) => row.id);
  const { error: updateError } = await client
    .from("listings")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .in("id", ids);
  if (updateError) throw new Error(updateError.message);

  const { count: activeAfter, error: countError } = await client
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("source", "AutoTrader")
    .eq("status", "active");
  if (countError) throw new Error(countError.message);

  console.log(`Restored ${ids.length} AutoTrader rows. Active after restore: ${activeAfter ?? 0}`);
}

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
