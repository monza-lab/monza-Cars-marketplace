import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

import { runCollector } from "./collector";

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

async function main(): Promise<void> {
  bootstrapEnv();
  const args = parseArgv(process.argv.slice(2));

  const checkpointPath = readString(args, "checkpointPath") ?? "var/autotrader_collector/checkpoint.json";

  if (hasFlag(args, "fresh") && existsSync(checkpointPath)) {
    unlinkSync(checkpointPath);
    console.log(`[autotrader] Deleted checkpoint: ${checkpointPath}`);
  }

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

  const totalDiscovered = Object.values(result.sourceCounts).reduce((s, c) => s + c.discovered, 0);
  const totalWritten = Object.values(result.sourceCounts).reduce((s, c) => s + c.written, 0);

  console.log(JSON.stringify({
    event: "collector.result",
    runId: result.runId,
    discovered: totalDiscovered,
    written: totalWritten,
    sourceCounts: result.sourceCounts,
    errorCount: result.errors.length,
  }));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
