import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  CollectorCar,
  Platform,
  AuctionStatus,
  Region,
  FairValueByRegion,
} from "./curatedCars";
import {
  isSupportedLiveMake,
  normalizeSupportedMake,
  resolveRequestedMake,
  type SupportedLiveMake,
} from "./makeProfiles";
import { buildRegionalFairValue } from "./regionPricing";
import { extractSeries, getSeriesConfig } from "./brandConfig";
import { getExchangeRates, toUsd } from "./exchangeRates";

// ─── Row types ───

type ListingRow = {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  source: string;
  source_url: string;
  status: string;
  sale_date: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  hammer_price: string | number | null;
  original_currency: string | null;
  listing_price: string | number | null;
  // Enriched fields from detail scraping
  mileage: number | null;
  mileage_unit: string | null;
  vin: string | null;
  color_exterior: string | null;
  color_interior: string | null;
  description_text: string | null;
  body_style: string | null;
  // New Auction-model aligned columns (direct on listings)
  title: string | null;
  platform: string | null;
  current_bid: number | null;
  bid_count: number | null;
  reserve_status: string | null;
  seller_notes: string | null;
  images: string[] | null;
  engine: string | null;
  transmission: string | null;
  end_time: string | null;
  start_time: string | null;
  final_price: number | null;
  location: string | null;
  // Joined table (photos_media is 1:many, returns array — fallback for legacy rows without images column)
  photos_media?: Array<{ photo_url: string | null }>;
};

type PriceHistoryRow = {
  listing_id: string;
  price_usd: number | null;
  price_eur: number | null;
  price_gbp: number | null;
  time: string;
};

const SUPABASE_TIMEOUT_MS = 30_000;

function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);

        return fetch(input, {
          ...init,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));
      },
    },
  });
}

// ─── Broad select (with photos_media join for legacy rows) ───
const SELECT_BROAD =
  "id,year,make,model,trim,source,source_url,status,sale_date,country,region,city,hammer_price,original_currency,listing_price,mileage,mileage_unit,vin,color_exterior,color_interior,description_text,body_style,title,platform,current_bid,bid_count,reserve_status,seller_notes,images,engine,transmission,end_time,start_time,final_price,location,photos_media(photo_url)";

// ─── Narrow select (without joins — fallback if photos_media join fails) ───
const SELECT_NARROW =
  "id,year,make,model,trim,source,source_url,status,sale_date,country,region,city,hammer_price,original_currency,listing_price,mileage,mileage_unit,vin,color_exterior,color_interior,description_text,body_style,title,platform,current_bid,bid_count,reserve_status,seller_notes,images,engine,transmission,end_time,start_time,final_price,location";

// ─── Mappers ───

const SOURCE_ALIASES = {
  BaT: ["BaT", "BAT", "bat", "BringATrailer", "BRING_A_TRAILER", "bringatrailer"],
  AutoScout24: ["AutoScout24", "AUTOSCOUT24", "autoscout24", "AUTO_SCOUT_24", "AutoScout"],
  AutoTrader: ["AutoTrader", "AUTOTRADER", "auto_trader", "AUTO_TRADER"],
  BeForward: ["BeForward", "BEFORWARD", "be_forward", "BE_FORWARD"],
  CarsAndBids: ["CarsAndBids", "CARS_AND_BIDS", "carsandbids"],
  CollectingCars: ["CollectingCars", "COLLECTING_CARS", "collectingcars"],
  ClassicCom: ["ClassicCom", "CLASSICCOM", "classiccom", "CLASSIC_COM", "classic.com"],
  Elferspot: ["Elferspot", "ELFERSPOT", "elferspot"],
} as const;

const PLATFORM_ALIASES = {
  BaT: ["BRING_A_TRAILER", "BRINGATRAILER", "BAT"],
  AutoScout24: ["AUTO_SCOUT_24", "AUTOSCOUT24", "AUTOSCOUT"],
  AutoTrader: ["AUTO_TRADER", "AUTOTRADER"],
  BeForward: ["BE_FORWARD", "BEFORWARD"],
  ClassicCom: ["CLASSIC_COM", "CLASSICCOM"],
  Elferspot: ["ELFERSPOT"],
} as const;

const LIVE_STATUS_ALIASES = [
  "active",
  "ACTIVE",
  "live",
  "LIVE",
  "ending_soon",
  "ENDING_SOON",
] as const;

export const LIVE_DB_STATUS_VALUES = ["active"] as const;

type CanonicalSource = "BaT" | "AutoScout24" | "AutoTrader" | "BeForward" | "CarsAndBids" | "CollectingCars" | "ClassicCom" | "Elferspot";

const ALLOWED_IMAGE_HOSTS = [
  "bringatrailer.com",
  "wp.com",
  "carsandbids.com",
  "collectingcars.com",
  "media.carsandbids.com",
  "images.unsplash.com",
  "source.unsplash.com",
  "upload.wikimedia.org",
  "wikimedia.org",
  "commons.wikimedia.org",
  "picsum.photos",
  "fastly.picsum.photos",
  "rmsothebys.com",
  "autoscout24.net",
  "autoscout24.com",
  "autoscout24.de",
  "autoscout24.ch",
  "autoscout24.it",
  "autoscout24.fr",
  "autoscout24.nl",
  "autoscout24.es",
  "autoscout24.at",
  "autoscout24.be",
  "image-cdn.beforward.jp",
  "m.atcdn.co.uk",
  "images.classic.com",
  "elferspot.com",
] as const;

function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_IMAGE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function isAutoTraderCdnHost(hostname: string): boolean {
  return hostname.toLowerCase().endsWith("atcdn.co.uk");
}

function decodeForTokenScan(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeAutoTraderResizePathname(pathname: string): string {
  return pathname
    .replace(/\/(?:\{resize\}|%7Bresize%7D)(?=\/|$)/gi, "")
    .replace(/\/+/g, "/");
}

export function normalizeListingImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  let candidate = trimmed;
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  else if (candidate.startsWith("http://")) candidate = `https://${candidate.slice("http://".length)}`;
  else if (!candidate.startsWith("https://")) candidate = `https://${candidate}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (!isAllowedImageHost(parsed.hostname)) return null;

  const decodedBeforeNormalization = decodeForTokenScan(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  if (decodedBeforeNormalization.includes("{") || decodedBeforeNormalization.includes("}")) {
    if (!isAutoTraderCdnHost(parsed.hostname)) return null;

    const tokens = decodedBeforeNormalization.match(/\{[^}]*\}/g) ?? [];
    if (tokens.length === 0 || tokens.some((token) => token.toLowerCase() !== "{resize}")) {
      return null;
    }

    parsed.pathname = normalizeAutoTraderResizePathname(parsed.pathname);

    const decodedAfterNormalization = decodeForTokenScan(`${parsed.pathname}${parsed.search}${parsed.hash}`);
    if (decodedAfterNormalization.includes("{") || decodedAfterNormalization.includes("}")) {
      return null;
    }
  }

  return parsed.toString();
}

export const LISTING_IMAGE_PLACEHOLDER = "/cars/placeholder.svg";

export function resolveListingImages(images: readonly unknown[] | null | undefined): string[] {
  const normalized = (images ?? [])
    .map(normalizeListingImageUrl)
    .filter((url): url is string => url !== null);

  return normalized.length > 0 ? normalized : [LISTING_IMAGE_PLACEHOLDER];
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function resolveCanonicalSource(source: string | null | undefined, platform: string | null | undefined): CanonicalSource | null {
  const normalizedSource = normalizeToken(source);
  const normalizedPlatform = normalizeToken(platform);

  if (SOURCE_ALIASES.BaT.some((candidate) => normalizeToken(candidate) === normalizedSource)) return "BaT";
  if (SOURCE_ALIASES.AutoScout24.some((candidate) => normalizeToken(candidate) === normalizedSource)) return "AutoScout24";
  if (SOURCE_ALIASES.AutoTrader.some((candidate) => normalizeToken(candidate) === normalizedSource)) return "AutoTrader";
  if (SOURCE_ALIASES.BeForward.some((candidate) => normalizeToken(candidate) === normalizedSource)) return "BeForward";
  if (SOURCE_ALIASES.CarsAndBids.some((candidate) => normalizeToken(candidate) === normalizedSource)) return "CarsAndBids";
  if (SOURCE_ALIASES.CollectingCars.some((candidate) => normalizeToken(candidate) === normalizedSource)) return "CollectingCars";
  if (SOURCE_ALIASES.ClassicCom.some((candidate) => normalizeToken(candidate) === normalizedSource)) return "ClassicCom";
  if (SOURCE_ALIASES.Elferspot.some((candidate) => normalizeToken(candidate) === normalizedSource)) return "Elferspot";

  if (PLATFORM_ALIASES.BaT.some((candidate) => normalizeToken(candidate) === normalizedPlatform)) return "BaT";
  if (PLATFORM_ALIASES.AutoScout24.some((candidate) => normalizeToken(candidate) === normalizedPlatform)) return "AutoScout24";
  if (PLATFORM_ALIASES.AutoTrader.some((candidate) => normalizeToken(candidate) === normalizedPlatform)) return "AutoTrader";
  if (PLATFORM_ALIASES.BeForward.some((candidate) => normalizeToken(candidate) === normalizedPlatform)) return "BeForward";
  if (PLATFORM_ALIASES.ClassicCom.some((candidate) => normalizeToken(candidate) === normalizedPlatform)) return "ClassicCom";
  if (PLATFORM_ALIASES.Elferspot.some((candidate) => normalizeToken(candidate) === normalizedPlatform)) return "Elferspot";

  return null;
}

function mapPlatform(source: string, platform: string | null): Platform {
  const canonical = resolveCanonicalSource(source, platform);

  switch (canonical) {
    case "BaT":
      return "BRING_A_TRAILER";
    case "CarsAndBids":
      return "CARS_AND_BIDS";
    case "CollectingCars":
      return "COLLECTING_CARS";
    case "AutoScout24":
      return "AUTO_SCOUT_24";
    case "AutoTrader":
      return "AUTO_TRADER";
    case "BeForward":
      return "BE_FORWARD";
    case "ClassicCom":
      return "CLASSIC_COM";
    case "Elferspot":
      return "ELFERSPOT";
    default:
      return "BRING_A_TRAILER";
  }
}

export function isLiveListingStatus(status: string | null | undefined): boolean {
  const normalized = normalizeToken(status);
  return LIVE_STATUS_ALIASES.some((candidate) => normalizeToken(candidate) === normalized);
}

function mapStatus(status: string): AuctionStatus {
  switch ((status ?? "").toLowerCase().trim()) {
    case "active":
    case "live":
      return "ACTIVE";
    case "ending_soon":
      return "ENDING_SOON";
    case "sold":
    case "unsold":
    case "delisted":
    case "ended":
      return "ENDED";
    default:
      return "ENDED";
  }
}

function mapRegion(country: string | null, source?: string | null): Region {
  // 1. Try country first
  if (country) {
    const c = country.toUpperCase();
    if (c === "USA" || c === "US" || c === "UNITED STATES") return "US";
    if (c === "UK" || c === "UNITED KINGDOM") return "UK";
    if (c === "JAPAN" || c === "JP") return "JP";
    if (c === "GERMANY" || c === "FRANCE" || c === "ITALY" || c === "SPAIN" || c === "NETHERLANDS" || c === "BELGIUM" || c === "AUSTRIA" || c === "SWITZERLAND" || c === "PORTUGAL" || c === "SWEDEN") return "EU";
    return "EU"; // other countries default to EU
  }
  // 2. Fallback: derive region from source/platform
  if (source) {
    const canonical = resolveCanonicalSource(source, null);
    switch (canonical) {
      case "BaT":
      case "CarsAndBids":
      case "ClassicCom":
        return "US";
      case "AutoScout24":
      case "CollectingCars":
      case "Elferspot":
        return "EU";
      case "AutoTrader":
        return "UK";
      case "BeForward":
        return "JP";
    }
  }
  return "US"; // ultimate fallback
}

function buildFairValue(price: number): FairValueByRegion {
  return buildRegionalFairValue(price);
}

// ─── Median helper ───
function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ─── Enrich cars with real per-region fair values ───
// Groups cars by make|model, computes per-region median listing prices (in USD),
// and replaces the fake ±20% band with real data.
export async function enrichFairValues(cars: CollectorCar[]): Promise<CollectorCar[]> {
  if (cars.length === 0) return cars;

  const rates = await getExchangeRates();

  const REGIONS = ["US", "EU", "UK", "JP"] as const;
  const CURRENCY_MAP: Record<string, "$" | "€" | "£" | "¥"> = {
    US: "$", EU: "€", UK: "£", JP: "¥",
  };

  // Group USD-converted prices by model key → region
  const modelRegionPrices = new Map<string, Map<string, number[]>>();

  for (const car of cars) {
    const key = `${car.make}|${car.model}`;
    if (!modelRegionPrices.has(key)) {
      modelRegionPrices.set(key, new Map());
    }
    const regionMap = modelRegionPrices.get(key)!;
    const raw = car.price > 0 ? car.price : car.currentBid;
    const usdPrice = toUsd(raw, car.originalCurrency, rates);
    if (usdPrice > 0) {
      if (!regionMap.has(car.region)) {
        regionMap.set(car.region, []);
      }
      regionMap.get(car.region)!.push(usdPrice);
    }
  }

  // Pre-compute fair values per model
  const modelFairValues = new Map<string, FairValueByRegion>();

  for (const [modelKey, regionMap] of modelRegionPrices) {
    // Overall median for this model (fallback for regions with no data)
    const allPrices: number[] = [];
    for (const prices of regionMap.values()) allPrices.push(...prices);
    const overallMedian = computeMedian(allPrices);

    const result = {} as FairValueByRegion;
    for (const region of REGIONS) {
      const prices = regionMap.get(region) || [];
      const median = prices.length > 0 ? computeMedian(prices) : overallMedian;
      result[region] = {
        currency: CURRENCY_MAP[region],
        low: Math.round(median * 0.85),
        high: Math.round(median * 1.15),
      };
    }
    modelFairValues.set(modelKey, result);
  }

  // Apply real fair values to each car
  for (const car of cars) {
    const key = `${car.make}|${car.model}`;
    const fairValue = modelFairValues.get(key);
    if (fairValue) {
      car.fairValueByRegion = fairValue;
    }
  }

  return cars;
}

function auctionHouseLabel(source: string): string {
  const canonical = resolveCanonicalSource(source, null);
  switch (canonical) {
    case "BaT":
      return "Bring a Trailer";
    case "CarsAndBids":
      return "Cars & Bids";
    case "CollectingCars":
      return "Collecting Cars";
    case "AutoTrader":
      return "Auto Trader";
    case "BeForward":
      return "Be Forward";
    case "ClassicCom":
      return "Classic.com";
    default:
      return source;
  }
}

// ─── Investment grade calculation ───

function computeGrade(
  price: number,
  make: string,
  year: number,
): "AAA" | "AA" | "A" | "B+" | "B" | "C" {
  // Premium makes with strong collector markets
  const premiumMakes = ["Ferrari", "Porsche", "McLaren", "Lamborghini", "Aston Martin", "Mercedes-Benz"]
  const midMakes = ["BMW", "Nissan", "Toyota", "Lexus", "Jaguar", "Ford"]
  const isPremium = premiumMakes.some(m => m.toLowerCase() === make.toLowerCase())
  const isMid = midMakes.some(m => m.toLowerCase() === make.toLowerCase())

  // Age factor: older cars with high price = more collectible
  const age = new Date().getFullYear() - year
  const isVintage = age >= 30
  const isClassic = age >= 20

  // Price tier factor
  const isHighValue = price >= 500000
  const isMidValue = price >= 100000

  let score = 0
  if (isPremium) score += 3
  else if (isMid) score += 2
  else score += 1

  if (isVintage) score += 3
  else if (isClassic) score += 2
  else if (age >= 10) score += 1

  if (isHighValue) score += 3
  else if (isMidValue) score += 2
  else if (price > 0) score += 1

  if (score >= 8) return "AAA"
  if (score >= 7) return "AA"
  if (score >= 5) return "A"
  if (score >= 4) return "B+"
  if (score >= 2) return "B"
  return "C"
}

// ─── Row → CollectorCar ───

function rowToCollectorCar(row: ListingRow): CollectorCar {
  const price = row.listing_price
    ?? row.current_bid
    ?? row.final_price
    ?? (row.hammer_price != null ? Number(row.hammer_price) || 0 : 0);

  // Prefer direct images column; fall back to photos_media join
  const directImages = (row.images ?? []).map(normalizeListingImageUrl).filter((u): u is string => u !== null);
  const joinedPhotos = (row.photos_media ?? [])
    .map((p) => p.photo_url)
    .map(normalizeListingImageUrl)
    .filter((u): u is string => u !== null);
  const photos = directImages.length > 0 ? directImages : joinedPhotos;
  const resolvedImages = resolveListingImages(photos);

  // Prefer direct location column; fall back to city/region/country parts
  const location = row.location
    ?? [row.city, row.region, row.country].filter(Boolean).join(", ");
  const label = auctionHouseLabel(row.source);

  const engine = row.engine ?? "\u2014";
  const transmission = row.transmission ?? "\u2014";

  // Mileage: stored in km in DB, convert to miles for display
  let displayMileage = 0;
  let displayUnit: "mi" | "km" = "mi";
  if (row.mileage != null && row.mileage > 0) {
    displayMileage = Math.round(row.mileage * 0.621371);
    displayUnit = "mi";
  }

  // Description → thesis (short) + history (full)
  const desc = row.description_text ?? null;
  const thesis = desc
    ? desc.slice(0, 300) + (desc.length > 300 ? "..." : "")
    : `Live auction listing from ${label}`;
  const history = desc ?? `Sourced from ${label}`;

  // Prefer direct platform column; fall back to source mapping
  const normalizedPlatform = normalizeToken(row.platform);
  const platform = normalizedPlatform === "BRINGATRAILER"
    ? "BRING_A_TRAILER"
    : normalizedPlatform === "AUTOSCOUT24"
      ? "AUTO_SCOUT_24"
      : normalizedPlatform === "AUTOTRADER"
        ? "AUTO_TRADER"
        : normalizedPlatform === "BEFORWARD"
          ? "BE_FORWARD"
      : normalizedPlatform === "CARSANDBIDS"
        ? "CARS_AND_BIDS"
        : normalizedPlatform === "COLLECTINGCARS"
          ? "COLLECTING_CARS"
          : normalizedPlatform === "CLASSICCOM"
            ? "CLASSIC_COM"
            : mapPlatform(row.source, row.platform);

  // Prefer direct end_time; fall back to sale_date.
  // Dealer/classified listings (no end_time or sale_date) get endTime 30 days
  // in the future so they are never filtered out by the "endTime > now" check
  // in the dashboard live-feed components.
  const endTime = row.end_time
    ? new Date(row.end_time)
    : row.sale_date
      ? new Date(row.sale_date)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Prefer direct current_bid column; fall back to price
  const currentBid = row.current_bid ?? price;
  const bidCount = row.bid_count ?? 0;

  return {
    id: `live-${row.id}`,
    title: row.title ?? `${row.year} ${row.make} ${row.model}${row.trim ? ` ${row.trim}` : ""}`,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.trim,
    price,
    trend: "Live Data",
    trendValue: 0,
    investmentGrade: computeGrade(price, row.make, row.year),
    thesis,
    image: resolvedImages[0],
    images: resolvedImages,
    engine,
    transmission,
    mileage: displayMileage,
    mileageUnit: displayUnit,
    location: location || "Unknown",
    region: mapRegion(row.country, row.source),
    fairValueByRegion: buildFairValue(price),
    history,
    platform,
    status: mapStatus(row.status),
    currentBid,
    bidCount,
    endTime,
    category: "Live Auctions",
    sourceUrl: row.source_url,
    // New optional fields
    vin: row.vin ?? null,
    exteriorColor: row.color_exterior ?? null,
    interiorColor: row.color_interior ?? null,
    description: desc,
    sellerNotes: row.seller_notes ?? null,
    originalCurrency: row.original_currency ?? null,
  };
}

// ─── Junk listing filter (safety net — catches items the cron cleanup hasn't removed yet) ───

function isJunkListing(row: { make: string; model: string; year: number; title?: string | null }): boolean {
  const model = (row.model ?? "").toLowerCase();
  const title = (row.title ?? "").toLowerCase();

  // Porsche-Diesel tractors (but NOT Cayenne Diesel which is a real car)
  if (model.includes("diesel") && !model.includes("cayenne")) return true;

  // Tractors by model or title
  if (model.includes("tractor") || title.includes("tractor")) return true;

  // Literature, press kits, tool kits
  if (model.includes("literature") || model.includes("press kit")) return true;
  if (model.includes("tool kit") || (model.includes("tool") && model.includes("356"))) return true;

  // Kit cars using Porsche engines (APAL, Genie, etc.)
  if (model.includes("apal") || model.includes("genie")) return true;

  // Non-car projects / parts / accessories
  if (model.includes("kenworth")) return true;

  return false;
}

// ─── Trend computation ───

function computeTrend(
  history: PriceHistoryRow[]
): { trend: string; trendValue: number } {
  if (history.length < 2) return { trend: "Live Data", trendValue: 0 };

  const sorted = [...history].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const earliestPrice = earliest.price_usd ?? earliest.price_eur ?? earliest.price_gbp ?? 0;
  const latestPrice = latest.price_usd ?? latest.price_eur ?? latest.price_gbp ?? 0;

  if (earliestPrice <= 0) return { trend: "Live Data", trendValue: 0 };

  const trendValue = ((latestPrice - earliestPrice) / earliestPrice) * 100;
  const trend =
    trendValue > 0
      ? `+${trendValue.toFixed(1)}%`
      : `${trendValue.toFixed(1)}%`;
  return { trend, trendValue };
}

// ─── Query helper with fallback ───

// Default sources for lightweight live listing views.
const DEFAULT_QUERY_SOURCES = ["BaT", "AutoScout24"] as const;
const ALL_QUERY_SOURCES = ["BaT", "AutoScout24", "AutoTrader", "BeForward", "CarsAndBids", "CollectingCars", "ClassicCom", "Elferspot"] as const;

export type LiveListingRegionTotals = {
  all: number;
  US: number;
  UK: number;
  EU: number;
  JP: number;
};

export type LiveListingAggregateCounts = {
  liveNow: number;
  regionTotalsByPlatform: LiveListingRegionTotals;
  regionTotalsByLocation: LiveListingRegionTotals;
};

function encodePostgrestInValues(values: readonly string[]): string {
  return values
    .map((value) => value.replace(/"/g, "\\\""))
    .map((value) => `"${value}"`)
    .join(",");
}

async function countListingsByQuery(query: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  try {
    const result = await query;
    if (result.error) {
      console.error("[supabaseLiveListings] count query failed:", result.error.message);
      return 0;
    }
    return result.count ?? 0;
  } catch (error) {
    console.error("[supabaseLiveListings] count query threw:", error);
    return 0;
  }
}

async function countLiveListingsForCanonicalSource(
  supabase: SupabaseClient,
  source: CanonicalSource,
  targetMake: SupportedLiveMake,
): Promise<number> {
  const sourceAliases = SOURCE_ALIASES[source] ?? [source];
  const platformAliases = source in PLATFORM_ALIASES
    ? PLATFORM_ALIASES[source as keyof typeof PLATFORM_ALIASES]
    : [];

  let query = supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .ilike("make", targetMake)
    .eq("status", LIVE_DB_STATUS_VALUES[0]);

  if (platformAliases.length > 0) {
    query = query.or(
      `source.in.(${encodePostgrestInValues(sourceAliases)}),platform.in.(${encodePostgrestInValues(platformAliases)})`
    );
  } else {
    query = query.in("source", [...sourceAliases]);
  }

  return countListingsByQuery(query);
}

const _aggregateCountsCache = new Map<string, { data: LiveListingAggregateCounts; expiresAt: number }>();
const _aggregateCountsInflight = new Map<string, Promise<LiveListingAggregateCounts>>();
const AGGREGATE_COUNTS_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchLiveListingAggregateCounts(options?: { make?: string | null }): Promise<LiveListingAggregateCounts> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return {
      liveNow: 0,
      regionTotalsByPlatform: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 },
      regionTotalsByLocation: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 },
    };
  }

  const targetMake = resolveRequestedMake(options?.make);
  const cacheKey = targetMake;

  const cached = _aggregateCountsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // Deduplicate concurrent callers so a dashboard + MakePage SSR + paginated
  // /api/mock-auctions all share a single underlying Supabase fan-out instead
  // of firing 30 count queries in parallel.
  const inflight = _aggregateCountsInflight.get(cacheKey);
  if (inflight) return inflight;

  const run = (async (): Promise<LiveListingAggregateCounts> => {

  try {
    const supabase = createSupabaseClient(url, key);

    const totalPromise = countListingsByQuery(
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .ilike("make", targetMake)
        .eq("status", LIVE_DB_STATUS_VALUES[0])
    );

    const usBatPromise = countLiveListingsForCanonicalSource(supabase, "BaT", targetMake);
    const usClassicPromise = countLiveListingsForCanonicalSource(supabase, "ClassicCom", targetMake);
    const euPromise = countLiveListingsForCanonicalSource(supabase, "AutoScout24", targetMake);
    const ukPromise = countLiveListingsForCanonicalSource(supabase, "AutoTrader", targetMake);
    const jpPromise = countLiveListingsForCanonicalSource(supabase, "BeForward", targetMake);
    const euElferspotPromise = countLiveListingsForCanonicalSource(supabase, "Elferspot", targetMake);

    const locationUsPromise = countListingsByQuery(
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .ilike("make", targetMake)
        .eq("status", LIVE_DB_STATUS_VALUES[0])
        .or(`country.is.null,country.in.(${encodePostgrestInValues(["USA", "US", "UNITED STATES"])})`)
    );
    const locationUkPromise = countListingsByQuery(
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .ilike("make", targetMake)
        .eq("status", LIVE_DB_STATUS_VALUES[0])
        .in("country", ["UK", "UNITED KINGDOM"])
    );
    const locationJpPromise = countListingsByQuery(
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .ilike("make", targetMake)
        .eq("status", LIVE_DB_STATUS_VALUES[0])
        .in("country", ["JAPAN"])
    );

    const [total, usBat, usClassic, eu, uk, jp, euElferspot, locationUs, locationUk, locationJp] = await Promise.all([
      totalPromise,
      usBatPromise,
      usClassicPromise,
      euPromise,
      ukPromise,
      jpPromise,
      euElferspotPromise,
      locationUsPromise,
      locationUkPromise,
      locationJpPromise,
    ]);

    const locationEu = Math.max(0, total - locationUs - locationUk - locationJp);

    return {
      liveNow: total,
      regionTotalsByPlatform: {
        all: total,
        US: usBat + usClassic,
        EU: eu + euElferspot,
        UK: uk,
        JP: jp,
      },
      regionTotalsByLocation: {
        all: total,
        US: locationUs,
        UK: locationUk,
        JP: locationJp,
        EU: locationEu,
      },
    };
  } catch (error) {
    console.error("[supabaseLiveListings] fetchLiveListingAggregateCounts failed:", error);
    return {
      liveNow: 0,
      regionTotalsByPlatform: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 },
      regionTotalsByLocation: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 },
    };
  }
  })().then((data) => {
    _aggregateCountsCache.set(cacheKey, { data, expiresAt: Date.now() + AGGREGATE_COUNTS_TTL_MS });
    _aggregateCountsInflight.delete(cacheKey);
    return data;
  }).catch((error) => {
    _aggregateCountsInflight.delete(cacheKey);
    throw error;
  });

  _aggregateCountsInflight.set(cacheKey, run);
  return run;
}

export function interleaveResultsBySource<T>(resultsBySource: T[][], limit: number): T[] {
  const interleaved: T[] = [];
  const maxLen = Math.max(0, ...resultsBySource.map((arr) => arr.length));

  for (let i = 0; i < maxLen && interleaved.length < limit; i++) {
    for (const sourceResults of resultsBySource) {
      if (i < sourceResults.length && interleaved.length < limit) {
        interleaved.push(sourceResults[i]);
      }
    }
  }

  return interleaved;
}

// Direct query: fetch ALL listings for a make without per-source bucketing.
// This ensures no listings are silently dropped due to unrecognised source/platform values.
async function queryAllListingsDirect(
  supabase: SupabaseClient,
  limit: number,
  targetMake: SupportedLiveMake,
  statusFilter?: string,
): Promise<ListingRow[]> {
  const pageSize = 500;
  const maxRows = limit > 0 ? limit : 5000;
  const rows: ListingRow[] = [];
  let from = 0;

  while (rows.length < maxRows) {
    try {
      let query = supabase
        .from("listings")
        .select(SELECT_NARROW)
        .ilike("make", targetMake);

      if (statusFilter && statusFilter.toLowerCase() === "active") {
        query = query.eq("status", LIVE_DB_STATUS_VALUES[0]);
      } else if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const to = Math.min(from + pageSize - 1, maxRows - 1);
      const { data, error } = await query
        .order("sale_date", { ascending: false, nullsFirst: false })
        .order("end_time", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("[supabaseLiveListings] queryAllListingsDirect failed:", error.message);
        break;
      }

      const page = (data ?? []) as ListingRow[];
      if (page.length === 0) break;

      for (const row of page) {
        rows.push(row);
      }

      if (page.length < pageSize) break;
      from += pageSize;
    } catch (err) {
      console.error("[supabaseLiveListings] queryAllListingsDirect threw:", err);
      break;
    }
  }

  return rows;
}

async function queryListingsMany(
  supabase: SupabaseClient,
  limit: number,
  targetMake: SupportedLiveMake,
  statusFilter?: string,
  sources: readonly CanonicalSource[] = DEFAULT_QUERY_SOURCES,
): Promise<ListingRow[]> {
  const hasLimit = limit > 0;
  const sourceQueryLimit = hasLimit ? limit : 1000;
  const maxRowsPerSource = hasLimit ? sourceQueryLimit : 5000;

  const buildBaseQuery = () => {
    let query = supabase
      .from("listings")
      .select(SELECT_NARROW)
      .ilike("make", targetMake);

    if (statusFilter && statusFilter.toLowerCase() === "active") {
      query = query.eq("status", LIVE_DB_STATUS_VALUES[0]);
      // Exclude stale auction listings whose end_time has already passed
      query = query.or("end_time.is.null,end_time.gt." + new Date().toISOString());
    } else if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    return query;
  };

  const querySourceBucket = async (source: CanonicalSource) => {
    const sourceAliases = SOURCE_ALIASES[source] ?? [source];
    const platformAliases = source in PLATFORM_ALIASES
      ? PLATFORM_ALIASES[source as keyof typeof PLATFORM_ALIASES]
      : [];

    const runBucketQuery = async (label: "source" | "platform", builder: () => PromiseLike<{ data: ListingRow[] | null; error: { message: string } | null }>) => {
      try {
        const result = await builder();
        if (result.error) {
          console.error(`[supabaseLiveListings] ${source} ${label} query failed:`, result.error.message);
          return [] as ListingRow[];
        }
        return (result.data ?? []) as ListingRow[];
      } catch (error) {
        console.error(`[supabaseLiveListings] ${source} ${label} query threw:`, error);
        return [] as ListingRow[];
      }
    };

    const fetchBucketRows = async (
      label: "source" | "platform",
      build: (from: number, to: number) => PromiseLike<{ data: ListingRow[] | null; error: { message: string } | null }>
    ) => {
      // Always paginate in chunks to avoid Supabase PostgREST max_rows
      // silent truncation (default 1000). A single .range(0, 3999) would
      // silently return only 1000 rows with no error.
      const rows: ListingRow[] = [];
      const pageSize = 1000;
      let from = 0;

      while (rows.length < maxRowsPerSource) {
        const pageRows = await runBucketQuery(label, () => build(from, from + pageSize - 1));
        if (pageRows.length === 0) break;
        rows.push(...pageRows);
        if (pageRows.length < pageSize) break;
        from += pageSize;
      }

      return rows;
    };

    const sourceRows = await fetchBucketRows("source", (from, to) =>
      buildBaseQuery()
        .in("source", [...sourceAliases])
        .order("sale_date", { ascending: false, nullsFirst: false })
        .order("end_time", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .range(from, to)
    );

    const platformRows = platformAliases.length > 0
      ? await fetchBucketRows("platform", (from, to) =>
          buildBaseQuery()
            .in("platform", [...platformAliases])
            .order("sale_date", { ascending: false, nullsFirst: false })
            .order("end_time", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false })
            .range(from, to)
        )
      : [];

    const merged = [...sourceRows, ...platformRows].sort((a, b) => {
      const aPrimary = a.sale_date ?? a.end_time ?? "";
      const bPrimary = b.sale_date ?? b.end_time ?? "";
      if (aPrimary !== bPrimary) return bPrimary.localeCompare(aPrimary);
      const aSecondary = a.end_time ?? "";
      const bSecondary = b.end_time ?? "";
      if (aSecondary !== bSecondary) return bSecondary.localeCompare(aSecondary);
      return b.id.localeCompare(a.id);
    });
    const byId = new Map<string, ListingRow>();
      for (const row of merged) {
        const canonicalSource = resolveCanonicalSource(row.source, row.platform);
        if (canonicalSource !== source) continue;
        if (statusFilter && statusFilter.toLowerCase() === "active" && !isLiveListingStatus(row.status)) continue;
        byId.set(row.id, row);
      }

    return Array.from(byId.values());
  };

  const queries = sources.map((source) => querySourceBucket(source));
  const settledResults = await Promise.allSettled(queries);
  const resultsBySource = settledResults.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    console.error(`[supabaseLiveListings] ${sources[index]} bucket failed:`, result.reason);
    return [] as ListingRow[];
  });

  // Treat `limit` as per-source retrieval budget so tab-level source views
  // (US=BaT, EU=AutoScout24) are not truncated by cross-source mixing.
  const interleaveLimit = hasLimit ? limit * sources.length : Number.MAX_SAFE_INTEGER;
  return interleaveResultsBySource(resultsBySource, interleaveLimit);
}

async function queryListingSingle(
  supabase: SupabaseClient,
  id: string
): Promise<ListingRow | null> {
  const isNotFoundError = (error: { code?: string | null; message?: string | null } | null | undefined) => {
    if (!error) return false;
    return error.code === "PGRST116" || (error.message ?? "").toLowerCase().includes("0 rows");
  };

  let result = await supabase
    .from("listings")
    .select(SELECT_BROAD)
    .eq("id", id)
    .single();

  if (result.error) {
    result = await supabase
      .from("listings")
      .select(SELECT_NARROW)
      .eq("id", id)
      .single();
  }

  if (result.error) {
    if (isNotFoundError(result.error)) {
      return null;
    }
    throw new Error(`[supabaseLiveListings] listing lookup failed for ${id}: ${result.error.message}`);
  }
  const row = (result.data as ListingRow) ?? null;
  if (!row) return null;
  if (!isSupportedLiveMake(row.make)) {
    return null;
  }
  return row;
}

// ─── Public API ───

export async function fetchLiveListingById(liveId: string): Promise<CollectorCar | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  const supabaseId = liveId.startsWith("live-") ? liveId.slice(5) : liveId;

  try {
    const supabase = createSupabaseClient(url, key);

    const row = await queryListingSingle(supabase, supabaseId);

    if (!row) return null;

    return rowToCollectorCar(row);
  } catch {
    return null;
  }
}

export type LiveListingLookupResult = {
  car: CollectorCar | null;
  transientError: boolean;
};

export async function fetchLiveListingByIdWithStatus(liveId: string): Promise<LiveListingLookupResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { car: null, transientError: false };
  }

  const supabaseId = liveId.startsWith("live-") ? liveId.slice(5) : liveId;

  try {
    const supabase = createSupabaseClient(url, key);
    const row = await queryListingSingle(supabase, supabaseId);

    if (!row) {
      return { car: null, transientError: false };
    }

    return { car: rowToCollectorCar(row), transientError: false };
  } catch (error) {
    console.error("[supabaseLiveListings] fetchLiveListingByIdWithStatus failed:", error);
    return { car: null, transientError: true };
  }
}

// ─── Sold history from listings table (for price trend charts) ───

export interface SoldListingRecord {
  price: number;
  date: string;
  model: string;
  year: number;
  title: string;
}

export async function fetchSoldListingsForMake(
  make: string,
  limit = 200
): Promise<SoldListingRecord[]> {
  const normalizedMake = normalizeSupportedMake(make);
  if (!normalizedMake) {
    return [];
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return [];

  try {
    const supabase = createSupabaseClient(url, key);

    const { data, error } = await supabase
      .from("listings")
      .select("id,year,make,model,trim,listing_price,sale_date,status")
      .ilike("make", normalizedMake)
      .eq("status", "sold")
      .not("listing_price", "is", null)
      .gt("listing_price", 0)
      .order("sale_date", { ascending: true })
      .limit(limit);

    if (error || !data) return [];

    return data
      .filter((r: { listing_price: string | number | null; sale_date: string | null }) => r.listing_price != null && r.sale_date != null)
      .map((r: { year: number; make: string; model: string; trim: string | null; listing_price: string | number; sale_date: string }) => ({
        price: Number(r.listing_price),
        date: r.sale_date,
        model: r.model,
        year: r.year,
        title: `${r.year} ${r.make} ${r.model}${r.trim ? ` ${r.trim}` : ""}`,
      }));
  } catch (err) {
    console.error("[supabaseLiveListings] fetchSoldListingsForMake failed:", err);
    return [];
  }
}

// ─── Priced listings for model (all statuses with listing_price) ───

export interface PricedListingRow {
  id: string
  year: number
  make: string
  model: string
  trim: string | null
  listing_price: number
  original_currency: string | null
  sale_date: string | null
  status: string
  mileage: number | null
  source: string
  country: string | null
}

export async function fetchPricedListingsForModel(
  make: string,
  limit = 500
): Promise<PricedListingRow[]> {
  const normalizedMake = normalizeSupportedMake(make);
  if (!normalizedMake) return [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return [];

  try {
    const supabase = createSupabaseClient(url, key);

    const { data, error } = await supabase
      .from("listings")
      .select("id,year,make,model,trim,listing_price,original_currency,sale_date,status,mileage,source,country")
      .ilike("make", normalizedMake)
      .not("listing_price", "is", null)
      .gt("listing_price", 0)
      .order("sale_date", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.filter(
      (r: { listing_price: string | number | null }) => r.listing_price != null && Number(r.listing_price) > 0
    ) as PricedListingRow[];
  } catch (err) {
    console.error("[supabaseLiveListings] fetchPricedListingsForModel failed:", err);
    return [];
  }
}

export async function fetchLiveListingsAsCollectorCars(options?: {
  limit?: number;
  includePriceHistory?: boolean;
  make?: string | null;
  status?: "active" | "all";
  includeAllSources?: boolean;
}): Promise<CollectorCar[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return [];

  const limit = options?.limit ?? 200;
  const includePriceHistory = options?.includePriceHistory ?? true;
  const targetMake = resolveRequestedMake(options?.make);
  const statusFilter = options?.status === "all" ? undefined : "active";
  // Always query all 7 sources so every region tab has data.
  // includeAllSources is kept for backwards compat but defaults to all.
  const sources = options?.includeAllSources === false ? DEFAULT_QUERY_SOURCES : ALL_QUERY_SOURCES;

  try {
    const supabase = createSupabaseClient(url, key);

    // Per-source bucketed query ensures balanced representation across all regions.
    // queryAllListingsDirect is kept as a fallback but queryListingsMany handles
    // source-level interleaving so EU/UK/JP tabs always have data.
    const rawRows = await queryListingsMany(supabase, limit, targetMake, statusFilter, sources);
    const rows = rawRows.filter((r) => !isJunkListing(r));
    if (rows.length === 0) return [];

    if (!includePriceHistory) {
      return await enrichFairValues(rows.map((row) => rowToCollectorCar(row)));
    }

    // Fetch price history for trend computation
    const listingIds = rows.map((r) => r.id);
    const { data: historyData } = await supabase
      .from("price_history")
      .select("listing_id,price_usd,price_eur,price_gbp,time")
      .in("listing_id", listingIds)
      .order("time", { ascending: true });

    const historyByListing = new Map<string, PriceHistoryRow[]>();
    for (const row of (historyData ?? []) as PriceHistoryRow[]) {
      const existing = historyByListing.get(row.listing_id) ?? [];
      existing.push(row);
      historyByListing.set(row.listing_id, existing);
    }

    const cars = rows.map((row) => {
      const car = rowToCollectorCar(row);
      const history = historyByListing.get(row.id);

      // Use latest price_history as currentBid when the live bid is still unavailable.
      if (car.currentBid === 0 && history && history.length > 0) {
        const latest = history[history.length - 1];
        const latestPrice = latest.price_usd ?? latest.price_eur ?? latest.price_gbp ?? 0;
        if (latestPrice > 0) {
          car.currentBid = latestPrice;
          car.price = latestPrice;
        }
      }

      if (history && history.length >= 2) {
        const { trend, trendValue } = computeTrend(history);
        car.trend = trend;
        car.trendValue = trendValue;
      }
      return car;
    });

    return await enrichFairValues(cars);
  } catch (err) {
    console.error("[supabaseLiveListings] Failed to fetch:", err);
    return [];
  }
}

// ─── Paginated listings (server-side filtering, sorting, pagination) ───

const REGION_COUNTRY_MAP: Record<string, string[]> = {
  US: ["USA", "US", "UNITED STATES"],
  UK: ["UK", "UNITED KINGDOM"],
  JP: ["JAPAN"],
};

// Region → source platforms (mirrors platformMapping.ts REGION_TO_PLATFORMS).
// Used for DB-level region filtering since the `source` column is always populated
// while `country` may be NULL for some scrapers (e.g. BeForward).
const REGION_SOURCE_MAP: Record<string, readonly (readonly string[])[]> = {
  US: [SOURCE_ALIASES.BaT, SOURCE_ALIASES.ClassicCom, SOURCE_ALIASES.CarsAndBids],
  EU: [SOURCE_ALIASES.AutoScout24, SOURCE_ALIASES.CollectingCars, SOURCE_ALIASES.Elferspot],
  UK: [SOURCE_ALIASES.AutoTrader],
  JP: [SOURCE_ALIASES.BeForward],
};

function resolveSourceAliasesForPlatform(platformKey: string): string[] {
  const upperKey = platformKey.toUpperCase().replace(/[^A-Z0-9]/g, "");

  for (const [canonical, aliases] of Object.entries(SOURCE_ALIASES)) {
    const normalizedCanonical = canonical.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalizedCanonical === upperKey) {
      return [...aliases];
    }
    for (const alias of aliases) {
      if (alias.toUpperCase().replace(/[^A-Z0-9]/g, "") === upperKey) {
        return [...aliases];
      }
    }
  }

  return [platformKey];
}

const SORT_COLUMN_MAP: Record<string, string> = {
  endTime: "end_time",
  price: "listing_price",
  currentBid: "current_bid",
  year: "year",
  bidCount: "bid_count",
  trendValue: "listing_price",
};

export async function fetchPaginatedListings(options: {
  make: string;
  pageSize?: number;
  offset?: number;
  region?: string | null;
  platform?: string | null;
  query?: string | null;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: "active" | "all";
  modelPatterns?: { keywords: string[]; yearMin?: number; yearMax?: number } | null;
}): Promise<{
  cars: CollectorCar[];
  hasMore: boolean;
  totalCount?: number;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { cars: [], hasMore: false };
  }

  const pageSize = options.pageSize ?? 50;
  const offset = options.offset ?? 0;
  const targetMake = resolveRequestedMake(options.make);

  try {
    const supabase = createSupabaseClient(url, key);

    // Build base query. Count omitted on purpose: `count: "exact"` forces
    // a full-table scan alongside every page fetch which collides with the
    // Supabase statement_timeout when multiple sources / tabs query in
    // parallel. `hasMore` is already derived from fetching pageSize + 1.
    let query = supabase
      .from("listings")
      .select(SELECT_NARROW)
      .ilike("make", targetMake);

    // Status filter
    if (options.status !== "all") {
      query = query.eq("status", LIVE_DB_STATUS_VALUES[0]);
      // Exclude stale auction listings whose end_time has already passed
      query = query.or("end_time.is.null,end_time.gt." + new Date().toISOString());
    }

    // Model pattern filter (series-level, e.g. "992" → model ILIKE %992%)
    if (options.modelPatterns) {
      const { keywords, yearMin, yearMax } = options.modelPatterns;
      if (keywords.length > 0) {
        const orClauses = keywords
          .map((kw) => `model.ilike.%${kw.replace(/[%_]/g, "")}%`)
          .join(",");
        query = query.or(orClauses);
      }
      if (yearMin !== undefined) {
        query = query.gte("year", yearMin);
      }
      if (yearMax !== undefined) {
        query = query.lte("year", yearMax);
      }
    }

    // Region filter — use source/platform mapping (reliable) instead of country
    // column which may be NULL for some scrapers (e.g. BeForward for JP).
    if (options.region) {
      const regionUpper = options.region.toUpperCase();
      const sourceGroups = REGION_SOURCE_MAP[regionUpper];

      if (sourceGroups) {
        const allAliases = sourceGroups.flat();
        query = query.in("source", allAliases);
      } else {
        // Unknown region — fall back to country-based filtering
        const countryValues = REGION_COUNTRY_MAP[regionUpper];
        if (countryValues) {
          query = query.in("country", countryValues);
        }
      }
    }

    // Platform filter
    if (options.platform) {
      const sourceAliases = resolveSourceAliasesForPlatform(options.platform);
      query = query.in("source", sourceAliases);
    }

    // Text search filter
    if (options.query) {
      const escaped = options.query.replace(/[%_]/g, "");
      query = query.or(
        `title.ilike.%${escaped}%,model.ilike.%${escaped}%`
      );
    }

    // Sorting
    const sortColumn = SORT_COLUMN_MAP[options.sortBy ?? "endTime"] ?? "end_time";
    const ascending = (options.sortOrder ?? "asc") === "asc";
    query = query.order(sortColumn, { ascending, nullsFirst: false });

    // Secondary sort for stable pagination
    if (sortColumn !== "id") {
      query = query.order("id", { ascending: false });
    }

    // Fetch pageSize + 1 to determine hasMore
    const fetchCount = pageSize + 1;
    query = query.range(offset, offset + fetchCount - 1);

    const { data, error } = await query;

    if (error) {
      console.error("[supabaseLiveListings] fetchPaginatedListings failed:", error.message);
      return { cars: [], hasMore: false };
    }

    const rows = ((data ?? []) as ListingRow[]).filter((r) => !isJunkListing(r));
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

    const cars = pageRows.map((row) => rowToCollectorCar(row));

    return { cars, hasMore };
  } catch (err) {
    console.error("[supabaseLiveListings] fetchPaginatedListings threw:", err);
    return { cars: [], hasMore: false };
  }
}

// ─── Per-series counts (reads from listings_active_counts materialized view) ───

/**
 * Returns listing counts per series by querying the `listings_active_counts`
 * materialized view with a single request. Aggregation is done by Postgres,
 * eliminating the previous keyset-paginated client-side approach.
 *
 * Graceful fallback: if the MV hasn't been created yet (migration pending),
 * returns {} and emits a console.warn pointing at the migration file.
 */
export async function fetchSeriesCounts(make: string): Promise<Record<string, number>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return {};

  const targetMake = resolveRequestedMake(make).toLowerCase();

  try {
    const supabase = createSupabaseClient(url, key);
    const { data, error } = await supabase
      .from("listings_active_counts")
      .select("series,live_count")
      .eq("make", targetMake);

    if (error) {
      if (/(relation.*listings_active_counts.*does not exist)|(could not find the table)/i.test(error.message)) {
        console.warn(
          "[supabaseLiveListings] listings_active_counts MV missing — " +
          "apply supabase/migrations/20260419_listings_active_counts_mv.sql and run refresh_listings_active_counts()."
        );
        return {};
      }
      console.error("[supabaseLiveListings] fetchSeriesCounts MV query failed:", error.message);
      return {};
    }

    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { series: string; live_count: number }[]) {
      if (row.series === "__null") continue;
      counts[row.series] = (counts[row.series] ?? 0) + Number(row.live_count);
    }
    return counts;
  } catch (err) {
    console.error("[supabaseLiveListings] fetchSeriesCounts threw:", err);
    return {};
  }
}
