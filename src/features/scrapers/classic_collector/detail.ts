import { load } from "cheerio";
import type { Page } from "playwright-core";

import type { ClassicComRawListing, DetailParsed } from "./types";
import { isCloudflareChallenge, waitForCloudflareResolution } from "./browser";
import { extractVinFromUrl } from "./id";
import { canUseScraplingFallback, fetchClassicDetailWithScrapling } from "./scrapling";

export interface DetailFetchOptions {
  page: Page;
  url: string;
  pageTimeoutMs: number;
  runId: string;
}

export interface ClassicDetailContent {
  title: string;
  bodyText: string;
  images: string[];
}

function buildDetailParsed(content: ClassicDetailContent, url: string): DetailParsed {
  const { title, bodyText, images } = content;

  // --- Title ---
  const normalizedTitle = title.trim();

  // --- VIN ---
  const vinMatch = bodyText.match(/VIN:\s*([A-HJ-NPR-Z0-9]{17})/i);
  const vin = vinMatch ? vinMatch[1] : null;

  // --- Auction House (the "by X" text near FOR SALE) ---
  const byMatch = bodyText.match(/(?:FOR SALE|SOLD)\s*\n?\s*by\s*\n?\s*(.+)/i);
  const auctionHouse = byMatch ? byMatch[1].trim().split("\n")[0].trim() : null;

  // --- Status ---
  let status: string | null = null;
  let saleResult: string | null = null;
  if (/\bFOR SALE\b/i.test(bodyText)) {
    status = "forsale";
  }
  if (/\bSOLD\b/.test(bodyText) && /\bfor\s+\$[\d,]+/i.test(bodyText)) {
    status = "sold";
    saleResult = "sold";
  }

  // --- Price (asking price from the listing, or sold price from history) ---
  // Look for price near "FOR SALE" or a comp-range price
  const priceRangeMatch = bodyText.match(/price range from \$([\d,]+)\s*-\s*\$([\d,]+)/i);
  let price: number | null = null;
  if (priceRangeMatch) {
    const low = parseInt(priceRangeMatch[1].replace(/,/g, ""), 10);
    const high = parseInt(priceRangeMatch[2].replace(/,/g, ""), 10);
    price = Math.round((low + high) / 2);
  }

  // Look for an explicit sold price: "Sold at ... for $X"
  const soldPriceMatch = bodyText.match(/Sold at\s+[\s\S]*?for \$([\d,]+)/i);
  let hammerPrice: number | null = null;
  if (soldPriceMatch) {
    hammerPrice = parseInt(soldPriceMatch[1].replace(/,/g, ""), 10);
  }

  // --- Location ---
  // Pattern: "City, State, USA" typically appears after the auction house
  const locationPatterns = bodyText.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*USA)/g);
  const location = locationPatterns ? locationPatterns[0] : null;

  // --- Mileage ---
  const mileageMatch = bodyText.match(/(\d[\d,]*)\s*mi\b/i);
  const mileage = mileageMatch ? parseInt(mileageMatch[1].replace(/,/g, ""), 10) : null;

  // --- Specs section (key-value pairs in the rendered text) ---
  const specs: Record<string, string> = {};
  const specsSection = bodyText.match(/Specs\s*\n[\s\S]*?(?=See an error|Loading seller|$)/i);
  if (specsSection) {
    const text = specsSection[0];
    const pairs = [
      ["Year", /Year\s*\n\s*(\d{4})/],
      ["Make", /Make\s*\n\s*([^\n]+)/],
      ["ModelFamily", /Model Family\s*\n\s*([^\n]+)/],
      ["ModelVariant", /Model Variant\s*\n\s*([^\n]+)/],
      ["ModelTrim", /Model Trim\s*\n\s*([^\n]+)/],
      ["Engine", /Engine\s*\n\s*([^\n]+)/],
      ["Transmission", /Transmission\s*\n\s*([^\n]+)/],
      ["DriveType", /Drive Type\s*\n\s*([^\n]+)/],
      ["Mileage", /Mileage\s*\n\s*([^\n]+)/],
      ["VIN", /VIN\s*\n\s*([^\n]+)/],
      ["BodyStyle", /Body Style\s*\n\s*([^\n]+)/],
      ["Doors", /Doors\s*\n\s*([^\n]+)/],
      ["DriverSide", /Driver Side\s*\n\s*([^\n]+)/],
      ["ExtColor", /Ext\. Color Group\s*\n\s*([^\n]+)/],
      ["IntColor", /Int\. Color Group\s*\n\s*([^\n]+)/],
      ["Originality", /Originality\s*\n\s*([^\n]+)/],
    ] as const;

    for (const [key, regex] of pairs) {
      const match = text.match(regex as RegExp);
      if (match) {
        const val = match[1].trim();
        if (val && val !== "-") specs[key] = val;
      }
    }
  }

  // --- End time ---
  const endsMatch = bodyText.match(/ends?\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i);
  const endTime = endsMatch ? endsMatch[1] : null;

  // --- Bid count ---
  const bidMatch = bodyText.match(/(\d+)\s*bids?/i);
  const bidCount = bidMatch ? parseInt(bidMatch[1], 10) : null;

  // --- Past sale history ---
  const historyMatch = bodyText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\s*\n\s*Sold at\s*\n?\s*(.+?)\s*\n\s*for\s+\$([\d,]+)/i);
  let historySaleDate: string | null = null;
  let historyAuctionHouse: string | null = null;
  let historyHammerPrice: number | null = null;
  if (historyMatch) {
    historySaleDate = historyMatch[0].match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i)?.[1] || null;
    historyAuctionHouse = historyMatch[2].trim().replace(/\s*Auctions?\s*$/i, "").trim();
    historyHammerPrice = parseInt(historyMatch[3].replace(/,/g, ""), 10);
  }

  const yearMatch = normalizedTitle.match(/\b(19\d{2}|20\d{2})\b/);
  const makeMatch = normalizedTitle.match(/\b(Porsche|Ferrari|BMW|Mercedes|Lamborghini)\b/i);
  const modelAfterMake = normalizedTitle.match(/(?:Porsche|Ferrari|BMW)\s+(.+)/i);

  const raw: ClassicComRawListing = {
    id: "",
    title: normalizedTitle,
    year: yearMatch ? parseInt(yearMatch[1], 10) : null,
    make: makeMatch ? makeMatch[1] : (specs.Make || null),
    model: specs.ModelFamily || (modelAfterMake ? modelAfterMake[1].split(/\s+/)[0] : null),
    trim: specs.ModelTrim || specs.ModelVariant || null,
    vin: vin || specs.VIN || extractVinFromUrl(url),
    mileage,
    mileageUnit: "miles",
    price,
    currency: "USD",
    status,
    auctionHouse: auctionHouse || historyAuctionHouse,
    auctionDate: historySaleDate,
    location,
    images,
    url,
    description: null,
    exteriorColor: specs.ExtColor || null,
    interiorColor: specs.IntColor || null,
    engine: specs.Engine || null,
    transmission: specs.Transmission || null,
    bodyStyle: specs.BodyStyle || null,
    bidCount,
    reserveStatus: null,
    saleResult,
    hammerPrice: hammerPrice || historyHammerPrice,
    endTime,
    startTime: null,
  };

  return { raw };
}

const CLASSIC_IMAGE_ATTRS = [
  "src",
  "data-src",
  "data-lazy-src",
  "data-lazy",
  "data-zoom-image",
  "srcset",
] as const;

/**
 * Extract classic.com vehicle photo URLs from raw HTML.
 *
 * Classic.com lazy-loads gallery slides: the eager <img src> only holds
 * the hero — the rest sit on data-src / data-lazy-src / data-zoom-image
 * until they scroll into view. Reading every image-bearing attribute
 * catches all gallery variants without depending on Playwright render
 * timing.
 */
export function extractClassicVehicleImagesFromHtml(html: string): string[] {
  const $ = load(html);
  const images: string[] = [];
  const seen = new Set<string>();

  $("img, source").each((_i, el) => {
    for (const attr of CLASSIC_IMAGE_ATTRS) {
      const raw = $(el).attr(attr);
      if (!raw) continue;

      // srcset may contain "url 1x, url 2x" — split into individual candidates.
      const candidates = attr === "srcset"
        ? raw.split(",").map((c) => c.trim().split(/\s+/)[0]).filter(Boolean)
        : [raw.trim()];

      for (const candidate of candidates) {
        if (!candidate || candidate.startsWith("data:")) continue;

        let url: URL;
        try {
          url = new URL(candidate, "https://classic.com");
        } catch {
          continue;
        }

        if (!/(^|\.)classic\.com$/i.test(url.hostname)) continue;
        if (!url.pathname.toLowerCase().startsWith("/vehicles/")) continue;
        if (!/\.(jpe?g|png|webp|avif)(?:$|\?)/i.test(url.pathname)) continue;

        const normalized = url.toString();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        images.push(normalized);
      }
    }
  });

  return images;
}

async function extractClassicDetailContentFromPage(page: Page): Promise<ClassicDetailContent> {
  const { title, bodyText } = await page.evaluate(() => ({
    title: document.querySelector("h1")?.textContent?.trim() || document.title || "",
    bodyText: document.body.innerText,
  }));
  const html = await page.content();
  const images = extractClassicVehicleImagesFromHtml(html);
  return { title, bodyText, images };
}

/**
 * Navigate to a classic.com vehicle listing page and extract all data.
 *
 * Classic.com is fully server-rendered (no GraphQL or __NUXT__ on detail pages).
 * We use Playwright's page.evaluate() to read the rendered text and extract
 * structured data from the page layout.
 */
export async function fetchAndParseDetail(opts: DetailFetchOptions): Promise<DetailParsed> {
  const navigateAndParse = async (): Promise<DetailParsed> => {
    await opts.page.goto(opts.url, {
      waitUntil: "domcontentloaded",
      timeout: opts.pageTimeoutMs,
    });

    // Handle Cloudflare challenge
    if (await isCloudflareChallenge(opts.page)) {
      const resolved = await waitForCloudflareResolution(opts.page, 15_000);
      if (!resolved) {
        throw new Error("Cloudflare challenge not resolved");
      }
      await opts.page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
    }

    // Wait for page content to render
    await opts.page.waitForSelector("h1", { timeout: 15_000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1_500));

    const extracted = await extractClassicDetailContentFromPage(opts.page);
    const parsed = buildDetailParsed(extracted, opts.url);

    // When the rendered page is partially empty, try Scrapling as a richer fallback.
    if (canUseScraplingFallback() && parsed.raw.images.length === 0) {
      const fallback = await fetchClassicDetailWithScrapling(opts.url);
      if (fallback) {
        const fallbackParsed = buildDetailParsed(fallback, opts.url);
        if (fallbackParsed.raw.images.length > parsed.raw.images.length) {
          return fallbackParsed;
        }
      }
    }

    return parsed;
  };

  try {
    return await navigateAndParse();
  } catch (error) {
    if (canUseScraplingFallback()) {
      const fallback = await fetchClassicDetailWithScrapling(opts.url);
      if (fallback) {
        return buildDetailParsed(fallback, opts.url);
      }
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Exports for testing                                                */
/* ------------------------------------------------------------------ */

export { extractVinFromUrl };
export { buildDetailParsed as parseClassicDetailContent };
