import { unstable_cache, revalidateTag } from "next/cache";
import {
  fetchPaginatedListings,
  fetchLiveListingAggregateCounts,
  fetchValuationCorpusForMake,
  fetchValuationListingsForMake,
  fetchSeriesCounts,
  fetchSeriesCountsByRegion,
  type SeriesCountsByRegion,
} from "./supabaseLiveListings";
import { resolveRequestedMake } from "./makeProfiles";
import type { CollectorCar } from "./curatedCars";
import { getModelPatternsForSeries } from "./brandConfig";
import {
  aggregateRegionalValuationByFamily,
  fetchDashboardRegionalValuationByFamily,
  type RegionalValByFamily,
} from "./dashboardValuationCache";

const DASHBOARD_AUX_QUERY_TIMEOUT_MS = 5_000;
const DASHBOARD_VALUATION_CACHE_QUERY_TIMEOUT_MS = 2_000;
const DASHBOARD_VALUATION_FALLBACK_QUERY_TIMEOUT_MS = 45_000;
const DASHBOARD_VALUATION_IMAGE_POOL_TIMEOUT_MS = 8_000;
const DASHBOARD_FAMILY_REP_TIMEOUT_MS = 8_000;
const DASHBOARD_VALUATION_IMAGE_POOL_LIMIT = 1_000;
const DASHBOARD_LIVE_QUERY_TIMEOUT_MS = 8_000;
const DASHBOARD_REGION_SAMPLE_SIZE = 15;
const DASHBOARD_FALLBACK_PLATFORMS = ["CollectingCars", "CarsAndBids", "Elferspot"] as const;
const DASHBOARD_REGION_ORDER: readonly ("US" | "EU" | "UK" | "JP")[] = ["US", "EU", "UK", "JP"] as const;
export type { RegionalValByFamily };

// ─── Shape expected by DashboardClient ───

export type DashboardAuction = {
  id: string;
  title: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  price: number;
  currentBid: number;
  bidCount: number;
  viewCount: number;
  watchCount: number;
  status: string;
  endTime: string;
  platform: string;
  engine: string | null;
  transmission: string | null;
  exteriorColor: string | null;
  mileage: number | null;
  mileageUnit: string | null;
  location: string | null;
  region?: string | null;
  description: string | null;
  images: string[];
  analysis: {
    bidTargetLow: number | null;
    bidTargetHigh: number | null;
    confidence: string | null;
    appreciationPotential: string | null;
    keyStrengths: string[];
    redFlags: string[];
  } | null;
  priceHistory: { price: number; timestamp: string }[];
  fairValueByRegion?: {
    US: { currency: "$" | "€" | "£" | "¥"; low: number; high: number };
    EU: { currency: "$" | "€" | "£" | "¥"; low: number; high: number };
    UK: { currency: "$" | "€" | "£" | "¥"; low: number; high: number };
    JP: { currency: "$" | "€" | "£" | "¥"; low: number; high: number };
  };
  category?: string;
  originalCurrency?: string | null;
  // Derived valuation fields (golden standard — see docs/porsche/listings-distribution-overview.md).
  soldPriceUsd?: number | null;
  askingPriceUsd?: number | null;
  valuationBasis?: "sold" | "asking" | "unknown";
  canonicalMarket?: "US" | "EU" | "UK" | "JP" | null;
  family?: string | null;
};

export type DashboardRegionTotals = {
  all: number;
  US: number;
  UK: number;
  EU: number;
  JP: number;
};

export type DashboardData = {
  auctions: DashboardAuction[];
  valuationListings: DashboardAuction[];
  /** Pre-aggregated segment stats: family → market → SegmentStats.
   * Computed on the server from the full 40k-row valuation corpus so the
   * client doesn't have to ship or re-aggregate the raw rows. */
  regionalValByFamily: RegionalValByFamily;
  liveNow: number;
  regionTotals: DashboardRegionTotals;
  seriesCounts: Record<string, number>;
  seriesCountsByRegion: SeriesCountsByRegion;
};

let lastSuccessfulDashboardData: DashboardData | null = null;

const DASHBOARD_DISPLAY_LIMIT = 60;
const DASHBOARD_FALLBACK_PAGE_SIZE = 8;

function buildAggregateFallback(liveCount: number) {
  return {
    liveNow: liveCount,
    regionTotalsByPlatform: { all: liveCount, US: 0, UK: 0, EU: 0, JP: 0 },
    regionTotalsByLocation: { all: liveCount, US: 0, UK: 0, EU: 0, JP: 0 },
  };
}

function buildSeriesCountsByRegionFallback(): SeriesCountsByRegion {
  return {
    all: {},
    US: {},
    UK: {},
    EU: {},
    JP: {},
  };
}

async function withSoftTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string,
  fallback: T,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();

  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn(`[dashboardCache] ${label} exceeded ${timeoutMs}ms; using fallback`);
          controller.abort();
          resolve(fallback);
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    console.error(`[dashboardCache] ${label} failed:`, error);
    return fallback;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export function transformCar(car: CollectorCar): DashboardAuction {
  return {
    id: car.id,
    title: car.title,
    year: car.year,
    make: car.make,
    model: car.model,
    trim: car.trim,
    engine: car.engine,
    transmission: car.transmission,
    mileage: car.mileage,
    mileageUnit: car.mileageUnit,
    location: car.location,
    platform: car.platform,
    status: car.status,
    price: car.price,
    currentBid: car.currentBid,
    bidCount: car.bidCount,
    viewCount: 0,
    watchCount: 0,
    endTime: serializeEndTime(car.endTime),
    exteriorColor: null,
    description: null,
    images: car.images.slice(0, 1),
    region: car.region,
    category: car.category,
    originalCurrency: car.originalCurrency ?? null,
    analysis: null,
    priceHistory: [],
    fairValueByRegion: car.fairValueByRegion,
    soldPriceUsd: car.soldPriceUsd ?? null,
    askingPriceUsd: car.askingPriceUsd ?? null,
    valuationBasis: car.valuationBasis ?? "unknown",
    canonicalMarket: car.canonicalMarket ?? null,
    family: car.family ?? null,
  };
}

export function serializeEndTime(endTime: Date | null | undefined): string {
  return endTime instanceof Date ? endTime.toISOString() : "";
}

function sortDashboardCars(a: CollectorCar, b: CollectorCar): number {
  const aTime = a.endTime instanceof Date ? a.endTime.getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.endTime instanceof Date ? b.endTime.getTime() : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return b.id.localeCompare(a.id);
}

function interleaveBuckets<T>(buckets: T[][], limit: number): T[] {
  const interleaved: T[] = [];
  const maxLen = Math.max(0, ...buckets.map((bucket) => bucket.length));

  for (let i = 0; i < maxLen && interleaved.length < limit; i++) {
    for (const bucket of buckets) {
      if (i < bucket.length && interleaved.length < limit) {
        interleaved.push(bucket[i]);
      }
    }
  }

  return interleaved;
}

async function fetchDashboardLiveListings(make: string): Promise<CollectorCar[]> {
  const regionalResults = await Promise.all(
    DASHBOARD_REGION_ORDER.map((region) =>
      fetchPaginatedListings({
        make,
        region,
        pageSize: DASHBOARD_REGION_SAMPLE_SIZE,
        status: "active",
        includeCount: false,
        timeoutMs: DASHBOARD_LIVE_QUERY_TIMEOUT_MS,
      }),
    ),
  );

  const regionalBuckets = regionalResults.map((result) => result.cars.sort(sortDashboardCars));
  const regionalRows = interleaveBuckets(regionalBuckets, DASHBOARD_DISPLAY_LIMIT);
  const regionalDeduped = new Map<string, CollectorCar>();

  for (const car of regionalRows) {
    if (!regionalDeduped.has(car.id)) {
      regionalDeduped.set(car.id, car);
    }
  }

  const balancedRows = Array.from(regionalDeduped.values()).slice(0, DASHBOARD_DISPLAY_LIMIT);
  if (balancedRows.length > 0) {
    if (balancedRows.length >= DASHBOARD_DISPLAY_LIMIT) {
      return balancedRows;
    }

    const fill = await fetchPaginatedListings({
      make,
      pageSize: DASHBOARD_DISPLAY_LIMIT,
      status: "active",
      includeCount: false,
      timeoutMs: DASHBOARD_LIVE_QUERY_TIMEOUT_MS,
    });
    if (fill.transientError) {
      console.warn(
        "[dashboardCache] regional live sample was partial and the fill query failed transiently; using regional sample only",
      );
      return balancedRows;
    }

    const seen = new Set(balancedRows.map((car) => car.id));
    for (const car of fill.cars.sort(sortDashboardCars)) {
      if (seen.has(car.id)) continue;
      balancedRows.push(car);
      seen.add(car.id);
      if (balancedRows.length >= DASHBOARD_DISPLAY_LIMIT) break;
    }

    return balancedRows.slice(0, DASHBOARD_DISPLAY_LIMIT);
  }

  const primary = await fetchPaginatedListings({
    make,
    pageSize: DASHBOARD_DISPLAY_LIMIT,
    status: "active",
    includeCount: false,
    timeoutMs: DASHBOARD_LIVE_QUERY_TIMEOUT_MS,
  });
  if (primary.cars.length > 0) {
    return primary.cars;
  }

  if (primary.transientError) {
    console.warn(
      "[dashboardCache] primary live listings query hit a transient Supabase failure; skipping source-scoped fallback",
    );
    return [];
  }

  console.warn(
    "[dashboardCache] primary live listings query returned no cars; falling back to source-scoped queries",
  );

  const fallbackResults = await Promise.all(
    DASHBOARD_FALLBACK_PLATFORMS.map((platform) =>
      fetchPaginatedListings({
        make,
        pageSize: DASHBOARD_FALLBACK_PAGE_SIZE,
        platform,
        status: "active",
        includeCount: false,
        timeoutMs: DASHBOARD_LIVE_QUERY_TIMEOUT_MS,
      }),
    ),
  );

  const deduped = new Map<string, CollectorCar>();
  const merged = fallbackResults
    .flatMap((result) => result.cars)
    .sort(sortDashboardCars);

  for (const car of merged) {
    if (!deduped.has(car.id)) {
      deduped.set(car.id, car);
    }
  }

  return Array.from(deduped.values()).slice(0, DASHBOARD_DISPLAY_LIMIT);
}

async function fetchMissingFamilyRepresentatives(
  make: string,
  liveCars: CollectorCar[],
  seriesCounts: Record<string, number>,
): Promise<CollectorCar[]> {
  const presentFamilies = new Set(
    liveCars
      .map((car) => car.family)
      .filter((family): family is string => typeof family === "string" && family.length > 0),
  );

  const missingFamilies = Object.entries(seriesCounts)
    .filter(([family, count]) => count > 0 && !presentFamilies.has(family))
    .map(([family]) => family);

  if (missingFamilies.length === 0) return [];

  const results = await Promise.all(
    missingFamilies.map(async (family) => {
      const result = await fetchPaginatedListings({
        make,
        pageSize: 1,
        status: "active",
        includeCount: false,
        series: family,
        modelPatterns: getModelPatternsForSeries(family, make),
        timeoutMs: DASHBOARD_FAMILY_REP_TIMEOUT_MS,
      });
      return result.cars[0] ?? null;
    }),
  );

  return results.filter((car): car is CollectorCar => car !== null);
}

/**
 * Core dashboard data fetch — no caching directive here so it can be
 * imported and called directly in tests without triggering "use cache"
 * constraints.
 */
async function dashboardDataImpl(): Promise<DashboardData> {
  const requestedMake = resolveRequestedMake(null); // Porsche default

  let live: CollectorCar[] = [];
  try {
    live = await fetchDashboardLiveListings(requestedMake ?? "Porsche");
  } catch (error) {
    console.error("[dashboardCache] live listings query failed:", error);
  }

  const [cachedRegionalValByFamily, aggregates, seriesCounts, seriesCountsByRegion] = await Promise.all([
    withSoftTimeout(
      (signal) =>
        fetchDashboardRegionalValuationByFamily(requestedMake ?? "Porsche", {
          timeoutMs: DASHBOARD_VALUATION_CACHE_QUERY_TIMEOUT_MS + 1_000,
          signal,
        }),
      DASHBOARD_VALUATION_CACHE_QUERY_TIMEOUT_MS,
      "valuation cache query",
      null,
    ),
    withSoftTimeout(
      (signal) =>
        fetchLiveListingAggregateCounts({
          make: requestedMake,
          timeoutMs: DASHBOARD_AUX_QUERY_TIMEOUT_MS + 1_000,
          signal,
        }),
      DASHBOARD_AUX_QUERY_TIMEOUT_MS,
      "aggregate counts query",
      buildAggregateFallback(live.length),
    ),
    withSoftTimeout(
      (signal) =>
        fetchSeriesCounts(requestedMake ?? "Porsche", {
          timeoutMs: DASHBOARD_AUX_QUERY_TIMEOUT_MS + 1_000,
          signal,
        }),
      DASHBOARD_AUX_QUERY_TIMEOUT_MS,
      "series counts query",
      {},
    ),
    withSoftTimeout(
      (signal) =>
        fetchSeriesCountsByRegion(requestedMake ?? "Porsche", {
          timeoutMs: DASHBOARD_AUX_QUERY_TIMEOUT_MS + 1_000,
          signal,
        }),
      DASHBOARD_AUX_QUERY_TIMEOUT_MS,
      "series counts by region query",
      buildSeriesCountsByRegionFallback(),
    ),
  ]);

  const valuationListings = await withSoftTimeout(
    (signal) =>
      fetchValuationListingsForMake(requestedMake ?? "Porsche", DASHBOARD_VALUATION_IMAGE_POOL_LIMIT),
    DASHBOARD_VALUATION_IMAGE_POOL_TIMEOUT_MS,
    "valuation listings query",
    [],
  );

  // Only active listings for dashboard
  const active = live.filter(
    (car) => car.status === "ACTIVE" || car.status === "ENDING_SOON",
  ).slice(0, DASHBOARD_DISPLAY_LIMIT);

  const familyRepresentatives = await withSoftTimeout(
    () => fetchMissingFamilyRepresentatives(requestedMake ?? "Porsche", active, seriesCounts),
    DASHBOARD_FAMILY_REP_TIMEOUT_MS,
    "family representative query",
    [],
  );

  const valuationListingMap = new Map<string, CollectorCar>();
  for (const car of [...familyRepresentatives, ...valuationListings]) {
    if (!valuationListingMap.has(car.id)) {
      valuationListingMap.set(car.id, car);
    }
  }
  const representativeListings = Array.from(valuationListingMap.values());

  let regionalValByFamily = cachedRegionalValByFamily ?? {};

  if (Object.keys(regionalValByFamily).length === 0) {
    if (cachedRegionalValByFamily == null) {
      console.warn(
        "[dashboardCache] valuation cache unavailable; falling back to raw corpus scan",
      );
    } else {
      console.warn(
        "[dashboardCache] valuation cache returned no rows; falling back to raw corpus scan",
      );
    }

    const valuationCorpus = await withSoftTimeout(
      (signal) =>
        fetchValuationCorpusForMake(requestedMake ?? "Porsche", 40_000, {
          timeoutMs: DASHBOARD_VALUATION_FALLBACK_QUERY_TIMEOUT_MS + 1_000,
          signal,
        }),
      DASHBOARD_VALUATION_FALLBACK_QUERY_TIMEOUT_MS,
      "valuation corpus fallback query",
      [],
    );

    regionalValByFamily = aggregateRegionalValuationByFamily(valuationCorpus);
  }

  const result: DashboardData = {
    auctions: active.map(transformCar),
    valuationListings: representativeListings.map(transformCar),
    regionalValByFamily,
    liveNow: aggregates.liveNow,
    regionTotals: {
      all: aggregates.regionTotalsByLocation.all,
      US: aggregates.regionTotalsByLocation.US,
      UK: aggregates.regionTotalsByLocation.UK,
      EU: aggregates.regionTotalsByLocation.EU,
      JP: aggregates.regionTotalsByLocation.JP,
    },
    seriesCounts,
    seriesCountsByRegion,
  };

  const hasValuationData = Object.keys(regionalValByFamily).length > 0;

  if (result.auctions.length > 0 && hasValuationData) {
    lastSuccessfulDashboardData = result;
    return result;
  }

  if (lastSuccessfulDashboardData) {
    console.warn(
      "[dashboardCache] empty live snapshot detected; serving last successful dashboard data",
    );
    return lastSuccessfulDashboardData;
  }

  if (result.auctions.length > 0) {
    console.warn(
      "[dashboardCache] returning partial dashboard snapshot because valuation data is not yet available",
    );
    lastSuccessfulDashboardData = result;
    return result;
  }

  if (result.liveNow > 0) {
    console.warn(
      "[dashboardCache] returning empty live snapshot because live listings did not load in time",
    );
    return result;
  }

  return result;
}

/**
 * Cached dashboard data.
 *
 * NOTE: "use cache" directive requires `cacheComponents: true` in next.config,
 * which in turn enables PPR and is incompatible with `export const dynamic =
 * "force-dynamic"` used by all cron/API routes in this project.  Until those
 * routes are migrated, we fall back to `unstable_cache` with an explicit
 * "listings" tag so cron routes can still call `revalidateTag("listings")` to
 * bust the cache on demand.  The semantics are identical at runtime.
 */
const _cachedDashboardData = unstable_cache(
  dashboardDataImpl,
  ["dashboard-data-v2"],
  {
    revalidate: 300, // 5-minute background revalidation
    tags: ["listings"], // enables revalidateTag("listings") from cron routes
  },
);

function isNextCachePayloadTooLargeError(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /items over 2MB can not be cached/i.test(message);
}

export async function getCachedDashboardData(): Promise<DashboardData> {
  try {
    const data = await _cachedDashboardData();

    if (data.auctions.length === 0 && lastSuccessfulDashboardData) {
      console.warn(
        "[dashboardCache] cached empty live snapshot detected; serving last successful dashboard data",
      );
      return lastSuccessfulDashboardData;
    }

    if (data.auctions.length === 0 && data.liveNow > 0) {
      throw new Error(
        "[dashboardCache] cached empty live snapshot detected with non-zero liveNow",
      );
    }

    return data;
  } catch (err) {
    if (isNextCachePayloadTooLargeError(err)) {
      console.warn(
        "[dashboardCache] cached dashboard payload exceeded Next.js limit; returning uncached data",
      );
      return dashboardDataImpl();
    }
    throw err;
  }
}

/**
 * Call this from any cron/API route after writing new listings to Supabase to
 * immediately invalidate the dashboard cache so the next request gets fresh
 * data (rather than waiting up to 5 minutes).
 */
export function invalidateDashboardCache(): void {
  try {
    revalidateTag("listings", "default");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("static generation store missing") ||
      message.includes("revalidateTag")
    ) {
      console.warn("[dashboardCache] Skipping cache invalidation outside Next runtime");
      return;
    }
    throw error;
  }
}

// Alias for tests — calls the uncached impl directly.
export { dashboardDataImpl as fetchDashboardDataUncached };
