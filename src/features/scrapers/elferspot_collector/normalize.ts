import type { ElferspotListingSummary, ElferspotDetail } from "./types"

export function mapTransmission(raw: string | null): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.includes("pdk") || lower.includes("tiptronic") || lower.includes("automatik") || lower.includes("automatic")) return "Automatic"
  if (lower.includes("manual") || lower.includes("schaltgetriebe") || lower.includes("handschaltung")) return "Manual"
  return raw
}

export function mapBodyStyle(raw: string | null): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.includes("coupé") || lower.includes("coupe")) return "Coupe"
  if (lower.includes("cabriolet") || lower.includes("convertible") || lower.includes("cabrio")) return "Convertible"
  if (lower.includes("targa")) return "Targa"
  if (lower.includes("speedster")) return "Speedster"
  if (lower.includes("sport turismo") || lower.includes("shooting brake")) return "Sport Turismo"
  return raw
}

export interface NormalizedElferspot {
  source: "Elferspot"
  source_id: string
  source_url: string
  title: string
  make: "Porsche"
  model: string
  trim: string | null
  year: number
  price: number | null
  original_currency: string
  mileage_km: number | null
  transmission: string | null
  body_style: string | null
  engine: string | null
  color_exterior: string | null
  color_interior: string | null
  vin: string | null
  description_text: string | null
  images: string[]
  photos_count: number
  country: string | null
  location: string | null
  seller_type: string | null
  seller_name: string | null
  status: "active"
  fuel: string | null
  scrape_timestamp: string
}

export function normalizeListing(
  summary: ElferspotListingSummary,
  detail: ElferspotDetail | null,
): NormalizedElferspot | null {
  const year = detail?.year ?? summary.year
  if (!year) return null

  const title = summary.title
  const modelRaw = detail?.model ?? title.replace(/^Porsche\s+/i, "").trim()

  // Extract trim from the model name (e.g., "992 GT3 Touring" -> "GT3 Touring")
  const trimMatch = modelRaw.replace(/^\d{3}\.?\d?\s*/i, "").trim()
  const trim = trimMatch || null

  return {
    source: "Elferspot",
    source_id: summary.sourceId,
    source_url: summary.sourceUrl,
    title,
    make: "Porsche",
    model: modelRaw,
    trim,
    year,
    price: detail?.price ?? null,
    original_currency: detail?.currency ?? "EUR",
    mileage_km: detail?.mileageKm ?? null,
    transmission: mapTransmission(detail?.transmission ?? null),
    body_style: mapBodyStyle(detail?.bodyType ?? null),
    engine: detail?.engine ?? null,
    color_exterior: detail?.colorExterior ?? null,
    color_interior: detail?.colorInterior ?? null,
    vin: detail?.vin ?? null,
    description_text: detail?.descriptionText ?? null,
    images: detail?.images ?? (summary.thumbnailUrl ? [summary.thumbnailUrl] : []),
    photos_count: detail?.images?.length ?? (summary.thumbnailUrl ? 1 : 0),
    country: detail?.locationCountry ?? summary.country ?? null,
    location: detail?.location ?? null,
    seller_type: detail?.sellerType ?? null,
    seller_name: detail?.sellerName ?? null,
    status: "active",
    fuel: detail?.fuel ?? null,
    scrape_timestamp: new Date().toISOString(),
  }
}
