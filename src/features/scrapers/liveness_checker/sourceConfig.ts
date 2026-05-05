/**
 * Per-source configuration for the liveness checker.
 * Each source gets its own async loop running in parallel.
 */

export interface SourceConfig {
  /** Source name as stored in listings.source */
  source: string;
  /** Delay between requests in ms */
  delayMs: number;
  /** Max listings to check per run (bounded by time budget) */
  maxPerRun: number;
}

/**
 * Chrome-like User-Agent to avoid bot detection.
 * Same UA used by backfillImages.ts.
 */
export const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/** Sources excluded from liveness checks (handled by end_time expiry) */
export const EXCLUDED_SOURCES = ["BaT", "CarsAndBids", "CollectingCars", "ClassicCom"];

/**
 * Dealer/classified sources to check.
 * Delays respect each site's robots.txt crawl-delay where known.
 */
export const SOURCE_CONFIGS: SourceConfig[] = [
  { source: "AutoScout24",  delayMs: 2_000,  maxPerRun: 1_650 },
  { source: "Elferspot",    delayMs: 10_000, maxPerRun: 330 },
  { source: "AutoTrader",   delayMs: 2_000,  maxPerRun: 1_650 },
  { source: "BeForward",    delayMs: 2_500,  maxPerRun: 1_320 },
];

/** Circuit breaker: stop a source after this many consecutive blocks (403/429/503) */
export const CIRCUIT_BREAK_THRESHOLD = 10;

/** Default time budget in ms (55 minutes, leaving 5 min buffer for GH Actions 60 min timeout) */
export const DEFAULT_TIME_BUDGET_MS = 55 * 60 * 1_000;

/** HTTP request timeout per URL in ms */
export const REQUEST_TIMEOUT_MS = 15_000;
