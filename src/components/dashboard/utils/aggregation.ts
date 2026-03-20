import { getBrandImage, getModelImage } from "@/lib/modelImages"
import { extractSeries, getSeriesConfig } from "@/lib/brandConfig"
import type { Auction, Brand, PorscheFamily } from "../types"

// ─── WEIGHTED GRADE CALCULATION ───
const GRADE_SCORE: Record<string, number> = { AAA: 6, AA: 5, A: 4, "B+": 3, B: 2, C: 1 }

function computeWeightedGrade(cars: Auction[], totalDbCount?: number): string {
  const graded = cars.filter(c => c.analysis?.investmentGrade)
  if (graded.length === 0) return "B+"

  // Factor 1: Grade distribution (40%) — average of individual grades
  const gradeAvg = graded.reduce((sum, c) => {
    return sum + (GRADE_SCORE[c.analysis!.investmentGrade!] ?? 3)
  }, 0) / graded.length

  // Factor 2: Market volume (25%) — more listings = more liquidity
  const count = totalDbCount ?? cars.length
  const volumeScore = count >= 100 ? 6 : count >= 50 ? 5 : count >= 20 ? 4 : count >= 10 ? 3 : count >= 5 ? 2 : 1

  // Factor 3: Demand (20%) — bid + watch activity
  const demandValues = cars.map(c => (c.bidCount || 0) + (c.watchCount || 0))
  const avgDemand = demandValues.length > 0 ? demandValues.reduce((a, b) => a + b, 0) / demandValues.length : 0
  const demandScore = avgDemand >= 30 ? 6 : avgDemand >= 15 ? 5 : avgDemand >= 8 ? 4 : avgDemand >= 3 ? 3 : avgDemand >= 1 ? 2 : 1

  // Factor 4: Price range depth (15%) — wider range = deeper market
  const prices = cars.map(c => c.currentBid).filter(p => p > 0)
  let rangeScore = 1
  if (prices.length >= 2) {
    const spread = Math.max(...prices) / Math.min(...prices)
    rangeScore = spread >= 5 ? 6 : spread >= 3 ? 5 : spread >= 2 ? 4 : spread >= 1.5 ? 3 : 2
  }

  const finalScore = gradeAvg * 0.4 + volumeScore * 0.25 + demandScore * 0.2 + rangeScore * 0.15

  if (finalScore >= 5.0) return "AAA"
  if (finalScore >= 4.0) return "AA"
  if (finalScore >= 3.0) return "A"
  if (finalScore >= 2.0) return "B+"
  return "B"
}

// ─── AGGREGATE AUCTIONS BY BRAND ───
export function aggregateBrands(auctions: Auction[], dbTotalOverride?: number): Brand[] {
  const brandMap = new Map<string, Auction[]>()

  // Group by make
  auctions
    .filter(a => a.status === "ACTIVE" || a.status === "ENDING_SOON")
    .forEach(auction => {
      const existing = brandMap.get(auction.make) || []
      existing.push(auction)
      brandMap.set(auction.make, existing)
    })

  // Convert to Brand array with stats
  const brands: Brand[] = []
  brandMap.forEach((cars, name) => {
    const prices = cars.map(c => c.currentBid)
    const categories = [...new Set(cars.map(c => c.category).filter(Boolean))]

    // Weighted grade: combines grade distribution, volume, demand, and price depth
    const topGrade = computeWeightedGrade(cars, dbTotalOverride)

    // Get the MOST EXPENSIVE car for the representative image
    const mostExpensiveCar = cars.reduce((max, car) =>
      car.currentBid > max.currentBid ? car : max
    , cars[0])

    // Use the actual car's image from database, fall back to static brand image only if needed
    const carImage = mostExpensiveCar.images?.[0]
    const verifiedBrandImage = getBrandImage(name)
    const representativeImage = carImage || verifiedBrandImage || "/cars/placeholder.svg"

    // Use DB aggregate count when available and there's a single brand (e.g. Porsche-only dashboard).
    // This shows the true DB total instead of the capped fetched sample.
    const count = (dbTotalOverride && brandMap.size === 1) ? dbTotalOverride : cars.length

    brands.push({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      carCount: count,
      priceMin: Math.min(...prices),
      priceMax: Math.max(...prices),
      avgTrend: topGrade === "AAA" ? "Premium Demand" : topGrade === "AA" ? "Strong Demand" : topGrade === "A" ? "High Demand" : "Growing Demand",
      topGrade,
      representativeImage,
      representativeCar: `${mostExpensiveCar.year} ${mostExpensiveCar.make} ${mostExpensiveCar.model}`,
      categories: categories as string[],
    })
  })

  // Sort: Ferrari first (live data showcase), then by max price descending
  return brands.sort((a, b) => {
    if (a.name === "Ferrari" && b.name !== "Ferrari") return -1
    if (b.name === "Ferrari" && a.name !== "Ferrari") return 1
    return b.priceMax - a.priceMax
  })
}

// ─── AGGREGATE AUCTIONS BY PORSCHE FAMILY (for family-based landing) ───
function getFamilyPrestigeOrder(familyKey: string): number {
  const config = getSeriesConfig(familyKey.toLowerCase(), "Porsche")
  return config?.order ?? 99
}

function getFamilyDisplayName(familyKey: string): string {
  const config = getSeriesConfig(familyKey.toLowerCase(), "Porsche")
  return config?.label || familyKey
}

export function aggregateFamilies(auctions: Auction[], dbSeriesCounts?: Record<string, number>): PorscheFamily[] {
  const familyMap = new Map<string, Auction[]>()

  auctions
    .filter(a => a.status === "ACTIVE" || a.status === "ENDING_SOON")
    .forEach(auction => {
    const family = extractSeries(auction.model, auction.year, auction.make || "Porsche", auction.title)
    // Skip models that don't match any known Porsche series in brandConfig
    if (!getSeriesConfig(family, auction.make || "Porsche")) return
    const existing = familyMap.get(family) || []
    existing.push(auction)
    familyMap.set(family, existing)
  })

  const families: PorscheFamily[] = []
  familyMap.forEach((cars, familyKey) => {
    const prices = cars.map(c => c.currentBid).filter(p => p > 0)
    const years = cars.map(c => c.year)

    // Weighted grade: combines grade distribution, volume, demand, and price depth
    const dbCount = dbSeriesCounts?.[familyKey]
    const topGrade = computeWeightedGrade(cars, dbCount)

    const bestCar = cars.reduce((max, car) => car.currentBid > max.currentBid ? car : max, cars[0])
    const carImage = bestCar.images?.[0]
    const modelImage = getModelImage("Porsche", bestCar.model)
    // Static fallback keyed by series ID — guaranteed to resolve for all Porsche series
    const staticFallback = getModelImage("Porsche", familyKey) || getBrandImage("Porsche") || ""

    // Use exact DB series count if available, otherwise fall back to sample count
    const carCount = dbSeriesCounts?.[familyKey] ?? cars.length

    families.push({
      name: getFamilyDisplayName(familyKey),
      slug: familyKey.toLowerCase(),
      carCount,
      priceMin: prices.length > 0 ? Math.min(...prices) : 0,
      priceMax: prices.length > 0 ? Math.max(...prices) : 0,
      yearMin: Math.min(...years),
      yearMax: Math.max(...years),
      representativeImage: carImage || modelImage || staticFallback,
      fallbackImage: staticFallback,
      representativeCar: `${bestCar.year} Porsche ${bestCar.model}`,
      topGrade,
    })
  })

  return families.sort((a, b) => {
    const orderA = getFamilyPrestigeOrder(a.slug)
    const orderB = getFamilyPrestigeOrder(b.slug)
    if (orderA !== orderB) return orderA - orderB
    return b.carCount - a.carCount
  })
}
