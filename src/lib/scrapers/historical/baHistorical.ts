// ---------------------------------------------------------------------------
// Bring a Trailer Historical Scraper
// ---------------------------------------------------------------------------
// Scrapes historical "Sold" auctions from BaT for market analysis.
// Respects rate limits and collects 12 months of data per model.
// ---------------------------------------------------------------------------

import * as cheerio from 'cheerio';
import { prisma } from '@/lib/db/prisma';
import type { ModelIdentifier } from './modelTracker';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = 'https://bringatrailer.com';
const REQUEST_DELAY_MS = 2500;
const MAX_RETRIES = 3;
const MAX_PAGES = 10; // ~12 months typically

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistoricalAuctionRecord {
  externalId: string;
  source: 'bring_a_trailer';
  status: 'SOLD';
  make: string;
  model: string;
  variant: string | null;
  year: number | null;
  price: number | null;
  currency: string;
  mileage: number | null;
  mileageUnit: string | null;
  url: string;
  imageUrl: string | null;
  auctionDate: Date | null;
  scrapedAt: Date;
}

export interface HistoricalScrapeResult {
  auctions: HistoricalAuctionRecord[];
  errors: string[];
  totalFound: number;
  totalStored: number;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, attempt = 1): Promise<string> {
  try {
    const response = await fetch(url, { headers: DEFAULT_HEADERS });

    if (response.status === 429) {
      if (attempt <= MAX_RETRIES) {
        console.log(`[Historical] Rate limited, waiting 60s (attempt ${attempt})`);
        await delay(60000);
        return fetchWithRetry(url, attempt + 1);
      }
      throw new Error('Rate limited after max retries');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const backoff = Math.pow(2, attempt) * 1000;
      console.log(`[Historical] Retry ${attempt} after ${backoff}ms`);
      await delay(backoff);
      return fetchWithRetry(url, attempt + 1);
    }
    throw error;
  }
}

function buildSearchUrl(make: string, model: string, page: number): string {
  const params = new URLSearchParams({
    make: make.toLowerCase(),
    model: model.toLowerCase().replace(/\s+/g, '-'),
    status: 'sold',
    sort: 'date',
    page: page.toString(),
  });
  return `${BASE_URL}/search/?${params.toString()}`;
}

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseMileage(text: string): number | null {
  const cleaned = text.replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function extractExternalId(url: string): string {
  const match = url.match(/\/listing\/([^/]+)/);
  return match
    ? `bat-${match[1]}`
    : `bat-${Buffer.from(url).toString('base64').slice(0, 20)}`;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

// @ts-nocheck

export function parseHistoricalAuction(
  $: cheerio.CheerioAPI,
  el: any,
  make: string,
  model: string,
): HistoricalAuctionRecord | null {
  const $el = $(el);

  // Extract URL
  const linkEl = $el.find('a[href*="/listing/"]').first();
  const relativeUrl = linkEl.attr('href');
  if (!relativeUrl) return null;

  const url = relativeUrl.startsWith('http')
    ? relativeUrl
    : `${BASE_URL}${relativeUrl}`;
  const externalId = extractExternalId(url);

  // Title and year
  const title =
    linkEl.text().trim() || $el.find('h3, h2, .title').first().text().trim();
  if (!title) return null;

  const yearMatch = title.match(/^(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  // Sold price - look for sold price indicators
  const priceText =
    $el.find('.sold-price, .final-price, [class*="sold"]').first().text() ||
    $el.text().match(/\$[\d,]+/)?.[0] ||
    '';
  const price = parsePrice(priceText);

  // Image
  const imageUrl =
    $el.find('img').first().attr('src') ||
    $el.find('img').first().attr('data-src') ||
    null;

  // Auction date - look for date indicators
  const dateText =
    $el.find('time, [datetime], .date').first().attr('datetime') ||
    $el.find('time, [datetime], .date').first().text();
  let auctionDate: Date | null = null;
  if (dateText) {
    const parsed = new Date(dateText);
    if (!isNaN(parsed.getTime())) auctionDate = parsed;
  }

  // Mileage (if available)
  const mileageText = $el.text().match(/([\d,]+)\s*(miles?|mi|km)/i);
  const mileage = mileageText ? parseMileage(mileageText[1]) : null;
  const mileageUnit = mileageText && /km/i.test(mileageText[2]) ? 'km' : 'miles';

  return {
    externalId,
    source: 'bring_a_trailer',
    status: 'SOLD',
    make,
    model,
    variant: null,
    year,
    price,
    currency: 'USD',
    mileage,
    mileageUnit,
    url,
    imageUrl,
    auctionDate,
    scrapedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Main scraping function
// ---------------------------------------------------------------------------

export async function fetchHistoricalAuctions(
  make: string,
  model: string,
  months: number = 12,
): Promise<HistoricalScrapeResult> {
  const auctions: HistoricalAuctionRecord[] = [];
  const errors: string[] = [];
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  console.log(`[Historical] Starting backfill for ${make}/${model} (${months} months)`);

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const url = buildSearchUrl(make, model, page);
      console.log(`[Historical] Fetching page ${page}: ${url}`);

      const html = await fetchWithRetry(url);
      const $ = cheerio.load(html);

      // Find auction listings - BaT search results
      const listings = $('.auction-item, .listing-item, [data-auction]');

      if (listings.length === 0) {
        console.log(`[Historical] No more listings found on page ${page}`);
        break;
      }

      let pageCount = 0;
      listings.each((_, el) => {
        try {
          const auction = parseHistoricalAuction($, el, make, model);
          if (auction) {
            // Check if within date range
            if (auction.auctionDate && auction.auctionDate < cutoffDate) {
              console.log(`[Historical] Reached cutoff date at ${auction.auctionDate}`);
              return false; // Break the .each loop
            }
            auctions.push(auction);
            pageCount++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Parse error';
          errors.push(`Parse error on page ${page}: ${message}`);
        }
      });

      console.log(`[Historical] Page ${page}: ${pageCount} auctions parsed`);

      // Rate limiting between pages
      if (page < MAX_PAGES) {
        await delay(REQUEST_DELAY_MS);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Page ${page} failed: ${message}`);

      // If first page fails, abort
      if (page === 1) break;
    }
  }

  console.log(
    `[Historical] Fetch complete: ${auctions.length} auctions, ${errors.length} errors`,
  );

  return {
    auctions,
    errors,
    totalFound: auctions.length,
    totalStored: 0, // Will be updated after storage
  };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export async function storeHistoricalAuctions(
  auctions: HistoricalAuctionRecord[],
): Promise<number> {
  let stored = 0;

  for (const auction of auctions) {
    try {
      // Check for duplicates
      const existing = await prisma.auction.findUnique({
        where: { externalId: auction.externalId },
      });

      if (existing) {
        console.log(`[Historical] Skipping duplicate: ${auction.externalId}`);
        continue;
      }

      // Create auction record
      const created = await prisma.auction.create({
        data: {
          externalId: auction.externalId,
          platform: 'BRING_A_TRAILER',
          title: `${auction.year} ${auction.make} ${auction.model}`,
          make: auction.make,
          model: auction.model,
          year: auction.year ?? 0,
          mileage: auction.mileage,
          mileageUnit: auction.mileageUnit ?? 'miles',
          currentBid: auction.price,
          finalPrice: auction.price,
          url: auction.url,
          images: auction.imageUrl ? [auction.imageUrl] : [],
          status: 'SOLD',
          endTime: auction.auctionDate,
          scrapedAt: auction.scrapedAt,
        },
      });

      // Create price history entry
      if (auction.price) {
        await prisma.priceHistory.create({
          data: {
            auctionId: created.id,
            bid: auction.price,
            timestamp: auction.auctionDate ?? auction.scrapedAt,
          },
        });
      }

      stored++;
    } catch (error) {
      console.error(`[Historical] Failed to store ${auction.externalId}:`, error);
    }
  }

  console.log(`[Historical] Stored ${stored}/${auctions.length} auctions`);
  return stored;
}

// ---------------------------------------------------------------------------
// High-level orchestration
// ---------------------------------------------------------------------------

export async function scrapeHistoricalForModel(
  model: ModelIdentifier,
  months: number = 12,
): Promise<HistoricalScrapeResult> {
  console.log(
    `[Historical] Starting historical scrape for ${model.make}/${model.model}`,
  );

  const startTime = Date.now();

  // Fetch auctions
  const result = await fetchHistoricalAuctions(model.make, model.model, months);

  // Store in database
  result.totalStored = await storeHistoricalAuctions(result.auctions);

  const duration = Date.now() - startTime;
  console.log(
    `[Historical] Complete for ${model.make}/${model.model}: ` +
      `${result.totalStored} stored, ${duration}ms`,
  );

  return result;
}
