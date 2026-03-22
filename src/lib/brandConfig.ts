// ─── BRAND CONFIG ───
// Central configuration for all brand-specific taxonomy, series, and metadata.
// When adding a new brand (Ferrari, BMW, etc.), add its config here and
// all components will pick it up automatically.

// ─── TYPES ───

export interface VariantConfig {
  id: string
  label: string
  keywords: string[]
}

export type BodyType = "Coupe" | "Convertible" | "Targa" | "Speedster" | "SUV" | "Sedan" | "Wagon" | "Unknown"

export const BODY_TYPE_OPTIONS: { id: BodyType; label: string }[] = [
  { id: "Coupe",       label: "Coupe" },
  { id: "Convertible", label: "Convertible" },
  { id: "Targa",       label: "Targa" },
  { id: "Speedster",   label: "Speedster" },
  { id: "SUV",         label: "SUV" },
  { id: "Sedan",       label: "Sedan" },
  { id: "Wagon",       label: "Sport Turismo" },
]

export interface SeriesConfig {
  id: string
  label: string
  family: string           // parent group: "911 Family", "Mid-Engine", "SUV & Sedan"
  yearRange: [number, number]
  order: number            // display priority (lower = first)
  keywords: string[]       // match these in model string (case-insensitive)
  titleKeywords?: string[] // extra keywords checked only against title (year-range gated)
  yearFallback?: [number, number] // for ambiguous models (e.g. "911 Carrera"), use year to match
  turboOnly?: boolean      // only match if model also contains "turbo" (for 930)
  thesis: string
  variants?: VariantConfig[]
}

export interface FamilyGroup {
  id: string
  label: string
  order: number
  seriesIds: string[]
}

export interface BrandConfig {
  name: string
  slug: string
  series: SeriesConfig[]
  familyGroups: FamilyGroup[]
  ownershipCosts: { insurance: number; storage: number; maintenance: number }
  marketDepth: { auctionsPerYear: number; avgDaysToSell: number; sellThroughRate: number; demandScore: number }
  defaultThesis: string
}

// ─── VARIANT IMPORTS ───
import {
  PORSCHE_992_VARIANTS, PORSCHE_991_VARIANTS, PORSCHE_997_VARIANTS,
  PORSCHE_996_VARIANTS, PORSCHE_993_VARIANTS, PORSCHE_964_VARIANTS,
  PORSCHE_930_VARIANTS, PORSCHE_GMODEL_VARIANTS, PORSCHE_FMODEL_VARIANTS,
  PORSCHE_912_VARIANTS, PORSCHE_718_CAYMAN_VARIANTS, PORSCHE_718_BOXSTER_VARIANTS,
  PORSCHE_CAYMAN_VARIANTS, PORSCHE_BOXSTER_VARIANTS,
  PORSCHE_914_VARIANTS, PORSCHE_944_VARIANTS, PORSCHE_928_VARIANTS,
  PORSCHE_968_VARIANTS, PORSCHE_924_VARIANTS, PORSCHE_356_VARIANTS,
  PORSCHE_918_VARIANTS, PORSCHE_CARRERA_GT_VARIANTS, PORSCHE_959_VARIANTS,
  PORSCHE_TAYCAN_VARIANTS, PORSCHE_PANAMERA_VARIANTS,
} from "./brandVariants"

// ─── PORSCHE ───

const PORSCHE_SERIES: SeriesConfig[] = [
  // ── 911 Family (by generation, like Elferspot) ──
  {
    id: "992",
    label: "992",
    family: "911 Family",
    yearRange: [2019, 2026],
    order: 1,
    keywords: ["992"],
    yearFallback: [2019, 2026],
    thesis: "The 992 is the current-generation 911. GT3 and GT3 RS are instant collectibles. Turbo S offers hypercar performance. Sport Classic and S/T are limited-edition highlights commanding strong premiums.",
    variants: PORSCHE_992_VARIANTS,
  },
  {
    id: "991",
    label: "991",
    family: "911 Family",
    yearRange: [2012, 2019],
    order: 2,
    keywords: ["991"],
    yearFallback: [2012, 2019],
    thesis: "The 991 introduced turbocharging to the base 911. GT3 RS (4.0L NA flat-six) and 911 R are the collector standouts. 991.1 GT3 manuals are particularly prized. The last generation before full digital dash.",
    variants: PORSCHE_991_VARIANTS,
  },
  {
    id: "997",
    label: "997",
    family: "911 Family",
    yearRange: [2005, 2012],
    order: 3,
    keywords: ["997"],
    yearFallback: [2005, 2012],
    thesis: "The 997 returned to round headlights and refined the 911 formula. GT3 RS 4.0 is the crown jewel. GT2 RS is the most powerful. 997.2 models benefit from the improved DFI engine. Strong collector demand across all variants.",
    variants: PORSCHE_997_VARIANTS,
  },
  {
    id: "996",
    label: "996",
    family: "911 Family",
    yearRange: [1998, 2005],
    order: 4,
    keywords: ["996"],
    yearFallback: [1998, 2005],
    thesis: "The 996 was the first water-cooled 911 — controversial but undervalued. GT3 and GT2 variants are highly collectible. Turbo models offer incredible value. The 996 is the entry point for modern 911 collecting.",
    variants: PORSCHE_996_VARIANTS,
  },
  {
    id: "993",
    label: "993",
    family: "911 Family",
    yearRange: [1994, 1998],
    order: 5,
    keywords: ["993"],
    yearFallback: [1994, 1998],
    thesis: "The 993 is the last air-cooled 911 and the most sought-after modern Porsche. Turbo, GT2, and RS models command top dollar. Carrera S and 4S are strong performers. Every variant is collectible.",
    variants: PORSCHE_993_VARIANTS,
  },
  {
    id: "964",
    label: "964",
    family: "911 Family",
    yearRange: [1989, 1994],
    order: 6,
    keywords: ["964"],
    yearFallback: [1989, 1994],
    thesis: "The 964 modernized the 911 with coil springs and ABS while retaining air-cooled character. RS and RS America are trophy assets. Turbo 3.6 is a powerhouse. Clean Carrera 4 and Carrera 2 examples are rising fast.",
    variants: PORSCHE_964_VARIANTS,
  },
  {
    id: "930",
    label: "930 Turbo",
    family: "911 Family",
    yearRange: [1975, 1989],
    order: 7,
    keywords: ["930"],
    titleKeywords: ["911 turbo", "turbo carrera"],
    turboOnly: false,
    thesis: "The 930 is the original 911 Turbo — widowmaker reputation and iconic whale tail. Flachbau (slantnose) variants are ultra-rare. Early 3.0L models carry the most heritage. A poster-car legend.",
    variants: PORSCHE_930_VARIANTS,
  },
  {
    id: "g-model",
    label: "911 SC/Carrera (G)",
    family: "911 Family",
    yearRange: [1974, 1989],
    order: 8,
    keywords: ["911 sc", "911 carrera 3.2", "g-model", "g model"],
    yearFallback: [1974, 1989],
    thesis: "The G-model 911 spans the SC and Carrera 3.2 era. The Carrera 3.2 is considered the last classic 911. SC Targa models offer accessible air-cooled ownership. Club Sport variants are rare finds.",
    variants: PORSCHE_GMODEL_VARIANTS,
  },
  {
    id: "f-model",
    label: "911 (F-Model)",
    family: "911 Family",
    yearRange: [1963, 1973],
    order: 9,
    keywords: ["911s", "911t", "911e", "911l", "f-model", "f model"],
    yearFallback: [1963, 1973],
    thesis: "The original 911 — where the legend began. S, T, E, and L variants each have distinct character. 2.7 RS is the holy grail. Early long-hood cars are the most valuable. Matching-numbers examples command premiums.",
    variants: PORSCHE_FMODEL_VARIANTS,
  },
  {
    id: "912",
    label: "912",
    family: "911 Family",
    yearRange: [1965, 1969],
    order: 10,
    keywords: ["912"],
    thesis: "The 912 is the four-cylinder 911. Affordable entry to classic Porsche ownership with identical styling. Values are climbing as 911 prices push buyers toward alternatives. Clean examples are scarce.",
    variants: PORSCHE_912_VARIANTS,
  },

  // ── GT & Hypercars ──
  {
    id: "918",
    label: "918 Spyder",
    family: "GT & Hypercars",
    yearRange: [2013, 2015],
    order: 11,
    keywords: ["918"],
    thesis: "Porsche's hybrid hypercar masterpiece. Only 918 units produced. Weissach Package examples are the most sought after. Values have been on an upward trajectory since production ended in 2015.",
    variants: PORSCHE_918_VARIANTS,
  },
  {
    id: "carrera-gt",
    label: "Carrera GT",
    family: "GT & Hypercars",
    yearRange: [2004, 2007],
    order: 12,
    keywords: ["carrera gt"],
    thesis: "The last analog Porsche supercar. V10 engine, manual gearbox, no driver aids. Only 1,270 built. Regarded by many as the greatest driver's car ever made. Values continue to climb.",
    variants: PORSCHE_CARRERA_GT_VARIANTS,
  },
  {
    id: "959",
    label: "959",
    family: "GT & Hypercars",
    yearRange: [1986, 1993],
    order: 13,
    keywords: ["959"],
    thesis: "The most technologically advanced car of the 1980s. Only 337 built. Twin-turbo flat-six with AWD and adjustable suspension. A cornerstone of any serious Porsche collection.",
    variants: PORSCHE_959_VARIANTS,
  },

  // ── Mid-Engine ──
  {
    id: "718-cayman",
    label: "718 Cayman",
    family: "Mid-Engine",
    yearRange: [2016, 2026],
    order: 14,
    keywords: ["718 cayman"],
    thesis: "Modern mid-engine Porsche carrying the historic 718 name. GT4 RS is the standout collector variant with the 4.0L GT3 engine. Base four-cylinder turbos are driver-focused but less collectible.",
    variants: PORSCHE_718_CAYMAN_VARIANTS,
  },
  {
    id: "718-boxster",
    label: "718 Boxster",
    family: "Mid-Engine",
    yearRange: [2016, 2026],
    order: 15,
    keywords: ["718 boxster"],
    thesis: "The 718 Boxster Spyder with the 4.0L flat-six is the collector pick. GTS 4.0 offers similar thrills at a lower price. The flat-four base models are focused on driving experience.",
    variants: PORSCHE_718_BOXSTER_VARIANTS,
  },
  {
    id: "cayman",
    label: "Cayman (981/987)",
    family: "Mid-Engine",
    yearRange: [2005, 2016],
    order: 16,
    keywords: ["cayman"],
    thesis: "The Cayman is the mid-engine purist's choice. GT4 variants are especially collectible. 981 and 987 six-cylinder cars are increasingly desirable as the 718 went four-cylinder.",
    variants: PORSCHE_CAYMAN_VARIANTS,
  },
  {
    id: "boxster",
    label: "Boxster (986/987/981)",
    family: "Mid-Engine",
    yearRange: [1996, 2016],
    order: 17,
    keywords: ["boxster"],
    thesis: "The Boxster revived Porsche in the 1990s. Spyder variants are the collector picks. The 987 and 981 generations offer the best balance of analog driving and modern reliability.",
    variants: PORSCHE_BOXSTER_VARIANTS,
  },
  {
    id: "914",
    label: "914",
    family: "Mid-Engine",
    yearRange: [1969, 1976],
    order: 18,
    keywords: ["914"],
    thesis: "Porsche's joint venture with VW. Six-cylinder /6 models are rare and valuable. The 2.0L variant offers the best performance. An undervalued classic gaining recognition.",
    variants: PORSCHE_914_VARIANTS,
  },

  // ── Transaxle Classics ──
  {
    id: "944",
    label: "944",
    family: "Transaxle Classics",
    yearRange: [1982, 1991],
    order: 19,
    keywords: ["944"],
    thesis: "The quintessential affordable Porsche classic. Turbo and S2 variants are most sought after. Clean, low-mileage examples are becoming scarce and values are trending upward.",
    variants: PORSCHE_944_VARIANTS,
  },
  {
    id: "928",
    label: "928",
    family: "Transaxle Classics",
    yearRange: [1978, 1995],
    order: 20,
    keywords: ["928"],
    thesis: "Porsche's V8 grand tourer, intended to replace the 911. GTS models are the most collectible. Values have risen significantly as enthusiasts rediscover this front-engine gem.",
    variants: PORSCHE_928_VARIANTS,
  },
  {
    id: "968",
    label: "968",
    family: "Transaxle Classics",
    yearRange: [1992, 1995],
    order: 21,
    keywords: ["968"],
    thesis: "The final evolution of the transaxle Porsches. Club Sport models are the collector's pick. Only produced for four years, making it one of the rarest modern Porsches.",
    variants: PORSCHE_968_VARIANTS,
  },
  {
    id: "924",
    label: "924",
    family: "Transaxle Classics",
    yearRange: [1976, 1988],
    order: 22,
    keywords: ["924"],
    thesis: "An entry point into classic Porsche ownership. Carrera GT and Turbo models are the standouts. Values remain accessible but climbing for top examples.",
    variants: PORSCHE_924_VARIANTS,
  },

  // ── Heritage ──
  {
    id: "356",
    label: "356",
    family: "Heritage",
    yearRange: [1948, 1965],
    order: 23,
    keywords: ["356"],
    thesis: "Where it all began — Porsche's first production car. Speedsters and Carreras are the most desirable. Pre-A examples carry the strongest historical significance.",
    variants: PORSCHE_356_VARIANTS,
  },

  // ── SUV & Sedan ──
  {
    id: "cayenne",
    label: "Cayenne",
    family: "SUV & Sedan",
    yearRange: [2003, 2026],
    order: 24,
    keywords: ["cayenne"],
    thesis: "The Cayenne saved Porsche financially and became the benchmark performance SUV. Turbo GT variants push supercar performance. High liquidity and broad appeal.",
    variants: [
      { id: "base", label: "Base", keywords: ["cayenne"] },
      { id: "s", label: "S", keywords: ["cayenne s"] },
      { id: "gts", label: "GTS", keywords: ["gts"] },
      { id: "turbo", label: "Turbo", keywords: ["turbo"] },
      { id: "turbo-gt", label: "Turbo GT", keywords: ["turbo gt"] },
      { id: "coupe", label: "Coupe", keywords: ["coupe", "coupé"] },
      { id: "e-hybrid", label: "E-Hybrid", keywords: ["e-hybrid", "hybrid"] },
    ],
  },
  {
    id: "macan",
    label: "Macan",
    family: "SUV & Sedan",
    yearRange: [2014, 2026],
    order: 25,
    keywords: ["macan"],
    thesis: "Porsche's best-selling model. GTS variants offer the best balance. The new electric Macan represents Porsche's EV future. Strong daily-driver appeal with Porsche DNA.",
  },
  {
    id: "panamera",
    label: "Panamera",
    family: "SUV & Sedan",
    yearRange: [2009, 2026],
    order: 26,
    keywords: ["panamera"],
    thesis: "The Panamera proved a four-door Porsche could work. Turbo S and Sport Turismo are most desirable. E-Hybrid models offer a glimpse of the electric future.",
    variants: PORSCHE_PANAMERA_VARIANTS,
  },
  {
    id: "taycan",
    label: "Taycan",
    family: "SUV & Sedan",
    yearRange: [2020, 2026],
    order: 27,
    keywords: ["taycan"],
    thesis: "Porsche's electric sports sedan. Turbo S delivers hypercar acceleration. Cross Turismo adds versatility. Leading the luxury EV segment with genuine Porsche character.",
    variants: PORSCHE_TAYCAN_VARIANTS,
  },
]

const PORSCHE_FAMILY_GROUPS: FamilyGroup[] = [
  { id: "911-family",   label: "911 Family",         order: 1, seriesIds: ["992", "991", "997", "996", "993", "964", "930", "g-model", "f-model", "912"] },
  { id: "gt-hyper",     label: "GT & Hypercars",     order: 2, seriesIds: ["918", "carrera-gt", "959"] },
  { id: "mid-engine",   label: "Mid-Engine",         order: 3, seriesIds: ["718-cayman", "718-boxster", "cayman", "boxster", "914"] },
  { id: "transaxle",    label: "Transaxle Classics",  order: 4, seriesIds: ["944", "928", "968", "924"] },
  { id: "heritage",     label: "Heritage",           order: 5, seriesIds: ["356"] },
  { id: "suv-sedan",    label: "SUV & Sedan",        order: 6, seriesIds: ["cayenne", "macan", "panamera", "taycan"] },
]

const PORSCHE: BrandConfig = {
  name: "Porsche",
  slug: "porsche",
  series: PORSCHE_SERIES,
  familyGroups: PORSCHE_FAMILY_GROUPS,
  ownershipCosts: { insurance: 8500, storage: 6000, maintenance: 8000 },
  marketDepth: { auctionsPerYear: 340, avgDaysToSell: 12, sellThroughRate: 89, demandScore: 9 },
  defaultThesis: "Porsche represents the pinnacle of sports car engineering with strong collector car fundamentals across all model lines.",
}

// ─── BRAND REGISTRY ───
// Add new brands here. All components read from this registry.

const BRAND_REGISTRY: Record<string, BrandConfig> = {
  porsche: PORSCHE,
  // ferrari: FERRARI,  ← future
  // bmw: BMW,          ← future
}

// ─── HELPER FUNCTIONS ───

export function getBrandConfig(make: string): BrandConfig | null {
  return BRAND_REGISTRY[make.toLowerCase()] || null
}

export function getAllBrands(): BrandConfig[] {
  return Object.values(BRAND_REGISTRY)
}

/**
 * Extract series ID from a model string + year.
 * Works for any brand that has a config in the registry.
 *
 * Examples (Porsche):
 *   extractSeries("993 Turbo", 1996, "Porsche")  → "993"
 *   extractSeries("911 Carrera", 2020, "Porsche") → "992"  (year fallback)
 *   extractSeries("Cayenne S", 2022, "Porsche")   → "cayenne"
 *   extractSeries("GT3 RS", 2023, "Porsche")      → "992"
 *
 * For brands without config, returns the first word of the model.
 */
export function extractSeries(model: string, year: number, make: string, title?: string): string {
  const config = getBrandConfig(make)
  if (!config) {
    // No config for this brand — return first word as fallback
    return model.replace(new RegExp(`^${make}\\s+`, "i"), "").split(/\s+/)[0] || model
  }

  const cleanModel = model.replace(new RegExp(`^${make}\\s+`, "i"), "").trim()
  const lowerModel = cleanModel.toLowerCase()

  // Pass 1: Match by explicit keywords (most specific first — longer keywords matched first)
  const sortedByKeywordLength = [...config.series].sort(
    (a, b) => Math.max(...b.keywords.map(k => k.length)) - Math.max(...a.keywords.map(k => k.length))
  )

  for (const series of sortedByKeywordLength) {
    for (const keyword of series.keywords) {
      if (lowerModel.includes(keyword.toLowerCase())) {
        // Special case: 930 only matches non-turbo when model explicitly says "930"
        if (series.turboOnly && !lowerModel.includes("turbo")) continue
        return series.id
      }
    }
  }

  // Pass 1b: Title refinement — if model was too generic (e.g. "911"), check the title
  // for more specific series keywords before falling back to year-based guessing.
  // Checks both regular keywords and titleKeywords (year-range gated for safety).
  if (title) {
    const lowerTitle = title.toLowerCase()
    for (const series of sortedByKeywordLength) {
      if (year > 0 && series.yearRange) {
        if (year < series.yearRange[0] || year > series.yearRange[1]) continue
      }
      const allKeywords = [...series.keywords, ...(series.titleKeywords || [])]
      for (const keyword of allKeywords) {
        if (lowerTitle.includes(keyword.toLowerCase())) {
          if (series.turboOnly && !lowerTitle.includes("turbo")) continue
          return series.id
        }
      }
    }
  }

  // Pass 2: Year fallback for ambiguous models (e.g. "911 Carrera" without generation code)
  // Check if model contains a family-level keyword that multiple series share
  const seriesWithYearFallback = config.series.filter(s => s.yearFallback)
  for (const series of seriesWithYearFallback) {
    if (year >= series.yearFallback![0] && year <= series.yearFallback![1]) {
      // Check if this series' family matches something in the model
      // e.g., "911" is in model and this series is in 911 Family
      const familyGroup = config.familyGroups.find(g => g.seriesIds.includes(series.id))
      if (familyGroup) {
        const familyKeywords = getFamilyKeywords(familyGroup.id)
        if (familyKeywords.some(kw => lowerModel.includes(kw))) {
          return series.id
        }
      }
    }
  }

  // Pass 3: Fallback to first word
  return cleanModel.split(/\s+/)[0] || cleanModel
}

// Family-level keywords for year-fallback matching
function getFamilyKeywords(familyGroupId: string): string[] {
  switch (familyGroupId) {
    case "911-family": return ["911", "carrera", "targa", "turbo", "gt3", "gt2"]
    default: return []
  }
}

/**
 * Get the series config for a given series ID and make.
 */
export function getSeriesConfig(seriesId: string, make: string): SeriesConfig | null {
  const config = getBrandConfig(make)
  if (!config) return null
  return config.series.find(s => s.id === seriesId) || null
}

/**
 * Returns model ILIKE patterns + optional year range for a series.
 * Used by fetchPaginatedListings to filter at the DB level.
 */
export function getModelPatternsForSeries(
  seriesId: string,
  make: string
): { keywords: string[]; yearMin?: number; yearMax?: number } | null {
  const series = getSeriesConfig(seriesId, make)
  if (!series) return null

  // For series with yearFallback (e.g. 911 generations like 992, 991, 997…),
  // include the family-level keywords so the DB query matches models like
  // "911 Carrera S" in the correct year range — not just literal "992".
  const keywords = [...series.keywords]
  if (series.yearFallback) {
    const config = getBrandConfig(make)
    if (config) {
      const familyGroup = config.familyGroups.find(g => g.seriesIds.includes(seriesId))
      if (familyGroup) {
        const familyKws = getFamilyKeywords(familyGroup.id)
        for (const kw of familyKws) {
          if (!keywords.includes(kw)) keywords.push(kw)
        }
      }
    }
  }

  return {
    keywords,
    yearMin: series.yearRange[0],
    yearMax: series.yearRange[1],
  }
}

/**
 * Get all series for a brand, sorted by display order.
 */
export function getSeriesForBrand(make: string): SeriesConfig[] {
  const config = getBrandConfig(make)
  if (!config) return []
  return [...config.series].sort((a, b) => a.order - b.order)
}

/**
 * Get family groups with their series for sidebar rendering.
 */
export function getFamilyGroupsWithSeries(make: string): (FamilyGroup & { series: SeriesConfig[] })[] {
  const config = getBrandConfig(make)
  if (!config) return []

  return config.familyGroups
    .sort((a, b) => a.order - b.order)
    .map(group => ({
      ...group,
      series: group.seriesIds
        .map(id => config.series.find(s => s.id === id))
        .filter((s): s is SeriesConfig => s !== null),
    }))
}

/**
 * Get the thesis text for a given series.
 */
export function getSeriesThesis(seriesId: string, make: string): string {
  const config = getBrandConfig(make)
  if (!config) return ""
  const series = config.series.find(s => s.id === seriesId)
  return series?.thesis || config.defaultThesis
}

/**
 * Get ownership costs for a brand, optionally scaled by car price.
 */
export function getOwnershipCosts(make: string, scaleFactor = 1): { insurance: number; storage: number; maintenance: number } {
  const config = getBrandConfig(make)
  const costs = config?.ownershipCosts || { insurance: 5000, storage: 4800, maintenance: 5000 }
  return {
    insurance: Math.round(costs.insurance * scaleFactor),
    storage: Math.round(costs.storage * scaleFactor),
    maintenance: Math.round(costs.maintenance * scaleFactor),
  }
}

/**
 * Get market depth data for a brand.
 */
export function getMarketDepth(make: string) {
  const config = getBrandConfig(make)
  return config?.marketDepth || { auctionsPerYear: 80, avgDaysToSell: 20, sellThroughRate: 78, demandScore: 7 }
}

// ─── BODY TYPE DERIVATION ───

const BODY_TYPE_RULES: { type: BodyType; keywords: string[] }[] = [
  { type: "Targa",       keywords: ["targa"] },
  { type: "Speedster",   keywords: ["speedster", "spyder"] },
  { type: "Convertible", keywords: ["cabriolet", "convertible", "cabrio", "roadster", "drop top"] },
  { type: "Wagon",       keywords: ["sport turismo", "cross turismo", "shooting brake", "wagon"] },
  { type: "SUV",         keywords: ["cayenne", "macan"] },
  { type: "Sedan",       keywords: ["panamera", "taycan"] },
  { type: "Coupe",       keywords: ["coupe", "coupé"] },
]

/**
 * Derive body type from model/trim/category strings.
 * Priority: keyword match → series family fallback → Unknown.
 */
export function deriveBodyType(model: string, trim: string | null, category: string | undefined, make: string, year?: number): BodyType {
  const searchText = [model, trim, category].filter(Boolean).join(" ").toLowerCase()

  for (const rule of BODY_TYPE_RULES) {
    if (rule.keywords.some(kw => searchText.includes(kw))) {
      return rule.type
    }
  }

  // Fallback: infer from series family
  const seriesId = extractSeries(model, year || 0, make)
  const config = getBrandConfig(make)
  if (config) {
    const series = config.series.find(s => s.id === seriesId)
    if (series) {
      if (["cayenne", "macan"].includes(series.id)) return "SUV"
      if (["panamera", "taycan"].includes(series.id)) return "Sedan"
      if (series.id.includes("boxster")) return "Convertible"
      if (["911 Family", "Transaxle Classics", "GT & Hypercars", "Heritage", "Mid-Engine"].includes(series.family)) return "Coupe"
    }
  }
  return "Unknown"
}

// ─── VARIANT HELPERS ───

/**
 * Get variants for a given series.
 */
export function getSeriesVariants(seriesId: string, make: string): VariantConfig[] {
  const series = getSeriesConfig(seriesId, make)
  return series?.variants || []
}

/**
 * Match a car to a variant within its series.
 * Returns the variant ID, or null if no match.
 */
export function matchVariant(model: string, trim: string | null, seriesId: string, make: string, title?: string): string | null {
  const variants = getSeriesVariants(seriesId, make)
  if (variants.length === 0) return null

  const searchText = [model, trim, title].filter(Boolean).join(" ").toLowerCase()

  // Sort by longest keyword first (most specific match wins)
  const sorted = [...variants].sort(
    (a, b) => Math.max(...b.keywords.map(k => k.length)) - Math.max(...a.keywords.map(k => k.length))
  )

  for (const variant of sorted) {
    if (variant.keywords.some(kw => searchText.includes(kw.toLowerCase()))) {
      return variant.id
    }
  }
  return null
}
