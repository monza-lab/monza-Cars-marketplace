import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { runLivenessCheck } from "./index";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function parseArgv(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const trimmed = raw.slice(2);
    const eq = trimmed.indexOf("=");
    if (eq === -1) { out[trimmed] = true; continue; }
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

loadEnvFromFile(".env.local");
loadEnvFromFile(".env");

const args = parseArgv(process.argv.slice(2));

if (args.help) {
  console.log(`
Liveness Checker — verify source URLs of active dealer/classified listings.

Usage:
  npx tsx src/features/scrapers/liveness_checker/cli.ts [flags]

Flags:
  --maxListings=N     Max total listings to check (default: 6000)
  --source=NAME       Check only one source (AutoScout24, Elferspot, AutoTrader, BeForward, ClassicCom)
  --delayMs=N         Override per-source delay (ms)
  --timeBudgetMs=N    Time budget in ms (default: 3300000 = 55 min)
  --dryRun            Skip DB writes
  --help              Show this help
`);
  process.exit(0);
}

async function main() {
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const runId = crypto.randomUUID();

  console.log(`[liveness] Starting run ${runId}`);
  const maxListings = Number(args.maxListings) || 6000;
  const timeBudgetMs = Number(args.timeBudgetMs) || 3_300_000;
  const source = typeof args.source === "string" ? args.source : undefined;
  const dryRun = args.dryRun === true;
  const delayMs = args.delayMs ? Number(args.delayMs) : undefined;

  console.log(`[liveness] maxListings=${maxListings} source=${source || "all"} dryRun=${dryRun}`);

  await markScraperRunStarted({
    scraperName: "liveness-check",
    runId,
    startedAt: startedAtIso,
    runtime: "cli",
  });

  try {
    const result = await runLivenessCheck({
      maxListings,
      source,
      delayOverrideMs: delayMs,
      timeBudgetMs,
      dryRun,
    });

    // Print summary
    console.log(`\n[liveness] ── Run complete ──`);
    console.log(`[liveness] Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
    console.log(`[liveness] Checked: ${result.totalChecked} | Alive: ${result.totalAlive} | Dead: ${result.totalDead}`);
    for (const r of result.results) {
      console.log(`[liveness]   ${r.source}: checked=${r.checked} alive=${r.alive} dead=${r.dead}${r.circuitBroken ? " CIRCUIT-BROKEN" : ""}`);
      if (r.errors.length > 0) {
        console.log(`[liveness]     errors: ${r.errors.slice(0, 5).join("; ")}${r.errors.length > 5 ? ` (+${r.errors.length - 5} more)` : ""}`);
      }
    }

    // Build source_counts for monitoring
    const sourceCounts: Record<string, { discovered: number; written: number }> = {};
    for (const r of result.results) {
      sourceCounts[r.source] = { discovered: r.checked, written: r.dead };
    }

    const allErrors = result.results.flatMap((r) => r.errors);

    await recordScraperRun({
      scraper_name: "liveness-check",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "cli",
      duration_ms: Date.now() - startTime,
      discovered: result.totalChecked,
      written: result.totalDead,
      errors_count: allErrors.length,
      refresh_checked: result.totalAlive,
      source_counts: sourceCounts,
      error_messages: allErrors.length > 0 ? allErrors.slice(0, 50) : undefined,
    });

    await clearScraperRunActive("liveness-check");
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[liveness] Fatal error: ${msg}`);

    await recordScraperRun({
      scraper_name: "liveness-check",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "cli",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [msg],
    });

    await clearScraperRunActive("liveness-check");
    process.exit(1);
  }
}

main();
