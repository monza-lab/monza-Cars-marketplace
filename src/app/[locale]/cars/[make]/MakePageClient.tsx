"use client"

import { useState, useMemo } from "react"
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
} from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import dynamic from "next/dynamic"

const AdvisorChat = dynamic(
  () => import("@/components/advisor/AdvisorChat").then(mod => mod.AdvisorChat),
  { ssr: false }
)
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

// ─── MAIN COMPONENT ───
export function MakePageClient({ make, cars }: { make: string; cars: CollectorCar[] }) {
  const locale = useLocale()
  const t = useTranslations("makePage")
  const tStatus = useTranslations("status")

  // Filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPriceRange, setSelectedPriceRange] = useState(0)
  const [selectedStatus, setSelectedStatus] = useState("All")
  const [sortBy, setSortBy] = useState("price-desc")
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showAdvisorChat, setShowAdvisorChat] = useState(false)

  // Aggregate cars into models
  const allModels = useMemo(() => aggregateModels(cars), [cars])

  // Filter and sort models
  const filteredModels = useMemo(() => {
    let result = [...allModels]

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(model =>
        model.name.toLowerCase().includes(q) ||
        model.years.includes(q) ||
        model.categories.some(c => c.toLowerCase().includes(q))
      )
    }

    // Price range filter
    const priceRange = priceRanges[selectedPriceRange]
    if (priceRange.min > 0 || priceRange.max < Infinity) {
      result = result.filter(model =>
        model.priceMax >= priceRange.min && model.priceMin < priceRange.max
      )
    }

    // Status filter
    if (selectedStatus === "Live") {
      result = result.filter(model => model.liveCount > 0)
    } else if (selectedStatus === "Ended") {
      result = result.filter(model => model.liveCount === 0)
    }

    // Sort
    switch (sortBy) {
      case "price-desc":
        result.sort((a, b) => b.priceMax - a.priceMax)
        break
      case "price-asc":
        result.sort((a, b) => a.priceMin - b.priceMin)
        break
      case "year-desc":
        result.sort((a, b) => parseInt(b.years.split("–")[0]) - parseInt(a.years.split("–")[0]))
        break
      case "year-asc":
        result.sort((a, b) => parseInt(a.years.split("–")[0]) - parseInt(b.years.split("–")[0]))
        break
      case "count-desc":
        result.sort((a, b) => b.carCount - a.carCount)
        break
    }

    return result
  }, [allModels, searchQuery, selectedPriceRange, selectedStatus, sortBy])

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (selectedPriceRange !== 0) count++
    if (selectedStatus !== "All") count++
    return count
  }, [selectedPriceRange, selectedStatus])

  // Real aggregate data from actual listings
  const totalValue = cars.reduce((sum, c) => sum + c.currentBid, 0)
  const liveCount = cars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON").length
  const soldCount = cars.filter(c => c.status === "ENDED").length
  const minPrice = Math.min(...cars.map(c => c.currentBid))
  const maxPrice = Math.max(...cars.map(c => c.currentBid))

  // Get brand data (editorial - to be labeled)
  const thesis = brandThesis[make] || brandThesis.default
  const costs = ownershipCosts[make] || ownershipCosts.default
  const totalAnnualCost = costs.insurance + costs.storage + costs.maintenance

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("")
    setSelectedPriceRange(0)
    setSelectedStatus("All")
    setSortBy("price-desc")
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Hero Section */}
      <div className="relative h-[45vh] min-h-[360px] overflow-hidden">
        <Image
          src={cars[0].image}
          alt={make}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/80 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12">
          <Link
            href="/"
            className="absolute top-24 left-6 md:left-12 flex items-center gap-2 text-[12px] text-[rgba(255,252,247,0.5)] hover:text-[#F8B4D9] transition-colors"
          >
            <ArrowLeft className="size-4" />
            {t("hero.backToCollection")}
          </Link>

          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#F8B4D9]">
                {t("hero.brandCollection")}
              </span>
              {liveCount > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1">
                  <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-medium text-emerald-400">{t("hero.liveCount", { count: liveCount })}</span>
                </span>
              )}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-[#F2F0E9] tracking-tight">
              {make}
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[rgba(255,252,247,0.6)] max-w-xl hidden md:block">
              {thesis.slice(0, 150)}...
            </p>

            <div className="mt-6 flex flex-wrap gap-4 md:gap-6">
              <div>
                <p className="text-[9px] font-medium tracking-[0.2em] uppercase text-[#4B5563]">
                  {t("hero.priceRange")}
                </p>
                <p className="text-2xl md:text-3xl font-bold font-mono text-[#F8B4D9]">
                  {formatPrice(minPrice)} – {formatPrice(maxPrice)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-medium tracking-[0.2em] uppercase text-[#4B5563]">
                  {t("hero.listings")}
                </p>
                <p className="text-2xl md:text-3xl font-bold font-mono text-[#F2F0E9]">
                  {cars.length.toLocaleString(locale)}
                </p>
              </div>
              <div className="hidden md:block">
                <p className="text-[9px] font-medium tracking-[0.2em] uppercase text-[#4B5563]">
                  {t("hero.sold")}
                </p>
                <p className="text-2xl md:text-3xl font-bold font-mono text-[#9CA3AF]">
                  {soldCount.toLocaleString(locale)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar - Sticky */}
      <div className="sticky top-16 z-30 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-12 py-4">
          {/* Desktop Filters */}
          <div className="hidden md:flex items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[#4B5563]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("filters.searchModelsPlaceholder", { make })}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-[13px] text-[#F2F0E9] placeholder:text-[#4B5563] focus:outline-none focus:border-[#F8B4D9]/50"
              />
            </div>

            {/* Price Range Dropdown */}
            <DropdownSelect
              label={t("filters.price")}
              value={selectedPriceRange.toString()}
              options={priceRanges.map((r, i) => ({ label: r.label, value: i.toString() }))}
              onChange={(v) => setSelectedPriceRange(parseInt(v))}
              icon={DollarSign}
            />

            {/* Sort Dropdown */}
            <DropdownSelect
              label={t("filters.sort")}
              value={sortBy}
              options={sortOptions.map((o) => ({ label: t(`sort.${o.key}`), value: o.value }))}
              onChange={setSortBy}
              icon={ArrowUpDown}
            />

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium text-[#F8B4D9] hover:text-[#fce4ec] transition-colors"
              >
                <X className="size-4" />
                {t("filters.clearWithCount", { count: activeFilterCount })}
              </button>
            )}
          </div>

          {/* Mobile Filter Bar */}
          <div className="flex md:hidden items-center gap-3">
            {/* Search */}
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

            {/* Filter Button */}
            <button
              onClick={() => setShowMobileFilters(true)}
              className="relative flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[12px] font-medium text-[#9CA3AF]"
            >
              <SlidersHorizontal className="size-4" />
              {t("filters.filters")}
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 size-5 flex items-center justify-center rounded-full bg-[#F8B4D9] text-[10px] font-bold text-[#050505]">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-12 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar - Desktop Analytics */}
          <div className="hidden lg:block lg:col-span-1 space-y-6">
            {/* Data Source Notice */}
            <div className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <Info className="size-4 text-[#4B5563] mt-0.5 shrink-0" />
              <p className="text-[11px] text-[#9CA3AF]">
                {t("sidebar.dataSource", { count: cars.length })}
              </p>
            </div>

            {/* About This Brand - Editorial */}
            <div className="rounded-2xl bg-[rgba(15,14,22,0.6)] border border-[rgba(248,180,217,0.08)] p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                  {t("sidebar.about", { make })}
                </h2>
                <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[9px] font-medium text-[#4B5563]">
                  {t("sidebar.editorial")}
                </span>
              </div>
              <p className="text-[12px] leading-relaxed text-[rgba(255,252,247,0.7)]">
                {thesis.slice(0, 300)}...
              </p>
            </div>

            {/* Estimated Ownership Costs */}
            <div className="rounded-2xl bg-[rgba(15,14,22,0.6)] border border-[rgba(248,180,217,0.08)] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Wrench className="size-4 text-[#F8B4D9]" />
                    <h2 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                      {t("sidebar.estimatedAnnualCosts")}
                    </h2>
                  </div>
                  <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[9px] font-medium text-[#4B5563]">
                    {t("sidebar.estimates")}
                  </span>
                </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#9CA3AF]">{t("sidebar.insurance")}</span>
                  <span className="text-[11px] font-mono text-[#F2F0E9]">{formatPrice(costs.insurance)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#9CA3AF]">{t("sidebar.storage")}</span>
                  <span className="text-[11px] font-mono text-[#F2F0E9]">{formatPrice(costs.storage)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#9CA3AF]">{t("sidebar.service")}</span>
                  <span className="text-[11px] font-mono text-[#F2F0E9]">{formatPrice(costs.maintenance)}</span>
                </div>
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#9CA3AF]">{t("sidebar.total")}</span>
                  <span className="text-[14px] font-mono font-bold text-[#F8B4D9]">{formatPrice(totalAnnualCost)}{t("sidebar.perYear")}</span>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-[#4B5563]">
                {t("sidebar.costsNote")}
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={() => setShowAdvisorChat(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#F8B4D9] py-3.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-[#050505] hover:bg-[#fce4ec] transition-colors w-full"
            >
              <MessageCircle className="size-4" />
              {t("sidebar.speakWithAdvisor")}
            </button>
          </div>

          {/* Model Grid */}
          <div className="lg:col-span-3">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[13px] font-semibold tracking-[0.1em] uppercase text-[#9CA3AF]">
                  {t("results.modelsTitle", { make })}
                </h2>
                <p className="text-[11px] text-[#4B5563] mt-1">
                  {t("results.summary", {
                    filtered: filteredModels.length,
                    totalModels: allModels.length,
                    totalVehicles: cars.length,
                  })}
                </p>
              </div>
            </div>

            {/* No Results */}
            {filteredModels.length === 0 ? (
              <div className="text-center py-16">
                <Car className="size-12 text-[#4B5563] mx-auto mb-4" />
                <h3 className="text-[15px] font-semibold text-[#F2F0E9] mb-2">
                  {t("empty.title")}
                </h3>
                <p className="text-[13px] text-[#4B5563] mb-6">
                  {t("empty.subtitle")}
                </p>
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 rounded-xl bg-[#F8B4D9] text-[#050505] text-[12px] font-semibold"
                >
                  {t("empty.clearAll")}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatePresence mode="popLayout">
                  {filteredModels.map((model, index) => (
                    <ModelCard key={model.slug} model={model} make={make} index={index} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Sheet */}
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

      {/* Advisor Chat */}
      <AdvisorChat
        open={showAdvisorChat}
        onOpenChange={setShowAdvisorChat}
        initialContext={{ make }}
      />
    </div>
  )
}
