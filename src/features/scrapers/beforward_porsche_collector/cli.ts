import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

import { runBeForwardPorscheCollector } from "./collector";
import type { CollectorRunConfig } from "./types";

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

function usage(): string {
  return [
    "BeForward Porsche Collector CLI",
    "",
    "Retrieve all active Porsche listings (dry run):",
    "  npx tsx src/features/beforward_porsche_collector/cli.ts --dryRun --maxPages=200 --maxDetails=10000 --concurrency=6",
    "",
    "Persist to Supabase:",
    "  npx tsx src/features/beforward_porsche_collector/cli.ts --maxPages=200 --maxDetails=10000 --concurrency=6",
    "",
    "Common flags:",
    "  --startPage=1",
    "  --timeoutMs=20000",
    "  --rateLimitMs=2500",
    "  --summaryOnly",
    "  --fresh              Delete checkpoint before starting (full re-scrape)",
    "  --checkpointPath=var/beforward_porsche_collector/checkpoint.json",
    "  --outputPath=var/beforward_porsche_collector/listings.jsonl",
  ].join("\n");
}

async function main(): Promise<void> {
  bootstrapEnv();
  const args = parseArgv(process.argv.slice(2));
  if (hasFlag(args, "help") || hasFlag(args, "h")) {
    console.log(usage());
    return;
  }

  const config: CollectorRunConfig = {
    mode: "daily",
    make: "Porsche",
    maxPages: readNumber(args, "maxPages", 200),
    startPage: readNumber(args, "startPage", 1),
    maxDetails: readNumber(args, "maxDetails", 10000),
    summaryOnly: hasFlag(args, "summaryOnly"),
    concurrency: readNumber(args, "concurrency", 6),
    rateLimitMs: readNumber(args, "rateLimitMs", 2500),
    timeoutMs: readNumber(args, "timeoutMs", 20000),
    checkpointPath: readString(args, "checkpointPath") ?? "var/beforward_porsche_collector/checkpoint.json",
    outputPath: readString(args, "outputPath") ?? "var/beforward_porsche_collector/listings.jsonl",
    dryRun: hasFlag(args, "dryRun"),
  };

  if (hasFlag(args, "fresh") && existsSync(config.checkpointPath)) {
    unlinkSync(config.checkpointPath);
    console.log(`[beforward] Deleted checkpoint: ${config.checkpointPath}`);
  }

  const result = await runBeForwardPorscheCollector(config);
  console.log(JSON.stringify({
    event: "collector.result",
    runId: result.runId,
    totalResults: result.totalResults,
    pageCount: result.pageCount,
    processedPages: result.processedPages,
    counts: result.counts,
    outputPath: result.outputPath,
    errorCount: result.errors.length,
  }));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
