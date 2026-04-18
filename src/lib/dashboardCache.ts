import { unstable_cache } from "next/cache";
import {
  fetchLiveListingsAsCollectorCars,
  fetchLiveListingAggregateCounts,
  fetchSeriesCounts,
} from "./supabaseLiveListings";
import { resolveRequestedMake } from "./makeProfiles";
import type { CollectorCar } from "./curatedCars";

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
  liveNow: number;
  regionTotals: DashboardRegionTotals;
  seriesCounts: Record<string, number>;
};

// ─── PER_SOURCE_BUDGET for dashboard path (matches API route) ───
const DASHBOARD_SOURCE_BUDGET = 200;

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
  };
}

export function serializeEndTime(endTime: Date | null | undefined): string {
  return endTime instanceof Date ? endTime.toISOString() : "";
}

async function fetchDashboardDataUncached(): Promise<DashboardData> {
  const requestedMake = resolveRequestedMake(null); // Porsche default

  const [live, aggregates, seriesCounts] = await Promise.all([
    fetchLiveListingsAsCollectorCars({
      limit: DASHBOARD_SOURCE_BUDGET,
      includePriceHistory: false,
      make: requestedMake,
      includeAllSources: true,
    }),
    fetchLiveListingAggregateCounts({ make: requestedMake }),
    fetchSeriesCounts(requestedMake ?? "Porsche"),
  ]);

  // Only active listings for dashboard
  const active = live.filter(
    (car) => car.status === "ACTIVE" || car.status === "ENDING_SOON"
  );

  return {
    auctions: active.map(transformCar),
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
 * Cached dashboard data. Revalidates every 5 minutes.
 * On Vercel, this uses the Data Cache — subsequent calls within the TTL
 * return instantly without hitting Supabase.
 */
export const getCachedDashboardData = unstable_cache(
  fetchDashboardDataUncached,
  ["dashboard-data-v1"],
  { revalidate: 300 } // 5 minutes
);
