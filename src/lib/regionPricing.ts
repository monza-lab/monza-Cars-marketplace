import type { Region, FairValueByRegion, RegionalPricing } from "./curatedCars"

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
}

// USD → currency rate (inverse)
export const FROM_USD_RATE: Record<string, number> = {
  "$": 1,
  "€": 1 / 1.08,
  "£": 1 / 1.27,
  "¥": 1 / 0.0067,
}

/** Resolve null/"all" to "US" default */
export function resolveRegion(selected: string | null): Region {
  if (!selected || selected === "all" || selected === "All") return "US"
  return selected as Region
}

/** Get currency symbol for a region */
export function getCurrency(selected: string | null): string {
  return REGION_CURRENCY[resolveRegion(selected)]
}

/** Convert a USD amount to the target currency */
export function convertFromUsd(usdAmount: number, targetCurrency: string): number {
  return usdAmount * (FROM_USD_RATE[targetCurrency] || 1)
}

/** Convert any currency amount to USD */
export function toUsd(value: number, currency: string): number {
  return value * (TO_USD_RATE[currency] || 1)
}

/** Format a price in any currency with appropriate abbreviations */
export function formatRegionalPrice(value: number, currency: string): string {
  if (currency === "¥") {
    if (value >= 100_000_000) return `¥${(value / 100_000_000).toFixed(1)}億`
    if (value >= 10_000_000) return `¥${(value / 10_000_000).toFixed(1)}千万`
    return `¥${value.toLocaleString()}`
  }
  const sym = currency
  if (value >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${sym}${(value / 1_000).toFixed(0)}K`
  return `${sym}${value.toLocaleString()}`
}

/** One-liner: convert USD → target region, then format */
export function formatPriceForRegion(usdAmount: number, selectedRegion: string | null): string {
  const currency = getCurrency(selectedRegion)
  const converted = convertFromUsd(usdAmount, currency)
  return formatRegionalPrice(converted, currency)
}

/** Get the fair value range for the selected region */
export function getFairValueForRegion(
  fairValue: FairValueByRegion,
  selectedRegion: string | null
): RegionalPricing {
  const region = resolveRegion(selectedRegion)
  return fairValue[region]
}

/** Format a USD amount as USD string (for comparison display) */
export function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}
