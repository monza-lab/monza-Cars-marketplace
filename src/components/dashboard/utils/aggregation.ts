import { getBrandImage, getModelImage } from "@/lib/modelImages"
import { extractSeries, getSeriesConfig } from "@/lib/brandConfig"
import { isListingPlatform } from "../platformMapping"
import type { Auction, Brand, PorscheFamily } from "../types"

export type SourceImageCompleteness = {
  source: string
  total: number
  withImages: number
  missingImages: number
  percentage: number
}

// Upgrade low-res scraped image URLs to high-resolution variants
function upgradeImageUrl(url: string): string {
  if (url.includes("autoscout24.net")) {
    return url.replace(/\/\d+x\d+\.webp$/, "/1280x960.webp")
  }
  return url
}

export function aggregateSourceImageCompleteness(
  rows: Array<{ source: string | null | undefined; images?: unknown[] | null }>
): SourceImageCompleteness[] {
  const bySource = new Map<string, { total: number; withImages: number }>()

  for (const row of rows) {
    const source = row.source || "Unknown"
    const bucket = bySource.get(source) || { total: 0, withImages: 0 }
    bucket.total += 1
    if (Array.isArray(row.images) && row.images.length > 0) {
      bucket.withImages += 1
    }
    bySource.set(source, bucket)
  }

  return [...bySource.entries()]
    .map(([source, bucket]) => {
      const missingImages = Math.max(0, bucket.total - bucket.withImages)
      return {
        source,
        total: bucket.total,
        withImages: bucket.withImages,
        missingImages,
        percentage: bucket.total > 0 ? Math.round((bucket.withImages / bucket.total) * 1000) / 10 : 0,
      }
    })
    .sort((a, b) => a.source.localeCompare(b.source))
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
      avgTrend: count >= 100 ? "Premium Demand" : count >= 50 ? "Strong Demand" : count >= 20 ? "High Demand" : "Growing Demand",
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

    const bestCar = cars.reduce((max, car) => car.currentBid > max.currentBid ? car : max, cars[0])
    // Pick the best real DB image for this family:
    // 1. Prefer images from trusted listing/dealer platforms (verified photos)
    // 2. Fall back to any car with images, sorted by price
    // 3. Last resort: curated static image for the series
    const carsWithImages = cars
      .filter(c => c.images?.length > 0 && c.make === "Porsche")
      .sort((a, b) => {
        const aListing = isListingPlatform(a.platform) ? 0 : 1
        const bListing = isListingPlatform(b.platform) ? 0 : 1
        if (aListing !== bListing) return aListing - bListing
        return b.currentBid - a.currentBid
      })
    const rawHeroImage = carsWithImages[0]?.images?.[0]
    const heroImage = rawHeroImage ? upgradeImageUrl(rawHeroImage) : null
    const brandFallback = getModelImage("Porsche", familyKey) || getBrandImage("Porsche") || ""

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
      representativeImage: heroImage || brandFallback,
      fallbackImage: brandFallback,
      representativeCar: `${bestCar.year} Porsche ${bestCar.model}`,
    })
  })

  return families.sort((a, b) => {
    const orderA = getFamilyPrestigeOrder(a.slug)
    const orderB = getFamilyPrestigeOrder(b.slug)
    if (orderA !== orderB) return orderA - orderB
    return b.carCount - a.carCount
  })
}
