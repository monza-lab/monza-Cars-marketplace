import type { VehicleIdentity, ScrapedListingFull, ListingType } from "../../types-v3"
import type { HausReport } from "@/lib/fairValue/types"

export function buildCarContext(
  identity: VehicleIdentity | null,
  scrape: ScrapedListingFull | null
): string {
  if (!identity) return "No vehicle identity available."

  const lines: string[] = [
    `Vehicle: ${identity.year} ${identity.make} ${identity.model}`,
    `Series: ${identity.series} (${identity.generationYears})`,
    `Family: ${identity.family}`,
  ]

  if (identity.variant) lines.push(`Variant: ${identity.variant}`)
  if (identity.engine) lines.push(`Engine: ${identity.engine}`)
  if (identity.transmission) lines.push(`Transmission: ${identity.transmission}`)
  if (identity.drivetrain) lines.push(`Drivetrain: ${identity.drivetrain}`)
  if (identity.horsepower) lines.push(`Horsepower: ${identity.horsepower}`)
  if (identity.bodyStyle) lines.push(`Body: ${identity.bodyStyle}`)
  if (identity.isSpecialEdition) lines.push(`Special Edition: Yes`)
  lines.push(`Listing Type: ${identity.listingType}`)

  if (identity.factoryOptions.length > 0) {
    lines.push(`Factory Options: ${identity.factoryOptions.join(", ")}`)
  }

  if (scrape) {
    if (scrape.mileage) lines.push(`Mileage: ${scrape.mileage} ${scrape.mileageUnit}`)
    if (scrape.exteriorColor) lines.push(`Exterior: ${scrape.exteriorColor}`)
    if (scrape.interiorColor) lines.push(`Interior: ${scrape.interiorColor}`)
    if (scrape.vin) lines.push(`VIN: ${scrape.vin}`)
    if (scrape.modifications.length > 0) {
      lines.push(`Modifications: ${scrape.modifications.join(", ")}`)
    }
  }

  return lines.join("\n")
}

export function buildPricingContext(
  fairValue: HausReport | null,
  scrape: ScrapedListingFull | null,
  listingType: ListingType
): string {
  const lines: string[] = []

  if (fairValue) {
    if (fairValue.specific_car_fair_value_mid) {
      lines.push(`Fair Value (mid): $${fairValue.specific_car_fair_value_mid.toLocaleString()}`)
    }
    if (fairValue.specific_car_fair_value_low && fairValue.specific_car_fair_value_high) {
      lines.push(
        `Fair Value Range: $${fairValue.specific_car_fair_value_low.toLocaleString()} - $${fairValue.specific_car_fair_value_high.toLocaleString()}`
      )
    }
    lines.push(`Comparables Count: ${fairValue.comparables_count}`)
    lines.push(`Signals Detected: ${fairValue.signals_detected.length}`)
    lines.push(`Total Modifier: ${fairValue.modifiers_total_percent > 0 ? "+" : ""}${fairValue.modifiers_total_percent}%`)
  }

  if (listingType === "auction" && scrape?.currentBid) {
    lines.push(`Current Bid: $${scrape.currentBid.toLocaleString()}`)
    if (scrape.bidCount) lines.push(`Bid Count: ${scrape.bidCount}`)
    lines.push(`Reserve: ${scrape.reserveStatus}`)
  } else if (listingType === "classified" && scrape?.askingPrice) {
    lines.push(`Asking Price: $${scrape.askingPrice.toLocaleString()}`)
    if (scrape.daysOnMarket) lines.push(`Days on Market: ${scrape.daysOnMarket}`)
  }

  return lines.join("\n") || "No pricing data available."
}

export function truncateDescription(text: string, maxChars: number = 3000): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + "\n... [truncated]"
}
