import type { Page } from "playwright-core";

import type { ClassicComRawListing, DetailParsed } from "./types";
import { isCloudflareChallenge, waitForCloudflareResolution } from "./browser";
import { extractVinFromUrl } from "./id";

export interface DetailFetchOptions {
  page: Page;
  url: string;
  pageTimeoutMs: number;
  runId: string;
}

/**
 * Navigate to a classic.com vehicle listing page and extract all data.
 *
 * Classic.com is fully server-rendered (no GraphQL or __NUXT__ on detail pages).
 * We use Playwright's page.evaluate() to read the rendered text and extract
 * structured data from the page layout.
 */
export async function fetchAndParseDetail(opts: DetailFetchOptions): Promise<DetailParsed> {
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

  // Extract all data from the rendered page using evaluate
  const extracted = await opts.page.evaluate(() => {
    const body = document.body.innerText;

    // --- Title ---
    const h1 = document.querySelector("h1");
    const title = h1?.textContent?.trim() || "";

    // --- VIN ---
    const vinMatch = body.match(/VIN:\s*([A-HJ-NPR-Z0-9]{17})/i);
    const vin = vinMatch ? vinMatch[1] : null;

    // --- Auction House (the "by X" text near FOR SALE) ---
    const byMatch = body.match(/(?:FOR SALE|SOLD)\s*\n\s*by\s*\n?\s*(.+)/i);
    const auctionHouse = byMatch ? byMatch[1].trim().split("\n")[0].trim() : null;

    // --- Status ---
    let status: string | null = null;
    let saleResult: string | null = null;
    if (/\bFOR SALE\b/i.test(body)) {
      status = "forsale";
    }
    if (/\bSOLD\b/.test(body) && /\bfor\s+\$[\d,]+/i.test(body)) {
      status = "sold";
      saleResult = "sold";
    }

    // --- Price (asking price from the listing, or sold price from history) ---
    // Look for price near "FOR SALE" or a comp-range price
    const priceRangeMatch = body.match(/price range from \$([\d,]+)\s*-\s*\$([\d,]+)/i);
    let price: number | null = null;
    if (priceRangeMatch) {
      const low = parseInt(priceRangeMatch[1].replace(/,/g, ""), 10);
      const high = parseInt(priceRangeMatch[2].replace(/,/g, ""), 10);
      price = Math.round((low + high) / 2);
    }

    // Look for an explicit sold price: "Sold at ... for $X"
    const soldPriceMatch = body.match(/Sold at\s+[\s\S]*?for \$([\d,]+)/i);
    let hammerPrice: number | null = null;
    if (soldPriceMatch) {
      hammerPrice = parseInt(soldPriceMatch[1].replace(/,/g, ""), 10);
    }

    // --- Location ---
    // Pattern: "City, State, USA" typically appears after the auction house
    const locationPatterns = body.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*USA)/g);
    const location = locationPatterns ? locationPatterns[0] : null;

    // --- Mileage ---
    const mileageMatch = body.match(/(\d[\d,]*)\s*mi\b/i);
    const mileage = mileageMatch ? parseInt(mileageMatch[1].replace(/,/g, ""), 10) : null;

    // --- Specs section (key-value pairs in the rendered text) ---
    const specs: Record<string, string> = {};
    const specsSection = body.match(/Specs\s*\n[\s\S]*?(?=See an error|Loading seller|$)/i);
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

    // --- Images (only vehicle photos from images.classic.com) ---
    const images: string[] = [];
    const seen = new Set<string>();
    document.querySelectorAll("img[src]").forEach((el) => {
      const src = (el as HTMLImageElement).src;
      if (src.includes("images.classic.com/vehicles/") && !seen.has(src)) {
        seen.add(src);
        images.push(src);
      }
    });

    // --- End time ---
    const endsMatch = body.match(/ends?\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i);
    const endTime = endsMatch ? endsMatch[1] : null;

    // --- Bid count ---
    const bidMatch = body.match(/(\d+)\s*bids?/i);
    const bidCount = bidMatch ? parseInt(bidMatch[1], 10) : null;

    // --- Past sale history ---
    const historyMatch = body.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\s*\n\s*Sold at\s*\n?\s*(.+?)\s*\n\s*for\s+\$([\d,]+)/i);
    let historySaleDate: string | null = null;
    let historyAuctionHouse: string | null = null;
    let historyHammerPrice: number | null = null;
    if (historyMatch) {
      historySaleDate = historyMatch[0].match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i)?.[1] || null;
      historyAuctionHouse = historyMatch[2].trim().replace(/\s*Auctions?\s*$/i, "").trim();
      historyHammerPrice = parseInt(historyMatch[3].replace(/,/g, ""), 10);
    }

    return {
      title,
      vin,
      auctionHouse: auctionHouse || historyAuctionHouse,
      status,
      saleResult,
      price,
      hammerPrice: hammerPrice || historyHammerPrice,
      location,
      mileage,
      specs,
      images,
      endTime,
      bidCount,
      historySaleDate,
    };
  });

  // Map extracted data to ClassicComRawListing
  const yearMatch = extracted.title.match(/\b(19\d{2}|20\d{2})\b/);
  const makeMatch = extracted.title.match(/\b(Porsche|Ferrari|BMW|Mercedes|Lamborghini)\b/i);
  const modelAfterMake = extracted.title.match(/(?:Porsche|Ferrari|BMW)\s+(.+)/i);

  const raw: ClassicComRawListing = {
    id: "",
    title: extracted.title,
    year: yearMatch ? parseInt(yearMatch[1], 10) : null,
    make: makeMatch ? makeMatch[1] : (extracted.specs.Make || null),
    model: extracted.specs.ModelFamily || (modelAfterMake ? modelAfterMake[1].split(/\s+/)[0] : null),
    trim: extracted.specs.ModelTrim || extracted.specs.ModelVariant || null,
    vin: extracted.vin || extracted.specs.VIN || extractVinFromUrl(opts.url),
    mileage: extracted.mileage,
    mileageUnit: "miles",
    price: extracted.price,
    currency: "USD",
    status: extracted.status,
    auctionHouse: extracted.auctionHouse,
    auctionDate: extracted.historySaleDate,
    location: extracted.location,
    images: extracted.images,
    url: opts.url,
    description: null,
    exteriorColor: extracted.specs.ExtColor || null,
    interiorColor: extracted.specs.IntColor || null,
    engine: extracted.specs.Engine || null,
    transmission: extracted.specs.Transmission || null,
    bodyStyle: extracted.specs.BodyStyle || null,
    bidCount: extracted.bidCount,
    reserveStatus: null,
    saleResult: extracted.saleResult,
    hammerPrice: extracted.hammerPrice,
    endTime: extracted.endTime,
    startTime: null,
  };

  return { raw };
}

/* ------------------------------------------------------------------ */
/*  Exports for testing                                                */
/* ------------------------------------------------------------------ */

export { extractVinFromUrl };
