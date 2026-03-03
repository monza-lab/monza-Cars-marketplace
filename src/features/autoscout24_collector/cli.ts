import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

import { runAutoScout24Collector } from "./collector";
import type { CollectorRunConfig, AS24CountryCode } from "./types";

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

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        args.set(arg.slice(2, eq), arg.slice(eq + 1));
      } else {
        args.set(arg.slice(2), "true");
      }
    }
  }
  return args;
}

function hasFlag(args: Map<string, string>, key: string): boolean {
  return args.get(key)?.toLowerCase() === "true" || args.has(key);
}

function readNumber(args: Map<string, string>, key: string, fallback: number): number {
  const raw = args.get(key);
  if (!raw) return fallback;
  const num = parseInt(raw, 10);
  return isNaN(num) ? fallback : num;
}

function readString(args: Map<string, string>, key: string): string | undefined {
  return args.get(key);
}

const VALID_COUNTRIES = new Set<AS24CountryCode>(["D", "A", "B", "E", "F", "I", "L", "NL"]);

function parseCountries(raw: string | undefined): AS24CountryCode[] {
  if (!raw) return ["D", "A", "B", "E", "F", "I", "L", "NL"];
  return raw.split(",").map((c) => c.trim().toUpperCase()).filter((c) => VALID_COUNTRIES.has(c as AS24CountryCode)) as AS24CountryCode[];
}

async function main(): Promise<void> {
  loadEnvFromFile(".env.local");
  loadEnvFromFile(".env");

  const args = parseArgs(process.argv.slice(2));

  if (hasFlag(args, "help")) {
    console.log(`
AutoScout24 Collector CLI

Usage:
  npx tsx src/features/autoscout24_collector/cli.ts [options]

Options:
  --make=Porsche             Target make (default: Porsche)
  --countries=D,A,I          Comma-separated country codes (default: all 8)
  --maxPagesPerShard=20      Max pages per search shard (default: 20)
  --maxListings=50000        Max listings to process (default: 50000)
  --navigationDelayMs=3000   Delay between page navigations (default: 3000)
  --pageTimeoutMs=30000      Page load timeout (default: 30000)
  --scrapeDetails            Fetch individual listing pages for enriched data
  --headed                   Run browser in headed mode (visible)
  --dryRun                   Skip DB writes
  --checkpointPath=...       Path to checkpoint file
  --outputPath=...           Path to JSONL output file
  --help                     Show this help
`);
    process.exit(0);
  }

  const countries = parseCountries(readString(args, "countries"));

  const config: CollectorRunConfig = {
    mode: "daily",
    make: readString(args, "make") ?? "Porsche",
    countries,
    maxPagesPerShard: readNumber(args, "maxPagesPerShard", 20),
    maxListings: readNumber(args, "maxListings", 50000),
    headless: !hasFlag(args, "headed"),
    proxyServer: process.env.DECODO_PROXY_URL,
    proxyUsername: process.env.DECODO_PROXY_USER,
    proxyPassword: process.env.DECODO_PROXY_PASS,
    navigationDelayMs: readNumber(args, "navigationDelayMs", 3000),
    pageTimeoutMs: readNumber(args, "pageTimeoutMs", 30000),
    scrapeDetails: hasFlag(args, "scrapeDetails"),
    checkpointPath: readString(args, "checkpointPath") ?? "var/autoscout24_collector/checkpoint.json",
    outputPath: readString(args, "outputPath") ?? "var/autoscout24_collector/listings.jsonl",
    dryRun: hasFlag(args, "dryRun"),
  };

  console.log(`\n[AutoScout24 Collector] Starting...`);
  console.log(`  Make: ${config.make}`);
  console.log(`  Countries: ${countries.join(", ")}`);
  console.log(`  Max listings: ${config.maxListings}`);
  console.log(`  Max pages/shard: ${config.maxPagesPerShard}`);
  console.log(`  Scrape details: ${config.scrapeDetails}`);
  console.log(`  Dry run: ${config.dryRun}`);
  console.log(`  Headed: ${!config.headless}`);
  console.log(`  Proxy: ${config.proxyServer ? "configured" : "none"}`);
  console.log();

  const result = await runAutoScout24Collector(config);

  console.log(`\n[AutoScout24 Collector] Done.`);
  console.log(JSON.stringify({
    event: "collector.result",
    runId: result.runId,
    shardsCompleted: result.shardsCompleted,
    shardsTotal: result.shardsTotal,
    counts: result.counts,
    errorsCount: result.errors.length,
    outputPath: result.outputPath,
  }, null, 2));

  if (result.errors.length > 0) {
    console.error(`\n[Errors] (${result.errors.length}):`);
    for (const err of result.errors.slice(0, 20)) {
      console.error(`  - ${err}`);
    }
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[AutoScout24 Collector] Fatal error:", err);
  process.exit(1);
});
