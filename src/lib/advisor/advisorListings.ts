import { createClient } from "@supabase/supabase-js"
import type { PricedListingRow } from "@/lib/supabaseLiveListings"
import { isJunkListing } from "@/lib/supabaseLiveListings"
import { normalizeSupportedMake } from "@/lib/makeProfiles"

/**
 * Auction platform source values as they appear in the `source` column.
 * Active auctions show current bid (not final value), distorting price queries.
 */
const AUCTION_SOURCE_VALUES = [
  "BaT", "BAT", "BringATrailer", "BRING_A_TRAILER",
  "CarsAndBids", "CARS_AND_BIDS",
  "CollectingCars", "COLLECTING_CARS",
  "ClassicCom", "CLASSICCOM", "CLASSIC_COM",
] as const

/**
 * Server-side filtered listing fetch for advisor tools.
 *
 * Unlike `fetchPricedListingsForModel` (which fetches 500 rows and filters
 * client-side), this function pushes ALL filters to the Supabase query.
 * This ensures the advisor sees the full 16K+ listing corpus.
 */
export async function fetchAdvisorListings(options: {
  make: string
  seriesId?: string | null
  variantId?: string | null
  query?: string | null
  yearFrom?: number | null
  yearTo?: number | null
  priceFromUsd?: number | null
  priceToUsd?: number | null
  status?: "live" | "ended" | null
  region?: string | null
  sortBy?: "price_asc" | "price_desc" | "year_desc" | "year_asc" | "date_desc" | null
  limit?: number
  /** Exclude active auction listings whose price is just a current bid (default true). */
  excludeActiveAuctions?: boolean
}): Promise<PricedListingRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return []

  const normalizedMake = normalizeSupportedMake(options.make)
  if (!normalizedMake) return []

  const limit = options.limit ?? 200

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Start building the query — select the same columns as fetchPricedListingsForModel
    let q = supabase
      .from("listings")
      .select(
        "id,year,make,model,trim,hammer_price:listing_price,original_currency,sale_date,status,mileage,source,source_url,country",
      )
      .ilike("make", normalizedMake)
      .gt("listing_price", 0)

    // ── Server-side filters ──

    // Series (98% of active rows have this column populated)
    if (options.seriesId) {
      q = q.eq("series", options.seriesId)
    }

    // Variant / body type — search model AND trim server-side
    if (options.variantId) {
      const v = options.variantId.replace(/[%_]/g, "")
      q = q.or(`model.ilike.%${v}%,trim.ilike.%${v}%`)
    }

    // Free-text query — search model, trim, and title
    if (options.query) {
      const escaped = options.query.replace(/[%_]/g, "")
      q = q.or(
        `model.ilike.%${escaped}%,trim.ilike.%${escaped}%,title.ilike.%${escaped}%`,
      )
    }

    // Year range
    if (options.yearFrom != null) q = q.gte("year", options.yearFrom)
    if (options.yearTo != null) q = q.lte("year", options.yearTo)

    // Price range (listing_price is in original currency, not USD — but
    // this is still far better than the old 500-row client filter which
    // also compared raw hammer_price without conversion)
    if (options.priceFromUsd != null)
      q = q.gte("listing_price", options.priceFromUsd)
    if (options.priceToUsd != null)
      q = q.lte("listing_price", options.priceToUsd)

    // Status
    if (options.status === "live") {
      q = q.eq("status", "active")
    } else if (options.status === "ended") {
      q = q.eq("status", "sold")
    }

    // Exclude active auctions — their listing_price is just the current bid,
    // not a real asking price. De Morgan: NOT(auction AND active) = (NOT auction) OR (NOT active).
    const excludeAuctions = options.excludeActiveAuctions ?? true
    if (excludeAuctions && options.status !== "ended") {
      const auctionList = AUCTION_SOURCE_VALUES.join(",")
      q = q.or(`source.not.in.(${auctionList}),status.neq.active`)
    }

    // Ordering
    const sort = options.sortBy ?? "price_asc"
    if (sort === "price_asc") {
      q = q.order("listing_price", { ascending: true })
    } else if (sort === "price_desc") {
      q = q.order("listing_price", { ascending: false })
    } else if (sort === "year_desc") {
      q = q.order("year", { ascending: false })
    } else if (sort === "year_asc") {
      q = q.order("year", { ascending: true })
    } else if (sort === "date_desc") {
      q = q.order("sale_date", { ascending: false, nullsFirst: false })
    } else {
      q = q.order("listing_price", { ascending: true })
    }

    q = q.limit(limit)

    const { data, error } = await q

    if (error || !data) {
      console.error("[advisorListings] fetchAdvisorListings failed:", error?.message)
      return []
    }

    // Post-fetch filter: remove junk listings (tractors, kit cars, etc.)
    return (data as PricedListingRow[]).filter(
      (r) =>
        r.hammer_price != null &&
        Number(r.hammer_price) > 0 &&
        !isJunkListing({ make: r.make, model: r.model, year: r.year }),
    )
  } catch (err) {
    console.error("[advisorListings] fetchAdvisorListings error:", err)
    return []
  }
}

/**
 * Server-side count of listings matching filters.
 * Used by the count_listings tool.
 */
export async function countAdvisorListings(options: {
  make: string
  seriesId?: string | null
  variantId?: string | null
  query?: string | null
  status?: "live" | "ended" | null
}): Promise<{ count: number; ok: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return { count: 0, ok: false }

  const normalizedMake = normalizeSupportedMake(options.make)
  if (!normalizedMake) return { count: 0, ok: false }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    let q = supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .ilike("make", normalizedMake)
      .gt("listing_price", 0)

    if (options.seriesId) q = q.eq("series", options.seriesId)

    if (options.variantId) {
      const v = options.variantId.replace(/[%_]/g, "")
      q = q.or(`model.ilike.%${v}%,trim.ilike.%${v}%`)
    }

    if (options.query) {
      const escaped = options.query.replace(/[%_]/g, "")
      q = q.or(
        `model.ilike.%${escaped}%,trim.ilike.%${escaped}%,title.ilike.%${escaped}%`,
      )
    }

    if (options.status === "live") {
      q = q.eq("status", "active")
    } else if (options.status === "ended") {
      q = q.eq("status", "sold")
    }

    const { count, error } = await q

    if (error) {
      console.error("[advisorListings] countAdvisorListings failed:", error.message)
      return { count: 0, ok: false }
    }

    return { count: count ?? 0, ok: true }
  } catch (err) {
    console.error("[advisorListings] countAdvisorListings error:", err)
    return { count: 0, ok: false }
  }
}
