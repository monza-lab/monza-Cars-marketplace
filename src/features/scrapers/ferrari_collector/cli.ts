import { runFerrariCollector } from "./collector";
import { DEFAULT_FERRARI_MAKE, type CollectorRunConfig, type CollectorMode, type SourceKey } from "./types";

import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

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
    if (!key) continue;
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    // Strip simple quotes: KEY="..." or KEY='...'
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function bootstrapEnv(): void {
  // Collector CLI is often run outside `next dev`, so `.env.local` won't auto-load.
  // Only fill missing values; never override explicit process env.
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
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    out[key] = value;
  }
  return out;
}

function readString(args: Record<string, string | boolean>, key: string): string | undefined {
  const v = args[key];
  if (typeof v === "string") return v;
  return undefined;
}

function readNumber(args: Record<string, string | boolean>, key: string, fallback: number): number {
  const s = readString(args, key);
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function hasFlag(args: Record<string, string | boolean>, key: string): boolean {
  return args[key] === true;
}

export function readNonNegativeNumber(
  args: Record<string, string | boolean>,
  key: string,
  fallback: number,
): number {
  const s = readString(args, key);
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function readSources(args: Record<string, string | boolean>): SourceKey[] | undefined {
  const raw = readString(args, "sources");
  if (!raw) return undefined;
  const allowed = new Set<SourceKey>(["BaT", "CarsAndBids", "CollectingCars"]);
  const sources = raw.split(",").map((value) => value.trim()).filter(Boolean);
  for (const source of sources) {
    if (!allowed.has(source as SourceKey)) {
      throw new Error(`Invalid --sources value: ${source}`);
    }
  }
  return sources as SourceKey[];
}

function usage(): string {
  return [
    "Ferrari Collector CLI",
    "",
    "Run (daily):",
    "  npx tsx src/features/ferrari_collector/cli.ts --mode=daily",
    "",
    "Run (backfill):",
    "  npx tsx src/features/ferrari_collector/cli.ts --mode=backfill --dateFrom=2026-01-01 --dateTo=2026-01-07",
    "",
    "Common flags:",
    "  --make=Porsche|Ferrari",
    "  --endedWindowDays=90",
    "  --maxActivePages=10",
    "  --maxEndedPages=10",
    "  --sources=BaT,CarsAndBids,CollectingCars",
    "  --checkpointPath=var/ferrari_collector/checkpoint.json",
    "  --timeBudgetMs=1500000",
    "  --dryRun",
    "  --noDetails",
  ].join("\n");
}

async function main(): Promise<void> {
  bootstrapEnv();
  const args = parseArgv(process.argv.slice(2));
  if (hasFlag(args, "help") || hasFlag(args, "h")) {
    console.log(usage());
    return;
  }

  const mode = (readString(args, "mode") ?? "daily") as CollectorMode;
  if (mode !== "daily" && mode !== "backfill") {
    throw new Error(`Invalid --mode. Expected daily|backfill, got: ${mode}`);
  }

  const config: CollectorRunConfig = {
    mode,
    make: readString(args, "make") ?? DEFAULT_FERRARI_MAKE,
    endedWindowDays: readNumber(args, "endedWindowDays", 90),
    dateFrom: readString(args, "dateFrom"),
    dateTo: readString(args, "dateTo"),
    maxActivePagesPerSource: readNumber(args, "maxActivePages", 10),
    maxEndedPagesPerSource: readNonNegativeNumber(args, "maxEndedPages", 10),
    scrapeDetails: !hasFlag(args, "noDetails"),
    checkpointPath: readString(args, "checkpointPath") ?? "var/ferrari_collector/checkpoint.json",
    dryRun: hasFlag(args, "dryRun"),
    sources: readSources(args),
    timeBudgetMs: readNumber(args, "timeBudgetMs", 25 * 60 * 1000), // 25 min default
  };

  await runFerrariCollector(config);
}

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolvePath(process.argv[1])
  : false;

if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exitCode = 1;
  });
}
