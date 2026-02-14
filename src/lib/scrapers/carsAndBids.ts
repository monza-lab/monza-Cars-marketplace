// @ts-nocheck
// ---------------------------------------------------------------------------
// Cars & Bids Scraper
// ---------------------------------------------------------------------------
// IMPORTANT: This scraper is intended for educational and research purposes
// only. Always check and respect robots.txt before scraping any website.
// Cars & Bids terms of service should be reviewed before use.
// Use responsibly with appropriate rate limiting.
// ---------------------------------------------------------------------------

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CaBAuction {
  externalId: string;
  platform: 'CARS_AND_BIDS';
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

const BASE_URL = 'https://carsandbids.com';
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
};

const REQUEST_DELAY_MS = 2500;
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

export function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function parseMileage(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

/**
 * Extract year, make, and model from a Cars & Bids auction title.
 * Titles typically follow: "YEAR MAKE MODEL TRIM"
 */
export function parseTitleComponents(title: string): {
  year: number;
  make: string;
  model: string;
} {
  // Try year at start first, then anywhere in title (handles prefixes like "No Reserve: 2003 ...")
  const yearMatch = title.match(/^(\d{4})\s+/) || title.match(/\b((?:19|20)\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;

  // Remove everything up to and including the year, or just the leading year
  let rest: string;
  if (yearMatch && yearMatch.index !== undefined && yearMatch.index > 0) {
    rest = title.slice(yearMatch.index + yearMatch[0].length).trim();
  } else {
    rest = title.replace(/^\d{4}\s+/, '').trim();
  }

  const knownMakes = [
    'Porsche', 'BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Volkswagen', 'VW',
    'Ferrari', 'Lamborghini', 'Maserati', 'Alfa Romeo', 'Fiat',
    'Toyota', 'Honda', 'Nissan', 'Mazda', 'Subaru', 'Mitsubishi', 'Lexus',
    'Acura', 'Infiniti', 'Datsun',
    'Ford', 'Chevrolet', 'Dodge', 'Jeep', 'GMC', 'Cadillac', 'Buick',
    'Lincoln', 'Pontiac', 'Oldsmobile', 'Plymouth', 'Chrysler', 'RAM',
    'Corvette', 'Shelby', 'AMC',
    'Jaguar', 'Land Rover', 'Range Rover', 'Aston Martin', 'Bentley',
    'Rolls-Royce', 'Lotus', 'McLaren', 'Mini', 'MG', 'Triumph',
    'Austin-Healey', 'Morgan',
    'Volvo', 'Saab',
    'De Tomaso', 'Genesis', 'Rivian', 'Tesla', 'Lucid', 'Polestar',
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

  if (!make) {
    const parts = rest.split(/\s+/);
    make = parts[0] || '';
    model = parts.slice(1).join(' ');
  }

  return { year, make, model };
}

export function extractExternalId(url: string): string {
  // C&B URLs look like: /auctions/2023-porsche-911-gt3-rs
  const match = url.match(/\/auctions\/([^/?#]+)/);
  if (match) return `cab-${match[1]}`;

  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `cab-${Math.abs(hash)}`;
}

// ---------------------------------------------------------------------------
// Listing page scraper
// ---------------------------------------------------------------------------

export async function scrapeListings(
  maxPages: number = 3,
): Promise<{ auctions: CaBAuction[]; errors: string[] }> {
  const auctions: CaBAuction[] = [];
  const errors: string[] = [];

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1 ? AUCTIONS_URL : `${AUCTIONS_URL}?page=${page}`;
      console.log(`[C&B] Scraping listings page ${page}: ${url}`);

      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      // Cars & Bids uses auction-card style layout
      const auctionCards = $(
        '.auction-card, .auction-item, [class*="auction-card"], [class*="listing-item"]',
      );

      if (auctionCards.length === 0) {
        // Try alternative: look for links to individual auctions
        const altCards = $('a[href*="/auctions/"]')
          .filter((_i, el) => {
            const href = $(el).attr('href') || '';
            // Filter out pagination and category links
            return /\/auctions\/[a-z0-9-]+/.test(href) && !href.includes('?page=');
          })
          .closest('li, article, div[class*="card"], div[class*="auction"]');

        if (altCards.length === 0 && page === 1) {
          errors.push(`[C&B] No auction cards found on page ${page}. Site structure may have changed.`);
          break;
        }

        altCards.each((_i, el) => {
          try {
            const auction = parseAuctionCard($, el);
            if (auction) auctions.push(auction);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown parse error';
            errors.push(`[C&B] Failed to parse auction card: ${message}`);
          }
        });
      } else {
        auctionCards.each((_i, el) => {
          try {
            const auction = parseAuctionCard($, el);
            if (auction) auctions.push(auction);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown parse error';
            errors.push(`[C&B] Failed to parse auction card: ${message}`);
          }
        });
      }

      console.log(`[C&B] Found ${auctions.length} auctions so far (page ${page})`);

      if (page < maxPages) {
        await randomDelay(REQUEST_DELAY_MS, REQUEST_DELAY_MS + 1000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`[C&B] Error scraping page ${page}: ${message}`);
      if (page === 1) break;
    }
  }

  return { auctions, errors };
}

export function parseAuctionCard(
  $: cheerio.CheerioAPI,
  el: cheerio.Element,
): CaBAuction | null {
  const $el = $(el);

  const linkEl = $el.find('a[href*="/auctions/"]').first();
  const relativeUrl = linkEl.attr('href') || $el.find('a').first().attr('href');
  if (!relativeUrl) return null;

  const url = relativeUrl.startsWith('http') ? relativeUrl : `${BASE_URL}${relativeUrl}`;

  // Filter out non-auction links
  if (!/\/auctions\/[a-z0-9]/.test(url)) return null;

  const externalId = extractExternalId(url);

  const title =
    $el.find('.auction-title, .card-title, h3, h2').first().text().trim() ||
    linkEl.text().trim() ||
    '';

  if (!title || /^(past|current|featured)/i.test(title)) return null;

  const { year, make, model } = parseTitleComponents(title);

  const imageUrl =
    $el.find('img').first().attr('src') ||
    $el.find('img').first().attr('data-src') ||
    null;

  // Current bid
  const bidText = $el
    .find('.current-bid, .bid-amount, [class*="bid"], [class*="price"]')
    .first()
    .text()
    .trim();
  const currentBid = parsePrice(bidText);

  // Bid count
  const bidCountText = $el
    .find('.bid-count, [class*="bid-count"], [class*="bids"]')
    .first()
    .text()
    .trim();
  const bidCountMatch = bidCountText.match(/(\d+)/);
  const bidCount = bidCountMatch ? parseInt(bidCountMatch[1], 10) : 0;

  // End time
  const timeEl = $el.find('time, [datetime], [class*="time"], [class*="countdown"]').first();
  const timeText = timeEl.attr('datetime') || timeEl.text().trim();
  let endTime: Date | null = null;
  if (timeText) {
    const parsed = new Date(timeText);
    if (!isNaN(parsed.getTime())) endTime = parsed;
  }

  // Quick stats that C&B sometimes shows on cards
  const statsText = $el.find('[class*="stats"], [class*="details"], .subtitle').text();
  const mileageMatch = statsText.match(/([\d,]+)\s*(miles?|mi|km)/i);
  const mileage = mileageMatch ? parseMileage(mileageMatch[1]) : null;
  const mileageUnit =
    mileageMatch && /km/i.test(mileageMatch[2]) ? 'km' : 'miles';

  return {
    externalId,
    platform: 'CARS_AND_BIDS',
    title,
    make,
    model,
    year,
    mileage,
    mileageUnit,
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
    status: 'active',
    vin: null,
    images: imageUrl ? [imageUrl] : [],
  };
}

// ---------------------------------------------------------------------------
// Detail page scraper
// ---------------------------------------------------------------------------

export async function scrapeDetail(auction: CaBAuction): Promise<CaBAuction> {
  try {
    console.log(`[C&B] Scraping detail: ${auction.url}`);
    await randomDelay(REQUEST_DELAY_MS, REQUEST_DELAY_MS + 1500);

    const html = await fetchPage(auction.url);
    const $ = cheerio.load(html);

    // Description
    const description =
      $('.auction-description, .listing-description, .vehicle-description, [class*="description"]')
        .first()
        .text()
        .trim() || null;

    // Seller notes (C&B often has a seller section)
    const sellerNotes =
      $('[class*="seller"], .seller-notes').first().text().trim() || null;

    // Quick facts / specs table
    const specs = new Map<string, string>();
    $(
      '.quick-facts li, .vehicle-specs li, .specs-table tr, .details-table tr, dl dt',
    ).each((_i, el) => {
      const $item = $(el);
      let key: string;
      let value: string;

      if (el.tagName === 'tr') {
        key = $item.find('td:first-child, th').text().trim().toLowerCase();
        value = $item.find('td:last-child').text().trim();
      } else if (el.tagName === 'dt') {
        key = $item.text().trim().toLowerCase();
        value = $item.next('dd').text().trim();
      } else {
        const text = $item.text().trim();
        const parts = text.split(/:\s*/);
        key = (parts[0] || '').toLowerCase();
        value = parts.slice(1).join(':').trim();
      }

      if (key && value) specs.set(key, value);
    });

    const mileageStr =
      specs.get('mileage') || specs.get('miles') || specs.get('odometer');
    const mileage = parseMileage(mileageStr);
    const mileageUnit =
      mileageStr && /km|kilometer/i.test(mileageStr) ? 'km' : 'miles';

    const transmission = specs.get('transmission') || specs.get('gearbox') || null;
    const engine = specs.get('engine') || specs.get('powertrain') || null;
    const exteriorColor =
      specs.get('exterior color') || specs.get('exterior') || null;
    const interiorColor =
      specs.get('interior color') || specs.get('interior') || null;
    const location =
      specs.get('location') || specs.get('seller location') || null;
    const vin = specs.get('vin') || specs.get('chassis') || null;

    // Images
    const images: string[] = [];
    $(
      '.gallery img, .carousel img, .auction-photos img, [class*="gallery"] img, .photo-gallery img',
    ).each((_i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !images.includes(src)) images.push(src);
    });

    // Updated bid info
    const detailBidText = $(
      '.current-bid, .high-bid, [class*="current-bid"]',
    )
      .first()
      .text()
      .trim();
    const detailBid = parsePrice(detailBidText);

    const detailBidCountText = $(
      '.bid-count, .total-bids, [class*="bid-count"]',
    )
      .first()
      .text()
      .trim();
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
    console.error(`[C&B] Error scraping detail ${auction.url}: ${message}`);
    return auction;
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function scrapeCarsAndBids(options?: {
  maxPages?: number;
  scrapeDetails?: boolean;
  maxDetails?: number;
}): Promise<{ auctions: CaBAuction[]; errors: string[] }> {
  const maxPages = options?.maxPages ?? 2;
  const scrapeDetails = options?.scrapeDetails ?? false;
  const maxDetails = options?.maxDetails ?? 10;

  console.log('[C&B] Starting Cars & Bids scrape...');
  const startTime = Date.now();

  const { auctions, errors } = await scrapeListings(maxPages);

  if (scrapeDetails && auctions.length > 0) {
    const toScrape = auctions.slice(0, maxDetails);
    console.log(`[C&B] Scraping ${toScrape.length} detail pages...`);

    for (let i = 0; i < toScrape.length; i++) {
      try {
        const detailed = await scrapeDetail(toScrape[i]);
        const idx = auctions.findIndex((a) => a.externalId === detailed.externalId);
        if (idx !== -1) auctions[idx] = detailed;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`[C&B] Detail scrape failed for ${toScrape[i].url}: ${message}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[C&B] Scrape complete: ${auctions.length} auctions, ${errors.length} errors, ${durationMs}ms`,
  );

  return { auctions, errors };
}
