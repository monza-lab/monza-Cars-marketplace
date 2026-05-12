import { computeMarketStatsForCar } from "@/lib/marketStats"
import { fetchPricedListingsForModel } from "@/lib/supabaseLiveListings"
import { getExchangeRates } from "@/lib/exchangeRates"
import { computeArbitrageForCar } from "@/lib/marketIntel/computeArbitrageForCar"
import { getComparablesForModel } from "@/lib/db/queries"
import type { PipelineContext } from "../pipeline"
import type { MarketDataBundle } from "../types-v3"

export async function executeMarketDataBundle(
  ctx: PipelineContext
): Promise<{ data: MarketDataBundle; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const { car } = ctx
  const make = car.make ?? "Porsche"

  const [pricedListings, exchangeRates] = await Promise.all([
    fetchPricedListingsForModel(make),
    getExchangeRates(),
  ])

  const { marketStats, pricedRecords } = computeMarketStatsForCar(
    car, pricedListings, exchangeRates
  )

  let dbComparables: any[] = []
  try {
    dbComparables = await getComparablesForModel(make, car.model ?? "")
  } catch { /* non-fatal */ }

  let arbitrage = null
  if (marketStats) {
    try {
      const thisPrice = car.askingPriceUsd ?? car.soldPriceUsd ?? car.price ?? 0
      arbitrage = await computeArbitrageForCar({
        pricedListings: pricedRecords as any,
        thisVinPriceUsd: thisPrice,
        targetRegion: "US",
        carYear: car.year ?? 0,
      })
    } catch { /* non-fatal */ }
  }

  // regions is already an array in ModelMarketStats
  const regions = (marketStats?.regions ?? []).map((r: any) => ({
    region: r.region ?? "",
    median: r.medianPriceUsd ?? r.medianPrice ?? 0,
    count: r.totalListings ?? 0,
    currency: r.currency ?? "USD",
  }))

  const trendPercent12m = marketStats?.regions?.[0]?.trendPercent ?? null
  const trendDir = marketStats?.regions?.[0]?.trendDirection ?? "insufficient_data"
  const trendDirection = (["up", "down", "flat"].includes(trendDir) ? trendDir : "insufficient_data") as MarketDataBundle["trendDirection"]

  const totalDataPoints = (marketStats?.totalDataPoints ?? 0) + dbComparables.length
  const regionsWithData = regions.filter((r: any) => r.count > 0).map((r: any) => r.region)

  // Derive date range from pricedRecords
  const dates = (pricedRecords ?? [])
    .map((r: any) => r.saleDate ?? r.sale_date)
    .filter(Boolean)
    .sort()

  const bundle: MarketDataBundle = {
    marketStats: marketStats ?? ({} as any),
    regions,
    dbComparables,
    comparablesCount: dbComparables.length,
    arbitrage,
    similarCars: [],
    trendPercent12m,
    trendDirection,
    totalDataPoints,
    oldestDataPoint: dates[0] ?? null,
    newestDataPoint: dates[dates.length - 1] ?? null,
    regionsWithData,
  }

  return { data: bundle, durationMs: Date.now() - t0, agentModel: null }
}
