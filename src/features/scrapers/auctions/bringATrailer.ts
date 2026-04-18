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
import { parseBodyStyleFromText, parseEngineFromText, parseTransmissionFromText } from '../common/titleEnrichment';
import { canUseBaTScraplingFallback, fetchBaTDetailHtmlWithScrapling } from './batScrapling';
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
 * Extract mileage from a BaT title like "10k-Mile 2003 Ferrari 360"
 * or "33,000-Mile 2001 Ferrari 550 Maranello".
 */
export function parseMileageFromTitle(title: string): { mileage: number; unit: string } | null {
  const m = title.match(/\b([\d,]+k?)\s*-\s*(miles?|kilometers?|km)\b/i);
  if (!m) return null;
  let raw = m[1].replace(/,/g, '');
  let mileage: number;
  if (raw.toLowerCase().endsWith('k')) {
    mileage = parseFloat(raw.slice(0, -1)) * 1000;
  } else {
    mileage = parseInt(raw, 10);
  }
  if (isNaN(mileage) || mileage <= 0) return null;
  const unit = /km|kilometer/i.test(m[2]) ? 'km' : 'miles';
  return { mileage, unit };
}

/**
 * Extract mileage from a BaT description using context-aware patterns.
 * Requires surrounding context words to avoid false positives on incidental
 * mentions like "drove 500 miles to dealer".
 */
export function parseMileageFromDescription(description: string): { mileage: number; unit: string } | null {
  if (!description) return null;
  const patterns: RegExp[] = [
    /(?:showing|indicates?|reads?|odometer)\s+~?\s*([\d,]+k?)\s*(miles?|kilometers?|km)/i,
    /(?:with|has|at)\s+~?\s*([\d,]+k?)\s*(miles?|kilometers?|km)\s+(?:shown|indicated|on\s+the)/i,
    /([\d,]+k?)\s*(miles?|kilometers?|km)\s+(?:shown|indicated|on\s+the\s+odometer)/i,
  ];
  for (const pattern of patterns) {
    const m = description.match(pattern);
    if (m) {
      let raw = m[1].replace(/,/g, '');
      let mileage: number;
      if (raw.toLowerCase().endsWith('k')) {
        mileage = parseFloat(raw.slice(0, -1)) * 1000;
      } else {
        mileage = parseInt(raw, 10);
      }
      if (isNaN(mileage) || mileage <= 0) continue;
      const unit = /km|kilometer/i.test(m[2]) ? 'km' : 'miles';
      return { mileage, unit };
    }
  }
  return null;
}

/**
 * Extract body style from a BaT title by matching known body type keywords.
 */
export function parseBodyStyleFromTitle(title: string): string | null {
  const m = title.match(/\b(coupe|coupé|spider|spyder|berlinetta|targa|roadster|cabriolet|convertible|GTB|GTS|GTC|GT4)\b/i);
  return m ? m[1] : null;
}

type ScoredValue<T> = {
  value: T | null;
  score: number;
};

type BaTDetailSignals = {
  mileage: ScoredValue<number>;
  mileageUnit: ScoredValue<'miles' | 'km'>;
  vin: ScoredValue<string>;
  colorExterior: ScoredValue<string>;
  colorInterior: ScoredValue<string>;
  engine: ScoredValue<string>;
  transmission: ScoredValue<string>;
  bodyStyle: ScoredValue<string>;
};

function createEmptyBaTDetailSignals(): BaTDetailSignals {
  return {
    mileage: { value: null, score: 0 },
    mileageUnit: { value: 'miles', score: 0 },
    vin: { value: null, score: 0 },
    colorExterior: { value: null, score: 0 },
    colorInterior: { value: null, score: 0 },
    engine: { value: null, score: 0 },
    transmission: { value: null, score: 0 },
    bodyStyle: { value: null, score: 0 },
  };
}

function updateSignal<T>(signal: ScoredValue<T>, value: T | null, score: number): ScoredValue<T> {
  if (value === null) return signal;
  if (score > signal.score || (score === signal.score && signal.value === null)) {
    return { value, score };
  }
  return signal;
}

function extractMileageCandidate(text: string): { mileage: number; unit: 'miles' | 'km'; score: number } | null {
  const normalized = text.trim();
  if (!normalized) return null;

  const match = normalized.match(/\b(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?k?)\s*(miles?|mi|kilometers?|kms?|km)\b/i);
  if (!match) return null;

  const raw = match[1].replace(/,/g, '');
  const unit = /km|kilometer/i.test(match[2]) ? 'km' : 'miles';
  const mileage = raw.toLowerCase().endsWith('k')
    ? parseFloat(raw.slice(0, -1)) * 1000
    : parseInt(raw, 10);

  if (!Number.isFinite(mileage) || mileage <= 0) return null;

  const contextScore = /\b(shown|showing|indicated|reads?|odometer|speedometer)\b/i.test(normalized) ? 100 : 90;
  return { mileage: Math.round(mileage), unit, score: contextScore };
}

function extractVinCandidate(text: string): string | null {
  const match = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
  return match ? match[1].toUpperCase() : null;
}

function extractExteriorColorCandidate(text: string): string | null {
  const normalized = text.trim();
  if (!normalized) return null;
  if (/\b(miles?|km|kilometers?|odometer|speedometer)\b/i.test(normalized)) return null;
  if (/\b(leather|upholstery|alcantara|suede|nappa|interior)\b/i.test(normalized)) return null;
  if (/\b(engine|motor|liter|litre|v\d{1,2}|flat[-\s]?\d|inline[-\s]?\d|turbo|supercharged|transmission|manual|automatic|clutch|pdk|gearbox)\b/i.test(normalized)) return null;

  const stripped = normalized.replace(/\s*paint$/i, '').trim();
  if (/\b(metallic|pearl|micalizzato)\b/i.test(stripped)) return stripped;
  if (/\b(rosso|nero|grigio|bianco|giallo|blu|azzurro|argento|verde|marrone|avorio|crema|nocciola|red|black|white|silver|gray|grey|blue|green|yellow|gold|beige|tan|brown|orange)\b/i.test(stripped)) {
    return stripped;
  }
  return null;
}

function extractInteriorColorCandidate(text: string): string | null {
  const normalized = text.trim();
  if (!normalized) return null;
  if (/\b(miles?|km|kilometers?|odometer|speedometer)\b/i.test(normalized)) return null;
  if (/\b(engine|motor|liter|litre|v\d{1,2}|flat[-\s]?\d|inline[-\s]?\d|turbo|supercharged|transmission|manual|automatic|clutch|pdk|gearbox)\b/i.test(normalized)) return null;

  if (/\b(upholstery|leather|alcantara|cloth|suede|nappa|interior)\b/i.test(normalized)) {
    return normalized.replace(/\s*upholstery$/i, '').trim();
  }
  return null;
}

function hasLowConfidenceDetailField(signal: ScoredValue<unknown>): boolean {
  return signal.value === null || signal.score < 80;
}

function extractBaTDetailSignals(html: string, title: string, description: string | null): BaTDetailSignals {
  const signals = createEmptyBaTDetailSignals();
  const $ = cheerio.load(html);

  const essentialTexts: string[] = [];
  const essentialsKeyed = new Map<string, string>();

  $('.essentials li').each((_i, el) => {
    const text = $(el).text().trim();
    if (!text) return;
    const colonIdx = text.indexOf(':');
    if (colonIdx > 0 && colonIdx < 30) {
      const key = text.slice(0, colonIdx).trim().toLowerCase();
      const val = text.slice(colonIdx + 1).trim();
      if (key && val) {
        essentialsKeyed.set(key, val);
        essentialTexts.push(val);
      }
    } else {
      essentialTexts.push(text);
    }
  });

  $('table.essentials tr, .essentials table tr').each((_i, el) => {
    const cells = $(el).find('td');
    if (cells.length >= 2) {
      const key = $(cells[0]).text().trim().toLowerCase();
      const val = $(cells[1]).text().trim();
      if (key && val) {
        essentialsKeyed.set(key, val);
        essentialTexts.push(val);
      }
    }
  });

  const considerText = (text: string, scoreBias: number) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const mileageCandidate = extractMileageCandidate(trimmed);
    if (mileageCandidate) {
      signals.mileage = updateSignal(signals.mileage, mileageCandidate.mileage, scoreBias + mileageCandidate.score);
      signals.mileageUnit = updateSignal(signals.mileageUnit, mileageCandidate.unit, scoreBias + mileageCandidate.score);
    }

    const vinCandidate = extractVinCandidate(trimmed);
    if (vinCandidate) {
      const vinScore = /\b(chassis|vin|serial)\b/i.test(trimmed) ? scoreBias + 15 : scoreBias + 5;
      signals.vin = updateSignal(signals.vin, vinCandidate, vinScore);
    }

    const engineCandidate = parseEngineFromText(trimmed);
    if (engineCandidate) {
      signals.engine = updateSignal(signals.engine, engineCandidate, scoreBias + 10);
    }

    const transmissionCandidate = parseTransmissionFromText(trimmed);
    if (transmissionCandidate) {
      signals.transmission = updateSignal(signals.transmission, transmissionCandidate, scoreBias + 10);
    }

    const exteriorColorCandidate = extractExteriorColorCandidate(trimmed);
    if (exteriorColorCandidate) {
      signals.colorExterior = updateSignal(signals.colorExterior, exteriorColorCandidate, scoreBias + 5);
    }

    const interiorColorCandidate = extractInteriorColorCandidate(trimmed);
    if (interiorColorCandidate) {
      signals.colorInterior = updateSignal(signals.colorInterior, interiorColorCandidate, scoreBias + 5);
    }

    const bodyStyleCandidate = parseBodyStyleFromText(trimmed);
    if (bodyStyleCandidate) {
      signals.bodyStyle = updateSignal(signals.bodyStyle, bodyStyleCandidate, scoreBias + 5);
    }
  };

  for (const [key, value] of essentialsKeyed.entries()) {
    considerText(value, 95);
    if (key === 'mileage' || key === 'miles' || key === 'kilometers' || key === 'km') {
      const candidate = extractMileageCandidate(value);
      if (candidate) {
        signals.mileage = updateSignal(signals.mileage, candidate.mileage, 100);
        signals.mileageUnit = updateSignal(signals.mileageUnit, candidate.unit, 100);
      }
    }
    if (key === 'transmission') {
      const candidate = parseTransmissionFromText(value);
      if (candidate) signals.transmission = updateSignal(signals.transmission, candidate, 100);
    }
    if (key === 'engine') {
      const candidate = parseEngineFromText(value);
      if (candidate) signals.engine = updateSignal(signals.engine, candidate, 100);
    }
    if (key === 'vin' || key === 'chassis' || key === 'serial' || key === 'frame') {
      const candidate = extractVinCandidate(value);
      if (candidate) signals.vin = updateSignal(signals.vin, candidate, 100);
    }
    if (key === 'exterior color' || key === 'colour' || key === 'color') {
      signals.colorExterior = updateSignal(signals.colorExterior, value.trim(), 100);
    }
    if (key === 'interior color' || key === 'interior') {
      signals.colorInterior = updateSignal(signals.colorInterior, value.trim(), 100);
    }
    if (key === 'body style' || key === 'body type') {
      const candidate = parseBodyStyleFromText(value) || value.trim();
      signals.bodyStyle = updateSignal(signals.bodyStyle, candidate, 100);
    }
  }

  for (const text of essentialTexts) {
    considerText(text, 85);
  }

  if (description) {
    considerText(description, 60);
    const descMileage = parseMileageFromDescription(description);
    if (descMileage) {
      signals.mileage = updateSignal(signals.mileage, descMileage.mileage, 70);
      signals.mileageUnit = updateSignal(signals.mileageUnit, descMileage.unit, 70);
    }
  }

  considerText(title, 55);
  const titleMileage = parseMileageFromTitle(title);
  if (titleMileage) {
    signals.mileage = updateSignal(signals.mileage, titleMileage.mileage, 65);
    signals.mileageUnit = updateSignal(signals.mileageUnit, titleMileage.unit, 65);
  }
  const titleBodyStyle = parseBodyStyleFromTitle(title);
  if (titleBodyStyle) {
    signals.bodyStyle = updateSignal(signals.bodyStyle, titleBodyStyle, 65);
  }

  return signals;
}

function mergeBaTDetailSignals(primary: BaTDetailSignals, fallback: BaTDetailSignals | null): BaTDetailSignals {
  if (!fallback) return primary;
  return {
    mileage: primary.mileage.value !== null ? primary.mileage : fallback.mileage,
    mileageUnit: primary.mileage.value !== null ? primary.mileageUnit : fallback.mileageUnit,
    vin: primary.vin.value !== null ? primary.vin : fallback.vin,
    colorExterior: primary.colorExterior.value !== null ? primary.colorExterior : fallback.colorExterior,
    colorInterior: primary.colorInterior.value !== null ? primary.colorInterior : fallback.colorInterior,
    engine: primary.engine.value !== null ? primary.engine : fallback.engine,
    transmission: primary.transmission.value !== null ? primary.transmission : fallback.transmission,
    bodyStyle: primary.bodyStyle.value !== null ? primary.bodyStyle : fallback.bodyStyle,
  };
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

  // BaT loads auction cards dynamically via JS. The initial data is embedded
  // in a <script> tag as `var auctionsCurrentInitialData = {"items":[...]}`.
  // We parse this JSON directly — no need for multiple pages since all active
  // auctions are in the initial data payload.
  try {
    console.log(`[BaT] Fetching auctions page for embedded JSON data...`);
    const html = await fetchPage(AUCTIONS_URL);

    // Diagnostic: always report HTML size so cron response shows what we got
    errors.push(`[BaT:diag] HTML=${html.length}b, title="${html.match(/<title>([^<]*)<\/title>/)?.[1]?.slice(0, 60) ?? 'none'}"`);

    // Extract embedded JSON: find `auctionsCurrentInitialData = {...}` and
    // use brace-matching to extract the full JSON object reliably.
    const marker = 'auctionsCurrentInitialData';
    const markerIdx = html.indexOf(marker);

    if (markerIdx >= 0) {
      const jsonStart = html.indexOf('{', markerIdx);
      if (jsonStart >= 0) {
        let depth = 0;
        let jsonEnd = -1;
        for (let i = jsonStart; i < html.length; i++) {
          if (html[i] === '{') depth++;
          else if (html[i] === '}') { depth--; if (depth === 0) { jsonEnd = i; break; } }
        }

        if (jsonEnd > 0) {
          try {
            const data = JSON.parse(html.substring(jsonStart, jsonEnd + 1));
            const items = data.items ?? [];
            errors.push(`[BaT:diag] marker=true, jsonLen=${jsonEnd - jsonStart + 1}, items=${items.length}`);
            console.log(`[BaT] Found ${items.length} auctions in embedded JSON data`);

            for (const item of items) {
              try {
                const auction = parseEmbeddedItem(item);
                if (auction) auctions.push(auction);
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown parse error';
                errors.push(`[BaT] Failed to parse embedded item: ${message}`);
              }
            }
          } catch (parseErr) {
            errors.push(`[BaT] Failed to parse embedded JSON: ${parseErr instanceof Error ? parseErr.message : 'Unknown'}`);
          }
        } else {
          errors.push(`[BaT] Found marker but could not match braces for JSON extraction`);
        }
      }
    } else {
      console.log(`[BaT] Embedded JSON marker not found in ${html.length} bytes of HTML`);
      errors.push(`[BaT] No embedded auction data found (${html.length} bytes fetched). Server may be blocking datacenter IPs.`);
    }

    // Fallback: try parsing HTML if JSON extraction failed
    if (auctions.length === 0) {
      const $ = cheerio.load(html);
      const listingLinks = $('a[href*="/listing/"]');
      const seen = new Set<string>();
      listingLinks.each((_i, el) => {
        const href = $(el).attr('href') || '';
        if (!href || seen.has(href)) return;
        if (!/\/listing\/[a-z0-9]/.test(href)) return;
        seen.add(href);
        const card = $(el).closest('li, article, div');
        const auction = parseAuctionCard($, card.length > 0 ? card[0] : el);
        if (auction) auctions.push(auction);
      });
    }

    if (auctions.length === 0) {
      errors.push(`[BaT] No auctions found. Site structure may have changed.`);
    }

    console.log(`[BaT] Total: ${auctions.length} auctions parsed`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    errors.push(`[BaT] Error fetching auctions page: ${message}`);
  }

  return { auctions, errors };
}

/**
 * Parse a single item from BaT's embedded auctionsCurrentInitialData JSON.
 */
function parseEmbeddedItem(item: any): BaTAuction | null {
  const url = item.url;
  if (!url || typeof url !== 'string') return null;

  const title = item.title || '';
  if (!title) return null;

  const externalId = extractExternalId(url);
  const { year: parsedYear, make, model } = parseTitleComponents(title);
  const year = parseInt(item.year, 10) || parsedYear;

  const currentBid = typeof item.current_bid === 'number' ? item.current_bid : null;
  const imageUrl = item.thumbnail_url || null;

  let endTime: Date | null = null;
  if (item.timestamp_end) {
    const ts = typeof item.timestamp_end === 'number' ? item.timestamp_end : parseInt(item.timestamp_end, 10);
    if (!isNaN(ts)) endTime = new Date(ts * 1000);
  }

  const noReserve = item.noreserve === true;

  return {
    externalId,
    platform: 'BRING_A_TRAILER',
    title, make, model, year,
    mileage: null, mileageUnit: 'miles',
    transmission: null, engine: null,
    exteriorColor: null, interiorColor: null,
    location: item.country || null,
    currentBid, bidCount: 0, endTime,
    url, imageUrl,
    description: item.excerpt || null,
    sellerNotes: null,
    status: item.active ? 'active' : 'sold',
    vin: null,
    images: imageUrl ? [imageUrl] : [],
    reserveStatus: noReserve ? 'NO_RESERVE' : null,
    bodyStyle: null,
  };
}

/**
 * Fallback card parser using generic selectors.
 */
export function parseAuctionCard(
  $: cheerio.CheerioAPI,
  el: cheerio.Element,
): BaTAuction | null {
  const $el = $(el);

  const linkEl = $el.find('a[href*="/listing/"]').first();
  const relativeUrl = linkEl.attr('href') || $el.find('a').first().attr('href');
  if (!relativeUrl) return null;

  const url = relativeUrl.startsWith('http') ? relativeUrl : `${BASE_URL}${relativeUrl}`;
  const externalId = extractExternalId(url);

  const title =
    $el.find('.auction-title, .listing-title, h3, h2').first().text().trim() ||
    linkEl.text().trim() || '';
  if (!title) return null;

  const { year, make, model } = parseTitleComponents(title);

  const imageUrl = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || null;
  const bidText = $el.find('.current-bid, [class*="bid"], [class*="price"]').first().text().trim();
  const currentBid = parsePrice(bidText);

  return {
    externalId,
    platform: 'BRING_A_TRAILER',
    title, make, model, year,
    mileage: null, mileageUnit: 'miles',
    transmission: null, engine: null,
    exteriorColor: null, interiorColor: null,
    location: null,
    currentBid, bidCount: 0, endTime: null,
    url, imageUrl,
    description: null, sellerNotes: null,
    status: 'active',
    vin: null,
    images: imageUrl ? [imageUrl] : [],
    reserveStatus: null, bodyStyle: null,
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

    const primarySignals = extractBaTDetailSignals(html, auction.title, description);
    const needsFallback =
      hasLowConfidenceDetailField(primarySignals.mileage) ||
      hasLowConfidenceDetailField(primarySignals.vin) ||
      hasLowConfidenceDetailField(primarySignals.colorExterior) ||
      hasLowConfidenceDetailField(primarySignals.colorInterior) ||
      hasLowConfidenceDetailField(primarySignals.engine) ||
      hasLowConfidenceDetailField(primarySignals.transmission) ||
      hasLowConfidenceDetailField(primarySignals.bodyStyle);

    let detailSignals = primarySignals;
    if (needsFallback && canUseBaTScraplingFallback()) {
      const fallbackHtml = await fetchBaTDetailHtmlWithScrapling(auction.url);
      if (fallbackHtml) {
        const fallbackSignals = extractBaTDetailSignals(fallbackHtml, auction.title, description);
        detailSignals = mergeBaTDetailSignals(primarySignals, fallbackSignals);
      }
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
      $('.essentials li, .essentials tr').each((_i, el) => {
        if (location) return false;
        const text = $(el).text().trim();
        const colonIdx = text.indexOf(':');
        if (colonIdx > 0) {
          const key = text.slice(0, colonIdx).trim().toLowerCase();
          if (key === 'location') {
            const val = text.slice(colonIdx + 1).trim();
            if (val) {
              location = val;
              return false;
            }
          }
        }
        const cells = $(el).find('td');
        if (cells.length >= 2 && $(cells[0]).text().trim().toLowerCase() === 'location') {
          const val = $(cells[1]).text().trim();
          if (val) {
            location = val;
            return false;
          }
        }
      });
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
    const essentialsText = $('.essentials').text();
    if (/^no\s+reserve$/i.test(essentialsText) || /\bno\s+reserve\b/i.test(essentialsText)) {
      reserveStatus = 'NO_RESERVE';
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
      mileage: detailSignals.mileage.value ?? auction.mileage,
      mileageUnit: detailSignals.mileage.value !== null ? detailSignals.mileageUnit.value ?? auction.mileageUnit : auction.mileageUnit,
      transmission: detailSignals.transmission.value ?? auction.transmission,
      engine: detailSignals.engine.value ?? auction.engine,
      exteriorColor: detailSignals.colorExterior.value ?? auction.exteriorColor,
      interiorColor: detailSignals.colorInterior.value ?? auction.interiorColor,
      location: location ?? auction.location,
      currentBid: detailBid ?? auction.currentBid,
      bidCount: detailBidCount || auction.bidCount,
      description: description ?? auction.description,
      sellerNotes: sellerNotes ?? auction.sellerNotes,
      vin: detailSignals.vin.value ?? auction.vin,
      images: finalImages.length > 0 ? finalImages : auction.images,
      reserveStatus: reserveStatus ?? auction.reserveStatus,
      bodyStyle: detailSignals.bodyStyle.value ?? auction.bodyStyle,
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
