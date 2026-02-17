export type CollectorMode = "daily" | "backfill";

export type SourceKey = "BaT" | "CarsAndBids" | "CollectingCars";

export type PlatformEnum = "BRING_A_TRAILER" | "CARS_AND_BIDS" | "COLLECTING_CARS";

export type ReserveStatusEnum = "NO_RESERVE" | "RESERVE_NOT_MET" | "RESERVE_MET";

export type NormalizedListingStatus = "active" | "sold" | "unsold" | "delisted";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "CHF";

export interface CollectorRunConfig {
  mode: CollectorMode;
  make: string; // e.g. "Porsche"
  endedWindowDays: number;
  dateFrom?: string; // YYYY-MM-DD (UTC)
  dateTo?: string; // YYYY-MM-DD (UTC)
  maxActivePagesPerSource: number;
  maxEndedPagesPerSource: number;
  scrapeDetails: boolean;
  checkpointPath: string;
  dryRun: boolean;
}

export interface ScrapeMeta {
  scrapeTimestamp: string; // ISO timestamp
  runId: string;
}

export interface NormalizedLocation {
  locationRaw: string | null;
  country: string; // NOT NULL in schema; use 'Unknown' fallback
  region: string | null;
  city: string | null;
  postalCode: string | null;
}

export interface NormalizedPricingSnapshot {
  originalCurrency: CurrencyCode | null;
  amountOriginal: number | null;
  amountUsd: number | null;
  amountEur: number | null;
  amountGbp: number | null;
}

export interface NormalizedListing {
  source: SourceKey;
  sourceId: string;
  sourceUrl: string;
  title: string;

  // Auction-model aligned fields
  platform: PlatformEnum;
  sellerNotes: string | null;
  endTime: Date | null;
  startTime: Date | null;
  reserveStatus: ReserveStatusEnum | null;
  finalPrice: number | null;
  locationString: string | null;

  year: number;
  make: string;
  model: string;
  trim: string | null;

  bodyStyle: string | null;
  engine: string | null;
  transmission: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  vin: string | null;

  mileageKm: number | null;
  mileageUnitStored: "km";

  status: NormalizedListingStatus;
  reserveMet: boolean | null;

  listDate: string | null; // YYYY-MM-DD
  saleDate: string; // YYYY-MM-DD (required)
  auctionDate: string | null; // YYYY-MM-DD

  auctionHouse: string;

  descriptionText: string | null;
  photos: string[];
  photosCount: number;

  location: NormalizedLocation;
  pricing: {
    hammerPrice: number | null;
    currentBid: number | null;
    bidCount: number | null;
    originalCurrency: CurrencyCode | null;
    rawPriceText: string | null;
  };

  // Derived values
  dataQualityScore: number;
}

export interface SourceScrapeCounts {
  discovered: number;
  porscheKept: number;
  skippedMissingRequired: number;
  written: number;
  errored: number;
  retried: number;
}
