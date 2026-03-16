// ═══════════════════════════════════════════════════════════════════════════
// MONZA LAB: ZERO-COST DETERMINISTIC SCRAPER
// Uses cheerio for CSS selector-based extraction — NO LLM TOKENS USED
// ═══════════════════════════════════════════════════════════════════════════

import * as cheerio from "cheerio";

// ─── TYPES ───
export interface ScrapedAuctionData {
  currentBid: number | null;
  bidCount: number | null;
  status: "ACTIVE" | "ENDED" | "SOLD" | "NO_SALE" | null;
  endTime: Date | null;
  title: string | null;
  rawPriceText: string | null;
  scrapedAt: Date;
  source: string;
}

export interface CachedPrice {
  url: string;
  data: ScrapedAuctionData;
  cachedAt: Date;
  expiresAt: Date;
}

// ─── IN-MEMORY CACHE (24-hour TTL) ───
const priceCache = new Map<string, CachedPrice>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── PLATFORM DETECTION ───
type Platform = "bringatrailer" | "rmsothebys" | "carsandbids" | "collectingcars" | "unknown";

export function detectPlatform(url: string): Platform {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("bringatrailer.com")) return "bringatrailer";
  if (urlLower.includes("rmsothebys.com")) return "rmsothebys";
  if (urlLower.includes("carsandbids.com")) return "carsandbids";
  if (urlLower.includes("collectingcars.com")) return "collectingcars";
  return "unknown";
}

// ─── PRICE PARSING UTILITIES ───
export function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  // Remove currency symbols, commas, spaces
  const cleaned = text.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function parseBidCount(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM-SPECIFIC PARSERS (CSS SELECTORS — $0 COST)
// ═══════════════════════════════════════════════════════════════════════════

// ─── BRING A TRAILER ───
function parseBringATrailer($: cheerio.CheerioAPI): Partial<ScrapedAuctionData> {
  // BaT DOM structure (as of 2024-2025, selectors may need updates)
  // Active auction: .listing-available-info .listing-bid-value
  // Sold auction: .listing-post-close-value, .post-sold-value
  // Status: .listing-available-info .listing-available-info-title

  let currentBid: number | null = null;
  let rawPriceText: string | null = null;
  let bidCount: number | null = null;
  let status: ScrapedAuctionData["status"] = null;
  let title: string | null = null;
  let endTime: Date | null = null;

  // Try multiple selectors for price (BaT updates their DOM frequently)
  const priceSelectors = [
    ".listing-bid-value",
    ".listing-available-info .listing-bid-value",
    ".listing-post-close-value",
    ".post-sold-value",
    ".current-bid .amount",
    '[data-testid="current-bid"]',
    ".auction-bid-amount",
  ];

  for (const selector of priceSelectors) {
    const priceEl = $(selector).first();
    if (priceEl.length) {
      rawPriceText = priceEl.text().trim();
      currentBid = parsePrice(rawPriceText);
      if (currentBid) break;
    }
  }

  // Bid count
  const bidCountSelectors = [
    ".listing-stats .number-bids-value",
    ".listing-bid-count",
    ".comments-bid-count",
    '[data-testid="bid-count"]',
  ];

  for (const selector of bidCountSelectors) {
    const bidEl = $(selector).first();
    if (bidEl.length) {
      bidCount = parseBidCount(bidEl.text());
      if (bidCount !== null) break;
    }
  }

  // Status detection
  const soldIndicators = [".sold", ".listing-ended", ".auction-ended", ".result-sold"];
  const activeIndicators = [".listing-available", ".auction-active", ".time-remaining"];

  for (const selector of soldIndicators) {
    if ($(selector).length > 0) {
      status = "SOLD";
      break;
    }
  }

  if (!status) {
    for (const selector of activeIndicators) {
      if ($(selector).length > 0) {
        status = "ACTIVE";
        break;
      }
    }
  }

  // Title
  title = $("h1.post-title, .listing-title, h1.listing-post-title").first().text().trim() || null;

  // End time (if available)
  const timeEl = $(
    ".listing-available-info-time, .auction-end-time, time[datetime], [data-end-time], [data-endtime], [data-auction-end]",
  ).first();
  if (timeEl.length) {
    const timeAttr =
      timeEl.attr("data-end-time") ||
      timeEl.attr("data-endtime") ||
      timeEl.attr("data-auction-end") ||
      timeEl.attr("datetime");
    const timeText = timeAttr || timeEl.text().trim();
    if (timeText) {
      const parsed = new Date(timeText);
      if (!isNaN(parsed.getTime())) endTime = parsed;
    }
  }

  // Fallback 1: JSON-LD often contains endDate/startDate
  if (!endTime) {
    endTime = extractEndDateFromJsonLd($);
  }

  // Fallback 2: scan for human-readable close/ended date
  if (!endTime) {
    const bodyText = $("body").text();
    const endedMatch = bodyText.match(
      /(auction\s+(?:ended|ends|ended\s+on|ends\s+on|closes|closed)\s+)([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
    );
    if (endedMatch?.[2]) {
      endTime = parseMonthNameDateToUtcNoon(endedMatch[2]);
    }
  }

  return { currentBid, bidCount, status, title, rawPriceText, endTime };
}

function extractEndDateFromJsonLd($: cheerio.CheerioAPI): Date | null {
  const scripts = $("script[type='application/ld+json']")
    .map((_i, el) => $(el).text())
    .get()
    .filter(Boolean);

  for (const raw of scripts) {
    try {
      const parsed = JSON.parse(raw) as any;
      const candidates: any[] = Array.isArray(parsed) ? parsed : [parsed];

      for (const obj of candidates) {
        if (!obj || typeof obj !== "object") continue;

        const endDate = obj.endDate ?? obj?.auction?.endDate ?? obj?.offers?.endDate;
        if (typeof endDate === "string") {
          const d = new Date(endDate);
          if (!isNaN(d.getTime())) return d;
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return null;
}

function parseMonthNameDateToUtcNoon(text: string): Date | null {
  const m = text.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (!m) return null;
  const monthName = m[1].toLowerCase();
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (!Number.isFinite(day) || !Number.isFinite(year)) return null;

  const months: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    sept: 8,
    october: 9,
    november: 10,
    december: 11,
  };
  const month = months[monthName];
  if (month === undefined) return null;
  const ts = Date.UTC(year, month, day, 12, 0, 0);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

// ─── RM SOTHEBY'S ───
function parseRMSothebys($: cheerio.CheerioAPI): Partial<ScrapedAuctionData> {
  let currentBid: number | null = null;
  let rawPriceText: string | null = null;
  let status: ScrapedAuctionData["status"] = null;
  let title: string | null = null;

  // RM Sotheby's selectors
  const priceSelectors = [
    ".lot-price",
    ".price-estimate",
    ".sold-price",
    ".hammer-price",
    '[data-testid="lot-price"]',
    ".lot-detail-price",
    ".auction-result-price",
  ];

  for (const selector of priceSelectors) {
    const priceEl = $(selector).first();
    if (priceEl.length) {
      rawPriceText = priceEl.text().trim();
      currentBid = parsePrice(rawPriceText);
      if (currentBid) break;
    }
  }

  // Status
  if ($(".lot-sold, .result-sold, .hammer-sold").length) {
    status = "SOLD";
  } else if ($(".lot-not-sold, .result-not-sold, .passed").length) {
    status = "NO_SALE";
  } else if ($(".lot-active, .bidding-open").length) {
    status = "ACTIVE";
  }

  // Title
  title = $("h1.lot-title, .lot-name, .vehicle-title").first().text().trim() || null;

  return { currentBid, bidCount: null, status, title, rawPriceText, endTime: null };
}

// ─── CARS AND BIDS ───
function parseCarsAndBids($: cheerio.CheerioAPI): Partial<ScrapedAuctionData> {
  let currentBid: number | null = null;
  let rawPriceText: string | null = null;
  let bidCount: number | null = null;
  let status: ScrapedAuctionData["status"] = null;
  let title: string | null = null;
  let endTime: Date | null = null;

  // C&B selectors
  const priceSelectors = [
    ".auction-price",
    ".current-bid-amount",
    ".bid-amount",
    ".sold-price",
    '[data-bid-amount]',
  ];

  for (const selector of priceSelectors) {
    const priceEl = $(selector).first();
    if (priceEl.length) {
      rawPriceText = priceEl.text().trim();
      currentBid = parsePrice(rawPriceText);
      if (currentBid) break;
    }
  }

  // Bid count
  const bidCountEl = $(".bid-count, .num-bids, [data-bid-count]").first();
  if (bidCountEl.length) {
    bidCount = parseBidCount(bidCountEl.text());
  }

  // Status
  if ($(".auction-ended, .sold").length) {
    status = "SOLD";
  } else if ($(".auction-active, .bidding").length) {
    status = "ACTIVE";
  }

  // Title
  title = $("h1.auction-title, .vehicle-title, h1").first().text().trim() || null;

  // End time (best-effort)
  const timeEl = $(
    "time[datetime], .auction-end-time, .time-left time, .time-left, [data-end-time], [data-endtime], [data-auction-end]",
  ).first();
  if (timeEl.length) {
    const timeAttr = timeEl.attr("data-end-time") || timeEl.attr("data-endtime") || timeEl.attr("data-auction-end") || timeEl.attr("datetime");
    const timeText = timeAttr || timeEl.text().trim();
    if (timeText) {
      const parsed = new Date(timeText);
      if (!isNaN(parsed.getTime())) endTime = parsed;
    }
  }

  return { currentBid, bidCount, status, title, rawPriceText, endTime };
}

// ─── COLLECTING CARS ───
function parseCollectingCars($: cheerio.CheerioAPI): Partial<ScrapedAuctionData> {
  let currentBid: number | null = null;
  let rawPriceText: string | null = null;
  let bidCount: number | null = null;
  let status: ScrapedAuctionData["status"] = null;
  let title: string | null = null;
  let endTime: Date | null = null;

  // Collecting Cars selectors
  const priceSelectors = [
    ".current-bid",
    ".auction-price",
    ".price-value",
    '[data-current-bid]',
  ];

  for (const selector of priceSelectors) {
    const priceEl = $(selector).first();
    if (priceEl.length) {
      rawPriceText = priceEl.text().trim();
      currentBid = parsePrice(rawPriceText);
      if (currentBid) break;
    }
  }

  // Status
  if ($(".sold, .auction-complete").length) {
    status = "SOLD";
  } else if ($(".live, .active").length) {
    status = "ACTIVE";
  }

  // Title
  title = $("h1.lot-title, h1.vehicle-name, h1").first().text().trim() || null;

  // End time (best-effort)
  const timeEl = $(
    "time[datetime], .auction-end-time, .countdown time, .countdown, [data-end-time], [data-endtime], [data-auction-end]",
  ).first();
  if (timeEl.length) {
    const timeAttr = timeEl.attr("data-end-time") || timeEl.attr("data-endtime") || timeEl.attr("data-auction-end") || timeEl.attr("datetime");
    const timeText = timeAttr || timeEl.text().trim();
    if (timeText) {
      const parsed = new Date(timeText);
      if (!isNaN(parsed.getTime())) endTime = parsed;
    }
  }

  return { currentBid, bidCount, status, title, rawPriceText, endTime };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCRAPER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetches and parses auction data from a URL using CSS selectors only.
 * NO LLM TOKENS ARE USED — this is pure deterministic scraping.
 *
 * @param url - The auction listing URL
 * @param forceRefresh - Bypass cache and fetch fresh data
 * @returns Scraped auction data
 */
export async function fetchAuctionData(
  url: string,
  forceRefresh = false
): Promise<ScrapedAuctionData> {
  // ─── CHECK CACHE FIRST (Double Savings) ───
  if (!forceRefresh) {
    const cached = priceCache.get(url);
    if (cached && cached.expiresAt > new Date()) {
      console.log(`[Scraper] Cache HIT for ${url}`);
      return cached.data;
    }
  }

  console.log(`[Scraper] Cache MISS — fetching ${url}`);

  const platform = detectPlatform(url);
  const now = new Date();

  // Default response for errors
  const defaultResponse: ScrapedAuctionData = {
    currentBid: null,
    bidCount: null,
    status: null,
    endTime: null,
    title: null,
    rawPriceText: null,
    scrapedAt: now,
    source: platform,
  };

  try {
    // ─── FETCH HTML ───
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[Scraper] HTTP ${response.status} for ${url}`);
      return defaultResponse;
    }

    const html = await response.text();

    // ─── PARSE WITH CHEERIO (FREE!) ───
    const $ = cheerio.load(html);

    // ─── PLATFORM-SPECIFIC PARSING ───
    let parsed: Partial<ScrapedAuctionData> = {};

    switch (platform) {
      case "bringatrailer":
        parsed = parseBringATrailer($);
        break;
      case "rmsothebys":
        parsed = parseRMSothebys($);
        break;
      case "carsandbids":
        parsed = parseCarsAndBids($);
        break;
      case "collectingcars":
        parsed = parseCollectingCars($);
        break;
      default:
        // Generic fallback — try common price patterns
        const genericPriceEl = $('[class*="price"], [class*="bid"], [data-price]').first();
        if (genericPriceEl.length) {
          parsed.rawPriceText = genericPriceEl.text().trim();
          parsed.currentBid = parsePrice(parsed.rawPriceText);
        }
        parsed.title = $("h1").first().text().trim() || null;
    }

    const result: ScrapedAuctionData = {
      currentBid: parsed.currentBid ?? null,
      bidCount: parsed.bidCount ?? null,
      status: parsed.status ?? null,
      endTime: parsed.endTime ?? null,
      title: parsed.title ?? null,
      rawPriceText: parsed.rawPriceText ?? null,
      scrapedAt: now,
      source: platform,
    };

    // ─── CACHE THE RESULT ───
    const cacheEntry: CachedPrice = {
      url,
      data: result,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
    };
    priceCache.set(url, cacheEntry);

    return result;
  } catch (error) {
    console.error(`[Scraper] Error fetching ${url}:`, error);
    return defaultResponse;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clear expired entries from the cache
 */
export function cleanCache(): number {
  const now = new Date();
  let removed = 0;

  for (const [url, entry] of priceCache.entries()) {
    if (entry.expiresAt < now) {
      priceCache.delete(url);
      removed++;
    }
  }

  console.log(`[Scraper] Cache cleanup: removed ${removed} expired entries`);
  return removed;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; oldestEntry: Date | null; newestEntry: Date | null } {
  let oldest: Date | null = null;
  let newest: Date | null = null;

  for (const entry of priceCache.values()) {
    if (!oldest || entry.cachedAt < oldest) oldest = entry.cachedAt;
    if (!newest || entry.cachedAt > newest) newest = entry.cachedAt;
  }

  return {
    size: priceCache.size,
    oldestEntry: oldest,
    newestEntry: newest,
  };
}

/**
 * Clear entire cache
 */
export function clearCache(): void {
  priceCache.clear();
  console.log("[Scraper] Cache cleared");
}

/**
 * Get cached data for a URL without fetching
 */
export function getCachedData(url: string): ScrapedAuctionData | null {
  const cached = priceCache.get(url);
  if (cached && cached.expiresAt > new Date()) {
    return cached.data;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch multiple URLs with rate limiting (to be polite to target sites)
 * @param urls - Array of URLs to fetch
 * @param delayMs - Delay between requests (default 2s)
 */
export async function batchFetchAuctionData(
  urls: string[],
  delayMs = 2000
): Promise<Map<string, ScrapedAuctionData>> {
  const results = new Map<string, ScrapedAuctionData>();

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const data = await fetchAuctionData(url);
    results.set(url, data);

    // Rate limiting — don't spam the target sites
    if (i < urls.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
