import type { Page } from "playwright-core";
import * as cheerio from "cheerio";

import type { ListingSummary, DiscoverPageResult } from "./types";
import { isCloudflareChallenge, waitForCloudflareResolution } from "./browser";
import { extractVinFromUrl, extractClassicComId } from "./id";
import { logEvent } from "./logging";
import {
  canUseScraplingFallback,
  fetchClassicPageHtmlWithScrapling,
  shouldPreferScraplingFirst,
} from "./scrapling";

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
 * Click the "Next" pagination button instead of navigating via URL.
 * This preserves Cloudflare clearance cookies across pages.
 */
async function clickNextPage(page: Page, timeoutMs: number): Promise<boolean> {
  // Classic.com uses Material Icons for pagination: "chevron_right" = next page
  const nextSelectors = [
    'a:has-text("chevron_right")',
    'a[aria-label="Next"]',
    'a[aria-label="Next page"]',
    'a[rel="next"]',
    'a:has-text("Next")',
    'button:has-text("Next")',
    'button:has-text("chevron_right")',
  ];

  for (const selector of nextSelectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        const isDisabled = await el.getAttribute("disabled");
        const ariaDisabled = await el.getAttribute("aria-disabled");
        if (isDisabled !== null || ariaDisabled === "true") continue;

        // Record current URL to detect navigation
        const currentUrl = page.url();
        await el.click();

        // Wait for URL to change (page navigation)
        await page.waitForURL((url) => url.toString() !== currentUrl, { timeout: timeoutMs }).catch(() => {});
        await page.waitForSelector('a[href*="/veh/"]', { timeout: timeoutMs }).catch(() => {});
        await new Promise((r) => setTimeout(r, 2_000));
        return true;
      }
    } catch { /* selector didn't match, try next */ }
  }

  return false;
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
    let pageError: string | null = null;

    if (shouldPreferScraplingFirst()) {
      const scraplingHtml = await fetchClassicPageHtmlWithScrapling(url);
      if (scraplingHtml) {
        const scraplingListings = parseSearchResultsFromDOM(scraplingHtml);
        if (scraplingListings.length > 0) {
          const newListings: ListingSummary[] = [];
          for (const listing of scraplingListings) {
            if (!seenUrls.has(listing.sourceUrl)) {
              seenUrls.add(listing.sourceUrl);
              newListings.push(listing);
            }
          }

          allListings.push(...newListings);
          logEvent({
            level: "warn",
            event: "discover.scrapling_forced",
            runId: opts.runId,
            page: pageNum,
            found: newListings.length,
          });
          logEvent({
            level: "info",
            event: "discover.page_done",
            runId: opts.runId,
            page: pageNum,
            found: newListings.length,
            total: allListings.length,
            source: "scrapling",
          });
          await opts.onPageDone?.(pageNum, newListings);

          if (newListings.length === 0) {
            hasNextPage = false;
          }
          continue;
        }
      }
    }

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
      if (pageNum === 1) {
        // First page: navigate via URL
        await opts.page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: opts.pageTimeoutMs,
        });
      } else {
        // Subsequent pages: click "Next" to preserve CF clearance cookie
        const clicked = await clickNextPage(opts.page, opts.pageTimeoutMs);
        if (!clicked) {
          logEvent({ level: "info", event: "discover.no_next_button", runId: opts.runId, page: pageNum });
          hasNextPage = false;
          opts.page.removeListener("response", responseHandler);
          break;
        }
      }

      // Handle Cloudflare challenge
      if (await isCloudflareChallenge(opts.page)) {
        logEvent({ level: "warn", event: "discover.cloudflare_challenge", runId: opts.runId, page: pageNum });
        const resolved = await waitForCloudflareResolution(opts.page, 15_000);
        if (!resolved) {
          logEvent({ level: "error", event: "discover.cloudflare_blocked", runId: opts.runId, page: pageNum });
          break;
        }
        await opts.page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
      }

      // Wait for listing content to render (more reliable than networkidle)
      await opts.page.waitForSelector('a[href*="/veh/"]', { timeout: 15_000 }).catch(() => {});
      // Brief extra wait for GraphQL responses to arrive
      await new Promise((r) => setTimeout(r, 2_000));

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

      // Strategy 4: Scrapling fallback for the search page itself.
      if (pageListings.length === 0 && canUseScraplingFallback()) {
        const scraplingHtml = await fetchClassicPageHtmlWithScrapling(url);
        if (scraplingHtml) {
          const scraplingListings = parseSearchResultsFromDOM(scraplingHtml);
          if (scraplingListings.length > 0) {
            logEvent({
              level: "warn",
              event: "discover.scrapling_fallback",
              runId: opts.runId,
              page: pageNum,
              found: scraplingListings.length,
            });
            pageListings = scraplingListings;
          }
        }
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
      pageError = err instanceof Error ? err.message : String(err);
      if (canUseScraplingFallback()) {
        const scraplingHtml = await fetchClassicPageHtmlWithScrapling(url);
        if (scraplingHtml) {
          const scraplingListings = parseSearchResultsFromDOM(scraplingHtml);
          if (scraplingListings.length > 0) {
            const newListings: ListingSummary[] = [];
            for (const listing of scraplingListings) {
              if (!seenUrls.has(listing.sourceUrl)) {
                seenUrls.add(listing.sourceUrl);
                newListings.push(listing);
              }
            }

            allListings.push(...newListings);
            if (newListings.length > 0) {
              logEvent({
                level: "warn",
                event: "discover.scrapling_fallback",
                runId: opts.runId,
                page: pageNum,
                found: newListings.length,
              });
              logEvent({
                level: "info",
                event: "discover.page_done",
                runId: opts.runId,
                page: pageNum,
                found: newListings.length,
                total: allListings.length,
                source: "scrapling",
              });
              await opts.onPageDone?.(pageNum, newListings);
              continue;
            }
          }
        }
      }

      logEvent({
        level: "error",
        event: "discover.page_error",
        runId: opts.runId,
        page: pageNum,
        error: pageError,
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

    let title = container.find("h2, h3, [class*='title']").first().text().trim() ||
                  $(el).attr("title") ||
                  $(el).text().trim().split("\n")[0].trim();

    // Parse structured data from the URL slug (always reliable)
    const urlData = parseVehicleDataFromUrl(fullUrl);

    // If DOM title looks like a location (no year, no make), use URL-derived title
    if (!title || (!parseYearFromTitle(title) && !/porsche/i.test(title))) {
      title = urlData.title;
    }

    if (!title) return;

    const priceText = container.find("[class*='price']").first().text().trim();
    const price = parsePrice(priceText);

    listings.push({
      sourceUrl: fullUrl,
      classicComId: extractClassicComId(fullUrl),
      title,
      year: urlData.year ?? parseYearFromTitle(title),
      make: urlData.make ?? (/porsche/i.test(title) ? "Porsche" : null),
      model: urlData.model ?? parseModelFromTitle(title),
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

/**
 * Parse year, make, model from classic.com URL slug.
 * URL format: /veh/{year}-{make}-{model...}-{vin17}-{classicComId}
 * Example: /veh/2015-porsche-911-turbo-s-wp0cd2a94fs178193-pGwNjgp
 */
function parseVehicleDataFromUrl(url: string): {
  title: string;
  year: number | null;
  make: string | null;
  model: string | null;
} {
  const match = url.match(/\/veh\/(.+?)(?:\?|$)/);
  if (!match) return { title: "", year: null, make: null, model: null };

  const slug = match[1];
  const parts = slug.split("-");
  if (parts.length < 3) return { title: "", year: null, make: null, model: null };

  // First part: year
  const yearStr = parts[0];
  const year = /^(19|20)\d{2}$/.test(yearStr) ? parseInt(yearStr, 10) : null;

  // Second part: make
  const make = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : null;

  // Find VIN (17 alphanumeric chars) or classicComId to know where model words end
  let modelEndIdx = parts.length;
  for (let i = 2; i < parts.length; i++) {
    if (/^[a-z0-9]{17}$/i.test(parts[i])) {
      modelEndIdx = i;
      break;
    }
  }

  // Model words: everything between make and VIN
  const modelParts = parts.slice(2, modelEndIdx);
  const model = modelParts.length > 0 ? modelParts.join(" ") : null;

  // Build a human-readable title
  const titleParts = [yearStr, make, ...(modelParts)].filter(Boolean);
  const title = titleParts.join(" ");

  return { title, year, make, model };
}

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
