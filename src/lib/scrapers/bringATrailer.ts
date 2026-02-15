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
  reserveStatus: string | null;  // "NO_RESERVE" | "RESERVE_MET" | "RESERVE_NOT_MET"
  bodyStyle: string | null;
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
  // Try year at start first, then anywhere in title (handles prefixes like "19k-Mile 2001 ...")
  const yearMatch = title.match(/^(\d{4})\s+/) || title.match(/\b((?:19|20)\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;

  // Remove everything up to and including the year, or just the leading year
  let rest: string;
  if (yearMatch && yearMatch.index !== undefined && yearMatch.index > 0) {
    // Year was found mid-string; strip prefix + year
    rest = title.slice(yearMatch.index + yearMatch[0].length).trim();
  } else {
    rest = title.replace(/^\d{4}\s+/, '').trim();
  }

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
    reserveStatus: null,
    bodyStyle: null,
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

    // Seller notes — BaT has no CSS class; look for headings containing "seller"
    let sellerNotes: string | null = null;
    $('.post-content h3, .post-content strong, .post-content h2').each((_i, el) => {
      if (sellerNotes) return; // already found
      const heading = $(el).text().trim();
      if (/\bseller\b/i.test(heading)) {
        // Grab the next sibling paragraph(s) as the seller note text
        const next = $(el).nextAll('p').first().text().trim();
        if (next) {
          sellerNotes = next;
        } else {
          // Try parent's next sibling
          const parentNext = $(el).parent().next('p').text().trim();
          if (parentNext) sellerNotes = parentNext;
        }
      }
    });
    // Fallback: try legacy selectors just in case
    if (!sellerNotes) {
      sellerNotes = $('[class*="seller-note"], [class*="seller_note"], .seller-description, .seller-story').first().text().trim() || null;
    }

    // ── BaT Essentials Section ──
    // BaT essentials are <li> items inside div.essentials.
    // Most items have NO key:value format — they're plain text like:
    //   "33k Miles", "6.3-Liter F140 V12", "Seven-Speed Dual-Clutch Transaxle",
    //   "Rubino Micalizzato Paint", "Tan Leather and Alcantara Upholstery"
    // Only a few have colons: "Chassis: ZFF73SKAXD0194941"

    const essentialTexts: string[] = [];
    const essentialsKeyed = new Map<string, string>();

    // Parse <li> items inside .essentials
    $('.essentials li').each((_i, el) => {
      const text = $(el).text().trim();
      if (!text) return;
      const colonIdx = text.indexOf(':');
      if (colonIdx > 0 && colonIdx < 30) {
        const key = text.slice(0, colonIdx).trim().toLowerCase();
        const val = text.slice(colonIdx + 1).trim();
        essentialsKeyed.set(key, val);
        // Push only the value so regex patterns match cleanly
        if (val) essentialTexts.push(val);
      } else {
        essentialTexts.push(text);
      }
    });

    // Also parse <table class="essentials"> rows (alternate BaT layout)
    $('table.essentials tr, .essentials table tr').each((_i, el) => {
      const cells = $(el).find('td');
      if (cells.length >= 2) {
        const key = $(cells[0]).text().trim().toLowerCase();
        const val = $(cells[1]).text().trim();
        if (key && val) {
          essentialsKeyed.set(key, val);
          // Push plain value to essentialTexts so regex patterns can match
          essentialTexts.push(val);
        }
      }
    });

    // VIN — from "Chassis: ..." keyed item
    const vin = essentialsKeyed.get('chassis') || essentialsKeyed.get('vin') || null;

    // Mileage — match patterns like "33k Miles", "~12,345 Miles", "Showing 8k Kilometers"
    let mileage: number | null = null;
    let mileageUnit = 'miles';
    for (const text of essentialTexts) {
      const mileageMatch = text.match(/^~?\s*(?:showing\s+|indicated\s+)?([\d,]+k?)\s*(miles?|kilometers?|km)\b/i);
      if (mileageMatch) {
        let raw = mileageMatch[1].replace(/,/g, '');
        if (raw.toLowerCase().endsWith('k')) {
          mileage = parseFloat(raw.slice(0, -1)) * 1000;
        } else {
          mileage = parseInt(raw, 10);
        }
        mileageUnit = /km|kilometer/i.test(mileageMatch[2]) ? 'km' : 'miles';
        break;
      }
    }
    // Fallback: keyed format "Miles: 45,230" or "Kilometers: 8,000"
    if (mileage === null) {
      const keyedMiles = essentialsKeyed.get('miles') || essentialsKeyed.get('mileage');
      const keyedKm = essentialsKeyed.get('kilometers') || essentialsKeyed.get('km');
      const keyedVal = keyedMiles || keyedKm;
      if (keyedVal) {
        const cleaned = keyedVal.replace(/[^0-9]/g, '');
        const num = parseInt(cleaned, 10);
        if (!isNaN(num)) {
          mileage = num;
          mileageUnit = keyedKm ? 'km' : 'miles';
        }
      }
    }

    // Engine — match patterns containing liter/L, V-config, cylinder count, etc.
    let engine: string | null = null;
    for (const text of essentialTexts) {
      if (/\d[\d.]*[\s-]?liter|[vV]\d{1,2}\b|flat[\s-]?\d|inline[\s-]?\d|twin[\s-]?turbo|turbo(charged)?|supercharged|boxer|rotary/i.test(text)) {
        engine = text;
        break;
      }
    }
    // Fallback: keyed "Engine: 3.6L Flat-6"
    if (!engine) {
      engine = essentialsKeyed.get('engine') || null;
    }

    // Transmission — match patterns with speed/manual/automatic/clutch/transaxle/PDK
    // Note: \bF1\b avoids matching "F140" engine codes
    let transmission: string | null = null;
    for (const text of essentialTexts) {
      if (/speed|manual|automatic|dual[\s-]?clutch|transaxle|\bPDK\b|tiptronic|sequential|\bF1\b|SMG|gearbox|CVT/i.test(text)) {
        transmission = text;
        break;
      }
    }
    // Fallback: keyed "Transmission: 5-Speed Manual"
    if (!transmission) {
      transmission = essentialsKeyed.get('transmission') || null;
    }

    // Exterior color — items ending with "Paint", containing metallic/pearl, or Italian color names
    const INTERIOR_KEYWORDS = /\b(leather|upholstery|alcantara|interior|cloth|suede|nappa)\b/i;
    let exteriorColor: string | null = null;
    for (const text of essentialTexts) {
      // Skip items that look like interior descriptions
      if (INTERIOR_KEYWORDS.test(text)) continue;
      if (/paint$/i.test(text) || /\b(metallic|micalizzato|pearl)\b/i.test(text)) {
        exteriorColor = text.replace(/\s*paint$/i, '').trim();
        break;
      }
      // Match Italian/common Ferrari color names (standalone, not inside engine/transmission text)
      if (/\b(rosso|nero|grigio|bianco|giallo|blu|azzurro|argento|verde|marrone|avorio|crema|nocciola)\b/i.test(text)) {
        // Guard: skip if this looks like an engine, transmission, or mileage item
        if (/liter|[vV]\d|turbo|speed|manual|automatic|clutch|transaxle|PDK|miles?|km/i.test(text)) continue;
        exteriorColor = text.trim();
        break;
      }
    }

    // Fallback: keyed "Exterior Color: Guards Red"
    if (!exteriorColor) {
      exteriorColor = essentialsKeyed.get('exterior color') || essentialsKeyed.get('color') || null;
    }

    // Interior color — items containing upholstery, leather, alcantara, suede, nappa, etc.
    let interiorColor: string | null = null;
    for (const text of essentialTexts) {
      if (/\b(upholstery|leather|alcantara|cloth|suede|nappa|interior)\b/i.test(text)) {
        // Guard: skip if this looks like an engine, transmission, or mileage item
        if (/liter|[vV]\d|turbo|speed|manual|automatic|clutch|transaxle|PDK|miles?|km/i.test(text)) continue;
        interiorColor = text.replace(/\s*upholstery$/i, '').trim();
        break;
      }
    }
    // Fallback: keyed "Interior Color: Black Leather"
    if (!interiorColor) {
      interiorColor = essentialsKeyed.get('interior color') || essentialsKeyed.get('interior') || null;
    }

    // Location — BaT has: <strong>Location</strong> <a>City, State ZIP</a>
    // The <strong> is a direct child of .essentials, followed by a sibling <a>
    let location: string | null = null;
    $('.essentials strong').each((_i, el) => {
      if ($(el).text().trim().toLowerCase() === 'location') {
        const link = $(el).next('a');
        if (link.length > 0) {
          location = link.text().trim() || null;
        }
      }
    });
    // Fallback: keyed "Location: San Francisco, CA"
    if (!location) {
      location = essentialsKeyed.get('location') || null;
    }

    // Images — BaT photos are img tags with wp-content/uploads or CDN URLs
    // Also collect images inside .gallery containers
    // Filter to main content only, avoid related listings at bottom
    const images: string[] = [];

    // Get all images but filter out those in related sections
    $('img').each((_i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';

      // Accept content images from BaT domains, or images inside .gallery
      const isContentImage = src.includes('wp-content/uploads') || src.includes('cdn.bringatrailer.com');
      const isGalleryImage = $(el).closest('.gallery, .carousel, [class*="gallery"]').length > 0;
      if ((!isContentImage && !isGalleryImage) || !/\.(jpg|jpeg|png|webp)/i.test(src)) {
        return;
      }
      
      // Skip tiny thumbnails and icons
      if (src.includes('resize=235') || src.includes('resize=144') || src.includes('icon')) {
        return;
      }
      
      // Check if this image is inside a related listings section
      const $parent = $(el).closest('.related-listings, .recent-listings, .sidebar, .footer, [class*="related"]');
      if ($parent.length > 0) {
        return; // Skip images in related sections
      }
      
      // Check if image dimensions suggest it's a gallery photo (larger images)
      const width = $(el).attr('width');
      const height = $(el).attr('height');
      if (width && parseInt(width) < 300) {
        return; // Skip small images
      }
      
      if (images.indexOf(src) === -1) {
        images.push(src);
      }
    });
    
    // No artificial cap — related-section filtering above is sufficient
    const finalImages = images;

    // Reserve status — check essentials, badges, and listing info area
    let reserveStatus: string | null = null;
    for (const text of essentialTexts) {
      if (/^no\s+reserve$/i.test(text)) {
        reserveStatus = 'NO_RESERVE';
        break;
      }
    }
    if (!reserveStatus) {
      // Check for reserve badges/labels in the page
      const reserveBadge = $('.no-reserve, [class*="reserve"]').first().text().trim();
      if (/no\s+reserve/i.test(reserveBadge)) {
        reserveStatus = 'NO_RESERVE';
      }
    }
    if (!reserveStatus) {
      const listingInfo = $('.listing-available-info, .auction-status, [class*="reserve-status"]').text().trim();
      if (/reserve\s+not\s+met/i.test(listingInfo)) {
        reserveStatus = 'RESERVE_NOT_MET';
      } else if (/reserve\s+met/i.test(listingInfo)) {
        reserveStatus = 'RESERVE_MET';
      }
    }

    // Body style — check essentials for known body type keywords
    let bodyStyle: string | null = null;
    for (const text of essentialTexts) {
      const bodyMatch = text.match(/\b(coupe|coupé|spider|spyder|convertible|berlinetta|targa|roadster|cabriolet|sedan|wagon|hatchback|SUV)\b/i);
      if (bodyMatch) {
        // Skip if this item is clearly about engine or transmission
        if (/liter|[vV]\d|turbo|speed|manual|automatic|clutch|transaxle|PDK/i.test(text)) continue;
        bodyStyle = bodyMatch[1];
        break;
      }
    }

    // Current bid — from ".current-bid-value" or ".current-bid"
    let detailBid: number | null = null;
    const bidValueText = ($('.current-bid-value').first().text().trim()
      || $('.current-bid').first().text().trim());
    if (bidValueText) {
      const priceMatch = bidValueText.match(/\$[\d,]+/);
      if (priceMatch) {
        detailBid = parsePrice(priceMatch[0]);
      }
    }

    // Bid count — from ".number-bids-value" or ".bid-count"
    const bidCountText = ($('.number-bids-value').first().text().trim()
      || $('.bid-count').first().text().trim());
    const bidCountMatch = bidCountText.match(/(\d+)/);
    const detailBidCount = bidCountMatch
      ? parseInt(bidCountMatch[1], 10)
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
      images: finalImages.length > 0 ? finalImages : auction.images,
      reserveStatus: reserveStatus ?? auction.reserveStatus,
      bodyStyle: bodyStyle ?? auction.bodyStyle,
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
