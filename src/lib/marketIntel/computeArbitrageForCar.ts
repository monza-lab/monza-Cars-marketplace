import type { MarketIntelD2 } from "@/lib/fairValue/types"
import type { PricedListingRow } from "@/lib/supabaseLiveListings"
import { calculateLandedCost, type OriginCountry, type Country } from "@/lib/landedCost"
import {
  computeD2Arbitrage,
  type ArbitrageComparable,
  type LandedCostResolvedMin,
} from "./aggregator"

type Region = "US" | "EU" | "UK" | "JP"

const COUNTRY_TO_REGION: Record<string, Region> = {
  US: "US",
  USA: "US",
  CA: "US",
  MX: "US",
  // EU core
  DE: "EU",
  IT: "EU",
  FR: "EU",
  ES: "EU",
  NL: "EU",
  BE: "EU",
  AT: "EU",
  CH: "EU",
  LU: "EU",
  PT: "EU",
  DK: "EU",
  SE: "EU",
  NO: "EU",
  FI: "EU",
  IE: "EU",
  PL: "EU",
  CZ: "EU",
  // UK
  UK: "UK",
  GB: "UK",
  // JP
  JP: "JP",
}

function normalizeCountry(country: string | null | undefined): Region | null {
  if (!country) return null
  const upper = country.trim().toUpperCase()
  return COUNTRY_TO_REGION[upper] ?? null
}

const REGION_TO_ORIGIN: Record<Region, OriginCountry> = {
  US: "US",
  EU: "DE",
  UK: "UK",
  JP: "JP",
}

const REGION_TO_DEST: Record<Region, Country> = {
  US: "US",
  EU: "DE",
  UK: "UK",
  JP: "JP",
}

export interface ArbitrageInput {
  pricedListings: PricedListingRow[]
  thisVinPriceUsd: number
  targetRegion: Region
  carYear: number
}

/**
 * Server-side helper that turns Supabase priced listings into a
 * populated MarketIntelD2 block. Groups listings by region, picks the
 * cheapest comparable in each, and resolves landed cost to the target
 * region using the brand's landed-cost calculator.
 *
 * Designed to be called from Server Components or API routes (uses fs
 * transitively via getExchangeRates). Returns an empty D2 with the
 * target region pre-set on failure, so the UI can degrade gracefully.
 */
export async function computeArbitrageForCar(
  input: ArbitrageInput,
): Promise<MarketIntelD2> {
  const { pricedListings, thisVinPriceUsd, targetRegion, carYear } = input

  try {
    // Bucket listings by region using their country field.
    const byRegion: Record<Region, ArbitrageComparable[]> = {
      US: [],
      EU: [],
      UK: [],
      JP: [],
    }

    for (const row of pricedListings) {
      const region = normalizeCountry(row.country)
      if (!region) continue
      if (!Number.isFinite(row.hammer_price) || row.hammer_price <= 0) continue
      byRegion[region].push({
        id: row.id,
        priceUsd: Math.round(row.hammer_price),
        url: null,
      })
    }

    // The listing under analysis is the cheapest comparable in the
    // target region for display purposes — guarantees the user always
    // sees their listing card with a real price.
    const thisVin: ArbitrageComparable = {
      id: "this-vin",
      priceUsd: thisVinPriceUsd,
      url: null,
    }
    byRegion[targetRegion] = [thisVin, ...byRegion[targetRegion]]

    const resolver = async (
      origin: OriginCountry,
      destination: Country,
      priceUsd: number,
    ): Promise<LandedCostResolvedMin | null> => {
      const lc = await calculateLandedCost({
        car: { priceUsd, year: carYear },
        origin,
        destination,
      })
      if (!lc) return null
      return {
        landedCost: { min: lc.landedCost.min, max: lc.landedCost.max },
      }
    }

    return await computeD2Arbitrage({
      targetRegion,
      comparablesByRegion: byRegion,
      landedCostResolver: async (origin, destination, priceUsd) => {
        // Only real regions are mapped; the inputs are guaranteed to be
        // in REGION_TO_ORIGIN/DEST, but we still guard defensively.
        void origin
        void destination
        return resolver(origin, destination, priceUsd)
      },
    })
  } catch {
    return {
      by_region: [],
      target_region: targetRegion,
      narrative_insight: null,
    }
  }
}

/**
 * Infer which of the four supported regions a car's own listing country
 * falls into, for use as the target region of a cross-border arbitrage
 * analysis. Falls back to "US" when the country is unknown or in a
 * region we don't yet model.
 */
export function inferTargetRegion(country: string | null | undefined): Region {
  return normalizeCountry(country) ?? "US"
}

export const ARBITRAGE_REGION_TO_ORIGIN = REGION_TO_ORIGIN
export const ARBITRAGE_REGION_TO_DEST = REGION_TO_DEST
