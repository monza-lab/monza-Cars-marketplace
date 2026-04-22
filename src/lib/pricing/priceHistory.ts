import { createClient } from "@supabase/supabase-js"
import { fetchFerrariHistoricalByListingId } from "@/features/scrapers/ferrari_history/service"
import { isSupportedLiveMake } from "@/lib/makeProfiles"

export interface PricePoint {
  id: string
  bid: number
  timestamp: string
  status: string | null
}

/**
 * Fetch a listing's bid/price time series.
 *
 * Accepts either a bare Supabase listing id or a "live-<id>" / "ferrari-<id>" id.
 * Returns an empty array on error or unsupported-make — callers treat empty as
 * "no history available" rather than a failure.
 */
export async function getPriceHistory(listingId: string, requestId?: string): Promise<PricePoint[]> {
  const bareId = listingId.startsWith("live-") ? listingId.slice(5) : listingId
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return []

  try {
    const ferrariHistory = await fetchFerrariHistoricalByListingId(listingId, {
      requestId: requestId ?? "price-history-helper",
    })
    if (ferrariHistory.isFerrariContext) {
      return ferrariHistory.priceHistory as PricePoint[]
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: listingRow, error: listingError } = await supabase
      .from("listings")
      .select("make")
      .eq("id", bareId)
      .single()

    if (listingError || !listingRow || !isSupportedLiveMake(listingRow.make)) {
      return []
    }

    const { data, error } = await supabase
      .from("price_history")
      .select("time,status,price_usd,price_eur,price_gbp")
      .eq("listing_id", bareId)
      .order("time", { ascending: true })
      .limit(500)

    if (error) {
      console.error("[priceHistory] Query error:", error.message)
      return []
    }

    return (data ?? []).map(
      (
        row: {
          time: string
          status: string | null
          price_usd: number | null
          price_eur: number | null
          price_gbp: number | null
        },
        idx: number,
      ) => ({
        id: `ph-${idx}`,
        bid: row.price_usd ?? row.price_eur ?? row.price_gbp ?? 0,
        timestamp: row.time,
        status: row.status,
      }),
    )
  } catch (err) {
    console.error("[priceHistory] Error:", err)
    return []
  }
}
