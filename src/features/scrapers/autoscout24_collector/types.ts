export type SourceKey = "AutoScout24";

export type PlatformEnum = "AUTO_SCOUT_24";

export type CollectorMode = "daily" | "backfill";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "CHF";

export type NormalizedListingStatus = "active" | "sold" | "unsold" | "delisted";

export type AS24CountryCode = "D" | "A" | "B" | "E" | "F" | "I" | "L" | "NL";

export interface SearchShard {
  id: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  priceFrom?: number;
  priceTo?: number;
  countries: AS24CountryCode[];
  maxPages: number;
}

export interface CollectorRunConfig {
  mode: CollectorMode;
  make: string;
  shards?: SearchShard[];
  countries: AS24CountryCode[];
  maxPagesPerShard: number;
  maxListings: number;
  headless: boolean;
  navigationDelayMs: number;
  pageTimeoutMs: number;
  scrapeDetails: boolean;
  checkpointPath: string;
  outputPath: string;
  dryRun: boolean;
  timeBudgetMs?: number;
  skipMonitoring?: boolean;
}

export interface ScrapeMeta {
  scrapeTimestamp: string;
  runId: string;
}

export interface AS24ListingSummary {
  id: string;
  url: string;
  title: string;
  price: number | null;
  currency: string | null;
  mileageKm: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  fuelType: string | null;
  transmission: string | null;
  power: string | null;
  location: string | null;
  country: string | null;
  sellerType: string | null;
  images: string[];
  firstRegistration: string | null;
}

export interface AS24DetailParsed {
  title: string;
  price: number | null;
  currency: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  mileageKm: number | null;
  transmission: string | null;
  fuelType: string | null;
  engine: string | null;
  power: string | null;
  bodyStyle: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  vin: string | null;
  location: string | null;
  country: string | null;
  region: string | null;
  sellerType: string | null;
  sellerName: string | null;
  description: string | null;
  images: string[];
  firstRegistration: string | null;
  features: string[];
}

export interface DiscoverResult {
  shardId: string;
  listings: AS24ListingSummary[];
  totalResults: number | null;
  pagesProcessed: number;
}

export interface NormalizedLocation {
  locationRaw: string | null;
  country: string;
  region: string | null;
  city: string | null;
  postalCode: string | null;
}

export interface NormalizedListing {
  source: SourceKey;
  sourceId: string;
  sourceUrl: string;
  title: string;
  platform: PlatformEnum;
  sellerNotes: string | null;
  endTime: Date | null;
  startTime: Date | null;
  reserveStatus: string | null;
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
  listDate: string | null;
  saleDate: string | null;
  auctionDate: string | null;
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
  dataQualityScore: number;
}

export interface CollectorCounts {
  discovered: number;
  detailsFetched: number;
  normalized: number;
  written: number;
  errors: number;
  skippedDuplicate: number;
  akamaiBlocked: number;
}

export interface CollectorResult {
  runId: string;
  shardsCompleted: number;
  shardsTotal: number;
  counts: CollectorCounts;
  errors: string[];
  outputPath: string;
}

/** Result from scrapling search page fetch */
export interface AS24ScraplingSearchResult {
  listings: AS24ListingSummary[];
  totalResults: number | null;
  totalPages: number | null;
}

/** Result from scrapling detail page fetch */
export interface AS24ScraplingDetailResult {
  trim: string | null;
  vin: string | null;
  transmission: string | null;
  bodyStyle: string | null;
  engine: string | null;
  colorExterior: string | null;
  colorInterior: string | null;
  description: string | null;
  images: string[];
  features: string[];
}
