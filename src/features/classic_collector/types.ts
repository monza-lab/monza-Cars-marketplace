export type SourceKey = "ClassicCom";

export type PlatformEnum = "CLASSIC_COM";

export type CollectorMode = "daily";

export type CurrencyCode = "USD";

export type NormalizedListingStatus = "active" | "sold" | "unsold" | "delisted";

export interface CollectorRunConfig {
  mode: CollectorMode;
  make: string;
  location: string;
  status: string;
  maxPages: number;
  maxListings: number;
  headless: boolean;
  proxyServer?: string;
  proxyUsername?: string;
  proxyPassword?: string;
  navigationDelayMs: number;
  pageTimeoutMs: number;
  checkpointPath: string;
  outputPath: string;
  dryRun: boolean;
}

export interface ScrapeMeta {
  scrapeTimestamp: string;
  runId: string;
}

export interface ClassicComRawListing {
  id: string;
  title: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  vin: string | null;
  mileage: number | null;
  mileageUnit: string | null;
  price: number | null;
  currency: string | null;
  status: string | null;
  auctionHouse: string | null;
  auctionDate: string | null;
  location: string | null;
  images: string[];
  url: string;
  description: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  engine: string | null;
  transmission: string | null;
  bodyStyle: string | null;
  bidCount: number | null;
  reserveStatus: string | null;
  saleResult: string | null;
  hammerPrice: number | null;
  endTime: string | null;
  startTime: string | null;
}

export interface ListingSummary {
  sourceUrl: string;
  classicComId: string | null;
  title: string;
  year: number | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  price: number | null;
  auctionHouse: string | null;
  status: string | null;
  thumbnailUrl: string | null;
}

export interface DiscoverPageResult {
  totalResults: number | null;
  listings: ListingSummary[];
  hasNextPage: boolean;
}

export interface DetailParsed {
  raw: ClassicComRawListing;
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
  cloudflareBlocked: number;
}

export interface CollectorResult {
  runId: string;
  totalResults: number | null;
  counts: CollectorCounts;
  errors: string[];
  outputPath: string;
}
