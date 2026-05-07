/**
 * Porsche factory color registry with rarity and desirability data.
 *
 * Source: Porsche Classic color archive, Rennbow.org community data,
 * Hagerty market reports, PCA archives.
 *
 * Each entry: { code, name, genericName, generations, rarity, desirability, isPTS }
 * - rarity: "common" | "uncommon" | "rare" | "very_rare" | "unique"
 * - desirability: 1-10 scale (10 = most desirable for collectors)
 */

export interface PorscheColor {
  code: string            // Factory code e.g. "1K1K" or "036"
  name: string            // Official name e.g. "Riviera Blue"
  genericName: string     // Simplified e.g. "Blue"
  generations: string[]   // Which series had this color: ["993", "964"]
  rarity: "common" | "uncommon" | "rare" | "very_rare" | "unique"
  desirability: number    // 1-10
  isPTS: boolean
  valuePremiumPercent: number // estimated premium vs same-gen average color
  notes?: string
}

// Canonical color families for fuzzy matching
export type ColorFamily =
  | "white" | "black" | "silver" | "grey" | "red" | "blue" | "green"
  | "yellow" | "orange" | "brown" | "purple" | "gold" | "beige" | "other"

export const COLOR_FAMILY_MAP: Record<string, ColorFamily> = {
  // White family
  "grand prix white": "white", "white": "white", "carrara white": "white",
  "cream white": "white", "ivory": "white",
  // Black family
  "black": "black", "basalt black": "black", "jet black": "black",
  // Silver family
  "silver": "silver", "arctic silver": "silver", "gt silver": "silver",
  "rhodium silver": "silver", "platinum silver": "silver",
  // Grey family
  "grey": "grey", "gray": "grey", "seal grey": "grey", "agate grey": "grey",
  "slate grey": "grey", "meteor grey": "grey", "graphite grey": "grey",
  "crayon": "grey", "chalk": "grey",
  // Red family
  "red": "red", "guards red": "red", "ruby red": "red", "rubystone red": "red",
  "carmine red": "red", "indian red": "red", "arena red": "red",
  // Blue family
  "blue": "blue", "riviera blue": "blue", "miami blue": "blue",
  "sapphire blue": "blue", "cobalt blue": "blue", "lapis blue": "blue",
  "midnight blue": "blue", "shark blue": "blue", "gentian blue": "blue",
  "azure blue": "blue", "mexico blue": "blue",
  // Green family
  "green": "green", "irish green": "green", "british racing green": "green",
  "python green": "green", "pts oak green": "green", "auratium green": "green",
  "oakgreen": "green", "mint green": "green",
  // Yellow family
  "yellow": "yellow", "speed yellow": "yellow", "racing yellow": "yellow",
  "signal yellow": "yellow",
  // Orange family
  "orange": "orange", "lava orange": "orange", "gulf orange": "orange",
  // Brown family
  "brown": "brown", "mahogany": "brown", "cognac": "brown",
  // Gold family
  "gold": "gold", "aurum gold": "gold",
  // Purple family
  "purple": "purple", "ultraviolet": "purple", "viola metallic": "purple",
}

// Notable Porsche colors with rarity and desirability data
export const NOTABLE_COLORS: PorscheColor[] = [
  // ── 964 era ──
  { code: "M4M4", name: "Rubystone Red", genericName: "Red", generations: ["964"], rarity: "very_rare", desirability: 10, isPTS: false, valuePremiumPercent: 30, notes: "Most sought 964 color" },
  { code: "22A", name: "Mint Green", genericName: "Green", generations: ["964"], rarity: "rare", desirability: 9, isPTS: false, valuePremiumPercent: 25 },
  { code: "027", name: "Guards Red", genericName: "Red", generations: ["964", "993", "996", "997", "991", "992"], rarity: "common", desirability: 6, isPTS: false, valuePremiumPercent: 0 },
  // ── 993 era ──
  { code: "1K1K", name: "Riviera Blue", genericName: "Blue", generations: ["993"], rarity: "rare", desirability: 10, isPTS: false, valuePremiumPercent: 35, notes: "Iconic 993 collector color" },
  { code: "L12H", name: "Speed Yellow", genericName: "Yellow", generations: ["993", "996", "997"], rarity: "uncommon", desirability: 8, isPTS: false, valuePremiumPercent: 15 },
  // ── 996/997 era ──
  { code: "3S3S", name: "Cobalt Blue Metallic", genericName: "Blue", generations: ["997"], rarity: "uncommon", desirability: 8, isPTS: false, valuePremiumPercent: 10 },
  { code: "M5R", name: "Lapis Blue", genericName: "Blue", generations: ["997"], rarity: "uncommon", desirability: 7, isPTS: false, valuePremiumPercent: 8 },
  // ── 991/992 era ──
  { code: "1A1A", name: "Miami Blue", genericName: "Blue", generations: ["991", "992"], rarity: "uncommon", desirability: 9, isPTS: false, valuePremiumPercent: 15 },
  { code: "N3", name: "Shark Blue", genericName: "Blue", generations: ["992"], rarity: "uncommon", desirability: 8, isPTS: false, valuePremiumPercent: 10 },
  { code: "J6", name: "Python Green", genericName: "Green", generations: ["992"], rarity: "uncommon", desirability: 8, isPTS: false, valuePremiumPercent: 10 },
  // ── Generic common colors (all gens) ──
  { code: "009", name: "Black", genericName: "Black", generations: ["964", "993", "996", "997", "991", "992"], rarity: "common", desirability: 5, isPTS: false, valuePremiumPercent: 0 },
  { code: "L5S", name: "Arctic Silver Metallic", genericName: "Silver", generations: ["996", "997"], rarity: "common", desirability: 5, isPTS: false, valuePremiumPercent: 0 },
  { code: "024", name: "Grand Prix White", genericName: "White", generations: ["964", "993", "996", "997"], rarity: "common", desirability: 6, isPTS: false, valuePremiumPercent: 2 },
  { code: "M9Z", name: "GT Silver Metallic", genericName: "Silver", generations: ["997", "991", "992"], rarity: "uncommon", desirability: 7, isPTS: false, valuePremiumPercent: 5 },
]

/**
 * Resolve a generic color string to its color family.
 * Uses fuzzy matching against COLOR_FAMILY_MAP.
 */
export function resolveColorFamily(color: string | null): ColorFamily | null {
  if (!color) return null
  const lower = color.toLowerCase().trim()
  // Direct match
  if (COLOR_FAMILY_MAP[lower]) return COLOR_FAMILY_MAP[lower]
  // Partial match — check if any known color name is contained in the input
  for (const [known, family] of Object.entries(COLOR_FAMILY_MAP)) {
    if (lower.includes(known) || known.includes(lower)) return family
  }
  return "other"
}

/**
 * Find the best-matching notable color for a given color string + generation.
 * Returns null if no confident match found.
 */
export function matchNotableColor(
  colorString: string | null,
  seriesId: string | null,
): PorscheColor | null {
  if (!colorString) return null
  const lower = colorString.toLowerCase().trim()

  // Try exact name match first
  let match = NOTABLE_COLORS.find(
    (c) => c.name.toLowerCase() === lower && (!seriesId || c.generations.includes(seriesId)),
  )
  if (match) return match

  // Try partial name match
  match = NOTABLE_COLORS.find(
    (c) =>
      (lower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(lower)) &&
      (!seriesId || c.generations.includes(seriesId)),
  )
  if (match) return match

  // Fallback: match by generic name to common colors
  const family = resolveColorFamily(colorString)
  if (!family) return null

  const familyMatch = NOTABLE_COLORS.find(
    (c) =>
      c.genericName.toLowerCase() === family &&
      c.rarity === "common" &&
      (!seriesId || c.generations.includes(seriesId)),
  )
  return familyMatch ?? null
}
