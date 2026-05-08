/* eslint-disable no-console */
/**
 * CLI entry point for the BeForward Porsche collector.
 *
 * Designed for GitHub Actions (beforward.jp blocks Vercel IPs) but also
 * works locally.
 *
 * Usage:
 *   npx tsx scripts/bf-collector-cli.ts --maxPages=10 --concurrency=3
 *   npx tsx scripts/bf-collector-cli.ts --summaryOnly --dryRun
 *
 * Env (required):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from "node:fs";
import * as path from "node:path";

// -- Load .env.local / .env (local dev; CI injects via process.env) -----------
for (const envFile of [".env.local", ".env"]) {
  try {
    const envPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    }
  } catch {
    /* ignore — CI injects via env */
  }
}

import { runCollector } from "../src/features/scrapers/beforward_porsche_collector/collector";
import {
  recordScraperRun,
  markScraperRunStarted,
  clearScraperRunActive,
  clearStaleActiveRun,
} from "../src/features/scrapers/common/monitoring";

// -- Arg parsing --------------------------------------------------------------
const args = process.argv.slice(2);

function getFlag(name: string, defaultVal: string): string {
  const flag = args.find((a) => a.startsWith(`--${name}=`));
  return flag ? flag.split("=")[1] : defaultVal;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const maxPages = parseInt(getFlag("maxPages", "10"), 10);
const concurrency = parseInt(getFlag("concurrency", "3"), 10);
const rateLimitMs = parseInt(getFlag("rateLimitMs", "4000"), 10);
const summaryOnly = hasFlag("summaryOnly");
const dryRun = hasFlag("dryRun");

// -- Main ---------------------------------------------------------------------
async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "[bf-collector-cli] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const liveRunId = crypto.randomUUID();

  console.log(
    `[bf-collector-cli] Starting: maxPages=${maxPages}, concurrency=${concurrency}, ` +
      `rateLimitMs=${rateLimitMs}, summaryOnly=${summaryOnly}, dryRun=${dryRun}`
  );

  await clearStaleActiveRun("beforward", 10);
  await markScraperRunStarted({
    scraperName: "beforward",
    runId: liveRunId,
    startedAt: startedAtIso,
    runtime: "github_actions",
  });

  try {
    const result = await runCollector({
      maxPages,
      summaryOnly,
      concurrency,
      rateLimitMs,
      checkpointPath: "var/beforward_porsche_collector/checkpoint.json",
      outputPath: "var/beforward_porsche_collector/listings.jsonl",
      dryRun,
    });

    const durationMs = Date.now() - startTime;
    const isSuccess = result.counts.written > 0 || result.errors.length === 0;

    await recordScraperRun({
      scraper_name: "beforward",
      run_id: result.runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: isSuccess,
      runtime: "github_actions",
      duration_ms: durationMs,
      discovered: result.counts.discovered,
      written: result.counts.written,
      errors_count: result.counts.errors,
      details_fetched: result.counts.detailsFetched,
      normalized: result.counts.normalized,
      error_messages:
        result.errors.length > 0 ? result.errors.slice(0, 50) : undefined,
    });

    await clearScraperRunActive("beforward");

    const summary = {
      success: isSuccess,
      runId: result.runId,
      totalResults: result.totalResults,
      pageCount: result.pageCount,
      processedPages: result.processedPages,
      counts: result.counts,
      errors: result.errors.slice(0, 20),
      duration: `${durationMs}ms`,
    };

    console.log(
      `\n[bf-collector-cli] Done (${isSuccess ? "SUCCESS" : "FAILURE"}) — ` +
        `discovered=${result.counts.discovered}, written=${result.counts.written}, ` +
        `errors=${result.counts.errors}, duration=${durationMs}ms`
    );
    console.log(JSON.stringify(summary, null, 2));

    if (!isSuccess) {
      process.exit(1);
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg =
      error instanceof Error ? error.message : "Collector failed";

    console.error(`[bf-collector-cli] Fatal error: ${errorMsg}`);

    await recordScraperRun({
      scraper_name: "beforward",
      run_id: liveRunId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "github_actions",
      duration_ms: durationMs,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [errorMsg],
    });

    await clearScraperRunActive("beforward");
    process.exit(1);
  }
}

main();
