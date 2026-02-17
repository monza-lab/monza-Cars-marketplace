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
}

export async function discoverListingUrls(source: SourceKey, opts: DiscoverOptions): Promise<string[]> {
  switch (source) {
    case "BaT":
      return await discoverBaT(opts);
    case "CarsAndBids":
      return await discoverCarsAndBids(opts);
    case "CollectingCars":
      return await discoverCollectingCars(opts);
  }
}

export async function discoverPorscheListingUrls(source: SourceKey, opts: DiscoverOptions): Promise<string[]> {
  return discoverListingUrls(source, { ...opts, make: "Porsche", query: opts.query || "porsche" });
}

function makeSlug(value: string | undefined): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "porsche";
  return raw.replace(/\s+/g, "-");
}

async function discoverBaT(opts: DiscoverOptions): Promise<string[]> {
  const q = encodeURIComponent(opts.query);
  const slug = makeSlug(opts.make ?? opts.query);
  // Multiple discovery paths for better coverage:
  // 1. Search results (ended + active mix)
  // 2. Porsche make-specific page (dedicated Porsche listings)
  // 3. Active auctions search
  const candidates = [
    `https://bringatrailer.com/${slug}/`,
    `https://bringatrailer.com/auctions/results/?search=${q}`,
    `https://bringatrailer.com/auctions/?search=${q}`,
  ];

  // Scrape all working URLs (not just the first) for maximum coverage
  const allUrls: string[] = [];
  const seen = new Set<string>();

  for (const base of candidates) {
    try {
      const urls = await discoverByPaging({
        ...opts,
        baseUrls: [base],
        pageParam: "page",
        linkExtractor: (html) => extractLinks(html, "https://bringatrailer.com", ["/listing/"]),
        source: "BaT",
      });
      for (const u of urls) {
        if (!seen.has(u)) {
          seen.add(u);
          allUrls.push(u);
        }
      }
    } catch {
      // If one candidate fails, continue with others
    }
  }

  return allUrls;
}

async function discoverCarsAndBids(opts: DiscoverOptions): Promise<string[]> {
  const q = encodeURIComponent(opts.query);
  const candidates = [
    `https://carsandbids.com/auctions/past/?q=${q}`,
    `https://carsandbids.com/auctions/past?q=${q}`,
    `https://carsandbids.com/auctions/?q=${q}`,
    `https://carsandbids.com/auctions?q=${q}`,
  ];
  return await discoverByPaging({
    ...opts,
    baseUrls: candidates,
    pageParam: "page",
    linkExtractor: (html) => extractLinks(html, "https://carsandbids.com", ["/auctions/"]),
    source: "CarsAndBids",
  });
}

async function discoverCollectingCars(opts: DiscoverOptions): Promise<string[]> {
  const q = encodeURIComponent(opts.query);
  const candidates = [
    `https://collectingcars.com/search?q=${q}`,
    `https://collectingcars.com/search?query=${q}`,
    `https://collectingcars.com/search?search=${q}`,
  ];
  return await discoverByPaging({
    ...opts,
    baseUrls: candidates,
    pageParam: "page",
    linkExtractor: (html) => extractLinks(html, "https://collectingcars.com", ["/cars/", "/lots/"]),
    source: "CollectingCars",
  });
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
  }

  return urls;
}

async function pickWorkingBaseUrl(candidates: string[], input: { limiter: PerDomainRateLimiter; timeoutMs: number }): Promise<string | null> {
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

function extractLinks(html: string, origin: string, pathPrefixes: string[]): string[] {
  const $ = cheerio.load(html);
  const out: string[] = [];

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

    const abs = href.startsWith("http") ? href : `${origin}${href.startsWith("/") ? "" : "/"}${href}`;
    try {
      const u = new URL(abs);
      const path = u.pathname;
      const ok = pathPrefixes.some((p) => path.startsWith(p));
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
