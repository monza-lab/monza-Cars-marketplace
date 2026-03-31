import type { Region, FairValueByRegion } from "./curatedCars"

// Region → currency symbol
export const REGION_CURRENCY: Record<string, string> = {
  US: "$",
  EU: "€",
  UK: "£",
  JP: "¥",
}

// Currency → USD rate
export const TO_USD_RATE: Record<string, number> = {
  "$": 1,
  "€": 1.08,
  "£": 1.27,
  "¥": 0.0067,
  "CHF": 1.13,
}

// USD → currency rate (inverse)
export const FROM_USD_RATE: Record<string, number> = {
  "$": 1,
  "€": 1 / 1.08,
  "£": 1 / 1.27,
  "¥": 1 / 0.0067,
  "CHF": 1 / 1.13,
}

// Regional market premium multipliers (relative to US base)
export const REGIONAL_MARKET_PREMIUM: Record<string, number> = {
  US: 1.0,
  EU: 1.08,
  UK: 1.15,
  JP: 0.85,
}

/** Convert any currency amount to USD */
export function toUsd(value: number, currency: string): number {
  return value * (TO_USD_RATE[currency] || 1)
}

/** Convert a USD amount to the target currency */
export function convertFromUsd(usdAmount: number, targetCurrency: string): number {
  return usdAmount * (FROM_USD_RATE[targetCurrency] || 1)
}

/** Get currency symbol for a region */
export function getCurrency(selected: string | null): string {
  return REGION_CURRENCY[resolveRegion(selected)]
}

/** Resolve null/"all" to "US" default */
export function resolveRegion(selected: string | null): Region {
  if (!selected || selected === "all" || selected === "All") return "US"
  return selected as Region
}

const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
})

/** Format a price in any currency with appropriate abbreviations */
export function formatRegionalPrice(value: number, currency: string): string {
  const normalized = Number.isFinite(value) ? value : Number(value)
  const safeValue = Number.isFinite(normalized) ? normalized : 0

  // No price data — show "POA" (Price on Application)
  if (safeValue <= 0) return "POA"

  if (currency === "¥") {
    if (safeValue >= 100_000_000) return `¥${(safeValue / 100_000_000).toFixed(1)}億`
    if (safeValue >= 10_000_000) return `¥${(safeValue / 10_000_000).toFixed(1)}千万`
    return `¥${INTEGER_FORMATTER.format(Math.round(safeValue))}`
  }
  const sym = currency
  if (safeValue >= 1_000_000) return `${sym}${(safeValue / 1_000_000).toFixed(1)}M`
  if (safeValue >= 1_000) return `${sym}${(safeValue / 1_000).toFixed(0)}K`
  return `${sym}${INTEGER_FORMATTER.format(Math.round(safeValue))}`
}

/** One-liner: convert USD → target region, then format */
export function formatPriceForRegion(usdAmount: number, selectedRegion: string | null): string {
  const currency = getCurrency(selectedRegion)
  const converted = convertFromUsd(usdAmount, currency)
  return formatRegionalPrice(converted, currency)
}

/** Format a USD amount as USD string */
export function formatUsd(value: number): string {
  const normalized = Number.isFinite(value) ? value : Number(value)
  const safeValue = Number.isFinite(normalized) ? normalized : 0

  if (safeValue <= 0) return "POA"
  if (safeValue >= 1_000_000) return `$${(safeValue / 1_000_000).toFixed(1)}M`
  if (safeValue >= 1_000) return `$${(safeValue / 1_000).toFixed(0)}K`
  return `$${INTEGER_FORMATTER.format(Math.round(safeValue))}`
}

/** Build FairValueByRegion from a USD price (kept for data compatibility) */
export function buildRegionalFairValue(usdPrice: number): FairValueByRegion {
  if (usdPrice <= 0) {
    return {
      US: { currency: "$", low: 0, high: 0 },
      EU: { currency: "€", low: 0, high: 0 },
      UK: { currency: "£", low: 0, high: 0 },
      JP: { currency: "¥", low: 0, high: 0 },
    }
  }
  const low = usdPrice * 0.8
  const high = usdPrice * 1.2
  return {
    US: { currency: "$", low: Math.round(low), high: Math.round(high) },
    EU: { currency: "€", low: Math.round(low), high: Math.round(high) },
    UK: { currency: "£", low: Math.round(low), high: Math.round(high) },
    JP: { currency: "¥", low: Math.round(low), high: Math.round(high) },
  }
}

/** Get the fair value range for the selected region */
export function getFairValueForRegion(
  fairValue: FairValueByRegion,
  selectedRegion: string | null
): { currency: string; low: number; high: number } {
  const region = resolveRegion(selectedRegion)
  return fairValue[region]
}
