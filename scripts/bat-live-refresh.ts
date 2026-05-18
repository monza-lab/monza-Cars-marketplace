import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runPorscheBaTLiveRefreshFromEnv } from "../src/features/scrapers/porsche_collector/live_refresh";

const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv: string[]) {
  const opts = {
    limit: 60,
    timeBudgetMs: 8 * 60 * 1000,
    delayMs: 2500,
    dryRun: false,
  };

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eqIdx = arg.indexOf("=");
    if (eqIdx > 0) {
      const key = arg.slice(2, eqIdx);
      const value = arg.slice(eqIdx + 1);
      if (key === "limit") opts.limit = Number.parseInt(value, 10);
      if (key === "timeBudgetMs") opts.timeBudgetMs = Number.parseInt(value, 10);
      if (key === "delayMs") opts.delayMs = Number.parseInt(value, 10);
    } else if (arg === "--dryRun") {
      opts.dryRun = true;
    }
  }

  return opts;
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const result = await runPorscheBaTLiveRefreshFromEnv(config);
  console.log(JSON.stringify({ event: "bat_live_refresh.done", ...result }, null, 2));

  if (result.errors.length > 0 && result.checked === 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
