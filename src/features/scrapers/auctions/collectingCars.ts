// @ts-nocheck
// ---------------------------------------------------------------------------
// Collecting Cars Scraper
// ---------------------------------------------------------------------------
// IMPORTANT: This scraper is intended for educational and research purposes
// only. Always check and respect robots.txt before scraping any website.
// Collecting Cars terms of service should be reviewed before use.
// Use responsibly with appropriate rate limiting.
// ---------------------------------------------------------------------------

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CCarsAuction {
  externalId: string;
  platform: 'COLLECTING_CARS';
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

const BASE_URL = 'https://collectingcars.com';
const AUCTIONS_URL = `${BASE_URL}/search`;

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

const REQUEST_DELAY_MS = 3000; // Collecting Cars gets slightly longer delay
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
  // Collecting Cars uses GBP, EUR, and USD. Normalize to numeric value.
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
    '.sale-completed',
    '.ended',
  ];

  const hasSoldBadge = soldSelectors.some((selector) => $el.find(selector).length > 0);

  const textContent = $el.text().toLowerCase();
  const soldTextPatterns = [
    /sold\s+for/,
    /winning\s+bid/,
    /final\s+price/,
    /auction\s+ended/,
    /sale\s+completed/,
    /reserve\s+met\s+.*sold/,
  ];
  const hasSoldText = soldTextPatterns.some((pattern) => pattern.test(textContent));

  const bidStatus = $el.find('[class*="bid-status"], [class*="status"]').text().toLowerCase();
  const hasEndedStatus = bidStatus.includes('ended') || bidStatus.includes('sold') || bidStatus.includes('completed');

  if (hasSoldBadge || hasSoldText || hasEndedStatus) {
    return 'sold';
  }

  return 'active';
}

/**
 * Parse Collecting Cars title for year, make, model.
 * CC titles vary: "1992 Porsche 964 Carrera RS" or "Porsche 911 (993) Turbo - 1996"
 */
export function parseTitleComponents(title: string): {
  year: number;
  make: string;
  model: string;
} {
  // Check for year at the beginning
  let yearMatch = title.match(/^(\d{4})\s+/);
  let year = 0;
  let rest = title;

  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
    rest = title.replace(/^\d{4}\s+/, '').trim();
  } else {
    // Check for year at the end: "Porsche 911 - 1996"
    yearMatch = title.match(/[-\s]+(\d{4})$/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
      rest = title.replace(/[-\s]+\d{4}$/, '').trim();
    } else {
      // Check for year anywhere in title (handles prefixes)
      yearMatch = title.match(/\b((?:19|20)\d{2})\b/);
      if (yearMatch && yearMatch.index !== undefined) {
        year = parseInt(yearMatch[1], 10);
        rest = title.slice(yearMatch.index + yearMatch[0].length).trim();
      }
    }
  }

  const knownMakes = [
    'Porsche', 'BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Volkswagen', 'VW',
    'Ferrari', 'Lamborghini', 'Maserati', 'Alfa Romeo', 'Fiat', 'Lancia',
    'Toyota', 'Honda', 'Nissan', 'Mazda', 'Subaru', 'Mitsubishi', 'Lexus',
    'Ford', 'Chevrolet', 'Dodge', 'Jeep', 'Cadillac',
    'Corvette', 'Shelby',
    'Jaguar', 'Land Rover', 'Range Rover', 'Aston Martin', 'Bentley',
    'Rolls-Royce', 'Lotus', 'McLaren', 'Mini', 'MG', 'Triumph',
    'Austin-Healey', 'Morgan', 'TVR', 'Caterham',
    'Volvo', 'Saab', 'Koenigsegg', 'Pagani', 'Bugatti',
    'De Tomaso', 'Alpine', 'Peugeot', 'Citroen', 'Renault',
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
  // CC URLs: /cars/1992-porsche-964-carrera-rs or /lots/...
  const match = url.match(/\/(cars|lots)\/([^/?#]+)/);
  if (match) return `cc-${match[2]}`;

  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `cc-${Math.abs(hash)}`;
}

// ---------------------------------------------------------------------------
// Listing page scraper
// ---------------------------------------------------------------------------

export async function scrapeListings(
  maxPages: number = 3,
): Promise<{ auctions: CCarsAuction[]; errors: string[] }> {
  const auctions: CCarsAuction[] = [];
  const errors: string[] = [];

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1 ? AUCTIONS_URL : `${AUCTIONS_URL}?page=${page}`;
      console.log(`[CC] Scraping listings page ${page}: ${url}`);

      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      // Collecting Cars uses card-based layout
      const auctionCards = $(
        '.lot-card, .search-result, .auction-card, [class*="lot-card"], [class*="search-result"]',
      );

      if (auctionCards.length === 0) {
        // Fallback: find links to car/lot detail pages
        const altCards = $('a[href*="/cars/"], a[href*="/lots/"]')
          .filter((_i, el) => {
            const href = $(el).attr('href') || '';
            return /\/(cars|lots)\/[a-z0-9-]+/.test(href);
          })
          .closest('li, article, div[class*="card"], div[class*="lot"]');

        if (altCards.length === 0 && page === 1) {
          errors.push(
            `[CC] No auction cards found on page ${page}. Site structure may have changed.`,
          );
          break;
        }

        altCards.each((_i, el) => {
          try {
            const auction = parseAuctionCard($, el);
            if (auction) auctions.push(auction);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown parse error';
            errors.push(`[CC] Failed to parse auction card: ${message}`);
          }
        });
      } else {
        auctionCards.each((_i, el) => {
          try {
            const auction = parseAuctionCard($, el);
            if (auction) auctions.push(auction);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown parse error';
            errors.push(`[CC] Failed to parse auction card: ${message}`);
          }
        });
      }

      console.log(`[CC] Found ${auctions.length} auctions so far (page ${page})`);

      if (page < maxPages) {
        await randomDelay(REQUEST_DELAY_MS, REQUEST_DELAY_MS + 1000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`[CC] Error scraping page ${page}: ${message}`);
      if (page === 1) break;
    }
  }

  return { auctions, errors };
}

export function parseAuctionCard(
  $: cheerio.CheerioAPI,
  el: cheerio.Element,
): CCarsAuction | null {
  const $el = $(el);

  const linkEl = $el.find('a[href*="/cars/"], a[href*="/lots/"]').first();
  const relativeUrl = linkEl.attr('href') || $el.find('a').first().attr('href');
  if (!relativeUrl) return null;

  const url = relativeUrl.startsWith('http') ? relativeUrl : `${BASE_URL}${relativeUrl}`;

  if (!/\/(cars|lots)\/[a-z0-9]/.test(url)) return null;

  const externalId = extractExternalId(url);

  const title =
    $el.find('.lot-title, .card-title, h3, h2, [class*="title"]').first().text().trim() ||
    linkEl.text().trim() ||
    '';

  if (!title) return null;

  const { year, make, model } = parseTitleComponents(title);

  const imageUrl =
    $el.find('img').first().attr('src') ||
    $el.find('img').first().attr('data-src') ||
    null;

  // Bid / price
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

  // Quick stats from card
  const statsText = $el.text();
  const mileageMatch = statsText.match(/([\d,]+)\s*(miles?|mi|km|kilometres?)/i);
  const mileage = mileageMatch ? parseMileage(mileageMatch[1]) : null;
  const mileageUnit =
    mileageMatch && /km|kilomet/i.test(mileageMatch[2]) ? 'km' : 'miles';

  // Location - CC often shows country/region on card
  const locationText = $el
    .find('[class*="location"], .lot-location')
    .first()
    .text()
    .trim();
  const location = locationText || null;

  // Detect status from HTML evidence
  const status = detectStatusFromHtml($, el);

  return {
    externalId,
    platform: 'COLLECTING_CARS',
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
    location,
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

export async function scrapeDetail(auction: CCarsAuction): Promise<CCarsAuction> {
  try {
    console.log(`[CC] Scraping detail: ${auction.url}`);
    await randomDelay(REQUEST_DELAY_MS, REQUEST_DELAY_MS + 1500);

    const html = await fetchPage(auction.url);
    const $ = cheerio.load(html);

    // Description
    const description =
      $(
        '.lot-description, .vehicle-description, .listing-description, [class*="description"]',
      )
        .first()
        .text()
        .trim() || null;

    // Seller notes
    const sellerNotes =
      $('[class*="seller-note"], [class*="seller_note"]').first().text().trim() || null;

    // Specifications table - CC typically has a structured specs section
    const specs = new Map<string, string>();

    // Try key-value pairs in various formats
    $(
      '.lot-details li, .specifications li, .vehicle-specs li, .key-facts li, dl dt, .specs-table tr',
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
        // Try "Key: Value" format
        const colonSplit = text.split(/:\s*/);
        if (colonSplit.length >= 2) {
          key = colonSplit[0].toLowerCase();
          value = colonSplit.slice(1).join(':').trim();
        } else {
          // Try label + value within child elements
          key = $item.find('.label, .key, strong, b').text().trim().toLowerCase();
          value = $item.find('.value, .detail').text().trim() || text.replace(key, '').trim();
        }
      }

      if (key && value) specs.set(key, value);
    });

    const mileageStr =
      specs.get('mileage') ||
      specs.get('odometer') ||
      specs.get('miles') ||
      specs.get('kilometres') ||
      specs.get('km');
    const mileage = parseMileage(mileageStr);
    const mileageUnit =
      mileageStr && /km|kilomet/i.test(mileageStr) ? 'km' : 'miles';

    const transmission = specs.get('transmission') || specs.get('gearbox') || null;
    const engine =
      specs.get('engine') || specs.get('engine size') || specs.get('motor') || null;
    const exteriorColor =
      specs.get('exterior colour') ||
      specs.get('exterior color') ||
      specs.get('colour') ||
      specs.get('color') ||
      null;
    const interiorColor =
      specs.get('interior colour') ||
      specs.get('interior color') ||
      specs.get('interior') ||
      null;
    const location =
      specs.get('location') || specs.get('country') || null;
    const vin =
      specs.get('vin') || specs.get('chassis number') || specs.get('chassis') || null;

    // Images
    const images: string[] = [];
    $(
      '.gallery img, .carousel img, .lot-gallery img, [class*="gallery"] img, .photo-slider img',
    ).each((_i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !images.includes(src)) images.push(src);
    });

    // Updated bid info from detail page
    const detailBidText = $(
      '.current-bid, .high-bid, [class*="current-bid"], [class*="high-bid"]',
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
    console.error(`[CC] Error scraping detail ${auction.url}: ${message}`);
    return auction;
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function scrapeCollectingCars(options?: {
  maxPages?: number;
  scrapeDetails?: boolean;
  maxDetails?: number;
}): Promise<{ auctions: CCarsAuction[]; errors: string[] }> {
  const maxPages = options?.maxPages ?? 2;
  const scrapeDetails = options?.scrapeDetails ?? false;
  const maxDetails = options?.maxDetails ?? 10;

  console.log('[CC] Starting Collecting Cars scrape...');
  const startTime = Date.now();

  const { auctions, errors } = await scrapeListings(maxPages);

  if (scrapeDetails && auctions.length > 0) {
    const toScrape = auctions.slice(0, maxDetails);
    console.log(`[CC] Scraping ${toScrape.length} detail pages...`);

    for (let i = 0; i < toScrape.length; i++) {
      try {
        const detailed = await scrapeDetail(toScrape[i]);
        const idx = auctions.findIndex((a) => a.externalId === detailed.externalId);
        if (idx !== -1) auctions[idx] = detailed;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`[CC] Detail scrape failed for ${toScrape[i].url}: ${message}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[CC] Scrape complete: ${auctions.length} auctions, ${errors.length} errors, ${durationMs}ms`,
  );

  return { auctions, errors };
}
