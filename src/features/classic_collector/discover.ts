import type { Page } from "playwright-core";
import * as cheerio from "cheerio";

import type { ListingSummary, DiscoverPageResult } from "./types";
import { isCloudflareChallenge, waitForCloudflareResolution } from "./browser";
import { extractVinFromUrl, extractClassicComId } from "./id";
import { logEvent } from "./logging";

export interface DiscoverOptions {
  page: Page;
  make: string;
  location: string;
  status: string;
  maxPages: number;
  maxListings: number;
  navigationDelayMs: number;
  pageTimeoutMs: number;
  runId: string;
  onPageDone?: (pageNum: number, listings: ListingSummary[]) => Promise<void>;
}

/**
 * Build the classic.com search URL for a given page number.
 */
export function buildSearchUrl(
  make: string,
  location: string,
  status: string,
  page?: number,
): string {
  const params = new URLSearchParams();
  params.set("q", make);
  params.set("result_type", "listings");
  params.set("status", status);
  params.set("filters[location]", location);
  if (page && page > 1) {
    params.set("page", String(page));
  }
  return `https://www.classic.com/search/?${params.toString()}`;
}

/**
 * Discover all listings from classic.com search pages.
 *
 * Strategy:
 * 1. Navigate to search page → intercept GraphQL responses
 * 2. Fallback to __NUXT__ hydration data
 * 3. Last resort: parse rendered DOM
 * 4. Paginate until maxPages or no more results
 */
export async function discoverAllListings(opts: DiscoverOptions): Promise<DiscoverPageResult> {
  const allListings: ListingSummary[] = [];
  const seenUrls = new Set<string>();
  let totalResults: number | null = null;
  let hasNextPage = true;

  for (let pageNum = 1; pageNum <= opts.maxPages && hasNextPage; pageNum++) {
    if (allListings.length >= opts.maxListings) break;

    const url = buildSearchUrl(opts.make, opts.location, opts.status, pageNum);
    logEvent({ level: "info", event: "discover.page_start", runId: opts.runId, page: pageNum, url });

    const graphqlPayloads: unknown[] = [];

    // Set up GraphQL response interception
    const responseHandler = async (response: { url: () => string; json: () => Promise<unknown> }) => {
      const respUrl = response.url();
      if (respUrl.includes("graphql-prod.classic.com") || respUrl.includes("graphql")) {
        try {
          const json = await response.json();
          graphqlPayloads.push(json);
        } catch { /* non-JSON response, ignore */ }
      }
    };
    opts.page.on("response", responseHandler);

    try {
      await opts.page.goto(url, {
        waitUntil: "networkidle",
        timeout: opts.pageTimeoutMs,
      });

      // Handle Cloudflare challenge
      if (await isCloudflareChallenge(opts.page)) {
        logEvent({ level: "warn", event: "discover.cloudflare_challenge", runId: opts.runId, page: pageNum });
        const resolved = await waitForCloudflareResolution(opts.page, 15_000);
        if (!resolved) {
          logEvent({ level: "error", event: "discover.cloudflare_blocked", runId: opts.runId, page: pageNum });
          break;
        }
        // Wait for content after challenge resolution
        await opts.page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      }

      // Try extraction strategies in priority order
      let pageListings: ListingSummary[] = [];

      // Strategy 1: Parse GraphQL responses
      if (graphqlPayloads.length > 0) {
        const parsed = parseGraphQLSearchResponses(graphqlPayloads);
        pageListings = parsed.listings;
        if (parsed.totalResults !== null) totalResults = parsed.totalResults;
      }

      // Strategy 2: Extract from __NUXT__ hydration data
      if (pageListings.length === 0) {
        pageListings = await extractFromNuxtData(opts.page);
      }

      // Strategy 3: Parse rendered DOM
      if (pageListings.length === 0) {
        const html = await opts.page.content();
        pageListings = parseSearchResultsFromDOM(html);
      }

      // Deduplicate
      const newListings: ListingSummary[] = [];
      for (const listing of pageListings) {
        if (!seenUrls.has(listing.sourceUrl)) {
          seenUrls.add(listing.sourceUrl);
          newListings.push(listing);
        }
      }

      allListings.push(...newListings);

      logEvent({
        level: "info",
        event: "discover.page_done",
        runId: opts.runId,
        page: pageNum,
        found: newListings.length,
        total: allListings.length,
      });

      // Stop if no new listings on this page
      if (newListings.length === 0) {
        hasNextPage = false;
      }

      await opts.onPageDone?.(pageNum, newListings);
    } catch (err) {
      logEvent({
        level: "error",
        event: "discover.page_error",
        runId: opts.runId,
        page: pageNum,
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue to next page on error
    } finally {
      opts.page.removeListener("response", responseHandler);
    }

    // Navigation delay before next page
    if (pageNum < opts.maxPages && hasNextPage) {
      await new Promise((r) => setTimeout(r, opts.navigationDelayMs));
    }
  }

  return {
    totalResults,
    listings: allListings.slice(0, opts.maxListings),
    hasNextPage,
  };
}

/* ------------------------------------------------------------------ */
/*  GraphQL response parsing                                           */
/* ------------------------------------------------------------------ */

export function parseGraphQLSearchResponses(
  payloads: unknown[],
): { listings: ListingSummary[]; totalResults: number | null } {
  const listings: ListingSummary[] = [];
  let totalResults: number | null = null;

  for (const payload of payloads) {
    if (!payload || typeof payload !== "object") continue;
    const results = extractListingsFromGraphQL(payload);
    listings.push(...results.listings);
    if (results.totalResults !== null) totalResults = results.totalResults;
  }

  return { listings, totalResults };
}

function extractListingsFromGraphQL(data: unknown): { listings: ListingSummary[]; totalResults: number | null } {
  const listings: ListingSummary[] = [];
  let totalResults: number | null = null;

  // Recursively search the GraphQL response for listing arrays
  function walk(obj: unknown): void {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const listing = tryParseGraphQLListing(item);
        if (listing) listings.push(listing);
        walk(item);
      }
      return;
    }

    const record = obj as Record<string, unknown>;

    // Look for total count fields
    if (typeof record.totalResults === "number") totalResults = record.totalResults;
    if (typeof record.total === "number" && totalResults === null) totalResults = record.total;
    if (typeof record.count === "number" && totalResults === null) totalResults = record.count;

    for (const value of Object.values(record)) {
      walk(value);
    }
  }

  walk(data);
  return { listings, totalResults };
}

function tryParseGraphQLListing(item: unknown): ListingSummary | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;

  // Must have a URL or slug pointing to /veh/
  const url = (obj.url ?? obj.slug ?? obj.href ?? obj.permalink ?? "") as string;
  const fullUrl = url.startsWith("http") ? url :
                  url.startsWith("/") ? `https://www.classic.com${url}` : "";

  if (!fullUrl.includes("/veh/")) return null;

  const title = ((obj.title ?? obj.name ?? "") as string).trim();
  if (!title) return null;

  return {
    sourceUrl: fullUrl,
    classicComId: extractClassicComId(fullUrl),
    title,
    year: typeof obj.year === "number" ? obj.year : parseYearFromTitle(title),
    make: typeof obj.make === "string" ? obj.make : null,
    model: typeof obj.model === "string" ? obj.model : null,
    vin: (typeof obj.vin === "string" && obj.vin.length === 17) ? obj.vin : extractVinFromUrl(fullUrl),
    price: typeof obj.price === "number" ? obj.price :
           typeof obj.askingPrice === "number" ? obj.askingPrice : null,
    auctionHouse: typeof obj.auctionHouse === "string" ? obj.auctionHouse :
                  typeof obj.source === "string" ? obj.source :
                  typeof obj.platform === "string" ? obj.platform : null,
    status: typeof obj.status === "string" ? obj.status : null,
    location: typeof obj.location === "string" ? obj.location : null,
    thumbnailUrl: typeof obj.thumbnail === "string" ? obj.thumbnail :
                  typeof obj.image === "string" ? obj.image : null,
  };
}

/* ------------------------------------------------------------------ */
/*  __NUXT__ hydration data extraction                                 */
/* ------------------------------------------------------------------ */

async function extractFromNuxtData(page: Page): Promise<ListingSummary[]> {
  try {
    const nuxtData = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return w.__NUXT__ ?? w.__NUXT_DATA__ ?? null;
    });

    if (!nuxtData || typeof nuxtData !== "object") return [];

    const results = extractListingsFromGraphQL(nuxtData);
    return results.listings;
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  DOM parsing fallback                                               */
/* ------------------------------------------------------------------ */

export function parseSearchResultsFromDOM(html: string): ListingSummary[] {
  const $ = cheerio.load(html);
  const listings: ListingSummary[] = [];

  // Look for listing cards with links to /veh/ pages
  $('a[href*="/veh/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const fullUrl = href.startsWith("http") ? href : `https://www.classic.com${href}`;

    // Skip duplicates within the same DOM parse
    if (listings.some((l) => l.sourceUrl === fullUrl)) return;

    // Try to extract data from the card
    const card = $(el).closest("[class*='card'], [class*='listing'], [class*='result']");
    const container = card.length > 0 ? card : $(el);

    const title = container.find("h2, h3, [class*='title']").first().text().trim() ||
                  $(el).attr("title") ||
                  $(el).text().trim().split("\n")[0].trim();

    if (!title) return;

    const priceText = container.find("[class*='price']").first().text().trim();
    const price = parsePrice(priceText);

    listings.push({
      sourceUrl: fullUrl,
      classicComId: extractClassicComId(fullUrl),
      title,
      year: parseYearFromTitle(title),
      make: /porsche/i.test(title) ? "Porsche" : null,
      model: parseModelFromTitle(title),
      vin: extractVinFromUrl(fullUrl),
      price,
      auctionHouse: null,
      status: null,
      location: null,
      thumbnailUrl: container.find("img").first().attr("src") ?? null,
    });
  });

  return listings;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseYearFromTitle(title: string): number | null {
  const m = title.match(/\b(19\d{2}|20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function parseModelFromTitle(title: string): string | null {
  const m = title.match(/\bPorsche\s+(\S+)/i);
  return m ? m[1] : null;
}

function parsePrice(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num);
}
