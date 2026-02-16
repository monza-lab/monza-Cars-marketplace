// ---------------------------------------------------------------------------
// Scraper Manager
// ---------------------------------------------------------------------------
// Orchestrates scraping across all supported auction platforms.
// Provides both a parallel scrapeAll() and per-platform scrapePlatform().
// ---------------------------------------------------------------------------

import { scrapeBringATrailer, type BaTAuction } from './bringATrailer';
import { scrapeCarsAndBids, type CaBAuction } from './carsAndBids';
import { scrapeCollectingCars, type CCarsAuction } from './collectingCars';

// ---------------------------------------------------------------------------
// Unified auction type returned by the manager
// ---------------------------------------------------------------------------

export type ScrapedAuction = BaTAuction | CaBAuction | CCarsAuction;

export interface ScrapeAllResult {
  auctions: ScrapedAuction[];
  errors: string[];
  summary: {
    total: number;
    byPlatform: Record<string, number>;
    errorCount: number;
    durationMs: number;
  };
}

// ---------------------------------------------------------------------------
// Rate-limiting helper
// ---------------------------------------------------------------------------

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// scrapeAll - run all platform scrapers in parallel
// ---------------------------------------------------------------------------

export async function scrapeAll(options?: {
  maxPages?: number;
  scrapeDetails?: boolean;
  maxDetails?: number;
}): Promise<ScrapeAllResult> {
  const startTime = Date.now();
  const allAuctions: ScrapedAuction[] = [];
  const allErrors: string[] = [];
  const byPlatform: Record<string, number> = {};

  console.log('[Scraper] Starting scrape across all platforms...');

  const results = await Promise.allSettled([
    scrapeBringATrailer(options),
    scrapeCarsAndBids(options),
    scrapeCollectingCars(options),
  ]);

  const platformNames = ['BRING_A_TRAILER', 'CARS_AND_BIDS', 'COLLECTING_CARS'];

  results.forEach((result, index) => {
    const platform = platformNames[index];

    if (result.status === 'fulfilled') {
      const { auctions, errors } = result.value;
      allAuctions.push(...auctions);
      allErrors.push(...errors);
      byPlatform[platform] = auctions.length;
      console.log(`[Scraper] ${platform}: ${auctions.length} auctions, ${errors.length} errors`);
    } else {
      const message = result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);
      allErrors.push(`[${platform}] Scraper failed entirely: ${message}`);
      byPlatform[platform] = 0;
      console.error(`[Scraper] ${platform} failed: ${message}`);
    }
  });

  const durationMs = Date.now() - startTime;

  console.log(
    `[Scraper] All platforms complete: ${allAuctions.length} total auctions, ` +
    `${allErrors.length} errors, ${durationMs}ms`,
  );

  return {
    auctions: allAuctions,
    errors: allErrors,
    summary: {
      total: allAuctions.length,
      byPlatform,
      errorCount: allErrors.length,
      durationMs,
    },
  };
}

// ---------------------------------------------------------------------------
// scrapePlatform - run a single platform scraper
// ---------------------------------------------------------------------------

export async function scrapePlatform(
  platform: string,
  options?: {
    maxPages?: number;
    scrapeDetails?: boolean;
    maxDetails?: number;
  },
): Promise<ScrapedAuction[]> {
  const normalized = platform
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .replace(/&/g, 'AND');

  console.log(`[Scraper] Scraping single platform: ${normalized}`);

  switch (normalized) {
    case 'BRING_A_TRAILER':
    case 'BRINGATRAILER':
    case 'BAT': {
      const { auctions } = await scrapeBringATrailer(options);
      return auctions;
    }

    case 'CARS_AND_BIDS':
    case 'CARSANDBIDS':
    case 'CAB':
    case 'C_AND_B':
    case 'CARS_&_BIDS': {
      const { auctions } = await scrapeCarsAndBids(options);
      return auctions;
    }

    case 'COLLECTING_CARS':
    case 'COLLECTINGCARS':
    case 'CC': {
      const { auctions } = await scrapeCollectingCars(options);
      return auctions;
    }

    default:
      throw new Error(`Unknown platform: "${platform}". Supported: BRING_A_TRAILER, CARS_AND_BIDS, COLLECTING_CARS`);
  }
}

// ---------------------------------------------------------------------------
// scrapeAllWithBackfill - wraps scrapeAll for backwards compatibility
// ---------------------------------------------------------------------------

export interface ScrapeWithBackfillResult extends ScrapeAllResult {
  historicalBackfill?: {
    modelsProcessed: number;
    totalAuctionsAdded: number;
    errors: string[];
  };
}

export async function scrapeAllWithBackfill(): Promise<ScrapeWithBackfillResult> {
  const result = await scrapeAll();
  return {
    ...result,
    historicalBackfill: undefined,
  };
}

// ---------------------------------------------------------------------------
// Re-exports for direct access
// ---------------------------------------------------------------------------

export { scrapeBringATrailer } from './bringATrailer';
export { scrapeCarsAndBids } from './carsAndBids';
export { scrapeCollectingCars } from './collectingCars';

export type { BaTAuction } from './bringATrailer';
export type { CaBAuction } from './carsAndBids';
export type { CCarsAuction } from './collectingCars';
