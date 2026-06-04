import * as cheerio from "cheerio"
import { proxyFetch } from "@/features/scrapers/common/proxy-fetch"
import { canUseScraplingFallback, fetchHtmlWithScrapling } from "./scrapling"
import type { ElferspotDetail } from "./types"

/** Currencies allowed by the monza_currency DB enum */
const ALLOWED_CURRENCIES = new Set(["USD", "EUR", "GBP", "JPY", "CHF"])
const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  "$": "USD",
  "£": "GBP",
  "¥": "JPY",
}

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

function flattenJsonLd(parsed: unknown): unknown[] {
  if (!parsed || typeof parsed !== "object") return []
  const record = parsed as Record<string, unknown>
  return Array.isArray(record["@graph"]) ? record["@graph"] : [parsed]
}

function normalizeText(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
}

function parsePriceNumber(raw: string): number | null {
  const numeric = raw.replace(/[^\d.,'\s]/g, "").replace(/[\s']/g, "")
  if (!/\d/.test(numeric)) return null

  const normalized = numeric
    .replace(/[.,](?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
  const parsed = parseFloat(normalized)

  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

function parsePriceText(raw: string): { price: number; currency: string } | null {
  const text = normalizeText(raw)
  if (!text) return null

  const codeMatch = text.match(/\b(USD|EUR|GBP|JPY|CHF)\b/i)
  const symbolMatch = text.match(/[€$£¥]/)
  const price = parsePriceNumber(text)
  if (!price) return null

  const currency = codeMatch?.[1]?.toUpperCase() ?? (symbolMatch ? CURRENCY_SYMBOLS[symbolMatch[0]] : "EUR")
  return { price, currency }
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
        const record = item as Record<string, unknown>
        const type = record["@type"]
        const isVehicle = Array.isArray(type)
          ? type.includes("Vehicle")
          : typeof type === "string" && type.includes("Vehicle")
        if (isVehicle) {
          const offerRaw = Array.isArray(record.offers) ? record.offers[0] : record.offers
          const offer = offerRaw && typeof offerRaw === "object" ? offerRaw as Record<string, unknown> : {}
          const mileage = record.mileageFromOdometer && typeof record.mileageFromOdometer === "object"
            ? record.mileageFromOdometer as Record<string, unknown>
            : null
          const priceRaw = offer.price ?? record.price
          const price = priceRaw ? parsePriceNumber(String(priceRaw)) : null
          const firstRegistration = typeof record.dateVehicleFirstRegistered === "string"
            ? record.dateVehicleFirstRegistered
            : null

          vehicle = {
            price: price && Number.isFinite(price) && price > 0 ? price : null,
            currency: typeof offer.priceCurrency === "string" ? offer.priceCurrency : "EUR",
            model: typeof record.model === "string" ? record.model : null,
            year: firstRegistration ? new Date(firstRegistration).getFullYear() : null,
            mileageKm: mileage?.value ? parseInt(String(mileage.value), 10) : null,
            transmission: typeof record.vehicleTransmission === "string" ? record.vehicleTransmission : null,
            bodyType: typeof record.bodyType === "string" ? record.bodyType : null,
            driveType: typeof record.driveWheelConfiguration === "string" ? record.driveWheelConfiguration : null,
            colorExterior: typeof record.color === "string" ? record.color : null,
            firstRegistration,
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
  if (text.includes("sold") || text.includes("verkauft") || text.includes("vendu") || text.includes("verkocht")) {
    return "sold" as const
  }
  if (
    text.includes("price on request") ||
    text.includes("on application") ||
    text.includes("on request") ||
    text.includes("preis auf anfrage") ||
    text.includes("prix sur demande") ||
    text.includes("prijs op aanvraag") ||
    text.includes("poa")
  ) {
    return "price_on_request" as const
  }
  if (text.includes("reserved") || text.includes("reserviert") || text.includes("réservé") || text.includes("gereserveerd")) {
    return "hidden" as const
  }
  if (text.includes("without reserve") || text.includes("no reserve")) return "not_listed" as const
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
  if (descParts.length === 0) {
    $("[itemprop='description'], .listing-description p, .vehicle-description p, .description p").each((_i, el) => {
      const text = normalizeText($(el).text())
      if (text && !descParts.includes(text)) descParts.push(text)
    })
  }
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
  const visiblePriceTexts = $("div.price, .info-bar-price, [class*='price']")
    .toArray()
    .map((el) => normalizeText($(el).text()))
    .filter(Boolean)
  const visiblePriceText = visiblePriceTexts[0] ?? ""
  if (!price) {
    for (const text of visiblePriceTexts) {
      const parsed = parsePriceText(text)
      if (parsed) {
        price = parsed.price
        currency = parsed.currency
        break
      }
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
