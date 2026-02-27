"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import Image from "next/image"
import { Link, useRouter } from "@/i18n/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Gavel,
  Wrench,
  Car,
  DollarSign,
  MessageCircle,
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  ArrowUpDown,
  Filter,
  Check,
  Info,
  Award,
  Shield,
  Globe,
  BarChart3,
  Gauge,
  FileText,
} from "lucide-react"
import type { CollectorCar, Region, FairValueByRegion } from "@/lib/curatedCars"
import type { LiveListingRegionTotals } from "@/lib/supabaseLiveListings"
import type { DbMarketDataRow, DbComparableRow, DbSoldRecord, DbAnalysisRow } from "@/lib/db/queries"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion, formatRegionalPrice as fmtRegional, toUsd, formatUsd, resolveRegion, convertFromUsd } from "@/lib/regionPricing"
import { AdvisorChat } from "@/components/advisor/AdvisorChat"
import { useLocale, useTranslations } from "next-intl"
import { getModelImage } from "@/lib/modelImages"
import { FamilySearchAndFilters, type FamilyFilters } from "@/components/filters/FamilySearchAndFilters"
import { AdvancedFilters, type AdvancedFilterValues } from "@/components/filters/AdvancedFilters"
import { extractSeries, getSeriesConfig, deriveBodyType, getSeriesVariants, matchVariant } from "@/lib/brandConfig"

// ─── MODEL TYPE (aggregated from cars) ───
type Model = {
  name: string
  slug: string
  carCount: number
  priceMin: number
  priceMax: number
  avgPrice: number
  representativeImage: string
  representativeCar: CollectorCar
  liveCount: number
  years: string
  categories: string[]
}

// ─── MOCK DATA FOR BRAND-LEVEL INSIGHTS ───
const brandThesis: Record<string, string> = {
  Porsche: "Porsche represents the pinnacle of driver engagement and investment potential. Air-cooled models (pre-1998) continue to appreciate at 8-12% annually, with the 993 generation showing particular strength. The brand's motorsport heritage and limited production of special models ensures sustained collector demand.",
  Ferrari: "Ferrari's collector car segment demonstrates remarkable resilience. The brand's strict production limits and heritage continue to drive demand across all eras. Classiche certification is essential—non-certified cars trade at 15-20% discounts.",
  McLaren: "McLaren F1 stands alone as the greatest supercar ever made. Central driving position, gold-lined engine bay, 240 mph top speed. Only 64 road cars built—the ultimate trophy asset. Values have appreciated 12% annually with no signs of slowing.",
  Lamborghini: "Lamborghini's poster-car icons from the 70s and 80s represent pure automotive artistry. The Miura created the supercar template, while the Countach defined a generation's dreams. Both continue to appreciate as blue-chip collectibles.",
  Nissan: "JDM vehicles are experiencing unprecedented demand as 25-year import eligibility expands the collector base. The R34 GT-R represents peak Japanese engineering, with V-Spec models commanding premium prices.",
  Toyota: "The A80 Supra has achieved icon status, bolstered by Fast & Furious cultural prominence and bulletproof 2JZ reliability. 6-speed manual turbo in stock condition is increasingly rare and highly sought after.",
  "Mercedes-Benz": "The 300SL Gullwing remains the world's first supercar. Revolutionary fuel injection made it the fastest production car of 1955. Iconic gullwing doors ensure eternal desirability and museum-quality investment potential.",
  "Aston Martin": "The DB5 is the most famous car in cinema history. James Bond's weapon of choice ensures perpetual collector demand. British craftsmanship and timeless design make it a cornerstone of any serious collection.",
  Lexus: "The LFA represents the pinnacle of Japanese engineering. Yamaha-designed V10 revs to 9,000 RPM. Only 500 produced worldwide. Hand-built perfection that will only appreciate as ICE supercars become extinct.",
  Ford: "The Ford GT is the ultimate homage to Le Mans glory. Supercharged V8, mid-engine layout, hand-built quality. American supercar renaissance leader with strong investment fundamentals.",
  BMW: "BMW's M division has created some of the most collectible driver's cars. From the E30 M3 to the 3.0 CSL, these machines combine motorsport DNA with everyday usability. Limited editions and special variants command significant premiums.",
  Acura: "The NSX was developed with Senna's input to create the everyday supercar. NA1 with pop-up headlights is most desirable. Legendary Honda reliability meets exotic performance.",
  Jaguar: "Enzo Ferrari called the E-Type 'the most beautiful car ever made.' Series 1 with covered headlights is the most desirable specification. Timeless British elegance at accessible price points.",
  default: "Investment-grade collector vehicles with strong appreciation potential and documented provenance.",
}

const brandStrategy: Record<string, { advice: string; complexity: string; liquidity: string }> = {
  Porsche: { advice: "Focus on low-mileage, documented examples with factory options. PTS cars and limited editions command 20-30% premiums.", complexity: "Moderate", liquidity: "High" },
  Ferrari: { advice: "Classiche certification is essential. Engage marque specialist for pre-purchase inspection. Service history documentation critical.", complexity: "High", liquidity: "High" },
  McLaren: { advice: "Full McLaren service history mandatory. Central seat position requires specialist knowledge. Trophy asset for serious collectors only.", complexity: "Very High", liquidity: "Low" },
  Lamborghini: { advice: "Polo Storico certification adds significant value. Concours condition examples trade at substantial premiums.", complexity: "High", liquidity: "Moderate" },
  BMW: { advice: "Focus on low-production M variants. CSL, GTS, and CS models appreciate fastest. Original paint and documented service history add 15-20% premium.", complexity: "Moderate", liquidity: "High" },
  Nissan: { advice: "Verify legal import status and EPA/DOT compliance. Stock, unmodified examples increasingly rare and valuable.", complexity: "Moderate", liquidity: "High" },
  Toyota: { advice: "Original window sticker and service records essential. 6-speed manual commands significant premium over automatic.", complexity: "Low", liquidity: "Very High" },
  default: { advice: "Prioritize documented history and matching numbers. Manual transmissions command 15-20% premiums over automatics.", complexity: "Moderate", liquidity: "Moderate" },
}

const ownershipCosts: Record<string, { insurance: number; storage: number; maintenance: number }> = {
  McLaren: { insurance: 45000, storage: 12000, maintenance: 25000 },
  Porsche: { insurance: 8500, storage: 6000, maintenance: 8000 },
  Ferrari: { insurance: 18000, storage: 8000, maintenance: 15000 },
  Lamborghini: { insurance: 15000, storage: 8000, maintenance: 12000 },
  BMW: { insurance: 4500, storage: 4200, maintenance: 5000 },
  Nissan: { insurance: 4500, storage: 3600, maintenance: 3500 },
  Toyota: { insurance: 3200, storage: 3600, maintenance: 2500 },
  "Mercedes-Benz": { insurance: 6500, storage: 4800, maintenance: 6000 },
  "Aston Martin": { insurance: 8000, storage: 6000, maintenance: 10000 },
  Lexus: { insurance: 6000, storage: 4800, maintenance: 4500 },
  Ford: { insurance: 5500, storage: 4200, maintenance: 4000 },
  Acura: { insurance: 3000, storage: 3600, maintenance: 2800 },
  Jaguar: { insurance: 4500, storage: 4200, maintenance: 5000 },
  default: { insurance: 5000, storage: 4800, maintenance: 5000 },
}

// ─── MOCK MARKET DEPTH (per brand) ───
const mockMarketDepth: Record<string, { auctionsPerYear: number; avgDaysToSell: number; sellThroughRate: number; demandScore: number }> = {
  Porsche: { auctionsPerYear: 340, avgDaysToSell: 12, sellThroughRate: 89, demandScore: 9 },
  Ferrari: { auctionsPerYear: 180, avgDaysToSell: 18, sellThroughRate: 82, demandScore: 9 },
  McLaren: { auctionsPerYear: 15, avgDaysToSell: 45, sellThroughRate: 72, demandScore: 7 },
  Lamborghini: { auctionsPerYear: 95, avgDaysToSell: 22, sellThroughRate: 78, demandScore: 8 },
  BMW: { auctionsPerYear: 280, avgDaysToSell: 14, sellThroughRate: 85, demandScore: 8 },
  Nissan: { auctionsPerYear: 120, avgDaysToSell: 8, sellThroughRate: 94, demandScore: 9 },
  Toyota: { auctionsPerYear: 85, avgDaysToSell: 6, sellThroughRate: 96, demandScore: 10 },
  "Mercedes-Benz": { auctionsPerYear: 150, avgDaysToSell: 20, sellThroughRate: 80, demandScore: 7 },
  "Aston Martin": { auctionsPerYear: 60, avgDaysToSell: 28, sellThroughRate: 75, demandScore: 7 },
  Lexus: { auctionsPerYear: 25, avgDaysToSell: 15, sellThroughRate: 88, demandScore: 8 },
  Ford: { auctionsPerYear: 45, avgDaysToSell: 18, sellThroughRate: 82, demandScore: 7 },
  Acura: { auctionsPerYear: 35, avgDaysToSell: 10, sellThroughRate: 90, demandScore: 8 },
  Jaguar: { auctionsPerYear: 70, avgDaysToSell: 25, sellThroughRate: 76, demandScore: 6 },
  default: { auctionsPerYear: 80, avgDaysToSell: 20, sellThroughRate: 78, demandScore: 7 },
}

// ─── PRICE RANGE OPTIONS ───
const priceRanges = [
  { label: "All Prices", min: 0, max: Infinity },
  { label: "Under $100K", min: 0, max: 100000 },
  { label: "$100K - $250K", min: 100000, max: 250000 },
  { label: "$250K - $500K", min: 250000, max: 500000 },
  { label: "$500K - $1M", min: 500000, max: 1000000 },
  { label: "$1M - $5M", min: 1000000, max: 5000000 },
  { label: "$5M+", min: 5000000, max: Infinity },
]

// ─── SORT OPTIONS ───
const sortOptions = [
  { key: "priceHighToLow" as const, value: "price-desc" },
  { key: "priceLowToHigh" as const, value: "price-asc" },
  { key: "yearNewestFirst" as const, value: "year-desc" },
  { key: "yearOldestFirst" as const, value: "year-asc" },
  { key: "mostListed" as const, value: "count-desc" },
]

// Sort options for individual car feed (no "most listed")
const carSortOptions = [
  { key: "priceHighToLow" as const, value: "price-desc" },
  { key: "priceLowToHigh" as const, value: "price-asc" },
  { key: "yearNewestFirst" as const, value: "year-desc" },
  { key: "yearOldestFirst" as const, value: "year-asc" },
]

const SORT_LABELS: Record<string, string> = {
  "price-desc": "Precio ↓",
  "price-asc": "Precio ↑",
  "year-desc": "Año ↓",
  "year-asc": "Año ↑",
  "count-desc": "Cantidad",
}

// ─── HELPERS ───

function timeLeft(
  endTime: Date,
  labels: { ended: string; day: string; hour: string; minute: string }
): string {
  const diff = endTime.getTime() - Date.now()
  if (diff <= 0) return labels.ended
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}${labels.day} ${hrs}${labels.hour}`
  const mins = Math.floor((diff % 3600000) / 60000)
  return `${hrs}${labels.hour} ${mins}${labels.minute}`
}

// ─── EXTRACT FAMILY FROM MODEL NAME ───
// Now delegates to centralized brandConfig.extractSeries for series-level taxonomy
function extractFamily(modelName: string, year?: number, makeName?: string): string {
  return extractSeries(modelName, year || 0, makeName || "Porsche")
}

// ─── EXTRACT GENERATION FROM MODEL NAME ───
function extractGenerationFromModel(modelName: string, year?: number): string | null {
  // With series-level taxonomy, the series IS the generation
  // This function is kept for backward compatibility but returns null
  // since generation drill-down is handled at the series level
  return null
}

// ─── AGGREGATE CARS INTO FAMILIES ───
function aggregateModels(cars: CollectorCar[], make: string): Model[] {
  const familyMap = new Map<string, CollectorCar[]>()

  // Group by FAMILY (not specific model)
  cars.forEach(car => {
    const family = extractFamily(car.model, car.year, make)
    const existing = familyMap.get(family) || []
    existing.push(car)
    familyMap.set(family, existing)
  })

  // Convert to Model array
  const models: Model[] = []
  familyMap.forEach((familyCars, familyName) => {
    const prices = familyCars.map(c => c.currentBid).filter(p => p > 0)
    const years = familyCars.map(c => c.year)
    const categories = [...new Set(familyCars.map(c => c.category))]
    const liveCount = familyCars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON").length

    // Get representative car (highest value)
    const repCar = familyCars.sort((a, b) => b.currentBid - a.currentBid)[0]
    const make = repCar.make

    // Prefer the actual car's scraped image; fall back to static model image
    const carImage = repCar.images?.[0] || repCar.image
    const isPlaceholder = !carImage || carImage.includes("placeholder")
    const representativeImage = isPlaceholder
      ? (getModelImage(make, familyName) || carImage || "")
      : carImage

    // Year range
    const minYear = Math.min(...years)
    const maxYear = Math.max(...years)
    const yearStr = minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`

    models.push({
      name: familyName,
      slug: familyName.toLowerCase().replace(/\s+/g, "-"),
      carCount: familyCars.length,
      priceMin: prices.length > 0 ? Math.min(...prices) : 0,
      priceMax: prices.length > 0 ? Math.max(...prices) : 0,
      avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      representativeImage,
      representativeCar: repCar,
      liveCount,
      years: yearStr,
      categories,
    })
  })

  // Sort by brandConfig order (series display priority), fallback to avgPrice
  return models.sort((a, b) => {
    const orderA = getSeriesConfig(a.slug, make)?.order ?? 99
    const orderB = getSeriesConfig(b.slug, make)?.order ?? 99
    if (orderA !== orderB) return orderA - orderB
    return b.avgPrice - a.avgPrice
  })
}

// ─── FILTER CHIP ───
function FilterChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string
  active: boolean
  onClick: () => void
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium transition-all
        ${active
          ? "bg-[#F8B4D9] text-[#0b0b10]"
          : "bg-white/5 text-[#9CA3AF] hover:bg-white/10 border border-white/10"
        }
      `}
    >
      {label}
      {count !== undefined && (
        <span className={`text-[10px] ${active ? "text-[#0b0b10]/60" : "text-[#4B5563]"}`}>
          ({count})
        </span>
      )}
    </button>
  )
}

// ─── SORT SELECTOR (compact inline for Column B) ───
function SortSelector({
  sortBy,
  setSortBy,
  options,
}: {
  sortBy: string
  setSortBy: (v: string) => void
  options: { key: string; value: string }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-[10px] text-[#6B7280] hover:text-[#FFFCF7] transition-colors"
      >
        <ArrowUpDown className="size-3" />
        <span className="font-medium">{SORT_LABELS[sortBy] || "Ordenar"}</span>
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-40 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSortBy(opt.value); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-[11px] transition-colors ${
                  sortBy === opt.value
                    ? "text-[#F8B4D9] bg-[rgba(248,180,217,0.08)]"
                    : "text-[#9CA3AF] hover:text-[#FFFCF7] hover:bg-white/5"
                }`}
              >
                {SORT_LABELS[opt.value]}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── DROPDOWN SELECT ───
function DropdownSelect({
  label,
  value,
  options,
  onChange,
  icon: Icon,
}: {
  label: string
  value: string
  options: { label: string; value: string }[]
  onChange: (value: string) => void
  icon?: React.ComponentType<{ className?: string }>
}) {
  const [open, setOpen] = useState(false)
  const selectedOption = options.find(o => o.value === value)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-[12px] font-medium text-[#9CA3AF] hover:bg-white/10 transition-colors min-w-[160px]"
      >
        {Icon && <Icon className="size-4 text-[#F8B4D9]" />}
        <span className="flex-1 text-left">{selectedOption?.label || label}</span>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 mt-2 w-full min-w-[200px] rounded-xl bg-[#0F1012] border border-white/10 shadow-xl z-50 overflow-hidden"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`
                    w-full flex items-center justify-between px-4 py-3 text-[12px] transition-colors
                    ${option.value === value
                      ? "bg-[#F8B4D9]/10 text-[#F8B4D9]"
                      : "text-[#9CA3AF] hover:bg-white/5"
                    }
                  `}
                >
                  {option.label}
                  {option.value === value && <Check className="size-4" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── MOBILE: REGION PILLS FOR MAKE PAGE ───
function MakePageRegionPills({ regionCounts }: { regionCounts: Record<string, number> }) {
  const { selectedRegion, setSelectedRegion } = useRegion()
  const REGIONS = [
    { id: "all", label: "All", flag: "\u{1F30D}", countKey: "All" },
    { id: "US", label: "US", flag: "\u{1F1FA}\u{1F1F8}", countKey: "US" },
    { id: "UK", label: "UK", flag: "\u{1F1EC}\u{1F1E7}", countKey: "UK" },
    { id: "EU", label: "EU", flag: "\u{1F1EA}\u{1F1FA}", countKey: "EU" },
    { id: "JP", label: "JP", flag: "\u{1F1EF}\u{1F1F5}", countKey: "JP" },
  ]
  return (
    <div className="sticky top-0 z-20 bg-[#0b0b10]/95 backdrop-blur-md border-b border-white/5 px-4 py-2.5">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {REGIONS.map((region) => {
          const isActive = (region.id === "all" && !selectedRegion) || selectedRegion === region.id
          const count = regionCounts[region.countKey] || 0
          return (
            <button
              key={region.id}
              onClick={() => setSelectedRegion(region.id === "all" ? null : region.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all shrink-0 ${isActive
                  ? "bg-[#F8B4D9]/15 text-[#F8B4D9] border border-[#F8B4D9]/25"
                  : "text-[#6B7280] hover:text-[#9CA3AF] bg-white/[0.03] border border-transparent"
                }`}
            >
              <span className="text-[12px]">{region.flag}</span>
              <span>{region.label}</span>
              <span className={`text-[9px] ${isActive ? "text-[#F8B4D9]/60" : "text-[#4B5563]"}`}>{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── MOBILE: HERO MODEL (first model) ───
function MobileHeroModel({ model, make }: { model: Model; make: string }) {
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-")
  const t = useTranslations("makePage")
  const { selectedRegion } = useRegion()
  const router = useRouter()

  return (
    <Link href={`/cars/${makeSlug}/${model.representativeCar.id}`} className="block relative">
      <div className="relative h-[40dvh] min-h-[280px] w-full overflow-hidden">
        <Image
          src={model.representativeImage}
          alt={model.name}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-[#0b0b10]/40 to-transparent" />

        {/* Back link */}
        <div className="absolute top-4 left-4">
          <button onClick={() => router.push("/")} className="flex items-center gap-1.5 text-[11px] text-[rgba(255,252,247,0.5)] hover:text-[rgba(255,252,247,0.8)] transition-colors cursor-pointer">
            <ArrowLeft className="size-3.5" />
            {t("hero.backToCollection")}
          </button>
        </div>

        {/* Grade badge */}
        <div className="absolute top-4 right-4">
          <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${model.representativeCar.investmentGrade === "AAA"
              ? "bg-emerald-500/30 text-emerald-300"
              : model.representativeCar.investmentGrade === "AA"
                ? "bg-[rgba(248,180,217,0.3)] text-[#F8B4D9]"
                : "bg-white/20 text-white"
            }`}>
            {model.representativeCar.investmentGrade}
          </span>
        </div>

        {/* Live badge */}
        {model.liveCount > 0 && (
          <div className="absolute top-12 right-4 flex items-center gap-1.5 rounded-full bg-[#0b0b10]/70 backdrop-blur-md px-2.5 py-1">
            <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-emerald-400">{model.liveCount} LIVE</span>
          </div>
        )}

        {/* Overlaid info */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
          <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#F8B4D9]">
            {t("hero.brandCollection")}
          </span>
          <h1 className="text-3xl font-bold text-[#FFFCF7] mt-1">
            {make} {getSeriesConfig(model.slug || model.name.toLowerCase(), make)?.label || model.name}
          </h1>
          <p className="text-[12px] text-[rgba(255,252,247,0.5)] mt-0.5">
            {model.years} · {model.carCount} {model.carCount === 1 ? "car" : "cars"}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[16px] font-bold font-mono text-[#F8B4D9]">
              {formatPriceForRegion(model.priceMin, selectedRegion)} – {formatPriceForRegion(model.priceMax, selectedRegion)}
            </span>
          </div>
          {/* Categories */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {model.categories.slice(0, 3).map((cat) => (
              <span key={cat} className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm text-[10px] text-[#FFFCF7]/70">
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── MOBILE: MODEL ROW (compact) ───
function MobileModelRow({
  model,
  make,
  onTap,
}: {
  model: Model
  make: string
  onTap: () => void
}) {
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-")
  const { selectedRegion } = useRegion()

  const gradeColor = (g: string) => {
    switch (g) {
      case "AAA": return "text-emerald-400"
      case "AA": return "text-[#F8B4D9]"
      default: return "text-[#6B7280]"
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {/* Thumbnail — links to car detail */}
      <Link
        href={`/cars/${makeSlug}/${model.representativeCar.id}`}
        className="relative w-20 h-14 rounded-xl overflow-hidden shrink-0 bg-[#0F1012]"
      >
        <Image
          src={model.representativeImage}
          alt={model.name}
          fill
          className="object-cover"
          sizes="80px"
        />
        {model.liveCount > 0 && (
          <div className="absolute top-1 left-1 flex items-center gap-1 rounded-full bg-[#0b0b10]/80 px-1.5 py-0.5">
            <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[8px] font-bold text-emerald-400">{model.liveCount}</span>
          </div>
        )}
      </Link>

      {/* Info — links to car detail */}
      <Link
        href={`/cars/${makeSlug}/${model.representativeCar.id}`}
        className="flex-1 min-w-0"
      >
        <p className="text-[14px] font-semibold text-[#FFFCF7] truncate">
          {getSeriesConfig(model.slug || model.name.toLowerCase(), make)?.label || model.name}
        </p>
        <p className="text-[11px] text-[#6B7280] mt-0.5">
          {model.years} · {model.carCount} {model.carCount === 1 ? "car" : "cars"}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[12px] font-mono text-[#F8B4D9]">
            {formatPriceForRegion(model.priceMin, selectedRegion)} – {formatPriceForRegion(model.priceMax, selectedRegion)}
          </span>
        </div>
      </Link>

      {/* Right — grade + context expand */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[10px] font-bold ${gradeColor(model.representativeCar.investmentGrade)}`}>
          {model.representativeCar.investmentGrade}
        </span>
        <button
          onClick={onTap}
          className="flex items-center gap-1 text-[10px] text-[#6B7280] active:text-[#F8B4D9]"
        >
          <Info className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── MOBILE: MODEL CONTEXT (4 panels) ───
function MobileModelContext({
  model,
  make,
  cars,
  allCars,
  allModels,
  dbOwnershipCosts,
}: {
  model: Model
  make: string
  cars: CollectorCar[]
  allCars: CollectorCar[]
  allModels: Model[]
  dbOwnershipCosts?: { insurance?: number; storage?: number; maintenance?: number } | null
}) {
  const t = useTranslations("makePage")
  const { selectedRegion, effectiveRegion } = useRegion()

  const allModelCars = allCars.filter(c => c.model === model.name)
  const regionalPricing = useMemo(() => aggregateRegionalPricing(allModelCars), [allModelCars])
  const bestRegion = regionalPricing ? findBestRegion(regionalPricing) : null
  const depth = deriveModelDepth(allModelCars)

  const fallbackCosts = ownershipCosts[make] || ownershipCosts.default
  const baseCosts = {
    insurance: dbOwnershipCosts?.insurance ?? fallbackCosts.insurance,
    storage: dbOwnershipCosts?.storage ?? fallbackCosts.storage,
    maintenance: dbOwnershipCosts?.maintenance ?? fallbackCosts.maintenance,
  }
  const brandAvgPrice = allCars.length > 0 ? allCars.reduce((s, c) => s + c.currentBid, 0) / allCars.length : 1
  const scaleFactor = brandAvgPrice > 0 ? model.avgPrice / brandAvgPrice : 1
  const costs = {
    insurance: Math.round(baseCosts.insurance * scaleFactor),
    storage: Math.round(baseCosts.storage * scaleFactor),
    maintenance: Math.round(baseCosts.maintenance * scaleFactor),
  }
  const totalAnnualCost = costs.insurance + costs.storage + costs.maintenance

  const maxRegionalUsd = regionalPricing
    ? Math.max(...(["US", "EU", "UK", "JP"] as const).map(r =>
      toUsd((regionalPricing[r].low + regionalPricing[r].high) / 2, regionalPricing[r].currency)
    ))
    : 1

  return (
    <div className="mx-4 mt-3 space-y-3">
      {/* Panel 1: Regional Valuation */}
      {regionalPricing && (
        <div className="rounded-2xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="size-3.5 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#9CA3AF]">
              {t("mobileContext.valuationByMarket")}
            </span>
          </div>
          <div className="space-y-2.5">
            {(["US", "UK", "EU", "JP"] as const).map(region => {
              const pricing = regionalPricing[region]
              const isBest = bestRegion === region
              const isSelected = region === effectiveRegion
              const usdAvg = toUsd((pricing.low + pricing.high) / 2, pricing.currency)
              const barWidth = (usdAvg / maxRegionalUsd) * 100
              return (
                <div key={region} className={isSelected ? "rounded-lg bg-[rgba(248,180,217,0.04)] -mx-1 px-1 py-1" : ""}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px]">{regionLabels[region]?.flag}</span>
                      <span className={`text-[11px] font-medium ${isSelected ? "text-[#F8B4D9]" : "text-[#D1D5DB]"}`}>{region}</span>
                      {isBest && <span className="text-[7px] font-bold text-emerald-400">{t("mobileContext.best")}</span>}
                      {isSelected && <span className="text-[7px] font-bold text-[#F8B4D9]">{t("mobileContext.yourMarket")}</span>}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] font-mono text-[#FFFCF7]">{fmtRegional(pricing.low, pricing.currency)}</span>
                      <span className="text-[8px] text-[#6B7280]">→</span>
                      <span className={`text-[10px] font-mono font-semibold ${isBest ? "text-emerald-400" : "text-[#F8B4D9]"}`}>
                        {fmtRegional(pricing.high, pricing.currency)}
                      </span>
                    </div>
                  </div>
                  <div className="h-[5px] rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isBest ? "bg-emerald-400/50" : isSelected ? "bg-[#F8B4D9]/60" : "bg-[#F8B4D9]/30"}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Panel 2: Market Depth — 2x2 grid */}
      <div className="rounded-2xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="size-3.5 text-[#F8B4D9]" />
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#9CA3AF]">
            {t("mobileContext.marketDepth")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] text-[#6B7280] uppercase">{t("mobileContext.auctionsPerYear")}</p>
            <p className="text-[14px] font-mono font-semibold text-[#FFFCF7]">{depth.auctionsPerYear}</p>
          </div>
          <div>
            <p className="text-[9px] text-[#6B7280] uppercase">{t("mobileContext.avgDaysToSell")}</p>
            <p className="text-[14px] font-mono font-semibold text-[#FFFCF7]">{depth.avgDaysToSell}d</p>
          </div>
          <div>
            <p className="text-[9px] text-[#6B7280] uppercase">{t("mobileContext.sellThroughRate")}</p>
            <p className="text-[14px] font-mono font-semibold text-emerald-400">{depth.sellThroughRate}%</p>
          </div>
          <div>
            <p className="text-[9px] text-[#6B7280] uppercase">{t("mobileContext.demandScore")}</p>
            <p className="text-[14px] font-mono font-bold text-[#F8B4D9]">{depth.demandScore}/10</p>
          </div>
        </div>
      </div>

      {/* Panel 4: Ownership Cost */}
      <div className="rounded-2xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="size-3.5 text-[#F8B4D9]" />
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#9CA3AF]">
            {t("mobileContext.ownershipCost")}
          </span>
        </div>
        <div className="space-y-2">
          {[
            { label: t("mobileContext.insurance"), value: costs.insurance },
            { label: t("mobileContext.storage"), value: costs.storage },
            { label: t("mobileContext.maintenance"), value: costs.maintenance },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-[11px] text-[#9CA3AF]">{item.label}</span>
              <span className="text-[11px] font-mono text-[#D1D5DB]">{formatPriceForRegion(item.value, selectedRegion)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/5">
            <span className="text-[11px] font-medium text-[#FFFCF7]">{t("mobileContext.total")}</span>
            <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">{formatPriceForRegion(totalAnnualCost, selectedRegion)}{t("mobileContext.perYear")}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MOBILE: MODEL CONTEXT BOTTOM SHEET ───
function MobileModelContextSheet({
  model,
  make,
  cars,
  allCars,
  allModels,
  onClose,
  dbOwnershipCosts,
}: {
  model: Model | null
  make: string
  cars: CollectorCar[]
  allCars: CollectorCar[]
  allModels: Model[]
  onClose: () => void
  dbOwnershipCosts?: { insurance?: number; storage?: number; maintenance?: number } | null
}) {
  if (!model) return null

  return (
    <AnimatePresence>
      {model && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-3xl bg-[#0b0b10] border-t border-white/10 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <p className="text-[14px] font-semibold text-[#FFFCF7]">{make} {getSeriesConfig(model.slug || model.name.toLowerCase(), make)?.label || model.name}</p>
                <p className="text-[11px] text-[#6B7280] mt-0.5">{model.years} · {model.carCount} cars</p>
              </div>
              <button
                onClick={onClose}
                className="size-8 flex items-center justify-center rounded-full bg-white/5"
              >
                <X className="size-4 text-[#9CA3AF]" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto max-h-[calc(85vh-70px)] pb-8">
              <MobileModelContext
                model={model}
                make={make}
                cars={cars}
                allCars={allCars}
                allModels={allModels}
                dbOwnershipCosts={dbOwnershipCosts}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── MOBILE: LIVE AUCTIONS FOR MAKE PAGE ───
function MobileMakeLiveAuctions({ cars, totalLiveCount }: { cars: CollectorCar[]; totalLiveCount: number }) {
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const { selectedRegion } = useRegion()

  const liveAuctions = useMemo(() => {
    return cars
      .filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON")
      .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
      .slice(0, 6)
  }, [cars])

  if (liveAuctions.length === 0) return null

  const timeLabels = {
    ended: tAuction("time.ended"),
    day: tAuction("time.units.day"),
    hour: tAuction("time.units.hour"),
    minute: tAuction("time.units.minute"),
  }

  return (
    <div className="mt-6">
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
          {t("mobileContext.liveAuctions")}
        </span>
        <span className="text-[10px] font-mono font-semibold text-[#F8B4D9]">{totalLiveCount}</span>
      </div>
      <div className="divide-y divide-white/5">
        {liveAuctions.map((car) => {
          const isEndingSoon = car.status === "ENDING_SOON"
          const remaining = timeLeft(new Date(car.endTime), timeLabels)
          return (
            <Link
              key={car.id}
              href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-white/[0.03] transition-colors"
            >
              <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-[#0F1012]">
                <Image src={car.image} alt={car.title} fill className="object-cover" sizes="64px" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[#FFFCF7] truncate">{car.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">
                    {formatPriceForRegion(car.currentBid, selectedRegion)}
                  </span>
                  <span className="text-[10px] text-[#6B7280]">
                    {tAuction("bids.count", { count: car.bidCount })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Clock className={`size-3 ${isEndingSoon ? "text-[#FB923C]" : "text-[#6B7280]"}`} />
                <span className={`text-[10px] font-mono font-medium ${isEndingSoon ? "text-[#FB923C]" : "text-[#6B7280]"}`}>
                  {remaining}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── CAR CARD IN GRID ───
function CarCard({ car, index }: { car: CollectorCar; index: number }) {
  const locale = useLocale()
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const tStatus = useTranslations("status")
  const { selectedRegion } = useRegion()

  const isLive = car.status === "ACTIVE" || car.status === "ENDING_SOON"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      layout
    >
      <Link
        href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
        className="group block rounded-2xl bg-[rgba(15,14,22,0.6)] border border-[rgba(248,180,217,0.08)] overflow-hidden hover:border-[rgba(248,180,217,0.2)] transition-all duration-300"
      >
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <Image
            src={car.image}
            alt={car.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-transparent to-transparent" />

          {/* Status badge */}
          {isLive && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-[#0b0b10]/80 backdrop-blur-md px-2.5 py-1">
              <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-400">{tStatus("live")}</span>
            </div>
          )}

          {/* Platform badge - real data source */}
          <div className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-medium bg-white/10 text-white/70 border border-white/20">
            {car.platform === "BRING_A_TRAILER" ? "BaT" :
              car.platform === "CARS_AND_BIDS" ? "C&B" :
                car.platform === "COLLECTING_CARS" ? "CC" :
                  car.platform === "AUTO_SCOUT_24" ? "AS24" : car.platform}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-[15px] font-semibold text-[#FFFCF7] group-hover:text-[#F8B4D9] transition-colors line-clamp-1">
            {car.title}
          </h3>

          {/* Stats row - real data only */}
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#4B5563]">
                {isLive ? t("card.currentBid") : t("card.soldFor")}
              </p>
              <p className="text-[18px] font-bold font-mono text-[#F8B4D9]">
                {formatPriceForRegion(car.currentBid, selectedRegion)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#4B5563]">
                {tAuction("specs.mileage")}
              </p>
              <p className="text-[13px] font-medium text-[#9CA3AF]">
                {car.mileage.toLocaleString(locale)} {car.mileageUnit}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-[#4B5563]">
              {isLive && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {timeLeft(new Date(car.endTime), {
                    ended: tAuction("time.ended"),
                    day: tAuction("time.units.day"),
                    hour: tAuction("time.units.hour"),
                    minute: tAuction("time.units.minute"),
                  })}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Gavel className="size-3" />
                {tAuction("bids.count", { count: car.bidCount })}
              </span>
            </div>
            <ChevronRight className="size-4 text-[#4B5563] group-hover:text-[#F8B4D9] transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── MOBILE FILTER SHEET ───
function MobileFilterSheet({
  open,
  onClose,
  models,
  selectedModel,
  setSelectedModel,
  selectedPriceRange,
  setSelectedPriceRange,
  selectedStatus,
  setSelectedStatus,
  sortBy,
  setSortBy,
  cars,
  filteredCount,
}: {
  open: boolean
  onClose: () => void
  models: string[]
  selectedModel: string
  setSelectedModel: (m: string) => void
  selectedPriceRange: number
  setSelectedPriceRange: (p: number) => void
  selectedStatus: string
  setSelectedStatus: (s: string) => void
  sortBy: string
  setSortBy: (s: string) => void
  cars: CollectorCar[]
  filteredCount: number
}) {
  const t = useTranslations("makePage")
  const tStatus = useTranslations("status")

  const statuses = [
    { value: "All", label: t("filters.statusAll") },
    { value: "Live", label: tStatus("live") },
    { value: "Ended", label: tStatus("ended") },
  ]

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-3xl bg-[#0F1012] border-t border-white/10 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-[#F8B4D9]" />
                <span className="text-[12px] font-semibold tracking-[0.1em] uppercase text-[#FFFCF7]">
                  {t("mobileFilters.title")}
                </span>
              </div>
              <button
                onClick={onClose}
                className="size-8 flex items-center justify-center rounded-full bg-white/5"
              >
                <X className="size-4 text-[#9CA3AF]" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-6 space-y-6 overflow-y-auto max-h-[calc(85vh-140px)]">
              {/* Model Filter */}
              <div>
                <label className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#4B5563] mb-3 block">
                  {t("filters.model")}
                </label>
                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    label={t("filters.allModels")}
                    active={selectedModel === "All"}
                    onClick={() => setSelectedModel("All")}
                  />
                  {models.slice(0, 12).map(model => (
                    <FilterChip
                      key={model}
                      label={model}
                      active={selectedModel === model}
                      onClick={() => setSelectedModel(model)}
                      count={cars.filter(c => c.model === model).length}
                    />
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#4B5563] mb-3 block">
                  {t("filters.priceRange")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {priceRanges.map((range, i) => (
                    <FilterChip
                      key={range.label}
                      label={range.label}
                      active={selectedPriceRange === i}
                      onClick={() => setSelectedPriceRange(i)}
                    />
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#4B5563] mb-3 block">
                  {t("filters.status")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <FilterChip
                      key={status.value}
                      label={status.label}
                      active={selectedStatus === status.value}
                      onClick={() => setSelectedStatus(status.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#4B5563] mb-3 block">
                  {t("filters.sortBy")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map((option) => (
                    <FilterChip
                      key={option.value}
                      label={t(`sort.${option.key}`)}
                      active={sortBy === option.value}
                      onClick={() => setSortBy(option.value)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/5 bg-[#0F1012]">
              <button
                onClick={onClose}
                className="w-full py-4 rounded-xl bg-[#F8B4D9] text-[#0b0b10] font-semibold text-[13px]"
              >
                {t("mobileFilters.showResults", { count: filteredCount })}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── PLATFORM LABELS ───
const platformLabels: Record<string, { short: string; color: string }> = {
  BRING_A_TRAILER: { short: "BaT", color: "bg-amber-500/20 text-amber-400" },
  CARS_AND_BIDS: { short: "C&B", color: "bg-blue-500/20 text-blue-400" },
  COLLECTING_CARS: { short: "CC", color: "bg-purple-500/20 text-purple-400" },
  AUTO_SCOUT_24: { short: "AS24", color: "bg-green-500/20 text-green-400" },
  RM_SOTHEBYS: { short: "RM", color: "bg-rose-500/20 text-rose-400" },
  GOODING: { short: "Gooding", color: "bg-emerald-500/20 text-emerald-400" },
  BONHAMS: { short: "Bonhams", color: "bg-cyan-500/20 text-cyan-400" },
}

// ─── REGION FLAG LABELS ───
const regionLabels: Record<string, { flag: string; short: string }> = {
  US: { flag: "🇺🇸", short: "US" },
  EU: { flag: "🇪🇺", short: "EU" },
  UK: { flag: "🇬🇧", short: "UK" },
  JP: { flag: "🇯🇵", short: "JP" },
}

// ─── SIDEBAR FILTER PILL ───
function SidebarPill({
  label,
  active,
  onClick,
  count,
}: {
  label: string
  active: boolean
  onClick: () => void
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap ${active
          ? "bg-[#F8B4D9] text-[#0b0b10]"
          : "bg-white/5 text-[#9CA3AF] hover:bg-white/10 border border-white/[0.06]"
        }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`ml-1 text-[9px] ${active ? "text-[#0b0b10]/60" : "text-[#4B5563]"}`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ─── MODEL NAV SIDEBAR (Left column) ───
function ModelNavSidebar({
  make,
  cars,
  models,
  currentModelIndex,
  onSelectModel,
}: {
  make: string
  cars: CollectorCar[]
  models: Model[]
  currentModelIndex: number
  onSelectModel: (index: number) => void
}) {
  const tAuction = useTranslations("auctionDetail")
  const { selectedRegion } = useRegion()
  const minPrice = cars.length > 0 ? Math.min(...cars.map(c => c.currentBid)) : 0
  const maxPrice = cars.length > 0 ? Math.max(...cars.map(c => c.currentBid)) : 0
  const liveCount = cars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON").length

  // Live auction cars for the bottom half
  const liveCars = useMemo(() =>
    cars
      .filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON")
      .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime()),
    [cars]
  )

  // Grade color helper
  const gradeColor = (g: string) => {
    switch (g) {
      case "AAA": return "text-emerald-400"
      case "AA": return "text-blue-400"
      case "A": return "text-amber-400"
      default: return "text-[#6B7280]"
    }
  }

  return (
    <div className="h-full flex flex-col border-r border-white/5 overflow-hidden">
      {/* Compact brand header */}
      <div className="shrink-0 px-3 pt-2.5 pb-2 border-b border-white/5">
        <div className="flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <ArrowLeft className="size-3 text-[#6B7280]" />
            <h1 className="text-[13px] font-bold text-[#FFFCF7] tracking-wide uppercase hover:text-[#F8B4D9] transition-colors">{make}</h1>
          </a>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-[#F8B4D9]">{cars.length}</span>
            {liveCount > 0 && (
              <span className="flex items-center gap-1">
                <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-400">{liveCount}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 50/50 SPLIT: MODELS + LIVE BIDS ═══ */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* TOP HALF: MODELS LIST */}
        <div className="h-1/2 flex flex-col border-b border-white/5 overflow-hidden">
          {/* Models header */}
          <div className="shrink-0 px-3 py-1.5 flex items-center justify-between bg-[rgba(11,11,16,0.4)]">
            <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-[#6B7280]">
              MODELS
            </span>
            <span className="text-[9px] text-[#4B5563]">
              {models.length}
            </span>
          </div>

          {/* Scrollable models */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {models.map((model, index) => (
              <button
                key={model.slug}
                onClick={() => onSelectModel(index)}
                className={`w-full text-left flex gap-2.5 px-3 py-2 border-b border-white/[0.03] transition-all ${index === currentModelIndex
                    ? "bg-[rgba(248,180,217,0.08)] border-l-2 border-l-[#F8B4D9]"
                    : "hover:bg-white/[0.02]"
                  }`}
              >
                {/* Mini thumbnail */}
                <div className="relative w-14 h-10 rounded-lg overflow-hidden shrink-0 bg-[#0F1012]">
                  <Image
                    src={model.representativeImage}
                    alt={model.name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                  {model.liveCount > 0 && (
                    <div className="absolute top-0.5 right-0.5 size-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
                {/* Model info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-[12px] font-semibold truncate ${index === currentModelIndex ? "text-[#F8B4D9]" : "text-[#FFFCF7]"
                      }`}>
                      {getSeriesConfig(model.slug || model.name.toLowerCase(), make)?.label || model.name}
                    </p>
                    <span className={`text-[10px] font-bold shrink-0 ${gradeColor(model.representativeCar.investmentGrade)}`}>
                      {model.representativeCar.investmentGrade}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-[#6B7280]">{model.years}</span>
                    <span className="text-[10px] text-[#6B7280]">{model.carCount} cars</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#F8B4D9] mt-0.5 block">
                    {formatPriceForRegion(model.priceMin, selectedRegion)}–{formatPriceForRegion(model.priceMax, selectedRegion)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* BOTTOM HALF: LIVE BIDS */}
        <div className="h-1/2 flex flex-col overflow-hidden">
          {/* Live header */}
          <div className="shrink-0 px-3 py-1.5 flex items-center gap-2 bg-[rgba(11,11,16,0.4)]">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-emerald-400">
              LIVE NOW
            </span>
            {liveCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-[9px] font-bold text-emerald-400">
                {liveCount}
              </span>
            )}
          </div>

          {/* Scrollable live bids */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {liveCars.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <span className="text-[11px] text-[#4B5563]">No live auctions</span>
              </div>
            ) : (
              liveCars.map((car) => {
                const isEndingSoon = car.status === "ENDING_SOON"
                const makeSlug = car.make.toLowerCase().replace(/\s+/g, "-")
                return (
                  <Link
                    key={car.id}
                    href={`/cars/${makeSlug}/${car.id}`}
                    className="group flex gap-2.5 px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] transition-all"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-14 h-11 rounded-lg overflow-hidden shrink-0 bg-[#0F1012]">
                      <Image
                        src={car.image}
                        alt={car.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                      <div className="absolute top-0.5 right-0.5 size-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-[#FFFCF7] truncate group-hover:text-[#F8B4D9] transition-colors">
                        {car.year} {car.model}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-mono font-bold text-[#F8B4D9]">
                          {formatPriceForRegion(car.currentBid, selectedRegion)}
                        </span>
                        <span className={`flex items-center gap-1 text-[9px] ${isEndingSoon ? "text-orange-400" : "text-[#6B7280]"}`}>
                          <Clock className="size-2.5" />
                          {timeLeft(new Date(car.endTime), {
                            ended: tAuction("time.ended"),
                            day: tAuction("time.units.day"),
                            hour: tAuction("time.units.hour"),
                            minute: tAuction("time.units.minute"),
                          })}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CAR FEED CARD (Full-height card for individual cars) ───
function CarFeedCard({ car, make }: { car: CollectorCar; make: string }) {
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const { selectedRegion } = useRegion()
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-")

  const isEndingSoon = car.status === "ENDING_SOON"
  const grade = car.investmentGrade

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      <Link
        href={`/cars/${makeSlug}/${car.id}`}
        className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-[#0F1012] border border-white/5 group cursor-pointer hover:border-[rgba(248,180,217,0.2)] transition-all duration-300"
      >
        {/* TOP: CINEMATIC IMAGE */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
          {car.image ? (
            <Image
              src={car.image}
              alt={car.title}
              fill
              className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
              sizes="50vw"
              priority
              referrerPolicy="no-referrer"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-[#0F1012] flex items-center justify-center">
              <span className="text-[#6B7280] text-lg">{car.year} {car.model}</span>
            </div>
          )}

          {/* Vignette gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1012] via-transparent to-transparent pointer-events-none" />

          {/* Grade badge — top left */}
          <div className="absolute top-4 left-4">
            <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${
              grade === "AAA"
                ? "bg-emerald-500/30 text-emerald-300"
                : grade === "AA"
                  ? "bg-[rgba(248,180,217,0.3)] text-[#F8B4D9]"
                  : "bg-white/20 text-white"
            }`}>
              {grade}
            </span>
          </div>

          {/* Status badge — top right */}
          <div className="absolute top-4 right-4">
            {isEndingSoon && (
              <span className="flex items-center gap-1.5 rounded-full bg-orange-500/30 backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold text-orange-300">
                <Clock className="size-3 animate-pulse" />
                Ending Soon
              </span>
            )}
            {car.status === "ACTIVE" && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/30 backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>

        {/* BOTTOM: CAR INFO */}
        <div className="flex-1 w-full bg-[#0F1012] p-6 flex flex-col justify-between">
          {/* Car title */}
          <div>
            <h2 className="text-3xl font-bold text-[#FFFCF7] tracking-tight group-hover:text-[#F8B4D9] transition-colors">
              {car.year} {car.model}
            </h2>
            <p className="text-[13px] text-[#6B7280] mt-1">
              {car.mileage?.toLocaleString()} miles
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/5">
            {/* Current Bid */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <Gavel className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">Current Bid</span>
              </div>
              <p className="text-[15px] font-mono font-bold text-[#F8B4D9]">
                {formatPriceForRegion(car.currentBid, selectedRegion)}
              </p>
            </div>

            {/* Platform + Time Left */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <Clock className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">
                  {platformLabels[car.platform]?.short || car.platform.replace(/_/g, " ")}
                </span>
              </div>
              <p className={`text-[13px] font-medium ${isEndingSoon ? "text-orange-400" : "text-[#FFFCF7]"}`}>
                {timeLeft(new Date(car.endTime), {
                  ended: tAuction("time.ended"),
                  day: tAuction("time.units.day"),
                  hour: tAuction("time.units.hour"),
                  minute: tAuction("time.units.minute"),
                })}
              </p>
            </div>

            {/* Grade */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <Shield className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("sidebar.grade")}</span>
              </div>
              <p className={`text-[13px] font-semibold ${
                grade === "AAA" ? "text-emerald-400"
                  : grade === "AA" ? "text-blue-400"
                    : grade === "A" ? "text-amber-400"
                      : "text-[#6B7280]"
              }`}>{grade}</p>
            </div>
          </div>

          {/* Category */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] text-[#9CA3AF]">
              {car.category}
            </span>
            {car.region && (
              <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] text-[#9CA3AF]">
                {car.region}
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="mt-6 flex items-center justify-center rounded-xl bg-[#F8B4D9] py-3 group-hover:bg-[#f4cbde] transition-colors">
            <span className="text-[12px] font-semibold tracking-[0.1em] uppercase text-[#0b0b10]">
              View Investment Report
            </span>
            <ChevronRight className="size-4 text-[#0b0b10] ml-1" />
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── GENERATION FEED CARD (Full-height card for generation drill-down) ───
type GenerationAggregate = {
  id: string
  label: string
  carCount: number
  priceMin: number
  priceMax: number
  yearMin: number
  yearMax: number
  representativeImage: string
  representativeCar: string
  topGrade: string
}

function GenerationFeedCard({ gen, familyName, make, onClick }: { gen: GenerationAggregate; familyName: string; make: string; onClick: () => void }) {
  const { selectedRegion } = useRegion()

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      <button
        onClick={onClick}
        className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-[#0F1012] border border-white/5 group cursor-pointer hover:border-[rgba(248,180,217,0.2)] transition-all duration-300 text-left"
      >
        {/* TOP: CINEMATIC IMAGE */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
          {gen.representativeImage ? (
            <Image
              src={gen.representativeImage}
              alt={`${make} ${familyName} ${gen.label}`}
              fill
              className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
              sizes="50vw"
              priority
              referrerPolicy="no-referrer"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-[#0F1012] flex items-center justify-center">
              <span className="text-[#6B7280] text-lg">{familyName} {gen.label}</span>
            </div>
          )}

          {/* Vignette gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1012] via-transparent to-transparent pointer-events-none" />

          {/* Grade badge — top left */}
          <div className="absolute top-4 left-4">
            <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${
              gen.topGrade === "AAA"
                ? "bg-emerald-500/30 text-emerald-300"
                : gen.topGrade === "AA"
                  ? "bg-[rgba(248,180,217,0.3)] text-[#F8B4D9]"
                  : "bg-white/20 text-white"
            }`}>
              {gen.topGrade}
            </span>
          </div>

          {/* Car count badge — top right */}
          <div className="absolute top-4 right-4">
            <span className="rounded-full bg-[rgba(11,11,16,0.7)] backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-[#FFFCF7]">
              {gen.carCount} {gen.carCount === 1 ? "car" : "cars"}
            </span>
          </div>
        </div>

        {/* BOTTOM: GENERATION INFO */}
        <div className="flex-1 w-full bg-[#0F1012] p-6 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#F8B4D9] mb-1">
              {make} {familyName}
            </p>
            <h2 className="text-3xl font-bold text-[#FFFCF7] tracking-tight group-hover:text-[#F8B4D9] transition-colors">
              {gen.label}
            </h2>
            <p className="text-[13px] text-[#6B7280] mt-1">
              {gen.representativeCar}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/5">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <DollarSign className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">Price Range</span>
              </div>
              <p className="text-[13px] font-mono text-[#FFFCF7]">
                {formatPriceForRegion(gen.priceMin, selectedRegion)}&ndash;{formatPriceForRegion(gen.priceMax, selectedRegion)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <Car className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">Listings</span>
              </div>
              <p className="text-[13px] text-[#FFFCF7]">{gen.carCount} vehicles</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <Shield className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">Grade</span>
              </div>
              <p className={`text-[13px] font-semibold ${
                gen.topGrade === "AAA" ? "text-emerald-400"
                  : gen.topGrade === "AA" ? "text-blue-400"
                    : gen.topGrade === "A" ? "text-amber-400"
                      : "text-[#6B7280]"
              }`}>{gen.topGrade}</p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] font-medium tracking-[0.1em] uppercase text-[#9CA3AF] group-hover:text-[#F8B4D9] transition-colors">
              View Listings
            </span>
            <ChevronRight className="size-5 text-[#9CA3AF] group-hover:text-[#F8B4D9] group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </button>
    </div>
  )
}

// ─── MODEL FEED CARD (Full-height card for center column) ───
function ModelFeedCard({ model, make, onClick }: { model: Model; make: string; onClick?: () => void }) {
  const t = useTranslations("makePage")
  const { selectedRegion } = useRegion()
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-")

  // Investment grade from representative car
  const grade = model.representativeCar.investmentGrade

  const cardContent = (
    <>
      {/* TOP: CINEMATIC IMAGE */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
          {model.representativeImage ? (
            <Image
              src={model.representativeImage}
              alt={`${make} ${model.name}`}
              fill
              className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
              sizes="50vw"
              priority
              referrerPolicy="no-referrer"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-[#0F1012] flex items-center justify-center">
              <span className="text-[#6B7280] text-lg">{make} {getSeriesConfig(model.slug || model.name.toLowerCase(), make)?.label || model.name}</span>
            </div>
          )}

          {/* Vignette gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1012] via-transparent to-transparent pointer-events-none" />

          {/* Grade badge — top left */}
          <div className="absolute top-4 left-4">
            <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${grade === "AAA"
                ? "bg-emerald-500/30 text-emerald-300"
                : grade === "AA"
                  ? "bg-[rgba(248,180,217,0.3)] text-[#F8B4D9]"
                  : "bg-white/20 text-white"
              }`}>
              {grade}
            </span>
          </div>

          {/* Car count badge — top right */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {model.liveCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-[rgba(11,11,16,0.7)] backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t("hero.liveCount", { count: model.liveCount })}
              </span>
            )}
            <span className="rounded-full bg-[rgba(11,11,16,0.7)] backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-[#FFFCF7]">
              {model.carCount} {t("hero.listings")}
            </span>
          </div>
        </div>

        {/* BOTTOM: MODEL INFO */}
        <div className="flex-1 w-full bg-[#0F1012] p-6 flex flex-col justify-between">
          {/* Model name + subtitle */}
          <div>
            <h2 className="text-3xl font-bold text-[#FFFCF7] tracking-tight group-hover:text-[#F8B4D9] transition-colors">
              {make} {getSeriesConfig(model.slug || model.name.toLowerCase(), make)?.label || model.name}
            </h2>
            <p className="text-[13px] text-[#6B7280] mt-1">
              {model.years}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/5">
            {/* Price Range */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <DollarSign className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("model.priceRange")}</span>
              </div>
              <p className="text-[13px] font-mono text-[#FFFCF7]">
                {formatPriceForRegion(model.priceMin, selectedRegion)}&ndash;{formatPriceForRegion(model.priceMax, selectedRegion)}
              </p>
            </div>

            {/* Listed */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <Car className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("hero.listings")}</span>
              </div>
              <p className="text-[13px] text-[#FFFCF7]">{model.carCount} vehicles</p>
            </div>

            {/* Grade */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <Shield className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("sidebar.grade")}</span>
              </div>
              <p className={`text-[13px] font-semibold ${grade === "AAA" ? "text-emerald-400"
                  : grade === "AA" ? "text-blue-400"
                    : grade === "A" ? "text-amber-400"
                      : "text-[#6B7280]"
                }`}>{grade}</p>
            </div>
          </div>

          {/* Categories */}
          {model.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {model.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className="px-3 py-1 rounded-full bg-white/5 text-[10px] text-[#9CA3AF]"
                >
                  {cat}
                </span>
              ))}
              {model.categories.length > 3 && (
                <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] text-[#6B7280]">
                  +{model.categories.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] font-medium tracking-[0.1em] uppercase text-[#9CA3AF] group-hover:text-[#F8B4D9] transition-colors">
              {t("model.viewCollection")}
            </span>
            <ChevronRight className="size-5 text-[#9CA3AF] group-hover:text-[#F8B4D9] group-hover:translate-x-1 transition-all" />
          </div>
        </div>
    </>
  )

  const containerClass = "flex-1 flex flex-col rounded-[32px] overflow-hidden bg-[#0F1012] border border-white/5 group cursor-pointer hover:border-[rgba(248,180,217,0.2)] transition-all duration-300"

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      {onClick ? (
        <button onClick={onClick} className={containerClass}>
          {cardContent}
        </button>
      ) : (
        <Link href={`/cars/${makeSlug}/${model.representativeCar.id}`} className={containerClass}>
          {cardContent}
        </Link>
      )}
    </div>
  )
}

function aggregateRegionalPricing(modelCars: CollectorCar[]): FairValueByRegion | null {
  // Filter out cars with zero pricing (live auctions without final_price)
  const carsWithPricing = modelCars.filter(c => c.fairValueByRegion.US.high > 0)
  if (carsWithPricing.length === 0) {
    // Fallback: build from currentBid if available
    const carsWithBids = modelCars.filter(c => c.currentBid > 0)
    if (carsWithBids.length === 0) return null
    const minBid = Math.min(...carsWithBids.map(c => c.currentBid))
    const maxBid = Math.max(...carsWithBids.map(c => c.currentBid))
    return {
      US: { currency: "$", low: minBid, high: maxBid },
      EU: { currency: "€", low: Math.round(minBid * 0.92), high: Math.round(maxBid * 0.92) },
      UK: { currency: "£", low: Math.round(minBid * 0.79), high: Math.round(maxBid * 0.79) },
      JP: { currency: "¥", low: Math.round(minBid * 150), high: Math.round(maxBid * 150) },
    }
  }
  const regions: (keyof FairValueByRegion)[] = ["US", "EU", "UK", "JP"]
  const result = {} as FairValueByRegion
  for (const region of regions) {
    const lows = carsWithPricing.map(c => c.fairValueByRegion[region].low).filter(v => v > 0)
    const highs = carsWithPricing.map(c => c.fairValueByRegion[region].high).filter(v => v > 0)
    result[region] = {
      currency: carsWithPricing[0].fairValueByRegion[region].currency,
      low: lows.length > 0 ? Math.min(...lows) : 0,
      high: highs.length > 0 ? Math.max(...highs) : 0,
    }
  }
  return result
}

// Find the region with the lowest average USD price (= BEST value)
function findBestRegion(pricing: FairValueByRegion): keyof FairValueByRegion {
  const regions: (keyof FairValueByRegion)[] = ["US", "EU", "UK", "JP"]
  let best: keyof FairValueByRegion = "US"
  let bestAvg = Infinity
  for (const r of regions) {
    const avg = toUsd((pricing[r].low + pricing[r].high) / 2, pricing[r].currency)
    if (avg < bestAvg) {
      bestAvg = avg
      best = r
    }
  }
  return best
}

// ─── MODEL-SPECIFIC DATA HELPERS ───
function deriveModelDepth(modelCars: CollectorCar[]): { auctionsPerYear: number; avgDaysToSell: number; sellThroughRate: number; demandScore: number } {
  const total = modelCars.length
  const ended = modelCars.filter(c => c.status === "ENDED").length
  const avgBids = total > 0 ? modelCars.reduce((s, c) => s + c.bidCount, 0) / total : 0
  const avgTrend = total > 0 ? modelCars.reduce((s, c) => s + c.trendValue, 0) / total : 0
  return {
    auctionsPerYear: Math.max(total * 4, 10),
    avgDaysToSell: Math.max(5, Math.round(30 - avgBids * 0.5)),
    sellThroughRate: total > 0 ? Math.round((ended / total) * 100) : 75,
    demandScore: Math.min(10, Math.max(3, Math.round(avgTrend / 3 + avgBids / 10))),
  }
}

// ─── MODEL CONTEXT PANEL (Right column) ───
// ─── GENERATION CONTEXT PANEL (right panel for generation drill-down view) ───
function GenerationContextPanel({
  gen,
  familyName,
  make,
  familyCars,
  onOpenAdvisor,
}: {
  gen: GenerationAggregate
  familyName: string
  make: string
  familyCars: CollectorCar[]
  onOpenAdvisor: () => void
}) {
  const { selectedRegion } = useRegion()

  // Cars in this generation
  const genCars = useMemo(() => {
    return familyCars.filter(car => {
      const carGen = extractGenerationFromModel(car.model, car.year)
      return carGen === gen.id
    })
  }, [familyCars, gen.id])

  // Top variants within this generation
  const topVariants = useMemo(() => {
    const variantMap = new Map<string, { count: number; prices: number[]; grade: string }>()
    genCars.forEach(car => {
      const variant = car.model
      const existing = variantMap.get(variant) || { count: 0, prices: [], grade: "B" }
      existing.count++
      if (car.currentBid > 0) existing.prices.push(car.currentBid)
      const g = car.investmentGrade || "B"
      if (["AAA", "AA", "A"].indexOf(g) < ["AAA", "AA", "A"].indexOf(existing.grade)) {
        existing.grade = g
      }
      variantMap.set(variant, existing)
    })
    return Array.from(variantMap.entries())
      .filter(([, data]) => data.prices.length > 0)
      .map(([name, data]) => ({
        name,
        avgPrice: Math.round(data.prices.reduce((s, p) => s + p, 0) / data.prices.length),
        count: data.count,
        grade: data.grade,
      }))
      .sort((a, b) => b.avgPrice - a.avgPrice)
      .slice(0, 6)
  }, [genCars])

  const recentSales = useMemo(() => {
    return genCars
      .filter(c => c.status === "ENDED" && c.currentBid > 0)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
      .slice(0, 4)
  }, [genCars])

  const fallbackCosts = ownershipCosts[make] || ownershipCosts.default
  const genAvgPrice = genCars.length > 0
    ? genCars.reduce((s, c) => s + c.currentBid, 0) / genCars.length
    : 1
  const brandAvgPrice = familyCars.length > 0
    ? familyCars.reduce((s, c) => s + c.currentBid, 0) / familyCars.length
    : 1
  const genScaleFactor = brandAvgPrice > 0 ? genAvgPrice / brandAvgPrice : 1
  const genOwnershipCosts = {
    insurance: Math.round(fallbackCosts.insurance * genScaleFactor),
    storage: Math.round(fallbackCosts.storage * genScaleFactor),
    maintenance: Math.round(fallbackCosts.maintenance * genScaleFactor),
  }

  const gradeColor = (g: string) => {
    switch (g) {
      case "AAA": return "text-emerald-400"
      case "AA": return "text-blue-400"
      case "A": return "text-amber-400"
      default: return "text-[#6B7280]"
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {/* 1. GENERATION OVERVIEW */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Generation Analysis
            </span>
          </div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#F8B4D9] mb-1">
            {make} {familyName}
          </p>
          <h2 className="text-[18px] font-bold text-[#FFFCF7] leading-tight">
            {gen.label}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-[#6B7280]">
            <span>{gen.carCount} listings</span>
            <span>·</span>
            <span>{gen.yearMin === gen.yearMax ? gen.yearMin : `${gen.yearMin}–${gen.yearMax}`}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#9CA3AF] mt-2">
            {gen.representativeCar}
          </p>
        </div>

        {/* 2. KEY METRICS */}
        <div className="px-5 py-3 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">Grade</span>
              <p className={`text-[16px] font-bold ${gen.topGrade === "AAA" ? "text-emerald-400" : "text-[#F8B4D9]"}`}>
                {gen.topGrade}
              </p>
            </div>
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">Min Price</span>
              <p className="text-[13px] font-mono font-semibold text-[#FFFCF7]">
                {formatPriceForRegion(gen.priceMin, selectedRegion)}
              </p>
            </div>
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">Max Price</span>
              <p className="text-[13px] font-mono font-semibold text-[#F8B4D9]">
                {formatPriceForRegion(gen.priceMax, selectedRegion)}
              </p>
            </div>
          </div>
        </div>

        {/* 3. TOP VARIANTS */}
        {topVariants.length > 0 && (
          <div className="px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Car className="size-4 text-[#F8B4D9]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                Variants in {gen.label}
              </span>
            </div>
            <div className="space-y-2">
              {topVariants.map((variant) => (
                <div key={variant.name} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-medium text-[#FFFCF7] truncate block">{variant.name}</span>
                    <span className="text-[9px] text-[#6B7280]">{variant.count} listings</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono font-semibold text-[#F8B4D9]">
                      {formatPriceForRegion(variant.avgPrice, selectedRegion)}
                    </span>
                    <span className={`text-[9px] font-bold ${gradeColor(variant.grade)}`}>
                      {variant.grade}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. MARKET DEPTH */}
        <div className="px-5 py-4 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Market Depth
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#9CA3AF]">Active Listings</span>
              <span className="text-[12px] font-mono font-semibold text-[#FFFCF7]">{gen.carCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#9CA3AF]">Avg. Price</span>
              <span className="text-[12px] font-mono font-semibold text-[#F8B4D9]">
                {formatPriceForRegion(
                  gen.priceMin > 0 && gen.priceMax > 0
                    ? Math.round((gen.priceMin + gen.priceMax) / 2)
                    : 0,
                  selectedRegion
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#9CA3AF]">Sell-Through Rate</span>
              <span className="text-[12px] font-mono font-semibold text-emerald-400">{Math.min(85 + Math.floor(gen.carCount / 3), 98)}%</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[#9CA3AF]">Demand Score</span>
                <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">{Math.min(Math.max(Math.round(gen.carCount / 2), 4), 10)}/10</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-[6px] flex-1 rounded-sm ${i < Math.min(Math.max(Math.round(gen.carCount / 2), 4), 10) ? "bg-[#F8B4D9]/50" : "bg-white/[0.04]"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 5. RECENT SALES */}
        {recentSales.length > 0 && (
          <div className="px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="size-4 text-[#F8B4D9]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                Recent Sales
              </span>
            </div>
            <div className="space-y-2">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 py-1.5 border-b border-white/[0.03] last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#D1D5DB] truncate">{sale.title}</p>
                    <p className="text-[9px] text-[#6B7280] mt-0.5">
                      {sale.platform?.replace(/_/g, " ") || "Auction"} · {sale.region}
                    </p>
                  </div>
                  <span className="text-[12px] font-mono font-semibold text-[#FFFCF7] shrink-0">
                    {formatPriceForRegion(sale.currentBid, selectedRegion)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. OWNERSHIP COST */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Annual Ownership Cost
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: "Insurance", value: genOwnershipCosts.insurance },
              { label: "Storage", value: genOwnershipCosts.storage },
              { label: "Maintenance", value: genOwnershipCosts.maintenance },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[11px] text-[#9CA3AF]">{item.label}</span>
                <span className="text-[11px] font-mono text-[#D1D5DB]">{formatPriceForRegion(item.value, selectedRegion)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/5">
              <span className="text-[11px] font-medium text-[#FFFCF7]">Total</span>
              <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">{formatPriceForRegion(genOwnershipCosts.insurance + genOwnershipCosts.storage + genOwnershipCosts.maintenance, selectedRegion)}/yr</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="shrink-0 px-5 py-3 border-t border-white/5">
        <button
          onClick={onOpenAdvisor}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F8B4D9] py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-[#0b0b10] hover:bg-[#f4cbde] transition-all"
        >
          <MessageCircle className="size-4" />
          Speak with Advisor
        </button>
      </div>
    </div>
  )
}

// ─── CAR CONTEXT PANEL (right panel for individual car view) ───
function CarContextPanel({
  car,
  make,
  onOpenAdvisor,
}: {
  car: CollectorCar
  make: string
  onOpenAdvisor: () => void
}) {
  const tAuction = useTranslations("auctionDetail")
  const { selectedRegion } = useRegion()
  const grade = car.investmentGrade
  const isEndingSoon = car.status === "ENDING_SOON"

  const fallbackCosts = ownershipCosts[make] || ownershipCosts.default
  const priceRatio = car.currentBid > 0 ? Math.max(car.currentBid / 100000, 0.5) : 1
  const carOwnershipCosts = {
    insurance: Math.round(fallbackCosts.insurance * priceRatio),
    storage: fallbackCosts.storage,
    maintenance: Math.round(fallbackCosts.maintenance * priceRatio),
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {/* 1. CAR OVERVIEW */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Investment Analysis
            </span>
          </div>
          <h2 className="text-[14px] font-bold text-[#FFFCF7] leading-tight">
            {car.year} {make} {car.model}
          </h2>
          {car.thesis && (
            <p className="text-[11px] leading-relaxed text-[#9CA3AF] mt-2">
              {car.thesis}
            </p>
          )}
        </div>

        {/* 2. KEY METRICS */}
        <div className="px-5 py-3 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">Grade</span>
              <p className={`text-[16px] font-bold ${
                grade === "AAA" ? "text-emerald-400"
                  : grade === "AA" ? "text-blue-400"
                    : grade === "A" ? "text-amber-400"
                      : "text-[#6B7280]"
              }`}>{grade}</p>
            </div>
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">Current Bid</span>
              <p className="text-[13px] font-mono font-semibold text-[#F8B4D9]">
                {formatPriceForRegion(car.currentBid, selectedRegion)}
              </p>
            </div>
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">Status</span>
              <p className={`text-[13px] font-semibold ${
                isEndingSoon ? "text-orange-400" : car.status === "ACTIVE" ? "text-emerald-400" : "text-[#6B7280]"
              }`}>
                {isEndingSoon ? "Ending Soon" : car.status === "ACTIVE" ? "Live" : car.status}
              </p>
            </div>
          </div>
        </div>

        {/* 3. CAR DETAILS */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Car className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Specifications
            </span>
          </div>
          <div className="space-y-2">
            {car.mileage && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#9CA3AF]">Mileage</span>
                <span className="text-[12px] font-mono font-semibold text-[#FFFCF7]">{car.mileage.toLocaleString()} mi</span>
              </div>
            )}
            {car.transmission && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#9CA3AF]">Transmission</span>
                <span className="text-[12px] font-semibold text-[#FFFCF7]">{car.transmission}</span>
              </div>
            )}
            {car.exteriorColor && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#9CA3AF]">Exterior</span>
                <span className="text-[12px] font-semibold text-[#FFFCF7]">{car.exteriorColor}</span>
              </div>
            )}
            {car.interiorColor && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#9CA3AF]">Interior</span>
                <span className="text-[12px] font-semibold text-[#FFFCF7]">{car.interiorColor}</span>
              </div>
            )}
            {car.region && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#9CA3AF]">Region</span>
                <span className="text-[12px] font-semibold text-[#FFFCF7]">{car.region}</span>
              </div>
            )}
            {car.endTime && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#9CA3AF]">Time Left</span>
                <span className={`text-[12px] font-mono font-semibold ${isEndingSoon ? "text-orange-400" : "text-[#FFFCF7]"}`}>
                  {timeLeft(new Date(car.endTime), {
                    ended: tAuction("time.ended"),
                    day: tAuction("time.units.day"),
                    hour: tAuction("time.units.hour"),
                    minute: tAuction("time.units.minute"),
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 4. PLATFORM */}
        <div className="px-5 py-4 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Listing Source
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#9CA3AF]">Platform</span>
            <span className="text-[12px] font-semibold text-[#FFFCF7]">
              {car.platform?.replace(/_/g, " ") || "Auction"}
            </span>
          </div>
          {car.category && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-[#9CA3AF]">Category</span>
              <span className="text-[12px] font-semibold text-[#FFFCF7]">{car.category}</span>
            </div>
          )}
        </div>

        {/* 5. OWNERSHIP COST */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Annual Ownership Cost
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: "Insurance", value: carOwnershipCosts.insurance },
              { label: "Storage", value: carOwnershipCosts.storage },
              { label: "Maintenance", value: carOwnershipCosts.maintenance },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[11px] text-[#9CA3AF]">{item.label}</span>
                <span className="text-[11px] font-mono text-[#D1D5DB]">{formatPriceForRegion(item.value, selectedRegion)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/5">
              <span className="text-[11px] font-medium text-[#FFFCF7]">Total</span>
              <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">{formatPriceForRegion(carOwnershipCosts.insurance + carOwnershipCosts.storage + carOwnershipCosts.maintenance, selectedRegion)}/yr</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="shrink-0 px-5 py-3 border-t border-white/5 space-y-2">
        <Link
          href={`/cars/${make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F8B4D9] py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-[#0b0b10] hover:bg-[#f4cbde] transition-all"
        >
          <FileText className="size-4" />
          View Full Report
        </Link>
        <button
          onClick={onOpenAdvisor}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-[rgba(248,180,217,0.3)] py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-[#F8B4D9] hover:bg-[rgba(248,180,217,0.06)] transition-all"
        >
          <MessageCircle className="size-4" />
          Ask Advisor
        </button>
      </div>
    </div>
  )
}

function ModelContextPanel({
  model,
  make,
  cars,
  allCars,
  allModels,
  onOpenAdvisor,
  dbOwnershipCosts,
}: {
  model: Model
  make: string
  cars: CollectorCar[]
  allCars: CollectorCar[]
  allModels: Model[]
  onOpenAdvisor: () => void
  dbOwnershipCosts?: { insurance?: number; storage?: number; maintenance?: number } | null
}) {
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const locale = useLocale()
  const { selectedRegion, effectiveRegion } = useRegion()

  // All cars of this model family (unfiltered) for regional analysis
  const allModelCars = allCars.filter(c => extractFamily(c.model, c.year, make) === model.name)
  const regionalPricing = useMemo(() => aggregateRegionalPricing(allModelCars), [allModelCars])

  // Model-specific thesis (from the representative car's real data)
  const modelThesis = model.representativeCar.thesis

  // Model-specific ownership costs — prefer DB data, fallback to hardcoded
  const fallbackCosts = ownershipCosts[make] || ownershipCosts.default
  const baseCosts = {
    insurance: dbOwnershipCosts?.insurance ?? fallbackCosts.insurance,
    storage: dbOwnershipCosts?.storage ?? fallbackCosts.storage,
    maintenance: dbOwnershipCosts?.maintenance ?? fallbackCosts.maintenance,
  }
  const brandAvgPrice = allCars.length > 0 ? allCars.reduce((s, c) => s + c.currentBid, 0) / allCars.length : 1
  const scaleFactor = brandAvgPrice > 0 ? model.avgPrice / brandAvgPrice : 1
  const costs = {
    insurance: Math.round(baseCosts.insurance * scaleFactor),
    storage: Math.round(baseCosts.storage * scaleFactor),
    maintenance: Math.round(baseCosts.maintenance * scaleFactor),
  }
  const totalAnnualCost = costs.insurance + costs.storage + costs.maintenance

  // Determine best-value region
  const bestRegion = regionalPricing ? findBestRegion(regionalPricing) : null

  // Market depth data
  // Model-specific liquidity (derived from real car data)
  const depth = deriveModelDepth(allModelCars)

  // Similar models (same brand, different model)
  const similarModels = allModels
    .filter(m => m.slug !== model.slug)
    .slice(0, 3)

  // Recent sales (use actual car data from this model)
  const recentSales = allModelCars
    .filter(c => c.status === "ENDED")
    .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
    .slice(0, 4)

  // Grade color helper
  const gradeColor = (g: string) => {
    switch (g) {
      case "AAA": return "text-emerald-400"
      case "AA": return "text-blue-400"
      case "A": return "text-amber-400"
      default: return "text-[#6B7280]"
    }
  }

  // Regional price bar max value for relative widths
  const maxRegionalUsd = regionalPricing
    ? Math.max(...(["US", "EU", "UK", "JP"] as const).map(r =>
      toUsd((regionalPricing[r].low + regionalPricing[r].high) / 2, regionalPricing[r].currency)
    ))
    : 1

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">

        {/* 1. MODEL OVERVIEW */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Investment Analysis
            </span>
          </div>
          <h2 className="text-[14px] font-bold text-[#FFFCF7] leading-tight">
            {make} {model.representativeCar.model}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-[#6B7280]">
            <span>{model.carCount} cars</span>
            <span>·</span>
            <span>{model.years}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#9CA3AF] mt-2">
            {modelThesis}
          </p>
        </div>

        {/* 2. PRICE SUMMARY */}
        <div className="px-5 py-3 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">{t("sidebar.grade")}</span>
              <p className={`text-[16px] font-bold ${model.representativeCar.investmentGrade === "AAA" ? "text-emerald-400" : "text-[#F8B4D9]"
                }`}>{model.representativeCar.investmentGrade}</p>
            </div>
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">Min Price</span>
              <p className="text-[13px] font-mono font-semibold text-[#FFFCF7]">{formatPriceForRegion(model.priceMin, selectedRegion)}</p>
            </div>
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">Max Price</span>
              <p className="text-[13px] font-mono font-semibold text-[#FFFCF7]">{formatPriceForRegion(model.priceMax, selectedRegion)}</p>
            </div>
          </div>
        </div>

        {/* 3. VALUATION BY MARKET — with visual bars */}
        {regionalPricing && (
          <div className="px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="size-4 text-[#F8B4D9]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                Valuation by Market
              </span>
            </div>
            <div className="space-y-2.5">
              {(["US", "UK", "EU", "JP"] as const).map(region => {
                const pricing = regionalPricing[region]
                const isBest = bestRegion === region
                const isSelected = region === effectiveRegion
                const usdAvg = toUsd((pricing.low + pricing.high) / 2, pricing.currency)
                const barWidth = (usdAvg / maxRegionalUsd) * 100
                return (
                  <div key={region} className={isSelected ? "rounded-lg bg-[rgba(248,180,217,0.04)] -mx-2 px-2 py-1.5" : ""}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px]">{regionLabels[region].flag}</span>
                        <span className={`text-[11px] font-medium ${isSelected ? "text-[#F8B4D9]" : "text-[#D1D5DB]"}`}>{region}</span>
                        {isBest && (
                          <span className="text-[8px] font-bold text-emerald-400 tracking-wide">BEST</span>
                        )}
                        {isSelected && (
                          <span className="text-[8px] font-bold text-[#F8B4D9] tracking-wide">YOUR MARKET</span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[11px] font-mono font-semibold text-[#FFFCF7]">
                          {fmtRegional(pricing.low, pricing.currency)}
                        </span>
                        <span className="text-[9px] text-[#6B7280]">→</span>
                        <span className={`text-[11px] font-mono font-semibold ${isBest ? "text-emerald-400" : "text-[#F8B4D9]"}`}>
                          {fmtRegional(pricing.high, pricing.currency)}
                        </span>
                      </div>
                    </div>
                    {region !== effectiveRegion && (
                      <div className="flex justify-end mb-1">
                        <span className="text-[9px] font-mono text-[#6B7280]">
                          ≈ {formatUsd(toUsd(pricing.high, pricing.currency))} USD
                        </span>
                      </div>
                    )}
                    <div className="h-[6px] rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isBest ? "bg-gradient-to-r from-emerald-400/30 to-emerald-400/60" : isSelected ? "bg-gradient-to-r from-[#F8B4D9]/40 to-[#F8B4D9]/70" : "bg-gradient-to-r from-[#F8B4D9]/25 to-[#F8B4D9]/50"}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 4. RECENT SALES */}
        {recentSales.length > 0 && (
          <div className="px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="size-4 text-[#F8B4D9]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                Recent Sales
              </span>
            </div>
            <div className="space-y-2">
              {recentSales.map((sale) => {
                const platform = platformLabels[sale.platform]
                return (
                  <div key={sale.id} className="flex items-center gap-3 py-1.5 border-b border-white/[0.03] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[#D1D5DB] truncate">{sale.title}</p>
                      <p className="text-[9px] text-[#6B7280] mt-0.5">
                        {platform?.short || sale.platform} · {regionLabels[sale.region]?.flag} {sale.region}
                      </p>
                    </div>
                    <span className="text-[12px] font-mono font-semibold text-[#FFFCF7] shrink-0">
                      {formatPriceForRegion(sale.currentBid, selectedRegion)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 5. LIQUIDITY & MARKET DEPTH */}
        <div className="px-5 py-4 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Liquidity & Market Depth
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#9CA3AF]">Auctions / Year</span>
              <span className="text-[12px] font-mono font-semibold text-[#FFFCF7]">{depth.auctionsPerYear}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#9CA3AF]">Avg Days to Sell</span>
              <span className="text-[12px] font-mono font-semibold text-[#FFFCF7]">{depth.avgDaysToSell}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#9CA3AF]">Sell-Through Rate</span>
              <span className="text-[12px] font-mono font-semibold text-emerald-400">{depth.sellThroughRate}%</span>
            </div>
            {/* Demand score visual */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[#9CA3AF]">Demand Score</span>
                <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">{depth.demandScore}/10</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-[6px] flex-1 rounded-sm ${i < depth.demandScore ? "bg-[#F8B4D9]/50" : "bg-white/[0.04]"
                      }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 6. ANNUAL OWNERSHIP COST */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Annual Ownership Cost
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: "Insurance", value: costs.insurance },
              { label: "Storage", value: costs.storage },
              { label: "Maintenance", value: costs.maintenance },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[11px] text-[#9CA3AF]">{item.label}</span>
                <span className="text-[11px] font-mono text-[#D1D5DB]">{formatPriceForRegion(item.value, selectedRegion)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/5">
              <span className="text-[11px] font-medium text-[#FFFCF7]">Total</span>
              <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">{formatPriceForRegion(totalAnnualCost, selectedRegion)}/yr</span>
            </div>
          </div>
        </div>

        {/* 7. SIMILAR MODELS */}
        {similarModels.length > 0 && (
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="size-4 text-[#F8B4D9]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                Other {make} Models
              </span>
            </div>
            <div className="space-y-1.5">
              {similarModels.map((m) => (
                <div
                  key={m.slug}
                  className="flex items-center justify-between py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors px-1 -mx-1"
                >
                  <span className="text-[11px] font-medium text-[#FFFCF7]">
                    {m.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#6B7280]">
                      {formatPriceForRegion(m.priceMin, selectedRegion)}–{formatPriceForRegion(m.priceMax, selectedRegion)}
                    </span>
                    <span className={`text-[9px] font-bold ${gradeColor(m.representativeCar.investmentGrade)}`}>
                      {m.representativeCar.investmentGrade}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Report CTA */}
      <div className="shrink-0 px-4 pt-3">
        <Link
          href={`/cars/${make.toLowerCase().replace(/\s+/g, "-")}/${model.representativeCar.id}/report`}
          className="block rounded-xl border border-[rgba(248,180,217,0.2)] bg-[rgba(248,180,217,0.06)] p-4 hover:bg-[rgba(248,180,217,0.1)] transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-[rgba(248,180,217,0.15)] flex items-center justify-center shrink-0">
              <FileText className="size-5 text-[#F8B4D9]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#FFFCF7]">Full Investment Report</p>
              <p className="text-[10px] text-[#6B7280] mt-0.5">Valuation, risks, comps &amp; costs</p>
            </div>
            <ChevronRight className="size-4 text-[#F8B4D9] group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>

      {/* CTA — pinned bottom */}
      <div className="shrink-0 px-5 py-3 border-t border-white/5">
        <button
          onClick={onOpenAdvisor}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F8B4D9] py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-[#0b0b10] hover:bg-[#f4cbde] transition-all"
        >
          <MessageCircle className="size-4" />
          {t("sidebar.speakWithAdvisor")}
        </button>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───
export function MakePageClient({ make, cars, liveRegionTotals, liveNowCount, dbMarketData = [], dbComparables = [], dbSoldHistory = [], dbAnalyses = [], initialFamily, initialGen }: {
  make: string
  cars: CollectorCar[]
  liveRegionTotals?: LiveListingRegionTotals
  liveNowCount?: number
  dbMarketData?: DbMarketDataRow[]
  dbComparables?: DbComparableRow[]
  dbSoldHistory?: DbSoldRecord[]
  dbAnalyses?: DbAnalysisRow[]
  initialFamily?: string
  initialGen?: string
}) {
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const tStatus = useTranslations("status")

  // ─── USE REAL DB DATA (with fallback to hardcoded) ───

  // Market depth: derive from real DB data if available
  const realMarketDepth = useMemo(() => {
    if (dbMarketData.length === 0 && dbSoldHistory.length === 0) return null
    const totalSales = dbMarketData.reduce((s, m) => s + m.totalSales, 0) || dbSoldHistory.length
    const trendingUp = dbMarketData.filter(m => m.trend === "APPRECIATING").length
    const demandScore = dbMarketData.length > 0
      ? Math.min(10, Math.round((trendingUp / dbMarketData.length) * 10) + 5)
      : 7
    return {
      auctionsPerYear: totalSales,
      avgDaysToSell: 14,
      sellThroughRate: Math.min(98, 70 + demandScore * 3),
      demandScore,
    }
  }, [dbMarketData, dbSoldHistory])

  // 5-year price history: derive from real sold auctions if available
  const realPriceHistory = useMemo(() => {
    if (dbSoldHistory.length < 3) return null
    const now = new Date()
    const years = [0, 1, 2, 3, 4].map(i => now.getFullYear() - 4 + i)
    const buckets = years.map(yr => {
      const yearSales = dbSoldHistory.filter(s => {
        const d = new Date(s.date)
        return d.getFullYear() === yr
      })
      if (yearSales.length === 0) return null
      return Math.round(yearSales.reduce((sum, s) => sum + s.price, 0) / yearSales.length)
    })
    // Fill gaps with interpolation
    const filled = [...buckets]
    for (let i = 0; i < filled.length; i++) {
      if (filled[i] == null) {
        const prev = filled.slice(0, i).reverse().find(v => v != null)
        const next = filled.slice(i + 1).find(v => v != null)
        filled[i] = prev ?? next ?? 0
      }
    }
    if (filled.every(v => v === 0)) return null
    return filled as number[]
  }, [dbSoldHistory])

  // Ownership costs from DB analysis (average across analyses)
  const realOwnershipCosts = useMemo(() => {
    const withCosts = dbAnalyses.filter(a => a.insuranceEstimate || a.yearlyMaintenance)
    if (withCosts.length === 0) return null
    const avgIns = Math.round(withCosts.reduce((s, a) => s + (a.insuranceEstimate ?? 0), 0) / withCosts.length)
    const avgMaint = Math.round(withCosts.reduce((s, a) => s + (a.yearlyMaintenance ?? 0), 0) / withCosts.length)
    return { insurance: avgIns || undefined, storage: undefined, maintenance: avgMaint || undefined }
  }, [dbAnalyses])

  const [currentModelIndex, setCurrentModelIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const { selectedRegion, setSelectedRegion, effectiveRegion } = useRegion()
  const [selectedPriceRange, setSelectedPriceRange] = useState(0)
  const [selectedPriceTier, setSelectedPriceTier] = useState("all")
  const [selectedEra, setSelectedEra] = useState("All")
  const [selectedStatus, setSelectedStatus] = useState("All")
  const [sortBy, setSortBy] = useState("price-desc")
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showAdvisorChat, setShowAdvisorChat] = useState(false)
  const [expandedModel, setExpandedModel] = useState<Model | null>(null)
  const [activeFilters, setActiveFilters] = useState<FamilyFilters | null>(null)
  const [viewMode, setViewMode] = useState<'families' | 'generations' | 'cars'>(initialFamily ? 'cars' : 'families')
  const [selectedFamilyForFeed, setSelectedFamilyForFeed] = useState<string | null>(initialFamily || null)
  const [selectedGeneration, setSelectedGeneration] = useState<string | null>(initialGen || null)
  const [selectedVariantChip, setSelectedVariantChip] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  // Filter cars by region first, then aggregate into models
  const regionFilteredCars = useMemo(() => {
    if (!selectedRegion || selectedRegion === "all") return cars
    return cars.filter(c => c.region === selectedRegion)
  }, [cars, selectedRegion])

  // Live auction cars (for left sidebar) — filtered by region + active family
  const liveCars = useMemo(() => {
    let filtered = regionFilteredCars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON")
    if (selectedFamilyForFeed) {
      filtered = filtered.filter(c => extractFamily(c.model, c.year, make) === selectedFamilyForFeed)
    }
    return filtered.sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
  }, [regionFilteredCars, selectedFamilyForFeed])

  // Aggregate filtered cars into models
  const allModels = useMemo(() => aggregateModels(regionFilteredCars, make), [regionFilteredCars, make])

  // Filter and sort models
  const filteredModels = useMemo(() => {
    let result = [...allModels]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(model =>
        model.name.toLowerCase().includes(q) ||
        model.years.includes(q) ||
        model.categories.some(c => c.toLowerCase().includes(q))
      )
    }

    // Price range filter (used on mobile)
    const priceRange = priceRanges[selectedPriceRange]
    if (priceRange.min > 0 || priceRange.max < Infinity) {
      result = result.filter(model =>
        model.priceMax >= priceRange.min && model.priceMin < priceRange.max
      )
    }

    if (selectedStatus === "Live") {
      result = result.filter(model => model.liveCount > 0)
    } else if (selectedStatus === "Ended") {
      result = result.filter(model => model.liveCount === 0)
    }

    switch (sortBy) {
      case "price-desc": result.sort((a, b) => b.priceMax - a.priceMax); break
      case "price-asc": result.sort((a, b) => a.priceMin - b.priceMin); break
      case "year-desc": result.sort((a, b) => parseInt(b.years.split("–")[0]) - parseInt(a.years.split("–")[0])); break
      case "year-asc": result.sort((a, b) => parseInt(a.years.split("–")[0]) - parseInt(b.years.split("–")[0])); break
      case "count-desc": result.sort((a, b) => b.carCount - a.carCount); break
    }

    return result
  }, [allModels, searchQuery, selectedPriceTier, selectedPriceRange, selectedStatus, sortBy, selectedEra, regionFilteredCars])

  // When a family is selected via navigation, use that family's model; otherwise use scroll index
  const selectedModel = useMemo(() => {
    if (selectedFamilyForFeed) {
      const match = filteredModels.find(m => m.name === selectedFamilyForFeed)
      if (match) return match
    }
    return filteredModels[currentModelIndex] || filteredModels[0]
  }, [filteredModels, currentModelIndex, selectedFamilyForFeed])

  // Get cars for the selected family
  const familyCars = useMemo(() => {
    if (!selectedModel) return []
    return regionFilteredCars.filter(car => extractFamily(car.model, car.year, make) === selectedModel.name)
  }, [regionFilteredCars, selectedModel, make])

  // Apply COLUMNA C filters (search + generations + advanced) to family cars
  const displayCars = useMemo(() => {
    if (!activeFilters) return familyCars

    let result = familyCars

    // Filter by search query
    if (activeFilters.searchQuery.trim()) {
      const q = activeFilters.searchQuery.toLowerCase()
      result = result.filter(car =>
        car.model.toLowerCase().includes(q)
      )
    }

    // Filter by selected generations
    if (activeFilters.selectedGenerations.length > 0) {
      result = result.filter(car => {
        const gen = extractGenerationFromModel(car.model, car.year)
        return gen && activeFilters.selectedGenerations.includes(gen)
      })
    }

    // Advanced filters
    if (activeFilters.priceRange) {
      const [min, max] = activeFilters.priceRange
      result = result.filter(car => car.currentBid >= min && car.currentBid <= max)
    }

    if (activeFilters.yearRange) {
      const [min, max] = activeFilters.yearRange
      result = result.filter(car => car.year >= min && car.year <= max)
    }

    if (activeFilters.mileageRanges && activeFilters.mileageRanges.length > 0) {
      result = result.filter(car => {
        if (!car.mileage) return false
        const mileage = car.mileage
        return activeFilters.mileageRanges!.some(range => {
          if (range === "0-10k") return mileage < 10000
          if (range === "10k-50k") return mileage >= 10000 && mileage < 50000
          if (range === "50k-100k") return mileage >= 50000 && mileage < 100000
          if (range === "100k+") return mileage >= 100000
          return false
        })
      })
    }

    if (activeFilters.transmissions && activeFilters.transmissions.length > 0) {
      result = result.filter(car => {
        if (!car.transmission) return false
        return activeFilters.transmissions!.some(t =>
          car.transmission?.toLowerCase().includes(t.toLowerCase())
        )
      })
    }

    if (activeFilters.bodyTypes && activeFilters.bodyTypes.length > 0) {
      result = result.filter(car => {
        const bt = deriveBodyType(car.model, car.trim, car.category, car.make, car.year)
        return activeFilters.bodyTypes!.includes(bt)
      })
    }

    if (activeFilters.colors && activeFilters.colors.length > 0) {
      result = result.filter(car => {
        if (!car.exteriorColor) return false
        return activeFilters.colors!.some(c =>
          car.exteriorColor?.toLowerCase().includes(c.toLowerCase())
        )
      })
    }

    if (activeFilters.statuses && activeFilters.statuses.length > 0) {
      result = result.filter(car =>
        activeFilters.statuses!.includes(car.status)
      )
    }

    if (activeFilters.grades && activeFilters.grades.length > 0) {
      result = result.filter(car =>
        activeFilters.grades!.includes(car.investmentGrade)
      )
    }

    return result
  }, [familyCars, activeFilters])

  // Check if filters are active
  const hasActiveFilters = activeFilters && (
    activeFilters.searchQuery.trim().length > 0 ||
    activeFilters.selectedGenerations.length > 0
  )

  // Handler: Click en familia → Mostrar generaciones
  const handleFamilyClick = (familyName: string) => {
    setSelectedFamilyForFeed(familyName)
    setSelectedGeneration(null)
    setSelectedVariantChip(null)
    setViewMode('generations')
    setActiveFilters(null)
    setActiveGenIndex(0)
    setActiveCarIndex(0)
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Handler: Click en generación → Mostrar carros de esa generación
  const handleGenerationClick = (genId: string) => {
    setSelectedGeneration(genId)
    setSelectedVariantChip(null)
    setViewMode('cars')
    setActiveFilters(null)
    setActiveCarIndex(0)
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Handler: Volver a generaciones desde carros (o al landing si venimos del dashboard)
  const handleBackToGenerations = () => {
    if (initialFamily) {
      // Came from dashboard with ?family= — go back to landing
      router.push("/")
      return
    }
    setSelectedGeneration(null)
    setSelectedVariantChip(null)
    setViewMode('generations')
    setActiveFilters(null)
    setActiveGenIndex(0)
    setActiveCarIndex(0)
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Handler: Volver a vista de familias (o al landing si venimos de allá)
  const handleBackToFamilies = () => {
    if (initialFamily) {
      // User arrived from the landing page with ?family= — go back to landing
      router.push("/")
      return
    }
    setViewMode('families')
    setSelectedFamilyForFeed(null)
    setSelectedGeneration(null)
    setActiveFilters(null)
    setActiveGenIndex(0)
    setActiveCarIndex(0)
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Get cars for the selected family
  const familyCarsForFeed = useMemo(() => {
    if (!selectedFamilyForFeed) return []
    let result = regionFilteredCars.filter(car => extractFamily(car.model, car.year, make) === selectedFamilyForFeed)
    // If a generation is selected, filter further
    if (selectedGeneration) {
      result = result.filter(car => {
        const gen = extractGenerationFromModel(car.model, car.year)
        return gen === selectedGeneration
      })
    }
    return result
  }, [regionFilteredCars, selectedFamilyForFeed, selectedGeneration])

  // Aggregate cars into generations for the selected family
  const familyGenerations = useMemo((): GenerationAggregate[] => {
    if (!selectedFamilyForFeed) return []
    const allFamilyCars = regionFilteredCars.filter(car => extractFamily(car.model, car.year, make) === selectedFamilyForFeed)

    // Get generation definitions for this family from FamilySearchAndFilters data
    const GENERATIONS_BY_FAMILY: Record<string, Array<{ id: string; label: string }>> = {
      "911": [
        { id: "992", label: "992 (2019+)" },
        { id: "991", label: "991 (2011-2019)" },
        { id: "997", label: "997 (2004-2012)" },
        { id: "996", label: "996 (1997-2005)" },
        { id: "993", label: "993 (1993-1998)" },
        { id: "964", label: "964 (1989-1994)" },
        { id: "930", label: "930 Turbo (1975-1989)" },
        { id: "g-model", label: "G-Model / SC / 3.2 (1974-1989)" },
        { id: "f-model", label: "F-Model (1963-1973)" },
      ],
      "Cayenne": [
        { id: "e3", label: "E3 (2019-2024)" },
        { id: "e2", label: "E2 (2011-2018)" },
        { id: "e1", label: "E1 (2003-2010)" },
      ],
      "Taycan": [
        { id: "j1", label: "J1 (2020+)" },
      ],
      "Macan": [
        { id: "95b-2", label: "95B.2 (2024+)" },
        { id: "95b", label: "95B (2019-2024)" },
        { id: "95b-1", label: "95B.1 (2014-2018)" },
      ],
      "Panamera": [
        { id: "g3", label: "G3 (2024+)" },
        { id: "g2", label: "G2 (2017-2024)" },
        { id: "g1", label: "G1 (2010-2016)" },
      ],
      "Boxster": [
        { id: "718", label: "718 (2016+)" },
        { id: "981", label: "981 (2012-2016)" },
        { id: "987", label: "987 (2005-2012)" },
      ],
      "Cayman": [
        { id: "718", label: "718 (2016+)" },
        { id: "981", label: "981 (2012-2016)" },
        { id: "987", label: "987 (2005-2012)" },
      ],
      "356": [
        { id: "356c", label: "356C (1963-1965)" },
        { id: "356b", label: "356B (1959-1963)" },
        { id: "356a", label: "356A (1955-1959)" },
        { id: "356-pre-a", label: "Pre-A (1948-1955)" },
      ],
      "928": [
        { id: "928-gts", label: "GTS (1992-1995)" },
        { id: "928-gt", label: "GT (1989-1991)" },
        { id: "928-s4", label: "S4 (1987-1991)" },
        { id: "928-s2", label: "S/S2 (1980-1986)" },
        { id: "928-base", label: "Base (1978-1982)" },
      ],
      "944": [
        { id: "944-s2", label: "S2 (1989-1991)" },
        { id: "944-turbo", label: "Turbo (1985-1991)" },
        { id: "944-s", label: "S (1987-1988)" },
        { id: "944-base", label: "Base (1982-1988)" },
      ],
      "968": [
        { id: "968-cs", label: "Club Sport (1993-1995)" },
        { id: "968-turbo-s", label: "Turbo S (1993-1994)" },
        { id: "968-base", label: "Base (1992-1995)" },
      ],
      "914": [
        { id: "914-2.0", label: "2.0L (1973-1976)" },
        { id: "914-1.8", label: "1.8L (1970-1972)" },
        { id: "914-1.7", label: "1.7L (1969-1973)" },
      ],
      "924": [
        { id: "924-carrera-gt", label: "Carrera GT (1980-1981)" },
        { id: "924-s", label: "S (1986-1988)" },
        { id: "924-turbo", label: "Turbo (1979-1984)" },
        { id: "924-base", label: "Base (1976-1988)" },
      ],
      "Carrera GT": [
        { id: "980", label: "980 (2004-2007)" },
      ],
      "918 Spyder": [
        { id: "918", label: "918 (2013-2015)" },
      ],
      "718": [
        { id: "718-rsk", label: "RSK (1957-1958)" },
        { id: "718-w-rs", label: "W-RS (1961-1962)" },
        { id: "718-classic", label: "718/2 (1959-1960)" },
      ],
    }

    const genDefs = GENERATIONS_BY_FAMILY[selectedFamilyForFeed] || []

    // Group cars by generation
    const genMap = new Map<string, CollectorCar[]>()
    const unmatched: CollectorCar[] = []

    allFamilyCars.forEach(car => {
      const gen = extractGenerationFromModel(car.model, car.year)
      if (gen) {
        const existing = genMap.get(gen) || []
        existing.push(car)
        genMap.set(gen, existing)
      } else {
        unmatched.push(car)
      }
    })

    // Build generation aggregates (use genDefs order for known gens)
    const result: GenerationAggregate[] = []

    for (const def of genDefs) {
      const cars = genMap.get(def.id) || []
      if (cars.length === 0) continue

      const prices = cars.map(c => c.currentBid).filter(p => p > 0)
      const years = cars.map(c => c.year)
      const repCar = cars.sort((a, b) => b.currentBid - a.currentBid)[0]
      const carImage = repCar.images?.[0] || repCar.image
      const grades = cars.map(c => c.investmentGrade).filter(Boolean)
      const topGrade = grades.includes("AAA") ? "AAA" : grades.includes("AA") ? "AA" : grades.includes("A") ? "A" : "B"

      result.push({
        id: def.id,
        label: def.label,
        carCount: cars.length,
        priceMin: prices.length > 0 ? Math.min(...prices) : 0,
        priceMax: prices.length > 0 ? Math.max(...prices) : 0,
        yearMin: Math.min(...years),
        yearMax: Math.max(...years),
        representativeImage: carImage || "",
        representativeCar: `${repCar.year} ${repCar.model}`,
        topGrade,
      })
    }

    // Add any generations from data not in genDefs (e.g., unknown codes)
    genMap.forEach((cars, genId) => {
      if (result.find(r => r.id === genId)) return
      const prices = cars.map(c => c.currentBid).filter(p => p > 0)
      const years = cars.map(c => c.year)
      const repCar = cars.sort((a, b) => b.currentBid - a.currentBid)[0]
      const carImage = repCar.images?.[0] || repCar.image
      const grades = cars.map(c => c.investmentGrade).filter(Boolean)
      const topGrade = grades.includes("AAA") ? "AAA" : grades.includes("AA") ? "AA" : grades.includes("A") ? "A" : "B"

      result.push({
        id: genId,
        label: genId.toUpperCase(),
        carCount: cars.length,
        priceMin: prices.length > 0 ? Math.min(...prices) : 0,
        priceMax: prices.length > 0 ? Math.max(...prices) : 0,
        yearMin: Math.min(...years),
        yearMax: Math.max(...years),
        representativeImage: carImage || "",
        representativeCar: `${repCar.year} ${repCar.model}`,
        topGrade,
      })
    })

    // If there are unmatched cars, add an "Other" bucket
    if (unmatched.length > 0) {
      const prices = unmatched.map(c => c.currentBid).filter(p => p > 0)
      const years = unmatched.map(c => c.year)
      const repCar = unmatched.sort((a, b) => b.currentBid - a.currentBid)[0]
      const carImage = repCar.images?.[0] || repCar.image
      result.push({
        id: "other",
        label: "Other",
        carCount: unmatched.length,
        priceMin: prices.length > 0 ? Math.min(...prices) : 0,
        priceMax: prices.length > 0 ? Math.max(...prices) : 0,
        yearMin: Math.min(...years),
        yearMax: Math.max(...years),
        representativeImage: carImage || "",
        representativeCar: `${repCar.year} ${repCar.model}`,
        topGrade: "B",
      })
    }

    return result
  }, [regionFilteredCars, selectedFamilyForFeed])

  // Apply filters to feed cars (when in cars mode)
  const filteredFeedCars = useMemo(() => {
    if (!activeFilters) return familyCarsForFeed

    let result = familyCarsForFeed

    // Search query filter
    if (activeFilters.searchQuery.trim()) {
      const q = activeFilters.searchQuery.toLowerCase()
      result = result.filter(car => car.model.toLowerCase().includes(q))
    }

    // Generations filter
    if (activeFilters.selectedGenerations.length > 0) {
      result = result.filter(car => {
        const gen = extractGenerationFromModel(car.model, car.year)
        return gen && activeFilters.selectedGenerations.includes(gen)
      })
    }

    // Price range filter
    if (activeFilters.priceRange) {
      const [min, max] = activeFilters.priceRange
      result = result.filter(car => car.currentBid >= min && car.currentBid <= max)
    }

    // Year range filter
    if (activeFilters.yearRange) {
      const [min, max] = activeFilters.yearRange
      result = result.filter(car => car.year >= min && car.year <= max)
    }

    // Mileage filter
    if (activeFilters.mileageRanges && activeFilters.mileageRanges.length > 0) {
      result = result.filter(car => {
        if (!car.mileage) return false
        const mileage = car.mileage
        return activeFilters.mileageRanges!.some(range => {
          if (range === "0-10k") return mileage < 10000
          if (range === "10k-50k") return mileage >= 10000 && mileage < 50000
          if (range === "50k-100k") return mileage >= 50000 && mileage < 100000
          if (range === "100k+") return mileage >= 100000
          return false
        })
      })
    }

    // Transmission filter
    if (activeFilters.transmissions && activeFilters.transmissions.length > 0) {
      result = result.filter(car => {
        if (!car.transmission) return false
        return activeFilters.transmissions!.some(t =>
          car.transmission?.toLowerCase().includes(t.toLowerCase())
        )
      })
    }

    // Body type filter
    if (activeFilters.bodyTypes && activeFilters.bodyTypes.length > 0) {
      result = result.filter(car => {
        const bt = deriveBodyType(car.model, car.trim, car.category, car.make, car.year)
        return activeFilters.bodyTypes!.includes(bt)
      })
    }

    // Color filter
    if (activeFilters.colors && activeFilters.colors.length > 0) {
      result = result.filter(car => {
        if (!car.exteriorColor) return false
        return activeFilters.colors!.some(c =>
          car.exteriorColor?.toLowerCase().includes(c.toLowerCase())
        )
      })
    }

    // Status filter
    if (activeFilters.statuses && activeFilters.statuses.length > 0) {
      result = result.filter(car =>
        activeFilters.statuses!.includes(car.status)
      )
    }

    // Grade filter
    if (activeFilters.grades && activeFilters.grades.length > 0) {
      result = result.filter(car =>
        activeFilters.grades!.includes(car.investmentGrade)
      )
    }

    return result
  }, [familyCarsForFeed, activeFilters])

  // Variant chips — compute available variants with counts from filteredFeedCars
  const availableVariants = useMemo(() => {
    if (!selectedGeneration && !selectedFamilyForFeed) return []
    const seriesId = selectedGeneration || selectedFamilyForFeed || ""
    const variants = getSeriesVariants(seriesId.toLowerCase(), make)
    if (variants.length === 0) return []
    const counts = new Map<string, number>()
    for (const car of filteredFeedCars) {
      const vid = matchVariant(car.model, car.trim, seriesId.toLowerCase(), make)
      if (vid) counts.set(vid, (counts.get(vid) || 0) + 1)
    }
    return variants
      .map(v => ({ id: v.id, label: v.label, count: counts.get(v.id) || 0 }))
      .filter(v => v.count > 0)
  }, [filteredFeedCars, selectedGeneration, selectedFamilyForFeed, make])

  // Apply variant chip filter + sorting on top of filteredFeedCars
  const variantFilteredFeedCars = useMemo(() => {
    let result = filteredFeedCars
    if (selectedVariantChip) {
      const seriesId = selectedGeneration || selectedFamilyForFeed || ""
      result = result.filter(car => {
        const vid = matchVariant(car.model, car.trim, seriesId.toLowerCase(), make)
        return vid === selectedVariantChip
      })
    }
    // Apply sorting
    const sorted = [...result]
    switch (sortBy) {
      case "price-desc": sorted.sort((a, b) => b.price - a.price); break
      case "price-asc": sorted.sort((a, b) => a.price - b.price); break
      case "year-desc": sorted.sort((a, b) => b.year - a.year); break
      case "year-asc": sorted.sort((a, b) => a.year - b.year); break
    }
    return sorted
  }, [filteredFeedCars, selectedVariantChip, selectedGeneration, selectedFamilyForFeed, make, sortBy])

  // Scroll sync for center feed — tracks position in whichever list is showing
  const getCardHeight = () => typeof window !== "undefined" ? window.innerHeight - 80 : 800
  const [activeGenIndex, setActiveGenIndex] = useState(0)
  const [activeCarIndex, setActiveCarIndex] = useState(0)

  useEffect(() => {
    const container = feedRef.current
    if (!container) return
    const handleScroll = () => {
      const newIndex = Math.round(container.scrollTop / getCardHeight())
      if (viewMode === 'families') {
        if (newIndex !== currentModelIndex && newIndex >= 0 && newIndex < filteredModels.length) {
          setCurrentModelIndex(newIndex)
        }
      } else if (viewMode === 'generations') {
        if (newIndex !== activeGenIndex && newIndex >= 0 && newIndex < familyGenerations.length) {
          setActiveGenIndex(newIndex)
        }
      } else if (viewMode === 'cars') {
        if (newIndex !== activeCarIndex && newIndex >= 0 && newIndex < variantFilteredFeedCars.length) {
          setActiveCarIndex(newIndex)
        }
      }
    }
    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [viewMode, currentModelIndex, filteredModels.length, activeGenIndex, familyGenerations.length, activeCarIndex, variantFilteredFeedCars.length])

  const scrollToModel = (index: number) => {
    const container = feedRef.current
    if (!container) return
    container.scrollTo({ top: getCardHeight() * index, behavior: "smooth" })
    setCurrentModelIndex(index)
  }

  // Reset index when filters change
  useEffect(() => {
    setCurrentModelIndex(0)
    feedRef.current?.scrollTo({ top: 0 })
  }, [searchQuery, selectedPriceRange, selectedPriceTier, selectedStatus, selectedRegion, selectedEra])

  // Brand data
  const sampledLiveCount = cars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON").length
  const liveCount = liveNowCount ?? sampledLiveCount
  const soldCount = cars.filter(c => c.status === "ENDED").length
  const minPrice = Math.min(...cars.map(c => c.currentBid))
  const maxPrice = Math.max(...cars.map(c => c.currentBid))
  const activeFilterCount = (selectedPriceRange !== 0 ? 1 : 0) + (selectedStatus !== "All" ? 1 : 0)

  // Region counts for pills
  const regionCounts = useMemo(() => {
    if (liveRegionTotals) {
      return {
        All: liveRegionTotals.all,
        US: liveRegionTotals.US,
        EU: liveRegionTotals.EU,
        UK: liveRegionTotals.UK,
        JP: liveRegionTotals.JP,
      }
    }

    return {
      All: cars.length,
      US: cars.filter(c => c.region === "US").length,
      EU: cars.filter(c => c.region === "EU").length,
      UK: cars.filter(c => c.region === "UK").length,
      JP: cars.filter(c => c.region === "JP").length,
    }
  }, [cars, liveRegionTotals])

  const selectedRegionLiveCount = useMemo(() => {
    if (!selectedRegion || selectedRegion === "all") {
      return liveCount
    }

    const key = selectedRegion as keyof typeof regionCounts
    const counted = regionCounts[key]
    if (typeof counted === "number") {
      return counted
    }

    return liveCount
  }, [liveCount, regionCounts, selectedRegion])

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedRegion(null)
    setSelectedPriceRange(0)
    setSelectedPriceTier("all")
    setSelectedEra("All")
    setSelectedStatus("All")
    setSortBy("price-desc")
  }

  return (
    <>
      {/* ═══ MOBILE LAYOUT ═══ */}
      <div className="md:hidden min-h-screen bg-[#0b0b10] pt-14">
        {/* Sticky region pills with counts */}
        <MakePageRegionPills regionCounts={regionCounts} />

        {/* Sticky search + filter bar */}
        <div className="sticky top-[45px] z-20 bg-[#0b0b10]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#4B5563]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("filters.searchMakePlaceholder", { make })}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-[#FFFCF7] placeholder:text-[#4B5563] focus:outline-none focus:border-[#F8B4D9]/50"
              />
            </div>
            <button
              onClick={() => setShowMobileFilters(true)}
              className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[12px] font-medium text-[#9CA3AF]"
            >
              <SlidersHorizontal className="size-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 size-5 flex items-center justify-center rounded-full bg-[#F8B4D9] text-[10px] font-bold text-[#0b0b10]">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="pb-24">
          {filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-8 py-20">
              <Car className="size-12 text-[#4B5563] mb-4" />
              <h3 className="text-[15px] font-semibold text-[#FFFCF7] mb-2">{t("empty.title")}</h3>
              <p className="text-[13px] text-[#4B5563] mb-6">{t("empty.subtitle")}</p>
              <button onClick={clearFilters} className="px-6 py-3 rounded-xl bg-[#F8B4D9] text-[#0b0b10] text-[12px] font-semibold">
                {t("empty.clearAll")}
              </button>
            </div>
          ) : (
            <>
              {/* Hero: first model with context panels below */}
              {filteredModels[0] && (
                <>
                  <MobileHeroModel model={filteredModels[0]} make={make} />
                  <MobileModelContext
                    model={filteredModels[0]}
                    make={make}
                    cars={regionFilteredCars}
                    allCars={cars}
                    allModels={filteredModels}
                    dbOwnershipCosts={realOwnershipCosts}
                  />
                </>
              )}

              {/* Section: All Models (index 1+) */}
              {filteredModels.length > 1 && (
                <div className="mt-6">
                  <div className="px-4 py-3 flex items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                      {t("mobileContext.models")}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-[#F8B4D9]">{filteredModels.length - 1}</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {filteredModels.slice(1).map((model) => (
                      <MobileModelRow
                        key={model.slug}
                        model={model}
                        make={make}
                        onTap={() => setExpandedModel(model)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Live Auctions (filtered by family when selected) */}
              <MobileMakeLiveAuctions
                cars={selectedFamilyForFeed
                  ? regionFilteredCars.filter(c => extractFamily(c.model, c.year, make) === selectedFamilyForFeed)
                  : regionFilteredCars
                }
                totalLiveCount={liveCars.length}
              />
            </>
          )}
        </div>

        {/* Bottom sheet for tapped model context */}
        <MobileModelContextSheet
          model={expandedModel}
          make={make}
          cars={regionFilteredCars}
          allCars={cars}
          allModels={filteredModels}
          onClose={() => setExpandedModel(null)}
          dbOwnershipCosts={realOwnershipCosts}
        />

        <MobileFilterSheet
          open={showMobileFilters}
          onClose={() => setShowMobileFilters(false)}
          models={[]}
          selectedModel=""
          setSelectedModel={() => { }}
          selectedPriceRange={selectedPriceRange}
          setSelectedPriceRange={setSelectedPriceRange}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          sortBy={sortBy}
          setSortBy={setSortBy}
          cars={cars}
          filteredCount={filteredModels.length}
        />
      </div>

      {/* ═══ DESKTOP LAYOUT (3-column) ═══ */}
      <div className="hidden md:flex h-[100dvh] w-full flex-col bg-[#0b0b10] overflow-hidden pt-[80px]">
        <div className="flex-1 min-h-0 grid grid-cols-[22%_1fr_28%] grid-rows-[1fr] overflow-hidden">
          {/* COLUMN A: GENERATIONS + FILTERS + LIVE */}
          <div className="h-full flex flex-col border-r border-white/5 overflow-hidden">
            {/* Filters section (scrollable) */}
            {selectedModel ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Back navigation breadcrumb */}
                {(viewMode === 'generations' || viewMode === 'cars') && (
                  <div className="shrink-0 px-4 py-2 border-b border-white/5 flex items-center gap-1">
                    <button
                      onClick={handleBackToFamilies}
                      className="inline-flex items-center gap-1 text-[10px] text-[#6B7280] hover:text-[#F8B4D9] transition-colors group"
                    >
                      <ArrowLeft className="size-3 group-hover:-translate-x-0.5 transition-transform" />
                      <span className="uppercase font-semibold">{make}</span>
                    </button>
                    {viewMode === 'cars' && selectedFamilyForFeed && (
                      <>
                        <ChevronRight className="size-3 text-[#4B5563]" />
                        <button
                          onClick={handleBackToGenerations}
                          className="text-[10px] text-[#6B7280] hover:text-[#F8B4D9] transition-colors uppercase font-semibold"
                        >
                          {selectedFamilyForFeed}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {/* Family search (generations only, no search bar) */}
                <div className="shrink-0">
                  <FamilySearchAndFilters
                    familyName={selectedModel.name}
                    totalCars={displayCars.length}
                    hideSearch
                    onFilterChange={(familyFilters) => {
                      setActiveFilters(prev => ({
                        ...prev,
                        searchQuery: familyFilters.searchQuery,
                        selectedGenerations: familyFilters.selectedGenerations,
                        yearRange: familyFilters.yearRange || prev?.yearRange || null,
                        priceRange: familyFilters.priceRange || prev?.priceRange || null,
                      }))
                    }}
                  />
                </div>
                {/* Advanced filters (price, year, km, transmission) */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <AdvancedFilters
                    familyName={selectedModel.name}
                    onFiltersChange={(advFilters) => {
                      setActiveFilters(prev => ({
                        ...prev,
                        searchQuery: prev?.searchQuery || "",
                        selectedGenerations: prev?.selectedGenerations || [],
                        yearRange: advFilters.yearRange,
                        priceRange: advFilters.priceRange,
                        mileageRanges: advFilters.mileageRanges,
                        transmissions: advFilters.transmissions,
                        bodyTypes: advFilters.bodyTypes,
                        colors: advFilters.colors,
                        statuses: advFilters.statuses,
                        grades: advFilters.grades,
                      }))
                    }}
                    minPrice={selectedModel.priceMin}
                    maxPrice={selectedModel.priceMax}
                    minYear={parseInt(selectedModel.years.split("–")[0]) || 1960}
                    maxYear={parseInt(selectedModel.years.split("–")[1] || selectedModel.years) || 2026}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1" />
            )}

            {/* LIVE BIDS (always at bottom) */}
            <div className="shrink-0 max-h-[35%] flex flex-col border-t border-white/5 overflow-hidden">
              {/* Live header */}
              <div className="shrink-0 px-3 py-1.5 flex items-center gap-2 bg-[rgba(11,11,16,0.4)]">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-emerald-400">
                  LIVE NOW
                </span>
                {liveCars.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-[9px] font-bold text-emerald-400">
                    {liveCars.length}
                  </span>
                )}
              </div>
              {/* Scrollable live bids */}
              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                {liveCars.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <span className="text-[11px] text-[#4B5563]">No live auctions</span>
                  </div>
                ) : (
                  liveCars.map((car) => {
                    const isEndingSoon = car.status === "ENDING_SOON"
                    const makeSlug = car.make.toLowerCase().replace(/\s+/g, "-")
                    return (
                      <Link
                        key={car.id}
                        href={`/cars/${makeSlug}/${car.id}`}
                        className="group flex gap-2.5 px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] transition-all"
                      >
                        <div className="relative w-14 h-11 rounded-lg overflow-hidden shrink-0 bg-[#0F1012]">
                          <Image
                            src={car.image}
                            alt={car.title}
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                          <div className="absolute top-0.5 right-0.5 size-2 rounded-full bg-emerald-400 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-[#FFFCF7] truncate group-hover:text-[#F8B4D9] transition-colors">
                            {car.year} {car.model}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-mono font-bold text-[#F8B4D9]">
                              {formatPriceForRegion(car.currentBid, selectedRegion)}
                            </span>
                            <span className={`flex items-center gap-1 text-[9px] ${isEndingSoon ? "text-orange-400" : "text-[#6B7280]"}`}>
                              <Clock className="size-2.5" />
                              {timeLeft(new Date(car.endTime), {
                                ended: tAuction("time.ended"),
                                day: tAuction("time.units.day"),
                                hour: tAuction("time.units.hour"),
                                minute: tAuction("time.units.minute"),
                              })}
                            </span>
                          </div>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* COLUMN B: MODEL FEED (snap scroll) */}
          <div
            ref={feedRef}
            className={`h-full overflow-y-auto no-scrollbar scroll-smooth ${(viewMode === 'families' || viewMode === 'generations') && !hasActiveFilters ? "snap-y snap-mandatory" : ""}`}
          >
            {viewMode === 'cars' ? (
              // MODE: Viewing specific generation's cars (feed style)
              <>
                {/* Back navigation + sort + variant chips */}
                <div className="sticky top-0 z-10 bg-[#0b0b10]/95 backdrop-blur-xl border-b border-white/5 px-5 py-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleBackToGenerations}
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#6B7280] hover:text-[#F8B4D9] transition-colors group"
                    >
                      <ArrowLeft className="size-3 group-hover:-translate-x-0.5 transition-transform" />
                      <span className="uppercase font-semibold tracking-wider">
                        {selectedFamilyForFeed} {selectedGeneration ? `/ ${selectedGeneration.toUpperCase()}` : ""}
                      </span>
                    </button>
                    <SortSelector sortBy={sortBy} setSortBy={setSortBy} options={carSortOptions} />
                  </div>
                  {availableVariants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <button
                        onClick={() => setSelectedVariantChip(null)}
                        className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all ${
                          !selectedVariantChip
                            ? "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9] border border-[rgba(248,180,217,0.3)]"
                            : "bg-white/[0.03] text-[#6B7280] border border-white/10 hover:border-white/20"
                        }`}
                      >
                        All ({filteredFeedCars.length})
                      </button>
                      {availableVariants.map(v => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariantChip(selectedVariantChip === v.id ? null : v.id)}
                          className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all ${
                            selectedVariantChip === v.id
                              ? "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9] border border-[rgba(248,180,217,0.3)]"
                              : "bg-white/[0.03] text-[#6B7280] border border-white/10 hover:border-white/20"
                          }`}
                        >
                          {v.label} ({v.count})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {variantFilteredFeedCars.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-8">
                    <Car className="size-12 text-[#4B5563] mb-4" />
                    <h3 className="text-[15px] font-semibold text-[#FFFCF7] mb-2">No hay carros</h3>
                    <p className="text-[13px] text-[#4B7280] mb-6">
                      No se encontraron carros para esta generación
                    </p>
                    <button
                      onClick={handleBackToGenerations}
                      className="px-6 py-3 rounded-xl bg-[#F8B4D9] text-[#0b0b10] text-[12px] font-semibold"
                    >
                      Volver a generaciones
                    </button>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {variantFilteredFeedCars.map((car, i) => (
                      <motion.div
                        key={car.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.15) }}
                        layout
                      >
                        <CarFeedCard car={car} make={make} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </>
            ) : viewMode === 'generations' ? (
              // MODE: Viewing generations of a family (snap scroll)
              <>
                {familyGenerations.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-8">
                    <Car className="size-12 text-[#4B5563] mb-4" />
                    <h3 className="text-[15px] font-semibold text-[#FFFCF7] mb-2">No generations found</h3>
                    <p className="text-[13px] text-[#4B5563] mb-6">
                      No se encontraron generaciones para {selectedFamilyForFeed}
                    </p>
                    <button
                      onClick={handleBackToFamilies}
                      className="px-6 py-3 rounded-xl bg-[#F8B4D9] text-[#0b0b10] text-[12px] font-semibold"
                    >
                      Volver a familias
                    </button>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {familyGenerations.map((gen, i) => (
                      <motion.div
                        key={gen.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.2) }}
                        layout
                      >
                        <GenerationFeedCard
                          gen={gen}
                          familyName={selectedFamilyForFeed || ""}
                          make={make}
                          onClick={() => handleGenerationClick(gen.id)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </>
            ) : hasActiveFilters ? (
              // MODE: Filters active from COLUMN C (grid style)
              displayCars.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-8">
                  <Search className="size-12 text-[#4B5563] mb-4" />
                  <h3 className="text-[15px] font-semibold text-[#FFFCF7] mb-2">No hay resultados</h3>
                  <p className="text-[13px] text-[#4B5563] mb-6">
                    No se encontraron carros que coincidan con tu búsqueda
                  </p>
                  <button
                    onClick={() => setActiveFilters(null)}
                    className="px-6 py-3 rounded-xl bg-[#F8B4D9] text-[#0b0b10] text-[12px] font-semibold"
                  >
                    Limpiar filtros
                  </button>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {/* Header with filter info */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div>
                      <p className="text-[13px] font-semibold text-[#FFFCF7]">
                        {displayCars.length} {displayCars.length === 1 ? "resultado" : "resultados"}
                      </p>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">
                        {activeFilters.searchQuery && `"${activeFilters.searchQuery}"`}
                        {activeFilters.searchQuery && activeFilters.selectedGenerations.length > 0 && " • "}
                        {activeFilters.selectedGenerations.length > 0 &&
                          activeFilters.selectedGenerations.join(", ")}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveFilters(null)}
                      className="text-[11px] text-[#F8B4D9] hover:text-[#FFFCF7] transition-colors flex items-center gap-1"
                    >
                      <X className="size-3" />
                      Limpiar
                    </button>
                  </div>

                  {/* Car grid */}
                  <div className="grid grid-cols-1 gap-4">
                    <AnimatePresence mode="popLayout">
                      {displayCars.map((car, idx) => (
                        <motion.div
                          key={car.id}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.15) }}
                          layout
                        >
                          <CarCard car={car} index={idx} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )
            ) : (
              // MODE: Default - Show family feed (families with snap scroll)
              <>
              {filteredModels.length > 1 && (
                <div className="sticky top-0 z-10 bg-[#0b0b10]/95 backdrop-blur-xl border-b border-white/5 px-5 py-2.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#6B7280]">
                    {filteredModels.length} {filteredModels.length === 1 ? "familia" : "familias"}
                  </span>
                  <SortSelector sortBy={sortBy} setSortBy={setSortBy} options={sortOptions} />
                </div>
              )}
              {filteredModels.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-8">
                  <Car className="size-12 text-[#4B5563] mb-4" />
                  <h3 className="text-[15px] font-semibold text-[#FFFCF7] mb-2">{t("empty.title")}</h3>
                  <p className="text-[13px] text-[#4B5563] mb-6">{t("empty.subtitle")}</p>
                  <button onClick={clearFilters} className="px-6 py-3 rounded-xl bg-[#F8B4D9] text-[#0b0b10] text-[12px] font-semibold">
                    {t("empty.clearAll")}
                  </button>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredModels.map((model, i) => (
                    <motion.div
                      key={model.slug}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.2) }}
                      layout
                    >
                      <ModelFeedCard model={model} make={make} onClick={() => handleFamilyClick(model.name)} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
              </>
            )}
          </div>

          {/* COLUMN C: MARKET INTELLIGENCE — synced with center scroll */}
          <div className="h-full overflow-hidden border-l border-[rgba(248,180,217,0.08)] bg-[rgba(15,14,22,0.5)]">
            {viewMode === 'generations' && familyGenerations[activeGenIndex] ? (
              <GenerationContextPanel
                key={familyGenerations[activeGenIndex].id}
                gen={familyGenerations[activeGenIndex]}
                familyName={selectedFamilyForFeed || ""}
                make={make}
                familyCars={regionFilteredCars.filter(car => extractFamily(car.model, car.year, make) === selectedFamilyForFeed)}
                onOpenAdvisor={() => setShowAdvisorChat(true)}
              />
            ) : viewMode === 'cars' && variantFilteredFeedCars[activeCarIndex] ? (
              <CarContextPanel
                key={variantFilteredFeedCars[activeCarIndex].id}
                car={variantFilteredFeedCars[activeCarIndex]}
                make={make}
                onOpenAdvisor={() => setShowAdvisorChat(true)}
              />
            ) : selectedModel ? (
              <ModelContextPanel
                model={selectedModel}
                make={make}
                cars={displayCars}
                allCars={cars}
                allModels={filteredModels}
                onOpenAdvisor={() => setShowAdvisorChat(true)}
                dbOwnershipCosts={realOwnershipCosts}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Advisor Chat */}
      <AdvisorChat
        open={showAdvisorChat}
        onOpenChange={setShowAdvisorChat}
        initialContext={{ make }}
      />
    </>
  )
}
