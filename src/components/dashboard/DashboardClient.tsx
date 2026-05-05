"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { motion } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatUsd, resolveRegion } from "@/lib/regionPricing"
import { useCurrency } from "@/lib/CurrencyContext"
import { filterLiveSidebarAuctions, useLiveSidebarListings } from "./sidebar/useLiveSidebarListings"
import {
  Clock,
  MapPin,
  Gauge,
  Cog,
  Gavel,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Scale,
  BarChart3,
  Calendar,
  Award,
  Globe,
  DollarSign,
  Wrench,
  Shield,
  Car,
  Search,
  SlidersHorizontal,
  Flame,
  ChevronDown,
} from "lucide-react"
import { getBrandImage, getModelImage } from "@/lib/modelImages"
import { extractSeries, getSeriesConfig, getSeriesThesis, getBrandConfig } from "@/lib/brandConfig"
import { filterAuctionsForRegion, isAuctionPlatform, isListingPlatform } from "./platformMapping"
import { listingPriceUsd, computeRegionalValFromAuctions } from "./utils/valuation"
import { selectBestDatabaseImage } from "./utils/aggregation"
import { MarketDeltaPill } from "@/components/report/MarketDeltaPill"
import { RegionalValuationSection } from "./context/shared/RegionalValuation"
import type { CanonicalMarket, SegmentStats } from "@/lib/pricing/types"
// FilterSidebar removed — filters now live only on brand detail pages

// ─── Upgrade low-res image URLs to high-res ───
// Some scraped images (especially older AutoScout24 data) store thumbnail URLs.
// This upgrades them to high-resolution variants at display time.
function upgradeImageUrl(url: string): string {
  // AutoScout24: /250x188.webp or /400x300.webp → /1280x960.webp
  if (url.includes("autoscout24.net")) {
    return url.replace(/\/\d+x\d+\.webp$/, "/1280x960.webp")
  }
  return url
}

// ─── SORT PRIORITY: dealer/classified platforms first (Elferspot highest) ───
const PLATFORM_SORT_PRIORITY: Record<string, number> = {
  ELFERSPOT: 0,
  AUTO_SCOUT_24: 1,
  AUTO_TRADER: 2,
  CLASSIC_COM: 3,
  BE_FORWARD: 4,
}
function getPlatformSortPriority(platform: string): number {
  return PLATFORM_SORT_PRIORITY[platform] ?? 10
}

// ─── BRAND TYPE ───
type Brand = {
  name: string
  slug: string
  carCount: number
  priceMin: number
  priceMax: number
  medianPriceUsd: number
  avgTrend: string
  representativeImage: string
  representativeCar: string
  categories: string[]
}

type RegionalPricing = {
  currency: "$" | "€" | "£" | "¥"
  low: number
  high: number
}

type FairValueByRegion = {
  US: RegionalPricing
  EU: RegionalPricing
  UK: RegionalPricing
  JP: RegionalPricing
}

type Auction = {
  id: string
  title: string
  make: string
  model: string
  year: number
  trim: string | null
  price: number
  currentBid: number
  bidCount: number
  viewCount: number
  watchCount: number
  status: string
  endTime: string
  platform: string
  engine: string | null
  transmission: string | null
  exteriorColor: string | null
  mileage: number | null
  mileageUnit: string | null
  location: string | null
  region?: string | null
  description: string | null
  images: string[]
  analysis: {
    bidTargetLow: number | null
    bidTargetHigh: number | null
    confidence: string | null
    appreciationPotential: string | null
    keyStrengths: string[]
    redFlags: string[]
  } | null
  priceHistory: { price: number; timestamp: string }[]
  fairValueByRegion?: FairValueByRegion
  category?: string
  originalCurrency?: string | null
  canonicalMarket?: CanonicalMarket | null
  family?: string | null
  soldPriceUsd?: number | null
  askingPriceUsd?: number | null
  valuationBasis?: "sold" | "asking" | "unknown"
}

/**
 * Resolve the fair-value low/high USD range for an auction, using real segment IQR bands.
 * Returns null when there's insufficient data in the corresponding (market, family) segment.
 */
function resolveFairValueBand(
  auction: Auction,
  familyAuctions: Auction[],
  cachedFamilyValuation?: Partial<Record<CanonicalMarket, SegmentStats>>,
): { low: number; high: number } | null {
  // Prefer an explicit analysis band if present (upstream scoring system).
  const lo = auction.analysis?.bidTargetLow
  const hi = auction.analysis?.bidTargetHigh
  if (lo != null && hi != null && lo > 0 && hi > 0) return { low: lo, high: hi }

  const market: CanonicalMarket | null = auction.canonicalMarket ?? null
  const family = auction.family ?? null
  if (!market || !family) return null

  const cachedSegment = cachedFamilyValuation?.[market]
  if (cachedSegment) {
    const cachedLow = cachedSegment.marketValue.p25Usd ?? cachedSegment.askMedian.p25Usd
    const cachedHigh = cachedSegment.marketValue.p75Usd ?? cachedSegment.askMedian.p75Usd
    if (cachedLow != null && cachedHigh != null && cachedLow > 0 && cachedHigh > 0) {
      return { low: Math.round(cachedLow), high: Math.round(cachedHigh) }
    }
  }

  const regionalVal = computeRegionalValFromAuctions(familyAuctions)
  const segment = regionalVal[market]
  if (!segment) return null
  const low = segment.marketValue.p25Usd ?? segment.askMedian.p25Usd
  const high = segment.marketValue.p75Usd ?? segment.askMedian.p75Usd
  if (low == null || high == null || low <= 0 || high <= 0) return null
  return { low: Math.round(low), high: Math.round(high) }
}

function pickBestSegment(regionalVal: Partial<Record<CanonicalMarket, SegmentStats>> | undefined): SegmentStats | null {
  if (!regionalVal) return null

  let best: SegmentStats | null = null
  for (const market of ["US", "EU", "UK", "JP"] as const) {
    const segment = regionalVal[market]
    if (!segment) continue
    if (!best || segment.marketValue.soldN > best.marketValue.soldN) {
      best = segment
    }
  }

  return best
}

function useClockNow(updateMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), updateMs)
    return () => clearInterval(id)
  }, [updateMs])

  return now
}

// ─── PORSCHE FAMILY TYPE (for family-based landing scroll) ───
type PorscheFamily = {
  name: string
  slug: string
  carCount: number
  priceMin: number
  priceMax: number
  medianPriceUsd: number
  yearMin: number
  yearMax: number
  representativeImage: string
  fallbackImage: string
  representativeCar: string
}

type LiveRegionTotals = {
  all: number
  US: number
  UK: number
  EU: number
  JP: number
}

type SeriesCountsByRegion = {
  all: Record<string, number>
  US: Record<string, number>
  UK: Record<string, number>
  EU: Record<string, number>
  JP: Record<string, number>
}

const platformShort: Record<string, string> = {
  BRING_A_TRAILER: "BaT",
  RM_SOTHEBYS: "RM",
  GOODING: "G&C",
  BONHAMS: "BON",
  CARS_AND_BIDS: "C&B",
  COLLECTING_CARS: "CC",
  AUTO_SCOUT_24: "AS24",
  AUTO_TRADER: "AT",
  BE_FORWARD: "BF",
  CLASSIC_COM: "Cls",
  ELFERSPOT: "ES",
}

// ─── UNIVERSAL MOCK DATA ───
// This ensures EVERY car shows rich data in the Context Panel
const mockWhyBuy: Record<string, string> = {
  McLaren: "The McLaren F1 represents the pinnacle of analog supercar engineering. Extreme scarcity with only 64 road cars ensures lasting collector interest and consistent auction presence.",
  Porsche: "The 911 Carrera RS 2.7 is the foundation of Porsche's motorsport legacy. As the first homologation special, it carries historical significance that transcends typical collector car metrics. Strong club support and cross-generational appeal make this a cornerstone holding.",
  Ferrari: "Ferrari's timeless design combined with the legendary Colombo V12 creates an investment-grade asset. Classiche certification ensures authenticity. This model has demonstrated remarkable price stability even during market corrections.",
  Lamborghini: "Lamborghini's first true supercar remains the most desirable variant. Polo Storico certification adds provenance value. The mid-engine layout influenced every supercar that followed, cementing its historical importance.",
  Nissan: "The R34 GT-R represents the peak of Japanese engineering excellence. With 25-year import eligibility now active in the US, demand continues to grow as 25-year import eligibility expands the collector base. Low production numbers and strong enthusiast community support lasting value.",
  Toyota: "The A80 Supra has achieved icon status, bolstered by pop culture prominence and bulletproof 2JZ reliability. Clean, stock examples are increasingly rare as many were modified. Turbo 6-speed variants command significant premiums.",
  BMW: "The E30 M3 is widely regarded as the quintessential driver's car. Motorsport heritage and timeless design ensure lasting desirability. Sport Evolution and lightweight variants show strongest collector demand.",
  Mercedes: "Mercedes-Benz classics combine engineering excellence with timeless elegance. Strong parts availability and active restoration community support long-term ownership. Coupe and Cabriolet variants show strongest appreciation.",
  "Aston Martin": "The quintessential British grand tourer. James Bond association ensures global recognition. Strong club support and active restoration community. DB-series cars show consistent appreciation and strong auction presence.",
  Jaguar: "British elegance meets Le Mans-winning pedigree. The XJ220 was underappreciated for decades but collector interest is growing as the market recognizes its engineering significance.",
  Mazda: "The RX-7 FD represents the pinnacle of rotary engine development. Spirit R editions are especially collectible. As the final true rotary sports car, scarcity supports strong collector value.",
  Honda: "Honda's engineering excellence shines in the S2000. The F20C/F22C engines are legendary for their 9,000 RPM redline. CR variants command significant premiums for their track-focused specification.",
  Shelby: "Carroll Shelby's Cobra is the ultimate American sports car legend. 427 examples represent the pinnacle of analog performance. CSX-documented cars command top dollar at auction.",
  Chevrolet: "The C2 Corvette Stingray is America's sports car at its most beautiful. Big block variants with manual transmissions are the collector's choice. Strong club support ensures lasting value.",
  Bugatti: "The EB110 represents Bugatti's modern renaissance. Quad-turbo V12, carbon chassis, and AWD were revolutionary for 1991. With only 139 built, scarcity drives strong appreciation.",
  Lancia: "The Stratos is the most successful rally car ever, dominating World Rally Championship from 1974-1976. Ferrari Dino V6 power and Bertone design ensure eternal collector appeal.",
  "De Tomaso": "Italian design meets American V8 power. The Mangusta's Giugiaro styling and rare production numbers make it an undervalued blue chip. Recognition is growing among serious collectors.",
  Alpine: "The A110 is France's answer to the Porsche 911. Lightweight, agile, and proven in competition. The 1600S is the ultimate road specification. Values rising as recognition spreads globally.",
  default: "This vehicle represents a compelling opportunity in the collector car market. Strong fundamentals, limited production, and growing collector interest suggest strong collector market presence.",
}

const REGION_FLAGS: Record<string, string> = { US: "\u{1F1FA}\u{1F1F8}", UK: "\u{1F1EC}\u{1F1E7}", EU: "\u{1F1EA}\u{1F1FA}", JP: "\u{1F1EF}\u{1F1F5}" }

const REGION_LABEL_KEYS = {
  US: "brandContext.regionUS",
  UK: "brandContext.regionUK",
  EU: "brandContext.regionEU",
  JP: "brandContext.regionJP",
} as const

// Locale-stable integer formatter — pinned to en-US so SSR (Node) and the
// browser (which may be on /de or /ja) produce the same thousand separator,
// avoiding React hydration mismatches.
const FMT_REGIONAL_INT = new Intl.NumberFormat("en-US")

// Local helper: format a price already in a regional currency (e.g. fairValueByRegion data)
function fmtRegional(amount: number, symbol: string) {
  if (amount >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${symbol}${FMT_REGIONAL_INT.format(Math.round(amount / 1_000))}K`
  return `${symbol}${FMT_REGIONAL_INT.format(Math.round(amount))}`
}

// ─── AGGREGATE AUCTIONS BY BRAND ───
function aggregateBrands(auctions: Auction[], rates: Record<string, number>, dbTotalOverride?: number): Brand[] {
  const brandMap = new Map<string, Auction[]>()

  // Group by make
  auctions
    .filter(a => a.status === "ACTIVE" || a.status === "ENDING_SOON")
    .forEach(auction => {
      const existing = brandMap.get(auction.make) || []
      existing.push(auction)
      brandMap.set(auction.make, existing)
    })

  // Convert to Brand array with stats
  const brands: Brand[] = []
  brandMap.forEach((cars, name) => {
    const prices = cars.map(c => listingPriceUsd(c, rates)).filter(p => p > 0)
    const categories = [...new Set(cars.map(c => c.category).filter(Boolean))]

    // Median price (factual metric, replaces grade for ranking)
    const sortedPrices = [...prices].sort((a, b) => a - b)
    const medianPriceUsd = sortedPrices.length > 0
      ? sortedPrices[Math.floor(sortedPrices.length / 2)]
      : 0

    // Pick the best real DB image for this brand:
    // Prefer listing/dealer platforms (verified photos), then highest price
    const carsWithImages = cars
      .filter(c => c.images?.length > 0)
      .sort((a, b) => {
        const aListing = isListingPlatform(a.platform) ? 0 : 1
        const bListing = isListingPlatform(b.platform) ? 0 : 1
        if (aListing !== bListing) return aListing - bListing
        return listingPriceUsd(b, rates) - listingPriceUsd(a, rates)
      })
    const mostExpensiveCar = cars.reduce((max, car) =>
      listingPriceUsd(car, rates) > listingPriceUsd(max, rates) ? car : max
    , cars[0])

    const rawHeroImage = carsWithImages[0]?.images?.[0]
    const heroImage = rawHeroImage ? upgradeImageUrl(rawHeroImage) : null
    const verifiedBrandImage = getBrandImage(name)
    const representativeImage = heroImage || verifiedBrandImage || "/cars/placeholder.svg"

    // Use DB aggregate count when available and there's a single brand (e.g. Porsche-only dashboard).
    // This shows the true DB total instead of the capped fetched sample.
    const count = (dbTotalOverride && brandMap.size === 1) ? dbTotalOverride : cars.length

    brands.push({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      carCount: count,
      priceMin: prices.length > 0 ? Math.min(...prices) : 0,
      priceMax: prices.length > 0 ? Math.max(...prices) : 0,
      medianPriceUsd,
      avgTrend: "Active Market",
      representativeImage,
      representativeCar: `${mostExpensiveCar.year} ${mostExpensiveCar.make} ${mostExpensiveCar.model}`,
      categories: categories as string[],
    })
  })

  // Sort: Ferrari first (live data showcase), then by max price descending
  return brands.sort((a, b) => {
    if (a.name === "Ferrari" && b.name !== "Ferrari") return -1
    if (b.name === "Ferrari" && a.name !== "Ferrari") return 1
    return b.priceMax - a.priceMax
  })
}

// ─── AGGREGATE AUCTIONS BY PORSCHE FAMILY (for family-based landing) ───
function getFamilyPrestigeOrder(familyKey: string): number {
  const config = getSeriesConfig(familyKey.toLowerCase(), "Porsche")
  return config?.order ?? 99
}

function getFamilyDisplayName(familyKey: string): string {
  const config = getSeriesConfig(familyKey.toLowerCase(), "Porsche")
  return config?.label || familyKey
}

function aggregateFamilies(
  auctions: Auction[],
  historicalAuctions: Auction[],
  rates: Record<string, number>,
  dbSeriesCounts?: Record<string, number>,
  selectedRegion?: string | null,
  liveRegionTotals?: LiveRegionTotals
): PorscheFamily[] {
  const familyMap = new Map<string, Auction[]>()
  const historicalFamilyMap = new Map<string, Auction[]>()

  auctions
    .filter(a => a.status === "ACTIVE" || a.status === "ENDING_SOON")
    .forEach(auction => {
    const family = extractSeries(auction.model, auction.year, auction.make || "Porsche", auction.title)
    // Skip models that don't match any known Porsche series in brandConfig
    if (!getSeriesConfig(family, auction.make || "Porsche")) return
    const existing = familyMap.get(family) || []
    existing.push(auction)
    familyMap.set(family, existing)
  })

  historicalAuctions.forEach(auction => {
    const family = extractSeries(auction.model, auction.year, auction.make || "Porsche", auction.title)
    if (!getSeriesConfig(family, auction.make || "Porsche")) return
    const existing = historicalFamilyMap.get(family) || []
    existing.push(auction)
    historicalFamilyMap.set(family, existing)
  })

  // Region-aware scaling: when a region is selected, scale sample distribution
  // by the DB regional total (same approach as DiscoverySidebar)
  const dbTotal = selectedRegion && liveRegionTotals
    ? (liveRegionTotals[selectedRegion as keyof LiveRegionTotals] ?? liveRegionTotals.all)
    : liveRegionTotals?.all
  const sampleTotal = auctions.filter(a => a.status === "ACTIVE" || a.status === "ENDING_SOON").length

  const families: PorscheFamily[] = []
  familyMap.forEach((cars, familyKey) => {
    const prices = cars.map(c => listingPriceUsd(c, rates)).filter(p => p > 0)
    const years = cars.map(c => c.year)
    const historicalCars = historicalFamilyMap.get(familyKey) || []

    // Median price (factual metric, replaces grade for ranking)
    const sortedPrices = [...prices].sort((a, b) => a - b)
    const medianPriceUsd = sortedPrices.length > 0
      ? sortedPrices[Math.floor(sortedPrices.length / 2)]
      : 0

    const bestCar = cars.reduce((max, car) => listingPriceUsd(car, rates) > listingPriceUsd(max, rates) ? car : max, cars[0])

    const heroImage = selectBestDatabaseImage(cars, historicalCars)
    const staticFallback = getModelImage("Porsche", familyKey) || getBrandImage("Porsche") || ""

    let carCount: number
    if (selectedRegion && dbTotal && sampleTotal > 0) {
      // Region selected: scale sample distribution by DB regional total
      carCount = Math.round(cars.length / sampleTotal * dbTotal)
    } else {
      // All regions: use exact DB count if available, otherwise sample count
      carCount = dbSeriesCounts?.[familyKey] ?? cars.length
    }

    families.push({
      name: getFamilyDisplayName(familyKey),
      slug: familyKey.toLowerCase(),
      carCount,
      priceMin: prices.length > 0 ? Math.min(...prices) : 0,
      priceMax: prices.length > 0 ? Math.max(...prices) : 0,
      medianPriceUsd,
      yearMin: Math.min(...years),
      yearMax: Math.max(...years),
      representativeImage: heroImage || staticFallback,
      fallbackImage: staticFallback,
      representativeCar: `${bestCar.year} Porsche ${bestCar.model}`,
    })
  })

  // Pad with stubs for every series in brandConfig that has no auctions in the current
  // ACTIVE/ENDING_SOON sample, so the sidebar family click always lands on a card
  // (mirrors 993 behavior for 930, G-Model, F-Model, Carrera GT, 918 Spyder, 959,
  // pre-718 Cayman/Boxster, 914, 924, 928, 968, 718 Boxster — any series without live stock)
  const presentSlugs = new Set(families.map(f => f.slug))
  const brandConfig = getBrandConfig("Porsche")
  if (brandConfig) {
    for (const series of brandConfig.series) {
      const slug = series.id.toLowerCase()
      if (presentSlugs.has(slug)) continue
      const historicalCars = historicalFamilyMap.get(series.id) || []
      const historicalPrices = historicalCars.map(c => listingPriceUsd(c, rates)).filter(p => p > 0)
      const historicalYears = historicalCars.map(c => c.year).filter(year => Number.isFinite(year))
      const bestHistoricalCar = historicalCars.length > 0
        ? historicalCars.reduce((max, car) => listingPriceUsd(car, rates) > listingPriceUsd(max, rates) ? car : max, historicalCars[0])
        : null
      const staticImage = getModelImage("Porsche", series.id) || getBrandImage("Porsche") || ""
      const historicalImage = selectBestDatabaseImage([], historicalCars)
      const historicalMedianPrice = historicalPrices.length > 0
        ? [...historicalPrices].sort((a, b) => a - b)[Math.floor(historicalPrices.length / 2)]
        : 0
      families.push({
        name: series.label,
        slug,
        carCount: dbSeriesCounts?.[series.id] ?? 0,
        priceMin: historicalPrices.length > 0 ? Math.min(...historicalPrices) : 0,
        priceMax: historicalPrices.length > 0 ? Math.max(...historicalPrices) : 0,
        medianPriceUsd: historicalMedianPrice,
        yearMin: historicalYears.length > 0 ? Math.min(...historicalYears) : series.yearRange[0],
        yearMax: historicalYears.length > 0 ? Math.max(...historicalYears) : series.yearRange[1],
        representativeImage: historicalImage || staticImage,
        fallbackImage: staticImage,
        representativeCar: bestHistoricalCar ? `${bestHistoricalCar.year} Porsche ${bestHistoricalCar.model}` : series.label,
      })
    }
  }

  return families.sort((a, b) => {
    const orderA = getFamilyPrestigeOrder(a.slug)
    const orderB = getFamilyPrestigeOrder(b.slug)
    if (orderA !== orderB) return orderA - orderB
    return b.carCount - a.carCount
  })
}

function timeLeft(
  endTime: string,
  labels: { ended: string; day: string; hour: string; minute: string }
) {
  const diff = new Date(endTime).getTime() - Date.now()
  if (diff <= 0) return labels.ended
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}${labels.day} ${hrs}${labels.hour}`
  const mins = Math.floor((diff % 3600000) / 60000)
  return `${hrs}${labels.hour} ${mins}${labels.minute}`
}

// ─── SAFE IMAGE: renders fallback when the URL exists but fails to load ───
function SafeImage({
  src,
  alt,
  fallback,
  fallbackSrc,
  ...props
}: React.ComponentProps<typeof Image> & { fallback: React.ReactNode; fallbackSrc?: string }) {
  const [useFallback, setUseFallback] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const activeSrc = !useFallback ? src : fallbackSrc
  if (!activeSrc || (useFallback && fallbackFailed)) return <>{fallback}</>
  return (
    <Image
      key={String(activeSrc)}
      src={activeSrc}
      alt={alt}
      onError={() => {
        if (!useFallback && fallbackSrc) {
          setUseFallback(true)
        } else {
          setFallbackFailed(true)
        }
      }}
      {...props}
    />
  )
}

// ─── COLUMN B: BRAND CARD (NEW - replaces AssetCard on landing) ───
function BrandCard({ brand, index = 0 }: { brand: Brand; index?: number }) {
  const t = useTranslations("dashboard")
  const tv = useTranslations("valuation")
  const { formatPrice } = useCurrency()

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      <Link
        href={`/cars/${brand.slug}`}
        className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-card border border-border group cursor-pointer hover:border-primary/20 transition-all duration-300"
      >
        {/* TOP: CINEMATIC IMAGE */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
          <SafeImage
            src={brand.representativeImage}
            alt={brand.name}
            fill
            className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
            sizes="50vw"
            priority={index === 0}
            loading={index === 0 ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            fallback={
              <div className="absolute inset-0 bg-card flex items-center justify-center">
                <span className="text-muted-foreground text-lg">{brand.name}</span>
              </div>
            }
          />

          {/* Vignette gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent dark:from-card pointer-events-none" />

          {/* Car count badge */}
          <div className="absolute top-4 right-4">
            <span className="rounded-full bg-background/70 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-foreground">
              {t("brandCard.carsCount", { count: brand.carCount })}
            </span>
          </div>

          {/* Market delta pill */}
          <div className="absolute top-4 left-4">
            <MarketDeltaPill priceUsd={brand.priceMax} medianUsd={brand.medianPriceUsd} />
          </div>
        </div>

        {/* BOTTOM: BRAND INFO */}
        <div className="flex-1 w-full bg-card p-6 flex flex-col justify-between">
          {/* Brand name */}
          <div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
              {brand.name}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              {brand.representativeCar}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
            {/* Price Range */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{tv("askingRange")}</span>
              </div>
              <p className="text-[13px] tabular-nums text-foreground">
                {formatPrice(brand.priceMin)}–{formatPrice(brand.priceMax)}
              </p>
            </div>

            {/* Trend */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.trend")}</span>
              </div>
              <p className="text-[13px] font-semibold text-positive">{brand.avgTrend}</p>
            </div>

            {/* Collection */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Car className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.collection")}</span>
              </div>
              <p className="text-[13px] text-foreground">{t("brandCard.vehiclesCount", { count: brand.carCount })}</p>
            </div>
          </div>

          {/* Categories */}
          {brand.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {brand.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className="px-3 py-1 rounded-full bg-foreground/5 text-[10px] text-muted-foreground"
                >
                  {cat}
                </span>
              ))}
              {brand.categories.length > 3 && (
                <span className="px-3 py-1 rounded-full bg-foreground/5 text-[10px] text-muted-foreground">
                  {t("brandCard.more", { count: brand.categories.length - 3 })}
                </span>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] font-medium tracking-[0.1em] uppercase text-muted-foreground group-hover:text-primary transition-colors">
              {t("brandCard.exploreCollection")}
            </span>
            <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── FAMILY CARD (full-screen scroll card for Porsche families) ───
function FamilyCard({ family, index = 0 }: { family: PorscheFamily; index?: number }) {
  const t = useTranslations("dashboard")
  const tv = useTranslations("valuation")
  const { formatPrice } = useCurrency()

  const yearLabel = family.yearMin === family.yearMax
    ? `${family.yearMin}`
    : `${family.yearMin}–${family.yearMax}`

  return (
    <div className="h-[calc(100dvh-var(--app-header-h,80px))] w-full flex flex-col snap-start p-4">
      <Link
        href={`/cars/porsche?family=${encodeURIComponent(family.slug)}`}
        className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-card border border-border group cursor-pointer hover:border-primary/20 transition-all duration-300"
      >
        {/* TOP: CINEMATIC IMAGE */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
          <SafeImage
            src={family.representativeImage}
            alt={family.name}
            fill
            className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
            sizes="50vw"
            priority={index === 0}
            loading={index === 0 ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            fallbackSrc={family.fallbackImage}
            fallback={
              <div className="absolute inset-0 bg-card flex items-center justify-center">
                <span className="text-muted-foreground text-lg">{family.name}</span>
              </div>
            }
          />

          {/* Vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent dark:from-card pointer-events-none" />

          {/* Car count badge */}
          <div className="absolute top-4 right-4">
            <span className="rounded-full bg-background/70 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-foreground">
              {family.carCount} {family.carCount === 1 ? "car" : "cars"}
            </span>
          </div>

          {/* Market delta pill */}
          <div className="absolute top-4 left-4">
            <MarketDeltaPill priceUsd={family.priceMax} medianUsd={family.medianPriceUsd} />
          </div>
        </div>

        {/* BOTTOM: FAMILY INFO */}
        <div className="flex-1 w-full bg-card p-6 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-primary mb-1">
              Porsche
            </p>
            <h2 className="text-3xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
              {family.name}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              {family.representativeCar}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{tv("askingRange")}</span>
              </div>
              <p className="text-[13px] tabular-nums text-foreground">
                {formatPrice(family.priceMin)}–{formatPrice(family.priceMax)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">Years</span>
              </div>
              <p className="text-[13px] tabular-nums text-foreground">{yearLabel}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Car className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.collection")}</span>
              </div>
              <p className="text-[13px] text-foreground">{family.carCount} listings</p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] font-medium tracking-[0.1em] uppercase text-muted-foreground group-hover:text-primary transition-colors">
              Explore {family.name}
            </span>
            <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── MOBILE: REGION PILLS (sticky) ───
function MobileRegionPills() {
  const { selectedRegion, setSelectedRegion } = useRegion()
  const t = useTranslations("dashboard")
  const REGIONS = [
    { id: "all", label: t("sidebar.allRegions"), flag: "\u{1F30D}" },
    { id: "US", label: "US", flag: "\u{1F1FA}\u{1F1F8}" },
    { id: "UK", label: "UK", flag: "\u{1F1EC}\u{1F1E7}" },
    { id: "EU", label: "EU", flag: "\u{1F1EA}\u{1F1FA}" },
    { id: "JP", label: "JP", flag: "\u{1F1EF}\u{1F1F5}" },
  ]
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-1">
        {REGIONS.map((region) => {
          const isActive = (region.id === "all" && !selectedRegion) || selectedRegion === region.id
          return (
            <button
              key={region.id}
              onClick={() => setSelectedRegion(region.id === "all" ? null : region.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                isActive
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-muted-foreground bg-foreground/3 border border-transparent"
              }`}
            >
              <span className="text-[12px]">{region.flag}</span>
              <span>{region.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── MOBILE: HERO BRAND (first brand) ───
function MobileHeroBrand({ brand }: { brand: Brand }) {
  const t = useTranslations("dashboard")
  const { formatPrice } = useCurrency()

  return (
    <Link href={`/cars/${brand.slug}`} className="block relative">
      {/* Hero image */}
      <div className="relative h-[45dvh] w-full overflow-hidden">
        <SafeImage
          src={brand.representativeImage}
          alt={brand.name}
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
          referrerPolicy="no-referrer"
          fallback={
            <div className="absolute inset-0 bg-card flex items-center justify-center">
              <span className="text-muted-foreground text-2xl font-bold">{brand.name}</span>
            </div>
          }
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent dark:from-background dark:via-background/30 pointer-events-none" />

        {/* Market delta pill */}
        <div className="absolute top-4 left-4">
          <MarketDeltaPill priceUsd={brand.priceMax} medianUsd={brand.medianPriceUsd} />
        </div>

        {/* Car count */}
        <div className="absolute top-4 right-4">
          <span className="rounded-full bg-background/70 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium text-foreground">
            {t("brandCard.carsCount", { count: brand.carCount })}
          </span>
        </div>

        {/* Overlaid info at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
          <h2 className="text-3xl font-bold text-foreground tracking-tight">
            {brand.name}
          </h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {brand.representativeCar}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[16px] font-display font-medium text-primary">
              {formatPrice(brand.priceMin)} – {formatPrice(brand.priceMax)}
            </span>
            <span className="text-[12px] text-positive font-medium">{brand.avgTrend}</span>
          </div>
          {/* Categories */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {brand.categories.slice(0, 3).map((cat) => (
              <span
                key={cat}
                className="px-2.5 py-1 rounded-full bg-foreground/10 backdrop-blur-sm text-[10px] text-foreground/70"
              >
                {cat}
              </span>
            ))}
          </div>
          {/* Inline CTA */}
          <div className="flex items-center gap-1.5 mt-3 text-primary">
            <span className="text-[12px] font-semibold tracking-[0.1em] uppercase">
              {t("mobileFeed.viewCollection")}
            </span>
            <ChevronRight className="size-4" />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── MOBILE: BRAND ROW (compact) ───
function MobileBrandRow({ brand }: { brand: Brand }) {
  const t = useTranslations("dashboard")
  const { formatPrice } = useCurrency()

  return (
    <Link
      href={`/cars/${brand.slug}`}
      className="flex items-center gap-4 px-4 py-3.5 active:bg-foreground/3 transition-colors"
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-14 rounded-xl overflow-hidden shrink-0 bg-card">
        <SafeImage
          src={brand.representativeImage}
          alt={brand.name}
          fill
          className="object-cover"
          sizes="80px"
          loading="lazy"
          referrerPolicy="no-referrer"
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <Car className="size-5 text-muted-foreground" />
            </div>
          }
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-foreground truncate">
          {brand.name}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {t("mobileFeed.vehicles", { count: brand.carCount })}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[12px] tabular-nums text-primary">
            {formatPrice(brand.priceMin)} – {formatPrice(brand.priceMax)}
          </span>
          <span className="text-[10px] text-positive font-medium">{brand.avgTrend}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <MarketDeltaPill priceUsd={brand.priceMax} medianUsd={brand.medianPriceUsd} />
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </Link>
  )
}

// ─── MOBILE: LIVE AUCTIONS SECTION ───
function MobileLiveAuctions({ auctions, totalLiveCount }: { auctions: Auction[]; totalLiveCount: number }) {
  const t = useTranslations("dashboard")
  const tAuction = useTranslations("auctionDetail")
  const { formatPrice } = useCurrency()
  const now = useClockNow()

  const timeBaseLabels = {
    day: t("asset.timeDay"),
    hour: t("asset.timeHour"),
    minute: t("asset.timeMin"),
  }
  const endedText = t("asset.ended")
  const soldText = t("asset.sold")

  const liveAuctions = useMemo(() => {
    return auctions
      .filter(a => ["ACTIVE", "ENDING_SOON", "LIVE"].includes(a.status) && new Date(a.endTime).getTime() > now)
      .sort((a, b) => {
        const pa = getPlatformSortPriority(a.platform)
        const pb = getPlatformSortPriority(b.platform)
        if (pa !== pb) return pa - pb
        return new Date(a.endTime).getTime() - new Date(b.endTime).getTime()
      })
      .slice(0, 8)
  }, [auctions, now])

  if (liveAuctions.length === 0) return null

  return (
    <div className="mt-6">
      {/* Section header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="size-2 rounded-full bg-positive animate-pulse" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {t("mobileFeed.liveListings")}
        </span>
        <span className="text-[10px] font-display font-medium text-primary">
          {totalLiveCount}
        </span>
      </div>

      {/* Auction rows */}
      <div className="divide-y divide-border">
        {liveAuctions.map((auction) => {
          const isEndingSoon = auction.status === "ENDING_SOON"
          const remaining = timeLeft(auction.endTime, { ...timeBaseLabels, ended: isAuctionPlatform(auction.platform) ? endedText : soldText })

          return (
            <Link
              key={auction.id}
              href={`/cars/${auction.make.toLowerCase().replace(/\s+/g, "-")}/${auction.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-foreground/3 transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-card">
                <SafeImage
                  src={auction.images[0]}
                  alt={auction.title}
                  fill
                  className="object-cover"
                  sizes="64px"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Car className="size-3.5 text-muted-foreground" />
                    </div>
                  }
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground truncate">
                  {auction.year} {auction.make} {auction.model}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[12px] font-display font-medium text-primary">
                    {auction.currentBid > 0 ? formatPrice(auction.currentBid) : "POA"}
                  </span>
                  {isAuctionPlatform(auction.platform) && (
                    <span className="text-[10px] text-muted-foreground">
                      {tAuction("bids.count", { count: auction.bidCount })}
                    </span>
                  )}
                </div>
              </div>

              {/* Platform + Time/Type badge */}
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                {isAuctionPlatform(auction.platform) ? (
                  <div className="flex items-center gap-1">
                    <Clock className={`size-3 ${isEndingSoon ? "text-destructive" : "text-muted-foreground"}`} />
                    <span className={`text-[10px] tabular-nums font-medium ${
                      isEndingSoon ? "text-destructive" : "text-muted-foreground"
                    }`}>
                      {remaining}
                    </span>
                  </div>
                ) : (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-sm bg-primary/8 text-primary">
                    Listing
                  </span>
                )}
                <span className="text-[8px] text-muted-foreground">
                  {platformShort[auction.platform] || auction.platform}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── COLUMN A: BRAND NAVIGATION ───
function BrandNavigationPanel({
  brands,
  currentIndex,
  onSelect,
}: {
  brands: Brand[]
  currentIndex: number
  onSelect: (index: number) => void
}) {
  const t = useTranslations("dashboard")
  const { formatPrice } = useCurrency()

  return (
    <div className="h-full flex flex-col border-r border-border overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b border-border">
        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-muted-foreground">
          {t("brandNav.title")}
        </span>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {t("brandNav.manufacturers", { count: brands.length })}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-primary/2">
        <div>
          <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
            {t("brandNav.totalCars")}
          </span>
          <p className="text-[14px] font-bold text-foreground mt-0.5">
            {FMT_REGIONAL_INT.format(brands.reduce((sum, b) => sum + b.carCount, 0))}
          </p>
        </div>
      </div>

      {/* Brand List — Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {brands.map((brand, index) => {
          const isActive = index === currentIndex

          return (
            <button
              key={brand.slug}
              onClick={() => onSelect(index)}
              className={`group relative w-full text-left px-4 py-3 transition-all duration-200 ${
                isActive ? "bg-primary/8" : "hover:bg-foreground/2"
              }`}
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              <div className="flex items-center gap-3">
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-semibold truncate transition-colors ${
                    isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  }`}>
                    {brand.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[11px] tabular-nums ${
                      isActive ? "text-primary" : "text-primary/60"
                    }`}>
                      {t("brandNav.carsCount", { count: brand.carCount })}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {formatPrice(brand.priceMin)}–{formatPrice(brand.priceMax)}
                    </span>
                  </div>
                </div>

                {/* Market delta pill */}
                <MarketDeltaPill priceUsd={brand.priceMax} medianUsd={brand.medianPriceUsd} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── COLUMN A: DISCOVERY SIDEBAR ───
function DiscoverySidebar({
  auctions,
  brands,
  onSelectBrand,
  onSelectFamily,
  activeBrandSlug,
  activeFamilyName,
  seriesCounts,
  seriesCountsByRegion,
  liveRegionTotals: _liveRegionTotals,
}: {
  auctions: Auction[]
  brands: Brand[]
  onSelectBrand: (brandSlug: string) => void
  onSelectFamily?: (familyName: string) => void
  activeBrandSlug?: string
  activeFamilyName?: string
  seriesCounts?: Record<string, number>
  seriesCountsByRegion?: SeriesCountsByRegion
  liveRegionTotals?: LiveRegionTotals
}) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()
  const { formatPrice } = useCurrency()

  // Extract model families for the active brand (drill-down navigation)
  const activeBrandFamilies = useMemo(() => {
    if (!activeBrandSlug) return []
    const brandName = brands.find(b => b.slug === activeBrandSlug)?.name
    if (!brandName) return []

    const regionKey: keyof SeriesCountsByRegion =
      selectedRegion === "US" ||
      selectedRegion === "UK" ||
      selectedRegion === "EU" ||
      selectedRegion === "JP"
        ? selectedRegion
        : "all"

    const brandSeries = getBrandConfig(brandName)?.series ?? []

    return brandSeries
      .map((series) => {
        const count =
          seriesCountsByRegion?.[regionKey]?.[series.id] ??
          (regionKey === "all" ? seriesCounts?.[series.id] : seriesCountsByRegion?.all?.[series.id]) ??
          seriesCounts?.[series.id] ??
          0

        return {
          name: series.label,
          slug: series.id,
          count,
          yearMin: series.yearRange[0],
          yearMax: series.yearRange[1],
        }
      })
      .sort((a, b) => {
        const orderA = getSeriesConfig(a.slug, brandName)?.order ?? 99
        const orderB = getSeriesConfig(b.slug, brandName)?.order ?? 99
        if (orderA !== orderB) return orderA - orderB
        return b.count - a.count
      })
  }, [activeBrandSlug, brands, seriesCounts, seriesCountsByRegion, selectedRegion])

  const activeFamilyCount = useMemo(() => {
    if (!activeFamilyName) return null

    const normalized = activeFamilyName.toLowerCase()
    const family = activeBrandFamilies.find((entry) => {
      const familySlug = entry.slug.toLowerCase()
      return entry.name === activeFamilyName || familySlug === normalized || normalized.startsWith(familySlug)
    })

    return family?.count ?? null
  }, [activeBrandFamilies, activeFamilyName])

  const seedKey = `${selectedRegion ?? "all"}|${activeFamilyName ?? "all"}`
  const seedAuctions = useMemo(
    () => filterLiveSidebarAuctions(auctions, { activeFamilyName, pageSize: 8 }),
    [auctions, activeFamilyName],
  )
  const {
    liveAuctions,
    liveCount,
    scrollRootRef,
    sentinelRef,
    isLoading,
    isFetchingMore,
    hasMore,
  } = useLiveSidebarListings({
    seedAuctions,
    seedKey,
    make: auctions[0]?.make ?? "Porsche",
    activeFamilyName,
    region: selectedRegion,
    pageSize: 8,
  })

  const endedText2 = t("asset.ended")
  const soldText2 = t("asset.sold")
  const timeBaseLabels2 = {
    day: t("asset.timeDay"),
    hour: t("asset.timeHour"),
    minute: t("asset.timeMin"),
  }

  return (
    <div className="h-full flex flex-col border-r border-border overflow-hidden">

      {/* ═══ TOP HALF: FIND YOUR CAR ═══ */}
      <div className="flex-1 min-h-0 flex flex-col">

        {/* Section header */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-1.5">
          <span className="text-[9px] font-semibold tracking-[0.25em] uppercase text-muted-foreground">
            {t("sidebar.popular")}
          </span>
          <span className="text-[9px] tabular-nums text-muted-foreground">
            {t("sidebar.brandsCount", { count: brands.length })}
          </span>
        </div>

        {/* Brands list with inline families (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {brands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center px-4">
              <p className="text-[11px] text-muted-foreground">{t("sidebar.noResults")}</p>
            </div>
          ) : (
            brands.map((brand) => {
              const isActive = activeBrandSlug === brand.slug
              return (
                <div key={brand.slug}>
                  <button
                    onClick={() => onSelectBrand(brand.slug)}
                    className={`w-full text-left px-4 py-2.5 border-b border-border/50 transition-all group ${
                      isActive
                        ? "bg-primary/6 border-l-2 border-l-primary"
                        : "hover:bg-foreground/2 border-l-2 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[12px] font-semibold transition-colors ${
                        isActive ? "text-primary" : "text-foreground group-hover:text-primary"
                      }`}>
                        {brand.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <MarketDeltaPill priceUsd={brand.priceMax} medianUsd={brand.medianPriceUsd} />
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {brand.carCount}
                        </span>
                        <ChevronRight className={`size-3 transition-all ${
                          isActive ? "text-primary rotate-90" : "text-muted-foreground group-hover:text-muted-foreground"
                        }`} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {formatPrice(brand.priceMin)} – {formatPrice(brand.priceMax)}
                      </span>
                      <span className="text-[9px] text-positive font-medium">
                        {brand.avgTrend}
                      </span>
                    </div>
                  </button>

                  {/* Families drill-down (shown when brand is active) */}
                  {isActive && activeBrandFamilies.length > 0 && (
                    <div className="bg-foreground/2 border-b border-border/50">
                      <div className="px-4 pl-6 py-1.5">
                        <span className="text-[8px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                          {t("sidebar.families")}
                        </span>
                      </div>
                      {activeBrandFamilies.map((family) => {
                        const familySlug = family.name.toLowerCase()
                        const isFamilyActive = activeFamilyName === family.name || activeFamilyName?.toLowerCase().startsWith(familySlug)
                        return (
                        <button
                          key={family.name}
                          onClick={() => onSelectFamily?.(family.name)}
                          className={`w-full flex items-center justify-between px-4 pl-7 py-2 transition-colors group/fam ${
                            isFamilyActive
                              ? "bg-primary/8 border-l-2 border-l-primary"
                              : "hover:bg-foreground/3 border-l-2 border-l-transparent"
                          }`}
                        >
                          <span className={`text-[11px] font-medium transition-colors ${
                            isFamilyActive ? "text-primary" : "text-muted-foreground group-hover/fam:text-primary"
                          }`}>
                            {family.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] tabular-nums text-primary">
                              {family.count}
                            </span>
                            <span className="text-[8px] text-muted-foreground">
                              {family.yearMin === family.yearMax
                                ? `${family.yearMin}`
                                : `${family.yearMin}–${family.yearMax}`}
                            </span>
                          </div>
                        </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ═══ BOTTOM HALF: LIVE BIDS ═══ */}
      <div className="flex-1 min-h-0 flex flex-col border-t border-border">

        {/* Live header */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-card">
          <div className="size-2 rounded-full bg-positive animate-pulse" />
          <span className="text-[9px] font-semibold tracking-[0.25em] uppercase text-muted-foreground">
            {t("sidebar.liveNow")}
          </span>
          <span className="text-[10px] font-display font-medium text-primary">
            {activeFamilyCount ?? liveCount}
          </span>
        </div>

        {/* Live auctions list (scrollable) */}
        <div ref={scrollRootRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {isLoading && liveAuctions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center px-4">
              <p className="text-[11px] text-muted-foreground">{t("sidebar.noLiveListings")}</p>
            </div>
          ) : liveAuctions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center px-4">
              <p className="text-[11px] text-muted-foreground">{t("sidebar.noLiveListings")}</p>
            </div>
          ) : (
            <>
              {liveAuctions.map((auction) => {
              const isEndingSoon = auction.status === "ENDING_SOON"
              const remaining = timeLeft(auction.endTime, { ...timeBaseLabels2, ended: isAuctionPlatform(auction.platform) ? endedText2 : soldText2 })

              return (
                <Link
                  key={auction.id}
                  href={`/cars/${auction.make.toLowerCase().replace(/\s+/g, "-")}/${auction.id}`}
                  className="group relative block px-4 py-2.5 border-b border-border/50 hover:bg-foreground/2 transition-all"
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="relative w-14 h-11 rounded-lg overflow-hidden shrink-0 bg-card">
                      <SafeImage
                        src={auction.images[0]}
                        alt={auction.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        fallback={
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Car className="size-3.5 text-muted-foreground" />
                          </div>
                        }
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {auction.year} {auction.make} {auction.model}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[12px] font-display font-medium text-primary">
                          {auction.currentBid > 0 ? formatPrice(auction.currentBid) : "POA"}
                        </span>
                        <div className="flex items-center gap-1 ml-auto">
                          {isAuctionPlatform(auction.platform) ? (
                            <>
                              <Clock className={`size-2.5 ${isEndingSoon ? "text-destructive" : "text-muted-foreground"}`} />
                              <span className={`text-[9px] tabular-nums font-medium ${
                                isEndingSoon ? "text-destructive" : "text-muted-foreground"
                              }`}>
                                {remaining}
                              </span>
                            </>
                          ) : (
                            <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-sm bg-primary/8 text-primary">
                              Listing
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] text-muted-foreground">
                          {platformShort[auction.platform] || auction.platform}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
              })}
              {hasMore && (
                <div ref={sentinelRef} className="h-20 flex items-center justify-center">
                  {isFetchingMore && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── COLUMN B: THE BTW-STYLE ASSET CARD (DESKTOP) ───
function AssetCard({ auction, allAuctions = [], regionalValByFamily }: { auction: Auction; allAuctions?: Auction[]; regionalValByFamily?: import("@/lib/dashboardCache").RegionalValByFamily }) {
  const t = useTranslations("dashboard")
  const tAuction = useTranslations("auctionDetail")
  const tStatus = useTranslations("status")
  const { formatPrice } = useCurrency()

  const isLive = auction.status === "ACTIVE" || auction.status === "ENDING_SOON"
  const isEndingSoon = auction.status === "ENDING_SOON"

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      <div className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-card border border-border">
        {/* TOP: CINEMATIC IMAGE (wider aspect ratio to fit CTAs) */}
        <div className="relative aspect-[16/8] w-full shrink-0">
          <SafeImage
            src={auction.images[0]}
            alt={auction.title}
            fill
            className="object-cover object-center"
            sizes="50vw"
            loading="lazy"
            referrerPolicy="no-referrer"
            fallback={
              <div className="absolute inset-0 bg-card flex items-center justify-center">
                <span className="text-muted-foreground text-lg">{t("asset.noImage")}</span>
              </div>
            }
          />

          {/* Vignette gradient at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent pointer-events-none" />

          {/* Status pill overlay */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            {isLive && (
              <span className={`flex items-center gap-2 rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase ${
                isEndingSoon
                  ? "bg-destructive/30 text-destructive"
                  : "bg-positive/30 text-positive"
              }`}>
                <span className={`size-2 rounded-full ${
                  isEndingSoon ? "bg-destructive" : "bg-positive"
                } animate-pulse`} />
                {isEndingSoon ? tStatus("endingSoon") : tStatus("live")}
              </span>
            )}
          </div>

          {/* Platform badge */}
          <div className="absolute top-4 right-4">
            <span className="rounded-full bg-background/70 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-foreground">
              {platformShort[auction.platform]}
            </span>
          </div>
        </div>

        {/* BOTTOM: DATA DECK (fills remaining space) */}
        <div className="flex-1 w-full bg-card p-6 flex flex-col justify-start overflow-hidden">
          {/* Title + Price row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-foreground tracking-tight truncate">
                {auction.make} {auction.model}
              </h2>
              {auction.trim && (
                <p className="text-[15px] text-muted-foreground mt-0.5">{auction.trim}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-3xl font-bold text-foreground tabular-nums tabular-nums">
                {auction.currentBid > 0 ? formatPrice(auction.currentBid) : "POA"}
              </p>
              <div className="flex items-center justify-end gap-3 mt-1 text-muted-foreground">
                <span className="text-[11px]">{tAuction("bids.count", { count: auction.bidCount })}</span>
                {isLive && (
                  <span className="flex items-center gap-1 text-[11px] tabular-nums">
                    <Clock className="size-3" />
                    {timeLeft(auction.endTime, {
                      ended: isAuctionPlatform(auction.platform) ? tAuction("time.ended") : tAuction("time.sold"),
                      day: tAuction("time.units.day"),
                      hour: tAuction("time.units.hour"),
                      minute: tAuction("time.units.minute"),
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Investment Metrics Grid */}
          {(() => {
            const trend = auction.analysis?.appreciationPotential === "APPRECIATING"
              ? "High Demand"
              : auction.analysis?.appreciationPotential === "DECLINING"
              ? "Low Demand"
              : "Growing Demand"
            const familyAuctions = allAuctions.filter(
              (a) => a.make === auction.make && a.family === auction.family,
            )
            const cachedFamilyValuation = auction.family ? regionalValByFamily?.[auction.family] : undefined
            const band = resolveFairValueBand(auction, familyAuctions, cachedFamilyValuation)
            const priceUsd = listingPriceUsd(auction, {})
            const medianUsd = band ? (band.low + band.high) / 2 : null

            return (
              <div className="mt-auto grid grid-cols-3 gap-4 pt-4 border-t border-border">
                {/* Market delta */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Award className="size-3" />
                    <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("asset.metrics.trend")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MarketDeltaPill priceUsd={priceUsd} medianUsd={medianUsd} />
                    <p className="text-[13px] font-semibold text-positive">{trend}</p>
                  </div>
                </div>

                {/* Fair Value */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <DollarSign className="size-3" />
                    <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("asset.metrics.fairValue")}</span>
                  </div>
                  <p className="text-[13px] text-foreground font-mono">
                    {band ? `${formatPrice(band.low)}–${formatPrice(band.high)}` : "—"}
                  </p>
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Car className="size-3" />
                    <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("asset.metrics.category")}</span>
                  </div>
                  <p className="text-[13px] text-foreground truncate">{auction.category || t("asset.metrics.collector")}</p>
                </div>
              </div>
            )
          })()}

          {/* CTA Row */}
          <div className="flex items-center gap-3 mt-4">
            {isLive && (
              <button className="flex-1 rounded-full bg-primary py-3 text-[12px] font-semibold tracking-[0.1em] uppercase text-primary-foreground hover:bg-primary/80 transition-colors">
                {tAuction("actions.placeBid")}
              </button>
            )}
            <Link
              href={`/cars/${auction.make.toLowerCase().replace(/\s+/g, "-")}/${auction.id}`}
              className="flex-1 rounded-full border border-border py-3 text-center text-[12px] font-medium tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
            >
              {t("asset.fullAnalysis")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── COLUMN C: THE CONTEXT PANEL ───
// Enhanced with price chart, ownership cost, and similar cars
function ContextPanel({ auction, allAuctions }: { auction: Auction; allAuctions: Auction[] }) {
  const t = useTranslations("dashboard")
  const tCommon = useTranslations("common")
  const { effectiveRegion } = useRegion()
  const { formatPrice, rates } = useCurrency()

  const whyBuy = getBrandConfig(auction.make)?.defaultThesis || mockWhyBuy[auction.make] || mockWhyBuy["default"]
  const recentSales = useMemo(() => {
    return allAuctions
      .filter(a => a.make === auction.make && a.id !== auction.id && (a.price > 0 || a.currentBid > 0))
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
      .slice(0, 5)
      .map(a => ({
        title: `${a.year} ${a.model}`,
        price: listingPriceUsd(a, rates),
        platform: a.platform?.replace(/_/g, " ") || "Listing",
        date: new Date(a.endTime).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }))
  }, [allAuctions, auction.make, auction.id, rates])
  // Fair value range — real segment IQR band from same family auctions.
  const familyAuctions = allAuctions.filter(
    (a) => a.make === auction.make && a.family === auction.family,
  )
  const band = resolveFairValueBand(auction, familyAuctions)

  // Find similar cars (same category, different car)
  const similarCars = allAuctions
    .filter(a => a.category === auction.category && a.id !== auction.id)
    .slice(0, 5)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* SECTION 1: Investment Thesis */}
      <div className="px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Scale className="size-4 text-primary" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            {t("context.investmentThesis")}
          </span>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground line-clamp-4">
          {whyBuy}
        </p>
      </div>

      {/* SECTION 2: Fair Value by Region */}
      <div className="px-5 py-3 border-b border-border bg-primary/3">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="size-4 text-primary" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            {t("context.fairValueByRegion")}
          </span>
        </div>

        {auction.fairValueByRegion ? (
          <div className="space-y-1.5">
            {(["US", "EU", "UK", "JP"] as const).map(region => {
              const rp = auction.fairValueByRegion![region]
              const isSelected = region === effectiveRegion
              const flags: Record<string, string> = { US: "🇺🇸", EU: "🇪🇺", UK: "🇬🇧", JP: "🇯🇵" }
              return (
                <div key={region} className={`flex items-center justify-between ${isSelected ? "rounded bg-primary/4 -mx-1 px-1 py-0.5" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{flags[region]}</span>
                    <span className={`text-[10px] font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{region}</span>
                    {isSelected && <span className="text-[8px] font-bold text-primary tracking-wide">{t("brandContext.yourMarket")}</span>}
                  </div>
                  <span className={`text-[12px] font-bold tabular-nums ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {fmtRegional(rp.low, rp.currency)} — {fmtRegional(rp.high, rp.currency)}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-display font-medium text-primary">
              {band ? `${formatPrice(band.low)} — ${formatPrice(band.high)}` : "—"}
            </span>
          </div>
        )}
      </div>

      {/* SECTION 4: Similar Cars (Scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-3">
        {similarCars.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Car className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {t("context.alsoConsider")}
              </span>
            </div>
            <div className="space-y-2">
              {similarCars.map((car) => (
                <Link
                  key={car.id}
                  href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
                  className="flex items-center justify-between py-2 px-2 rounded-lg bg-foreground/2 hover:bg-foreground/4 transition-colors cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {car.make} {car.model}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{car.category}</p>
                  </div>
                  <span className="text-[11px] font-display font-medium text-primary ml-2">
                    {formatPrice(car.currentBid)}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Recent Comparables */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("context.recentSales")}
            </span>
          </div>
          <div className="space-y-1">
            {recentSales.map((sale, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">{sale.title}</p>
                  <p className="text-[9px] text-muted-foreground">{sale.date}</p>
                </div>
                <span className="text-[11px] tabular-nums font-semibold text-foreground ml-2">
                  {formatPrice(sale.price)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ask Button */}
      <div className="shrink-0 px-5 py-3 border-t border-border">
        <a
          href={`https://wa.me/573208492641?text=${encodeURIComponent(
            t("context.askWhatsAppMessage", { make: auction.make, model: auction.model })
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/8 border border-primary/15 py-2.5 text-[10px] font-medium tracking-[0.1em] uppercase text-primary hover:bg-primary/15 hover:border-primary/30 transition-all"
        >
          <Scale className="size-3" />
          {t("context.askAboutThisCar")}
          <ChevronRight className="size-3" />
        </a>
      </div>
    </div>
  )
}

// ─── FAMILY CONTEXT PANEL (for Porsche family-based landing) ───
function FamilyContextPanel({ family, auctions, regionalValByFamily, allFamilies }: { family: PorscheFamily; auctions: Auction[]; regionalValByFamily?: import("@/lib/dashboardCache").RegionalValByFamily; allFamilies: PorscheFamily[] }) {
  const t = useTranslations("dashboard")
  const { formatPrice, rates } = useCurrency()
  const now = useClockNow()

  const thesis = getSeriesThesis(family.slug, "Porsche") || "A compelling Porsche family with strong collector appeal."

  // Get auctions for this family — all derived data depends on this
  const familyAuctions = useMemo(() => {
    const familyKey = family.slug
    return auctions.filter(a => {
      const series = extractSeries(a.model, a.year, a.make || "Porsche", a.title).toLowerCase()
      return series === familyKey
    })
  }, [auctions, family.slug])

  // Valuation comes from the cache when available; live family auctions are the fallback.
  const regionalVal = useMemo(
    () => regionalValByFamily?.[family.slug] ?? computeRegionalValFromAuctions(familyAuctions),
    [regionalValByFamily, family.slug, familyAuctions],
  )

  // ─── DYNAMIC: Market Depth from real listing counts ───
  const depth = useMemo(() => {
    const count = familyAuctions.length
    const withPrice = familyAuctions.filter(a => listingPriceUsd(a, rates) > 0)
    const ended = familyAuctions.filter(a => new Date(a.endTime).getTime() < now)
    const sold = ended.filter(a => a.price > 0 || a.currentBid > 0)
    const sellThrough = ended.length > 0 ? Math.round((sold.length / ended.length) * 100) : 85
    const avgDays = ended.length > 0
      ? Math.round(ended.reduce((sum, a) => {
          const created = new Date(a.endTime).getTime() - (7 * 86400000)
          return sum + (new Date(a.endTime).getTime() - created) / 86400000
        }, 0) / ended.length)
      : 14
    const demandScore = Math.min(10, Math.max(1, Math.round(
      (count >= 20 ? 3 : count >= 10 ? 2 : 1) +
      (withPrice.length / Math.max(count, 1)) * 4 +
      (sellThrough / 100) * 3
    )))
    return {
      auctionsPerYear: Math.max(count * 4, 12),
      avgDaysToSell: avgDays,
      sellThroughRate: sellThrough,
      demandScore,
    }
  }, [familyAuctions, now, rates])

  // Top variants: group by model variant name, sorted by avg listing price (USD)
  const topVariants = useMemo(() => {
    const variantMap = new Map<string, { count: number; prices: number[] }>()
    familyAuctions.forEach(a => {
      const variant = a.model
      const existing = variantMap.get(variant) || { count: 0, prices: [] }
      existing.count++
      const usd = listingPriceUsd(a, rates)
      if (usd > 0) existing.prices.push(usd)
      variantMap.set(variant, existing)
    })

    return Array.from(variantMap.entries())
      .filter(([, data]) => data.prices.length > 0)
      .map(([name, data]) => {
        const sorted = [...data.prices].sort((a, b) => a - b)
        const medianPrice = sorted[Math.floor(sorted.length / 2)]
        return {
          name,
          avgPrice: Math.round(data.prices.reduce((s, p) => s + p, 0) / data.prices.length),
          medianPrice,
          count: data.count,
        }
      })
      .sort((a, b) => b.avgPrice - a.avgPrice)
      .slice(0, 5)
  }, [familyAuctions, rates])

  // Recent sales from this family
  const recentSales = useMemo(() => {
    return familyAuctions
      .filter(a => (a.price > 0 || a.currentBid > 0))
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
      .slice(0, 5)
      .map(a => ({
        title: `${a.year} ${a.model}`,
        price: listingPriceUsd(a, rates),
        platform: a.platform?.replace(/_/g, " ") || "Listing",
        date: new Date(a.endTime).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }))
  }, [familyAuctions, rates])

  // Similar families (nearby in prestige order)
  const similarFamilies = allFamilies
    .filter(f => f.slug !== family.slug)
    .slice(0, 3)

  const yearLabel = family.yearMin === family.yearMax
    ? `${family.yearMin}`
    : `${family.yearMin}–${family.yearMax}`

  return (
    <div className="h-full flex flex-col overflow-y-auto no-scrollbar">
      <div>
        {/* 1. FAMILY OVERVIEW */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.overview")}
            </span>
          </div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-primary mb-1">
            Porsche
          </p>
          <h3 className="text-[18px] font-bold text-foreground tracking-tight mb-2">
            {family.name}
          </h3>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {thesis}
          </p>
        </div>

        {/* 2. KEY METRICS */}
        <div className="px-5 py-3 border-b border-border bg-primary/3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.minPrice")}</span>
              <p className="text-[13px] tabular-nums font-semibold text-foreground">{formatPrice(family.priceMin)}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.maxPrice")}</span>
              <p className="text-[13px] tabular-nums font-semibold text-foreground">{formatPrice(family.priceMax)}</p>
            </div>
          </div>
        </div>

        <RegionalValuationSection regionalVal={regionalVal} />

        {/* 4. TOP VARIANTS */}
        {topVariants.length > 0 && (
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Car className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {t("brandContext.topModels")}
              </span>
            </div>
            <div className="space-y-2">
              {topVariants.map((variant) => (
                <div key={variant.name} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-medium text-foreground truncate block">{variant.name}</span>
                    <span className="text-[9px] text-muted-foreground">{variant.count} listings</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-display font-medium text-primary">
                      {formatPrice(variant.avgPrice)}
                    </span>
                    <MarketDeltaPill priceUsd={variant.avgPrice} medianUsd={variant.medianPrice} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. RECENT SALES */}
        {recentSales.length > 0 && (
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {t("brandContext.recentSales")}
              </span>
            </div>
            <div className="space-y-2">
              {recentSales.map((sale, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{sale.title}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{sale.platform} · {sale.date}</p>
                  </div>
                  <span className="text-[12px] tabular-nums font-semibold text-foreground shrink-0">
                    {formatPrice(sale.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. LIQUIDITY & MARKET DEPTH */}
        <div className="px-5 py-4 border-b border-border bg-primary/3">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.liquidityDepth")}
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{t("brandContext.listingsPerYear")}</span>
              <span className="text-[12px] tabular-nums font-semibold text-foreground">{depth.auctionsPerYear}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{t("brandContext.avgDaysToSell")}</span>
              <span className="text-[12px] tabular-nums font-semibold text-foreground">{depth.avgDaysToSell}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{t("brandContext.sellThroughRate")}</span>
              <span className="text-[12px] tabular-nums font-semibold text-positive">{depth.sellThroughRate}%</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-muted-foreground">{t("brandContext.demandScore")}</span>
                <span className="text-[12px] font-display font-medium text-primary">{depth.demandScore}/10</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-[6px] flex-1 rounded-sm ${
                      i < depth.demandScore ? "bg-primary/50" : "bg-foreground/4"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 7. OTHER FAMILIES — removed: duplicates family navigation in Column B */}
      </div>

      {/* CTA — pinned bottom */}
      <div className="shrink-0 px-5 py-3 border-t border-border">
        <Link
          href={`/cars/porsche?family=${encodeURIComponent(family.slug)}`}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground hover:bg-primary/80 transition-all"
        >
          Explore {family.name} Collection
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}

// ─── BRAND CONTEXT PANEL ───
function BrandContextPanel({ brand, allBrands, auctions, regionalValByFamily }: { brand: Brand; allBrands: Brand[]; auctions: Auction[]; regionalValByFamily?: import("@/lib/dashboardCache").RegionalValByFamily }) {
  const t = useTranslations("dashboard")
  const { formatPrice, rates } = useCurrency()
  const now = useClockNow()
  const brandAuctions = useMemo(() =>
    auctions.filter(a => a.make === brand.name),
    [auctions, brand.name]
  )

  const whyBuy = getBrandConfig(brand.name)?.defaultThesis || mockWhyBuy[brand.name] || mockWhyBuy["default"]
  const dominantFamily = useMemo(() => {
    const counts = new Map<string, number>()
    for (const auction of brandAuctions) {
      if (!auction.family) continue
      counts.set(auction.family, (counts.get(auction.family) ?? 0) + 1)
    }

    let best: [string, number] | null = null
    for (const entry of counts.entries()) {
      if (!best || entry[1] > best[1]) best = entry
    }

    return best?.[0] ?? null
  }, [brandAuctions])
  const regionalVal = useMemo(
    () => (dominantFamily ? regionalValByFamily?.[dominantFamily] ?? computeRegionalValFromAuctions(brandAuctions.filter(a => a.family === dominantFamily)) : {}),
    [regionalValByFamily, dominantFamily, brandAuctions],
  )
  const recentSales = useMemo(() => {
    return brandAuctions
      .filter(a => (a.price > 0 || a.currentBid > 0))
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
      .slice(0, 5)
      .map(a => ({
        title: a.title,
        price: listingPriceUsd(a, rates),
        platform: a.platform?.replace(/_/g, " ") || "Listing",
        date: new Date(a.endTime).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }))
  }, [brandAuctions])
  const topModels = useMemo(() => {
    const variantMap = new Map<string, { count: number; prices: number[] }>()
    brandAuctions.forEach(a => {
      const variant = a.model
      const existing = variantMap.get(variant) || { count: 0, prices: [] }
      existing.count++
      const usd = listingPriceUsd(a, rates)
      if (usd > 0) existing.prices.push(usd)
      variantMap.set(variant, existing)
    })

    return Array.from(variantMap.entries())
      .filter(([, data]) => data.prices.length > 0)
      .map(([name, data]) => {
        const sorted = [...data.prices].sort((a, b) => a - b)
        const medianPrice = sorted[Math.floor(sorted.length / 2)]
        return {
          name,
          avgPrice: Math.round(data.prices.reduce((s, p) => s + p, 0) / data.prices.length),
          medianPrice,
          count: data.count,
          trend: "Stable",
        }
      })
      .sort((a, b) => b.avgPrice - a.avgPrice)
      .slice(0, 5)
  }, [brandAuctions, rates])
  const depth = useMemo(() => {
    const count = brandAuctions.length
    if (count === 0) {
      const config = getBrandConfig(brand.name)
      return config?.marketDepth ?? { auctionsPerYear: 15, avgDaysToSell: 20, sellThroughRate: 80, demandScore: 6 }
    }
    const withPrice = brandAuctions.filter(a => listingPriceUsd(a, rates) > 0)
    const ended = brandAuctions.filter(a => new Date(a.endTime).getTime() < now)
    const sold = ended.filter(a => a.price > 0 || a.currentBid > 0)
    const sellThrough = ended.length > 0 ? Math.round((sold.length / ended.length) * 100) : 85
    const avgDays = ended.length > 0
      ? Math.round(ended.reduce((sum, a) => {
          const created = new Date(a.endTime).getTime() - (7 * 86400000)
          return sum + (new Date(a.endTime).getTime() - created) / 86400000
        }, 0) / ended.length)
      : 14
    const demandScore = Math.min(10, Math.max(1, Math.round(
      (count >= 20 ? 3 : count >= 10 ? 2 : 1) +
      (withPrice.length / Math.max(count, 1)) * 4 +
      (sellThrough / 100) * 3
    )))
    return {
      auctionsPerYear: Math.max(count * 4, 12),
      avgDaysToSell: avgDays,
      sellThroughRate: sellThrough,
      demandScore,
    }
  }, [brandAuctions, brand.name, now, rates])

  // Similar brands (different brand, ranked by proximity of median price)
  const similarBrands = allBrands
    .filter(b => b.slug !== brand.slug)
    .slice()
    .sort((a, b) =>
      Math.abs(a.medianPriceUsd - brand.medianPriceUsd) - Math.abs(b.medianPriceUsd - brand.medianPriceUsd)
    )
    .slice(0, 3)

  return (
    <div className="h-full flex flex-col overflow-y-auto no-scrollbar">
      {/* BRAND CONTEXT — starts directly with brand overview */}
      <div>
        {/* 1. BRAND OVERVIEW */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.overview")}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {whyBuy}
          </p>
        </div>

        {/* 2. PRICE SUMMARY */}
        <div className="px-5 py-3 border-b border-border bg-primary/3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.minPrice")}</span>
              <p className="text-[13px] tabular-nums font-semibold text-foreground">{formatPrice(brand.priceMin)}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.maxPrice")}</span>
              <p className="text-[13px] tabular-nums font-semibold text-foreground">{formatPrice(brand.priceMax)}</p>
            </div>
          </div>
        </div>

        <RegionalValuationSection regionalVal={regionalVal} />

        {/* 4. TOP MODELS — removed: duplicates family navigation in Column B */}

        {/* 5. RECENT SALES */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.recentSales")}
            </span>
          </div>
          <div className="space-y-2">
            {recentSales.map((sale, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate">{sale.title}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{sale.platform} · {sale.date}</p>
                </div>
                <span className="text-[12px] tabular-nums font-semibold text-foreground shrink-0">
                  {formatPrice(sale.price)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 6. LIQUIDITY & MARKET DEPTH */}
        <div className="px-5 py-4 border-b border-border bg-primary/3">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.liquidityDepth")}
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{t("brandContext.listingsPerYear")}</span>
              <span className="text-[12px] tabular-nums font-semibold text-foreground">{depth.auctionsPerYear}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{t("brandContext.avgDaysToSell")}</span>
              <span className="text-[12px] tabular-nums font-semibold text-foreground">{depth.avgDaysToSell}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{t("brandContext.sellThroughRate")}</span>
              <span className="text-[12px] tabular-nums font-semibold text-positive">{depth.sellThroughRate}%</span>
            </div>
            {/* Demand score visual */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-muted-foreground">{t("brandContext.demandScore")}</span>
                <span className="text-[12px] font-display font-medium text-primary">{depth.demandScore}/10</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-[6px] flex-1 rounded-sm ${
                      i < depth.demandScore ? "bg-primary/50" : "bg-foreground/4"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 8. SIMILAR BRANDS */}
        {similarBrands.length > 0 && (
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {t("brandContext.similarBrands")}
              </span>
            </div>
            <div className="space-y-1.5">
              {similarBrands.map((b) => (
                <Link
                  key={b.slug}
                  href={`/cars/${b.slug}`}
                  className="flex items-center justify-between py-1.5 rounded-lg hover:bg-foreground/3 transition-colors px-1 -mx-1 group"
                >
                  <span className="text-[11px] font-medium text-foreground group-hover:text-primary transition-colors">
                    {b.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {formatPrice(b.priceMin)}–{formatPrice(b.priceMax)}
                    </span>
                    <MarketDeltaPill priceUsd={b.priceMax} medianUsd={b.medianPriceUsd} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA — pinned bottom */}
      <div className="shrink-0 px-5 py-3 border-t border-border">
        <Link
          href={`/cars/${brand.slug}`}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground hover:bg-primary/80 transition-all"
        >
          {t("brandContext.explore", { brand: brand.name })}
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───
export function DashboardClient({ auctions, valuationListings, regionalValByFamily, liveRegionTotals, liveNowTotal, seriesCounts, seriesCountsByRegion }: { auctions: Auction[]; valuationListings?: Auction[]; regionalValByFamily?: import("@/lib/dashboardCache").RegionalValByFamily; liveRegionTotals?: LiveRegionTotals; liveNowTotal?: number; seriesCounts?: Record<string, number>; seriesCountsByRegion?: SeriesCountsByRegion }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const { selectedRegion } = useRegion()
  const { rates } = useCurrency()
  const t = useTranslations("dashboard")
  const feedRef = useRef<HTMLDivElement>(null)
  const valuationAuctions = valuationListings && valuationListings.length > 0 ? valuationListings : auctions

  // Filter auctions by region (maps to source platform), then aggregate
  const filteredAuctions = useMemo(() => {
    const regionFiltered = filterAuctionsForRegion(auctions, selectedRegion)
    // Hard requirement: only active listings are ever displayed.
    return regionFiltered.filter(
      a => a.status === "ACTIVE" || a.status === "ENDING_SOON"
    )
  }, [auctions, selectedRegion])

  const liveNowCount = useMemo(() => {
    if (!liveRegionTotals) {
      return filteredAuctions.filter(a => ["ACTIVE", "ENDING_SOON", "LIVE"].includes(a.status)).length
    }

    if (!selectedRegion) {
      return liveRegionTotals.all
    }

    return liveRegionTotals[selectedRegion as keyof LiveRegionTotals] ?? liveRegionTotals.all
  }, [filteredAuctions, liveRegionTotals, selectedRegion])

  // Aggregate filtered auctions into brands
  const brands = useMemo(() => aggregateBrands(filteredAuctions, rates, liveNowCount), [filteredAuctions, rates, liveNowCount])

  // Aggregate into Porsche families for the family-based landing scroll
  const porscheFamilies = useMemo(
    () => aggregateFamilies(filteredAuctions, valuationAuctions, rates, seriesCounts, selectedRegion, liveRegionTotals),
    [filteredAuctions, valuationAuctions, rates, seriesCounts, selectedRegion, liveRegionTotals]
  )

  // Reset scroll position when region changes
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0 })
  }, [selectedRegion])

  const safeCurrentIndex = currentIndex >= 0 && currentIndex < brands.length ? currentIndex : 0
  const selectedBrand = brands[safeCurrentIndex] || brands[0]
  // Family-level index for the scroll (bounded to porscheFamilies array)
  const safeFamilyIndex = currentIndex >= 0 && currentIndex < porscheFamilies.length ? currentIndex : 0
  const activeFamily = porscheFamilies[safeFamilyIndex]
  const activeFamilyName = activeFamily?.name

  // Card height = viewport minus the real top chrome (nav + optional free-user banner).
  // The actual header height is published as --app-header-h by <Header /> via ResizeObserver.
  const getCardHeight = () => {
    if (typeof window === "undefined") return 800
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--app-header-h")
    const headerH = parseInt(raw, 10)
    return window.innerHeight - (Number.isFinite(headerH) && headerH > 0 ? headerH : 80)
  }

  // Handle scroll snap to update current index (Desktop) — synced with family cards
  useEffect(() => {
    const container = feedRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop
      const slideHeight = getCardHeight()
      const newIndex = Math.round(scrollTop / slideHeight)
      if (newIndex !== safeFamilyIndex && newIndex >= 0 && newIndex < porscheFamilies.length) {
        setCurrentIndex(newIndex)
      }
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [porscheFamilies.length, safeFamilyIndex])

  // Scroll to index when nav is clicked.
  // Uses "instant" because Chrome's smooth scroll conflicts with snap-mandatory
  // over long distances — the browser sometimes refuses the animation and the
  // container stays put. Instant teleport is reliable and actually snappier UX.
  const scrollToIndex = (index: number) => {
    const container = feedRef.current
    if (!container) return
    const slideHeight = getCardHeight()
    container.scrollTo({ top: slideHeight * index, behavior: "instant" })
    setCurrentIndex(index)
  }

  // Scroll to brand by slug (from quick access)
  const scrollToBrand = (brandSlug: string) => {
    const index = brands.findIndex(b => b.slug === brandSlug)
    if (index >= 0) {
      scrollToIndex(index)
    }
  }

  // Scroll to family by name (from sidebar family drill-down)
  // Sidebar uses raw keys like "718", but porscheFamilies uses display names like "718 Cayman/Boxster"
  // Match by slug (raw key, lowercased) or by name as fallback
  const scrollToFamily = (familyName: string) => {
    const slug = familyName.toLowerCase()
    const index = porscheFamilies.findIndex(f => f.slug === slug || f.name === familyName)
    if (index >= 0) {
      scrollToIndex(index)
    }
  }

  if (!selectedBrand) return null

  return (
    <>
      {/* ═══ MOBILE LAYOUT — Vertical Scrollable Feed ═══ */}
      <div className="md:hidden min-h-[100dvh] w-full bg-background pt-[var(--app-header-h,3.5rem)]">
        {/* Sticky region pills */}
        <MobileRegionPills />

        {/* Scrollable vertical feed */}
        <div className="pb-24">
          {brands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60dvh] px-8 text-center">
              <Globe className="size-8 text-muted-foreground mb-3" />
              <p className="text-[14px] text-muted-foreground">{t("mobileFeed.noBrands")}</p>
            </div>
          ) : (
            <>
              {/* Hero: first brand */}
              <MobileHeroBrand brand={brands[0]} />

              {/* Section: All Brands */}
              {brands.length > 1 && (
                <div className="mt-2">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                      {t("mobileFeed.brands")}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{brands.length}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {brands.slice(1).map((brand) => (
                      <MobileBrandRow key={brand.slug} brand={brand} />
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Live Auctions */}
              <MobileLiveAuctions auctions={filteredAuctions} totalLiveCount={liveNowCount} />
            </>
          )}
        </div>
      </div>

      {/* ═══ DESKTOP LAYOUT (3-column) ═══ */}
      <div className="hidden md:flex h-[100dvh] w-full flex-col bg-background overflow-hidden pt-[var(--app-header-h,80px)]">
        {/* 3-COLUMN LAYOUT */}
        <div className="flex-1 min-h-0 grid grid-cols-[22%_1fr_28%] grid-rows-[1fr] overflow-hidden">
          {/* COLUMN A: DISCOVERY SIDEBAR (22%) */}
            <DiscoverySidebar
              auctions={filteredAuctions}
              brands={brands}
              onSelectBrand={scrollToBrand}
              onSelectFamily={scrollToFamily}
              activeBrandSlug={selectedBrand?.slug}
              activeFamilyName={activeFamilyName}
              seriesCounts={seriesCounts}
              seriesCountsByRegion={seriesCountsByRegion}
              liveRegionTotals={liveRegionTotals}
            />

          {/* COLUMN B: FAMILY FEED (50%) — scroll through Porsche families */}
          <div
            ref={feedRef}
            className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar scroll-smooth"
          >
            {porscheFamilies.map((family, idx) => (
              <FamilyCard key={family.slug} family={family} index={idx} />
            ))}
          </div>

          {/* COLUMN C: CONTEXT PANEL (28%) — synced with active family in scroll */}
          <div className="h-full overflow-hidden border-l border-primary/8 bg-card">
            {activeFamily ? (
              <FamilyContextPanel
                key={activeFamily.slug}
                family={activeFamily}
                auctions={filteredAuctions}
                regionalValByFamily={regionalValByFamily}
                allFamilies={porscheFamilies}
              />
            ) : (
              <BrandContextPanel brand={selectedBrand} allBrands={brands} auctions={filteredAuctions} regionalValByFamily={regionalValByFamily} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
