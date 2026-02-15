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

const INTER_PLATFORM_DELAY_MS = 2000;

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

  // Run all three scrapers in parallel for speed.
  // Each individual scraper handles its own internal rate limiting.
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
// Historical Backfill Integration
// ---------------------------------------------------------------------------

import {
  identifyAndMarkNewModels,
  markBackfilled,
  markFailed,
  type ModelIdentifier,
} from './historical/modelTracker';
import { scrapeHistoricalForModel } from './historical/baHistorical';

export interface ScrapeWithBackfillResult extends ScrapeAllResult {
  historicalBackfill?: {
    modelsProcessed: number;
    totalAuctionsAdded: number;
    errors: string[];
  };
}

/**
 * Run all platform scrapers and trigger historical backfill for new models.
 */
export async function scrapeAllWithBackfill(options?: {
  maxPages?: number;
  scrapeDetails?: boolean;
  maxDetails?: number;
  enableHistorical?: boolean;
}): Promise<ScrapeWithBackfillResult> {
  // Step 1: Run live scraping
  const result = await scrapeAll(options);

  // Step 2: Historical backfill (if enabled)
  if (options?.enableHistorical !== false) {
    const backfillResult = await triggerHistoricalBackfill(result.auctions);
    return {
      ...result,
      historicalBackfill: backfillResult,
    };
  }

  return result;
}

/**
 * Trigger historical backfill for new models discovered in live scrape.
 */
export async function triggerHistoricalBackfill(
  liveAuctions: ScrapedAuction[],
): Promise<{
  modelsProcessed: number;
  totalAuctionsAdded: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let totalAuctionsAdded = 0;
  const newModels: ModelIdentifier[] = [];

  try {
    // Step 1: Identify new models from live auctions
    console.log('[Backfill] Identifying new models from live scrape...');
    const identified = await identifyAndMarkNewModels(liveAuctions);
    newModels.push(...identified);
    console.log(`[Backfill] Found ${newModels.length} new models needing backfill`);

    if (newModels.length === 0) {
      return { modelsProcessed: 0, totalAuctionsAdded: 0, errors: [] };
    }

    // Step 2: Process each new model
    for (const model of newModels) {
      try {
        console.log(`[Backfill] Processing ${model.make}/${model.model}...`);

        const result = await scrapeHistoricalForModel(model, 12);

        if (result.totalStored > 0) {
          await markBackfilled(model.make, model.model, result.totalStored);
          totalAuctionsAdded += result.totalStored;
          console.log(`[Backfill] Stored ${result.totalStored} historical auctions`);
        } else {
          // Mark as backfilled even if empty (prevents re-processing)
          await markBackfilled(model.make, model.model, 0);
          console.log(`[Backfill] No historical auctions found`);
        }

        // Log any errors but don't fail the whole process
        errors.push(...result.errors);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Backfill] Failed for ${model.make}/${model.model}: ${message}`);
        await markFailed(model.make, model.model, message);
        errors.push(`${model.make}/${model.model}: ${message}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backfill orchestration failed';
    console.error('[Backfill] Orchestration error:', message);
    errors.push(message);
  }

  return {
    modelsProcessed: newModels.length,
    totalAuctionsAdded,
    errors,
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

// Re-export historical modules
export {
  scrapeHistoricalForModel,
  getBackfillState,
  needsBackfill,
  markPending,
  getPendingModels,
  markBackfilled,
  markFailed,
  identifyAndMarkNewModels,
  getBackfillStats,
} from './historical';

export type {
  HistoricalAuctionRecord,
  HistoricalScrapeResult,
  ModelIdentifier,
  BackfillState,
} from './historical';
