import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { runIngest } from "../src/features/porsche_ingest/entrypoints/run_ingest";
import { nextConvergence, shouldStop } from "../src/features/porsche_ingest/services/convergence";

function loadEnv(filePath: string): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function arg(name: string, fallback: string): string {
  const hit = process.argv.slice(2).find((entry) => entry.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function currentSoldSet(cutoff: string): Promise<Set<string>> {
  const db = supabase();
  const { data, error } = await db
    .from("listings")
    .select("source_id")
    .eq("source", "BaT")
    .eq("make", "Porsche")
    .eq("status", "sold")
    .gte("sale_date", cutoff);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => String(row.source_id)));
}

type CampaignState = {
  campaign_id: string;
  cutoff: string;
  chunk_limit: number;
  stop_after_zero_new: number;
  chunks: Array<{ chunk: number; run_id: string; fetched: number; normalized: number; inserted: number; updated: number; rejected: number; errors: number; new_ids: number }>;
  total_new_ids: number;
  stopped_reason: string;
};

async function main(): Promise<void> {
  loadEnv(".env.local");
  loadEnv(".env");

  const chunkLimit = Number(arg("chunkLimit", "200"));
  const maxChunks = Number(arg("maxChunks", "8"));
  const stopAfterZero = Number(arg("stopAfterZero", "2"));
  const months = Number(arg("months", "12"));
  const now = new Date();
  const cutoff = `${now.getUTCFullYear() - 1}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const campaignId = `bat_sold12m_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

  const state: CampaignState = {
    campaign_id: campaignId,
    cutoff,
    chunk_limit: chunkLimit,
    stop_after_zero_new: stopAfterZero,
    chunks: [],
    total_new_ids: 0,
    stopped_reason: "",
  };

  let seen = await currentSoldSet(cutoff);
  let conv = { consecutiveZeroNew: 0, totalNew: 0 };

  for (let chunk = 1; chunk <= maxChunks; chunk += 1) {
    const report = await runIngest([
      "--source=bat",
      "--mode=sample",
      `--limit=${chunkLimit}`,
      "--sold-only",
      `--sold-within-months=${months}`,
      "--strict-sale-date",
    ]);

    const externalError = report.errors.find((error) => /Apify actor run failed|not-enough-usage|memory-limit|actor-is-not-rented|403|402/i.test(error));
    if (externalError) {
      state.stopped_reason = `external_blocker:${externalError}`;
      break;
    }

    const latest = await currentSoldSet(cutoff);
    let newIds = 0;
    for (const id of latest) if (!seen.has(id)) newIds += 1;
    seen = latest;

    state.chunks.push({
      chunk,
      run_id: report.run_id,
      fetched: report.totals.fetched,
      normalized: report.totals.normalized,
      inserted: report.totals.inserted,
      updated: report.totals.updated,
      rejected: report.totals.rejected,
      errors: report.totals.errors,
      new_ids: newIds,
    });

    conv = nextConvergence(conv, newIds);
    state.total_new_ids = conv.totalNew;
    if (shouldStop(conv, stopAfterZero)) {
      state.stopped_reason = `converged_after_${conv.consecutiveZeroNew}_zero_new_chunks`;
      break;
    }
  }

  if (!state.stopped_reason) state.stopped_reason = "max_chunks_reached";

  const dir = path.resolve(process.cwd(), "var/runs/porsche-ingest/campaigns");
  mkdirSync(dir, { recursive: true });
  const outputPath = path.join(dir, `${campaignId}.json`);
  writeFileSync(outputPath, JSON.stringify(state, null, 2) + "\n", "utf8");
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
