#!/usr/bin/env node

import path from "node:path";
import { runClassicComCollector } from "./collector";
import type { CollectorRunConfig } from "./types";

function usage(): string {
  return `
classic_collector — Scrape Porsche listings from classic.com (US market)

Usage:
  npx tsx src/features/classic_collector/cli.ts [options]

Options:
  --make=<string>              Make to search (default: Porsche)
  --location=<string>          Location filter (default: US)
  --status=<string>            Listing status (default: forsale)
  --maxPages=<number>          Max search pages to crawl (default: 10)
  --maxListings=<number>       Max listings to process (default: 500)
  --headed                     Show browser window (default: headless)
  --dryRun                     Skip DB writes, output to JSONL only
  --navigationDelayMs=<number> Delay between page navigations in ms (default: 3000)
  --pageTimeoutMs=<number>     Playwright page.goto timeout in ms (default: 30000)
  --proxyServer=<url>          Proxy server URL (or DECODO_PROXY_URL env)
  --proxyUsername=<string>     Proxy username (or DECODO_PROXY_USER env)
  --proxyPassword=<string>     Proxy password (or DECODO_PROXY_PASS env)
  --checkpointPath=<path>      Checkpoint file path
  --outputPath=<path>          JSONL output file path
  --help                       Show this help message

Examples:
  # Dry run, visible browser, 5 listings:
  npx tsx src/features/classic_collector/cli.ts --dryRun --headed --maxListings=5

  # Production run with defaults:
  npx tsx src/features/classic_collector/cli.ts --maxPages=20

  # With proxy:
  npx tsx src/features/classic_collector/cli.ts --proxyServer=http://gate.smartproxy.com:7000
`.trim();
}

function parseArgv(args: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const arg of args) {
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx > 0) {
        map.set(arg.slice(2, eqIdx), arg.slice(eqIdx + 1));
      } else {
        map.set(arg.slice(2), "true");
      }
    }
  }
  return map;
}

function readString(map: Map<string, string>, key: string): string | undefined {
  return map.get(key);
}

function readNumber(map: Map<string, string>, key: string, fallback: number): number {
  const v = map.get(key);
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

function hasFlag(map: Map<string, string>, key: string): boolean {
  return map.get(key) === "true" || map.has(key);
}

function bootstrapEnv(): void {
  // Load .env.local if available (for Supabase keys, proxy credentials)
  try {
    const dotenvPath = path.resolve(process.cwd(), ".env.local");
    const fs = require("node:fs");
    const content = fs.readFileSync(dotenvPath, "utf8") as string;
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local not found, rely on existing env vars
  }
}

async function main(): Promise<void> {
  bootstrapEnv();
  const args = parseArgv(process.argv.slice(2));

  if (hasFlag(args, "help")) {
    console.log(usage());
    return;
  }

  const config: CollectorRunConfig = {
    mode: "daily",
    make: readString(args, "make") ?? "Porsche",
    location: readString(args, "location") ?? "US",
    status: readString(args, "status") ?? "forsale",
    maxPages: readNumber(args, "maxPages", 10),
    maxListings: readNumber(args, "maxListings", 500),
    headless: !hasFlag(args, "headed"),
    proxyServer: readString(args, "proxyServer") ?? process.env.DECODO_PROXY_URL,
    proxyUsername: readString(args, "proxyUsername") ?? process.env.DECODO_PROXY_USER,
    proxyPassword: readString(args, "proxyPassword") ?? process.env.DECODO_PROXY_PASS,
    navigationDelayMs: readNumber(args, "navigationDelayMs", 3000),
    pageTimeoutMs: readNumber(args, "pageTimeoutMs", 30000),
    checkpointPath: readString(args, "checkpointPath") ?? "var/classic_collector/checkpoint.json",
    outputPath: readString(args, "outputPath") ?? "var/classic_collector/listings.jsonl",
    dryRun: hasFlag(args, "dryRun"),
    summaryOnly: hasFlag(args, "summaryOnly"),
  };

  console.log(`[classic_collector] Starting with config:`, {
    ...config,
    proxyPassword: config.proxyPassword ? "***" : undefined,
  });

  const result = await runClassicComCollector(config);

  console.log(`\n[classic_collector] Done.`);
  console.log(`  Run ID:     ${result.runId}`);
  console.log(`  Discovered: ${result.counts.discovered}`);
  console.log(`  Details:    ${result.counts.detailsFetched}`);
  console.log(`  Normalized: ${result.counts.normalized}`);
  console.log(`  Written:    ${result.counts.written}`);
  console.log(`  Errors:     ${result.counts.errors}`);
  console.log(`  CF Blocked: ${result.counts.cloudflareBlocked}`);
  console.log(`  Output:     ${result.outputPath}`);

  if (result.errors.length > 0) {
    console.error(`\n[classic_collector] Errors:`);
    for (const err of result.errors.slice(0, 10)) {
      console.error(`  - ${err}`);
    }
    if (result.errors.length > 10) {
      console.error(`  ... and ${result.errors.length - 10} more`);
    }
  }
}

main().catch((err) => {
  console.error("[classic_collector] Fatal error:", err);
  process.exit(1);
});
