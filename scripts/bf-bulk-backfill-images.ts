/* eslint-disable no-console */
/**
 * Bulk backfill of BeForward listing images using plain fetch + Scrapling fallback.
 *
 * Drains listings where photos_count=0. Active rows are refetched (plain fetch
 * with stealth headers first, Scrapling HTTP stealth on circuit-break, Scrapling
 * dynamic browser as last resort). Ended rows (unsold/sold/delisted) get their
 * `last_verified_at` stamped — their source URLs are 404 anyway.
 *
 * Run locally:
 *   npx tsx scripts/bf-bulk-backfill-images.ts
 *
 * In GitHub Actions:
 *   SCRAPLING_PYTHON=/usr/bin/python3 npx tsx scripts/bf-bulk-backfill-images.ts
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required)
 *   SCRAPLING_PYTHON (default /tmp/bf-scrapling-env/bin/python)
 *
 * Flags:
 *   --concurrency=<N>   Parallel workers (default 3)
 *   --rate-ms=<N>       Min ms between requests per domain (default 3000)
 *   --timeout-ms=<N>    Per-request timeout (default 20000)
 *   --limit=<N>         Cap active listings processed
 *   --skip-dead-sweep   Don't touch unsold/sold/delisted rows
 *   --dry-run           No DB writes
 *   --scrapling         Force Scrapling fallback from start
 *   --dynamic           Force Scrapling in dynamic-browser mode (slow)
 */

import * as fs from "fs";
import * as path from "path";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { parseDetailHtml } from "../src/features/scrapers/beforward_porsche_collector/detail";

// -- env (supports .env.local locally; CI injects via process.env) ------------
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* ignore — CI injects via env */
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

const CONCURRENCY = Number(flag("concurrency", "3"));
const RATE_MS = Number(flag("rate-ms", "3000"));
const TIMEOUT_MS = Number(flag("timeout-ms", "20000"));
const LIMIT = flag("limit") ? Number(flag("limit")) : Infinity;
const DRY_RUN = boolFlag("dry-run");
const SKIP_DEAD_SWEEP = boolFlag("skip-dead-sweep");
const FORCE_SCRAPLING = boolFlag("scrapling");
const DYNAMIC_MODE = boolFlag("dynamic");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

// -- Supabase REST helpers ----------------------------------------------------
async function sbSelect<T>(query: string): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  let off = 0;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${off}-${off + page - 1}`,
        "Range-Unit": "items",
      },
    });
    if (!res.ok) throw new Error(`Select ${res.status}: ${await res.text()}`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < page) break;
    off += page;
  }
  return out;
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

async function sbBulkLastVerified(ids: string[]): Promise<number> {
  if (DRY_RUN || ids.length === 0) return 0;
  const now = new Date().toISOString();
  let updated = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const inList = `(${chunk.map((x) => `"${x}"`).join(",")})`;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=in.${encodeURIComponent(inList)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ last_verified_at: now, updated_at: now }),
      },
    );
    if (!res.ok) {
      console.error(`  [sweep] chunk ${i} failed: ${res.status} ${await res.text()}`);
      continue;
    }
    updated += chunk.length;
  }
  return updated;
}

// -- fetch outcomes -----------------------------------------------------------
type FetchOutcome =
  | { kind: "ok"; html: string }
  | { kind: "dead"; status: number }
  | { kind: "blocked"; status: number; message: string }
  | { kind: "error"; message: string };

async function plainFetch(url: string): Promise<FetchOutcome> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 404 || res.status === 410) return { kind: "dead", status: res.status };
    if (res.status === 403 || res.status === 429 || res.status === 503)
      return { kind: "blocked", status: res.status, message: `HTTP ${res.status}` };
    if (!res.ok) return { kind: "error", message: `HTTP ${res.status} ${res.statusText}` };
    const html = await res.text();
    if (html.length < 5000) return { kind: "error", message: `Short body (${html.length})` };
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

let scraplingWarmed = false;
async function ensureScrapling(): Promise<void> {
  if (scraplingWarmed) return;
  const check = await runPython([
    "-c",
    "import scrapling; from scrapling.fetchers import Fetcher, DynamicFetcher; print(scrapling.__version__)",
  ]);
  if (check.code !== 0) {
    throw new Error(`Scrapling not importable at ${SCRAPLING_PY}: ${check.stderr.trim()}`);
  }
  console.log(`  [scrapling] ready at ${SCRAPLING_PY} v${check.stdout.trim()}`);
  scraplingWarmed = true;
}

const SCRAPLING_SCRIPT = `
import sys, json
from scrapling.fetchers import Fetcher, DynamicFetcher
url = sys.argv[1]
mode = sys.argv[2] if len(sys.argv) > 2 else "http"
out = {"status": 0, "html": "", "error": ""}
try:
    if mode == "dynamic":
        page = DynamicFetcher.fetch(url, headless=True, timeout=${TIMEOUT_MS})
    else:
        page = Fetcher.get(url, timeout=${Math.round(TIMEOUT_MS / 1000)}, stealthy_headers=True)
    out["status"] = int(page.status or 0)
    out["html"] = page.html_content or ""
except Exception as e:
    out["error"] = str(e)
print(json.dumps(out))
`;

async function scraplingFetch(url: string, mode: "http" | "dynamic"): Promise<FetchOutcome> {
  try {
    await ensureScrapling();
  } catch (err) {
    return { kind: "error", message: `scrapling unavailable: ${(err as Error).message}` };
  }
  const budget = mode === "dynamic" ? TIMEOUT_MS + 30_000 : TIMEOUT_MS + 10_000;
  const res = await runPython(["-c", SCRAPLING_SCRIPT, url, mode], budget);
  if (res.code !== 0) return { kind: "error", message: res.stderr.slice(0, 200) || "scrapling crash" };
  try {
    const parsed = JSON.parse(res.stdout) as { status: number; html?: string; error?: string };
    if (parsed.error) return { kind: "error", message: parsed.error };
    if (parsed.status === 404 || parsed.status === 410) return { kind: "dead", status: parsed.status };
    if (parsed.status === 403 || parsed.status === 429)
      return { kind: "blocked", status: parsed.status, message: `HTTP ${parsed.status}` };
    if (!parsed.html || parsed.html.length < 5000)
      return { kind: "error", message: `Short scrapling body (${parsed.html?.length ?? 0})` };
    return { kind: "ok", html: parsed.html };
  } catch (err) {
    return { kind: "error", message: `parse scrapling out: ${(err as Error).message}` };
  }
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

// -- main ---------------------------------------------------------------------
interface Row {
  id: string;
  source_url: string;
  status: string;
  photos_count: number | null;
}

async function main() {
  console.log("BeForward bulk image backfill");
  console.log(
    `  concurrency=${CONCURRENCY}, rateMs=${RATE_MS}, timeoutMs=${TIMEOUT_MS}, limit=${LIMIT}, dryRun=${DRY_RUN}, scrapling=${FORCE_SCRAPLING}, dynamic=${DYNAMIC_MODE}`,
  );

  const all = await sbSelect<Row>(
    "listings?select=id,source_url,status,photos_count&source=eq.BeForward&photos_count=eq.0",
  );
  console.log(`  rows missing photos: ${all.length}`);

  const active = all.filter((r) => r.status === "active");
  const dead = all.filter((r) => r.status !== "active");
  console.log(`  active (fetch): ${active.length}   dead (sweep): ${dead.length}`);

  if (!SKIP_DEAD_SWEEP && dead.length > 0) {
    console.log("Sweeping dead rows (setting last_verified_at)...");
    const n = await sbBulkLastVerified(dead.map((r) => r.id));
    console.log(`  swept: ${n}`);
  }

  const queue = active.slice(0, Number.isFinite(LIMIT) ? LIMIT : active.length);
  if (queue.length === 0) {
    console.log("Nothing active to process.");
    return;
  }

  let cursor = 0;
  let filled = 0;
  let markedDead = 0;
  let empty = 0;
  let failed = 0;
  let blockedStreak = 0;
  const BLOCKED_STREAK_THRESHOLD = 3;
  const errors: string[] = [];
  let useScrapling = FORCE_SCRAPLING;
  let scraplingMode: "http" | "dynamic" = DYNAMIC_MODE ? "dynamic" : "http";
  const startMs = Date.now();

  async function worker(id: number) {
    while (true) {
      const idx = cursor++;
      if (idx >= queue.length) return;
      const row = queue[idx];

      await waitSlot();

      const result = useScrapling
        ? await scraplingFetch(row.source_url, scraplingMode)
        : await plainFetch(row.source_url);

      switch (result.kind) {
        case "ok":
          try {
            const detail = parseDetailHtml(result.html);
            if (detail.images.length === 0) {
              empty++;
              await sbUpdate(row.id, {
                last_verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            } else {
              await sbUpdate(row.id, {
                images: detail.images,
                photos_count: detail.images.length,
                last_verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              filled++;
            }
            blockedStreak = 0;
          } catch (err) {
            failed++;
            errors.push(`parse ${row.id}: ${(err as Error).message}`);
          }
          break;

        case "dead":
          markedDead++;
          blockedStreak = 0;
          await sbUpdate(row.id, {
            status: "unsold",
            last_verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          break;

        case "blocked":
          blockedStreak++;
          queue.push(row); // requeue
          if (!useScrapling && blockedStreak >= BLOCKED_STREAK_THRESHOLD) {
            console.log(`\n  [circuit] ${blockedStreak} blocks — switching to Scrapling (${scraplingMode})`);
            useScrapling = true;
            blockedStreak = 0;
          } else if (useScrapling && scraplingMode === "http" && blockedStreak >= BLOCKED_STREAK_THRESHOLD) {
            console.log(`\n  [circuit] Scrapling http blocked — switching to dynamic browser`);
            scraplingMode = "dynamic";
            blockedStreak = 0;
          }
          await sleep(15_000);
          break;

        case "error":
          failed++;
          errors.push(`fetch ${row.id}: ${result.message}`);
          break;
      }

      const done = filled + markedDead + empty + failed;
      if (done % 25 === 0 || done === queue.length) {
        const elapsed = ((Date.now() - startMs) / 1000).toFixed(0);
        const via = useScrapling ? `scr[${scraplingMode}]` : "plain";
        process.stdout.write(
          `\r  [w${id}] ${done}/${queue.length}  filled=${filled}  dead=${markedDead}  empty=${empty}  fail=${failed}  via=${via}  ${elapsed}s`,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
  process.stdout.write("\n");

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(0);
  console.log(`\nDone in ${elapsed}s.`);
  console.log(`  images filled:  ${filled}`);
  console.log(`  marked unsold:  ${markedDead}`);
  console.log(`  empty gallery:  ${empty}`);
  console.log(`  failures:       ${failed}`);
  if (errors.length) {
    const sampled = errors.slice(0, 10);
    console.log("  sample errors:");
    for (const e of sampled) console.log(`    - ${e}`);
    if (errors.length > 10) console.log(`    ...and ${errors.length - 10} more`);
  }
}

main().catch((e) => {
  console.error("\nFATAL:", e);
  process.exit(1);
});
