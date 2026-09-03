import { hasScrapedChrome } from "./listingDescription"
import { stripHtml } from "./stripHtml"

export type RegionalBands = object

/**
 * The seller's own words, or null. Scraped page furniture is stripped upstream
 * (src/lib/listingDescription.ts); this is the last gate, so a listing whose
 * description was only the source platform's own page hides the section instead
 * of publishing a competitor's navigation and pricing table.
 */
export function sellerDescriptionText(
  car: { history?: string | null; description?: string | null },
): string | null {
  const text = stripHtml(car.history ?? car.description ?? "").trim()
  if (!text) return null
  return hasScrapedChrome(text) ? null : text
}

function validBand(band: { low: number; high: number } | undefined) {
  return Boolean(band && Number.isFinite(band.low) && Number.isFinite(band.high) && band.low > 0 && band.high >= band.low)
}

export function hasRegionalPricing(pricing: RegionalBands): boolean {
  return (Object.values(pricing) as Array<{ low: number; high: number }>).some(validBand)
}

export function findBestPricedRegion(pricing: RegionalBands): string | null {
  let best: string | null = null
  let bestAverage = Number.POSITIVE_INFINITY
  for (const [region, band] of Object.entries(pricing) as Array<[string, { low: number; high: number }]>) {
    if (!validBand(band)) continue
    const average = (band.low + band.high) / 2
    if (average < bestAverage) {
      best = region
      bestAverage = average
    }
  }
  return best
}

export function formatDetailMileage(
  mileage: number | null | undefined,
  unit: string | null | undefined,
  locale: string,
): string {
  if (typeof mileage !== "number" || !Number.isFinite(mileage) || mileage <= 0) return "—"
  return `${mileage.toLocaleString(locale)}${unit ? ` ${unit}` : ""}`
}

export function hasMeaningfulTrend(
  trend: string | null | undefined,
  trendValue: number | null | undefined,
): boolean {
  return Boolean(trend && typeof trendValue === "number" && Number.isFinite(trendValue) && trendValue !== 0)
}

export function navigateBackOrBrowse(
  router: { back: () => void; push: (href: string) => void },
  historyLength: number,
) {
  if (historyLength > 1) router.back()
  else router.push("/browse")
}
