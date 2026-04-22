import type { ToolDef } from "@/lib/advisor/tools/registry"
import {
  fetchPricedListingsForModel,
  fetchLiveListingById,
  type PricedListingRow,
} from "@/lib/supabaseLiveListings"
import { CURATED_CARS, type CollectorCar } from "@/lib/curatedCars"
import { computeMarketStatsForCar } from "@/lib/marketStats"
import { extractSeries, getSeriesConfig } from "@/lib/brandConfig"
import { getPriceHistory } from "@/lib/pricing/priceHistory"

// ─── helpers ───

function truncate(s: string, max = 500): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + "…"
}

function formatPrice(n: number | null | undefined, currency: string = "USD"): string {
  if (n == null || !Number.isFinite(n)) return "—"
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "JPY" ? "¥" : "$"
  return `${symbol}${Math.round(n).toLocaleString("en-US")}`
}

function rowToSearchResult(r: PricedListingRow) {
  return {
    id: `live-${r.id}`,
    year: r.year,
    make: r.make,
    model: r.model,
    trim: r.trim ?? null,
    currentBid: Math.round(Number(r.hammer_price) || 0),
    currency: r.original_currency ?? "USD",
    mileage: r.mileage,
    status: r.status,
    source: r.source,
    country: r.country,
  }
}

// ─── tool 1: search_listings ───

export const searchListings: ToolDef = {
  name: "search_listings",
  description:
    "Search live + curated listings by series, variant, year, price, and region. Returns a ranked list of matches with top picks in the summary.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text keyword (e.g. '997.2 GT3')." },
      seriesId: { type: "string", description: "Series id like '997', '992', 'cayenne'." },
      variantId: { type: "string", description: "Variant id (GT3, Turbo, Carrera, etc.)." },
      make: { type: "string", description: "Make, defaults to 'Porsche'." },
      yearFrom: { type: "number" },
      yearTo: { type: "number" },
      priceFromUsd: { type: "number" },
      priceToUsd: { type: "number" },
      region: { type: "string", enum: ["US", "EU", "UK", "JP"] },
      status: { type: "string", enum: ["live", "ended"] },
      limit: { type: "number", description: "Max results, default 10." },
    },
  },
  async handler(args) {
    const query = typeof args.query === "string" ? args.query.trim() : ""
    const seriesId = typeof args.seriesId === "string" ? args.seriesId : null
    const variantId = typeof args.variantId === "string" ? args.variantId.toLowerCase() : null
    const make = typeof args.make === "string" && args.make ? args.make : "Porsche"
    const yearFrom = typeof args.yearFrom === "number" ? args.yearFrom : null
    const yearTo = typeof args.yearTo === "number" ? args.yearTo : null
    const priceFromUsd = typeof args.priceFromUsd === "number" ? args.priceFromUsd : null
    const priceToUsd = typeof args.priceToUsd === "number" ? args.priceToUsd : null
    const status = typeof args.status === "string" ? args.status : null
    const limit = typeof args.limit === "number" && args.limit > 0 ? Math.min(50, args.limit) : 10

    let rows: PricedListingRow[]
    try {
      rows = await fetchPricedListingsForModel(make, 500)
    } catch (err) {
      return { ok: false, error: `listings_fetch_failed:${err instanceof Error ? err.message : "unknown"}` }
    }

    let filtered = rows
    if (seriesId) {
      filtered = filtered.filter((r) => extractSeries(r.model, r.year, r.make) === seriesId)
    }
    if (variantId) {
      filtered = filtered.filter((r) => {
        const hay = `${r.model} ${r.trim ?? ""}`.toLowerCase()
        return hay.includes(variantId)
      })
    }
    if (query) {
      const q = query.toLowerCase()
      filtered = filtered.filter((r) => {
        const hay = `${r.year} ${r.make} ${r.model} ${r.trim ?? ""}`.toLowerCase()
        return q.split(/\s+/).every((token) => hay.includes(token))
      })
    }
    if (yearFrom != null) filtered = filtered.filter((r) => r.year >= yearFrom)
    if (yearTo != null) filtered = filtered.filter((r) => r.year <= yearTo)
    if (priceFromUsd != null) filtered = filtered.filter((r) => Number(r.hammer_price) >= priceFromUsd)
    if (priceToUsd != null) filtered = filtered.filter((r) => Number(r.hammer_price) <= priceToUsd)
    if (status === "live") filtered = filtered.filter((r) => r.status && r.status !== "sold" && r.status !== "ended")
    if (status === "ended") filtered = filtered.filter((r) => r.status === "sold" || r.status === "ended")

    // Also fold in curated cars (currently empty but future-proof).
    const curated: CollectorCar[] = CURATED_CARS.filter((c) => c.make.toLowerCase() === make.toLowerCase())
      .filter((c) => (seriesId ? extractSeries(c.model, c.year, c.make) === seriesId : true))
      .filter((c) => (query ? `${c.title}`.toLowerCase().includes(query.toLowerCase()) : true))

    const liveResults = filtered.slice(0, limit).map(rowToSearchResult)
    const curatedResults = curated.slice(0, Math.max(0, limit - liveResults.length)).map((c) => ({
      id: c.id,
      year: c.year,
      make: c.make,
      model: c.model,
      trim: c.trim,
      currentBid: c.currentBid,
      currency: "USD",
      mileage: c.mileage,
      status: c.status,
      source: c.platform,
      country: c.location,
    }))
    const results = [...liveResults, ...curatedResults]

    const top3 = results.slice(0, 3).map((r) => {
      const title = `${r.year} ${r.make} ${r.model}${r.trim ? ` ${r.trim}` : ""}`
      return `${title} @ ${formatPrice(r.currentBid, r.currency)}`
    })

    const criteria =
      [seriesId && `series=${seriesId}`, variantId && `variant=${variantId}`, query && `"${query}"`]
        .filter(Boolean)
        .join(", ") || "any"
    const summary = truncate(
      `Found ${results.length} match${results.length === 1 ? "" : "es"} for ${criteria}; top 3: ${top3.join("; ") || "none"}`,
    )

    return { ok: true, data: { results, total: results.length }, summary }
  },
}

// ─── tool 2: get_listing ───

export const getListing: ToolDef = {
  name: "get_listing",
  description: "Fetch full detail of one listing by id.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Listing id (e.g. 'live-<uuid>')." },
    },
    required: ["id"],
  },
  async handler(args) {
    const id = typeof args.id === "string" ? args.id : ""
    if (!id) return { ok: false, error: "missing_arg:id" }
    const car = await fetchLiveListingById(id)
    if (!car) return { ok: false, error: "not_found" }
    const title = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`
    const summary = truncate(
      `${title} at ${formatPrice(car.currentBid, "USD")}, ${car.mileage.toLocaleString("en-US")} ${car.mileageUnit}, ${car.location}`,
    )
    return { ok: true, data: car, summary }
  },
}

// ─── tool 3: get_comparable_sales ───

export const getComparableSales: ToolDef = {
  name: "get_comparable_sales",
  description: "Return sold comps + regional market stats for a series/variant over the last N months.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      seriesId: { type: "string" },
      variantId: { type: "string" },
      make: { type: "string" },
      monthsBack: { type: "number", description: "Lookback window in months; default 12." },
    },
    required: ["seriesId"],
  },
  async handler(args) {
    const seriesId = typeof args.seriesId === "string" ? args.seriesId : ""
    if (!seriesId) return { ok: false, error: "missing_arg:seriesId" }
    const variantId = typeof args.variantId === "string" ? args.variantId.toLowerCase() : null
    const make = typeof args.make === "string" && args.make ? args.make : "Porsche"
    const monthsBack = typeof args.monthsBack === "number" && args.monthsBack > 0 ? args.monthsBack : 12

    const config = getSeriesConfig(seriesId, make)
    if (!config) return { ok: false, error: `unknown_series:${seriesId}` }

    let rows: PricedListingRow[]
    try {
      rows = await fetchPricedListingsForModel(make, 500)
    } catch (err) {
      return { ok: false, error: `listings_fetch_failed:${err instanceof Error ? err.message : "unknown"}` }
    }

    // Filter to series
    const seriesRows = rows.filter((r) => extractSeries(r.model, r.year, r.make) === seriesId)
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - monthsBack)
    const cutoffIso = cutoff.toISOString().slice(0, 10)
    const recent = seriesRows.filter((r) => !r.sale_date || r.sale_date >= cutoffIso)
    const matched = variantId
      ? recent.filter((r) => `${r.model} ${r.trim ?? ""}`.toLowerCase().includes(variantId))
      : recent

    if (matched.length === 0) {
      return { ok: false, error: "no_comps_found" }
    }

    const representative = matched[0]
    const { marketStats, pricedRecords } = computeMarketStatsForCar(
      { make: representative.make, model: representative.model, year: representative.year },
      matched,
    )

    const prices = pricedRecords.map((p) => p.hammerPrice).sort((a, b) => a - b)
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0
    const low = prices[0] ?? 0
    const high = prices[prices.length - 1] ?? 0

    const summary = truncate(
      `${matched.length} comps in last ${monthsBack} months, median ${formatPrice(median)}, range ${formatPrice(low)}-${formatPrice(high)}`,
    )

    return {
      ok: true,
      data: {
        comps: pricedRecords,
        marketStats,
        count: matched.length,
      },
      summary,
    }
  },
}

// ─── tool 4: get_price_history ───

export const getPriceHistoryTool: ToolDef = {
  name: "get_price_history",
  description: "Return the bid/price time series for a listing.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      listingId: { type: "string" },
    },
    required: ["listingId"],
  },
  async handler(args) {
    const listingId = typeof args.listingId === "string" ? args.listingId : ""
    if (!listingId) return { ok: false, error: "missing_arg:listingId" }
    const points = await getPriceHistory(listingId)
    if (points.length === 0) {
      return { ok: true, data: { points: [] }, summary: "No price history available for this listing" }
    }
    const first = points[0]
    const last = points[points.length - 1]
    const summary = truncate(
      `${points.length} price points from ${first.timestamp} to ${last.timestamp}; current ${formatPrice(last.bid)}`,
    )
    return { ok: true, data: { points }, summary }
  },
}

// ─── tool 5: get_regional_valuation ───

export const getRegionalValuation: ToolDef = {
  name: "get_regional_valuation",
  description: "Fair-value bands across US/EU/UK/JP for a series (or series+variant), sourced from regional market stats.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      seriesId: { type: "string" },
      variantId: { type: "string" },
      make: { type: "string" },
      year: { type: "number" },
      mileage: { type: "number" },
    },
    required: ["seriesId"],
  },
  async handler(args) {
    const seriesId = typeof args.seriesId === "string" ? args.seriesId : ""
    if (!seriesId) return { ok: false, error: "missing_arg:seriesId" }
    const variantId = typeof args.variantId === "string" ? args.variantId.toLowerCase() : null
    const make = typeof args.make === "string" && args.make ? args.make : "Porsche"

    let rows: PricedListingRow[]
    try {
      rows = await fetchPricedListingsForModel(make, 500)
    } catch (err) {
      return { ok: false, error: `listings_fetch_failed:${err instanceof Error ? err.message : "unknown"}` }
    }

    const seriesRows = rows.filter((r) => extractSeries(r.model, r.year, r.make) === seriesId)
    const matched = variantId
      ? seriesRows.filter((r) => `${r.model} ${r.trim ?? ""}`.toLowerCase().includes(variantId))
      : seriesRows

    if (matched.length === 0) {
      return { ok: false, error: "no_data_for_series" }
    }

    const rep = matched[0]
    const { marketStats } = computeMarketStatsForCar(
      { make: rep.make, model: rep.model, year: rep.year },
      matched,
    )

    if (!marketStats) {
      return { ok: false, error: "no_regional_stats" }
    }

    const byRegion: Record<string, { low: number; high: number; median: number; currency: string; samples: number } | null> = {
      US: null,
      EU: null,
      UK: null,
      JP: null,
    }
    for (const r of marketStats.regions) {
      byRegion[r.region] = {
        low: r.p25Price,
        high: r.p75Price,
        median: r.medianPrice,
        currency: r.currency,
        samples: r.totalListings,
      }
    }

    const fmt = (region: string, sym: string) => {
      const v = byRegion[region]
      return v ? `${region} ${sym}${v.low.toLocaleString("en-US")}-${sym}${v.high.toLocaleString("en-US")}` : `${region} —`
    }
    const summary = truncate(
      [fmt("US", "$"), fmt("EU", "€"), fmt("UK", "£"), fmt("JP", "¥")].join(" · "),
    )

    return {
      ok: true,
      data: { seriesId, variantId, byRegion, primaryRegion: marketStats.primaryRegion },
      summary,
    }
  },
}

// ─── tool 6: compute_price_position ───

export const computePricePosition: ToolDef = {
  name: "compute_price_position",
  description: "Compute where a listing's current bid sits within the fair-value band for its region (percentile).",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      listingId: { type: "string" },
    },
    required: ["listingId"],
  },
  async handler(args, ctx) {
    const listingId = typeof args.listingId === "string" ? args.listingId : ""
    if (!listingId) return { ok: false, error: "missing_arg:listingId" }

    const car = await fetchLiveListingById(listingId)
    if (!car) return { ok: false, error: "not_found" }

    const seriesId = extractSeries(car.model, car.year, car.make)
    // Reuse regional valuation tool logic via its handler.
    const val = await getRegionalValuation.handler(
      { seriesId, make: car.make },
      ctx,
    )
    if (!val.ok) return val

    const data = val.data as {
      byRegion: Record<string, { low: number; high: number; median: number; currency: string; samples: number } | null>
    }
    const region = car.region ?? "US"
    const band = data.byRegion[region] ?? data.byRegion.US
    if (!band) return { ok: false, error: "no_band_for_region" }

    const bid = Number(car.currentBid) || 0
    const span = band.high - band.low
    const pct = span > 0 ? Math.round(((bid - band.low) / span) * 100) : 50

    const title = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`
    const summary = truncate(
      `${title}: current bid ${formatPrice(bid)} sits at ${pct}th percentile of ${region} fair-value band (${formatPrice(band.low, band.currency)}–${formatPrice(band.high, band.currency)}).`,
    )

    return {
      ok: true,
      data: {
        listingId,
        region,
        currentBid: bid,
        band,
        percentile: pct,
      },
      summary,
    }
  },
}

// ─── export collection ───

export const marketplaceTools: ToolDef[] = [
  searchListings,
  getListing,
  getComparableSales,
  getPriceHistoryTool,
  getRegionalValuation,
  computePricePosition,
]
