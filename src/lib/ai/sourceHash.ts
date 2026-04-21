import { createHash } from "node:crypto"

export interface RewriterSource {
  description_text: string | null
  year: number
  make: string
  model: string
  trim: string | null
  mileage: number | null
  mileage_unit: "mi" | "km" | null
  vin: string | null
  color_exterior: string | null
  color_interior: string | null
  engine: string | null
  transmission: string | null
  body_style: string | null
  location: string | null
  platform: string | null
}

// Canonical key order — field changes must update this deliberately.
const FIELD_ORDER: Array<keyof RewriterSource> = [
  "year",
  "make",
  "model",
  "trim",
  "mileage",
  "mileage_unit",
  "vin",
  "color_exterior",
  "color_interior",
  "engine",
  "transmission",
  "body_style",
  "location",
  "platform",
  "description_text",
]

export function computeSourceHash(source: RewriterSource): string {
  const canonical = FIELD_ORDER.map(k => [k, source[k] ?? null] as const)
  const serialised = JSON.stringify(canonical)
  return createHash("sha256").update(serialised).digest("hex")
}
