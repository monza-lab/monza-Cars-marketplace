/**
 * AutoScout24 Scrapling wrapper — spawns Python fetcher, parses JSON stdout.
 *
 * Adapts the Classic.com pattern (classic_collector/scrapling.ts) with
 * a mode argument (search/detail) and two return types.
 */
import { execFile, spawnSync } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import type { AS24ScraplingSearchResult, AS24ScraplingDetailResult } from "./types";
import { logEvent } from "./logging";

const execFileAsync = promisify(execFile);

/* ── Predicates ────────────────────────────────────────────────────── */

/** Returns true if scrapling is available (not Vercel, not force-disabled) */
export function canUseScrapling(): boolean {
  return !process.env.VERCEL && process.env.AS24_FORCE_SCRAPLING !== "0";
}

/** Returns true if Playwright fallback should be skipped entirely */
export function shouldSkipPlaywrightFallback(): boolean {
  return process.env.AS24_DISABLE_PLAYWRIGHT_FALLBACK === "1";
}

/* ── Internals ─────────────────────────────────────────────────────── */

function resolveScraplingPython(): string {
  return process.env.SCRAPLING_PYTHON || "python3.11";
}

function shellEscape(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

const SCRIPT_PATH = "scripts/as24_scrapling_fetch.py";

/* ── Search ────────────────────────────────────────────────────────── */

/** Fetch a search page → listings + pagination info */
export async function fetchAS24SearchWithScrapling(
  url: string,
): Promise<AS24ScraplingSearchResult | null> {
  if (!canUseScrapling()) return null;

  const scriptPath = path.resolve(process.cwd(), SCRIPT_PATH);
  let stdout = "";
  try {
    const shell = process.env.SHELL || "/bin/bash";
    const command = `${resolveScraplingPython()} ${shellEscape(scriptPath)} search ${shellEscape(url)}`;
    const result = await execFileAsync(shell, ["-lc", command], {
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    stdout = typeof result === "string" ? result : result.stdout ?? "";
  } catch (err) {
    logEvent({
      level: "warn",
      event: "scrapling.search_error",
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed.ok) {
      logEvent({ level: "warn", event: "scrapling.search_failed", url, error: parsed.error });
      return null;
    }
    return {
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
      totalResults: typeof parsed.totalResults === "number" ? parsed.totalResults : null,
      totalPages: typeof parsed.totalPages === "number" ? parsed.totalPages : null,
    };
  } catch {
    return null;
  }
}

/* ── Detail ────────────────────────────────────────────────────────── */

/** Fetch a detail page → vehicle specs */
export async function fetchAS24DetailWithScrapling(
  url: string,
): Promise<AS24ScraplingDetailResult | null> {
  if (!canUseScrapling()) return null;

  const scriptPath = path.resolve(process.cwd(), SCRIPT_PATH);
  let stdout = "";
  try {
    const shell = process.env.SHELL || "/bin/bash";
    const command = `${resolveScraplingPython()} ${shellEscape(scriptPath)} detail ${shellEscape(url)}`;
    const result = await execFileAsync(shell, ["-lc", command], {
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    stdout = typeof result === "string" ? result : result.stdout ?? "";
  } catch {
    return null;
  }

  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed.ok || !parsed.vehicle) return null;
    const v = parsed.vehicle;
    return {
      trim: v.trim ?? null,
      vin: v.vin ?? null,
      transmission: v.transmission ?? null,
      bodyStyle: v.bodyStyle ?? null,
      engine: v.engine ?? null,
      colorExterior: v.colorExterior ?? null,
      colorInterior: v.colorInterior ?? null,
      description: v.description ?? null,
      images: Array.isArray(v.images) ? v.images : [],
      features: Array.isArray(v.features) ? v.features : [],
    };
  } catch {
    return null;
  }
}

/* ── Batch Detail ──────────────────────────────────────────────────── */

/** Batch fetch detail pages (for enrichment script) */
export async function fetchAS24DetailBatchWithScrapling(
  urls: string[],
): Promise<Array<(AS24ScraplingDetailResult & { url: string }) | null> | null> {
  if (!canUseScrapling() || urls.length === 0) return [];

  const scriptPath = path.resolve(process.cwd(), SCRIPT_PATH);
  const result = spawnSync(resolveScraplingPython(), [scriptPath, "detail", ...urls], {
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });

  if (result.error || result.status !== 0) return null;

  const stdout = (result.stdout ?? "").trim();
  if (!stdout) return null;

  try {
    const parsed = JSON.parse(stdout);
    if (!parsed.ok || !Array.isArray(parsed.results)) return null;

    return parsed.results.map((item: Record<string, unknown>) => {
      const ok = item.ok as boolean;
      if (!ok || !item.vehicle) return null;
      const v = item.vehicle as Record<string, unknown>;
      return {
        trim: (v.trim as string) ?? null,
        vin: (v.vin as string) ?? null,
        transmission: (v.transmission as string) ?? null,
        bodyStyle: (v.bodyStyle as string) ?? null,
        engine: (v.engine as string) ?? null,
        colorExterior: (v.colorExterior as string) ?? null,
        colorInterior: (v.colorInterior as string) ?? null,
        description: (v.description as string) ?? null,
        images: Array.isArray(v.images) ? v.images : [],
        features: Array.isArray(v.features) ? v.features : [],
        url: (item.url as string) ?? "",
      };
    });
  } catch {
    return null;
  }
}
