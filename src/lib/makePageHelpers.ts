// ═══════════════════════════════════════════════════════════════════════════
// MakePage helpers — extracted from MakePageClient.tsx
// Pure logic: NO "use client" directive
// ═══════════════════════════════════════════════════════════════════════════

import type { CollectorCar, FairValueByRegion } from "@/lib/curatedCars"
import { extractSeries, getSeriesConfig } from "@/lib/brandConfig"
import { getModelImage } from "@/lib/modelImages"
import { toUsd, buildRegionalFairValue } from "@/lib/regionPricing"

// ─── MODEL TYPE (aggregated from cars) ───
export type Model = {
  name: string
  slug: string
  carCount: number
  priceMin: number
  priceMax: number
  avgPrice: number
  representativeImage: string
  representativeCar: CollectorCar
  liveCount: number
  years: string
  categories: string[]
}

// ─── HELPERS ───

export function timeLeft(
  endTime: Date,
  labels: { ended: string; day: string; hour: string; minute: string }
): string {
  const diff = endTime.getTime() - Date.now()
  if (diff <= 0) return labels.ended
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}${labels.day} ${hrs}${labels.hour}`
  const mins = Math.floor((diff % 3600000) / 60000)
  return `${hrs}${labels.hour} ${mins}${labels.minute}`
}

// ─── EXTRACT FAMILY FROM MODEL NAME ───
// Now delegates to centralized brandConfig.extractSeries for series-level taxonomy
export function extractFamily(modelName: string, year?: number, makeName?: string): string {
  return extractSeries(modelName, year || 0, makeName || "Porsche")
}

// ─── EXTRACT GENERATION FROM MODEL NAME ───
export function extractGenerationFromModel(modelName: string, year?: number): string | null {
  // With series-level taxonomy, the series IS the generation
  // This function is kept for backward compatibility but returns null
  // since generation drill-down is handled at the series level
  return null
}

// ─── AGGREGATE CARS INTO FAMILIES ───
export function aggregateModels(cars: CollectorCar[], make: string): Model[] {
  const familyMap = new Map<string, CollectorCar[]>()

  // Group by FAMILY (not specific model)
  cars.forEach(car => {
    const family = extractFamily(car.model, car.year, make)
    const existing = familyMap.get(family) || []
    existing.push(car)
    familyMap.set(family, existing)
  })

  // Convert to Model array
  const models: Model[] = []
  familyMap.forEach((familyCars, familyName) => {
    const prices = familyCars.map(c => c.currentBid).filter(p => p > 0)
    const years = familyCars.map(c => c.year)
    const categories = [...new Set(familyCars.map(c => c.category))]
    const liveCount = familyCars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON").length

    // Get representative car (highest value)
    const repCar = familyCars.sort((a, b) => b.currentBid - a.currentBid)[0]
    const repMake = repCar.make

    // Prefer the actual car's scraped image; fall back to static model image
    const carImage = repCar.images?.[0] || repCar.image
    const isPlaceholder = !carImage || carImage.includes("placeholder")
    const representativeImage = isPlaceholder
      ? (getModelImage(repMake, familyName) || carImage || "")
      : carImage

    // Year range
    const minYear = Math.min(...years)
    const maxYear = Math.max(...years)
    const yearStr = minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`

    models.push({
      name: familyName,
      slug: familyName.toLowerCase().replace(/\s+/g, "-"),
      carCount: familyCars.length,
      priceMin: prices.length > 0 ? Math.min(...prices) : 0,
      priceMax: prices.length > 0 ? Math.max(...prices) : 0,
      avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      representativeImage,
      representativeCar: repCar,
      liveCount,
      years: yearStr,
      categories,
    })
  })

  // Sort by brandConfig order (series display priority), fallback to avgPrice
  return models.sort((a, b) => {
    const orderA = getSeriesConfig(a.slug, make)?.order ?? 99
    const orderB = getSeriesConfig(b.slug, make)?.order ?? 99
    if (orderA !== orderB) return orderA - orderB
    return b.avgPrice - a.avgPrice
  })
}

// ─── REGIONAL PRICING HELPERS ───

export function aggregateRegionalPricing(modelCars: CollectorCar[]): FairValueByRegion | null {
  // Always derive from USD prices to ensure proper regional differentiation
  const usdPrices = modelCars
    .map(c => {
      const us = c.fairValueByRegion?.US
      if (us && us.high > 0) return (us.low + us.high) / 2
      return c.currentBid > 0 ? c.currentBid : 0
    })
    .filter(p => p > 0)
  if (usdPrices.length === 0) return null
  const avgUsd = usdPrices.reduce((sum, p) => sum + p, 0) / usdPrices.length
  return buildRegionalFairValue(avgUsd)
}

// Find the region with the lowest average USD price (= BEST value)
export function findBestRegion(pricing: FairValueByRegion): keyof FairValueByRegion {
  const regions: (keyof FairValueByRegion)[] = ["US", "EU", "UK", "JP"]
  let best: keyof FairValueByRegion = "US"
  let bestAvg = Infinity
  for (const r of regions) {
    const region = pricing[r]
    if (!region) continue
    const avg = toUsd((region.low + region.high) / 2, region.currency)
    if (avg < bestAvg) {
      bestAvg = avg
      best = r
    }
  }
  return best
}

// ─── MODEL-SPECIFIC DATA HELPERS ───
export function deriveModelDepth(modelCars: CollectorCar[]): { auctionsPerYear: number; avgDaysToSell: number; sellThroughRate: number; demandScore: number } {
  const total = modelCars.length
  const ended = modelCars.filter(c => c.status === "ENDED").length
  const avgBids = total > 0 ? modelCars.reduce((s, c) => s + c.bidCount, 0) / total : 0
  const avgTrend = total > 0 ? modelCars.reduce((s, c) => s + c.trendValue, 0) / total : 0
  return {
    auctionsPerYear: Math.max(total * 4, 10),
    avgDaysToSell: Math.max(5, Math.round(30 - avgBids * 0.5)),
    sellThroughRate: total > 0 ? Math.round((ended / total) * 100) : 75,
    demandScore: Math.min(10, Math.max(3, Math.round(avgTrend / 3 + avgBids / 10))),
  }
}
