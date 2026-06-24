/**
 * CLI: BeForward detail-field enrichment via a persistent StealthySession.
 *
 * Replaces the Vercel cron /api/cron/enrich-beforward, which could never work:
 * beforward.jp sits behind AWS WAF and Scrapling is disabled on Vercel, so the
 * route's plain fetch only ever received the WAF challenge page. It wrote 0
 * fields, recorded 0 errors, and stamped trim="" as a poison-pill.
 *
 * AWS WAF also throttles GitHub Actions datacenter IPs: a fresh browser per URL
 * re-triggers the JS challenge every time and the IP gets blocked after ~10
 * fetches. The fix (no paid proxy) is scripts/beforward_session_fetch.py — ONE
 * StealthySession solves the challenge once and reuses the aws-waf-token cookie
 * for the whole batch.
 *
 * Drains active BeForward listings missing any target field (engine,
 * transmission, color_exterior) and backfills them (plus trim/vin/images when
 * present) from the real detail page. Never writes trim="".
 *
 * Run locally:
 *   SCRAPLING_PYTHON=python npx tsx scripts/bf-enrich-cli.ts --limit=5 --dry-run
 * In GitHub Actions:
 *   SCRAPLING_PYTHON=$(which python3) npx tsx scripts/bf-enrich-cli.ts
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required)
 *   SCRAPLING_PYTHON (default /tmp/bf-scrapling-env/bin/python)
 *   BF_PROXY_URL (optional; passed through to the fetcher)
 *
 * Flags:
 *   --limit=<N>      Cap listings processed (default 400)
 *   --dry-run        No DB writes
 */

import * as fs from "fs";
import * as path from "path";
import { spawn } from "node:child_process";
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
const SESSION_SCRIPT_PATH = path.resolve(process.cwd(), "scripts/beforward_session_fetch.py");

// -- flags --------------------------------------------------------------------
const flag = (n: string, d?: string) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=") ?? d;
const boolFlag = (n: string) => process.argv.includes(`--${n}`);

// One persistent session fetches sequentially at ~15s/page; 150 fits the CI
// 90-minute budget with headroom. Run twice daily to drain more (fresh IP each).
const LIMIT = flag("limit") ? Number(flag("limit")) : 150;
const DRY_RUN = boolFlag("dry-run");

// Spec fields that gate selection — a row is "needs enrichment" when any of
// these is missing. `trim` is deliberately excluded: BeForward titles often
// carry no trim ("2005 Porsche Cayenne"), so gating on it would re-select rows
// forever. `trim` is still filled opportunistically when present (see enrichRow).
const SELECT_MARKER_FIELDS = ["engine", "transmission", "color_exterior"] as const;

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
  return { ...base, beforward: { ...existingBeForward, vehicleIdentifier: identifier } };
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

// -- persistent-session batch fetch -------------------------------------------
interface FetchResult {
  url: string;
  ok: boolean;
  html?: string;
  error?: string;
  htmlSize?: number;
}

async function ensureScrapling(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(SCRAPLING_PY, [
      "-c",
      "import scrapling; from scrapling.fetchers import StealthySession; print(scrapling.__version__)",
    ]);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`  [scrapling] StealthySession ready at ${SCRAPLING_PY} v${out.trim()}`);
        resolve();
      } else {
        reject(new Error(`Scrapling not importable at ${SCRAPLING_PY}: ${err.trim()}`));
      }
    });
  });
}

// Spawn ONE persistent StealthySession for the whole URL list, invoking
// `onResult` for each JSON-line as the page is fetched (so DB writes stream and
// partial progress survives a crash). One WAF solve is reused for all URLs.
function runSessionFetch(urls: string[], onResult: (r: FetchResult) => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(SCRAPLING_PY, [SESSION_SCRIPT_PATH], {
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    let buf = "";
    let chain: Promise<void> = Promise.resolve();
    let chainErr: unknown = null;

    child.stdout.on("data", (d) => {
      buf += d.toString();
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        let parsed: FetchResult | null = null;
        try {
          parsed = JSON.parse(line) as FetchResult;
        } catch {
          continue; // ignore non-JSON noise (warnings, banners)
        }
        if (parsed && parsed.url) {
          chain = chain.then(() => onResult(parsed!)).catch((e) => {
            chainErr = e;
          });
        }
      }
    });

    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", () => {
      chain.then(() => {
        if (stderr.trim()) console.error(`  [session stderr] ${stderr.slice(0, 400)}`);
        if (chainErr) reject(chainErr);
        else resolve();
      });
    });

    child.stdin.write(urls.join("\n") + "\n");
    child.stdin.end();
  });
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
  // Stamp verification either way. NEVER poison `trim` with "" (the old bug).
  await sbUpdate(row.id, { ...update, last_verified_at: now, updated_at: now });
  return fieldCount;
}

// -- main ---------------------------------------------------------------------
async function main() {
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const runId = crypto.randomUUID();

  console.log("BeForward detail enrichment (persistent StealthySession)");
  console.log(`  limit=${LIMIT}, dryRun=${DRY_RUN}, proxy=${process.env.BF_PROXY_URL ? "yes" : "no"}`);

  await clearStaleActiveRun("enrich-beforward", 10);
  await markScraperRunStarted({
    scraperName: "enrich-beforward",
    runId,
    startedAt: startedAtIso,
    runtime: "github_actions",
  });

  const queue = await selectQueue(LIMIT);
  console.log(`  rows needing target fields: ${queue.length}`);

  let enriched = 0;
  let empty = 0;
  let wafBlocked = 0;
  let failed = 0;
  let processed = 0;
  const errors: string[] = [];

  if (queue.length > 0) {
    await ensureScrapling();
    const byUrl = new Map(queue.map((r) => [r.source_url, r]));

    await runSessionFetch(
      queue.map((r) => r.source_url),
      async (res) => {
        const row = byUrl.get(res.url);
        if (!row) return;
        processed++;
        try {
          if (res.ok && res.html) {
            const n = await enrichRow(row, res.html);
            if (n > 0) enriched++;
            else empty++;
          } else if (res.error === "waf_blocked") {
            wafBlocked++;
            failed++;
            errors.push(`waf-blocked ${row.id}`);
          } else {
            failed++;
            errors.push(`fetch ${row.id}: ${res.error ?? "unknown"}`);
          }
        } catch (err) {
          failed++;
          errors.push(`enrich ${row.id}: ${(err as Error).message}`);
        }
        if (processed % 10 === 0 || processed === queue.length) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          process.stdout.write(
            `\r  ${processed}/${queue.length}  enriched=${enriched}  empty=${empty}  waf=${wafBlocked}  fail=${failed}  ${elapsed}s`,
          );
        }
      },
    );
    process.stdout.write("\n");
  }

  const durationMs = Date.now() - startTime;
  // Success unless we got rows but wrote nothing (e.g. fully WAF-blocked).
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
  console.log(`  enriched:    ${enriched}`);
  console.log(`  empty:       ${empty}`);
  console.log(`  waf-blocked: ${wafBlocked}`);
  console.log(`  failures:    ${failed}`);
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
