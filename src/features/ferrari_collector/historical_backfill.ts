/**
 * Historical Backfill: scrapes the last 12 months of sold BaT auctions
 * for every model represented in our active listings, enriches each with
 * full detail-page data (specs, photos, location, etc.), and stores
 * results across all Supabase tables via the same pipeline as the live scraper.
 *
 * NOTE: Prior backfill runs used source_id format "bat-hist-{slug}".
 * After switching to deriveSourceId() (produces "bat-{slug}"), old rows
 * are orphaned. Run this SQL once to clean up:
 *   DELETE FROM listings WHERE source_id LIKE 'bat-hist-%';
 *
 * Usage:
 *   npx tsx src/features/ferrari_collector/historical_backfill.ts
 */

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { scrapeDetail, type BaTAuction } from "@/lib/scrapers/bringATrailer";
import { createSupabaseWriter } from "./supabase_writer";
import { canonicalizeUrl, deriveSourceId } from "./id";
import { fetchHtml, PerDomainRateLimiter } from "./net";
import {
  buildLocationString,
  mapReserveStatus,
  mapReserveStatusFromString,
  mapSourceToPlatform,
  normalizeMileageToKm,
  normalizeSourceAuctionHouse,
  parseLocation,
  scoreDataQuality,
  toUtcDateOnly,
} from "./normalize";
import type { NormalizedListing, ScrapeMeta } from "./types";

// ─── Types ───

interface DiscoveredListing {
  url: string;
  title: string;
  priceText: string | null;
  dateText: string | null;
}

export interface BackfillResultSummary {
  sourceId: string;
  title: string;
  year: number;
  model: string;
  hammerPrice: number | null;
  saleDate: string | null;
  dataQualityScore: number;
  detailScraped: boolean;
}

export interface BackfillRunResult {
  modelsSearched: string[];
  discovered: number;
  written: number;
  results: BackfillResultSummary[];
  errors: string[];
}

// ─── Config ───

const RATE_LIMIT_MS = 2000;
const TWELVE_MONTHS_AGO = toUtcDateOnly(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
const TODAY = toUtcDateOnly(new Date());

// Override table for models whose BaT slug can't be auto-derived.
// NOT the driving list — the DB query is. This is only a lookup for edge cases.
const SLUG_OVERRIDES: Record<string, string> = {
  "488 Pista": "488",
  "328 GTS": "328",
  "296 GTB": "296-gtb-gts",
  "360 Spider": "360",
  "365 GT": "365-gt-22",
  "SF90 Spider": "sf90",
  "550 Maranello": "550-maranello",
  "512 TR": "testarossa",
  "Dino 246": "dino",
};

/**
 * Derive a BaT URL slug from a model name.
 * Checks SLUG_OVERRIDES first, then auto-derives: lowercase + hyphens.
 */
function modelToSlug(model: string): string {
  if (SLUG_OVERRIDES[model]) return SLUG_OVERRIDES[model];
  return model.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ─── Parse helpers ───

function parsePrice(text: string | null): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseYear(title: string): number | null {
  const m = title.match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  return year >= 1940 && year <= new Date().getFullYear() + 1 ? year : null;
}

/**
 * Parse BaT date text like "1/21/26" or "12/19/25" into YYYY-MM-DD.
 */
function parseBaTDate(text: string | null): string | null {
  if (!text) return null;
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ─── Discovery: extract sold listings from BaT embedded JSON ───

/**
 * BaT model pages embed a JSON variable `auctionsCompletedInitialData`
 * in a <script> block containing all completed auction data. This avoids
 * needing to parse JS-rendered DOM.
 */
function extractEmbeddedItems(html: string): BaTEmbeddedItem[] {
  const marker = "var auctionsCompletedInitialData";
  const idx = html.indexOf(marker);
  if (idx === -1) return [];

  const start = html.indexOf("{", idx);
  if (start === -1) return [];

  let depth = 0;
  let end = start;
  for (let i = start; i < html.length; i++) {
    if (html[i] === "{") depth++;
    if (html[i] === "}") depth--;
    if (depth === 0) { end = i + 1; break; }
  }

  try {
    const data = JSON.parse(html.slice(start, end));
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

interface BaTEmbeddedItem {
  url?: string;
  title?: string;
  current_bid?: number;
  sold_text?: string;  // e.g. 'Sold for USD $276,000 <span> on 1/21/26 </span>'
  timestamp_end?: number;
  active?: boolean;
  country_code_alpha3?: string;
}

function parseSoldText(soldText: string | undefined): { price: number | null; dateText: string | null } {
  if (!soldText) return { price: null, dateText: null };
  const priceMatch = soldText.match(/\$([\d,]+)/);
  const price = priceMatch ? parsePrice(`$${priceMatch[1]}`) : null;
  const dateMatch = soldText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  const dateText = dateMatch ? dateMatch[1] : null;
  return { price, dateText };
}

async function discoverFromModelPage(
  model: string,
  slug: string,
  limiter: PerDomainRateLimiter,
): Promise<DiscoveredListing[]> {
  const pageUrl = `https://bringatrailer.com/ferrari/${slug}/`;
  await limiter.waitForDomain("bringatrailer.com");

  let html: string;
  try {
    html = await fetchHtml(pageUrl, 15000);
  } catch (err) {
    console.log(`  [discover] Fetch failed for "${model}": ${err instanceof Error ? err.message : err}`);
    return [];
  }

  const items = extractEmbeddedItems(html);
  console.log(`  [discover] Extracted ${items.length} embedded items for "${model}"`);

  const listings: DiscoveredListing[] = [];
  for (const item of items) {
    if (!item.url || !item.title) continue;
    // Skip active auctions — we only want historical sold data
    if (item.active) continue;
    // Skip non-car items
    if (/\bwheel|poster|model\s*car|luggage|memorabilia|tool/i.test(item.title)) continue;
    if (!/ferrari/i.test(item.title)) continue;

    const { price, dateText } = parseSoldText(item.sold_text);

    listings.push({
      url: item.url,
      title: item.title,
      priceText: price !== null ? `$${price}` : (item.current_bid ? `$${item.current_bid}` : null),
      dateText,
    });
  }

  return listings;
}

// ─── Detail scraping + normalization ───

function buildAuctionStub(listing: DiscoveredListing, model: string, year: number, discoveredPrice: number | null): BaTAuction {
  return {
    externalId: deriveSourceId({ source: "BaT", sourceUrl: listing.url }),
    platform: "BRING_A_TRAILER",
    title: listing.title,
    make: "Ferrari",
    model,
    year,
    mileage: null,
    mileageUnit: "miles",
    transmission: null,
    engine: null,
    exteriorColor: null,
    interiorColor: null,
    location: null,
    currentBid: discoveredPrice,
    bidCount: 0,
    endTime: null,
    url: listing.url,
    imageUrl: null,
    description: null,
    sellerNotes: null,
    status: "sold",
    vin: null,
    images: [],
    reserveStatus: null,
    bodyStyle: null,
  };
}

function enrichedToNormalizedListing(
  enriched: BaTAuction,
  discoveredPrice: number | null,
  saleDate: string,
  model: string,
  meta: ScrapeMeta,
): NormalizedListing {
  const url = canonicalizeUrl(enriched.url);
  const sourceId = deriveSourceId({ source: "BaT", sourceUrl: url });

  const year = enriched.year || parseYear(enriched.title) || 0;

  const mileageKm = normalizeMileageToKm(
    enriched.mileage,
    enriched.mileageUnit || "miles",
  );

  const location = parseLocation(enriched.location);

  const photos = (enriched.images || []).filter(
    (p: string) => typeof p === "string" && p.length > 0,
  );

  // Use the detail-scraped bid as hammer price, fall back to discovery price
  const hammerPrice = enriched.currentBid ?? discoveredPrice;

  const hasPrice = hammerPrice !== null;
  const dataQualityScore = scoreDataQuality({
    year,
    model,
    saleDate,
    country: location.country,
    photosCount: photos.length,
    hasPrice,
  });

  const endTimeDate = saleDate ? new Date(saleDate + "T00:00:00Z") : null;
  const validEndTime = endTimeDate && !isNaN(endTimeDate.getTime()) ? endTimeDate : null;

  return {
    source: "BaT",
    sourceId,
    sourceUrl: url,
    title: enriched.title,
    platform: mapSourceToPlatform("BaT"),
    sellerNotes: enriched.sellerNotes ?? null,
    endTime: validEndTime,
    startTime: null,
    reserveStatus: mapReserveStatusFromString(enriched.reserveStatus) ?? mapReserveStatus(null),
    finalPrice: hammerPrice,
    locationString: buildLocationString(location),
    year,
    make: "Ferrari",
    model,
    trim: null,
    bodyStyle: enriched.bodyStyle ?? null,
    engine: enriched.engine ?? null,
    transmission: enriched.transmission ?? null,
    exteriorColor: enriched.exteriorColor ?? null,
    interiorColor: enriched.interiorColor ?? null,
    vin: enriched.vin ?? null,
    mileageKm,
    mileageUnitStored: "km",
    status: "sold",
    reserveMet: null,
    listDate: null,
    saleDate,
    auctionDate: saleDate,
    auctionHouse: normalizeSourceAuctionHouse("BaT"),
    descriptionText: enriched.description ?? null,
    photos,
    photosCount: photos.length,
    location,
    pricing: {
      hammerPrice,
      currentBid: enriched.currentBid ?? discoveredPrice,
      bidCount: enriched.bidCount ?? null,
      originalCurrency: "USD",
      rawPriceText: null,
    },
    dataQualityScore,
  };
}

// ─── Main ───

export async function runHistoricalBackfill(): Promise<BackfillRunResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { modelsSearched: [], discovered: 0, written: 0, results: [], errors: ["Missing Supabase env vars"] };
  }

  // Raw client for the read-only model discovery query
  const readClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Writer for full upsertAll to all tables
  const writer = createSupabaseWriter();
  const scrapeTimestamp = new Date().toISOString();
  const runId = crypto.randomUUID();
  const meta: ScrapeMeta = { runId, scrapeTimestamp };

  // Get every distinct Ferrari model from the DB (not just active)
  const { data: modelRows } = await readClient
    .from("listings")
    .select("model")
    .eq("make", "Ferrari");

  const models = [...new Set(
    (modelRows || []).map((r: { model: string }) => r.model).filter(Boolean)
  )];
  console.log(`\n=== Historical Backfill (enriched): ${models.length} models ===`);
  console.log(`  Models: ${models.join(", ")}`);
  console.log(`  Date range: ${TWELVE_MONTHS_AGO} → ${TODAY}\n`);

  const limiter = new PerDomainRateLimiter(RATE_LIMIT_MS);
  const allResults: BackfillResultSummary[] = [];
  const errors: string[] = [];
  let totalDiscovered = 0;
  let totalWritten = 0;
  let totalDetailScraped = 0;

  for (const model of models) {
    const slug = modelToSlug(model);

    console.log(`[${model}] Discovering from bringatrailer.com/ferrari/${slug}/ ${SLUG_OVERRIDES[model] ? "(override)" : "(auto-derived)"} ...`);

    let listings: DiscoveredListing[];
    try {
      listings = await discoverFromModelPage(model, slug, limiter);
    } catch (err) {
      const msg = `Discovery failed for ${model}: ${err instanceof Error ? err.message : err}`;
      errors.push(msg);
      console.error(`  ${msg}`);
      continue;
    }

    totalDiscovered += listings.length;
    console.log(`  Total discovered: ${listings.length}`);

    for (const listing of listings) {
      const saleDate = parseBaTDate(listing.dateText);

      // Filter: only within last 12 months
      if (saleDate && (saleDate < TWELVE_MONTHS_AGO || saleDate > TODAY)) {
        continue;
      }

      const price = parsePrice(listing.priceText);
      const year = parseYear(listing.title);
      if (!year) continue; // Skip items without a parseable year (parts, accessories)

      const effectiveSaleDate = saleDate ?? toUtcDateOnly(new Date(scrapeTimestamp));

      // Detail scrape: enrich with specs, photos, location, description
      let detailScraped = false;
      const stub = buildAuctionStub(listing, model, year, price);
      let enriched: BaTAuction = stub;

      try {
        await limiter.waitForDomain("bringatrailer.com");
        enriched = await scrapeDetail(stub);
        detailScraped = true;
        console.log(`  [detail] Scraped: ${listing.url}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  [detail] Failed for ${listing.url}: ${msg} — using minimal data`);
        errors.push(`Detail scrape failed: ${listing.url}: ${msg}`);
      }

      // Build NormalizedListing from enriched data
      const normalized = enrichedToNormalizedListing(enriched, price, effectiveSaleDate, model, meta);

      // Write via upsertAll to all tables (listings + satellite tables)
      try {
        await writer.upsertAll(normalized, meta, false);
        totalWritten++;
        if (detailScraped) totalDetailScraped++;

        allResults.push({
          sourceId: normalized.sourceId,
          title: normalized.title,
          year: normalized.year,
          model,
          hammerPrice: normalized.pricing.hammerPrice,
          saleDate: normalized.saleDate,
          dataQualityScore: normalized.dataQualityScore,
          detailScraped,
        });

        const priceStr = normalized.pricing.hammerPrice
          ? `$${normalized.pricing.hammerPrice.toLocaleString()}`
          : "no price";
        console.log(
          `  + ${year} Ferrari ${model} — ${priceStr} (${effectiveSaleDate}) [quality: ${normalized.dataQualityScore}/100${detailScraped ? ", enriched" : ""}]`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Write failed: ${listing.url}: ${msg}`);
        console.error(`  [write] Failed for ${listing.url}: ${msg}`);
      }
    }
  }

  console.log(`\n=== Backfill Complete ===`);
  console.log(`  Models: ${models.length}`);
  console.log(`  Discovered: ${totalDiscovered}`);
  console.log(`  Written: ${totalWritten}`);
  console.log(`  Detail-scraped: ${totalDetailScraped}/${totalWritten}`);
  console.log(`  Errors: ${errors.length}`);

  return { modelsSearched: models, discovered: totalDiscovered, written: totalWritten, results: allResults, errors };
}

// ─── Light backfill (for daily cron) ───

export interface LightBackfillResult {
  modelsSearched: string[];
  newModelsFound: string[];
  discovered: number;
  written: number;
  skippedExisting: number;
  errors: string[];
  timedOut: boolean;
  durationMs: number;
}

/**
 * Time-budgeted, capped backfill of recently sold listings.
 * Designed to run as Step 3 of the daily cron within Vercel's timeout.
 *
 * - Queries DB for every distinct Ferrari model (fully dynamic)
 * - Derives BaT slug via SLUG_OVERRIDES or auto-derivation
 * - Filters to listings sold within the last `windowDays`
 * - Skips listings already in Supabase (batch source_id check)
 * - Caps at `maxListingsPerModel` new listings per model
 * - Exits early if `timeBudgetMs` is exceeded
 */
export async function runLightBackfill(config: {
  windowDays: number;
  maxListingsPerModel: number;
  timeBudgetMs: number;
}): Promise<LightBackfillResult> {
  const startTime = Date.now();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { modelsSearched: [], newModelsFound: [], discovered: 0, written: 0, skippedExisting: 0, errors: ["Missing Supabase env vars"], timedOut: false, durationMs: 0 };
  }

  const readClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const writer = createSupabaseWriter();
  const runId = crypto.randomUUID();
  const scrapeTimestamp = new Date().toISOString();
  const meta: ScrapeMeta = { runId, scrapeTimestamp };

  const dateFrom = toUtcDateOnly(new Date(Date.now() - config.windowDays * 24 * 60 * 60 * 1000));
  const dateTo = toUtcDateOnly(new Date());

  // Query DB for every distinct Ferrari model
  const { data: modelRows } = await readClient
    .from("listings")
    .select("model")
    .eq("make", "Ferrari");

  const allModels = [...new Set(
    (modelRows || []).map((r: { model: string }) => r.model).filter(Boolean)
  )];

  const newModelsFound = allModels.filter((m) => !SLUG_OVERRIDES[m]);
  if (newModelsFound.length > 0) {
    console.log(`  [light-backfill] New models (auto-derived slug): ${newModelsFound.join(", ")}`);
  }
  console.log(`  [light-backfill] ${allModels.length} models from DB (${newModelsFound.length} auto-derived)`);

  const limiter = new PerDomainRateLimiter(RATE_LIMIT_MS);
  const modelsSearched: string[] = [];
  const errors: string[] = [];
  let discovered = 0;
  let written = 0;
  let skippedExisting = 0;
  let timedOut = false;

  for (const model of allModels) {
    const slug = modelToSlug(model);
    // Time budget check before each model
    if (Date.now() - startTime >= config.timeBudgetMs) {
      timedOut = true;
      break;
    }

    modelsSearched.push(model);

    // Discover sold listings from BaT model page
    let listings: DiscoveredListing[];
    try {
      listings = await discoverFromModelPage(model, slug, limiter);
    } catch (err) {
      errors.push(`Discovery failed for ${model}: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    // Filter to date window and valid years
    const inWindow = listings.filter((l) => {
      const saleDate = parseBaTDate(l.dateText);
      if (!saleDate) return false;
      if (saleDate < dateFrom || saleDate > dateTo) return false;
      const year = parseYear(l.title);
      return year !== null;
    });

    discovered += inWindow.length;

    // Batch check: get existing source_ids to skip already-ingested listings
    const candidateIds = inWindow.map((l) =>
      deriveSourceId({ source: "BaT", sourceUrl: canonicalizeUrl(l.url) }),
    );

    const { data: existingRows } = await readClient
      .from("listings")
      .select("source_id")
      .in("source_id", candidateIds);

    const existingIds = new Set(
      (existingRows || []).map((r: { source_id: string }) => r.source_id),
    );

    // Filter to only new listings, cap at maxListingsPerModel
    let writtenForModel = 0;

    for (const listing of inWindow) {
      if (writtenForModel >= config.maxListingsPerModel) break;

      // Time budget check before each detail scrape
      if (Date.now() - startTime >= config.timeBudgetMs) {
        timedOut = true;
        break;
      }

      const sourceId = deriveSourceId({ source: "BaT", sourceUrl: canonicalizeUrl(listing.url) });
      if (existingIds.has(sourceId)) {
        skippedExisting++;
        continue;
      }

      const saleDate = parseBaTDate(listing.dateText)!;
      const price = parsePrice(listing.priceText);
      const year = parseYear(listing.title)!;

      const stub = buildAuctionStub(listing, model, year, price);
      let enriched: BaTAuction = stub;

      try {
        await limiter.waitForDomain("bringatrailer.com");
        enriched = await scrapeDetail(stub);
      } catch (err) {
        errors.push(`Detail scrape failed: ${listing.url}: ${err instanceof Error ? err.message : err}`);
        // Fall through with stub data
      }

      const normalized = enrichedToNormalizedListing(enriched, price, saleDate, model, meta);

      try {
        await writer.upsertAll(normalized, meta, false);
        written++;
        writtenForModel++;
        console.log(`  [light-backfill] + ${year} Ferrari ${model} — ${saleDate}`);
      } catch (err) {
        errors.push(`Write failed: ${listing.url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (timedOut) break;
  }

  return {
    modelsSearched,
    newModelsFound,
    discovered,
    written,
    skippedExisting,
    errors,
    timedOut,
    durationMs: Date.now() - startTime,
  };
}

// ─── CLI entry point ───

const isMain = process.argv[1]?.endsWith("historical_backfill.ts") || process.argv[1]?.endsWith("historical_backfill.js");

if (isMain) {
  import("dotenv").then((dotenv) => {
    dotenv.config({ path: ".env.local" });

    runHistoricalBackfill()
      .then((result) => {
        console.log("\n=== Results by Model ===");
        const byModel = new Map<string, BackfillResultSummary[]>();
        for (const r of result.results) {
          const existing = byModel.get(r.model) || [];
          existing.push(r);
          byModel.set(r.model, existing);
        }
        for (const [model, results] of byModel) {
          console.log(`\n  ${model} (${results.length} sold in last 12 months):`);
          results.sort((a, b) => (b.saleDate ?? "").localeCompare(a.saleDate ?? ""));
          for (const r of results) {
            const price = r.hammerPrice ? `$${r.hammerPrice.toLocaleString()}` : "n/a";
            const detail = r.detailScraped ? "enriched" : "minimal";
            console.log(`    ${r.year ?? "?"} — ${price} — ${r.saleDate ?? "?"} [${detail}, q=${r.dataQualityScore}]`);
          }
        }
        if (result.errors.length > 0) {
          console.log(`\n  Errors (${result.errors.length}):`);
          result.errors.slice(0, 10).forEach((e) => console.log(`    - ${e}`));
        }
      })
      .catch((err) => {
        console.error("Fatal error:", err);
        process.exit(1);
      });
  });
}
