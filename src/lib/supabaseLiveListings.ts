import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  CollectorCar,
  Platform,
  AuctionStatus,
  Region,
  FairValueByRegion,
} from "./curatedCars";

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

const SUPABASE_TIMEOUT_MS = 4_000;

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
  "id,year,make,model,trim,source,source_url,status,sale_date,country,region,city,hammer_price,original_currency,mileage,mileage_unit,vin,color_exterior,color_interior,description_text,body_style,title,platform,current_bid,bid_count,reserve_status,seller_notes,images,engine,transmission,end_time,start_time,final_price,location,photos_media(photo_url)";

// ─── Narrow select (without joins — fallback if photos_media join fails) ───
const SELECT_NARROW =
  "id,year,make,model,trim,source,source_url,status,sale_date,country,region,city,hammer_price,original_currency,mileage,mileage_unit,vin,color_exterior,color_interior,description_text,body_style,title,platform,current_bid,bid_count,reserve_status,seller_notes,images,engine,transmission,end_time,start_time,final_price,location";

// ─── Mappers ───

function mapPlatform(source: string): Platform {
  switch (source) {
    case "BaT":
      return "BRING_A_TRAILER";
    case "CarsAndBids":
      return "CARS_AND_BIDS";
    case "CollectingCars":
      return "COLLECTING_CARS";
    default:
      return "BRING_A_TRAILER";
  }
}

function mapStatus(status: string): AuctionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "sold":
    case "unsold":
    case "delisted":
      return "ENDED";
    default:
      return "ACTIVE";
  }
}

function mapRegion(country: string | null): Region {
  if (!country) return "US";
  const c = country.toUpperCase();
  if (c === "USA" || c === "US" || c === "UNITED STATES") return "US";
  if (c === "UK" || c === "UNITED KINGDOM") return "UK";
  if (c === "JAPAN") return "JP";
  return "EU";
}

function buildFairValue(price: number): FairValueByRegion {
  if (price <= 0) {
    return {
      US: { currency: "$", low: 0, high: 0 },
      EU: { currency: "\u20ac", low: 0, high: 0 },
      UK: { currency: "\u00a3", low: 0, high: 0 },
      JP: { currency: "\u00a5", low: 0, high: 0 },
    };
  }
  const low = Math.round(price * 0.8);
  const high = Math.round(price * 1.2);
  return {
    US: { currency: "$", low, high },
    EU: { currency: "\u20ac", low: Math.round(low * 0.92), high: Math.round(high * 0.92) },
    UK: { currency: "\u00a3", low: Math.round(low * 0.79), high: Math.round(high * 0.79) },
    JP: { currency: "\u00a5", low: Math.round(low * 150), high: Math.round(high * 150) },
  };
}

function auctionHouseLabel(source: string): string {
  switch (source) {
    case "BaT":
      return "Bring a Trailer";
    case "CarsAndBids":
      return "Cars & Bids";
    case "CollectingCars":
      return "Collecting Cars";
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
  const price = row.final_price ?? (row.hammer_price != null ? Number(row.hammer_price) || 0 : 0);

  // Prefer direct images column; fall back to photos_media join
  const directImages = (row.images ?? []).filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );
  const joinedPhotos = (row.photos_media ?? [])
    .map((p) => p.photo_url)
    .filter((u): u is string => typeof u === "string" && u.length > 0);
  const photos = directImages.length > 0 ? directImages : joinedPhotos;

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
  const platform = (row.platform as Platform | null) ?? mapPlatform(row.source);

  // Prefer direct end_time; fall back to sale_date
  const endTime = row.end_time
    ? new Date(row.end_time)
    : row.sale_date
      ? new Date(row.sale_date)
      : new Date();

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
    image: photos[0] ?? "/cars/placeholder.jpg",
    images: photos.length > 0 ? photos : ["/cars/placeholder.jpg"],
    engine,
    transmission,
    mileage: displayMileage,
    mileageUnit: displayUnit,
    location: location || "Unknown",
    region: mapRegion(row.country),
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
  };
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

async function queryListingsMany(
  supabase: SupabaseClient,
  limit: number,
  statusFilter?: string
): Promise<ListingRow[]> {
  // Narrow query first to avoid fragile cross-table joins on degraded networks.
  let narrowQuery = supabase
    .from("listings")
    .select(SELECT_NARROW);

  if (statusFilter) {
    narrowQuery = narrowQuery.eq("status", statusFilter);
  }

  const narrow = await narrowQuery
    .order("sale_date", { ascending: false })
    .limit(limit);

  if (narrow.error) {
    console.error("[supabaseLiveListings] listings query failed:", narrow.error.message);
    return [];
  }
  return (narrow.data ?? []) as ListingRow[];
}

async function queryListingSingle(
  supabase: SupabaseClient,
  id: string
): Promise<ListingRow | null> {
  const narrow = await supabase
    .from("listings")
    .select(SELECT_NARROW)
    .eq("id", id)
    .single();

  if (narrow.error) return null;
  return (narrow.data as ListingRow) ?? null;
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return [];

  try {
    const supabase = createSupabaseClient(url, key);

    const { data, error } = await supabase
      .from("listings")
      .select("id,year,make,model,trim,hammer_price,sale_date,status")
      .ilike("make", make)
      .eq("status", "sold")
      .not("hammer_price", "is", null)
      .gt("hammer_price", 0)
      .order("sale_date", { ascending: true })
      .limit(limit);

    if (error || !data) return [];

    return data
      .filter((r: { hammer_price: string | number | null; sale_date: string | null }) => r.hammer_price != null && r.sale_date != null)
      .map((r: { year: number; make: string; model: string; trim: string | null; hammer_price: string | number; sale_date: string }) => ({
        price: Number(r.hammer_price),
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

export async function fetchLiveListingsAsCollectorCars(options?: { limit?: number; includePriceHistory?: boolean }): Promise<CollectorCar[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return [];

  const limit = options?.limit ?? 200;
  const includePriceHistory = options?.includePriceHistory ?? true;

  try {
    const supabase = createSupabaseClient(url, key);

    // Only fetch active (live) listings — sold/unsold/delisted are historical data
    const rows = await queryListingsMany(supabase, limit, "active");
    if (rows.length === 0) return [];

    if (!includePriceHistory) {
      return rows.map((row) => rowToCollectorCar(row));
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

    return rows.map((row) => {
      const car = rowToCollectorCar(row);
      const history = historyByListing.get(row.id);

      // Use latest price_history as currentBid when hammer_price is 0 (active listings)
      if (car.currentBid === 0 && history && history.length > 0) {
        const latest = history[history.length - 1];
        const latestPrice = latest.price_usd ?? latest.price_eur ?? latest.price_gbp ?? 0;
        if (latestPrice > 0) {
          car.currentBid = latestPrice;
          car.price = latestPrice;
          car.fairValueByRegion = buildFairValue(latestPrice);
        }
      }

      if (history && history.length >= 2) {
        const { trend, trendValue } = computeTrend(history);
        car.trend = trend;
        car.trendValue = trendValue;
      }
      return car;
    });
  } catch (err) {
    console.error("[supabaseLiveListings] Failed to fetch:", err);
    return [];
  }
}
