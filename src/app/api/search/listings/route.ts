import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { extractSeries, getSeriesConfig } from "@/lib/brandConfig"
import { buildListingSearchOrClauses, rankListingSearchRows } from "@/lib/searchIndex"
import {
  resolveListingImages,
  LISTING_IMAGE_PLACEHOLDER,
} from "@/lib/supabaseLiveListings"

export const dynamic = "force-dynamic"

interface SearchListing {
  id: string
  title: string
  year: number | null
  model: string | null
  image: string | null
  priceUsd: number | null
  platform: string
  status: "live" | "sold"
  series: string | null
}

interface SearchResponse {
  listings: SearchListing[]
  total: number
}

interface ListingRowMinimal {
  id: string
  year: number
  make: string
  model: string
  title: string | null
  status: string
  platform: string | null
  source: string
  current_bid: number | null
  hammer_price: string | number | null
  final_price: number | null
  images: string[] | null
  photos_media?: Array<{ photo_url: string | null }>
}

function cap(limit: string | null): number {
  const n = Number(limit)
  if (!Number.isFinite(n) || n <= 0) return 10
  return Math.min(25, Math.max(1, Math.floor(n)))
}

function searchCandidateLimit(limit: number, hasQuery: boolean, hasSeriesFilter: boolean): number {
  if (hasSeriesFilter) return Math.max(limit * 12, 120)
  if (hasQuery) return Math.max(limit * 40, 200)
  return Math.max(limit * 6, 60)
}

function pickPrice(row: ListingRowMinimal): number | null {
  if (row.status === "sold") {
    const hp = row.hammer_price
    if (typeof hp === "number") return hp > 0 ? hp : null
    if (typeof hp === "string") {
      const parsed = Number(hp)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null
    }
    if (row.final_price && row.final_price > 0) return row.final_price
    return null
  }
  if (row.current_bid && row.current_bid > 0) return row.current_bid
  if (row.final_price && row.final_price > 0) return row.final_price
  return null
}

function pickImage(row: ListingRowMinimal): string | null {
  const images = resolveListingImages(row.images ?? null)
  if (images.length > 0 && images[0] !== LISTING_IMAGE_PLACEHOLDER) return images[0]
  const fromJoin = row.photos_media?.find((m) => m.photo_url)?.photo_url
  return fromJoin ?? null
}

function pickStatus(value: string): "live" | "sold" {
  return value === "sold" ? "sold" : "live"
}

export async function GET(request: NextRequest): Promise<NextResponse<SearchResponse>> {
  const url = new URL(request.url)
  const q = (url.searchParams.get("q") ?? "").trim()
  const seriesFilter = (url.searchParams.get("series") ?? "").trim().toLowerCase()
  const limit = cap(url.searchParams.get("limit"))
  const trending = url.searchParams.get("trending") === "true"

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ listings: [], total: 0 })
  }

  const supabase = createSupabaseClient(supabaseUrl, supabaseKey)

  try {
    // When filtering by a specific series, scope server-side via the series' year
    // range so we don't return empty for popular series buried beyond the top N.
    // Overfetch generously — we drop rows without images below.
    const seriesConfig = seriesFilter ? getSeriesConfig(seriesFilter, "porsche") : null
    const overfetch = searchCandidateLimit(limit, Boolean(q && !trending), Boolean(seriesFilter))

    let query = supabase
      .from("listings")
      .select(
        "id, year, make, model, title, status, platform, source, current_bid, hammer_price, final_price, images",
        { count: "exact" },
      )
      .eq("make", "Porsche")
      .order("created_at", { ascending: false })
      .limit(overfetch)

    if (seriesConfig) {
      query = query.gte("year", seriesConfig.yearRange[0]).lte("year", seriesConfig.yearRange[1])
    }

    if (q && !trending) {
      for (const clause of buildListingSearchOrClauses(q)) {
        query = query.or(clause)
      }
    }

    const { data, count, error } = await query
    if (error) {
      console.error("[api/search/listings] supabase error", error.message)
      return NextResponse.json({ listings: [], total: 0 })
    }

    const rows = (data ?? []) as unknown as ListingRowMinimal[]
    const mapped: SearchListing[] = rows
      .map((row) => {
        const title =
          row.title?.trim() ||
          [row.year, row.make, row.model].filter(Boolean).join(" ")
        const series =
          extractSeries(row.model ?? "", row.year ?? 0, "Porsche", title) || null
        return {
          id: row.id.startsWith("live-") || row.id.startsWith("sold-") ? row.id : `live-${row.id}`,
          title,
          year: row.year ?? null,
          model: row.model ?? null,
          image: pickImage(row),
          priceUsd: pickPrice(row),
          platform: row.platform ?? row.source ?? "UNKNOWN",
          status: pickStatus(row.status),
          series,
        }
      })

    const filtered = seriesFilter
      ? mapped.filter((l) => l.series?.toLowerCase() === seriesFilter)
      : mapped
    const ranked = q && !trending ? rankListingSearchRows(filtered, q) : filtered

    return NextResponse.json({
      listings: ranked.slice(0, limit),
      total: count ?? filtered.length,
    })
  } catch (err) {
    console.error("[api/search/listings] failed", err instanceof Error ? err.message : err)
    return NextResponse.json({ listings: [], total: 0 })
  }
}
