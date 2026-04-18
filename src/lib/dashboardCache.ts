import { unstable_cache, revalidateTag } from "next/cache";
import {
  fetchLiveListingsAsCollectorCars,
  fetchLiveListingAggregateCounts,
  fetchValuationCorpusForMake,
  fetchSeriesCounts,
} from "./supabaseLiveListings";
import { resolveRequestedMake } from "./makeProfiles";
import type { CollectorCar } from "./curatedCars";
import type { DerivedPrice, SegmentStats, CanonicalMarket } from "./pricing/types";
import { computeSegmentStats } from "./pricing/segmentStats";

const VALUATION_MARKETS: readonly CanonicalMarket[] = ["US", "EU", "UK", "JP"] as const;

/**
 * Pre-aggregate the full valuation corpus into { family → market → SegmentStats }.
 * This is much smaller than the raw corpus (~22 families × 4 markets × ~400 bytes
 * = a few hundred KB, well under Next.js's 2MB cache limit) and lets the client
 * render tiles directly without shipping 40k rows.
 */
function aggregateValuationByFamily(
  corpus: DerivedPrice[],
): Record<string, Record<CanonicalMarket, SegmentStats>> {
  const families = Array.from(
    new Set(corpus.map((p) => p.family).filter((f): f is string => !!f)),
  );
  const out: Record<string, Record<CanonicalMarket, SegmentStats>> = {};
  for (const fam of families) {
    const perMarket = {} as Record<CanonicalMarket, SegmentStats>;
    for (const m of VALUATION_MARKETS) {
      perMarket[m] = computeSegmentStats(corpus, { market: m, family: fam });
    }
    out[fam] = perMarket;
  }
  return out;
}

export type RegionalValByFamily = Record<string, Record<CanonicalMarket, SegmentStats>>;

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
    investmentGrade: string | null;
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
};

// ─── PER_SOURCE_BUDGET for dashboard path (matches API route) ───
// Keep this intentionally smaller than the API route budget so the cached
// dashboard payload stays under Next.js's 2 MB data cache limit.
const DASHBOARD_SOURCE_BUDGET = 50;

function transformCar(car: CollectorCar): DashboardAuction {
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
    analysis: car.investmentGrade
      ? {
          bidTargetLow: null,
          bidTargetHigh: null,
          confidence: null,
          investmentGrade: car.investmentGrade,
          appreciationPotential: car.trend,
          keyStrengths: [],
          redFlags: [],
        }
      : null,
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

/**
 * Core dashboard data fetch — no caching directive here so it can be
 * imported and called directly in tests without triggering "use cache"
 * constraints.
 */
async function dashboardDataImpl(): Promise<DashboardData> {
  const requestedMake = resolveRequestedMake(null); // Porsche default

  const [live, valuationCorpus, aggregates, seriesCounts] = await Promise.all([
    fetchLiveListingsAsCollectorCars({
      limit: DASHBOARD_SOURCE_BUDGET,
      includePriceHistory: false,
      make: requestedMake,
      includeAllSources: true,
    }),
    fetchValuationCorpusForMake(requestedMake ?? "Porsche"),
    fetchLiveListingAggregateCounts({ make: requestedMake }),
    fetchSeriesCounts(requestedMake ?? "Porsche"),
  ]);

  // Only active listings for dashboard
  const active = live.filter(
    (car) => car.status === "ACTIVE" || car.status === "ENDING_SOON",
  );

  const regionalValByFamily = aggregateValuationByFamily(valuationCorpus);

  return {
    auctions: active.map(transformCar),
    valuationListings: [], // superseded by regionalValByFamily
    regionalValByFamily,
    liveNow: aggregates.liveNow,
    regionTotals: {
      all: aggregates.regionTotalsByPlatform.all,
      US: aggregates.regionTotalsByPlatform.US,
      UK: aggregates.regionTotalsByPlatform.UK,
      EU: aggregates.regionTotalsByPlatform.EU,
      JP: aggregates.regionTotalsByPlatform.JP,
    },
    seriesCounts,
  };
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
  ["dashboard-data-v1"],
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
    return await _cachedDashboardData();
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
  revalidateTag("listings");
}

// Alias for tests — calls the uncached impl directly.
export { dashboardDataImpl as fetchDashboardDataUncached };
