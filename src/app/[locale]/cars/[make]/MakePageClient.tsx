"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
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
  TrendingUp,
  Shield,
  Globe,
  BarChart3,
  Gauge,
} from "lucide-react"
import type { CollectorCar, Region, FairValueByRegion } from "@/lib/curatedCars"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion, formatRegionalPrice as fmtRegional, toUsd, formatUsd, resolveRegion, convertFromUsd } from "@/lib/regionPricing"
import { AdvisorChat } from "@/components/advisor/AdvisorChat"
import { useLocale, useTranslations } from "next-intl"
import { getModelImage } from "@/lib/modelImages"

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

// ─── BENCHMARKS (for 5-year return comparison) ───
const BENCHMARKS = [
  { label: "S&P 500", return5y: 42 },
  { label: "Gold", return5y: 28 },
  { label: "Real Estate", return5y: 18 },
]

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

// ─── MOCK 5-YEAR PRICE HISTORY (per brand) ───
const mockPriceHistory: Record<string, number[]> = {
  Porsche: [180000, 210000, 245000, 290000, 320000],
  Ferrari: [450000, 520000, 580000, 640000, 720000],
  McLaren: [12000000, 13500000, 15000000, 17000000, 19500000],
  Lamborghini: [280000, 310000, 350000, 400000, 460000],
  BMW: [65000, 78000, 92000, 108000, 125000],
  Nissan: [85000, 110000, 145000, 180000, 220000],
  Toyota: [75000, 95000, 120000, 145000, 175000],
  "Mercedes-Benz": [320000, 350000, 380000, 420000, 470000],
  "Aston Martin": [400000, 440000, 480000, 520000, 580000],
  Lexus: [350000, 380000, 410000, 440000, 490000],
  Ford: [280000, 310000, 340000, 380000, 420000],
  Acura: [100000, 115000, 135000, 155000, 180000],
  Jaguar: [120000, 130000, 145000, 160000, 180000],
  default: [150000, 170000, 195000, 220000, 250000],
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

// ─── PRICE TIER PILLS (compact) ───
const priceTiers = [
  { key: "all", label: "All", min: 0, max: Infinity },
  { key: "under100k", label: "<$100K", min: 0, max: 100000 },
  { key: "100k-500k", label: "$100K–$500K", min: 100000, max: 500000 },
  { key: "500k-1m", label: "$500K–$1M", min: 500000, max: 1000000 },
  { key: "over1m", label: "$1M+", min: 1000000, max: Infinity },
]

// ─── ERA HELPERS ───
function getDecade(year: number): string {
  const decade = Math.floor(year / 10) * 10
  if (decade <= 1950) return "Pre-60s"
  return `${decade}s`
}

function getAvailableEras(cars: CollectorCar[]): string[] {
  const eras = new Set(cars.map(c => getDecade(c.year)))
  const order = ["Pre-60s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]
  return order.filter(e => eras.has(e))
}

// ─── SORT OPTIONS ───
const sortOptions = [
  { key: "priceHighToLow" as const, value: "price-desc" },
  { key: "priceLowToHigh" as const, value: "price-asc" },
  { key: "yearNewestFirst" as const, value: "year-desc" },
  { key: "yearOldestFirst" as const, value: "year-asc" },
  { key: "mostListed" as const, value: "count-desc" },
]

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

// ─── AGGREGATE CARS INTO MODELS ───
function aggregateModels(cars: CollectorCar[]): Model[] {
  const modelMap = new Map<string, CollectorCar[]>()

  // Group by model name
  cars.forEach(car => {
    const existing = modelMap.get(car.model) || []
    existing.push(car)
    modelMap.set(car.model, existing)
  })

  // Convert to Model array
  const models: Model[] = []
  modelMap.forEach((modelCars, modelName) => {
    const prices = modelCars.map(c => c.currentBid)
    const years = modelCars.map(c => c.year)
    const categories = [...new Set(modelCars.map(c => c.category))]
    const liveCount = modelCars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON").length

    // Get representative car (highest value)
    const repCar = modelCars.sort((a, b) => b.currentBid - a.currentBid)[0]
    const make = repCar.make

    // Get verified image, fallback to car's image
    const verifiedImage = getModelImage(make, modelName)
    const representativeImage = verifiedImage || repCar.image

    // Year range
    const minYear = Math.min(...years)
    const maxYear = Math.max(...years)
    const yearStr = minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`

    models.push({
      name: modelName,
      slug: modelName.toLowerCase().replace(/\s+/g, "-"),
      carCount: modelCars.length,
      priceMin: Math.min(...prices),
      priceMax: Math.max(...prices),
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      representativeImage,
      representativeCar: repCar,
      liveCount,
      years: yearStr,
      categories,
    })
  })

  // Sort by max price (most expensive first)
  return models.sort((a, b) => b.priceMax - a.priceMax)
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all shrink-0 ${
                isActive
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
          <Link href="/" className="flex items-center gap-1.5 text-[11px] text-[rgba(255,252,247,0.5)]">
            <ArrowLeft className="size-3.5" />
            {t("hero.backToCollection")}
          </Link>
        </div>

        {/* Grade badge */}
        <div className="absolute top-4 right-4">
          <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${
            model.representativeCar.investmentGrade === "AAA"
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
            {make} {model.name}
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
          {model.name}
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
}: {
  model: Model
  make: string
  cars: CollectorCar[]
  allCars: CollectorCar[]
  allModels: Model[]
}) {
  const t = useTranslations("makePage")
  const { selectedRegion, effectiveRegion } = useRegion()

  const allModelCars = allCars.filter(c => c.model === model.name)
  const regionalPricing = useMemo(() => aggregateRegionalPricing(allModelCars), [allModelCars])
  const bestRegion = regionalPricing ? findBestRegion(regionalPricing) : null
  const priceHistory = generateModelPriceHistory(model.avgPrice, model.representativeCar.trendValue)
  const model5yReturn = Math.round(((priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0]) * 100)
  const depth = deriveModelDepth(allModelCars)

  const baseCosts = ownershipCosts[make] || ownershipCosts.default
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

      {/* Panel 2: 5-Year Return Comparison */}
      <div className="rounded-2xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="size-3.5 text-[#F8B4D9]" />
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#9CA3AF]">
            {t("mobileContext.returnComparison")}
          </span>
          <span className="text-[10px] font-mono font-bold text-emerald-400 ml-auto">+{model5yReturn}%</span>
        </div>
        <div className="space-y-2">
          {/* Model bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-[#F8B4D9] truncate">{model.name}</span>
              <span className="text-[10px] font-mono text-emerald-400">+{model5yReturn}%</span>
            </div>
            <div className="h-[6px] rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full rounded-full bg-[#F8B4D9]/50" style={{ width: `${Math.min((model5yReturn / Math.max(model5yReturn, 50)) * 100, 100)}%` }} />
            </div>
          </div>
          {BENCHMARKS.map((b) => (
            <div key={b.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[#9CA3AF]">{b.label}</span>
                <span className="text-[10px] font-mono text-[#6B7280]">+{b.return5y}%</span>
              </div>
              <div className="h-[6px] rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full rounded-full bg-white/10" style={{ width: `${Math.min((b.return5y / Math.max(model5yReturn, 50)) * 100, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel 3: Market Depth — 2x2 grid */}
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
}: {
  model: Model | null
  make: string
  cars: CollectorCar[]
  allCars: CollectorCar[]
  allModels: Model[]
  onClose: () => void
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
                <p className="text-[14px] font-semibold text-[#FFFCF7]">{make} {model.name}</p>
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
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── MOBILE: LIVE AUCTIONS FOR MAKE PAGE ───
function MobileMakeLiveAuctions({ cars }: { cars: CollectorCar[] }) {
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
        <span className="text-[10px] font-mono font-semibold text-[#F8B4D9]">{liveAuctions.length}</span>
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
             car.platform === "COLLECTING_CARS" ? "CC" : car.platform}
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
      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap ${
        active
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
  searchQuery,
  setSearchQuery,
  selectedEra,
  setSelectedEra,
  availableEras,
  selectedPriceTier,
  setSelectedPriceTier,
}: {
  make: string
  cars: CollectorCar[]
  models: Model[]
  currentModelIndex: number
  onSelectModel: (index: number) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  selectedEra: string
  setSelectedEra: (e: string) => void
  availableEras: string[]
  selectedPriceTier: string
  setSelectedPriceTier: (p: string) => void
}) {
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const { selectedRegion } = useRegion()
  const minPrice = cars.length > 0 ? Math.min(...cars.map(c => c.currentBid)) : 0
  const maxPrice = cars.length > 0 ? Math.max(...cars.map(c => c.currentBid)) : 0
  const liveCount = cars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON").length

  // Count active filters (era + price tier)
  const activeFilterCount = (selectedEra !== "All" ? 1 : 0) + (selectedPriceTier !== "all" ? 1 : 0)

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
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[10px] text-[#6B7280] hover:text-[#F8B4D9] transition-colors"
          >
            <ArrowLeft className="size-3" />
          </Link>
          <h1 className="text-[13px] font-bold text-[#FFFCF7] tracking-wide uppercase">{make}</h1>
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

      {/* Search + filters — ultra-compact */}
      <div className="shrink-0 px-3 py-2 border-b border-white/5 space-y-1.5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("filters.searchModelsPlaceholder", { make })}
            className="w-full bg-white/[0.03] border border-white/5 rounded-md pl-8 pr-3 py-1.5 text-[11px] text-[#FFFCF7] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(248,180,217,0.3)] transition-colors"
          />
        </div>

        {/* Era pills — horizontal scroll, no label */}
        {availableEras.length > 1 && (
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            <SidebarPill label="All" active={selectedEra === "All"} onClick={() => setSelectedEra("All")} />
            {availableEras.map(era => (
              <SidebarPill key={era} label={era} active={selectedEra === era} onClick={() => setSelectedEra(era)} />
            ))}
            {/* Separator */}
            <div className="w-px shrink-0 bg-white/10 mx-0.5" />
            {/* Price pills inline */}
            {priceTiers.map(tier => (
              <SidebarPill
                key={tier.key}
                label={tier.label}
                active={selectedPriceTier === tier.key}
                onClick={() => setSelectedPriceTier(tier.key)}
              />
            ))}
          </div>
        )}
        {availableEras.length <= 1 && (
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {priceTiers.map(tier => (
              <SidebarPill
                key={tier.key}
                label={tier.label}
                active={selectedPriceTier === tier.key}
                onClick={() => setSelectedPriceTier(tier.key)}
              />
            ))}
          </div>
        )}
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
                className={`w-full text-left flex gap-2.5 px-3 py-2 border-b border-white/[0.03] transition-all ${
                  index === currentModelIndex
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
                    <p className={`text-[12px] font-semibold truncate ${
                      index === currentModelIndex ? "text-[#F8B4D9]" : "text-[#FFFCF7]"
                    }`}>
                      {model.name}
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

// ─── MODEL FEED CARD (Full-height card for center column) ───
function ModelFeedCard({ model, make }: { model: Model; make: string }) {
  const t = useTranslations("makePage")
  const { selectedRegion } = useRegion()
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-")

  // Investment grade from representative car
  const grade = model.representativeCar.investmentGrade

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      <Link
        href={`/cars/${makeSlug}/${model.representativeCar.id}`}
        className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-[#0F1012] border border-white/5 group cursor-pointer hover:border-[rgba(248,180,217,0.2)] transition-all duration-300"
      >
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
              <span className="text-[#6B7280] text-lg">{make} {model.name}</span>
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
              {make} {model.name}
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
              <p className={`text-[13px] font-semibold ${
                grade === "AAA" ? "text-emerald-400"
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
      </Link>
    </div>
  )
}

function aggregateRegionalPricing(modelCars: CollectorCar[]): FairValueByRegion | null {
  if (modelCars.length === 0) return null
  const regions: (keyof FairValueByRegion)[] = ["US", "EU", "UK", "JP"]
  const result = {} as FairValueByRegion
  for (const region of regions) {
    const lows = modelCars.map(c => c.fairValueByRegion[region].low)
    const highs = modelCars.map(c => c.fairValueByRegion[region].high)
    result[region] = {
      currency: modelCars[0].fairValueByRegion[region].currency,
      low: Math.min(...lows),
      high: Math.max(...highs),
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
function generateModelPriceHistory(avgPrice: number, trendValue: number): number[] {
  const annualGrowth = (trendValue / 100) / 5
  const result: number[] = []
  for (let i = 4; i >= 0; i--) {
    result.push(Math.round(avgPrice / Math.pow(1 + annualGrowth, i)))
  }
  return result
}

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
function ModelContextPanel({
  model,
  make,
  cars,
  allCars,
  allModels,
  onOpenAdvisor,
}: {
  model: Model
  make: string
  cars: CollectorCar[]
  allCars: CollectorCar[]
  allModels: Model[]
  onOpenAdvisor: () => void
}) {
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const locale = useLocale()
  const { selectedRegion, effectiveRegion } = useRegion()

  // All cars of this model (unfiltered) for regional analysis
  const allModelCars = allCars.filter(c => c.model === model.name)
  const regionalPricing = useMemo(() => aggregateRegionalPricing(allModelCars), [allModelCars])

  // Model-specific thesis (from the representative car's real data)
  const modelThesis = model.representativeCar.thesis

  // Model-specific ownership costs (scaled by model price vs brand average)
  const baseCosts = ownershipCosts[make] || ownershipCosts.default
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

  // Model-specific 5-year return data (derived from real trendValue)
  const priceHistory = generateModelPriceHistory(model.avgPrice, model.representativeCar.trendValue)
  const model5yReturn = Math.round(((priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0]) * 100)

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
          <div className="flex items-center gap-2 mb-2">
            <Shield className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              {make} {model.name}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
            {modelThesis}
          </p>
        </div>

        {/* 2. PRICE SUMMARY */}
        <div className="px-5 py-3 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">{t("sidebar.grade")}</span>
              <p className={`text-[16px] font-bold ${
                model.representativeCar.investmentGrade === "AAA" ? "text-emerald-400" : "text-[#F8B4D9]"
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

        {/* 4. 5-YEAR RETURN COMPARISON */}
        <div className="px-5 py-4 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              5-Year Return Comparison
            </span>
          </div>
          <div className="space-y-2.5">
            {/* Model */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-[#F8B4D9] truncate mr-2">{model.name}</span>
                <span className="text-[11px] font-mono font-bold text-emerald-400">+{model5yReturn}%</span>
              </div>
              <div className="h-[8px] rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full rounded-full bg-[#F8B4D9]/50" style={{ width: `${Math.min((model5yReturn / Math.max(model5yReturn, 50)) * 100, 100)}%` }} />
              </div>
            </div>
            {/* Benchmarks */}
            {BENCHMARKS.map((b) => (
              <div key={b.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[#9CA3AF]">{b.label}</span>
                  <span className="text-[11px] font-mono text-[#6B7280]">+{b.return5y}%</span>
                </div>
                <div className="h-[8px] rounded-full bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded-full bg-white/10" style={{ width: `${Math.min((b.return5y / Math.max(model5yReturn, 50)) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. YEAR-BY-YEAR TREND */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-[#F8B4D9]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                5-Year Price Trend
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold text-emerald-400">
              +{model5yReturn}%
            </span>
          </div>
          {/* Simple inline bar chart */}
          <div className="flex items-end gap-1.5 h-[60px]">
            {priceHistory.map((value, i) => {
              const maxVal = Math.max(...priceHistory)
              const height = (value / maxVal) * 100
              const year = 2021 + i
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-sm bg-gradient-to-t from-[#F8B4D9]/30 to-[#F8B4D9]/60" style={{ height: `${height}%` }} />
                  <span className="text-[8px] text-[#6B7280]">{year}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 6. RECENT SALES */}
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

        {/* 7. LIQUIDITY & MARKET DEPTH */}
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
                    className={`h-[6px] flex-1 rounded-sm ${
                      i < depth.demandScore ? "bg-[#F8B4D9]/50" : "bg-white/[0.04]"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 8. ANNUAL OWNERSHIP COST */}
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

        {/* 9. SIMILAR MODELS */}
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
export function MakePageClient({ make, cars }: { make: string; cars: CollectorCar[] }) {
  const locale = useLocale()
  const t = useTranslations("makePage")
  const tStatus = useTranslations("status")

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
  const feedRef = useRef<HTMLDivElement>(null)

  // Filter cars by region first, then aggregate into models
  const regionFilteredCars = useMemo(() => {
    if (!selectedRegion || selectedRegion === "all") return cars
    return cars.filter(c => c.region === selectedRegion)
  }, [cars, selectedRegion])

  // Available eras and categories (computed from region-filtered cars)
  const availableEras = useMemo(() => getAvailableEras(regionFilteredCars), [regionFilteredCars])
  // Aggregate filtered cars into models
  const allModels = useMemo(() => aggregateModels(regionFilteredCars), [regionFilteredCars])

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

    // Era filter
    if (selectedEra !== "All") {
      result = result.filter(model => {
        const modelYears = regionFilteredCars
          .filter(c => c.model === model.name)
          .map(c => getDecade(c.year))
        return modelYears.includes(selectedEra)
      })
    }

    // Price tier filter (used on desktop sidebar)
    const tier = priceTiers.find(t => t.key === selectedPriceTier)
    if (tier && (tier.min > 0 || tier.max < Infinity)) {
      result = result.filter(model =>
        model.priceMax >= tier.min && model.priceMin < tier.max
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

  const selectedModel = filteredModels[currentModelIndex] || filteredModels[0]

  // Scroll sync for center feed
  const getCardHeight = () => typeof window !== "undefined" ? window.innerHeight - 80 : 800

  useEffect(() => {
    const container = feedRef.current
    if (!container) return
    const handleScroll = () => {
      const newIndex = Math.round(container.scrollTop / getCardHeight())
      if (newIndex !== currentModelIndex && newIndex >= 0 && newIndex < filteredModels.length) {
        setCurrentModelIndex(newIndex)
      }
    }
    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [currentModelIndex, filteredModels.length])

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
  const liveCount = cars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON").length
  const soldCount = cars.filter(c => c.status === "ENDED").length
  const minPrice = Math.min(...cars.map(c => c.currentBid))
  const maxPrice = Math.max(...cars.map(c => c.currentBid))
  const activeFilterCount = (selectedPriceRange !== 0 ? 1 : 0) + (selectedStatus !== "All" ? 1 : 0)

  // Region counts for pills
  const regionCounts = useMemo(() => ({
    All: cars.length,
    US: cars.filter(c => c.region === "US").length,
    EU: cars.filter(c => c.region === "EU").length,
    UK: cars.filter(c => c.region === "UK").length,
    JP: cars.filter(c => c.region === "JP").length,
  }), [cars])

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

              {/* Section: Live Auctions */}
              <MobileMakeLiveAuctions cars={regionFilteredCars} />
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
        />

        <MobileFilterSheet
          open={showMobileFilters}
          onClose={() => setShowMobileFilters(false)}
          models={[]}
          selectedModel=""
          setSelectedModel={() => {}}
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
          {/* COLUMN A: MODEL NAV SIDEBAR */}
          <ModelNavSidebar
            make={make}
            cars={regionFilteredCars}
            models={filteredModels}
            currentModelIndex={currentModelIndex}
            onSelectModel={scrollToModel}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedEra={selectedEra}
            setSelectedEra={setSelectedEra}
            availableEras={availableEras}
            selectedPriceTier={selectedPriceTier}
            setSelectedPriceTier={setSelectedPriceTier}
          />

          {/* COLUMN B: MODEL FEED (snap scroll) */}
          <div
            ref={feedRef}
            className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar scroll-smooth"
          >
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
              filteredModels.map((model) => (
                <ModelFeedCard key={model.slug} model={model} make={make} />
              ))
            )}
          </div>

          {/* COLUMN C: MODEL CONTEXT PANEL */}
          <div className="h-full overflow-hidden border-l border-[rgba(248,180,217,0.08)] bg-[rgba(15,14,22,0.5)]">
            {selectedModel && (
              <ModelContextPanel
                model={selectedModel}
                make={make}
                cars={regionFilteredCars}
                allCars={cars}
                allModels={filteredModels}
                onOpenAdvisor={() => setShowAdvisorChat(true)}
              />
            )}
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
