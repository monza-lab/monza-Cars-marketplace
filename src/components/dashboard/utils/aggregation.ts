import { getBrandImage, getModelImage } from "@/lib/modelImages"
import { extractSeries, getSeriesConfig } from "@/lib/brandConfig"
import type { Auction, Brand, PorscheFamily } from "../types"

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
    const grades = cars.map(c => c.analysis?.investmentGrade || "B+")
    const categories = [...new Set(cars.map(c => c.category).filter(Boolean))]

    // Find best grade
    const gradeOrder = ["AAA", "AA", "A", "B+", "B", "C"]
    const topGrade = grades.sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b))[0]

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
    const grades = cars.map(c => c.analysis?.investmentGrade || "B+")
    const gradeOrder = ["AAA", "AA", "A", "B+", "B", "C"]
    const topGrade = grades.sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b))[0]

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
