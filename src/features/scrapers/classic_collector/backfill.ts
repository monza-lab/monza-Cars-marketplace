import { createClient } from "@supabase/supabase-js";
import type { Page } from "playwright-core";

import { fetchAndParseDetail, parseClassicDetailContent } from "./detail";
import { NavigationRateLimiter } from "./net";
import { computeSeries } from "@/features/scrapers/common/seriesEnrichment";
import { parseAuctionHouse, parseUSLocation } from "./normalize";
import { fetchClassicDetailWithScrapling } from "./scrapling";
import type { ClassicComRawListing } from "./types";

export interface BackfillResult {
  discovered: number;
  backfilled: number;
  errors: string[];
}

/**
 * Backfill recoverable Classic.com fields for listings scraped with summaryOnly=true.
 * Uses Playwright/Scrapling detail pages and updates the DB in batches.
 * Stops 20s before time budget expires (Playwright cleanup is slower).
 */
export async function backfillMissingImages(opts: {
  page: Page;
  timeBudgetMs: number;
  maxListings?: number;
  batchSize?: number;
  navigationDelayMs?: number;
  pageTimeoutMs?: number;
  runId: string;
}): Promise<BackfillResult> {
  const maxListings = opts.maxListings ?? Number.POSITIVE_INFINITY;
  const batchSize = opts.batchSize ?? 100;
  const navigationDelayMs = opts.navigationDelayMs ?? 3000;
  const pageTimeoutMs = opts.pageTimeoutMs ?? 20_000;
  const safetyMarginMs = 20_000;

  const result: BackfillResult = { discovered: 0, backfilled: 0, errors: [] };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    result.errors.push("Missing Supabase env vars");
    return result;
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const backfillFilter = buildBackfillFilter();
  const selectColumns = "id,source_url,title,year,make,model,current_bid,mileage,engine,transmission,images,photos_count,description_text,seller_notes,vin,location,city,region,country,auction_house,auction_date,body_style,color_exterior,color_interior,end_time,start_time,bid_count,series" as const;

  const useScraplingOnly = process.env.CLASSIC_DISABLE_PLAYWRIGHT_FALLBACK === "1";
  const scraplingParallelism = Math.max(
    1,
    Number(process.env.CLASSIC_SCRAPLING_PARALLELISM ?? 8) || 8,
  );
  const limiter = useScraplingOnly ? null : new NavigationRateLimiter(navigationDelayMs);
  const startMs = Date.now();
  let offset = 0;

  while (result.discovered < maxListings) {
    const remaining = maxListings - result.discovered;
    const batchCap = Number.isFinite(maxListings)
      ? Math.min(batchSize, remaining)
      : batchSize;
    if (batchCap <= 0) break;

    const { data: rows, error: fetchErr } = await client
      .from("listings")
      .select(selectColumns)
      .eq("source", "ClassicCom")
      .or(backfillFilter)
      .order("scrape_timestamp", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + batchCap - 1);

    if (fetchErr || !rows) {
      result.errors.push(fetchErr?.message ?? "No rows returned");
      return result;
    }

    if (rows.length === 0) break;
    result.discovered += rows.length;
    offset += rows.length;

    const scraplingContents = useScraplingOnly
      ? await mapWithConcurrency(rows, scraplingParallelism, (row) =>
          fetchClassicDetailWithScrapling(row.source_url),
        )
      : null;

    for (const [index, row] of rows.entries()) {
      // Time budget check: stop 20s before budget expires
      const elapsed = Date.now() - startMs;
      if (elapsed > opts.timeBudgetMs - safetyMarginMs) {
        return result;
      }

      try {
        let detailRaw: ClassicComRawListing;

        if (useScraplingOnly) {
          const content = scraplingContents?.[index] ?? null;
          if (!content) {
            throw new Error(`Scrapling-only Classic detail fetch failed for ${row.source_url}`);
          }
          detailRaw = parseClassicDetailContent(content, row.source_url).raw;
        } else {
          await limiter!.waitBeforeNavigation();

          const detail = await fetchAndParseDetail({
            page: opts.page,
            url: row.source_url,
            pageTimeoutMs,
            runId: opts.runId,
          });
          detailRaw = detail.raw;
        }

        const images = detailRaw.images;
        const patch = buildBackfillPatch(row, detailRaw, images);
        if (Object.keys(patch).length === 0) continue;

        const updatedAt = new Date().toISOString();
        const { error: updateErr } = await client
          .from("listings")
          .update({
            ...patch,
            updated_at: updatedAt,
            last_verified_at: updatedAt,
          })
          .eq("id", row.id);

        if (updateErr) {
          result.errors.push(`Update failed for ${row.source_url}: ${updateErr.message}`);
        } else {
          result.backfilled++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        // Circuit-break on Cloudflare blocks
        if (/cloudflare/i.test(msg)) {
          result.errors.push(`Circuit-break (Cloudflare): ${msg}`);
          return result;
        }

        result.errors.push(`Backfill failed for ${row.source_url}: ${msg}`);
      }
    }

    console.log(
      `[classic-backfill] batch offset=${offset} size=${rows.length} discovered=${result.discovered} backfilled=${result.backfilled} errors=${result.errors.length}`,
    );

    if (rows.length < batchCap) break;
  }

  return result;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex++;
        if (currentIndex >= items.length) break;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

function buildBackfillFilter(): string {
  return [
    "current_bid.is.null",
    "mileage.is.null",
    "engine.is.null",
    "transmission.is.null",
    "description_text.is.null",
    "seller_notes.is.null",
    "vin.is.null",
    "location.is.null",
    "city.is.null",
    "region.is.null",
    "country.is.null",
    "auction_house.is.null",
    "auction_date.is.null",
    "body_style.is.null",
    "color_exterior.is.null",
    "color_interior.is.null",
    "bid_count.is.null",
    "end_time.is.null",
    "series.is.null",
    "images.is.null",
    "images.eq.{}",
    "photos_count.lt.2",
  ].join(",");
}

function buildBackfillPatch(
  row: {
    current_bid?: number | null;
    mileage?: number | null;
    engine?: string | null;
    transmission?: string | null;
    description_text?: string | null;
    seller_notes?: string | null;
    vin?: string | null;
    location?: string | null;
    city?: string | null;
    region?: string | null;
    country?: string | null;
    auction_house?: string | null;
    auction_date?: string | null;
    body_style?: string | null;
    color_exterior?: string | null;
    color_interior?: string | null;
    end_time?: string | null;
    start_time?: string | null;
    bid_count?: number | null;
    series?: string | null;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    title?: string | null;
    images?: string[] | null;
    photos_count?: number | null;
  },
  raw: {
    price?: number | null;
    hammerPrice?: number | null;
    mileage?: number | null;
    engine?: string | null;
    transmission?: string | null;
    description?: string | null;
    vin?: string | null;
    location?: string | null;
    auctionHouse?: string | null;
    auctionDate?: string | null;
    bodyStyle?: string | null;
    exteriorColor?: string | null;
    interiorColor?: string | null;
    endTime?: string | null;
    startTime?: string | null;
    bidCount?: number | null;
  },
  images: string[],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  const currentBid = raw.price ?? raw.hammerPrice ?? -1;
  if (isMissingNumber(row.current_bid) && typeof currentBid === "number" && Number.isFinite(currentBid)) {
    patch.current_bid = currentBid;
  }

  if (isMissingNumber(row.mileage) && typeof raw.mileage === "number" && Number.isFinite(raw.mileage)) {
    patch.mileage = raw.mileage;
  }

  if (isMissingText(row.engine) && typeof raw.engine === "string" && raw.engine.trim()) patch.engine = raw.engine.trim();
  if (isMissingText(row.transmission) && typeof raw.transmission === "string" && raw.transmission.trim()) patch.transmission = raw.transmission.trim();
  if (isMissingText(row.description_text) && typeof raw.description === "string" && raw.description.trim()) {
    patch.description_text = raw.description.trim();
  }
  if (isMissingText(row.seller_notes) && typeof raw.description === "string" && raw.description.trim()) {
    patch.seller_notes = raw.description.trim();
  }
  if (isMissingText(row.vin) && typeof raw.vin === "string" && raw.vin.trim()) patch.vin = raw.vin.trim();
  if (isMissingText(row.location) && typeof raw.location === "string" && raw.location.trim()) patch.location = raw.location.trim();
  if (isMissingText(row.auction_house) && typeof raw.auctionHouse === "string" && raw.auctionHouse.trim()) {
    patch.auction_house = parseAuctionHouse(raw.auctionHouse);
  }
  if (isMissingText(row.auction_date) && typeof raw.auctionDate === "string" && raw.auctionDate.trim()) patch.auction_date = raw.auctionDate.trim();
  if (isMissingText(row.body_style) && typeof raw.bodyStyle === "string" && raw.bodyStyle.trim()) patch.body_style = raw.bodyStyle.trim();
  if (isMissingText(row.color_exterior) && typeof raw.exteriorColor === "string" && raw.exteriorColor.trim()) patch.color_exterior = raw.exteriorColor.trim();
  if (isMissingText(row.color_interior) && typeof raw.interiorColor === "string" && raw.interiorColor.trim()) patch.color_interior = raw.interiorColor.trim();
  if (isMissingText(row.end_time) && typeof raw.endTime === "string" && raw.endTime.trim()) patch.end_time = raw.endTime.trim();
  if (isMissingText(row.start_time) && typeof raw.startTime === "string" && raw.startTime.trim()) patch.start_time = raw.startTime.trim();
  if (isMissingNumber(row.bid_count) && typeof raw.bidCount === "number" && Number.isFinite(raw.bidCount)) patch.bid_count = raw.bidCount;

  const parsedLocation = typeof raw.location === "string" && raw.location.trim()
    ? parseUSLocation(raw.location)
    : null;
  if (parsedLocation) {
    if (isMissingText(row.country) && parsedLocation.country) patch.country = parsedLocation.country;
    if (isMissingText(row.region) && parsedLocation.region) patch.region = parsedLocation.region;
    if (isMissingText(row.city) && parsedLocation.city) patch.city = parsedLocation.city;
  }

  const computedSeries = computeSeries({
    make: row.make ?? "",
    model: row.model ?? null,
    year: row.year ?? null,
    title: row.title ?? null,
  });
  if (isMissingText(row.series) && computedSeries) patch.series = computedSeries;

  const existingImages = Array.isArray(row.images) ? row.images : [];
  const mergedImages = mergeImages(existingImages, images);
  if (mergedImages.length > existingImages.length) {
    patch.images = mergedImages;
    patch.photos_count = mergedImages.length;
  }

  return patch;
}

function isMissingText(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function isMissingNumber(value: number | null | undefined): boolean {
  return typeof value !== "number" || !Number.isFinite(value);
}

function mergeImages(existingImages: string[], nextImages: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const image of [...existingImages, ...nextImages]) {
    if (!image || seen.has(image)) continue;
    seen.add(image);
    merged.push(image);
  }

  return merged;
}
