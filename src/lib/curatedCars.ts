// ═══════════════════════════════════════════════════════════════════════════
// MONZA LAB: CURATED COLLECTOR CARS
// 1000 Investment-Grade Vehicles with Verified Data
// ═══════════════════════════════════════════════════════════════════════════

export type AuctionStatus = "ACTIVE" | "ENDING_SOON" | "ENDED";
export type Platform = "BRING_A_TRAILER" | "RM_SOTHEBYS" | "GOODING" | "BONHAMS" | "CARS_AND_BIDS" | "COLLECTING_CARS" | "AUTO_SCOUT_24" | "AUTO_TRADER" | "BE_FORWARD" | "CLASSIC_COM" | "ELFERSPOT";
export type Region = "US" | "EU" | "UK" | "JP";

// Fair value ranges by region with currency
export interface RegionalPricing {
  currency: "$" | "€" | "£" | "¥";
  low: number;
  high: number;
}

export interface FairValueByRegion {
  US: RegionalPricing;
  EU: RegionalPricing;
  UK: RegionalPricing;
  JP: RegionalPricing;
}

export interface CollectorCar {
  id: string;
  title: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  price: number;
  trend: string;
  trendValue: number;
  thesis: string;
  image: string;
  images: string[];
  engine: string;
  transmission: string;
  mileage: number;
  mileageUnit: "mi" | "km";
  location: string;
  region: Region;
  fairValueByRegion: FairValueByRegion;
  history: string;
  platform: Platform;
  status: AuctionStatus;
  currentBid: number;
  bidCount: number;
  endTime: Date;
  category: string;
  sourceUrl?: string;
  vin?: string | null;
  exteriorColor?: string | null;
  interiorColor?: string | null;
  description?: string | null;
  sellerNotes?: string | null;
  originalCurrency?: string | null;
  // ── Derived valuation fields (Rule 1–3 of golden standard) ──
  /** Transaction price in USD. Set only when status='sold' AND source is auction. */
  soldPriceUsd?: number | null;
  /** Asking price in USD. Set for active/unsold/delisted classifieds and live bids. */
  askingPriceUsd?: number | null;
  /** Which concept this row represents. */
  valuationBasis?: "sold" | "asking" | "unknown";
  /** Market derived from source, never from raw `region`. */
  canonicalMarket?: "US" | "EU" | "UK" | "JP" | null;
  /** Series id (e.g. "992"). */
  family?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 220 CURATED COLLECTOR CARS
// Using locally-hosted images in /public/cars/ for guaranteed reliability
// ═══════════════════════════════════════════════════════════════════════════


// 0 CURATED COLLECTOR CARS (REMOVED BY USER REQUEST)
export const CURATED_CARS: CollectorCar[] = [];

export function searchCars(query: string): CollectorCar[] {
  const q = query.toLowerCase();
  return CURATED_CARS.filter(car =>
    car.title.toLowerCase().includes(q) ||
    car.make.toLowerCase().includes(q) ||
    car.model.toLowerCase().includes(q) ||
    car.category.toLowerCase().includes(q) ||
    car.engine.toLowerCase().includes(q)
  );
}

export function getLiveAuctions(): CollectorCar[] {
  return CURATED_CARS.filter(car => car.status === "ACTIVE" || car.status === "ENDING_SOON");
}

export function getEndingSoon(): CollectorCar[] {
  return CURATED_CARS.filter(car => car.status === "ENDING_SOON");
}

export function getCarsByMake(make: string): CollectorCar[] {
  return CURATED_CARS.filter(car => car.make === make);
}

export function getCarsByRegion(region: Region | "ALL"): CollectorCar[] {
  if (region === "ALL") return CURATED_CARS;
  return CURATED_CARS.filter(car => car.region === region);
}
