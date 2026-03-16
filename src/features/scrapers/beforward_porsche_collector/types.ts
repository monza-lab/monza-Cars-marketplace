export type CollectorMode = "daily";

export type SourceKey = "BeForward";

export interface CollectorRunConfig {
  mode: CollectorMode;
  make: string;
  maxPages: number;
  startPage: number;
  maxDetails: number;
  summaryOnly: boolean;
  concurrency: number;
  rateLimitMs: number;
  timeoutMs: number;
  checkpointPath: string;
  outputPath: string;
  dryRun: boolean;
}

export interface ScrapeMeta {
  scrapeTimestamp: string;
  runId: string;
}

export interface ListingSummary {
  page: number;
  sourceUrl: string;
  refNo: string | null;
  title: string;
  priceUsd: number | null;
  totalPriceUsd: number | null;
  mileageKm: number | null;
  year: number | null;
  location: string | null;
}

export interface DiscoverPageResult {
  totalResults: number | null;
  pageCount: number;
  listings: ListingSummary[];
}

export interface DetailParsed {
  title: string;
  refNo: string | null;
  sourceStatus: string | null;
  schemaAvailability: string | null;
  schemaPriceUsd: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  mileageKm: number | null;
  transmission: string | null;
  engine: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  vin: string | null;
  location: string | null;
  fuel: string | null;
  drive: string | null;
  doors: number | null;
  seats: number | null;
  modelCode: string | null;
  chassisNo: string | null;
  engineCode: string | null;
  subRefNo: string | null;
  features: string[];
  sellingPoints: string[];
  images: string[];
}

export type NormalizedListingStatus = "active" | "sold" | "unsold" | "delisted";

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
  platform: string;
  sellerNotes: string | null;
  endTime: Date | null;
  startTime: Date | null;
  reserveStatus: null;
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
  reserveMet: null;
  listDate: string | null;
  saleDate: string;
  auctionDate: string | null;
  auctionHouse: string;
  descriptionText: string | null;
  photos: string[];
  photosCount: number;
  location: NormalizedLocation;
  pricing: {
    hammerPrice: number | null;
    currentBid: number | null;
    bidCount: null;
    originalCurrency: "USD" | null;
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
}

export interface CollectorResult {
  runId: string;
  totalResults: number | null;
  pageCount: number;
  processedPages: number;
  counts: CollectorCounts;
  errors: string[];
  outputPath: string;
}
