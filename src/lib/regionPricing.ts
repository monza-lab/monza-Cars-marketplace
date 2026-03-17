import type { Region, FairValueByRegion } from "./curatedCars"

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

/** Format a USD amount as USD string */
export function formatUsd(value: number): string {
  const normalized = Number.isFinite(value) ? value : Number(value)
  const safeValue = Number.isFinite(normalized) ? normalized : 0

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
