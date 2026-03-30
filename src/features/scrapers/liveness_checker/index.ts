import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CHROME_UA,
  SOURCE_CONFIGS,
  CIRCUIT_BREAK_THRESHOLD,
  DEFAULT_TIME_BUDGET_MS,
  REQUEST_TIMEOUT_MS,
} from "./sourceConfig";

export interface LivenessResult {
  source: string;
  checked: number;
  alive: number;
  dead: number;
  errors: string[];
  circuitBroken: boolean;
}

export interface LivenessRunResult {
  results: LivenessResult[];
  totalChecked: number;
  totalDead: number;
  totalAlive: number;
  durationMs: number;
}

interface CheckSourceOpts {
  source: string;
  delayMs: number;
  maxPerRun: number;
  timeBudgetMs: number;
  dryRun: boolean;
  delayOverrideMs?: number;
}

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    // In production this is a fatal misconfiguration; in tests createClient is
    // mocked so the empty strings are never used for a real network call.
    if (process.env.NODE_ENV !== "test") {
      throw new Error("Missing Supabase env vars");
    }
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Check a single source's listings for liveness.
 */
export async function checkSource(opts: CheckSourceOpts): Promise<LivenessResult> {
  const client = getClient();
  const startTime = Date.now();
  const result: LivenessResult = {
    source: opts.source,
    checked: 0,
    alive: 0,
    dead: 0,
    errors: [],
    circuitBroken: false,
  };

  const { data: listings, error: queryErr } = await client
    .from("listings")
    .select("id, source, source_url")
    .eq("source", opts.source)
    .eq("status", "active")
    .not("source_url", "is", null)
    .order("last_verified_at", { ascending: true, nullsFirst: true })
    .limit(opts.maxPerRun);

  if (queryErr) {
    result.errors.push(`Query failed: ${queryErr.message}`);
    return result;
  }
  if (!listings || listings.length === 0) return result;

  let consecutiveBlocks = 0;

  for (const listing of listings) {
    if (Date.now() - startTime >= opts.timeBudgetMs) {
      console.log(`[liveness] ${opts.source}: time budget reached after ${result.checked} checks`);
      break;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(listing.source_url, {
        method: "GET",
        headers: { "User-Agent": CHROME_UA },
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      result.checked++;

      if (response.status === 404 || response.status === 410) {
        result.dead++;
        consecutiveBlocks = 0;
        if (!opts.dryRun) {
          const { error: updateErr } = await client
            .from("listings")
            .update({
              status: "unsold",
              last_verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", listing.id);
          if (updateErr) {
            result.errors.push(`Update failed for ${listing.id}: ${updateErr.message}`);
          }
        }
        console.log(`[liveness] ${opts.source}: DEAD ${listing.source_url}`);
      } else if (response.status === 403 || response.status === 429 || response.status === 503) {
        // Treat blocks as "alive but unreachable" — the URL exists, the server
        // is responding, it just blocks automated requests.  Update
        // last_verified_at so these listings don't stay permanently stale.
        result.alive++;
        consecutiveBlocks++;
        if (!opts.dryRun) {
          await client
            .from("listings")
            .update({ last_verified_at: new Date().toISOString() })
            .eq("id", listing.id);
        }
        if (consecutiveBlocks >= CIRCUIT_BREAK_THRESHOLD) {
          result.circuitBroken = true;
          result.errors.push(`Circuit break: ${CIRCUIT_BREAK_THRESHOLD} consecutive ${response.status}s`);
          console.log(`[liveness] ${opts.source}: CIRCUIT BREAK after ${consecutiveBlocks} blocks`);
          break;
        }
      } else if (response.ok) {
        result.alive++;
        consecutiveBlocks = 0;
        if (!opts.dryRun) {
          const { error: updateErr } = await client
            .from("listings")
            .update({ last_verified_at: new Date().toISOString() })
            .eq("id", listing.id);
          if (updateErr) {
            result.errors.push(`Update failed for ${listing.id}: ${updateErr.message}`);
          }
        }
      } else {
        consecutiveBlocks = 0;
        result.errors.push(`Unexpected ${response.status} on ${listing.source_url}`);
      }
    } catch (err) {
      result.checked++;
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Fetch error (${listing.source_url}): ${msg}`);
      consecutiveBlocks = 0;
    }

    const delay = opts.delayOverrideMs ?? opts.delayMs;
    if (delay > 0) await sleep(delay);
  }

  return result;
}

/**
 * Run the full liveness check across all configured sources in parallel.
 */
export async function runLivenessCheck(opts: {
  maxListings?: number;
  source?: string;
  delayOverrideMs?: number;
  timeBudgetMs?: number;
  dryRun?: boolean;
}): Promise<LivenessRunResult> {
  const startTime = Date.now();
  const timeBudget = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const dryRun = opts.dryRun ?? false;

  const configs = opts.source
    ? SOURCE_CONFIGS.filter((c) => c.source === opts.source)
    : SOURCE_CONFIGS;

  if (configs.length === 0) {
    throw new Error(`Unknown source: ${opts.source}. Valid: ${SOURCE_CONFIGS.map((c) => c.source).join(", ")}`);
  }

  const promises = configs.map((config) =>
    checkSource({
      source: config.source,
      delayMs: config.delayMs,
      maxPerRun: opts.maxListings
        ? Math.ceil(opts.maxListings / configs.length)
        : config.maxPerRun,
      timeBudgetMs: timeBudget,
      dryRun,
      delayOverrideMs: opts.delayOverrideMs,
    })
  );

  const settled = await Promise.allSettled(promises);
  const results: LivenessResult[] = [];

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === "fulfilled") {
      results.push(s.value);
    } else {
      results.push({
        source: configs[i].source,
        checked: 0,
        alive: 0,
        dead: 0,
        errors: [s.reason?.message ?? String(s.reason)],
        circuitBroken: false,
      });
    }
  }

  return {
    results,
    totalChecked: results.reduce((s, r) => s + r.checked, 0),
    totalDead: results.reduce((s, r) => s + r.dead, 0),
    totalAlive: results.reduce((s, r) => s + r.alive, 0),
    durationMs: Date.now() - startTime,
  };
}
