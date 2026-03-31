import * as cheerio from "cheerio"
import { proxyFetch } from "@/features/scrapers/common/proxy-fetch"
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

  // Vehicle photos only — use a.photoswipe-image hrefs (full-size gallery images)
  const images: string[] = []
  $("a.photoswipe-image").each((_i, el) => {
    const href = $(el).attr("href") || ""
    if (href && !images.includes(href)) {
      images.push(href)
    }
  })

  // Spec table (table.fahrzeugdaten) — reliable structured data
  const specs: Record<string, string> = {}
  $("table.fahrzeugdaten tr").each((_i, el) => {
    const label = $(el).find("td.label").text().replace(/:?\s*$/, "").trim().toLowerCase()
    const content = $(el).find("td.content").text().trim()
    if (label && content) specs[label] = content
  })

  // Engine from spec table ("cylinder capacity" or "hubraum")
  const engineRaw = specs["cylinder capacity"] || specs["hubraum"] || null
  const engine = engineRaw
    ? engineRaw.replace(/\s*liter/i, "L").replace(/\s*l$/i, "L")
    : null

  // Power from spec table
  const powerRaw = specs["power"] || specs["leistung"] || null

  // VIN from body text
  const bodyText = $("body").text()
  const vinMatch = bodyText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i)
  const vin = vinMatch ? vinMatch[0].toUpperCase() : null

  // Fuel type from spec table or JSON-LD
  const fuel = specs["fuel"] || specs["kraftstoff"] || null

  // Interior color from spec table
  const colorInterior = specs["interior color"] || specs["innenfarbe"] || null

  // Condition from spec table
  const condition = specs["condition"] || specs["zustand"] || null

  // Description: highlights-float paragraphs (excluding translation notice)
  const descParts: string[] = []
  $("div.highlights-float p").each((_i, el) => {
    if ($(el).hasClass("translation-notice")) return
    const text = $(el).text().trim()
    if (text) descParts.push(text)
  })
  // Also include highlight bullet points
  $("div.highlights ul.fa-ul li").each((_i, el) => {
    const text = $(el).text().trim()
    if (text) descParts.push(text)
  })
  const descriptionText = descParts.length > 0 ? descParts.join("\n") : null

  // Seller name from sidebar
  const sellerName = $(".sidebar-section-heading.sidebar-toggle strong").first().text().trim() || null

  // Seller type heuristic
  const dealerPatterns = ["GmbH", "AG", "Ltd", "Inc", "B.V.", "S.r.l.", "S.A.", "LLC"]
  const sellerType = sellerName && dealerPatterns.some(p => sellerName.includes(p))
    ? "dealer" : (sellerName ? "private" : null)

  // Location from spec table or sidebar
  const locationCountry = specs["car location"]?.replace(/[^a-zA-Z\s]/g, "").trim()
    || $(".flag-name-container span.country").first().text().trim()
    || null

  // Price fallback from sidebar (if JSON-LD price is null)
  let price = jsonLd?.price ?? null
  let currency = jsonLd?.currency ?? "EUR"
  if (!price) {
    const priceText = $("div.price span.p").first().text().trim()
    const priceMatch = priceText.match(/([A-Z]{3})\s*([\d.,]+)/)
    if (priceMatch) {
      currency = priceMatch[1]
      const numStr = priceMatch[2].replace(/[.,](?=\d{3})/g, "").replace(",", ".")
      const parsed = parseFloat(numStr)
      if (Number.isFinite(parsed) && parsed > 0) price = parsed
    }
  }

  return {
    // JSON-LD primary, spec table fallback
    price,
    currency,
    year: jsonLd?.year ?? null,
    mileageKm: jsonLd?.mileageKm ?? null,
    transmission: jsonLd?.transmission ?? null,
    bodyType: jsonLd?.bodyType ?? null,
    driveType: jsonLd?.driveType ?? null,
    colorExterior: jsonLd?.colorExterior ?? null,
    model: jsonLd?.model ?? null,
    firstRegistration: jsonLd?.firstRegistration ?? null,
    // Cheerio enrichment
    fuel: fuel || null,
    engine: engine ? `${engine}${powerRaw ? ` ${powerRaw}` : ""}` : null,
    colorInterior,
    vin,
    sellerName,
    sellerType,
    location: null,
    locationCountry,
    descriptionText,
    images,
    condition,
  }
}

export async function fetchDetailPage(url: string): Promise<ElferspotDetail> {
  const response = await proxyFetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const html = await response.text()
  return parseDetailPage(html)
}
