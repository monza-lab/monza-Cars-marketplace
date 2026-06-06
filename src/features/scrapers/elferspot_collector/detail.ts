import * as cheerio from "cheerio"
import { proxyFetch } from "@/features/scrapers/common/proxy-fetch"
import { classifyVehicleIdentifier, extractVehicleIdentifierFromText } from "@/features/scrapers/common/vehicleIdentifier"
import { canUseScraplingFallback, fetchHtmlWithScrapling } from "./scrapling"
import type { ElferspotDetail } from "./types"

/** Currencies allowed by the monza_currency DB enum */
const ALLOWED_CURRENCIES = new Set(["USD", "EUR", "GBP", "JPY", "CHF"])

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
  vehicleIdentifier: string | null
}

function flattenJsonLd(parsed: unknown): unknown[] {
  if (!parsed || typeof parsed !== "object") return []
  const record = parsed as Record<string, unknown>
  return Array.isArray(record["@graph"]) ? record["@graph"] : [parsed]
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
      const items = flattenJsonLd(parsed)
      for (const item of items) {
        if (!item || typeof item !== "object") continue
        const record = item as Record<string, any>
        if (record["@type"] === "Vehicle" || record["@type"]?.includes("Vehicle")) {
          const offer = record.offers || {}
          const mileage = record.mileageFromOdometer
          const priceRaw = offer.price ?? record.price
          const price = priceRaw ? parseFloat(String(priceRaw)) : null

          vehicle = {
            price: price && Number.isFinite(price) && price > 0 ? price : null,
            currency: offer.priceCurrency || "EUR",
            model: record.model || null,
            year: record.dateVehicleFirstRegistered
              ? new Date(record.dateVehicleFirstRegistered).getFullYear()
              : null,
            mileageKm: mileage?.value ? parseInt(String(mileage.value), 10) : null,
            transmission: record.vehicleTransmission || null,
            bodyType: record.bodyType || null,
            driveType: record.driveWheelConfiguration || null,
            colorExterior: record.color || null,
            firstRegistration: record.dateVehicleFirstRegistered || null,
            vehicleIdentifier: classifyVehicleIdentifier(record.vehicleIdentificationNumber)?.normalized ?? null,
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

export function extractWebPageDescription(html: string): string | null {
  const $ = cheerio.load(html)
  let description: string | null = null

  $('script[type="application/ld+json"]').each((_i, el) => {
    if (description) return false
    try {
      const raw = $(el).html()
      if (!raw) return
      const parsed = JSON.parse(raw)
      const items = flattenJsonLd(parsed)
      for (const item of items) {
        if (!item || typeof item !== "object") continue
        const record = item as Record<string, unknown>
        if (record["@type"] === "WebPage" && typeof record.description === "string" && record.description.trim()) {
          description = record.description.trim()
          return false
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  })

  return description
}

function classifyElferspotPrice(priceText: string, price: number | null) {
  const text = priceText.toLowerCase()
  if (price && price > 0) return "numeric" as const
  if (text.includes("sold")) return "sold" as const
  if (text.includes("price on request") || text.includes("poa")) return "price_on_request" as const
  if (text.includes("reserved")) return "hidden" as const
  if (!priceText.trim()) return "not_listed" as const
  return "unknown" as const
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

  // Source-native vehicle identifier. Prefer structured/labeled fields, then generic VIN fallback.
  const bodyText = $("body").text()
  const labeledIdentifier =
    classifyVehicleIdentifier(specs["vin"], "VIN")
    ?? classifyVehicleIdentifier(specs["vehicle identification number"], "Vehicle Identification Number")
    ?? classifyVehicleIdentifier(specs["chassis"], "Chassis")
    ?? classifyVehicleIdentifier(specs["chassis number"], "Chassis number")
    ?? classifyVehicleIdentifier(specs["frame"], "Frame")
    ?? classifyVehicleIdentifier(specs["serial"], "Serial")
    ?? extractVehicleIdentifierFromText(bodyText)
  const fallbackIdentifier = labeledIdentifier
    ?? classifyVehicleIdentifier(jsonLd?.vehicleIdentifier)
    ?? extractVehicleIdentifierFromText(bodyText, { allowGenericVin: true })
  const vin = fallbackIdentifier?.normalized ?? null

  // Fuel type from spec table or JSON-LD
  const fuel = specs["fuel"] || specs["kraftstoff"] || null

  // Interior color from spec table
  const colorInterior = specs["interior color"] || specs["innenfarbe"] || null
  const colorExterior = specs["exterior color"] || specs["aussenfarbe"] || specs["außenfarbe"] || specs["color"] || null
  const transmission = specs["transmission"] || specs["getriebe"] || specs["gearbox"] || specs["schaltung"] || null

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
  const descriptionText = descParts.length > 0 ? descParts.join("\n") : extractWebPageDescription(html)

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
  const visiblePriceText = $("div.price").first().text().trim()
  if (!price) {
    const priceMatch = visiblePriceText.match(/([A-Z]{3})\s*([\d.,]+)/)
    if (priceMatch) {
      currency = priceMatch[1]
      const numStr = priceMatch[2].replace(/[.,](?=\d{3})/g, "").replace(",", ".")
      const parsed = parseFloat(numStr)
      if (Number.isFinite(parsed) && parsed > 0) price = parsed
    }
  }

  // Validate currency against DB enum
  if (!ALLOWED_CURRENCIES.has(currency)) {
    console.warn(`[elferspot:detail] Unsupported currency "${currency}", mapping to EUR`)
    currency = "EUR"
  }

  return {
    // JSON-LD primary, spec table fallback
    price,
    priceStatus: classifyElferspotPrice(visiblePriceText, price),
    currency,
    year: jsonLd?.year ?? null,
    mileageKm: jsonLd?.mileageKm ?? null,
    transmission: jsonLd?.transmission ?? transmission,
    bodyType: jsonLd?.bodyType ?? null,
    driveType: jsonLd?.driveType ?? null,
    colorExterior: jsonLd?.colorExterior ?? colorExterior,
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
    descriptionStatus: descriptionText ? "present" : "missing",
    images,
    condition,
  }
}

export async function fetchDetailPage(url: string): Promise<ElferspotDetail> {
  // Try proxyFetch first, fall back to scrapling on failure
  let html: string
  try {
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

    html = await response.text()
  } catch (fetchErr) {
    if (!canUseScraplingFallback()) throw fetchErr

    const scraplingHtml = await fetchHtmlWithScrapling(url)
    if (!scraplingHtml) throw fetchErr
    console.log(`[elferspot] Scrapling fallback succeeded for ${url}`)
    html = scraplingHtml
  }

  return parseDetailPage(html)
}
