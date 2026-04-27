import * as cheerio from "cheerio";

import { fetchHtml, getDomainFromUrl, PerDomainRateLimiter, withRetry } from "./net";
import type { DiscoverPageResult, ListingSummary } from "./types";

export function buildSearchCountUrl(viewCount: number, keyword: string): string {
  const vc = Math.max(1, Math.floor(viewCount));
  const q = encodeURIComponent(keyword.trim().toLowerCase() || "porsche");
  return `https://www.beforward.jp/ajax/search_count/view_cnt=${vc}/keyword=${q}/kmode=and`;
}

export function buildStockPageUrl(keyword: string, page: number): string {
  const q = encodeURIComponent(keyword.trim().toLowerCase() || "porsche");
  if (page <= 1) return `https://www.beforward.jp/stocklist/sortkey=n/keyword=${q}/kmode=and/`;
  return `https://www.beforward.jp/stocklist/sortkey=n/keyword=${q}/kmode=and/page=${page}/`;
}

export function buildStocklistPageUrl(page: number): string {
  return buildStockPageUrl("porsche", page);
}

export function computeTotalPages(totalResults: number, perPage: number): number {
  if (totalResults <= 0 || perPage <= 0) return 0;
  return Math.ceil(totalResults / perPage);
}

export function extractListingUrlsFromHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href.startsWith("/porsche/")) return;
    if (!/\/id\/\d+\/?/i.test(href)) return;
    const absolute = `https://www.beforward.jp${href}`;
    try {
      const u = new URL(absolute);
      u.hash = "";
      out.add(u.toString());
    } catch {
      return;
    }
  });
  return Array.from(out);
}

export async function discoverPage(input: {
  page: number;
  limiter: PerDomainRateLimiter;
  timeoutMs: number;
}): Promise<DiscoverPageResult> {
  const pageUrl = buildStocklistPageUrl(input.page);
  const domain = getDomainFromUrl(pageUrl);
  await input.limiter.waitForDomain(domain);
  const { value: html } = await withRetry(() => fetchHtml(pageUrl, input.timeoutMs), {
    retries: 5,
    baseDelayMs: 2000,
  });

  const $ = cheerio.load(html);
  const totalResults = parseTotalResults($);
  const pageCount = parsePageCount($);
  const listings = parseListingRows($, input.page);

  // Diagnostic: log when parser finds 0 listings despite receiving HTML
  if (listings.length === 0) {
    const htmlSize = html.length;
    const preview = html.slice(0, 200).replace(/\s+/g, " ");
    console.warn(
      `[BeForward] Page ${input.page}: 0 listings parsed. HTML size=${htmlSize}, totalResults=${totalResults}, preview="${preview}"`,
    );
  }

  return {
    totalResults,
    pageCount,
    listings,
  };
}

function parseTotalResults($: cheerio.CheerioAPI): number | null {
  const content = $('meta[name="ga_stocklist_results"]').attr("content")?.trim() ?? "";
  const n = parseInt(content, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePageCount($: cheerio.CheerioAPI): number {
  let maxPage = 1;
  $('a[href*="/stocklist/"][href*="/page="]').each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    const m = href.match(/\/page=(\d+)\//);
    if (!m) return;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > maxPage) maxPage = n;
  });

  const relNext = $('link[rel="next"]').attr("href") ?? "";
  const mRel = relNext.match(/\/page=(\d+)\//);
  if (mRel) {
    const n = parseInt(mRel[1], 10);
    if (Number.isFinite(n) && n > maxPage) maxPage = n;
  }

  return maxPage;
}

function parseListingRows($: cheerio.CheerioAPI, page: number): ListingSummary[] {
  const out: ListingSummary[] = [];
  $("tr.stocklist-row").each((_i, el) => {
    const row = $(el);
    const href = row.find("a.vehicle-url-link").first().attr("href")?.trim() ?? "";
    if (!href.startsWith("/porsche/")) return;

    const sourceUrl = `https://www.beforward.jp${href}`;
    const refText = row.find("p.veh-stock-no").text();
    const refNo = parseRefNo(refText);

    const title = cleanText(row.find("p.make-model").first().text());
    const mileageText = row.find("td.mileage p.val").text();
    const yearText = row.find("td.year p.val").text();
    const locationText = row.find("td.location p.val").text();

    const priceText = row.find("p.vehicle-price").first().text();
    const totalPriceText = row.find("p.total-price").first().text();

    out.push({
      page,
      sourceUrl,
      refNo,
      title,
      priceUsd: parseUsd(priceText),
      totalPriceUsd: parseUsd(totalPriceText),
      mileageKm: parseKm(mileageText),
      year: parseYear(yearText || title),
      location: cleanText(locationText) || null,
    });
  });

  if (out.length === 0) {
    const rowCount = $("tr.stocklist-row").length;
    console.warn(
      `[BeForward] parseListingRows: 0 valid listings. stocklist-row count=${rowCount}`,
    );
  }

  return out;
}

function parseRefNo(input: string): string | null {
  const m = input.match(/Ref\s*No\.\s*([A-Z0-9]+)/i);
  return m?.[1]?.toUpperCase() ?? null;
}

function parseUsd(input: string): number | null {
  const m = input.match(/\$\s*([\d,]+)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function parseKm(input: string): number | null {
  const m = input.match(/([\d,]+)\s*km/i);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function parseYear(input: string): number | null {
  const m = input.match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const max = new Date().getUTCFullYear() + 1;
  return n >= 1900 && n <= max ? n : null;
}

function cleanText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}
