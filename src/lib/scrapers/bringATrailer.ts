// @ts-nocheck
// ---------------------------------------------------------------------------
// Bring a Trailer Scraper
// ---------------------------------------------------------------------------
// IMPORTANT: This scraper is intended for educational and research purposes
// only. Always check and respect robots.txt before scraping any website.
// Bring a Trailer's terms of service should be reviewed before use.
// Use responsibly with appropriate rate limiting.
// ---------------------------------------------------------------------------

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BaTAuction {
  externalId: string;
  platform: 'BRING_A_TRAILER';
  title: string;
  make: string;
  model: string;
  year: number;
  mileage: number | null;
  mileageUnit: string;
  transmission: string | null;
  engine: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  location: string | null;
  currentBid: number | null;
  bidCount: number;
  endTime: Date | string | null;
  url: string;
  imageUrl: string | null;
  description: string | null;
  sellerNotes: string | null;
  status: string;
  vin: string | null;
  images: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = 'https://bringatrailer.com';
const AUCTIONS_URL = `${BASE_URL}/auctions`;

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
};

const REQUEST_DELAY_MS = 2500; // 2.5 seconds between requests
const REQUEST_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return delay(ms);
}

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse a price string like "$45,000" or "Bid to $12,500" into a number.
 */
export function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Detect auction status (SOLD vs ACTIVE) from HTML element.
 * Evidence-based detection using multiple signals.
 */
export function detectStatusFromHtml(
  $: cheerio.CheerioAPI,
  el: cheerio.Element,
): 'active' | 'sold' {
  const $el = $(el);

  // Evidence-based detection - check multiple signals
  const soldSelectors = [
    '.sold-badge',
    '.winner-badge',
    '[class*="sold"]',
    '[class*="winner"]',
    '.auction-sold',
    '.listing-sold',
  ];

  const hasSoldBadge = soldSelectors.some((selector) => $el.find(selector).length > 0);

  const textContent = $el.text().toLowerCase();
  const soldTextPatterns = [
    /sold\s+for\s+\$/,
    /winning\s+bid/,
    /final\s+price/,
    /auction\s+ended/,
    /reserve\s+met\s+.*sold/,
  ];
  const hasSoldText = soldTextPatterns.some((pattern) => pattern.test(textContent));

  const bidStatus = $el.find('[class*="bid-status"], [class*="status"]').text().toLowerCase();
  const hasEndedStatus = bidStatus.includes('ended') || bidStatus.includes('sold');

  if (hasSoldBadge || hasSoldText || hasEndedStatus) {
    return 'sold';
  }

  return 'active';
}

/**
 * Parse a mileage string like "45,230 Miles" into a number.
 */
export function parseMileage(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

/**
 * Extract year, make, and model from an auction title.
 * BaT titles typically follow the pattern: "YEAR MAKE MODEL ..."
 */
export function parseTitleComponents(title: string): {
  year: number;
  make: string;
  model: string;
} {
  const yearMatch = title.match(/^(\d{4})\s+/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;

  // Remove the year prefix and any trailing descriptors
  const rest = title.replace(/^\d{4}\s+/, '').trim();

  // Common makes to match against
  const knownMakes = [
    'Porsche', 'BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Volkswagen', 'VW',
    'Ferrari', 'Lamborghini', 'Maserati', 'Alfa Romeo', 'Fiat', 'Lancia',
    'Toyota', 'Honda', 'Nissan', 'Mazda', 'Subaru', 'Mitsubishi', 'Lexus',
    'Acura', 'Infiniti', 'Datsun', 'Suzuki',
    'Ford', 'Chevrolet', 'Dodge', 'Jeep', 'GMC', 'Cadillac', 'Buick',
    'Lincoln', 'Pontiac', 'Oldsmobile', 'Plymouth', 'Chrysler', 'RAM',
    'Corvette', 'Shelby', 'AMC',
    'Jaguar', 'Land Rover', 'Range Rover', 'Aston Martin', 'Bentley',
    'Rolls-Royce', 'Lotus', 'McLaren', 'Mini', 'MG', 'Triumph',
    'Austin-Healey', 'Morgan', 'TVR',
    'Volvo', 'Saab', 'Koenigsegg',
    'De Tomaso', 'Lada',
  ];

  let make = '';
  let model = rest;

  for (const knownMake of knownMakes) {
    if (rest.toLowerCase().startsWith(knownMake.toLowerCase())) {
      make = knownMake;
      model = rest.slice(knownMake.length).trim();
      break;
    }
  }

  // If no known make was found, take the first word as the make
  if (!make) {
    const parts = rest.split(/\s+/);
    make = parts[0] || '';
    model = parts.slice(1).join(' ');
  }

  return { year, make, model };
}

/**
 * Generate a deterministic external ID from a BaT auction URL.
 */
export function extractExternalId(url: string): string {
  // BaT URLs look like: /listing/1990-porsche-911-carrera-4-cabriolet/
  const match = url.match(/\/listing\/([^/]+)/);
  if (match) return `bat-${match[1]}`;

  // Fallback: hash the URL
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `bat-${Math.abs(hash)}`;
}

// ---------------------------------------------------------------------------
// Listing page scraper
// ---------------------------------------------------------------------------

export async function scrapeListings(
  maxPages: number = 3,
): Promise<{ auctions: BaTAuction[]; errors: string[] }> {
  const auctions: BaTAuction[] = [];
  const errors: string[] = [];

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1 ? AUCTIONS_URL : `${AUCTIONS_URL}/?page=${page}`;
      console.log(`[BaT] Scraping listings page ${page}: ${url}`);

      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      // BaT auction cards are typically within .auctions-list or similar containers
      const auctionCards = $('.auction-item, .listing-card, [data-auction]');

      if (auctionCards.length === 0 && page === 1) {
        // Try alternative selectors for BaT's layout
        const altCards = $('a[href*="/listing/"]').closest('li, .auction-card, article');
        if (altCards.length === 0) {
          errors.push(`[BaT] No auction cards found on page ${page}. Site structure may have changed.`);
          break;
        }

        altCards.each((_i, el) => {
          try {
            const auction = parseAuctionCard($, el);
            if (auction) auctions.push(auction);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown parse error';
            errors.push(`[BaT] Failed to parse auction card: ${message}`);
          }
        });
      } else {
        auctionCards.each((_i, el) => {
          try {
            const auction = parseAuctionCard($, el);
            if (auction) auctions.push(auction);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown parse error';
            errors.push(`[BaT] Failed to parse auction card: ${message}`);
          }
        });
      }

      console.log(`[BaT] Found ${auctions.length} auctions so far (page ${page})`);

      // Rate limit between pages
      if (page < maxPages) {
        await randomDelay(REQUEST_DELAY_MS, REQUEST_DELAY_MS + 1000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`[BaT] Error scraping page ${page}: ${message}`);

      // If the first page fails, stop entirely
      if (page === 1) break;
    }
  }

  return { auctions, errors };
}

export function parseAuctionCard(
  $: cheerio.CheerioAPI,
  el: cheerio.Element,
): BaTAuction | null {
  const $el = $(el);

  // Extract the link to the auction detail page
  const linkEl = $el.find('a[href*="/listing/"]').first();
  const relativeUrl = linkEl.attr('href') || $el.find('a').first().attr('href');
  if (!relativeUrl) return null;

  const url = relativeUrl.startsWith('http') ? relativeUrl : `${BASE_URL}${relativeUrl}`;
  const externalId = extractExternalId(url);

  // Title
  const title =
    $el.find('.auction-title, .listing-title, h3, h2').first().text().trim() ||
    linkEl.text().trim() ||
    '';

  if (!title) return null;

  const { year, make, model } = parseTitleComponents(title);

  // Thumbnail image
  const imageUrl =
    $el.find('img').first().attr('src') ||
    $el.find('img').first().attr('data-src') ||
    null;

  // Current bid
  const bidText =
    $el.find('.auction-bid, .current-bid, .bid-value, [class*="bid"]').first().text().trim();
  const currentBid = parsePrice(bidText);

  // Bid count
  const bidCountText =
    $el.find('.bid-count, .bids, [class*="bid-count"]').first().text().trim();
  const bidCountMatch = bidCountText.match(/(\d+)/);
  const bidCount = bidCountMatch ? parseInt(bidCountMatch[1], 10) : 0;

  // End time
  const timeText =
    $el.find('.auction-end, .time-left, time, [class*="time"]').first().attr('datetime') ||
    $el.find('.auction-end, .time-left, time, [class*="time"]').first().text().trim();
  let endTime: Date | null = null;
  if (timeText) {
    const parsed = new Date(timeText);
    if (!isNaN(parsed.getTime())) endTime = parsed;
  }

  // Detect status from HTML evidence
  const status = detectStatusFromHtml($, el);

  return {
    externalId,
    platform: 'BRING_A_TRAILER',
    title,
    make,
    model,
    year,
    mileage: null,
    mileageUnit: 'miles',
    transmission: null,
    engine: null,
    exteriorColor: null,
    interiorColor: null,
    location: null,
    currentBid,
    bidCount,
    endTime,
    url,
    imageUrl,
    description: null,
    sellerNotes: null,
    status,
    vin: null,
    images: imageUrl ? [imageUrl] : [],
  };
}

// ---------------------------------------------------------------------------
// Detail page scraper
// ---------------------------------------------------------------------------

export async function scrapeDetail(auction: BaTAuction): Promise<BaTAuction> {
  try {
    console.log(`[BaT] Scraping detail: ${auction.url}`);
    await randomDelay(REQUEST_DELAY_MS, REQUEST_DELAY_MS + 1500);

    const html = await fetchPage(auction.url);
    const $ = cheerio.load(html);

    // Description
    const description =
      $('.post-excerpt, .listing-description, .post-content, article .entry-content')
        .first()
        .text()
        .trim() || null;

    // Seller notes
    const sellerNotes =
      $('[class*="seller-note"], [class*="seller_note"]').first().text().trim() || null;

    // Vehicle essentials - BaT typically has a specs/essentials section
    const essentials = new Map<string, string>();
    $('.essentials li, .listing-essentials li, .vehicle-details dt, .specs-list li').each(
      (_i, el) => {
        const text = $(el).text().trim();
        const [key, ...valueParts] = text.split(':');
        if (key && valueParts.length > 0) {
          essentials.set(key.trim().toLowerCase(), valueParts.join(':').trim());
        }
      },
    );

    // Also try key-value table rows
    $('table.essentials tr, .listing-essentials-table tr').each((_i, el) => {
      const key = $(el).find('td:first-child, th').text().trim().toLowerCase();
      const value = $(el).find('td:last-child').text().trim();
      if (key && value) essentials.set(key, value);
    });

    // Parse mileage from essentials or from the page
    const mileageStr =
      essentials.get('miles') ||
      essentials.get('mileage') ||
      essentials.get('odometer') ||
      essentials.get('kilometers');
    const mileage = parseMileage(mileageStr);
    const mileageUnit =
      mileageStr && /km|kilometer/i.test(mileageStr) ? 'km' : 'miles';

    // Transmission
    const transmission =
      essentials.get('transmission') ||
      essentials.get('gearbox') ||
      null;

    // Engine
    const engine =
      essentials.get('engine') ||
      essentials.get('motor') ||
      essentials.get('powertrain') ||
      null;

    // Colors
    const exteriorColor =
      essentials.get('exterior color') ||
      essentials.get('exterior') ||
      essentials.get('color') ||
      null;

    const interiorColor =
      essentials.get('interior color') ||
      essentials.get('interior') ||
      null;

    // Location
    const location =
      essentials.get('location') ||
      essentials.get('seller location') ||
      null;

    // VIN
    const vin =
      essentials.get('vin') ||
      essentials.get('chassis') ||
      null;

    // Images
    const images: string[] = [];
    $(
      '.gallery img, .carousel img, .listing-gallery img, .post-image img, .image-gallery img',
    ).each((_i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !images.includes(src)) {
        images.push(src);
      }
    });

    // Current bid from detail page (may be more up-to-date)
    const detailBidText =
      $('.current-bid, .auction-bid-value, [class*="current-bid"]').first().text().trim();
    const detailBid = parsePrice(detailBidText);

    // Bid count from detail page
    const detailBidCountText =
      $('.bid-count, .total-bids, [class*="bid-count"]').first().text().trim();
    const detailBidCountMatch = detailBidCountText.match(/(\d+)/);
    const detailBidCount = detailBidCountMatch
      ? parseInt(detailBidCountMatch[1], 10)
      : auction.bidCount;

    return {
      ...auction,
      mileage: mileage ?? auction.mileage,
      mileageUnit: mileageUnit || auction.mileageUnit,
      transmission: transmission ?? auction.transmission,
      engine: engine ?? auction.engine,
      exteriorColor: exteriorColor ?? auction.exteriorColor,
      interiorColor: interiorColor ?? auction.interiorColor,
      location: location ?? auction.location,
      currentBid: detailBid ?? auction.currentBid,
      bidCount: detailBidCount || auction.bidCount,
      description: description ?? auction.description,
      sellerNotes: sellerNotes ?? auction.sellerNotes,
      vin: vin ?? auction.vin,
      images: images.length > 0 ? images : auction.images,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[BaT] Error scraping detail ${auction.url}: ${message}`);
    return auction;
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function scrapeBringATrailer(options?: {
  maxPages?: number;
  scrapeDetails?: boolean;
  maxDetails?: number;
}): Promise<{ auctions: BaTAuction[]; errors: string[] }> {
  const maxPages = options?.maxPages ?? 2;
  const scrapeDetails = options?.scrapeDetails ?? false;
  const maxDetails = options?.maxDetails ?? 10;

  console.log('[BaT] Starting Bring a Trailer scrape...');
  const startTime = Date.now();

  // Step 1: Scrape listing pages
  const { auctions, errors } = await scrapeListings(maxPages);

  // Step 2: Optionally scrape detail pages for richer data
  if (scrapeDetails && auctions.length > 0) {
    const toScrape = auctions.slice(0, maxDetails);
    console.log(`[BaT] Scraping ${toScrape.length} detail pages...`);

    for (let i = 0; i < toScrape.length; i++) {
      try {
        const detailed = await scrapeDetail(toScrape[i]);
        // Replace the listing-level data with detail-level data
        const idx = auctions.findIndex((a) => a.externalId === detailed.externalId);
        if (idx !== -1) auctions[idx] = detailed;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`[BaT] Detail scrape failed for ${toScrape[i].url}: ${message}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[BaT] Scrape complete: ${auctions.length} auctions, ${errors.length} errors, ${durationMs}ms`,
  );

  return { auctions, errors };
}
