/**
 * AutoTrader Scrapling wrapper — spawns Python fetcher, parses JSON stdout.
 * Follows the AutoScout24 pattern (autoscout24_collector/scrapling.ts).
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { logEvent } from "./logging";
import type { AutoTraderDetailParsed } from "./detail";

const execFileAsync = promisify(execFile);

/* ── Predicates ────────────────────────────────────────────────────── */

export function canUseScrapling(): boolean {
  return !process.env.VERCEL && process.env.AT_FORCE_SCRAPLING !== "0";
}

/* ── Internals ─────────────────────────────────────────────────────── */

function resolveScraplingPython(): string {
  return process.env.SCRAPLING_PYTHON || "python3.11";
}

const SCRIPT_PATH = "scripts/autotrader_scrapling_fetch.py";

/* ── Search ────────────────────────────────────────────────────────── */

export interface ATScraplingSearchListing {
  advertId: string;
  title: string;
  price: number | null;
  priceText: string | null;
  url: string;
}

export interface ATScraplingSearchResult {
  listings: ATScraplingSearchListing[];
  totalResults: number | null;
}

export async function fetchATSearchWithScrapling(
  url: string,
): Promise<ATScraplingSearchResult | null> {
  if (!canUseScrapling()) return null;

  const scriptPath = path.resolve(process.cwd(), SCRIPT_PATH);
  let stdout = "";
  try {
    const python = resolveScraplingPython();
    const result = await execFileAsync(python, [scriptPath, "search", url], {
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    stdout = typeof result === "string" ? result : result.stdout ?? "";
    const stderr = typeof result === "string" ? "" : result.stderr ?? "";
    if (stderr) {
      logEvent({ level: "debug", event: "scrapling.at_search_stderr", url, stderr: stderr.slice(0, 500) });
    }
  } catch (err: unknown) {
    const errObj = err as { stderr?: string; message?: string };
    logEvent({
      level: "warn",
      event: "scrapling.at_search_error",
      url,
      error: errObj.message ?? String(err),
      stderr: errObj.stderr?.slice(0, 500),
    });
    return null;
  }

  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed.ok) {
      logEvent({ level: "warn", event: "scrapling.at_search_failed", url, error: parsed.error });
      return null;
    }
    return {
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
      totalResults: typeof parsed.totalResults === "number" ? parsed.totalResults : null,
    };
  } catch {
    return null;
  }
}

/* ── Detail ────────────────────────────────────────────────────────── */

export async function fetchATDetailWithScrapling(
  url: string,
): Promise<AutoTraderDetailParsed | null> {
  if (!canUseScrapling()) return null;

  const scriptPath = path.resolve(process.cwd(), SCRIPT_PATH);
  let stdout = "";
  try {
    const python = resolveScraplingPython();
    const result = await execFileAsync(python, [scriptPath, "detail", url], {
      encoding: "utf8",
      timeout: 25_000,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    stdout = typeof result === "string" ? result : result.stdout ?? "";
    const stderr = typeof result === "string" ? "" : result.stderr ?? "";
    if (stderr) {
      logEvent({ level: "debug", event: "scrapling.at_detail_stderr", url, stderr: stderr.slice(0, 500) });
    }
  } catch (err: unknown) {
    const errObj = err as { stderr?: string; message?: string };
    logEvent({
      level: "warn",
      event: "scrapling.at_detail_error",
      url,
      error: errObj.message ?? String(err),
      stderr: errObj.stderr?.slice(0, 500),
    });
    return null;
  }

  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed.ok || !parsed.vehicle) return null;

    const v = parsed.vehicle;
    return {
      title: v.title ?? null,
      price: typeof v.price === "number" ? v.price : null,
      priceText: v.priceText ?? null,
      mileage: typeof v.mileage === "number" ? v.mileage : null,
      mileageUnit: v.mileageUnit ?? null,
      location: v.location ?? null,
      description: v.description ?? null,
      images: Array.isArray(v.images) ? v.images : [],
      vin: v.vin ?? null,
      exteriorColor: v.exteriorColor ?? null,
      interiorColor: v.interiorColor ?? null,
      transmission: v.transmission ?? null,
      engine: v.engine ?? null,
      bodyStyle: v.bodyStyle ?? null,
    };
  } catch {
    return null;
  }
}
