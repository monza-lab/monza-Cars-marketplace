import { runPorscheCollector } from "./collector";
import type { CollectorRunConfig, CollectorMode } from "./types";

import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

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

function usage(): string {
  return [
    "Luxury Collector CLI (Porsche-first)",
    "",
    "Run (daily):",
    "  npx tsx src/features/porsche_collector/cli.ts --mode=daily",
    "",
    "Run (backfill):",
    "  npx tsx src/features/porsche_collector/cli.ts --mode=backfill --dateFrom=2026-01-01 --dateTo=2026-01-07",
    "",
    "Common flags:",
    "  --make=Porsche",
    "  --endedWindowDays=90",
    "  --maxActivePages=10",
    "  --maxEndedPages=10",
    "  --checkpointPath=var/porsche_collector/checkpoint.json",
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
    make: readString(args, "make") ?? "Porsche",
    endedWindowDays: readNumber(args, "endedWindowDays", 90),
    dateFrom: readString(args, "dateFrom"),
    dateTo: readString(args, "dateTo"),
    maxActivePagesPerSource: readNumber(args, "maxActivePages", 10),
    maxEndedPagesPerSource: readNumber(args, "maxEndedPages", 10),
    scrapeDetails: !hasFlag(args, "noDetails"),
    checkpointPath: readString(args, "checkpointPath") ?? "var/porsche_collector/checkpoint.json",
    dryRun: hasFlag(args, "dryRun"),
  };

  await runPorscheCollector(config);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
