import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import crypto from "node:crypto";

import { runCollector } from "./collector";
import {
  clearScraperRunActive,
  clearStaleActiveRun,
  markScraperRunStarted,
  recordScraperRun,
  type RuntimeEnv,
} from "../common/monitoring";

function loadEnvFromFile(relPath: string): void {
  const abs = resolvePath(process.cwd(), relPath);
  if (!existsSync(abs)) return;
  const raw = readFileSync(abs, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function bootstrapEnv(): void {
  loadEnvFromFile(".env.local");
  loadEnvFromFile(".env");
}

function parseArgv(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const trimmed = raw.slice(2);
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      out[trimmed] = true;
      continue;
    }
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

function readString(args: Record<string, string | boolean>, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" ? v : undefined;
}

function readNumber(args: Record<string, string | boolean>, key: string, fallback: number): number {
  const value = readString(args, key);
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function hasFlag(args: Record<string, string | boolean>, key: string): boolean {
  return args[key] === true;
}

function getRuntime(): RuntimeEnv {
  if (process.env.MONZA_WINDOWS_TASK === "1") return "windows_task";
  if (process.env.GITHUB_ACTIONS === "true") return "github_actions";
  return "cli";
}

function summarizeCounts(sourceCounts: Awaited<ReturnType<typeof runCollector>>["sourceCounts"]): {
  discovered: number;
  written: number;
  errors: number;
  sourceCounts: Record<string, { discovered: number; written: number }>;
} {
  let discovered = 0;
  let written = 0;
  let errors = 0;
  const summary: Record<string, { discovered: number; written: number }> = {};

  for (const [source, counts] of Object.entries(sourceCounts)) {
    discovered += counts.discovered;
    written += counts.written;
    errors += counts.errored;
    summary[source] = {
      discovered: counts.discovered,
      written: counts.written,
    };
  }

  return { discovered, written, errors, sourceCounts: summary };
}

async function main(): Promise<void> {
  bootstrapEnv();
  const args = parseArgv(process.argv.slice(2));
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();
  const liveRunId = crypto.randomUUID();
  const runtime = getRuntime();

  const checkpointPath = readString(args, "checkpointPath") ?? "var/autotrader_collector/checkpoint.json";

  if (hasFlag(args, "fresh") && existsSync(checkpointPath)) {
    unlinkSync(checkpointPath);
    console.log(`[autotrader] Deleted checkpoint: ${checkpointPath}`);
  }

  await clearStaleActiveRun("autotrader", 120);
  await markScraperRunStarted({
    scraperName: "autotrader",
    runId: liveRunId,
    startedAt: startedAtIso,
    runtime,
  });

  try {
    const result = await runCollector({
      mode: (readString(args, "mode") as "daily" | "backfill") ?? "daily",
      make: readString(args, "make") ?? "Porsche",
      model: readString(args, "model"),
      postcode: readString(args, "postcode") ?? "SW1A 1AA",
      maxActivePagesPerSource: readNumber(args, "maxPages", 5),
      scrapeDetails: !hasFlag(args, "noDetails"),
      checkpointPath,
      dryRun: hasFlag(args, "dryRun"),
    });

    const totals = summarizeCounts(result.sourceCounts);
    const zeroOutput = !hasFlag(args, "dryRun") && totals.discovered === 0;
    const errorMessages = zeroOutput
      ? [...result.errors, "Zero output: AutoTrader discovered no listings"]
      : result.errors;

    await recordScraperRun({
      scraper_name: "autotrader",
      run_id: result.runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: result.errors.length === 0 && !zeroOutput,
      runtime,
      duration_ms: Date.now() - startedAt.getTime(),
      discovered: totals.discovered,
      written: totals.written,
      errors_count: totals.errors + errorMessages.length,
      source_counts: totals.sourceCounts,
      error_messages: errorMessages.length > 0 ? errorMessages : undefined,
    });

    console.log(JSON.stringify({
      event: "collector.result",
      runId: result.runId,
      discovered: totals.discovered,
      written: totals.written,
      sourceCounts: result.sourceCounts,
      errorCount: errorMessages.length,
      runtime,
    }));

    if (zeroOutput || result.errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordScraperRun({
      scraper_name: "autotrader",
      run_id: liveRunId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime,
      duration_ms: Date.now() - startedAt.getTime(),
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [message],
    });
    throw err;
  } finally {
    await clearScraperRunActive("autotrader");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
