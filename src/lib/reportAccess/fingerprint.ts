import { createHash } from "crypto"

type FingerprintListing = Record<string, unknown>

const MATERIAL_KEYS = [
  "title",
  "price",
  "mileage",
  "transmission",
  "vin",
  "description",
  "sourceUrl",
] as const

export function createListingFingerprint(listing: FingerprintListing): string {
  const material = Object.fromEntries(
    MATERIAL_KEYS.map((key) => [key, listing[key] ?? null]),
  )

  return createHash("sha256").update(JSON.stringify(material)).digest("hex")
}
