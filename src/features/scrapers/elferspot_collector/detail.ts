import * as cheerio from "cheerio"
import type { ElferspotDetail } from "./types"

interface JsonLdVehicle {
  price: number | null
  currency: string
  model: string | null
  year: number | null
  mileageKm: number | null
  transmission: string | null
  bodyType: string | null
  driveType: string | null
  colorExterior: string | null
  firstRegistration: string | null
}

export function extractJsonLd(html: string): JsonLdVehicle | null {
  const $ = cheerio.load(html)
  let vehicle: JsonLdVehicle | null = null

  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const raw = $(el).html()
      if (!raw) return
      const parsed = JSON.parse(raw)

      // Handle @graph arrays or direct objects
      const items = Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed]
      for (const item of items) {
        if (item["@type"] === "Vehicle" || item["@type"]?.includes("Vehicle")) {
          const offer = item.offers || {}
          const mileage = item.mileageFromOdometer
          const priceRaw = offer.price ?? item.price
          const price = priceRaw ? parseFloat(String(priceRaw)) : null

          vehicle = {
            price: price && Number.isFinite(price) && price > 0 ? price : null,
            currency: offer.priceCurrency || "EUR",
            model: item.model || null,
            year: item.dateVehicleFirstRegistered
              ? new Date(item.dateVehicleFirstRegistered).getFullYear()
              : null,
            mileageKm: mileage?.value ? parseInt(String(mileage.value), 10) : null,
            transmission: item.vehicleTransmission || null,
            bodyType: item.bodyType || null,
            driveType: item.driveWheelConfiguration || null,
            colorExterior: item.color || null,
            firstRegistration: item.dateVehicleFirstRegistered || null,
          }
          return false // stop iterating
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  })

  return vehicle
}

export function parseDetailPage(html: string): ElferspotDetail {
  const $ = cheerio.load(html)
  const jsonLd = extractJsonLd(html)

  // Images from gallery — filter to CDN URLs only
  const images: string[] = []
  $("img[src*='cdn.elferspot.com']").each((_i, el) => {
    const src = $(el).attr("src") || ""
    if (src && !images.includes(src)) {
      images.push(src)
    }
  })
  // Also check data-src (lazy loaded)
  $("img[data-src*='cdn.elferspot.com']").each((_i, el) => {
    const src = $(el).attr("data-src") || ""
    if (src && !images.includes(src)) {
      images.push(src)
    }
  })

  // Cheerio fallback for fields not in JSON-LD
  const bodyText = $("body").text()

  // Engine extraction: look for pattern like "4.0L" or "3.0 Liter" + "510 HP"
  const engineMatch = bodyText.match(/(\d+\.\d+)\s*(?:L|Liter|l)(?:.*?(\d{2,4})\s*(?:HP|PS|hp|ps|bhp))?/)
  const engine = engineMatch
    ? `${engineMatch[1]}L${engineMatch[2] ? ` ${engineMatch[2]} HP` : ""}`
    : null

  // VIN extraction
  const vinMatch = bodyText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i)
  const vin = vinMatch ? vinMatch[0].toUpperCase() : null

  // Fuel type
  const fuelPatterns = ["Gasoline", "Diesel", "Electric", "Hybrid", "Benzin", "Elektro"]
  const fuel = fuelPatterns.find(f => bodyText.includes(f)) || null

  // Description text
  const descriptionEl = $(".description, .vehicle-description, [class*='description']").first()
  const descriptionText = descriptionEl.text().trim() || null

  return {
    // JSON-LD primary
    price: jsonLd?.price ?? null,
    currency: jsonLd?.currency ?? "EUR",
    year: jsonLd?.year ?? null,
    mileageKm: jsonLd?.mileageKm ?? null,
    transmission: jsonLd?.transmission ?? null,
    bodyType: jsonLd?.bodyType ?? null,
    driveType: jsonLd?.driveType ?? null,
    colorExterior: jsonLd?.colorExterior ?? null,
    model: jsonLd?.model ?? null,
    firstRegistration: jsonLd?.firstRegistration ?? null,
    // Cheerio fallback
    fuel,
    engine,
    colorInterior: null, // Extracted from spec table in production
    vin,
    sellerName: null, // Extracted from seller section
    sellerType: null,
    location: null,
    locationCountry: null,
    descriptionText,
    images,
    condition: null,
  }
}

export async function fetchDetailPage(url: string): Promise<ElferspotDetail> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const html = await response.text()
  return parseDetailPage(html)
}
