/**
 * CLI: BeForward detail-field enrichment via Scrapling (AWS WAF bypass).
 *
 * Replaces the Vercel cron /api/cron/enrich-beforward, which could never work:
 * beforward.jp sits behind AWS WAF and Scrapling is disabled on Vercel
 * (canUseScrapling() returns false when process.env.VERCEL is set), so the
 * route's plain fetch only ever received the WAF challenge page (no
 * `table.specification`). It therefore wrote 0 fields, recorded 0 errors, and
 * worse, stamped `trim=""` as a poison-pill that permanently excluded the row
 * from re-enrichment. This CLI runs in GitHub Actions where Scrapling works.
 *
 * Drains active BeForward listings missing any target field (trim, engine,
 * transmission, color_exterior) and backfills them from the real detail page.
 * Plain fetch first; on a block-streak it escalates to Scrapling http, then to
 * Scrapling dynamic browser — the same ladder as bf-bulk-backfill-images.ts.
 *
 * Run locally:
 *   SCRAPLING_PYTHON=python npx tsx scripts/bf-enrich-cli.ts --limit=5 --dry-run
 * In GitHub Actions:
 *   SCRAPLING_PYTHON=$(which python3) npx tsx scripts/bf-enrich-cli.ts --scrapling
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required)
 *   SCRAPLING_PYTHON (default /tmp/bf-scrapling-env/bin/python)
 *
 * Flags:
 *   --concurrency=<N>   Parallel workers (default 3)
 *   --rate-ms=<N>       Min ms between requests per domain (default 4000)
 *   --timeout-ms=<N>    Per-request timeout (default 20000)
 *   --limit=<N>         Cap listings processed (default 400)
 *   --dry-run           No DB writes
 *   --scrapling         Use StealthyFetcher from the start (skip plain fetch)
 */

import * as fs from "fs";
import * as path from "path";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { parseDetailHtml } from "../src/features/scrapers/beforward_porsche_collector/detail";
import { buildMissingAnyFilter } from "../src/features/scrapers/common/enrichmentLoopPolicy";
import { classifyVehicleIdentifier, type VehicleIdentifier } from "../src/features/scrapers/common/vehicleIdentifier";
import {
  recordScraperRun,
  markScraperRunStarted,
  clearScraperRunActive,
  clearStaleActiveRun,
} from "../src/features/scrapers/common/monitoring";

// -- env (supports .env.local locally; CI injects via process.env) ------------
for (const envFile of [".env.local", ".env"]) {
  try {
    const envPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* ignore — CI injects via env */
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const SCRAPLING_PY = process.env.SCRAPLING_PYTHON ?? "/tmp/bf-scrapling-env/bin/python";

// -- flags --------------------------------------------------------------------
const flag = (n: string, d?: string) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=") ?? d;
const boolFlag = (n: string) => process.argv.includes(`--${n}`);

const CONCURRENCY = Number(flag("concurrency", "2"));
const RATE_MS = Number(flag("rate-ms", "4000"));
const TIMEOUT_MS = Number(flag("timeout-ms", "20000"));
const LIMIT = flag("limit") ? Number(flag("limit")) : 400;
const DRY_RUN = boolFlag("dry-run");
const FORCE_SCRAPLING = boolFlag("scrapling");

// Spec fields that gate selection — a row is "needs enrichment" when any of
// these is missing. `trim` is deliberately excluded: BeForward titles often
// carry no trim ("2005 Porsche Cayenne"), so gating on it would re-select rows
// forever. `trim` is still filled opportunistically when present (see enrichRow).
const SELECT_MARKER_FIELDS = ["engine", "transmission", "color_exterior"] as const;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

function truncate(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  return value.length <= max ? value : value.slice(0, max);
}

type JsonObject = Record<string, unknown>;

function mergeBeForwardIdentifierMeta(existing: unknown, identifier: VehicleIdentifier): JsonObject {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing) ? { ...(existing as JsonObject) } : {};
  const existingBeForward =
    base.beforward && typeof base.beforward === "object" && !Array.isArray(base.beforward)
      ? { ...(base.beforward as JsonObject) }
      : {};
  return {
    ...base,
    beforward: {
      ...existingBeForward,
      vehicleIdentifier: identifier,
    },
  };
}

// -- Supabase REST helpers ----------------------------------------------------
interface Row {
  id: string;
  source_url: string;
  status: string;
  images: unknown;
  enrichment_meta: unknown;
}

async function selectQueue(limit: number): Promise<Row[]> {
  const orFilter = buildMissingAnyFilter(SELECT_MARKER_FIELDS.map((field) => ({ field, type: "text" as const })));
  const select = "id,source_url,status,images,enrichment_meta";
  const base =
    `listings?select=${select}` +
    `&source=eq.BeForward&status=eq.active` +
    `&or=(${orFilter})&order=updated_at.asc`;

  const out: Row[] = [];
  const page = Math.min(1000, limit);
  let off = 0;
  while (out.length < limit) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${base}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${off}-${off + page - 1}`,
        "Range-Unit": "items",
      },
    });
    if (!res.ok) throw new Error(`Select ${res.status}: ${await res.text()}`);
    const rows = (await res.json()) as Row[];
    out.push(...rows);
    if (rows.length < page) break;
    off += page;
  }
  return out.slice(0, limit);
}

async function sbUpdate(id: string, patch: Record<string, unknown>): Promise<void> {
  if (DRY_RUN) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Update ${id} ${res.status}: ${await res.text()}`);
}

// -- fetch outcomes -----------------------------------------------------------
type FetchOutcome =
  | { kind: "ok"; html: string }
  | { kind: "dead"; status: number }
  | { kind: "blocked"; status: number; message: string }
  | { kind: "error"; message: string };

// A 200-status WAF challenge page is short and carries no specs. Treat as a
// block so the fetch ladder escalates to Scrapling instead of "succeeding".
function looksLikeWafChallenge(html: string): boolean {
  if (html.length < 5000) return true;
  if (!/table\.specification|class="specification"|class='specification'/.test(html) && /awswaf|_challenge|captcha|security service to protect/i.test(html)) {
    return true;
  }
  return false;
}

async function plainFetch(url: string): Promise<FetchOutcome> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 404 || res.status === 410) return { kind: "dead", status: res.status };
    if (res.status === 403 || res.status === 429 || res.status === 503)
      return { kind: "blocked", status: res.status, message: `HTTP ${res.status}` };
    if (!res.ok) return { kind: "error", message: `HTTP ${res.status} ${res.statusText}` };
    const html = await res.text();
    if (looksLikeWafChallenge(html)) return { kind: "blocked", status: 200, message: "WAF challenge / short body" };
    return { kind: "ok", html };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

// -- Scrapling subprocess -----------------------------------------------------
function runPython(args: string[], timeoutMs = 60_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(SCRAPLING_PY, args);
    let stdout = "";
    let stderr = "";
    const t = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ code: -1, stdout, stderr: stderr + "\n[timeout]" });
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(t);
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

// The repo's StealthyFetcher wrapper (camoufox) is the ONLY reliable AWS WAF
// bypass for beforward.jp from datacenter IPs (GitHub Actions). Plain fetch and
// Scrapling's Fetcher/DynamicFetcher only get the ~2KB WAF challenge stub there.
const SCRAPLING_SCRIPT_PATH = path.resolve(process.cwd(), "scripts/beforward_scrapling_fetch.py");

let scraplingWarmed = false;
async function ensureScrapling(): Promise<void> {
  if (scraplingWarmed) return;
  const check = await runPython([
    "-c",
    "import scrapling; from scrapling.fetchers import StealthyFetcher; print(scrapling.__version__)",
  ]);
  if (check.code !== 0) {
    throw new Error(`Scrapling not importable at ${SCRAPLING_PY}: ${check.stderr.trim()}`);
  }
  console.log(`  [scrapling] StealthyFetcher ready at ${SCRAPLING_PY} v${check.stdout.trim()}`);
  scraplingWarmed = true;
}

async function scraplingFetch(url: string): Promise<FetchOutcome> {
  try {
    await ensureScrapling();
  } catch (err) {
    return { kind: "error", message: `scrapling unavailable: ${(err as Error).message}` };
  }
  // StealthyFetcher's internal timeout is 30s; allow extra for camoufox launch.
  const res = await runPython([SCRAPLING_SCRIPT_PATH, url], TIMEOUT_MS + 60_000);
  if (res.code !== 0 && !res.stdout.trim()) {
    return { kind: "error", message: res.stderr.slice(0, 200) || "scrapling crash" };
  }
  try {
    const parsed = JSON.parse(res.stdout) as { ok: boolean; html?: string; error?: string };
    if (parsed.ok && parsed.html) return { kind: "ok", html: parsed.html };
    if (parsed.error === "waf_blocked") return { kind: "blocked", status: 0, message: "WAF blocked (StealthyFetcher)" };

    // camoufox throws net::ERR_HTTP_RESPONSE_CODE_FAILURE when AWS WAF returns an
    // error status to the datacenter IP. The listings are live (verified), so
    // this is a probabilistic WAF block, not a dead URL — treat as retryable.
    const msg = parsed.error ?? "scrapling returned no html";
    if (/net::ERR|RESPONSE_CODE_FAILURE|ERR_ABORTED|timeout/i.test(msg)) {
      return { kind: "blocked", status: 0, message: msg.slice(0, 120) };
    }
    return { kind: "error", message: msg };
  } catch (err) {
    return { kind: "error", message: `parse scrapling out: ${(err as Error).message}` };
  }
}

// Retry the StealthyFetcher fetch a few times on transient WAF blocks before
// giving up — the per-attempt success rate against AWS WAF from datacenter IPs
// is well below 1, so a bounded retry recovers most rows.
async function scraplingFetchWithRetry(url: string, attempts = 3): Promise<FetchOutcome> {
  let last: FetchOutcome = { kind: "error", message: "no attempt" };
  for (let i = 0; i < attempts; i++) {
    last = await scraplingFetch(url);
    if (last.kind !== "blocked") return last;
    if (i < attempts - 1) await sleep(3_000 + i * 3_000);
  }
  return last;
}

// -- rate limiter (shared across workers) -------------------------------------
let nextAllowedAtMs = 0;
async function waitSlot() {
  const now = Date.now();
  if (nextAllowedAtMs <= now) {
    nextAllowedAtMs = now + RATE_MS;
    return;
  }
  const delay = nextAllowedAtMs - now;
  nextAllowedAtMs += RATE_MS;
  await sleep(delay);
}

// -- enrichment ---------------------------------------------------------------
// Returns the number of target/extra fields written (0 = real page, no new data).
async function enrichRow(row: Row, html: string): Promise<number> {
  const detail = parseDetailHtml(html);
  const update: Record<string, unknown> = {};

  if (detail.trim) update.trim = truncate(detail.trim, 100);
  if (detail.engine) update.engine = truncate(detail.engine, 100);
  if (detail.transmission) update.transmission = truncate(detail.transmission, 100);
  if (detail.exteriorColor) update.color_exterior = truncate(detail.exteriorColor, 100);

  const ident =
    classifyVehicleIdentifier(detail.vin, "VIN") ?? classifyVehicleIdentifier(detail.chassisNo, "Chassis No.");
  if (ident?.kind === "vin_17") {
    update.vin = ident.normalized;
  } else if (ident) {
    update.enrichment_meta = mergeBeForwardIdentifierMeta(row.enrichment_meta, ident);
  }

  const hasImages = Array.isArray(row.images) && row.images.length > 0;
  if (!hasImages && detail.images.length > 0) {
    update.images = detail.images;
    update.photos_count = detail.images.length;
  }

  const fieldCount = Object.keys(update).length;
  const now = new Date().toISOString();
  if (fieldCount > 0) {
    await sbUpdate(row.id, { ...update, last_verified_at: now, updated_at: now });
  } else {
    // Real page, genuinely no target fields. Stamp verification only — NEVER
    // poison `trim` with "" (the old route's bug). Row stays re-eligible but
    // sinks to the back of the updated_at-ordered queue.
    await sbUpdate(row.id, { last_verified_at: now, updated_at: now });
  }
  return fieldCount;
}

// -- main ---------------------------------------------------------------------
async function main() {
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const runId = crypto.randomUUID();

  console.log("BeForward detail enrichment (StealthyFetcher)");
  console.log(
    `  concurrency=${CONCURRENCY}, rateMs=${RATE_MS}, timeoutMs=${TIMEOUT_MS}, limit=${LIMIT}, ` +
      `dryRun=${DRY_RUN}, scrapling=${FORCE_SCRAPLING}`,
  );

  await clearStaleActiveRun("enrich-beforward", 10);
  await markScraperRunStarted({
    scraperName: "enrich-beforward",
    runId,
    startedAt: startedAtIso,
    runtime: "github_actions",
  });

  const queue = await selectQueue(LIMIT);
  console.log(`  rows needing target fields: ${queue.length}`);

  let cursor = 0;
  let enriched = 0;
  let empty = 0;
  let markedDead = 0;
  let failed = 0;
  let blockedStreak = 0;
  const BLOCKED_STREAK_THRESHOLD = 3;
  const errors: string[] = [];
  let useScrapling = FORCE_SCRAPLING;

  async function worker(id: number) {
    while (true) {
      const idx = cursor++;
      if (idx >= queue.length) return;
      const row = queue[idx];

      await waitSlot();

      const result = useScrapling
        ? await scraplingFetchWithRetry(row.source_url)
        : await plainFetch(row.source_url);

      switch (result.kind) {
        case "ok":
          try {
            const n = await enrichRow(row, result.html);
            if (n > 0) enriched++;
            else empty++;
            blockedStreak = 0;
          } catch (err) {
            failed++;
            errors.push(`enrich ${row.id}: ${(err as Error).message}`);
          }
          break;

        case "dead":
          markedDead++;
          blockedStreak = 0;
          try {
            await sbUpdate(row.id, {
              status: "delisted",
              last_verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          } catch (err) {
            errors.push(`delist ${row.id}: ${(err as Error).message}`);
          }
          break;

        case "blocked":
          blockedStreak++;
          if (!useScrapling) {
            // Plain fetch blocked — escalate to StealthyFetcher and retry the row.
            queue.push(row);
            if (blockedStreak >= BLOCKED_STREAK_THRESHOLD) {
              console.log(`\n  [circuit] ${blockedStreak} plain blocks — switching to StealthyFetcher`);
              useScrapling = true;
              blockedStreak = 0;
            }
            await sleep(5_000);
          } else {
            // StealthyFetcher is the strongest tool; a block here means IP
            // reputation (set BF_PROXY_URL). Count as failure, don't loop forever.
            failed++;
            errors.push(`blocked ${row.id}: WAF blocked even via StealthyFetcher (consider BF_PROXY_URL)`);
          }
          break;

        case "error":
          failed++;
          errors.push(`fetch ${row.id}: ${result.message}`);
          break;
      }

      const done = enriched + empty + markedDead + failed;
      if (done % 25 === 0 || done === queue.length) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const via = useScrapling ? "stealthy" : "plain";
        process.stdout.write(
          `\r  [w${id}] ${done}/${queue.length}  enriched=${enriched}  empty=${empty}  dead=${markedDead}  fail=${failed}  via=${via}  ${elapsed}s`,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
  process.stdout.write("\n");

  const durationMs = Date.now() - startTime;
  // Success: we wrote something, or there were no hard failures. An all-blocked
  // run (enriched=0, failed>0) is a genuine failure worth flagging.
  const success = enriched > 0 || failed === 0;

  if (!DRY_RUN) {
    await recordScraperRun({
      scraper_name: "enrich-beforward",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success,
      runtime: "github_actions",
      duration_ms: durationMs,
      discovered: queue.length,
      written: enriched,
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors.slice(0, 50) : undefined,
    });
    await clearScraperRunActive("enrich-beforward");
  }

  const elapsed = (durationMs / 1000).toFixed(0);
  console.log(`\nDone in ${elapsed}s (${success ? "SUCCESS" : "FAILURE"}).`);
  console.log(`  enriched:   ${enriched}`);
  console.log(`  empty:      ${empty}`);
  console.log(`  delisted:   ${markedDead}`);
  console.log(`  failures:   ${failed}`);
  if (errors.length) {
    console.log("  sample errors:");
    for (const e of errors.slice(0, 10)) console.log(`    - ${e}`);
    if (errors.length > 10) console.log(`    ...and ${errors.length - 10} more`);
  }

  if (!success) process.exit(1);
}

main().catch((e) => {
  console.error("\nFATAL:", e);
  process.exit(1);
});
