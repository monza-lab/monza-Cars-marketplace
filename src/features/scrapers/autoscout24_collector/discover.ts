import type { Page } from "playwright-core";
import * as cheerio from "cheerio";

import type { SearchShard, AS24ListingSummary, DiscoverResult } from "./types";
import { isAkamaiChallenge, waitForChallengeResolution, dismissCookieConsent } from "./browser";
import { NavigationRateLimiter } from "./net";
import { logEvent } from "./logging";

export interface DiscoverOptions {
  page: Page;
  shard: SearchShard;
  rateLimiter: NavigationRateLimiter;
  pageTimeoutMs: number;
  runId: string;
  onPageDone?: (shardId: string, page: number, found: number) => Promise<void>;
  /** Resume from this page (skip pages <= resumeFromPage) */
  resumeFromPage?: number;
}

/**
 * Build AutoScout24 search URL from shard parameters.
 */
export function buildSearchUrl(shard: SearchShard, page: number): string {
  const modelPath = shard.model ? `/${shard.model}` : "";
  const base = `https://www.autoscout24.com/lst/porsche${modelPath}`;

  const params = new URLSearchParams();
  params.set("sort", "standard");
  params.set("desc", "0");
  params.set("ustate", "N,U");
  params.set("atype", "C");
  params.set("cy", shard.countries.join(","));
  params.set("damaged_listing", "exclude");

  if (shard.yearFrom) params.set("fregfrom", String(shard.yearFrom));
  if (shard.yearTo) params.set("fregto", String(shard.yearTo));
  if (shard.priceFrom) params.set("pricefrom", String(shard.priceFrom));
  if (shard.priceTo) params.set("priceto", String(shard.priceTo));
  if (page > 1) params.set("page", String(page));

  return `${base}?${params.toString()}`;
}

/**
 * Discover listings from a single shard by paginating through search results.
 */
export async function discoverShard(opts: DiscoverOptions): Promise<DiscoverResult> {
  const allListings: AS24ListingSummary[] = [];
  const seenUrls = new Set<string>();
  let totalResults: number | null = null;
  let hasNextPage = true;
  let pagesProcessed = 0;
  const startPage = (opts.resumeFromPage ?? 0) + 1;

  for (let pageNum = startPage; pageNum <= opts.shard.maxPages && hasNextPage; pageNum++) {
    const url = buildSearchUrl(opts.shard, pageNum);
    logEvent({ level: "info", event: "discover.page_start", runId: opts.runId, shard: opts.shard.id, page: pageNum, url });

    try {
      await opts.rateLimiter.waitBeforeNavigation();

      await opts.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: opts.pageTimeoutMs,
      });

      // Wait for listings to render
      await opts.page.waitForSelector('article, [data-testid*="listing"], .cl-list-element', { timeout: 10_000 }).catch(() => {});

      // Handle challenge pages
      if (await isAkamaiChallenge(opts.page)) {
        logEvent({ level: "warn", event: "discover.akamai_challenge", runId: opts.runId, shard: opts.shard.id, page: pageNum });
        const resolved = await waitForChallengeResolution(opts.page, 15_000);
        if (!resolved) {
          logEvent({ level: "error", event: "discover.akamai_blocked", runId: opts.runId, shard: opts.shard.id, page: pageNum });
          break;
        }
        await opts.page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      }

      // Dismiss cookie consent on first page
      if (pageNum === startPage) {
        await dismissCookieConsent(opts.page);
      }

      // Get HTML and parse
      const html = await opts.page.content();
      const parsed = parseSearchPage(html);

      if (parsed.totalResults !== null && totalResults === null) {
        totalResults = parsed.totalResults;
      }

      // Deduplicate
      const newListings: AS24ListingSummary[] = [];
      for (const listing of parsed.listings) {
        if (!seenUrls.has(listing.url)) {
          seenUrls.add(listing.url);
          newListings.push(listing);
        }
      }

      allListings.push(...newListings);
      pagesProcessed++;

      logEvent({
        level: "info",
        event: "discover.page_done",
        runId: opts.runId,
        shard: opts.shard.id,
        page: pageNum,
        found: newListings.length,
        total: allListings.length,
        totalResults,
      });

      if (newListings.length === 0) {
        hasNextPage = false;
      }

      // Warn if shard is saturated (hit the 20-page limit with full pages)
      if (pageNum === 20 && newListings.length > 0) {
        logEvent({
          level: "warn",
          event: "discover.shard_saturated",
          runId: opts.runId,
          shard: opts.shard.id,
          message: "Shard reached 20-page limit. Some listings may be missed. Consider adding price-range sub-shards.",
        });
      }

      await opts.onPageDone?.(opts.shard.id, pageNum, newListings.length);
    } catch (err) {
      logEvent({
        level: "error",
        event: "discover.page_error",
        runId: opts.runId,
        shard: opts.shard.id,
        page: pageNum,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    shardId: opts.shard.id,
    listings: allListings,
    totalResults,
    pagesProcessed,
  };
}

/* ------------------------------------------------------------------ */
/*  HTML Parsing                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse AutoScout24 search results page HTML.
 * Strategy priority:
 *   1. __NEXT_DATA__ JSON (richest, most reliable)
 *   2. Article data-* attributes (good fallback)
 *   3. JSON-LD structured data (rare on search pages)
 */
export function parseSearchPage(html: string): {
  listings: AS24ListingSummary[];
  totalResults: number | null;
  hasNextPage: boolean;
} {
  const $ = cheerio.load(html);

  // Strategy 1: __NEXT_DATA__ (primary — Next.js SSR data)
  const nextDataResult = parseNextData($);
  if (nextDataResult.listings.length > 0) {
    return nextDataResult;
  }

  // Strategy 2: Article data-* attributes
  let listings = parseArticleDataAttributes($);

  // Strategy 3: JSON-LD structured data
  if (listings.length === 0) {
    listings = parseJsonLd($);
  }

  // Extract total results from DOM as fallback
  const totalResults = extractTotalResults($);
  const hasNextPage = listings.length > 0;

  return { listings, totalResults, hasNextPage };
}

/* ------------------------------------------------------------------ */
/*  Strategy 1: __NEXT_DATA__                                           */
/* ------------------------------------------------------------------ */

interface NextDataListing {
  id?: string;
  url?: string;
  images?: string[];
  price?: { priceFormatted?: string };
  vehicle?: {
    make?: string;
    model?: string;
    modelGroup?: string;
    variant?: string;
    modelVersionInput?: string;
    transmission?: string;
    fuel?: string;
    mileageInKm?: string;
  };
  location?: {
    countryCode?: string;
    zip?: string;
    city?: string;
  };
  seller?: {
    type?: string;
  };
  tracking?: {
    firstRegistration?: string;
    fuelType?: string;
    mileage?: string;
    price?: string;
  };
  vehicleDetails?: Array<{
    data?: string;
    ariaLabel?: string;
  }>;
}

function parseNextData($: cheerio.CheerioAPI): {
  listings: AS24ListingSummary[];
  totalResults: number | null;
  hasNextPage: boolean;
} {
  const scriptEl = $("#__NEXT_DATA__");
  if (scriptEl.length === 0) {
    return { listings: [], totalResults: null, hasNextPage: false };
  }

  try {
    const data = JSON.parse(scriptEl.html() ?? "");
    const pageProps = data?.props?.pageProps;
    if (!pageProps) return { listings: [], totalResults: null, hasNextPage: false };

    const rawListings: NextDataListing[] = pageProps.listings ?? [];
    const totalResults: number | null = typeof pageProps.numberOfResults === "number" ? pageProps.numberOfResults : null;
    const numberOfPages: number | null = typeof pageProps.numberOfPages === "number" ? pageProps.numberOfPages : null;

    const listings: AS24ListingSummary[] = [];
    for (const raw of rawListings) {
      const listing = mapNextDataListing(raw);
      if (listing) listings.push(listing);
    }

    // Determine hasNextPage from numberOfPages or listing count
    const hasNextPage = numberOfPages !== null
      ? listings.length > 0 // We have results, caller checks page bounds
      : listings.length > 0;

    return { listings, totalResults, hasNextPage };
  } catch {
    return { listings: [], totalResults: null, hasNextPage: false };
  }
}

function mapNextDataListing(raw: NextDataListing): AS24ListingSummary | null {
  if (!raw.id) return null;

  // Build URL
  const relUrl = raw.url ?? "";
  const fullUrl = relUrl
    ? (relUrl.startsWith("http") ? relUrl : `https://www.autoscout24.com${relUrl}`)
    : `https://www.autoscout24.com/offers/${raw.id}`;

  // Extract ID from URL slug or use GUID
  const id = extractIdFromUrl(fullUrl) || raw.id;

  // Vehicle data
  const v = raw.vehicle;
  const make = v?.make ?? "Porsche";
  const model = v?.model ?? v?.modelGroup ?? null;
  const title = buildTitle(make, model, v?.variant, v?.modelVersionInput);

  // Price — prefer tracking.price (clean number) over priceFormatted
  const trackingPrice = raw.tracking?.price ? parseInt(raw.tracking.price, 10) : null;
  const formattedPrice = raw.price?.priceFormatted ? parsePrice(raw.price.priceFormatted) : null;
  const price = (trackingPrice && !isNaN(trackingPrice)) ? trackingPrice : formattedPrice;

  // Currency from formatted price
  const currency = detectCurrency(raw.price?.priceFormatted ?? "") ?? "EUR";

  // Mileage — prefer tracking.mileage (clean number)
  const trackingMileage = raw.tracking?.mileage ? parseInt(raw.tracking.mileage, 10) : null;
  const vehicleMileage = v?.mileageInKm ? parseMileageKm(v.mileageInKm) : null;
  const mileageKm = (trackingMileage && !isNaN(trackingMileage)) ? trackingMileage : vehicleMileage;

  // Year from firstRegistration
  const firstReg = raw.tracking?.firstRegistration ?? null;
  const year = parseYearFromRegistration(firstReg) ?? parseYearFromTitle(title);

  // Location
  const loc = raw.location;
  const locationStr = [loc?.city, loc?.zip].filter(Boolean).join(", ") || null;
  const countryCode = loc?.countryCode ?? null;

  // Images — upgrade to higher resolution
  const images = (raw.images ?? []).map((img) => img.replace("/250x188.webp", "/720x540.webp"));

  // Transmission from vehicle or vehicleDetails
  const transmission = v?.transmission ?? findVehicleDetail(raw.vehicleDetails, "Gear") ?? null;

  // Power from vehicleDetails
  const power = findVehicleDetail(raw.vehicleDetails, "Power") ?? null;

  // Fuel type
  const fuelType = v?.fuel ?? null;

  // Seller type
  const sellerType = raw.seller?.type ?? null;

  return {
    id,
    url: fullUrl,
    title,
    price,
    currency,
    mileageKm,
    year,
    make,
    model,
    fuelType,
    transmission,
    power,
    location: locationStr,
    country: countryCode,
    sellerType,
    images,
    firstRegistration: firstReg,
  };
}

function buildTitle(make: string, model: string | null, variant?: string | null, version?: string | null): string {
  const parts: string[] = [make];
  if (model) parts.push(model);
  if (version) parts.push(version);
  else if (variant && variant !== `${make} ${model}`) parts.push(variant);
  return parts.join(" ");
}

function findVehicleDetail(details: Array<{ data?: string; ariaLabel?: string }> | undefined, label: string): string | null {
  if (!details) return null;
  const entry = details.find((d) => d.ariaLabel === label);
  return entry?.data ?? null;
}

/* ------------------------------------------------------------------ */
/*  Strategy 2: Article data-* attributes                               */
/* ------------------------------------------------------------------ */

function parseArticleDataAttributes($: cheerio.CheerioAPI): AS24ListingSummary[] {
  const listings: AS24ListingSummary[] = [];

  $("article[data-guid]").each((_, el) => {
    const $el = $(el);
    const guid = $el.attr("data-guid") ?? "";
    if (!guid) return;

    const make = capitalize($el.attr("data-make") ?? "porsche");
    const model = $el.attr("data-model") ?? null;
    const priceStr = $el.attr("data-price");
    const mileageStr = $el.attr("data-mileage");
    const fuelType = $el.attr("data-fuel-type") ?? null;
    const firstReg = $el.attr("data-first-registration") ?? null;
    const countryCode = ($el.attr("data-listing-country") ?? "").toUpperCase() || null;
    const sellerType = $el.attr("data-seller-type") ?? null;

    // Extract title from h2 inside the article
    const titleSpan = $el.find("h2 span").first().text().trim();
    const subtitleSpan = $el.find("h2 span:nth-child(2)").text().trim();
    const title = [titleSpan, subtitleSpan].filter(Boolean).join(" ").trim() || `${make} ${model ?? ""}`.trim();

    const price = priceStr ? parseInt(priceStr, 10) : null;
    const mileageKm = mileageStr ? parseInt(mileageStr, 10) : null;
    const year = parseYearFromRegistration(firstReg);

    // Images from img elements
    const images: string[] = [];
    $el.find("img[src]").each((__, img) => {
      const src = $(img).attr("src") ?? "";
      if (src.includes("prod.pictures") || src.includes("autoscout24")) {
        images.push(src.replace("/250x188.webp", "/720x540.webp"));
      }
    });

    // We can't get the full URL from the DOM (no href), so construct from GUID
    const url = `https://www.autoscout24.com/offers/${guid}`;

    listings.push({
      id: guid,
      url,
      title,
      price: price && !isNaN(price) ? price : null,
      currency: "EUR",
      mileageKm: mileageKm && !isNaN(mileageKm) ? mileageKm : null,
      year,
      make,
      model: model ? capitalize(model) : null,
      fuelType: fuelType ? mapFuelCode(fuelType) : null,
      transmission: null,
      power: null,
      location: null,
      country: countryCode,
      sellerType,
      images,
      firstRegistration: firstReg,
    });
  });

  return listings;
}

/* ------------------------------------------------------------------ */
/*  Strategy 3: JSON-LD (rare on search pages, kept as fallback)       */
/* ------------------------------------------------------------------ */

function parseJsonLd($: cheerio.CheerioAPI): AS24ListingSummary[] {
  const listings: AS24ListingSummary[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "");
      if (!data) return;

      if (data["@type"] === "ItemList" && Array.isArray(data.itemListElement)) {
        for (const item of data.itemListElement) {
          const vehicle = item.item ?? item;
          const listing = parseJsonLdVehicle(vehicle);
          if (listing) listings.push(listing);
        }
      }

      if (data["@type"] === "Car" || data["@type"] === "Vehicle") {
        const listing = parseJsonLdVehicle(data);
        if (listing) listings.push(listing);
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  });

  return listings;
}

function parseJsonLdVehicle(data: Record<string, unknown>): AS24ListingSummary | null {
  const url = (data.url ?? data["@id"] ?? "") as string;
  if (!url || !url.includes("/offers/")) return null;

  const fullUrl = url.startsWith("http") ? url : `https://www.autoscout24.com${url}`;
  const name = (data.name ?? "") as string;
  if (!name) return null;

  const offers = data.offers as Record<string, unknown> | undefined;
  const price = offers?.price ? Number(offers.price) : null;
  const currency = (offers?.priceCurrency ?? "EUR") as string;

  const mileage = data.mileageFromOdometer as Record<string, unknown> | undefined;
  const mileageKm = mileage?.value ? Number(mileage.value) : null;

  const brand = data.brand as Record<string, unknown> | undefined;

  return {
    id: extractIdFromUrl(fullUrl),
    url: fullUrl,
    title: name,
    price: price && !isNaN(price) ? price : null,
    currency,
    mileageKm: mileageKm && !isNaN(mileageKm) ? mileageKm : null,
    year: typeof data.modelDate === "string" ? parseInt(data.modelDate, 10) || null : null,
    make: (brand?.name ?? "Porsche") as string,
    model: (data.model ?? null) as string | null,
    fuelType: (data.fuelType ?? null) as string | null,
    transmission: null,
    power: null,
    location: null,
    country: null,
    sellerType: null,
    images: extractImages(data),
    firstRegistration: null,
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function extractTotalResults($: cheerio.CheerioAPI): number | null {
  // Try __NEXT_DATA__ first
  const scriptEl = $("#__NEXT_DATA__");
  if (scriptEl.length > 0) {
    try {
      const data = JSON.parse(scriptEl.html() ?? "");
      const count = data?.props?.pageProps?.numberOfResults;
      if (typeof count === "number") return count;
    } catch { /* ignore */ }
  }

  // DOM fallback
  const resultText = $('[data-testid*="results-count"], [class*="results-count"], .cl-list-element-count, h1').first().text();
  const match = resultText.match(/([\d.,]+)\s*(?:Results|Ergebnisse|résultats|resultados|risultati|resultaten|Anzeigen)/i);
  if (match) {
    return parseInt(match[1].replace(/[.,]/g, ""), 10) || null;
  }
  return null;
}

function extractIdFromUrl(url: string): string {
  const match = url.match(/\/offers\/([^?#]+)/);
  return match ? match[1] : "";
}

function extractImages(data: Record<string, unknown>): string[] {
  const images: string[] = [];
  if (typeof data.image === "string") images.push(data.image);
  if (Array.isArray(data.image)) {
    for (const img of data.image) {
      if (typeof img === "string") images.push(img);
      if (typeof img === "object" && img !== null && "url" in img) images.push(String((img as Record<string, unknown>).url));
    }
  }
  return images;
}

function parsePrice(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) || num === 0 ? null : num;
}

function detectCurrency(text: string): string | null {
  if (!text) return null;
  if (text.includes("CHF") || text.includes("Fr.")) return "CHF";
  if (text.includes("£") || text.includes("GBP")) return "GBP";
  if (text.includes("$") || text.includes("USD")) return "USD";
  if (text.includes("€") || text.includes("EUR")) return "EUR";
  return "EUR";
}

function parseMileageKm(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) || num === 0 ? null : num;
}

export function parseYearFromTitle(title: string): number | null {
  const m = title.match(/\b(19\d{2}|20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

export function parseYearFromRegistration(text: string | null): number | null {
  if (!text) return null;
  // "03/2020" or "2020" or "03-2020" or "08/2019"
  const m = text.match(/(?:\d{2}[/-])?((?:19|20)\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Map AS24 fuel type codes to readable names. */
function mapFuelCode(code: string): string {
  const map: Record<string, string> = {
    b: "Gasoline", d: "Diesel", e: "Electric",
    h: "Hybrid", l: "LPG", c: "CNG", o: "Other",
  };
  return map[code.toLowerCase()] ?? code;
}
