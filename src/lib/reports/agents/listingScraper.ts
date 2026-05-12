import type { CollectorCar } from "@/lib/curatedCars"
import type { PipelineContext } from "../pipeline"
import type { ScrapedListingFull } from "../types-v3"
import { getListingType } from "@/lib/listingMode"

export function buildFallbackFromCar(car: CollectorCar): ScrapedListingFull {
  const listingType = getListingType(car.platform)
  const images = car.images ?? []

  return {
    title: car.title ?? `${car.year ?? ""} ${car.make ?? ""} ${car.model ?? ""}`.trim(),
    year: car.year ?? null,
    make: car.make ?? "Unknown",
    model: car.model ?? "",
    trim: car.trim ?? null,
    vin: car.vin ?? null,
    engine: null,
    transmission: car.transmission ?? null,
    drivetrain: null,
    horsepower: null,
    torque: null,
    weight: null,
    bodyStyle: null,
    seats: null,
    mileage: car.mileage ?? null,
    mileageUnit: (car.mileageUnit as "mi" | "km") ?? "mi",
    exteriorColor: car.exteriorColor ?? null,
    interiorColor: car.interiorColor ?? null,
    location: car.location ?? null,
    descriptionFull: car.description ?? "",
    sellerNotes: car.sellerNotes ?? null,
    auctionComments: null,
    lotEssay: null,
    equipmentList: [],
    modifications: [],
    photoUrls: images,
    photoCount: images.length,
    currentBid: listingType === "auction" ? (car.currentBid ?? car.price ?? null) : null,
    bidCount: car.bidCount ?? null,
    reserveStatus: "unknown",
    auctionEndTime: car.endTime ? new Date(car.endTime).toISOString() : null,
    askingPrice: listingType === "classified" ? (car.askingPriceUsd ?? car.price ?? null) : null,
    daysOnMarket: null,
    priceDrops: null,
    sellerName: null,
    sellerType: null,
    sellerLocation: null,
    scrapedAt: new Date().toISOString(),
    scrapeSuccessful: false,
    scrapePartial: true,
    sourceUrl: car.sourceUrl ?? "",
    platform: car.platform ?? "UNKNOWN",
  }
}

export async function executeListingScraper(
  ctx: PipelineContext
): Promise<{ data: ScrapedListingFull; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const { car } = ctx
  const fallback = buildFallbackFromCar(car)
  console.log(`[listingScraper] Using DB fallback for ${car.id} (live scrape not yet implemented)`)
  return { data: fallback, durationMs: Date.now() - t0, agentModel: null }
}
