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
} from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
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

// ─── HELPERS ───
function formatPrice(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

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
          ? "bg-[#F8B4D9] text-[#050505]"
          : "bg-white/5 text-[#9CA3AF] hover:bg-white/10 border border-white/10"
        }
      `}
    >
      {label}
      {count !== undefined && (
        <span className={`text-[10px] ${active ? "text-[#050505]/60" : "text-[#4B5563]"}`}>
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

// ─── MODEL CARD (BIG CARD FOR MODELS) ───
function ModelCard({ model, make, index }: { model: Model; make: string; index: number }) {
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-")
  const t = useTranslations("makePage")

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), type: "spring", stiffness: 100 }}
      layout
    >
      <Link
        href={`/cars/${makeSlug}/${model.representativeCar.id}`}
        className="group block rounded-3xl bg-[rgba(15,14,22,0.6)] border border-[rgba(248,180,217,0.08)] overflow-hidden hover:border-[rgba(248,180,217,0.25)] transition-all duration-300"
      >
        {/* Image - Larger aspect ratio */}
        <div className="relative aspect-[16/9] overflow-hidden">
          <Image
            src={model.representativeImage}
            alt={model.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-[#0b0b10]/30 to-transparent" />

          {/* Live badge */}
          {model.liveCount > 0 && (
            <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-[#0b0b10]/80 backdrop-blur-md px-3 py-1.5">
              <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-400">{model.liveCount} LIVE</span>
            </div>
          )}

          {/* Car count */}
          <div className="absolute top-4 right-4 rounded-full px-3 py-1.5 text-[11px] font-medium bg-white/10 text-white/70 border border-white/20">
            {model.carCount} listed
          </div>

          {/* Car count badge */}
          <div className="absolute bottom-4 right-4">
            <span className="rounded-full bg-[rgba(5,5,5,0.7)] backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-[#F2F0E9]">
              {model.carCount} {model.carCount === 1 ? "car" : "cars"}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Model name & years */}
          <div>
            <h3 className="text-2xl font-bold text-[#F2F0E9] group-hover:text-[#F8B4D9] transition-colors">
              {make} {model.name}
            </h3>
            <p className="mt-1 text-[13px] text-[#6B7280]">
              {model.years} • {model.categories.slice(0, 2).join(", ")}
            </p>
          </div>

          {/* Price range */}
          <div className="mt-5 pt-5 border-t border-white/5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">
                  {t("model.priceRange")}
                </p>
                <p className="text-2xl font-bold font-mono text-[#F8B4D9] mt-1">
                  {formatPrice(model.priceMin)} <span className="text-[#6B7280] text-lg">—</span> {formatPrice(model.priceMax)}
                </p>
              </div>

              <div className="flex items-center gap-2 text-[#9CA3AF] group-hover:text-[#F8B4D9] transition-colors">
                <span className="text-[12px] font-medium">{t("model.viewCollection")}</span>
                <ChevronRight className="size-5" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── CAR CARD IN GRID ───
function CarCard({ car, index }: { car: CollectorCar; index: number }) {
  const locale = useLocale()
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const tStatus = useTranslations("status")

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
          <h3 className="text-[15px] font-semibold text-[#F2F0E9] group-hover:text-[#F8B4D9] transition-colors line-clamp-1">
            {car.title}
          </h3>

          {/* Stats row - real data only */}
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#4B5563]">
                {isLive ? t("card.currentBid") : t("card.soldFor")}
              </p>
              <p className="text-[18px] font-bold font-mono text-[#F8B4D9]">
                {formatPrice(car.currentBid)}
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
                <span className="text-[12px] font-semibold tracking-[0.1em] uppercase text-[#F2F0E9]">
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
                className="w-full py-4 rounded-xl bg-[#F8B4D9] text-[#050505] font-semibold text-[13px]"
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

// ─── MODEL NAV SIDEBAR (Left column) ───
function ModelNavSidebar({
  make,
  cars,
  models,
  currentModelIndex,
  onSelectModel,
  searchQuery,
  setSearchQuery,
}: {
  make: string
  cars: CollectorCar[]
  models: Model[]
  currentModelIndex: number
  onSelectModel: (index: number) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
}) {
  const t = useTranslations("makePage")
  const minPrice = Math.min(...cars.map(c => c.currentBid))
  const maxPrice = Math.max(...cars.map(c => c.currentBid))
  const liveCount = cars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON").length

  return (
    <div className="h-full flex flex-col border-r border-white/5 overflow-hidden">
      {/* Back + Brand header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/5">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[10px] text-[#6B7280] hover:text-[#F8B4D9] transition-colors mb-3"
        >
          <ArrowLeft className="size-3" />
          {t("hero.backToCollection")}
        </Link>
        <h1 className="text-2xl font-bold text-[#F2F0E9] tracking-tight">{make}</h1>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[11px] text-[#6B7280]">{cars.length} cars</span>
          <span className="text-[11px] font-mono text-[#F8B4D9]">
            {formatPrice(minPrice)}–{formatPrice(maxPrice)}
          </span>
          {liveCount > 0 && (
            <span className="flex items-center gap-1">
              <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400">{liveCount} live</span>
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 px-4 py-3 border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("filters.searchModelsPlaceholder", { make })}
            className="w-full bg-white/[0.03] border border-white/5 rounded-lg pl-10 pr-3 py-2.5 text-[13px] text-[#F2F0E9] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(248,180,217,0.3)] transition-colors"
          />
        </div>
      </div>

      {/* Results count */}
      <div className="shrink-0 px-4 py-2 bg-[rgba(5,5,5,0.5)]">
        <span className="text-[10px] text-[#6B7280]">
          {t("results.summary", { filtered: models.length, totalModels: models.length, totalVehicles: cars.length })}
        </span>
      </div>

      {/* Model list (scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {models.map((model, index) => (
          <button
            key={model.slug}
            onClick={() => onSelectModel(index)}
            className={`w-full text-left px-4 py-3 border-b border-white/[0.03] transition-all ${
              index === currentModelIndex
                ? "bg-[rgba(248,180,217,0.08)] border-l-2 border-l-[#F8B4D9]"
                : "hover:bg-white/[0.02]"
            }`}
          >
            <p className={`text-[12px] font-semibold truncate ${
              index === currentModelIndex ? "text-[#F8B4D9]" : "text-[#F2F0E9]"
            }`}>
              {model.name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-[#6B7280]">{model.years}</span>
              <span className="text-[10px] text-[#6B7280]">{model.carCount} cars</span>
              <span className="text-[10px] font-mono text-[#F8B4D9]">{formatPrice(model.priceMax)}</span>
            </div>
            {model.liveCount > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-400">{model.liveCount} live</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── MODEL FEED CARD (Full-height card for center column) ───
function ModelFeedCard({ model, make }: { model: Model; make: string }) {
  const t = useTranslations("makePage")

  // Investment grade from representative car
  const grade = model.representativeCar.investmentGrade

  const gradeColor = (g: string) => {
    switch (g) {
      case "AAA": return "bg-emerald-500/20 text-emerald-400"
      case "AA": return "bg-blue-500/20 text-blue-400"
      case "A": return "bg-amber-500/20 text-amber-400"
      default: return "bg-white/5 text-[#6B7280]"
    }
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Background image */}
      <Image
        src={model.representativeImage}
        alt={`${make} ${model.name}`}
        fill
        className="object-cover"
        sizes="50vw"
        priority
      />
      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/30 to-transparent" />

      {/* Top badges */}
      <div className="absolute top-6 left-6 right-6 flex items-start justify-between">
        {model.liveCount > 0 && (
          <div className="flex items-center gap-2 rounded-full bg-[#0b0b10]/80 backdrop-blur-md px-3 py-1.5">
            <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-emerald-400">{model.liveCount} LIVE</span>
          </div>
        )}
        <div className="rounded-full px-3 py-1.5 text-[11px] font-medium bg-white/10 backdrop-blur-md text-white/70 border border-white/20 ml-auto">
          {model.carCount} listed
        </div>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-8">
        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-3">
          {model.categories.slice(0, 3).map(cat => (
            <span key={cat} className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] text-white/70">
              {cat}
            </span>
          ))}
        </div>

        {/* Model name */}
        <h2 className="text-4xl font-bold text-[#F2F0E9] tracking-tight">
          {make} {model.name}
        </h2>
        <p className="text-[14px] text-[#9CA3AF] mt-1">{model.years}</p>

        {/* Price + Grade */}
        <div className="flex items-end gap-4 mt-5 pt-5 border-t border-white/10">
          <div>
            <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">
              {t("model.priceRange")}
            </p>
            <p className="text-3xl font-bold font-mono text-[#F8B4D9] mt-1">
              {formatPrice(model.priceMin)} <span className="text-[#6B7280] text-xl">—</span> {formatPrice(model.priceMax)}
            </p>
          </div>
          <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${gradeColor(grade)}`}>
            {grade}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── MODEL CONTEXT PANEL (Right column) ───
function ModelContextPanel({
  model,
  make,
  cars,
  costs,
  thesis,
  onOpenAdvisor,
}: {
  model: Model
  make: string
  cars: CollectorCar[]
  costs: { insurance: number; storage: number; maintenance: number }
  thesis: string
  onOpenAdvisor: () => void
}) {
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const locale = useLocale()

  // Cars belonging to this model
  const modelCars = cars
    .filter(c => c.model === model.name)
    .sort((a, b) => b.currentBid - a.currentBid)

  const totalAnnualCost = costs.insurance + costs.storage + costs.maintenance

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Model Overview */}
      <div className="shrink-0 px-5 py-4 border-b border-white/5">
        <h2 className="text-lg font-bold text-[#F2F0E9]">{make} {model.name}</h2>
        <p className="text-[12px] text-[#6B7280] mt-1">{model.years} · {model.categories.slice(0, 2).join(", ")}</p>
      </div>

      {/* Price Stats */}
      <div className="shrink-0 px-5 py-3 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-[9px] text-[#6B7280] uppercase tracking-wide">{t("hero.priceRange")}</span>
            <p className="text-[14px] font-mono font-bold text-[#F8B4D9]">{formatPrice(model.priceMin)}–{formatPrice(model.priceMax)}</p>
          </div>
          <div>
            <span className="text-[9px] text-[#6B7280] uppercase tracking-wide">{t("hero.listings")}</span>
            <p className="text-[14px] font-bold text-[#F2F0E9]">{model.carCount}</p>
          </div>
          <div>
            <span className="text-[9px] text-[#6B7280] uppercase tracking-wide">Avg Price</span>
            <p className="text-[14px] font-mono text-[#F2F0E9]">{formatPrice(model.avgPrice)}</p>
          </div>
          <div>
            <span className="text-[9px] text-[#6B7280] uppercase tracking-wide">Grade</span>
            <p className={`text-[14px] font-bold ${
              model.representativeCar.investmentGrade === "AAA" ? "text-emerald-400" : "text-[#F8B4D9]"
            }`}>{model.representativeCar.investmentGrade}</p>
          </div>
        </div>
      </div>

      {/* Cars in this model (scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="px-5 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Car className="size-3.5 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#9CA3AF]">
              {t("hero.listings")}
            </span>
          </div>
        </div>

        {modelCars.map((car) => {
          const isLive = car.status === "ACTIVE" || car.status === "ENDING_SOON"
          return (
            <Link
              key={car.id}
              href={`/cars/${make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
              className="group flex gap-3 px-5 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-all"
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-[#0F1012]">
                <Image
                  src={car.image}
                  alt={car.title}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
                {isLive && (
                  <div className="absolute top-0.5 right-0.5 size-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-[#F2F0E9] truncate group-hover:text-[#F8B4D9] transition-colors">
                  {car.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">
                    {formatPrice(car.currentBid)}
                  </span>
                  <span className="text-[9px] text-[#6B7280]">
                    {car.mileage?.toLocaleString(locale)} {car.mileageUnit}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Ownership Costs */}
      <div className="shrink-0 px-5 py-3 border-t border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="size-3.5 text-[#F8B4D9]" />
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#9CA3AF]">
            {t("sidebar.estimatedAnnualCosts")}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-[10px] text-[#6B7280]">{t("sidebar.insurance")}</span>
            <span className="text-[10px] font-mono text-[#F2F0E9]">{formatPrice(costs.insurance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-[#6B7280]">{t("sidebar.storage")}</span>
            <span className="text-[10px] font-mono text-[#F2F0E9]">{formatPrice(costs.storage)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-[#6B7280]">{t("sidebar.service")}</span>
            <span className="text-[10px] font-mono text-[#F2F0E9]">{formatPrice(costs.maintenance)}</span>
          </div>
          <div className="pt-1.5 border-t border-white/5 flex justify-between">
            <span className="text-[10px] font-medium text-[#9CA3AF]">{t("sidebar.total")}</span>
            <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">{formatPrice(totalAnnualCost)}{t("sidebar.perYear")}</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="shrink-0 px-5 py-4 border-t border-white/5">
        <button
          onClick={onOpenAdvisor}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F8B4D9] py-3 text-[11px] font-semibold tracking-[0.1em] uppercase text-[#050505] hover:bg-[#fce4ec] transition-all"
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
  const [selectedPriceRange, setSelectedPriceRange] = useState(0)
  const [selectedStatus, setSelectedStatus] = useState("All")
  const [sortBy, setSortBy] = useState("price-desc")
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showAdvisorChat, setShowAdvisorChat] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)

  // Aggregate cars into models
  const allModels = useMemo(() => aggregateModels(cars), [cars])

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
  }, [allModels, searchQuery, selectedPriceRange, selectedStatus, sortBy])

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
  }, [searchQuery, selectedPriceRange, selectedStatus])

  // Brand data
  const thesis = brandThesis[make] || brandThesis.default
  const costs = ownershipCosts[make] || ownershipCosts.default
  const liveCount = cars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON").length
  const soldCount = cars.filter(c => c.status === "ENDED").length
  const minPrice = Math.min(...cars.map(c => c.currentBid))
  const maxPrice = Math.max(...cars.map(c => c.currentBid))
  const activeFilterCount = (selectedPriceRange !== 0 ? 1 : 0) + (selectedStatus !== "All" ? 1 : 0)

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedPriceRange(0)
    setSelectedStatus("All")
    setSortBy("price-desc")
  }

  return (
    <>
      {/* ═══ MOBILE LAYOUT ═══ */}
      <div className="md:hidden min-h-screen bg-[#050505]">
        {/* Mobile Hero */}
        <div className="relative h-[40vh] min-h-[300px] overflow-hidden">
          <Image src={cars[0].image} alt={make} fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-6">
            <Link href="/" className="absolute top-24 left-6 flex items-center gap-2 text-[12px] text-[rgba(255,252,247,0.5)] hover:text-[#F8B4D9] transition-colors">
              <ArrowLeft className="size-4" />
              {t("hero.backToCollection")}
            </Link>
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#F8B4D9] mb-2">{t("hero.brandCollection")}</span>
            <h1 className="text-4xl font-bold text-[#F2F0E9]">{make}</h1>
            <div className="flex gap-4 mt-4">
              <div>
                <p className="text-[9px] uppercase text-[#4B5563]">{t("hero.priceRange")}</p>
                <p className="text-xl font-bold font-mono text-[#F8B4D9]">{formatPrice(minPrice)}–{formatPrice(maxPrice)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase text-[#4B5563]">{t("hero.listings")}</p>
                <p className="text-xl font-bold font-mono text-[#F2F0E9]">{cars.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Filter Bar */}
        <div className="sticky top-16 z-30 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#4B5563]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("filters.searchMakePlaceholder", { make })}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-[13px] text-[#F2F0E9] placeholder:text-[#4B5563] focus:outline-none focus:border-[#F8B4D9]/50"
              />
            </div>
            <button
              onClick={() => setShowMobileFilters(true)}
              className="relative flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[12px] font-medium text-[#9CA3AF]"
            >
              <SlidersHorizontal className="size-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 size-5 flex items-center justify-center rounded-full bg-[#F8B4D9] text-[10px] font-bold text-[#050505]">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Model Grid */}
        <div className="px-4 py-6">
          <div className="grid grid-cols-1 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredModels.map((model, index) => (
                <ModelCard key={model.slug} model={model} make={make} index={index} />
              ))}
            </AnimatePresence>
          </div>
        </div>

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
      <div className="hidden md:flex h-[100dvh] w-full flex-col bg-[#050505] overflow-hidden pt-[80px]">
        <div className="flex-1 grid grid-cols-[22%_1fr_28%] overflow-hidden">
          {/* COLUMN A: MODEL NAV SIDEBAR */}
          <ModelNavSidebar
            make={make}
            cars={cars}
            models={filteredModels}
            currentModelIndex={currentModelIndex}
            onSelectModel={scrollToModel}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />

          {/* COLUMN B: MODEL FEED (snap scroll) */}
          <div
            ref={feedRef}
            className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar scroll-smooth"
          >
            {filteredModels.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <Car className="size-12 text-[#4B5563] mb-4" />
                <h3 className="text-[15px] font-semibold text-[#F2F0E9] mb-2">{t("empty.title")}</h3>
                <p className="text-[13px] text-[#4B5563] mb-6">{t("empty.subtitle")}</p>
                <button onClick={clearFilters} className="px-6 py-3 rounded-xl bg-[#F8B4D9] text-[#050505] text-[12px] font-semibold">
                  {t("empty.clearAll")}
                </button>
              </div>
            ) : (
              filteredModels.map((model) => (
                <div
                  key={model.slug}
                  className="snap-start"
                  style={{ height: `calc(100dvh - 80px)` }}
                >
                  <ModelFeedCard model={model} make={make} />
                </div>
              ))
            )}
          </div>

          {/* COLUMN C: MODEL CONTEXT PANEL */}
          <div className="h-full border-l border-[rgba(248,180,217,0.08)] bg-[rgba(15,14,22,0.5)]">
            {selectedModel && (
              <ModelContextPanel
                model={selectedModel}
                make={make}
                cars={cars}
                costs={costs}
                thesis={thesis}
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
