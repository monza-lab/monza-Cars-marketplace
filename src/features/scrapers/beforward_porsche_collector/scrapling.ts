/**
 * BeForward Scrapling wrapper — spawns Python fetcher, returns raw HTML.
 * Follows the AutoTrader pattern (autotrader_collector/scrapling.ts).
 *
 * Unlike the AutoTrader wrapper which returns parsed data, this returns
 * raw HTML so the existing cheerio parsers in discover.ts / detail.ts
 * can handle parsing unchanged.
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = "scripts/beforward_scrapling_fetch.py";

// BeForward pages can be 700KB+; default maxBuffer (1MB) is too tight for raw HTML.
const MAX_BUFFER = 10 * 1024 * 1024; // 10 MB

/* ── Predicates ────────────────────────────────────────────────────── */

export function canUseScrapling(): boolean {
  if (process.env.VERCEL) return false;
  // Opt-in: only use scrapling when explicitly enabled (avoids noise on dev machines
  // where Python 3.11 / Scrapling may not be installed)
  return process.env.BF_FORCE_SCRAPLING === "1";
}

/* ── Internals ─────────────────────────────────────────────────────── */

function resolveScraplingPython(): string {
  return process.env.SCRAPLING_PYTHON || "python3.11";
}

/* ── Fetch ─────────────────────────────────────────────────────────── */

/**
 * Fetch a BeForward page via Scrapling (headless browser).
 * Returns the raw HTML string, or `null` if scrapling is unavailable or fails.
 */
export async function fetchBFHtmlWithScrapling(url: string): Promise<string | null> {
  if (!canUseScrapling()) return null;

  const scriptPath = path.resolve(process.cwd(), SCRIPT_PATH);
  let stdout = "";
  try {
    const python = resolveScraplingPython();
    const result = await execFileAsync(python, [scriptPath, url], {
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: MAX_BUFFER,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    stdout = typeof result === "string" ? result : result.stdout ?? "";
    const stderr = typeof result === "string" ? "" : result.stderr ?? "";
    if (stderr) {
      console.warn(`[bf-scrapling] stderr for ${url}: ${stderr.slice(0, 500)}`);
    }
  } catch (err: unknown) {
    const errObj = err as { stderr?: string; message?: string };
    console.warn(
      `[bf-scrapling] Error fetching ${url}: ${errObj.message ?? String(err)}`,
    );
    return null;
  }

  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed.ok) {
      console.warn(`[bf-scrapling] Fetch failed for ${url}: ${parsed.error}`);
      return null;
    }
    return typeof parsed.html === "string" ? parsed.html : null;
  } catch {
    return null;
  }
}
