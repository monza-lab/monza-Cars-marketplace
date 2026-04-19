import crypto from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import { fetchAuctionData, type ScrapedAuctionData } from "@/features/scrapers/common/scraper";

import { loadCheckpoint, saveCheckpoint, updateSourceCheckpoint } from "./checkpoint";
import { discoverListingUrls, fetchAutoTraderGatewayPage } from "./discover";
import { canonicalizeUrl, deriveSourceId } from "./id";
import { logEvent } from "./logging";
import { getDomainFromUrl, PerDomainRateLimiter, withRetry, fetchHtml } from "./net";
import { fetchAutoTraderDetail } from "./detail";
import {
  buildLocationString,
  isLuxuryCarListing,
  mapAuctionStatus,
  mapSourceToPlatform,
  normalizeMileageToKm,
  normalizeSourceAuctionHouse,
  parseCurrencyFromText,
  parseLocation,
  parseYearFromTitle,
  scoreDataQuality,
  toUtcDateOnly,
} from "./normalize";
import { createSupabaseWriter } from "./supabase_writer";
import { createDryRunWriter } from "./supabase_writer";
import type {
  CollectorRunConfig,
  NormalizedListing,
  ScrapeMeta,
  SourceKey,
  SourceScrapeCounts,
} from "./types";

type ActiveListingBase = {
  source: SourceKey;
  url: string;
  externalId: string | null;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  mileageUnit: string | null;
  price: number | null;
  priceText: string | null;
  status: string | null;
  location: string | null;
  images: string[];
  priceIndicator: string | null;
};

export interface CollectorResult {
  runId: string;
  sourceCounts: Record<string, SourceScrapeCounts>;
  errors: string[];
}

const TERMINAL_STATUSES = new Set(["sold", "unsold", "delisted"]);

/**
 * Checks if a listing already exists in Supabase with a terminal status
 * (sold/unsold/delisted). Prevents the collector from reverting a corrected
 * status back to "active" when the scraper mis-detects a removed listing.
 */
async function hasTerminalStatus(sourceId: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data } = await client
    .from("listings")
    .select("status")
    .eq("source_id", sourceId)
    .limit(1);

  const existing = data?.[0]?.status;
  return typeof existing === "string" && TERMINAL_STATUSES.has(existing);
}

export async function runAutoTraderCollector(config: CollectorRunConfig): Promise<CollectorResult> {
  const runId = crypto.randomUUID();
  const scrapeTimestamp = new Date().toISOString();
  const meta: ScrapeMeta = { runId, scrapeTimestamp };
  const limiter = new PerDomainRateLimiter(1000);

  logEvent({
    level: "info",
    event: "collector.start",
    runId,
    config: {
      mode: config.mode,
      model: config.model,
      postcode: config.postcode,
      endedWindowDays: config.endedWindowDays,
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      maxActivePagesPerSource: config.maxActivePagesPerSource,
      maxEndedPagesPerSource: config.maxEndedPagesPerSource,
      scrapeDetails: config.scrapeDetails,
      dryRun: config.dryRun,
      checkpointPath: config.checkpointPath,
    },
  });

  const checkpoint = await loadCheckpoint(config.checkpointPath);
  const checkpointRef: { value: typeof checkpoint } = { value: checkpoint };
  const writer = config.dryRun ? createDryRunWriter() : createSupabaseWriter();

  const sources: SourceKey[] = ["AutoTrader"];
  let updatedCheckpoint = checkpointRef.value;
  const sourceCounts: Record<string, SourceScrapeCounts> = {};
  const errors: string[] = [];

  for (const source of sources) {
    try {
      const counts = await runSource({
        source,
        config,
        meta,
        limiter,
        writer,
        checkpointRef,
        checkpointPath: config.checkpointPath,
      });
      sourceCounts[source] = counts;
      logEvent({ level: "info", event: "collector.source_done", runId, source, counts });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${source}: ${msg}`);
      logEvent({ level: "error", event: "collector.source_error", runId, source, message: msg });
    }

    updatedCheckpoint = updateSourceCheckpoint(checkpointRef.value, source, config.mode, {
      nowIso: scrapeTimestamp,
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      lastProcessedPage: checkpointRef.value.sources?.[source]?.backfill?.lastProcessedPage,
    });

    checkpointRef.value = updatedCheckpoint;
    await saveCheckpoint(config.checkpointPath, updatedCheckpoint);
  }

  logEvent({ level: "info", event: "collector.done", runId });
  return { runId, sourceCounts, errors };
}

/**
 * Convenience wrapper for calling the collector from a cron endpoint or programmatic context.
 * Accepts partial overrides; fills in sensible defaults.
 */
export async function runCollector(
  overrides: Partial<CollectorRunConfig> = {},
): Promise<CollectorResult> {
  const config: CollectorRunConfig = {
    mode: overrides.mode ?? "daily",
    make: overrides.make ?? "Porsche",
    model: overrides.model,
    postcode: overrides.postcode ?? "SW1A 1AA",
    endedWindowDays: overrides.endedWindowDays ?? 90,
    dateFrom: overrides.dateFrom,
    dateTo: overrides.dateTo,
    maxActivePagesPerSource: overrides.maxActivePagesPerSource ?? 5,
    maxEndedPagesPerSource: overrides.maxEndedPagesPerSource ?? 5,
    scrapeDetails: overrides.scrapeDetails ?? true,
    checkpointPath: overrides.checkpointPath ?? "/tmp/autotrader_collector/checkpoint.json",
    dryRun: overrides.dryRun ?? false,
  };

  return runAutoTraderCollector(config);
}

export function selectBackfillUrls(urls: string[]): string[] {
  return urls;
}

async function runSource(input: {
  source: SourceKey;
  config: CollectorRunConfig;
  meta: ScrapeMeta;
  limiter: PerDomainRateLimiter;
  writer: ReturnType<typeof createSupabaseWriter>;
  checkpointRef: { value: Awaited<ReturnType<typeof loadCheckpoint>> };
  checkpointPath: string;
}): Promise<SourceScrapeCounts> {
  const { source, config, meta, limiter } = input;
  const runId = meta.runId;

  const counts: SourceScrapeCounts = {
    discovered: 0,
    autotraderKept: 0,
    skippedMissingRequired: 0,
    written: 0,
    errored: 0,
    retried: 0,
  };

  const writer = input.writer;

  // 1) Active listings (daily mode) - scrape search results for active listings
  if (config.mode === "daily") {
    const active = await scrapeActiveListings(source, config.maxActivePagesPerSource, config.make, config.model, config.postcode);
    counts.discovered += active.length;

    for (const a of active) {
      const keep = isLuxuryCarListing({ make: a.make, title: a.title, targetMake: config.make });
      if (!keep) continue;
      counts.autotraderKept++;

      try {
        const normalized = await normalizeFromBaseAndUrl({
          source,
          url: a.url,
          base: a,
          limiter,
          meta,
          scrapeDetails: config.scrapeDetails,
          make: config.make,
        });

        if (!normalized) {
          counts.skippedMissingRequired++;
          continue;
        }

        // Never revert a listing that was already marked as sold/unsold/delisted
        if (await hasTerminalStatus(normalized.sourceId)) {
          logEvent({ level: "info", event: "collector.skip_terminal", runId, source, url: a.url, sourceId: normalized.sourceId });
          continue;
        }

        await writer.upsertAll(normalized, meta, config.dryRun);
        counts.written++;
      } catch (err) {
        counts.errored++;
        logEvent({
          level: "error",
          event: "collector.listing_error",
          runId,
          source,
          url: a.url,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // 2) Backfill mode - discover and process historical listings
  if (config.mode === "backfill") {
    const previousPage = input.checkpointRef.value.sources?.[source]?.backfill?.lastProcessedPage ?? 0;
    const discoverStartPage = Math.max(1, previousPage + 1);
    
    const endedRange = computeEndedRange(config, meta.scrapeTimestamp);
    
    const urls = await discoverListingUrls(source, {
      runId,
      limiter,
      maxPages: config.maxEndedPagesPerSource,
      startPage: discoverStartPage,
      timeoutMs: 15000,
        query: config.make.toLowerCase(),
        make: config.make,
        model: config.model,
        postcode: config.postcode,
        onPageDone: async (page: number) => {
        input.checkpointRef.value = updateSourceCheckpoint(input.checkpointRef.value, source, "backfill", {
          nowIso: meta.scrapeTimestamp,
          dateFrom: endedRange.dateFrom,
          dateTo: endedRange.dateTo,
          lastProcessedPage: page,
        });
        await saveCheckpoint(input.checkpointPath, input.checkpointRef.value);
      },
    });

    const discoveredUrls = selectBackfillUrls(urls);
    counts.discovered += discoveredUrls.length;

    for (const url of discoveredUrls) {
      try {
        const normalized = await normalizeFromBaseAndUrl({
          source,
          url,
          base: null,
          limiter,
          meta,
          scrapeDetails: config.scrapeDetails,
          make: config.make,
        });

        if (!normalized) {
          counts.skippedMissingRequired++;
          continue;
        }

        // Backfill mode: process all listings regardless of status
        if (!isLuxuryCarListing({ make: config.make, title: normalized.title, targetMake: config.make })) continue;

        counts.autotraderKept++;
        await writer.upsertAll(normalized, meta, config.dryRun);
        counts.written++;
      } catch (err) {
        counts.errored++;
        logEvent({
          level: "error",
          event: "collector.ended_listing_error",
          runId,
          source,
          url,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return counts;
}

/**
 * Scrape active listings from AutoTrader search results
 */
async function scrapeActiveListings(
  source: SourceKey,
  maxPages: number,
  make: string,
  model: string | undefined,
  postcode: string | undefined,
): Promise<ActiveListingBase[]> {
  const listings: ActiveListingBase[] = [];

  for (let page = 1; page <= maxPages; page++) {
    try {
      const gateway = await fetchAutoTraderGatewayPage({
        page,
        timeoutMs: 15000,
        filters: {
          make,
          model,
          postcode: postcode ?? "SW1A 1AA",
        },
      });

      for (const row of gateway.listings) {
        listings.push({
          source,
          url: canonicalizeUrl(`https://www.autotrader.co.uk/car-details/${row.advertId}`),
          externalId: row.advertId,
          title: row.title,
          make: row.make,
          model: row.model,
          year: row.year,
          mileage: null,
          mileageUnit: null,
          price: parsePrice(row.priceText ?? ""),
          priceText: row.priceText,
          status: "active",
          location: row.vehicleLocation,
          images: row.images,
          priceIndicator: row.priceIndicator,
        });
      }

      if (gateway.listings.length === 0) break;
    } catch (err) {
      logEvent({
        level: "warn",
        event: "collector.gateway_page_error",
        runId: "",
        page,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  
  return listings;
}

/**
 * Build AutoTrader search URL
 */
function buildAutoTraderSearchUrl(make: string, page: number = 1): string {
  const baseUrl = "https://www.autotrader.co.uk/car-search";
  const params = new URLSearchParams({
    make: make,
    postcode: "SW1A 1AA", // Default UK postcode
    page: String(page),
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Fetch and parse AutoTrader listing details
 */
async function fetchAutoTraderListing(url: string): Promise<{
  url: string;
  externalId: string | null;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  mileageUnit: string | null;
  price: number | null;
  priceText: string | null;
  status: string | null;
} | null> {
  try {
    const html = await fetchHtml(url, 15000);
    const $ = cheerio.load(html);
    
    // Extract title
    const title = $("h1").first().text().trim() || 
                  $("[data-testid='vehicle-title']").text().trim() || 
                  $(".vehicle-title").text().trim() || "";
    
    if (!title) return null;
    
    // Extract year from title
    const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
    
    // Extract price
    const priceText = $("[data-testid='price']").first().text().trim() ||
                     $(".price").first().text().trim() ||
                     $('[class*="price"]').first().text().trim() || "";
    
    const price = parsePrice(priceText);
    
    // Extract mileage
    const mileageText = $("[data-testid='mileage']").text().trim() ||
                       $(".mileage").text().trim() ||
                       $('[class*="mileage"]').text().trim() || "";
    const mileage = parseMileage(mileageText);
    const mileageUnit = mileageText.toLowerCase().includes("km") ? "km" : 
                       mileageText.toLowerCase().includes("mile") ? "miles" : null;
    
    // Extract listing ID from URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    const externalId = pathParts[pathParts.length - 1] || null;
    
    // Extract make from title
    const make = makeFromTitle(title);
    const model = modelFromTitle(title, make);
    
    // Determine status
    const status = "active"; // AutoTrader listings are active by default
    
    return {
      url: canonicalizeUrl(url),
      externalId,
      title,
      make,
      model,
      year,
      mileage,
      mileageUnit,
      price,
      priceText: priceText || null,
      status,
    };
  } catch (err) {
    logEvent({
      level: "warn",
      event: "collector.listing_parse_error",
      runId: "",
      url,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function parsePrice(text: string): number | null {
  if (!text) return null;
  // Remove currency symbols and parse
  const cleaned = text.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const match = cleaned.match(/[\d.]+/);
  if (!match) return null;
  return parseFloat(match[0]);
}

function parseMileage(text: string): number | null {
  if (!text) return null;
  const match = text.match(/(\d+)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function makeFromTitle(title: string): string | null {
  const makes = ["Porsche", "Ferrari", "Lamborghini", "BMW", "Mercedes", "Audi", "Jaguar", "Aston Martin", "Maserati", "Bentley", "Rolls-Royce", "McLaren"];
  const lower = title.toLowerCase();
  for (const make of makes) {
    if (lower.includes(make.toLowerCase())) return make;
  }
  return null;
}

function modelFromTitle(title: string, make: string | null): string | null {
  if (!make) return null;
  const idx = title.toLowerCase().indexOf(make.toLowerCase());
  if (idx === -1) return null;
  const after = title.slice(idx + make.length).trim();
  if (!after) return null;
  // Take first token as model
  const tokens = after.split(/\s+/).filter(Boolean);
  return tokens[0] || null;
}

async function normalizeFromBaseAndUrl(input: {
  source: SourceKey;
  url: string;
  base: ActiveListingBase | null;
  limiter: PerDomainRateLimiter;
  meta: ScrapeMeta;
  scrapeDetails: boolean;
  make: string;
}): Promise<NormalizedListing | null> {
  const { source, limiter, meta } = input;
  const url = canonicalizeUrl(input.url);
  const runId = meta.runId;

  const listingData = input.base
    ? {
        title: input.base.title,
        price: input.base.price,
        priceText: input.base.priceText,
        status: input.base.status,
        mileage: input.base.mileage,
        mileageUnit: input.base.mileageUnit,
        location: input.base.location,
        description: null,
        images: input.base.images,
        vin: null,
        exteriorColor: null,
        interiorColor: null,
        transmission: null,
        engine: null,
        bodyStyle: null,
        priceIndicator: input.base.priceIndicator,
      }
    : (await fetchListingDataWithRetry(url, limiter)).data;

  const title = (listingData.title ?? input.base?.title ?? "").trim();
  if (!title) return null;
  if (!isLuxuryCarListing({ make: input.base?.make ?? null, title, targetMake: input.make })) return null;

  // Use || instead of ?? so that year=0 falls through to parseYearFromTitle
  const year = (input.base?.year || null) ?? parseYearFromTitle(title);
  if (!year) return null;

  const vehicle = parseModelTrimFromTitle(title, input.make);
  if (!vehicle.model) return null;

  // For AutoTrader (classifieds), status is based on listing presence
  const status = mapAuctionStatus({
    sourceStatus: listingData.status ?? input.base?.status ?? "active",
    rawPriceText: listingData.priceText ?? input.base?.priceText ?? null,
    isActive: true, // AutoTrader listings are active unless explicitly marked otherwise
    priceIndicator: listingData.priceIndicator,
  });

  const priceText = listingData.priceText ?? input.base?.priceText ?? null;
  let originalCurrency = parseCurrencyFromText(priceText);
  
  // Default to GBP for UK AutoTrader
  if (!originalCurrency) {
    originalCurrency = "GBP";
  }

  const askingPrice = listingData.price ?? input.base?.price ?? null;

  const mileageKm = normalizeMileageToKm(
    input.base?.mileage ?? null,
    input.base?.mileageUnit ?? null,
  );

  const locationRaw = listingData.location ?? null;
  const location = parseLocation(locationRaw);

  // For classifieds, listDate is when the listing was first seen
  const listDate = toUtcDateOnly(new Date(meta.scrapeTimestamp));
  const saleDate = status === "sold" ? toUtcDateOnly(new Date(meta.scrapeTimestamp)) : null;

  const hasPrice = askingPrice !== null;
  const dataQualityScore = scoreDataQuality({
    year,
    model: vehicle.model,
    listDate,
    country: location.country,
    photosCount: listingData.images?.length ?? 0,
    hasPrice,
  });

  const normalized: NormalizedListing = {
    source,
    sourceId: deriveSourceId({ source, sourceId: input.base?.externalId ?? null, sourceUrl: url }),
    sourceUrl: url,
    title,
    platform: mapSourceToPlatform(source),
    sellerNotes: listingData.description ?? null,
    endTime: null, // No end time for classifieds
    startTime: new Date(listDate + "T00:00:00Z"), // When listing started
    reserveStatus: null, // No reserve status for classifieds
    finalPrice: status === "sold" ? askingPrice : null,
    locationString: buildLocationString(location),
    year,
    make: input.make,
    model: vehicle.model,
    trim: vehicle.trim,
    bodyStyle: listingData.bodyStyle ?? null,
    engine: listingData.engine ?? null,
    transmission: listingData.transmission ?? null,
    exteriorColor: listingData.exteriorColor ?? null,
    interiorColor: listingData.interiorColor ?? null,
    vin: listingData.vin ?? null,
    mileageKm,
    mileageUnitStored: "km",
    status,
    reserveMet: null,
    listDate,
    saleDate,
    auctionDate: null, // Not applicable for classifieds
    auctionHouse: normalizeSourceAuctionHouse(source),
    descriptionText: listingData.description ?? null,
    photos: listingData.images ?? [],
    photosCount: listingData.images?.length ?? 0,
    location,
    pricing: {
      askingPrice,
      originalCurrency,
      rawPriceText: priceText,
    },
    dataQualityScore,
  };

  logEvent({
    level: "info",
    event: "collector.normalized",
    runId,
    source,
    url,
    sourceId: normalized.sourceId,
    status,
    listDate,
    currency: originalCurrency,
    askingPrice,
    photosCount: normalized.photosCount,
    dataQualityScore,
  });

  return normalized;
}

async function fetchListingDataWithRetry(
  url: string,
  limiter: PerDomainRateLimiter,
): Promise<{ data: ScrapedAutoTraderData; attempts: number }> {
  const domain = getDomainFromUrl(url);
  const shouldRetry = (d: ScrapedAutoTraderData) =>
    d.title === null && d.priceText === null && d.price === null;

  const { value, attempts } = await withRetry(
    async (attempt) => {
      await limiter.waitForDomain(domain);
      return await fetchAutoTraderData(url, attempt > 1);
    },
    { retries: 2, baseDelayMs: 500 },
    shouldRetry,
  );

  return { data: value, attempts };
}

/**
 * Scraped data structure for AutoTrader
 */
interface ScrapedAutoTraderData {
  title: string | null;
  price: number | null;
  priceText: string | null;
  status: string | null;
  mileage: number | null;
  mileageUnit: string | null;
  location: string | null;
  description: string | null;
  images: string[];
  vin: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  transmission: string | null;
  engine: string | null;
  bodyStyle: string | null;
  priceIndicator: string | null;
}

/**
 * Fetch and parse AutoTrader listing data
 */
async function fetchAutoTraderData(url: string, forceRefresh: boolean = false): Promise<ScrapedAutoTraderData> {
  try {
    const detail = await fetchAutoTraderDetail(url, 15000);
    
    return {
      title: detail.title,
      price: detail.price,
      priceText: detail.priceText,
      status: "active",
      mileage: detail.mileage,
      mileageUnit: detail.mileageUnit,
      location: detail.location,
      description: detail.description,
      images: detail.images.slice(0, 20), // Limit to 20 images
      vin: detail.vin,
      exteriorColor: detail.exteriorColor,
      interiorColor: detail.interiorColor,
      transmission: detail.transmission,
      engine: detail.engine,
      bodyStyle: detail.bodyStyle,
      priceIndicator: null,
    };
  } catch (err) {
    return {
      title: null,
      price: null,
      priceText: null,
      status: null,
      mileage: null,
      mileageUnit: null,
      location: null,
      description: null,
      images: [],
      vin: null,
      exteriorColor: null,
      interiorColor: null,
      transmission: null,
      engine: null,
      bodyStyle: null,
      priceIndicator: null,
    };
  }
}

function computeEndedRange(config: CollectorRunConfig, nowIso: string): { dateFrom: string; dateTo: string } {
  const now = new Date(nowIso);
  const dateTo = toUtcDateOnly(now);

  if (config.mode === "backfill") {
    if (!config.dateFrom || !config.dateTo) {
      throw new Error("backfill mode requires --dateFrom and --dateTo (YYYY-MM-DD)");
    }
    return { dateFrom: config.dateFrom, dateTo: config.dateTo };
  }

  const from = new Date(now.getTime() - config.endedWindowDays * 24 * 60 * 60 * 1000);
  const dateFrom = toUtcDateOnly(from);
  return { dateFrom, dateTo };
}

function parseModelTrimFromTitle(title: string, make: string): { model: string; trim: string | null } {
  const idx = title.toLowerCase().indexOf(make.toLowerCase());
  if (idx === -1) return { model: "", trim: null };
  const after = title.slice(idx + make.length).trim();
  if (!after) return { model: make, trim: null };

  // Split model vs trim by common separators (-, |, –, —)
  const parts = after.split(/\s+-\s+|\s+\|\s+|\s+–\s+|\s+—\s+/);
  const modelAndMaybeTrim = parts[0] ?? after;

  const tokens = modelAndMaybeTrim.split(/\s+/).filter(Boolean);

  // First token is the model number/name (e.g. "911", "Cayman", "Boxster")
  // All remaining tokens before separator are trim (e.g. "Carrera", "GTS", "S")
  const model = tokens[0] ?? after;
  const trim = tokens.length > 1 ? tokens.slice(1).join(" ") : null;
  return { model: model || after, trim };
}
