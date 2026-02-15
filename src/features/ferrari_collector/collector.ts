import crypto from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { fetchAuctionData, type ScrapedAuctionData } from "@/lib/scraper";
import { scrapeBringATrailer } from "@/lib/scrapers/bringATrailer";
import { scrapeCarsAndBids } from "@/lib/scrapers/carsAndBids";
import { scrapeCollectingCars } from "@/lib/scrapers/collectingCars";

import { loadCheckpoint, saveCheckpoint, updateSourceCheckpoint } from "./checkpoint";
import { discoverFerrariListingUrls } from "./discover";
import { canonicalizeUrl, deriveSourceId } from "./id";
import { logEvent } from "./logging";
import { getDomainFromUrl, PerDomainRateLimiter, withRetry } from "./net";
import {
  buildLocationString,
  isFerrariListing,
  isLuxuryCarListing,
  mapAuctionStatus,
  mapReserveStatus,
  mapReserveStatusFromString,
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

type ActiveAuctionBase = {
  source: SourceKey;
  url: string;
  externalId: string | null;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  mileageUnit: string | null;
  endTime: Date | null;
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
 * status back to "active" when the BaT scraper mis-detects an ended auction.
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

export async function runFerrariCollector(config: CollectorRunConfig): Promise<CollectorResult> {
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

  const sources: SourceKey[] = ["BaT", "CarsAndBids", "CollectingCars"];
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
    make: overrides.make ?? "Ferrari",
    endedWindowDays: overrides.endedWindowDays ?? 90,
    dateFrom: overrides.dateFrom,
    dateTo: overrides.dateTo,
    maxActivePagesPerSource: overrides.maxActivePagesPerSource ?? 5,
    maxEndedPagesPerSource: overrides.maxEndedPagesPerSource ?? 5,
    scrapeDetails: overrides.scrapeDetails ?? true,
    checkpointPath: overrides.checkpointPath ?? "/tmp/ferrari_collector/checkpoint.json",
    dryRun: overrides.dryRun ?? false,
  };

  return runFerrariCollector(config);
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
    ferrariKept: 0,
    skippedMissingRequired: 0,
    written: 0,
    errored: 0,
    retried: 0,
  };

  const writer = input.writer;

  const endedRange = computeEndedRange(config, meta.scrapeTimestamp);

  // 1) Active listings (daily only)
  if (config.mode === "daily") {
    const active = await scrapeActiveListings(source, config.maxActivePagesPerSource);
    counts.discovered += active.length;

    for (const a of active) {
      const keep = isLuxuryCarListing({ make: a.make, title: a.title, targetMake: config.make });
      if (!keep) continue;
      counts.ferrariKept++;

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

  // 2) Ended listings (daily + backfill)
  const previousPage = input.checkpointRef.value.sources?.[source]?.backfill?.lastProcessedPage ?? 0;
  const discoverStartPage = config.mode === "backfill" ? Math.max(1, previousPage + 1) : 1;
  const urls = await discoverFerrariListingUrls(source, {
    runId,
    limiter,
    maxPages: config.maxEndedPagesPerSource,
    startPage: discoverStartPage,
    timeoutMs: 15000,
    query: config.make.toLowerCase(),
    onPageDone: config.mode === "backfill" ? async (page: number) => {
      input.checkpointRef.value = updateSourceCheckpoint(input.checkpointRef.value, source, "backfill", {
        nowIso: meta.scrapeTimestamp,
        dateFrom: endedRange.dateFrom,
        dateTo: endedRange.dateTo,
        lastProcessedPage: page,
      });
      await saveCheckpoint(input.checkpointPath, input.checkpointRef.value);
    } : undefined,
  });

  counts.discovered += urls.length;

  for (const url of urls) {
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

      const saleDate = normalized.saleDate;
      const withinEndedRange = isWithinRange(saleDate, endedRange.dateFrom, endedRange.dateTo);
      const isActive = normalized.status === "active";

      // Discovery queries can return a mix of active + ended listings.
      // - backfill mode: only write ended listings within the requested date range.
      // - daily mode: only write ACTIVE listings. Ended/sold listings belong in
      //   backfill runs and should not pollute the live feed.
      if (config.mode === "backfill") {
        if (!withinEndedRange) continue;
        if (isActive) continue;
      } else {
        if (!isActive) continue;
      }

      if (!isLuxuryCarListing({ make: config.make, title: normalized.title, targetMake: config.make })) continue;

      // Never revert a listing that was already marked as sold/unsold/delisted
      if (isActive && await hasTerminalStatus(normalized.sourceId)) {
        logEvent({ level: "info", event: "collector.skip_terminal", runId, source, url, sourceId: normalized.sourceId });
        continue;
      }

      counts.ferrariKept++;
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

  return counts;
}

async function scrapeActiveListings(source: SourceKey, maxPages: number): Promise<ActiveAuctionBase[]> {
  if (source === "BaT") {
    const { auctions } = await scrapeBringATrailer({ maxPages, scrapeDetails: false });
    return auctions.map((a: any) => ({
      source,
      url: a.url,
      externalId: a.externalId ?? null,
      title: a.title,
      make: a.make ?? null,
      model: a.model ?? null,
      year: typeof a.year === "number" ? a.year : null,
      mileage: typeof a.mileage === "number" ? a.mileage : null,
      mileageUnit: a.mileageUnit ?? null,
      endTime: a.endTime ? new Date(a.endTime) : null,
    }));
  }
  if (source === "CarsAndBids") {
    const { auctions } = await scrapeCarsAndBids({ maxPages, scrapeDetails: false });
    return auctions.map((a: any) => ({
      source,
      url: a.url,
      externalId: a.externalId ?? null,
      title: a.title,
      make: a.make ?? null,
      model: a.model ?? null,
      year: typeof a.year === "number" ? a.year : null,
      mileage: typeof a.mileage === "number" ? a.mileage : null,
      mileageUnit: a.mileageUnit ?? null,
      endTime: a.endTime ? new Date(a.endTime) : null,
    }));
  }
  const { auctions } = await scrapeCollectingCars({ maxPages, scrapeDetails: false });
  return auctions.map((a: any) => ({
    source,
    url: a.url,
    externalId: a.externalId ?? null,
    title: a.title,
    make: a.make ?? null,
    model: a.model ?? null,
    year: typeof a.year === "number" ? a.year : null,
    mileage: typeof a.mileage === "number" ? a.mileage : null,
    mileageUnit: a.mileageUnit ?? null,
    endTime: a.endTime ? new Date(a.endTime) : null,
  }));
}

async function normalizeFromBaseAndUrl(input: {
  source: SourceKey;
  url: string;
  base: ActiveAuctionBase | null;
  limiter: PerDomainRateLimiter;
  meta: ScrapeMeta;
  scrapeDetails: boolean;
  make: string;
}): Promise<NormalizedListing | null> {
  const { source, limiter, meta } = input;
  const url = canonicalizeUrl(input.url);
  const runId = meta.runId;

  const auctionDataResult = await fetchAuctionDataWithRetry(url, limiter);
  const auctionData = auctionDataResult.data;

  const title = (auctionData.title ?? input.base?.title ?? "").trim();
  if (!title) return null;
  if (!isLuxuryCarListing({ make: input.base?.make ?? null, title, targetMake: input.make })) return null;

  // Use || instead of ?? so that year=0 falls through to parseYearFromTitle
  const year = (input.base?.year || null) ?? parseYearFromTitle(title);
  if (!year) return null;

  const vehicle = parseModelTrimFromTitle(title, input.make);
  if (!vehicle.model) return null;

  const endTime = input.base?.endTime ?? auctionData.endTime ?? null;
  // For active listings, endTime may not be available; use scrape timestamp as fallback
  const saleDateSource = (endTime && !isNaN(endTime.getTime()))
    ? endTime
    : new Date(meta.scrapeTimestamp);
  const saleDate = toUtcDateOnly(saleDateSource);

  const status = mapAuctionStatus({
    sourceStatus: auctionData.status,
    rawPriceText: auctionData.rawPriceText,
    currentBid: auctionData.currentBid,
    endTime,
    now: new Date(meta.scrapeTimestamp),
  });

  const rawPriceText = auctionData.rawPriceText;
  let originalCurrency = parseCurrencyFromText(rawPriceText);

  let currentBid = auctionData.currentBid ?? null;
  let bidCount = auctionData.bidCount ?? null;

  const enriched = input.scrapeDetails
    ? await fetchDetailViaExistingScraper({
        source,
        url,
        title,
        year,
        model: vehicle.model,
        make: input.make,
      })
    : null;

  // Use enriched bid data from detail page when available
  if (enriched?.currentBid != null && enriched.currentBid > 0) {
    currentBid = enriched.currentBid;
    // BaT prices are in USD
    if (!originalCurrency && source === "BaT") {
      originalCurrency = "USD";
    }
  }
  if (enriched?.bidCount != null && enriched.bidCount > 0) {
    bidCount = enriched.bidCount;
  }

  const hammerPrice = status === "sold" ? currentBid : null;

  const mileageKm = normalizeMileageToKm(
    enriched?.mileage ?? input.base?.mileage ?? null,
    enriched?.mileageUnit ?? input.base?.mileageUnit ?? null,
  );

  const locationRaw = enriched?.location ?? null;
  const location = parseLocation(locationRaw);

  const photos = ((enriched?.images ?? []) as unknown[]).filter(
    (p: unknown) => typeof p === "string" && p.length > 0,
  ) as string[];
  const photosCount = photos.length;
  const descriptionText = enriched?.description ?? null;
  const vin = enriched?.vin ?? null;

  const listDate = status === "active" ? toUtcDateOnly(new Date(meta.scrapeTimestamp)) : null;

  const hasPrice = (status === "active" ? currentBid : (hammerPrice ?? currentBid)) !== null;
  const dataQualityScore = scoreDataQuality({
    year,
    model: vehicle.model,
    saleDate,
    country: location.country,
    photosCount,
    hasPrice,
  });

  const sellerNotes = enriched?.sellerNotes ?? null;

  const endTimeDate = endTime && !isNaN(endTime.getTime()) ? endTime : null;
  const startTimeDate = listDate ? new Date(listDate + "T00:00:00Z") : null;
  const validStartTime = startTimeDate && !isNaN(startTimeDate.getTime()) ? startTimeDate : null;

  const normalized: NormalizedListing = {
    source,
    sourceId: deriveSourceId({ source, sourceId: input.base?.externalId ?? null, sourceUrl: url }),
    sourceUrl: url,
    title,
    platform: mapSourceToPlatform(source),
    sellerNotes,
    endTime: endTimeDate,
    startTime: validStartTime,
    reserveStatus: mapReserveStatusFromString(enriched?.reserveStatus ?? null) ?? mapReserveStatus(null),
    finalPrice: hammerPrice,
    locationString: buildLocationString(location),
    year,
    make: input.make,
    model: vehicle.model,
    trim: vehicle.trim,
    bodyStyle: enriched?.bodyStyle ?? null,
    engine: enriched?.engine ?? null,
    transmission: enriched?.transmission ?? null,
    exteriorColor: enriched?.exteriorColor ?? null,
    interiorColor: enriched?.interiorColor ?? null,
    vin,
    mileageKm,
    mileageUnitStored: "km",
    status,
    reserveMet: null,
    listDate,
    saleDate,
    auctionDate: saleDate,
    auctionHouse: normalizeSourceAuctionHouse(source),
    descriptionText,
    photos,
    photosCount,
    location,
    pricing: {
      hammerPrice,
      currentBid,
      bidCount,
      originalCurrency,
      rawPriceText: rawPriceText ?? null,
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
    saleDate,
    currency: originalCurrency,
    currentBid,
    bidCount,
    photosCount,
    dataQualityScore,
  });

  return normalized;
}

async function fetchAuctionDataWithRetry(
  url: string,
  limiter: PerDomainRateLimiter,
): Promise<{ data: ScrapedAuctionData; attempts: number }> {
  const domain = getDomainFromUrl(url);
  const shouldRetry = (d: ScrapedAuctionData) =>
    d.status === null && d.title === null && d.rawPriceText === null && d.currentBid === null && d.bidCount === null;

  const { value, attempts } = await withRetry(
    async (attempt) => {
      await limiter.waitForDomain(domain);
      return await fetchAuctionData(url, attempt > 1);
    },
    { retries: 2, baseDelayMs: 500 },
    shouldRetry,
  );

  return { data: value, attempts };
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

function isWithinRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
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

  // First token is the model number/name (e.g. "488", "Testarossa", "SF90")
  // All remaining tokens before separator are trim (e.g. "GTB", "Spider", "Stradale")
  const model = tokens[0] ?? after;
  const trim = tokens.length > 1 ? tokens.slice(1).join(" ") : null;
  return { model: model || after, trim };
}

async function fetchDetailViaExistingScraper(input: {
  source: SourceKey;
  url: string;
  title: string;
  year: number;
  model: string;
  make: string;
}): Promise<any | null> {
  // We only need fields these scrapers already attempt to parse.
  // They are @ts-nocheck, so we can supply a minimal shape.
  if (input.source === "BaT") {
    const mod = await import("@/lib/scrapers/bringATrailer");
    return await mod.scrapeDetail({
      externalId: `bat-${shaFromUrl(input.url)}`,
      platform: "BRING_A_TRAILER",
      title: input.title,
      make: input.make,
      model: input.model,
      year: input.year,
      mileage: null,
      mileageUnit: "miles",
      transmission: null,
      engine: null,
      exteriorColor: null,
      interiorColor: null,
      location: null,
      currentBid: null,
      bidCount: 0,
      endTime: null,
      url: input.url,
      imageUrl: null,
      description: null,
      sellerNotes: null,
      status: "unknown",
      vin: null,
      images: [],
      reserveStatus: null,
      bodyStyle: null,
    });
  }

  if (input.source === "CarsAndBids") {
    const mod = await import("@/lib/scrapers/carsAndBids");
    return await mod.scrapeDetail({
      externalId: `cab-${shaFromUrl(input.url)}`,
      platform: "CARS_AND_BIDS",
      title: input.title,
      make: input.make,
      model: input.model,
      year: input.year,
      mileage: null,
      mileageUnit: "miles",
      transmission: null,
      engine: null,
      exteriorColor: null,
      interiorColor: null,
      location: null,
      currentBid: null,
      bidCount: 0,
      endTime: null,
      url: input.url,
      imageUrl: null,
      description: null,
      sellerNotes: null,
      status: "unknown",
      vin: null,
      images: [],
    });
  }

  const mod = await import("@/lib/scrapers/collectingCars");
  return await mod.scrapeDetail({
    externalId: `cc-${shaFromUrl(input.url)}`,
    platform: "COLLECTING_CARS",
    title: input.title,
    make: input.make,
    model: input.model,
    year: input.year,
    mileage: null,
    mileageUnit: "km",
    transmission: null,
    engine: null,
    exteriorColor: null,
    interiorColor: null,
    location: null,
    currentBid: null,
    bidCount: 0,
    endTime: null,
    url: input.url,
    imageUrl: null,
    description: null,
    sellerNotes: null,
    status: "unknown",
    vin: null,
    images: [],
  });
}

function shaFromUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 12);
}
