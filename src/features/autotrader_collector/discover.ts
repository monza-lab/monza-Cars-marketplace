import * as cheerio from "cheerio";

import { fetchHtml, getDomainFromUrl, PerDomainRateLimiter, withRetry } from "./net";
import { logEvent } from "./logging";
import type { SourceKey } from "./types";

export interface DiscoverOptions {
  runId: string;
  limiter: PerDomainRateLimiter;
  maxPages: number;
  startPage?: number;
  timeoutMs: number;
  query: string;
  onPageDone?: (page: number) => void | Promise<void>;
  make?: string;
  model?: string;
  postcode?: string;
  yearFrom?: number;
  yearTo?: number;
  priceTo?: number;
  mileageTo?: number;
}

export interface SearchFilters {
  make?: string;
  model?: string;
  postcode?: string;
  yearFrom?: number;
  yearTo?: number;
  priceFrom?: number;
  priceTo?: number;
  mileageFrom?: number;
  mileageTo?: number;
  fuelType?: string;
  transmission?: string;
}

interface GatewayListing {
  advertId?: string;
  title?: string;
  price?: string;
  vehicleLocation?: string;
  images?: string[];
  numberOfImages?: number;
  trackingContext?: {
    advertContext?: {
      make?: string;
      model?: string;
      year?: number;
    };
    advertCardFeatures?: {
      priceIndicator?: string;
    };
  };
}

interface GatewayResponse {
  data?: {
    searchResults?: {
      listings?: GatewayListing[];
      page?: {
        number?: number;
        results?: {
          count?: number;
        };
      };
      trackingContext?: {
        searchId?: string;
      };
    };
  };
  errors?: Array<{ message?: string }>;
}

export interface AutoTraderGatewayListing {
  advertId: string;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  priceText: string | null;
  vehicleLocation: string | null;
  images: string[];
  priceIndicator: string | null;
}

export interface AutoTraderGatewayPage {
  listings: AutoTraderGatewayListing[];
  totalResults: number;
  page: number;
  searchId: string | null;
}

export function buildGatewayFilters(filters: SearchFilters): Array<{ filter: string; selected: string[] }> {
  const out: Array<{ filter: string; selected: string[] }> = [
    { filter: "price_search_type", selected: ["total"] },
    { filter: "postcode", selected: [filters.postcode ?? "SW1A 1AA"] },
  ];

  if (filters.make) out.push({ filter: "make", selected: [filters.make] });
  if (filters.model) out.push({ filter: "model", selected: [filters.model] });
  if (typeof filters.yearFrom === "number") out.push({ filter: "min_year_manufactured", selected: [String(filters.yearFrom)] });
  if (typeof filters.yearTo === "number") out.push({ filter: "max_year_manufactured", selected: [String(filters.yearTo)] });
  if (typeof filters.priceFrom === "number") out.push({ filter: "min_price", selected: [String(filters.priceFrom)] });
  if (typeof filters.priceTo === "number") out.push({ filter: "max_price", selected: [String(filters.priceTo)] });
  if (typeof filters.mileageFrom === "number") out.push({ filter: "min_mileage", selected: [String(filters.mileageFrom)] });
  if (typeof filters.mileageTo === "number") out.push({ filter: "max_mileage", selected: [String(filters.mileageTo)] });

  return out;
}

export function parseGatewayListings(payload: GatewayResponse): AutoTraderGatewayPage {
  if (payload.errors && payload.errors.length > 0) {
    const message = payload.errors.map((e) => e.message).filter(Boolean).join("; ") || "Unknown AutoTrader gateway error";
    throw new Error(message);
  }

  const searchResults = payload.data?.searchResults;
  const rawListings = searchResults?.listings ?? [];
  const listings: AutoTraderGatewayListing[] = [];
  for (const row of rawListings) {
    const advertId = typeof row.advertId === "string" ? row.advertId.trim() : "";
    const title = typeof row.title === "string" ? row.title.trim() : "";
    if (!advertId || !title) continue;
    listings.push({
      advertId,
      title,
      make: row.trackingContext?.advertContext?.make ?? null,
      model: row.trackingContext?.advertContext?.model ?? null,
      year: typeof row.trackingContext?.advertContext?.year === "number" ? row.trackingContext.advertContext.year : null,
      priceText: row.price ?? null,
      vehicleLocation: row.vehicleLocation ?? null,
      images: Array.isArray(row.images) ? row.images.filter((u): u is string => typeof u === "string" && u.length > 0) : [],
      priceIndicator: row.trackingContext?.advertCardFeatures?.priceIndicator ?? null,
    });
  }

  return {
    listings,
    totalResults: searchResults?.page?.results?.count ?? 0,
    page: searchResults?.page?.number ?? 1,
    searchId: searchResults?.trackingContext?.searchId ?? null,
  };
}

export async function fetchAutoTraderGatewayPage(input: {
  page: number;
  timeoutMs: number;
  filters: SearchFilters;
}): Promise<AutoTraderGatewayPage> {
  const query = `query SearchResultsListingsGridQuery($filters:[FilterInput!]!,$channel:Channel!,$page:Int,$sortBy:SearchResultsSort,$listingType:[ListingType!],$searchId:String!,$featureFlags:[FeatureFlag]){searchResults(input:{facets:[],filters:$filters,channel:$channel,page:$page,sortBy:$sortBy,listingType:$listingType,searchId:$searchId,featureFlags:$featureFlags}){listings{... on SearchListing{advertId title price vehicleLocation images trackingContext{advertContext{make model year} advertCardFeatures{priceIndicator}}}}page{number results{count}}trackingContext{searchId}}}`;
  const body = {
    operationName: "SearchResultsListingsGridQuery",
    query,
    variables: {
      filters: buildGatewayFilters(input.filters),
      channel: "cars",
      page: input.page,
      sortBy: "relevance",
      listingType: null,
      searchId: `autotrader-${Date.now()}`,
      featureFlags: [],
    },
  };

  const refererUrl = buildSearchUrl({ ...input.filters, postcode: input.filters.postcode ?? "SW1A 1AA" });
  const res = await fetch("https://www.autotrader.co.uk/at-gateway?opname=SearchResultsListingsGridQuery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sauron-app-name": "sauron-search-results-app",
      "x-sauron-app-version": "6c9dff0561",
      Origin: "https://www.autotrader.co.uk",
      Referer: refererUrl,
      Accept: "*/*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(input.timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`AutoTrader gateway HTTP ${res.status} ${res.statusText}`);
  }

  const payload = (await res.json()) as GatewayResponse;
  return parseGatewayListings(payload);
}

export async function discoverListingUrls(source: SourceKey, opts: DiscoverOptions): Promise<string[]> {
  switch (source) {
    case "AutoTrader":
      return await discoverAutoTrader(opts);
  }
}

export async function discoverAutoTraderListingUrls(opts: DiscoverOptions): Promise<string[]> {
  return discoverListingUrls("AutoTrader", { ...opts, make: opts.make || "Porsche" });
}

/**
 * Build AutoTrader search URL with filters
 */
export function buildSearchUrl(filters: SearchFilters): string {
  const baseUrl = "https://www.autotrader.co.uk/car-search";
  const params = new URLSearchParams();

  if (filters.make) {
    params.set("make", filters.make);
  }
  if (filters.model) {
    params.set("model", filters.model);
  }
  if (filters.postcode) {
    params.set("postcode", filters.postcode);
  }
  if (filters.yearFrom) {
    params.set("year-from", String(filters.yearFrom));
  }
  if (filters.yearTo) {
    params.set("year-to", String(filters.yearTo));
  }
  if (filters.priceFrom) {
    params.set("price-from", String(filters.priceFrom));
  }
  if (filters.priceTo) {
    params.set("price-to", String(filters.priceTo));
  }
  if (filters.mileageFrom !== undefined) {
    params.set("mileage-from", String(filters.mileageFrom));
  }
  if (filters.mileageTo !== undefined) {
    params.set("mileage-to", String(filters.mileageTo));
  }
  if (filters.fuelType) {
    params.set("fuel-type", filters.fuelType);
  }
  if (filters.transmission) {
    params.set("transmission", filters.transmission);
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Extract valid AutoTrader listing URLs from HTML
 */
export function extractLinks(html: string, origin: string = "https://www.autotrader.co.uk"): string[] {
  const $ = cheerio.load(html);
  const out: string[] = [];

  // AutoTrader listing URLs typically look like:
  // /car-details/2023-Porsche-911/123456789
  // /car-search?make=Porsche&... (these are search pages, not listings)
  // We want to capture car detail pages
  const listingPathPrefixes = ["/car-details/", "/vehicle/", "/used-car/"];

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

    const abs = href.startsWith("http") ? href : `${origin}${href.startsWith("/") ? "" : "/"}${href}`;
    try {
      const u = new URL(abs);
      const path = u.pathname;
      const ok = listingPathPrefixes.some((p) => path.startsWith(p));
      if (!ok) return;
      u.hash = "";
      // Drop tracking params
      for (const key of Array.from(u.searchParams.keys())) {
        if (/^utm_/i.test(key) || key === "ref" || key === "fbclid") u.searchParams.delete(key);
      }
      out.push(u.toString());
    } catch {
      return;
    }
  });

  return out;
}

/**
 * Extract all search result links from AutoTrader search page
 * This includes both listing links and pagination links
 */
export function extractSearchResultLinks(html: string, origin: string = "https://www.autotrader.co.uk"): string[] {
  const $ = cheerio.load(html);
  const out: string[] = [];

  // AutoTrader search results have listings in multiple formats:
  // - /car-details/...
  // - /vehicle/...
  // - /used-car/...
  // Also capture search result links for pagination detection
  const validPrefixes = ["/car-details/", "/vehicle/", "/used-car/", "/car-search"];

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

    const abs = href.startsWith("http") ? href : `${origin}${href.startsWith("/") ? "" : "/"}${href}`;
    try {
      const u = new URL(abs);
      const path = u.pathname;
      const ok = validPrefixes.some((p) => path.startsWith(p));
      if (!ok) return;
      u.hash = "";
      // Drop tracking params
      for (const key of Array.from(u.searchParams.keys())) {
        if (/^utm_/i.test(key) || key === "ref" || key === "fbclid") u.searchParams.delete(key);
      }
      out.push(u.toString());
    } catch {
      return;
    }
  });

  return out;
}

/**
 * Check if there are more pages in the search results
 */
export function hasNextPage(html: string): boolean {
  const $ = cheerio.load(html);
  
  // Look for pagination next button
  // AutoTrader uses various pagination patterns
  const nextButton = $("a[data-testid='pagination-next'], button[data-testid='pagination-next'], a[aria-label='Next page'], a[rel='next']");
  if (nextButton.length > 0) return true;

  // Also check for page numbers that indicate more pages
  const pageLinks = $("a[href*='page='], a[href*='?page']");
  return pageLinks.length > 0;
}

/**
 * Get the total number of pages from the search results
 */
export function getTotalPages(html: string): number {
  const $ = cheerio.load(html);
  
  // Try to find pagination info
  // Pattern: "Page 1 of 24" or similar
  const paginationText = $("span[data-testid='pagination-info'], p.pagination-info, .pagination-info").text();
  const match = paginationText.match(/of\s+(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Count page number links
  const pageLinks = $("a[href*='page='], a[href*='?page']");
  const pages = new Set<number>();
  pageLinks.each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const u = new URL(href.startsWith("http") ? href : `https://www.autotrader.co.uk${href}`);
      const page = u.searchParams.get("page");
      if (page) {
        const num = parseInt(page, 10);
        if (!isNaN(num)) pages.add(num);
      }
    } catch {
      // ignore
    }
  });

  return pages.size > 0 ? Math.max(...pages) : 1;
}

async function discoverAutoTrader(opts: DiscoverOptions): Promise<string[]> {
  const filters: SearchFilters = {
    make: opts.make,
    model: opts.model,
    postcode: opts.postcode || "SW1A 1AA",
    yearFrom: opts.yearFrom,
    yearTo: opts.yearTo,
    priceTo: opts.priceTo,
    mileageTo: opts.mileageTo,
  };

  const out: string[] = [];
  const seen = new Set<string>();
  const startPage = Math.max(1, opts.startPage ?? 1);

  for (let page = startPage; page < startPage + opts.maxPages; page++) {
    const data = await fetchAutoTraderGatewayPage({
      page,
      timeoutMs: opts.timeoutMs,
      filters,
    });

    let newCount = 0;
    for (const listing of data.listings) {
      const url = `https://www.autotrader.co.uk/car-details/${listing.advertId}`;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push(url);
      newCount++;
    }

    logEvent({
      level: "info",
      event: "discover.gateway_page_fetched",
      runId: opts.runId,
      source: "AutoTrader",
      page,
      listings: data.listings.length,
      totalResults: data.totalResults,
      searchId: data.searchId,
    });

    if (opts.onPageDone) {
      await opts.onPageDone(page);
    }

    if (newCount === 0) break;
  }

  return out;
}

async function discoverByPaging(input: {
  runId: string;
  limiter: PerDomainRateLimiter;
  maxPages: number;
  startPage?: number;
  timeoutMs: number;
  baseUrls: string[];
  pageParam: string;
  linkExtractor: (html: string) => string[];
  source: SourceKey;
  onPageDone?: (page: number) => void | Promise<void>;
}): Promise<string[]> {
  const seen = new Set<string>();
  const urls: string[] = [];

  const base = await pickWorkingBaseUrl(input.baseUrls, input);
  if (!base) {
    logEvent({
      level: "warn",
      event: "discover.no_base_url",
      runId: input.runId,
      source: input.source,
      candidates: input.baseUrls,
    });
    return [];
  }

  const startPage = Math.max(1, input.startPage ?? 1);
  for (let page = startPage; page < startPage + input.maxPages; page++) {
    const pageUrl = withPageParam(base, input.pageParam, page);
    const domain = getDomainFromUrl(pageUrl);
    await input.limiter.waitForDomain(domain);

    const { value: html, attempts } = await withRetry(
      async () => await fetchHtml(pageUrl, input.timeoutMs),
      { retries: 2, baseDelayMs: 500 },
    );

    logEvent({
      level: "info",
      event: "discover.page_fetched",
      runId: input.runId,
      source: input.source,
      page,
      pageUrl,
      attempts,
      bytes: html.length,
    });

    const found = input.linkExtractor(html);
    let newCount = 0;
    for (const u of found) {
      if (seen.has(u)) continue;
      seen.add(u);
      urls.push(u);
      newCount++;
    }

    if (input.onPageDone) {
      await input.onPageDone(page);
    }

    if (newCount === 0) {
      // Heuristic stop: if no new links on a page, further pages likely won't help.
      break;
    }

    // Also stop if no more pages available
    if (page > 1 && !hasNextPage(html)) {
      logEvent({
        level: "info",
        event: "discover.no_more_pages",
        runId: input.runId,
        source: input.source,
        page,
      });
      break;
    }
  }

  return urls;
}

async function pickWorkingBaseUrl(
  candidates: string[],
  input: { limiter: PerDomainRateLimiter; timeoutMs: number },
): Promise<string | null> {
  for (const url of candidates) {
    try {
      const domain = getDomainFromUrl(url);
      await input.limiter.waitForDomain(domain);
      await fetchHtml(url, input.timeoutMs);
      return url;
    } catch {
      // keep trying
    }
  }
  return null;
}

function withPageParam(baseUrl: string, param: string, page: number): string {
  try {
    const u = new URL(baseUrl);
    if (page === 1) return u.toString();
    u.searchParams.set(param, String(page));
    return u.toString();
  } catch {
    if (page === 1) return baseUrl;
    const join = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${join}${encodeURIComponent(param)}=${page}`;
  }
}
