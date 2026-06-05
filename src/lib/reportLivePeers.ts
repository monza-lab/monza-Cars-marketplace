import type { CollectorCar } from "./curatedCars"
import { dbQuery } from "./db/sql"
import { getExchangeRates } from "./exchangeRates"
import { buildReportPeerIdentity } from "./reportPeerIdentity"
import { isJunkListing, rowToCollectorCar } from "./supabaseLiveListings"

type ReportLivePeerTarget = Pick<CollectorCar, "id" | "make" | "model"> &
  Partial<Pick<CollectorCar, "currentBid" | "price">>

type ReportLivePeerRow = {
  id: string
  year: number
  make: string
  model: string
  trim: string | null
  source: string
  source_url: string
  status: string
  sale_date: string | null
  country: string | null
  region: string | null
  city: string | null
  hammer_price: string | number | null
  original_currency: string | null
  mileage: number | null
  mileage_unit: string | null
  vin: string | null
  color_exterior: string | null
  color_interior: string | null
  description_text: string | null
  body_style: string | null
  title: string | null
  platform: string | null
  current_bid: number | null
  bid_count: number | null
  reserve_status: string | null
  seller_notes: string | null
  images: string[] | null
  engine: string | null
  transmission: string | null
  end_time: string | null
  start_time: string | null
  final_price: number | null
  location: string | null
}

function stripLivePrefix(id: string): string {
  return id.startsWith("live-") ? id.slice("live-".length) : id
}

export async function fetchStrictLiveReportPeerCandidates(
  target: ReportLivePeerTarget,
  limit = 80,
): Promise<CollectorCar[]> {
  const identity = buildReportPeerIdentity({ make: target.make, model: target.model })
  if (!identity) return []

  const targetPrice = target.currentBid || target.price || 0
  const safeLimit = Math.max(1, Math.min(limit, 200))

  try {
    const rows = await dbQuery<ReportLivePeerRow>(
      `
        WITH strict_live_peers AS (
          SELECT
            l.id,
            l.year,
            l.make,
            l.model,
            l.trim,
            l.source,
            l.source_url,
            l.status::text AS status,
            l.sale_date::text AS sale_date,
            l.country,
            l.region,
            l.city,
            l.hammer_price,
            l.original_currency::text AS original_currency,
            l.mileage,
            l.mileage_unit::text AS mileage_unit,
            l.vin,
            l.color_exterior,
            l.color_interior,
            l.description_text,
            l.body_style,
            l.title,
            l.platform,
            l.current_bid,
            l.bid_count,
            l.reserve_status,
            l.seller_notes,
            l.images,
            l.engine,
            l.transmission,
            l.end_time::text AS end_time,
            l.start_time::text AS start_time,
            l.final_price,
            l.location,
            COALESCE(
              l.current_bid,
              l.final_price,
              l.hammer_price::double precision,
              l.price_usd::double precision,
              l.listing_price::double precision
            ) AS "peerPrice"
          FROM listings l
          WHERE l.status::text = 'active'
            AND l.id <> $3
            AND btrim(regexp_replace(lower(regexp_replace(regexp_replace(l.make, '[.,;:()[\\]{}''"\`]', ' ', 'g'), '[-_/]+', ' ', 'g')), '\\s+', ' ', 'g')) = $1
            AND btrim(regexp_replace(lower(regexp_replace(regexp_replace(l.model, '[.,;:()[\\]{}''"\`]', ' ', 'g'), '[-_/]+', ' ', 'g')), '\\s+', ' ', 'g')) = $2
        )
        SELECT
          id, year, make, model, trim, source, source_url, status, sale_date,
          country, region, city, hammer_price, original_currency, mileage,
          mileage_unit, vin, color_exterior, color_interior, description_text,
          body_style, title, platform, current_bid, bid_count, reserve_status,
          seller_notes, images, engine, transmission, end_time, start_time,
          final_price, location
        FROM strict_live_peers
        WHERE "peerPrice" > 0
        ORDER BY ABS("peerPrice" - $4) ASC, id DESC
        LIMIT $5
      `,
      [identity.make, identity.modelIdentity, stripLivePrefix(target.id), targetPrice, safeLimit],
    )

    const rates = await getExchangeRates().catch(() => ({} as Record<string, number>))
    return rows.rows
      .filter((row) => !isJunkListing(row))
      .map((row) => rowToCollectorCar(row, rates))
  } catch (err) {
    console.warn(
      "[reportLivePeers] fetchStrictLiveReportPeerCandidates failed:",
      err instanceof Error ? err.message : err,
    )
    return []
  }
}
