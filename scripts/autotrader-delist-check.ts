/**
 * CLI: Check ALL active AutoTrader listings against the product-page API.
 * Delists any that return 404 (genuinely removed from AutoTrader).
 *
 * This catches stale listings that the enrichment script misses because
 * they already have complete data (photos_count >= 5, all fields filled)
 * but whose CDN images now redirect to tiny placeholders.
 *
 * Usage:
 *   npx tsx scripts/autotrader-delist-check.ts
 *   npx tsx scripts/autotrader-delist-check.ts --limit=500 --delayMs=1000
 *   npx tsx scripts/autotrader-delist-check.ts --dryRun
 */
import { readFileSync, existsSync } from "fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

// CLI args
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    limit: 0,
    delayMs: 500,
    dryRun: false,
  };
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eqIdx = arg.indexOf("=");
    if (eqIdx > 0) {
      const key = arg.slice(2, eqIdx);
      const val = arg.slice(eqIdx + 1);
      if (key === "limit") opts.limit = parseInt(val, 10);
      if (key === "delayMs") opts.delayMs = parseInt(val, 10);
    } else {
      const key = arg.slice(2);
      if (key === "dryRun") opts.dryRun = true;
    }
  }
  return opts;
}

function extractAdvertId(url: string): string | null {
  const match = url.match(/\/car-details\/(\d+)(?:[/?#]|$)/i);
  return match?.[1] ?? null;
}

export type AutoTraderListingResponse = "live" | "delisted" | "rate-limited" | "error";

export function classifyAutoTraderListingResponse(
  status: number,
  location: string | null,
): AutoTraderListingResponse {
  if (status === 200) return "live";
  if (status === 403 || status === 429) return "rate-limited";
  if (
    status >= 300 &&
    status < 400 &&
    location !== null &&
    /(?:[?&])expired-ad=true(?:&|$)/i.test(location)
  ) {
    return "delisted";
  }
  return "error";
}

export type DelistBatchDecisionInput = {
  checked: number;
  live: number;
  delisted: number;
  errors: number;
  sourceActiveBefore: number;
};

export type DelistBatchDecision =
  | { apply: true; reason: "normal" }
  | { apply: false; reason: "mass-delist-guard" };

export function shouldApplyDelistBatch(input: DelistBatchDecisionInput): DelistBatchDecision {
  const delistedRatio = input.checked > 0 ? input.delisted / input.checked : 0;
  if (
    input.sourceActiveBefore > 0 &&
    input.checked >= 50 &&
    input.live === 0 &&
    input.delisted > 0 &&
    delistedRatio >= 0.9
  ) {
    return { apply: false, reason: "mass-delist-guard" };
  }
  return { apply: true, reason: "normal" };
}

// Main
async function main() {
  const opts = parseArgs();
  const startTime = Date.now();

  console.log(`\n=== AutoTrader Delist Check ===`);
  console.log(`Limit: ${opts.limit || "ALL"}, Delay: ${opts.delayMs}ms, Dry run: ${opts.dryRun}\n`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let allListings: { id: string; source_url: string; title: string | null }[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("listings")
      .select("id, source_url, title")
      .eq("source", "AutoTrader")
      .eq("status", "active")
      .order("updated_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Query error:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allListings = allListings.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const listings = opts.limit > 0 ? allListings.slice(0, opts.limit) : allListings;
  console.log(`Found ${allListings.length} active AutoTrader listings (checking ${listings.length})\n`);

  if (listings.length === 0) {
    console.log("Nothing to check.");
    return;
  }

  let live = 0;
  let delistedCandidates = 0;
  let delistedApplied = 0;
  let errors = 0;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 15;
  const delistIds: string[] = [];

  for (let i = 0; i < listings.length; i++) {
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.log(`\nCircuit-break: ${consecutiveErrors} consecutive errors. Stopping.`);
      break;
    }

    const listing = listings[i];
    const advertId = extractAdvertId(listing.source_url);
    if (!advertId) {
      errors++;
      continue;
    }

    try {
      const resp = await fetch(listing.source_url, {
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(10_000),
      });

      const classification = classifyAutoTraderListingResponse(
        resp.status,
        resp.headers.get("location"),
      );
      if (classification === "live") {
        live++;
        consecutiveErrors = 0;
      } else if (classification === "delisted") {
        consecutiveErrors = 0;
        delistedCandidates++;
        delistIds.push(listing.id);
        if (opts.dryRun) {
          console.log(`  [DRY] DELIST: ${listing.title?.slice(0, 50)} - ${listing.source_url}`);
        }
      } else if (classification === "rate-limited") {
        console.log(`\nRate-limited (${resp.status}). Stopping.`);
        break;
      } else {
        errors++;
        consecutiveErrors++;
      }
    } catch (err: unknown) {
      errors++;
      consecutiveErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      if (/\b(403|429)\b/.test(msg) || /cloudflare/i.test(msg)) {
        console.log(`\nBlocked: ${msg}. Stopping.`);
        break;
      }
    }

    if ((i + 1) % 50 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`  Progress: ${i + 1}/${listings.length} - live=${live}, delistCandidates=${delistedCandidates}, errors=${errors} (${elapsed}s)`);
    }

    if (i < listings.length - 1) {
      await new Promise((r) => setTimeout(r, opts.delayMs));
    }
  }

  const checked = live + delistedCandidates + errors;
  const decision = shouldApplyDelistBatch({
    checked,
    live,
    delisted: delistedCandidates,
    errors,
    sourceActiveBefore: allListings.length,
  });

  if (!opts.dryRun && decision.apply) {
    for (const id of delistIds) {
      const { error: delistErr } = await supabase
        .from("listings")
        .update({ status: "delisted", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (!delistErr) {
        delistedApplied++;
      } else {
        errors++;
      }
    }
  } else if (!opts.dryRun && !decision.apply) {
    await supabase.from("scraper_runs").insert({
      scraper_name: "autotrader-delist-check",
      run_id: randomUUID(),
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "cli",
      duration_ms: Date.now() - startTime,
      discovered: checked,
      written: 0,
      errors_count: 1,
      error_messages: [
        `mass-delist-guard: checked=${checked} live=${live} delistCandidates=${delistedCandidates} activeBefore=${allListings.length}`,
      ],
    });
    console.log(`\nMass-delist guard blocked ${delistedCandidates} AutoTrader status updates.`);
  } else {
    delistedApplied = delistedCandidates;
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n=== Summary ===`);
  console.log(`Checked: ${checked}, Live: ${live}, Delist candidates: ${delistedCandidates}, Delisted: ${delistedApplied}, Errors: ${errors}, Decision: ${decision.reason}, Duration: ${elapsed}s`);
}

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false;

if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
