"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"
import {
  ArrowLeft,
  TrendingUp,
  Globe,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Shield,
  Wrench,
  MapPin,
  Car,
  Gauge,
  Cog,
  MessageCircle,
  History,
  AlertTriangle,
  HelpCircle,
  FileText,
  Users,
  Truck,
  CheckCircle2,
  Mail,
  User,
  Lock,
  Coins,
  Download,
  Send,
  BarChart3,
  DollarSign,
} from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import type { DbMarketDataRow, DbComparableRow, DbAnalysisRow, DbSoldRecord } from "@/lib/db/queries"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion, formatRegionalPrice as fmtRegional, toUsd, formatUsd, getFairValueForRegion, resolveRegion, convertFromUsd } from "@/lib/regionPricing"
import { AdvisorChat } from "@/components/advisor/AdvisorChat"
import { MobileCarCTA } from "@/components/mobile"
import { useTokens } from "@/hooks/useTokens"

// ─── MOCK DATA ───
const redFlags: Record<string, string[]> = {
  McLaren: [
    "Central driving position requires specialist knowledge",
    "BMW V12 servicing limited to certified facilities",
    "Gold foil heat shielding integrity critical",
    "Monocoque carbon fiber inspection mandatory",
  ],
  Porsche: [
    "Chain tensioner failure risk on early models",
    "Heat exchanger condition critical; rust inspection required",
    "Galvanized vs non-galvanized body impacts value",
    "Verify matching numbers engine and transmission",
  ],
  Ferrari: [
    "Cam belt service history critical ($5,000+ if overdue)",
    "Sticky interior switches common; verify all electronics",
    "Classiche rejection significantly impacts resale",
    "Exhaust manifold cracks require specialist repair",
  ],
  Lamborghini: [
    "Carburetors require specialized tuning",
    "Clutch replacement labor-intensive (~$8,000+)",
    "Cooling system prone to issues in traffic",
    "Frame susceptible to stress cracks",
  ],
  Nissan: [
    "ATTESA E-TS pump failure common",
    "RB26 head gasket issues if previously tuned",
    "Rust in rear quarters common on JDM imports",
    "Verify legal import status and compliance",
  ],
  default: [
    "Request comprehensive service history",
    "Verify VIN matches title and body panels",
    "Check for evidence of previous accident damage",
    "Confirm mileage with service records",
  ],
}

const sellerQuestions: Record<string, string[]> = {
  McLaren: [
    "Is the original tool kit and owner's documentation complete?",
    "When was the last McLaren Special Operations service?",
    "Has the monocoque been inspected for stress fractures?",
    "What is the history of the BMW engine servicing?",
  ],
  Porsche: [
    "When was the last valve adjustment performed?",
    "Has the vehicle been used in motorsport?",
    "Are the date codes correct on all glass?",
    "Has the transmission been rebuilt?",
  ],
  Ferrari: [
    "Is Classiche certification obtainable?",
    "When was the last cam belt service?",
    "Are all tools and books present?",
    "Has the car ever been repainted?",
  ],
  default: [
    "Is a pre-purchase inspection permitted?",
    "What is the complete service history?",
    "Are there any known mechanical issues?",
    "What is included in the sale?",
  ],
}

const ownershipCosts: Record<string, { insurance: number; storage: number; maintenance: number }> = {
  McLaren: { insurance: 45000, storage: 12000, maintenance: 25000 },
  Porsche: { insurance: 8500, storage: 6000, maintenance: 8000 },
  Ferrari: { insurance: 18000, storage: 8000, maintenance: 15000 },
  Lamborghini: { insurance: 15000, storage: 8000, maintenance: 12000 },
  Nissan: { insurance: 4500, storage: 3600, maintenance: 3500 },
  Toyota: { insurance: 3200, storage: 3600, maintenance: 2500 },
  BMW: { insurance: 3800, storage: 3600, maintenance: 4000 },
  "Mercedes-Benz": { insurance: 6500, storage: 4800, maintenance: 6000 },
  "Aston Martin": { insurance: 8000, storage: 6000, maintenance: 10000 },
  Lexus: { insurance: 6000, storage: 4800, maintenance: 4500 },
  Ford: { insurance: 5500, storage: 4200, maintenance: 4000 },
  Acura: { insurance: 3000, storage: 3600, maintenance: 2800 },
  Jaguar: { insurance: 4500, storage: 4200, maintenance: 5000 },
  default: { insurance: 5000, storage: 4800, maintenance: 5000 },
}

const comparableSales: Record<string, { title: string; price: number; date: string; platform: string; delta: number }[]> = {
  McLaren: [
    { title: "1994 McLaren F1", price: 20_500_000, date: "Aug 2025", platform: "RM Sotheby's", delta: 8 },
    { title: "1995 McLaren F1", price: 19_800_000, date: "May 2025", platform: "Gooding", delta: 5 },
    { title: "1996 McLaren F1", price: 18_200_000, date: "Jan 2025", platform: "Bonhams", delta: -3 },
  ],
  Porsche: [
    { title: "1973 911 Carrera RS 2.7", price: 1_450_000, date: "Oct 2025", platform: "RM Sotheby's", delta: 12 },
    { title: "1973 911 Carrera RS", price: 1_320_000, date: "Jul 2025", platform: "Gooding", delta: 8 },
    { title: "1972 911 2.7 RS", price: 1_180_000, date: "Apr 2025", platform: "BaT", delta: 5 },
  ],
  Ferrari: [
    { title: "1990 Ferrari F40", price: 2_850_000, date: "Nov 2025", platform: "RM Sotheby's", delta: 10 },
    { title: "1989 Ferrari F40", price: 2_650_000, date: "Aug 2025", platform: "Gooding", delta: 7 },
    { title: "1991 Ferrari F40", price: 2_450_000, date: "May 2025", platform: "Bonhams", delta: 3 },
  ],
  default: [
    { title: "Similar Model (Recent)", price: 125_000, date: "Nov 2025", platform: "BaT", delta: 5 },
    { title: "Similar Model (Mid-Year)", price: 118_000, date: "Jul 2025", platform: "C&B", delta: 3 },
  ],
}

const eventsData: Record<string, { name: string; type: string; impact: "positive" | "neutral" | "negative" }[]> = {
  McLaren: [
    { name: "Pebble Beach Concours", type: "Show", impact: "positive" },
    { name: "Gordon Murray Documentary Release", type: "Media", impact: "positive" },
    { name: "McLaren F1 Owners Club Annual Meet", type: "Community", impact: "positive" },
  ],
  Porsche: [
    { name: "Rennsport Reunion", type: "Event", impact: "positive" },
    { name: "Luftgekühlt", type: "Show", impact: "positive" },
    { name: "911 60th Anniversary", type: "Milestone", impact: "positive" },
  ],
  Ferrari: [
    { name: "Ferrari Cavalcade", type: "Event", impact: "positive" },
    { name: "Maranello Factory Tour Program", type: "Experience", impact: "neutral" },
    { name: "Classiche Certification Backlog", type: "Service", impact: "negative" },
  ],
  default: [
    { name: "Monterey Car Week", type: "Event", impact: "positive" },
    { name: "Barrett-Jackson Scottsdale", type: "Auction", impact: "neutral" },
  ],
}

const shippingCosts: Record<string, { domestic: number; euImport: number; ukImport: number }> = {
  McLaren: { domestic: 3500, euImport: 18000, ukImport: 15000 },
  Porsche: { domestic: 1800, euImport: 8500, ukImport: 7000 },
  Ferrari: { domestic: 2500, euImport: 12000, ukImport: 10000 },
  default: { domestic: 1500, euImport: 6000, ukImport: 5000 },
}

// ─── BENCHMARKS (for 5-year return comparison) ───
const BENCHMARKS = [
  { label: "S&P 500", return5y: 42 },
  { label: "Gold", return5y: 28 },
  { label: "Real Estate", return5y: 18 },
]

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

// ─── HELPERS ───
function timeLeft(endTime: Date): string {
  const diff = endTime.getTime() - Date.now()
  if (diff <= 0) return "Ended"
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hrs}h`
  const mins = Math.floor((diff % 3600000) / 60000)
  return `${hrs}h ${mins}m`
}

function findBestRegion(pricing: CollectorCar["fairValueByRegion"]): string {
  const regions = ["US", "EU", "UK", "JP"] as const
  let best: string = "US"
  let bestAvg = Infinity
  for (const r of regions) {
    const p = pricing[r]
    const avg = toUsd((p.low + p.high) / 2, p.currency)
    if (avg < bestAvg) { bestAvg = avg; best = r }
  }
  return best
}

// ─── COLLAPSIBLE SECTION (mobile) ───
function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 border-l-2 border-l-[#F8B4D9]/20 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-[#F8B4D9]">{icon}</div>
          <span className="text-[13px] font-medium text-[#FFFCF7]">{title}</span>
          {badge}
        </div>
        <ChevronDown className={`size-4 text-[#F8B4D9]/40 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 pt-0">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── STAT CARD (mobile) ───
function StatCard({ label, value, icon }: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 border-l-2 border-l-[#F8B4D9]/30 p-4">
      <div className="flex items-center gap-2 text-[#F8B4D9]/60 mb-2">
        {icon}
        <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#9CA3AF]">{label}</span>
      </div>
      <span className="text-[20px] font-bold text-[#FFFCF7]">{value}</span>
    </div>
  )
}

// ─── SIMILAR CAR CARD ───
function SimilarCarCard({ car }: { car: CollectorCar }) {
  const { selectedRegion } = useRegion()
  return (
    <Link
      href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
      className="group flex items-center gap-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-[rgba(248,180,217,0.15)] p-3 transition-all"
    >
      <div className="relative w-20 h-14 rounded-lg overflow-hidden shrink-0">
        <Image
          src={car.image}
          alt={car.title}
          fill
          className="object-cover"
          sizes="80px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#FFFCF7] truncate group-hover:text-[#F8B4D9] transition-colors">
          {car.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[12px] font-mono font-semibold text-[#F8B4D9]">
            {formatPriceForRegion(car.currentBid, selectedRegion)}
          </span>
          <span className="text-[10px] text-emerald-400">{car.trend}</span>
        </div>
      </div>
      <ChevronRight className="size-4 text-[#4B5563] group-hover:text-[#F8B4D9] transition-colors shrink-0" />
    </Link>
  )
}

// ─── SIDEBAR MINI CAR CARD (compact for left sidebar) ───
function SidebarCarCard({ car }: { car: CollectorCar }) {
  const { selectedRegion } = useRegion()
  return (
    <Link
      href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
      className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
    >
      <div className="relative w-14 h-10 rounded-md overflow-hidden shrink-0">
        <Image
          src={car.image}
          alt={car.title}
          fill
          className="object-cover"
          sizes="56px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[#D1D5DB] truncate group-hover:text-[#F8B4D9] transition-colors">
          {car.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] font-mono font-semibold text-[#F8B4D9]">
            {formatPriceForRegion(car.currentBid, selectedRegion)}
          </span>
          <span className={`text-[9px] font-bold ${
            car.investmentGrade === "AAA" ? "text-emerald-400" : car.investmentGrade === "AA" ? "text-blue-400" : "text-amber-400"
          }`}>{car.investmentGrade}</span>
        </div>
      </div>
    </Link>
  )
}

// ═══════════════════════════════════════════════════════════════
// ─── LEFT SIDEBAR (Desktop) — "Investment Passport"
// ═══════════════════════════════════════════════════════════════
function CarNavSidebar({
  car,
  similarCars,
}: {
  car: CollectorCar
  similarCars: CollectorCar[]
}) {
  const locale = useLocale()
  const { selectedRegion, effectiveRegion, currency } = useRegion()
  const isLive = car.status === "ACTIVE" || car.status === "ENDING_SOON"
  const flags = redFlags[car.make] || redFlags.default
  const platform = platformLabels[car.platform]

  // Market position: where current price sits within selected region's fair value range
  const regionRange = getFairValueForRegion(car.fairValueByRegion, selectedRegion)
  const fairLow = regionRange.low
  const fairHigh = regionRange.high
  // Convert currentBid (USD) to regional currency for comparison
  const bidInRegion = convertFromUsd(car.currentBid, regionRange.currency)
  const pricePosition = fairHigh > fairLow
    ? Math.min(Math.max(((bidInRegion - fairLow) / (fairHigh - fairLow)) * 100, 0), 100)
    : 50
  const isBelowFair = bidInRegion < (fairLow + fairHigh) / 2
  const priceLabel = car.status === "ENDED" ? "Sold for" : isLive ? "Current Bid" : "Est. Value"

  return (
    <div className="h-full flex flex-col overflow-hidden border-r border-white/5">
      {/* ── Back nav ── */}
      <div className="px-4 pt-3 pb-1 shrink-0">
        <Link
          href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}`}
          className="inline-flex items-center gap-1.5 text-[10px] text-[#6B7280] hover:text-[#F8B4D9] transition-colors"
        >
          <ArrowLeft className="size-3" />
          {car.make}
        </Link>
      </div>

      {/* ── Identity: title + grade + trend ── */}
      <div className="px-4 pb-3 shrink-0 border-b border-white/5">
        <h2 className="text-[12px] font-semibold text-[#FFFCF7] leading-tight">{car.title}</h2>
        <div className="flex items-center gap-2 mt-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            car.investmentGrade === "AAA"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-400/20"
              : car.investmentGrade === "AA"
                ? "bg-blue-500/15 text-blue-400 border border-blue-400/20"
                : "bg-amber-500/15 text-amber-400 border border-amber-400/20"
          }`}>{car.investmentGrade}</span>
          <span className={`text-[11px] font-mono font-semibold ${
            car.trendValue > 0 ? "text-emerald-400" : car.trendValue < 0 ? "text-red-400" : "text-[#6B7280]"
          }`}>
            {car.trendValue > 0 ? "+" : ""}{car.trendValue}% {car.trendValue > 0 ? "↑" : car.trendValue < 0 ? "↓" : "→"}
          </span>
        </div>
      </div>

      {/* ── Price ── */}
      <div className="px-4 py-3 shrink-0 border-b border-white/5">
        <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">{priceLabel}</span>
        <p className="text-[20px] font-mono font-bold text-[#F8B4D9] mt-0.5">{formatPriceForRegion(car.currentBid, selectedRegion)}</p>
      </div>

      {/* ── Market Position (always visible) ── */}
      <div className="px-4 py-3 shrink-0 border-b border-white/5">
        <span className="text-[8px] font-semibold tracking-[0.2em] uppercase text-[#6B7280] mb-2 block">Market Position</span>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono text-[#9CA3AF]">{fmtRegional(fairLow, regionRange.currency)}</span>
          <span className="text-[9px] text-[#6B7280]">Fair Value Range ({effectiveRegion})</span>
          <span className="text-[10px] font-mono text-[#9CA3AF]">{fmtRegional(fairHigh, regionRange.currency)}</span>
        </div>
        {/* Position bar */}
        <div className="relative h-[8px] rounded-full bg-white/[0.04] overflow-hidden">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400/20 via-[#F8B4D9]/20 to-red-400/20" />
          {/* Indicator dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 size-[10px] rounded-full bg-[#F8B4D9] border-2 border-[#0b0b10] shadow-lg shadow-[#F8B4D9]/30"
            style={{ left: `calc(${pricePosition}% - 5px)` }}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          {isBelowFair ? (
            <>
              <CheckCircle2 className="size-3 text-emerald-400" />
              <span className="text-[10px] font-medium text-emerald-400">Below market average</span>
            </>
          ) : (
            <>
              <TrendingUp className="size-3 text-amber-400" />
              <span className="text-[10px] font-medium text-amber-400">Above market average</span>
            </>
          )}
        </div>
      </div>

      {/* ── Live Auction block (CONDITIONAL) ── */}
      {isLive && (
        <div className="mx-3 my-3 shrink-0 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Live Auction</span>
          </div>
          <div className="flex items-center gap-3">
            {platform && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold ${platform.color}`}>
                {platform.short}
              </span>
            )}
            <span className="text-[11px] text-[#D1D5DB]">{car.bidCount} bids</span>
            <span className="text-[11px] font-mono text-amber-400">{timeLeft(car.endTime)}</span>
          </div>
        </div>
      )}

      {/* ── Sold / Platform info (when NOT live) ── */}
      {!isLive && car.status === "ENDED" && (
        <div className="mx-3 my-3 shrink-0 rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {platform && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold ${platform.color}`}>
                  {platform.short}
                </span>
              )}
              <span className="text-[10px] text-[#9CA3AF]">{car.bidCount} bids</span>
            </div>
            <span className="text-[10px] font-medium text-[#6B7280]">Sold</span>
          </div>
        </div>
      )}

      {/* ── Specs ── */}
      <div className="px-4 py-3 shrink-0 border-b border-white/5">
        <span className="text-[8px] font-semibold tracking-[0.2em] uppercase text-[#6B7280] mb-2 block">Vehicle</span>
        <div className="space-y-1.5">
          {[
            { icon: <Gauge className="size-3.5" />, value: `${car.mileage.toLocaleString(locale)} ${car.mileageUnit}` },
            { icon: <Cog className="size-3.5" />, value: car.engine },
            { icon: <Cog className="size-3.5" />, value: car.transmission },
            { icon: <MapPin className="size-3.5" />, value: car.location },
          ].map((spec, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[#6B7280]">{spec.icon}</span>
              <span className="text-[11px] text-[#D1D5DB] truncate">{spec.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Risk / Inspection ── */}
      <div className="px-4 py-3 shrink-0 border-b border-white/5">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="size-3.5 text-amber-400" />
          <span className="text-[10px] font-semibold text-[#D1D5DB]">{flags.length} inspection points</span>
        </div>
        <p className="text-[10px] text-[#6B7280] leading-relaxed pl-[22px]">
          {flags[0]}
        </p>
      </div>

      {/* ── Similar vehicles (scrollable) ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <span className="text-[8px] font-semibold tracking-[0.2em] uppercase text-[#6B7280]">
            Similar · {similarCars.length}
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-2">
          <div className="space-y-1 pb-4">
            {similarCars.map(c => (
              <SidebarCarCard key={c.id} car={c} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ─── RIGHT PANEL (Desktop) ───
// ═══════════════════════════════════════════════════════════════
function CarContextPanel({
  car,
  onOpenAdvisor,
  dbAnalysis,
  dbSoldHistory = [],
}: {
  car: CollectorCar
  onOpenAdvisor: () => void
  dbAnalysis?: DbAnalysisRow | null
  dbSoldHistory?: DbSoldRecord[]
}) {
  const { selectedRegion, effectiveRegion } = useRegion()
  const fallbackCosts = ownershipCosts[car.make] || ownershipCosts.default
  const costs = {
    insurance: dbAnalysis?.insuranceEstimate ?? fallbackCosts.insurance,
    storage: fallbackCosts.storage,
    maintenance: dbAnalysis?.yearlyMaintenance ?? fallbackCosts.maintenance,
  }
  const totalAnnualCost = costs.insurance + costs.storage + costs.maintenance
  const shipping = shippingCosts[car.make] || shippingCosts.default
  const events = eventsData[car.make] || eventsData.default

  // Regional pricing from real data
  const pricing = car.fairValueByRegion
  const bestRegion = findBestRegion(pricing)
  const maxRegionalUsd = Math.max(
    ...((["US", "EU", "UK", "JP"] as const).map(r =>
      toUsd((pricing[r].low + pricing[r].high) / 2, pricing[r].currency)
    ))
  )

  // 5-year return data: prefer DB sold records
  const priceHistory = (() => {
    if (dbSoldHistory.length >= 3) {
      const now = new Date()
      const years = [0, 1, 2, 3, 4].map(i => now.getFullYear() - 4 + i)
      const buckets = years.map(yr => {
        const sales = dbSoldHistory.filter(s => new Date(s.date).getFullYear() === yr)
        return sales.length > 0 ? Math.round(sales.reduce((sum, s) => sum + s.price, 0) / sales.length) : null
      })
      const filled = [...buckets]
      for (let i = 0; i < filled.length; i++) {
        if (filled[i] == null) {
          const prev = filled.slice(0, i).reverse().find(v => v != null)
          const next = filled.slice(i + 1).find(v => v != null)
          filled[i] = prev ?? next ?? car.currentBid
        }
      }
      return filled as number[]
    }
    return mockPriceHistory[car.make] || mockPriceHistory.default
  })()
  const brand5yReturn = Math.round(((priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0]) * 100)

  return (
    <div className="h-full flex flex-col overflow-hidden border-l border-white/5">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">

        {/* 1. INVESTMENT GRADE + PRICE */}
        <div className="px-5 py-3 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">Grade</span>
              <p className={`text-[16px] font-bold ${
                car.investmentGrade === "AAA" ? "text-emerald-400" : "text-[#F8B4D9]"
              }`}>{car.investmentGrade}</p>
            </div>
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">
                {car.status === "ENDED" ? "Sold" : "Bid"}
              </span>
              <p className="text-[13px] font-mono font-semibold text-[#FFFCF7]">{formatPriceForRegion(car.currentBid, selectedRegion)}</p>
            </div>
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">Trend</span>
              <p className="text-[13px] font-mono font-semibold text-emerald-400">{car.trend}</p>
            </div>
          </div>
        </div>

        {/* 2. VALUATION BY MARKET */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Valuation by Market
            </span>
          </div>
          <div className="space-y-2.5">
            {(["US", "UK", "EU", "JP"] as const).map(region => {
              const rp = pricing[region]
              const isBest = bestRegion === region
              const isSelected = region === effectiveRegion
              const usdAvg = toUsd((rp.low + rp.high) / 2, rp.currency)
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
                        {fmtRegional(rp.low, rp.currency)}
                      </span>
                      <span className="text-[9px] text-[#6B7280]">→</span>
                      <span className={`text-[11px] font-mono font-semibold ${isBest ? "text-emerald-400" : "text-[#F8B4D9]"}`}>
                        {fmtRegional(rp.high, rp.currency)}
                      </span>
                    </div>
                  </div>
                  {region !== effectiveRegion && (
                    <div className="flex justify-end mb-1">
                      <span className="text-[9px] font-mono text-[#6B7280]">
                        ≈ {formatUsd(toUsd(rp.high, rp.currency))} USD
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

        {/* 3. 5-YEAR RETURN COMPARISON */}
        <div className="px-5 py-4 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              5-Year Return Comparison
            </span>
          </div>
          <div className="space-y-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-[#F8B4D9]">{car.make}</span>
                <span className="text-[11px] font-mono font-bold text-emerald-400">+{brand5yReturn}%</span>
              </div>
              <div className="h-[8px] rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full rounded-full bg-[#F8B4D9]/50" style={{ width: `${Math.min((brand5yReturn / Math.max(brand5yReturn, 50)) * 100, 100)}%` }} />
              </div>
            </div>
            {BENCHMARKS.map((b) => (
              <div key={b.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[#9CA3AF]">{b.label}</span>
                  <span className="text-[11px] font-mono text-[#6B7280]">+{b.return5y}%</span>
                </div>
                <div className="h-[8px] rounded-full bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded-full bg-white/10" style={{ width: `${Math.min((b.return5y / Math.max(brand5yReturn, 50)) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. 5-YEAR PRICE TREND */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-[#F8B4D9]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                5-Year Price Trend
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold text-emerald-400">
              +{brand5yReturn}%
            </span>
          </div>
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

        {/* 5. ANNUAL OWNERSHIP COST */}
        <div className="px-5 py-4 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
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

        {/* 6. SHIPPING COSTS */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Shipping Estimates
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: "Domestic (Enclosed)", value: shipping.domestic },
              { label: "EU Import", value: shipping.euImport },
              { label: "UK Import", value: shipping.ukImport },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[11px] text-[#9CA3AF]">{item.label}</span>
                <span className="text-[11px] font-mono text-[#D1D5DB]">{formatPriceForRegion(item.value, selectedRegion)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 7. EVENTS & COMMUNITY */}
        <div className="px-5 py-4 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="flex items-center gap-2 mb-3">
            <Users className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Events & Community
            </span>
          </div>
          <div className="space-y-2">
            {events.map((event, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`size-1.5 rounded-full ${
                    event.impact === "positive" ? "bg-emerald-400" :
                    event.impact === "negative" ? "bg-red-400" : "bg-[#4B5563]"
                  }`} />
                  <span className="text-[11px] text-[#D1D5DB]">{event.name}</span>
                </div>
                <span className={`text-[9px] font-semibold ${
                  event.impact === "positive" ? "text-emerald-400" :
                  event.impact === "negative" ? "text-red-400" : "text-[#6B7280]"
                }`}>
                  {event.impact === "positive" ? "+" : event.impact === "negative" ? "−" : "~"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA pinned bottom */}
      <div className="shrink-0 p-4 border-t border-white/5">
        <button
          onClick={onOpenAdvisor}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F8B4D9] py-3 text-[11px] font-semibold uppercase tracking-wider text-[#0b0b10] hover:bg-[#f4cbde] transition-colors"
        >
          <MessageCircle className="size-4" />
          Speak with Advisor
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ─── MAIN COMPONENT ───
// ═══════════════════════════════════════════════════════════════
export function CarDetailClient({ car, similarCars, dbMarketData, dbComparables = [], dbAnalysis, dbSoldHistory = [] }: {
  car: CollectorCar
  similarCars: CollectorCar[]
  dbMarketData?: DbMarketDataRow | null
  dbComparables?: DbComparableRow[]
  dbAnalysis?: DbAnalysisRow | null
  dbSoldHistory?: DbSoldRecord[]
}) {
  const locale = useLocale()
  const t = useTranslations("carDetail")
  const tAuction = useTranslations("auctionDetail")
  const tStatus = useTranslations("status")
  const { selectedRegion, effectiveRegion } = useRegion()


  const [showSticky, setShowSticky] = useState(false)
  const [showAdvisorChat, setShowAdvisorChat] = useState(false)
  const [gateName, setGateName] = useState("")
  const [gateEmail, setGateEmail] = useState("")
  const [gateErrors, setGateErrors] = useState<{ name?: boolean; email?: boolean }>({})
  const [showWelcome, setShowWelcome] = useState(false)
  const [showAnalysisPopup, setShowAnalysisPopup] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [analysisSent, setAnalysisSent] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  // Token system
  const {
    user,
    isRegistered,
    isLoading: tokensLoading,
    tokens,
    analysesRemaining,
    register,
    consumeForAnalysis,
    hasAnalyzed,
  } = useTokens()

  // Registration gate: only shown if user is not registered
  const showRegistrationGate = !tokensLoading && !isRegistered

  const handleGateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: { name?: boolean; email?: boolean } = {}
    if (!gateName.trim()) newErrors.name = true
    if (!gateEmail.trim() || !gateEmail.includes("@")) newErrors.email = true
    if (Object.keys(newErrors).length > 0) {
      setGateErrors(newErrors)
      return
    }
    register(gateName.trim(), gateEmail.trim())
    setShowWelcome(true)
  }

  const handleGoogleSignIn = () => {
    register("Google User", "user@gmail.com")
    setShowWelcome(true)
  }

  // "Generate Full Analysis" CTA handler
  const handleGenerateAnalysis = () => {
    if (hasAnalyzed(car.id)) {
      setShowAnalysisPopup(true)
      return
    }
    const success = consumeForAnalysis(car.id)
    if (success) {
      setShowAnalysisPopup(true)
    } else {
      setShowPaywall(true)
    }
  }

  // Send analysis by email (frontend-only simulation)
  const handleSendAnalysis = () => {
    setAnalysisSent(true)
    setTimeout(() => {
      setAnalysisSent(false)
      setShowAnalysisPopup(false)
    }, 2500)
  }

  const isLive = car.status === "ACTIVE" || car.status === "ENDING_SOON"

  // ─── Use DB analysis data when available, fallback to hardcoded ───
  const flags = (dbAnalysis?.redFlags?.length ?? 0) > 0
    ? dbAnalysis!.redFlags : (redFlags[car.make] || redFlags.default)
  const questions = (dbAnalysis?.criticalQuestions?.length ?? 0) > 0
    ? dbAnalysis!.criticalQuestions : (sellerQuestions[car.make] || sellerQuestions.default)

  // Ownership costs: prefer DB analysis, fallback to hardcoded
  const fallbackCosts = ownershipCosts[car.make] || ownershipCosts.default
  const costs = {
    insurance: dbAnalysis?.insuranceEstimate ?? fallbackCosts.insurance,
    storage: fallbackCosts.storage,
    maintenance: dbAnalysis?.yearlyMaintenance ?? fallbackCosts.maintenance,
  }

  // Comparable sales: prefer DB, fallback to hardcoded
  const comps = dbComparables.length > 0
    ? dbComparables.map(c => ({
        title: c.title,
        price: c.soldPrice,
        date: c.soldDate ? new Date(c.soldDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "N/A",
        platform: c.platform === "BRING_A_TRAILER" ? "BaT" : c.platform === "CARS_AND_BIDS" ? "C&B" : c.platform === "COLLECTING_CARS" ? "CC" : c.platform,
        delta: dbMarketData?.avgPrice ? Math.round(((c.soldPrice - dbMarketData.avgPrice) / dbMarketData.avgPrice) * 100) : 0,
      }))
    : (comparableSales[car.make] || comparableSales.default)

  const events = eventsData[car.make] || eventsData.default
  const shipping = shippingCosts[car.make] || shippingCosts.default
  const totalAnnualCost = costs.insurance + costs.storage + costs.maintenance

  // ─── Investment Passport computations (for mobile) ───
  // Fair value: prefer DB market data, fallback to car's fairValueByRegion
  const regionRange = getFairValueForRegion(car.fairValueByRegion, selectedRegion)
  const fairLow = dbMarketData?.lowPrice ?? regionRange.low
  const fairHigh = dbMarketData?.highPrice ?? regionRange.high
  const bidInRegion = convertFromUsd(car.currentBid, regionRange.currency)
  const pricePosition = fairHigh > fairLow
    ? Math.min(Math.max(((bidInRegion - fairLow) / (fairHigh - fairLow)) * 100, 0), 100) : 50
  const isBelowFair = bidInRegion < (fairLow + fairHigh) / 2

  const pricing = car.fairValueByRegion
  const bestRegion = findBestRegion(pricing)
  const maxRegionalUsd = Math.max(
    ...((["US", "EU", "UK", "JP"] as const).map(r =>
      toUsd((pricing[r].low + pricing[r].high) / 2, pricing[r].currency)
    ))
  )

  // Price history: prefer DB sold records, fallback to hardcoded
  const priceHistory = (() => {
    if (dbSoldHistory.length >= 3) {
      const now = new Date()
      const years = [0, 1, 2, 3, 4].map(i => now.getFullYear() - 4 + i)
      const buckets = years.map(yr => {
        const sales = dbSoldHistory.filter(s => new Date(s.date).getFullYear() === yr)
        return sales.length > 0 ? Math.round(sales.reduce((sum, s) => sum + s.price, 0) / sales.length) : null
      })
      const filled = [...buckets]
      for (let i = 0; i < filled.length; i++) {
        if (filled[i] == null) {
          const prev = filled.slice(0, i).reverse().find(v => v != null)
          const next = filled.slice(i + 1).find(v => v != null)
          filled[i] = prev ?? next ?? car.currentBid
        }
      }
      return filled as number[]
    }
    return mockPriceHistory[car.make] || mockPriceHistory.default
  })()
  const brand5yReturn = Math.round(((priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0]) * 100)

  // Scroll handler for mobile sticky bar
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const heroBottom = heroRef.current.getBoundingClientRect().bottom
        setShowSticky(heroBottom < 80)
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Lock body scroll when registration gate is shown
  useEffect(() => {
    if (showRegistrationGate) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [showRegistrationGate])

  return (
    <div className="min-h-screen bg-[#0b0b10]">
      {/* ═══════════════════════════════════════════════════════════
          MOBILE LAYOUT — Investment Passport + Continuous Scroll
          ═══════════════════════════════════════════════════════════ */}
      <div className="md:hidden">
        {/* ═══ STICKY SUMMARY BAR ═══ */}
        <AnimatePresence>
          {showSticky && (
            <motion.div
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className="fixed top-0 left-0 right-0 z-50 bg-[#0b0b10]/95 backdrop-blur-xl border-b border-white/5"
            >
              <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Link
                    href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}`}
                    className="text-[#4B5563] hover:text-[#F8B4D9] transition-colors"
                  >
                    <ArrowLeft className="size-5" />
                  </Link>
                  <div>
                    <h1 className="text-[14px] font-semibold text-[#FFFCF7]">{car.title}</h1>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[18px] font-bold font-mono text-[#F8B4D9]">
                        {formatPriceForRegion(car.currentBid, selectedRegion)}
                      </span>
                      <span className="text-[10px] text-[#4B5563]">
                        {car.status === "ENDED" ? "sold" : "current bid"}
                      </span>
                    </div>
                  </div>
                </div>
                <a
                  href={`https://wa.me/573208492641?text=${encodeURIComponent(
                    `Hola, estoy interesado en el ${car.title} en Monza Lab.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-full bg-[#F8B4D9] px-5 py-2 text-[11px] font-semibold uppercase text-[#0b0b10] hover:bg-[#f4cbde] transition-colors"
                >
                  <MessageCircle className="size-4" />
                  Contact
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ HERO SECTION ═══ */}
        <div ref={heroRef} className="relative h-[40dvh] min-h-[340px]">
          <Image src={car.image} alt={car.title} fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-[#0b0b10]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b10]/70 to-transparent" />

          {/* Navigation */}
          <div className="absolute top-24 left-0 right-0 px-6">
            <Link
              href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}`}
              className="inline-flex items-center gap-2 text-[12px] text-white/50 hover:text-[#F8B4D9] transition-colors"
            >
              <ArrowLeft className="size-4" />
              {t("backTo", { make: car.make })}
            </Link>
          </div>

          {/* Badges */}
          <div className="absolute top-24 right-6 flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md ${
              car.investmentGrade === "AAA"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-400/30"
                : "bg-[#F8B4D9]/20 text-[#F8B4D9] border border-[#F8B4D9]/30"
            }`}>{car.investmentGrade}</span>
            {isLive && (
              <div className="flex items-center gap-1.5 rounded-full bg-[#0b0b10]/80 backdrop-blur-md px-3 py-1.5">
                <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-medium text-emerald-400">LIVE</span>
              </div>
            )}
            <div className="rounded-full px-3 py-1.5 text-[10px] font-medium backdrop-blur-md bg-white/10 text-white/70 border border-white/10">
              {car.platform.replace(/_/g, " ")}
            </div>
          </div>

          {/* Title & Quick Stats */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pb-10">
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#F8B4D9]">
              {car.category}
            </span>
            <h1 className="mt-2 text-3xl font-bold text-[#FFFCF7] tracking-tight">{car.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">
                  {car.status === "ENDED" ? t("soldFor") : t("currentBid")}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold font-mono text-[#F8B4D9]">
                    {formatPriceForRegion(car.currentBid, selectedRegion)}
                  </p>
                  <span className="text-[12px] font-mono font-semibold text-emerald-400">{car.trend}</span>
                </div>
              </div>
              {isLive && (
                <>
                  <div className="h-8 w-px bg-white/10" />
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">{t("timeLeft")}</p>
                    <p className="text-xl font-bold text-amber-400 font-mono">{timeLeft(car.endTime)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ═══ INVESTMENT PASSPORT ═══ */}
        <div className="relative z-10 -mt-6 mx-4">
          <div className="rounded-2xl bg-[rgba(15,14,22,0.9)] backdrop-blur-xl border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-4 text-[#F8B4D9]" />
              <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-[#F8B4D9]">
                {t("investmentPassport.title")}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Cell 1: Grade */}
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <span className="text-[9px] text-[#6B7280] uppercase tracking-wider block mb-1">
                  {t("investmentPassport.grade")}
                </span>
                <span className={`text-[24px] font-bold ${
                  car.investmentGrade === "AAA" ? "text-emerald-400"
                  : car.investmentGrade === "AA" ? "text-[#F8B4D9]"
                  : "text-amber-400"
                }`}>{car.investmentGrade}</span>
              </div>

              {/* Cell 2: Market Position */}
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <span className="text-[9px] text-[#6B7280] uppercase tracking-wider block mb-1">
                  {t("investmentPassport.marketPosition")}
                </span>
                <div className="relative h-[6px] rounded-full bg-white/[0.04] overflow-hidden mt-2 mb-1.5">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400/20 via-[#F8B4D9]/20 to-red-400/20" />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 size-[8px] rounded-full bg-[#F8B4D9] border-2 border-[#0b0b10] shadow-lg shadow-[#F8B4D9]/30"
                    style={{ left: `calc(${pricePosition}% - 4px)` }}
                  />
                </div>
                <span className={`text-[10px] font-medium ${isBelowFair ? "text-emerald-400" : "text-amber-400"}`}>
                  {isBelowFair ? t("investmentPassport.belowMarket") : t("investmentPassport.aboveMarket")}
                </span>
              </div>

              {/* Cell 3: 5yr Return */}
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <span className="text-[9px] text-[#6B7280] uppercase tracking-wider block mb-1">
                  {t("investmentPassport.fiveYearReturn")}
                </span>
                <span className="text-[24px] font-bold font-mono text-emerald-400">+{brand5yReturn}%</span>
              </div>

              {/* Cell 4: Annual Cost */}
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <span className="text-[9px] text-[#6B7280] uppercase tracking-wider block mb-1">
                  {t("investmentPassport.annualCost")}
                </span>
                <span className="text-[20px] font-bold font-mono text-[#FFFCF7]">
                  {formatPriceForRegion(totalAnnualCost, selectedRegion)}
                </span>
                <span className="text-[10px] text-[#6B7280]">/yr</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ CONTINUOUS SCROLL CONTENT ═══ */}
        <div className="px-4 py-6 space-y-4 pb-32">

          {/* 1. About This Vehicle */}
          <div className="rounded-2xl bg-[rgba(248,180,217,0.06)] border border-[rgba(248,180,217,0.15)] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-[#F8B4D9]" />
                <h2 className="text-[13px] font-semibold text-[#F8B4D9]">{t("aboutThisVehicle")}</h2>
              </div>
              <span className="text-[9px] text-[#F8B4D9]/50 bg-[rgba(248,180,217,0.08)] px-2 py-0.5 rounded">{t("editorial")}</span>
            </div>
            <p className="text-[14px] leading-relaxed text-[#D1D5DB]">{car.thesis}</p>
          </div>

          {/* 2. Vehicle Specs */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label={tAuction("specs.mileage")} value={`${car.mileage.toLocaleString(locale)} ${car.mileageUnit}`} icon={<Gauge className="size-4" />} />
            <StatCard label={tAuction("specs.engine")} value={car.engine} icon={<Cog className="size-4" />} />
            <StatCard label={tAuction("specs.transmission")} value={car.transmission} icon={<Cog className="size-4" />} />
            <StatCard label={tAuction("specs.location")} value={car.location} icon={<MapPin className="size-4" />} />
          </div>

          {/* 3. Seller's Description */}
          <CollapsibleSection title={t("sellersDescription")} icon={<History className="size-5" />} defaultOpen>
            <div className="border-l-2 border-[#F8B4D9]/20 pl-4">
              <p className="text-[13px] text-[#D1D5DB] leading-relaxed">{car.history}</p>
            </div>
            <p className="text-[10px] text-[#4B5563] mt-3 italic">{t("source", { platform: car.platform.replace(/_/g, " ") })}</p>
          </CollapsibleSection>

          {/* 4. Regional Valuation */}
          <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="size-4 text-[#F8B4D9]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                {t("regionalValuation")}
              </span>
            </div>
            <div className="space-y-2.5">
              {(["US", "UK", "EU", "JP"] as const).map(region => {
                const rp = pricing[region]
                const isBest = bestRegion === region
                const isSelected = region === effectiveRegion
                const usdAvg = toUsd((rp.low + rp.high) / 2, rp.currency)
                const barWidth = (usdAvg / maxRegionalUsd) * 100
                return (
                  <div key={region} className={isSelected ? "rounded-lg bg-[rgba(248,180,217,0.04)] -mx-2 px-2 py-1.5" : ""}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px]">{regionLabels[region].flag}</span>
                        <span className={`text-[11px] font-medium ${isSelected ? "text-[#F8B4D9]" : "text-[#D1D5DB]"}`}>{region}</span>
                        {isBest && <span className="text-[8px] font-bold text-emerald-400 tracking-wide">BEST</span>}
                        {isSelected && <span className="text-[8px] font-bold text-[#F8B4D9] tracking-wide">YOUR MARKET</span>}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[11px] font-mono font-semibold text-[#FFFCF7]">
                          {fmtRegional(rp.low, rp.currency)}
                        </span>
                        <span className="text-[9px] text-[#6B7280]">→</span>
                        <span className={`text-[11px] font-mono font-semibold ${isBest ? "text-emerald-400" : "text-[#F8B4D9]"}`}>
                          {fmtRegional(rp.high, rp.currency)}
                        </span>
                      </div>
                    </div>
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

          {/* 5. 5-Year Return Comparison */}
          <div className="rounded-xl bg-[rgba(248,180,217,0.03)] border border-white/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="size-4 text-[#F8B4D9]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                {t("fiveYearReturnComparison")}
              </span>
            </div>
            <div className="space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-[#F8B4D9]">{car.make}</span>
                  <span className="text-[11px] font-mono font-bold text-emerald-400">+{brand5yReturn}%</span>
                </div>
                <div className="h-[8px] rounded-full bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded-full bg-[#F8B4D9]/50" style={{ width: `${Math.min((brand5yReturn / Math.max(brand5yReturn, 50)) * 100, 100)}%` }} />
                </div>
              </div>
              {BENCHMARKS.map((b) => (
                <div key={b.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-[#9CA3AF]">{b.label}</span>
                    <span className="text-[11px] font-mono text-[#6B7280]">+{b.return5y}%</span>
                  </div>
                  <div className="h-[8px] rounded-full bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded-full bg-white/10" style={{ width: `${Math.min((b.return5y / Math.max(brand5yReturn, 50)) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. 5-Year Price Trend */}
          <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-[#F8B4D9]" />
                <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                  {t("priceTrend")}
                </span>
              </div>
              <span className="text-[10px] font-mono font-semibold text-emerald-400">+{brand5yReturn}%</span>
            </div>
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

          {/* 7. Sale Information */}
          <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="size-4 text-[#F8B4D9]" />
              <h2 className="text-[13px] font-semibold text-[#FFFCF7]">{t("saleInformation")}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3 bg-white/[0.02] border border-white/5">
                <p className="text-[10px] text-[#4B5563] uppercase tracking-wider mb-1">{t("platform")}</p>
                <p className="text-[14px] font-semibold text-[#FFFCF7]">{car.platform.replace(/_/g, " ")}</p>
              </div>
              <div className="rounded-xl p-3 bg-white/[0.02] border border-white/5">
                <p className="text-[10px] text-[#4B5563] uppercase tracking-wider mb-1">
                  {car.status === "ENDED" ? t("soldFor") : t("currentBid")}
                </p>
                <p className="text-[14px] font-bold font-mono text-[#F8B4D9]">{formatPriceForRegion(car.currentBid, selectedRegion)}</p>
              </div>
              <div className="rounded-xl p-3 bg-white/[0.02] border border-white/5">
                <p className="text-[10px] text-[#4B5563] uppercase tracking-wider mb-1">{t("bids")}</p>
                <p className="text-[14px] font-semibold text-[#FFFCF7]">{car.bidCount}</p>
              </div>
              <div className="rounded-xl p-3 bg-white/[0.02] border border-white/5">
                <p className="text-[10px] text-[#4B5563] uppercase tracking-wider mb-1">{t("status")}</p>
                <p className={`text-[14px] font-semibold ${car.status === "ACTIVE" || car.status === "ENDING_SOON" ? "text-emerald-400" : "text-[#9CA3AF]"}`}>
                  {car.status === "ENDED" ? tStatus("sold") : car.status === "ENDING_SOON" ? tStatus("endingSoon") : tStatus("active")}
                </p>
              </div>
            </div>
          </div>

          {/* 8. Key Inspection Points */}
          <CollapsibleSection
            title={t("keyInspectionPoints")}
            icon={<AlertTriangle className="size-5" />}
            defaultOpen
            badge={<span className="text-[10px] text-[#F8B4D9]/60 bg-[rgba(248,180,217,0.1)] px-2 py-0.5 rounded-full">{flags.length} items</span>}
          >
            <div className="space-y-2">
              {flags.map((flag, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(248,180,217,0.03)]">
                  <AlertTriangle className="size-4 text-[#F8B4D9] mt-0.5 shrink-0" />
                  <span className="text-[13px] text-[#FFFCF7]">{flag}</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* 9. Questions to Ask Seller */}
          <CollapsibleSection
            title={t("questionsToAsk")}
            icon={<HelpCircle className="size-5" />}
            badge={<span className="text-[10px] text-[#9CA3AF] bg-white/5 px-2 py-0.5 rounded-full">{questions.length}</span>}
          >
            <div className="space-y-2">
              {questions.map((q, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                  <span className="flex items-center justify-center size-5 rounded-full bg-[#F8B4D9]/10 text-[10px] font-bold text-[#F8B4D9] shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-[13px] text-[#9CA3AF]">{q}</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* 10. Pre-Purchase Inspection */}
          <CollapsibleSection title={t("prePurchaseInspection")} icon={<CheckCircle2 className="size-5" />}>
            <div className="space-y-2">
              {[
                { item: "Compression test all cylinders", critical: true },
                { item: "Full chassis and suspension inspection", critical: true },
                { item: "Paint depth measurement (all panels)", critical: false },
                { item: "Electronics and switchgear test", critical: false },
                { item: "Road test (minimum 30 minutes)", critical: true },
                { item: "Fluid analysis (engine oil, transmission)", critical: false },
              ].map((check, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-[13px] text-[#9CA3AF]">{check.item}</span>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                    check.critical ? "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9]" : "bg-[#4B5563]/20 text-[#4B5563]"
                  }`}>
                    {check.critical ? "Critical" : "Recommended"}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* 11. Comparable Sales */}
          <CollapsibleSection
            title={t("comparableSales")}
            icon={<TrendingUp className="size-5" />}
            defaultOpen
            badge={<span className="text-[9px] text-[#4B5563] bg-white/5 px-2 py-0.5 rounded">{t("sampleData")}</span>}
          >
            <div className="space-y-3">
              {comps.map((sale, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#FFFCF7] truncate">{sale.title}</p>
                    <p className="text-[11px] text-[#4B5563] mt-0.5">{sale.date} · {sale.platform}</p>
                  </div>
                  <p className="text-[16px] font-bold font-mono text-[#FFFCF7] shrink-0 ml-3">{formatPriceForRegion(sale.price, selectedRegion)}</p>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* 12. Ownership Cost & Shipping */}
          <CollapsibleSection title={t("ownershipAndShipping")} icon={<Wrench className="size-5" />}>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <Shield className="size-4 text-[#4B5563]" />
                  <span className="text-[13px] text-[#9CA3AF]">{t("ownershipCosts.insurance")}</span>
                </div>
                <span className="text-[14px] font-mono font-semibold text-[#FFFCF7]">{formatPriceForRegion(costs.insurance, selectedRegion)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <MapPin className="size-4 text-[#4B5563]" />
                  <span className="text-[13px] text-[#9CA3AF]">{t("ownershipCosts.storage")}</span>
                </div>
                <span className="text-[14px] font-mono font-semibold text-[#FFFCF7]">{formatPriceForRegion(costs.storage, selectedRegion)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <Wrench className="size-4 text-[#4B5563]" />
                  <span className="text-[13px] text-[#9CA3AF]">{t("ownershipCosts.service")}</span>
                </div>
                <span className="text-[14px] font-mono font-semibold text-[#FFFCF7]">{formatPriceForRegion(costs.maintenance, selectedRegion)}</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-[13px] font-semibold text-[#FFFCF7]">{t("totalAnnual")}</span>
                <span className="text-[18px] font-mono font-bold text-[#F8B4D9]">{formatPriceForRegion(totalAnnualCost, selectedRegion)}/yr</span>
              </div>
              <div className="border-t border-white/5 pt-3 mt-1">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="size-4 text-[#F8B4D9]" />
                  <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                    Shipping Estimates
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                    <span className="text-[13px] text-[#9CA3AF]">{t("domestic")}</span>
                    <span className="text-[14px] font-mono font-semibold text-[#FFFCF7]">{formatPriceForRegion(shipping.domestic, selectedRegion)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                    <span className="text-[13px] text-[#9CA3AF]">{t("euImport")}</span>
                    <span className="text-[14px] font-mono font-semibold text-[#FFFCF7]">{formatPriceForRegion(shipping.euImport, selectedRegion)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                    <span className="text-[13px] text-[#9CA3AF]">{t("ukImport")}</span>
                    <span className="text-[14px] font-mono font-semibold text-[#FFFCF7]">{formatPriceForRegion(shipping.ukImport, selectedRegion)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* 13. Events & Community */}
          <CollapsibleSection title={t("eventsAndCommunity")} icon={<Users className="size-5" />}>
            <div className="space-y-2">
              {events.map((event, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <span className={`size-2 rounded-full ${
                      event.impact === "positive" ? "bg-emerald-400" :
                      event.impact === "negative" ? "bg-red-400" : "bg-[#4B5563]"
                    }`} />
                    <div>
                      <p className="text-[13px] text-[#FFFCF7]">{event.name}</p>
                      <p className="text-[10px] text-[#4B5563]">{event.type}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                    event.impact === "positive" ? "bg-emerald-500/10 text-emerald-400" :
                    event.impact === "negative" ? "bg-red-500/10 text-red-400" :
                    "bg-white/5 text-[#4B5563]"
                  }`}>
                    {event.impact === "positive" ? "Value +" : event.impact === "negative" ? "Value -" : "Neutral"}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* 14. Similar Cars */}
          {similarCars.length > 0 && (
            <CollapsibleSection title={t("similarVehicles", { count: similarCars.length })} icon={<Car className="size-5" />} defaultOpen>
              <div className="space-y-3">
                {similarCars.slice(0, 4).map(c => (
                  <SimilarCarCard key={c.id} car={c} />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* 15. Full Report CTA */}
          {isRegistered && (
            <Link
              href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}/report`}
              className="flex items-center gap-4 rounded-xl border border-[rgba(248,180,217,0.15)] bg-[rgba(248,180,217,0.04)] px-5 py-4 hover:bg-[rgba(248,180,217,0.06)] transition-colors"
            >
              <div className="size-10 rounded-lg bg-[rgba(248,180,217,0.1)] flex items-center justify-center shrink-0">
                <FileText className="size-5 text-[#F8B4D9]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#FFFCF7]">Full Investment Report</p>
                <p className="text-[11px] text-[#6B7280] mt-0.5">Valuation, risks, comps &amp; ownership costs</p>
              </div>
              <span className="flex items-center gap-2 shrink-0 rounded-lg bg-[#F8B4D9] px-5 py-2.5 text-[12px] font-semibold text-[#0b0b10]">
                View Report
                <ChevronRight className="size-4" />
              </span>
            </Link>
          )}
        </div>

        {/* ═══ MOBILE CTA ═══ */}
        <MobileCarCTA
          carTitle={car.title}
          carPrice={formatPriceForRegion(car.currentBid, selectedRegion)}
          make={car.make}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          DESKTOP LAYOUT (3-column grid)
          ═══════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex h-[100dvh] w-full flex-col bg-[#0b0b10] overflow-hidden pt-[80px]">
        <div className="flex-1 min-h-0 grid grid-cols-[22%_1fr_28%] grid-rows-[1fr] overflow-hidden">

          {/* COLUMN A: LEFT SIDEBAR */}
          <CarNavSidebar car={car} similarCars={similarCars} />

          {/* COLUMN B: CENTER SCROLL (continuous, no tabs) */}
          <div className="h-full overflow-y-auto no-scrollbar">
            <div className="p-6 space-y-4">

              {/* HERO IMAGE */}
              <div className="relative aspect-[16/9] rounded-[32px] overflow-hidden">
                <Image
                  src={car.image}
                  alt={car.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                {/* Overlays on hero */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md ${
                    car.investmentGrade === "AAA"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-400/30"
                      : "bg-[#F8B4D9]/20 text-[#F8B4D9] border border-[#F8B4D9]/30"
                  }`}>{car.investmentGrade}</span>
                  {isLive && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-emerald-400/30">
                      <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-semibold text-emerald-400">LIVE</span>
                    </span>
                  )}
                </div>
                {/* Bottom text on hero */}
                <div className="absolute bottom-4 left-4 right-4">
                  <span className="text-[9px] font-semibold tracking-[0.25em] uppercase text-[#F8B4D9]">
                    {car.category}
                  </span>
                  <h1 className="text-2xl font-bold text-white mt-1">{car.title}</h1>
                </div>
              </div>

              {/* ABOUT THIS VEHICLE */}
              <div className="rounded-xl bg-[rgba(248,180,217,0.06)] border border-[rgba(248,180,217,0.15)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="size-1.5 rounded-full bg-[#F8B4D9]" />
                    <h2 className="text-[12px] font-semibold text-[#F8B4D9]">{t("aboutThisVehicle")}</h2>
                  </div>
                  <span className="text-[9px] text-[#F8B4D9]/50 bg-[rgba(248,180,217,0.08)] px-2 py-0.5 rounded">{t("editorial")}</span>
                </div>
                <p className="text-[13px] leading-relaxed text-[#D1D5DB]">{car.thesis}</p>
              </div>

              {/* PROVENANCE */}
              <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <History className="size-4 text-[#F8B4D9]" />
                  <h2 className="text-[12px] font-semibold text-[#FFFCF7]">{t("sellersDescription")}</h2>
                </div>
                <div className="border-l-2 border-[#F8B4D9]/20 pl-4">
                  <p className="text-[13px] text-[#D1D5DB] leading-relaxed">{car.history}</p>
                </div>
                <p className="text-[10px] text-[#4B5563] mt-3 italic">{t("source", { platform: car.platform.replace(/_/g, " ") })}</p>
              </div>

              {/* KEY INSPECTION POINTS */}
              <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="size-4 text-[#F8B4D9]" />
                  <h2 className="text-[12px] font-semibold text-[#FFFCF7]">Key Inspection Points</h2>
                  <span className="text-[9px] text-[#F8B4D9]/60 bg-[rgba(248,180,217,0.1)] px-2 py-0.5 rounded-full">{flags.length}</span>
                </div>
                <div className="space-y-2">
                  {flags.map((flag, i) => (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-[rgba(248,180,217,0.03)]">
                      <AlertTriangle className="size-3.5 text-[#F8B4D9] mt-0.5 shrink-0" />
                      <span className="text-[12px] text-[#FFFCF7]">{flag}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* QUESTIONS TO ASK */}
              <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <HelpCircle className="size-4 text-[#F8B4D9]" />
                  <h2 className="text-[12px] font-semibold text-[#FFFCF7]">Questions to Ask the Seller</h2>
                </div>
                <div className="space-y-2">
                  {questions.map((q, i) => (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.02]">
                      <span className="flex items-center justify-center size-5 rounded-full bg-[#F8B4D9]/10 text-[9px] font-bold text-[#F8B4D9] shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-[12px] text-[#9CA3AF]">{q}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PRE-PURCHASE INSPECTION */}
              <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="size-4 text-[#F8B4D9]" />
                  <h2 className="text-[12px] font-semibold text-[#FFFCF7]">Pre-Purchase Inspection</h2>
                </div>
                <div className="space-y-2">
                  {[
                    { item: "Compression test all cylinders", critical: true },
                    { item: "Full chassis and suspension inspection", critical: true },
                    { item: "Paint depth measurement (all panels)", critical: false },
                    { item: "Electronics and switchgear test", critical: false },
                    { item: "Road test (minimum 30 minutes)", critical: true },
                    { item: "Fluid analysis (engine oil, transmission)", critical: false },
                  ].map((check, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                      <span className="text-[12px] text-[#9CA3AF]">{check.item}</span>
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                        check.critical ? "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9]" : "bg-[#4B5563]/20 text-[#4B5563]"
                      }`}>
                        {check.critical ? "Critical" : "Recommended"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* COMPARABLE SALES */}
              <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="size-4 text-[#F8B4D9]" />
                    <h2 className="text-[12px] font-semibold text-[#FFFCF7]">Recent Comparable Sales</h2>
                  </div>
                  <span className="text-[9px] text-[#4B5563] bg-white/5 px-2 py-0.5 rounded">Sample</span>
                </div>
                <div className="space-y-2">
                  {comps.map((sale, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.03]">
                      <div>
                        <p className="text-[12px] font-medium text-[#FFFCF7]">{sale.title}</p>
                        <p className="text-[10px] text-[#4B5563] mt-0.5">{sale.date} · {sale.platform}</p>
                      </div>
                      <span className="text-[14px] font-mono font-bold text-[#FFFCF7]">{formatPriceForRegion(sale.price, selectedRegion)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* FULL REPORT CTA */}
              {isRegistered && (
                <Link
                  href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}/report`}
                  className="block rounded-xl border border-[rgba(248,180,217,0.15)] bg-[rgba(248,180,217,0.04)] p-5 hover:bg-[rgba(248,180,217,0.06)] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-lg bg-[rgba(248,180,217,0.1)] flex items-center justify-center shrink-0">
                      <FileText className="size-5 text-[#F8B4D9]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#FFFCF7]">Full Investment Report</p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">Valuation, risks, comps &amp; ownership costs</p>
                    </div>
                    <span className="flex items-center gap-2 shrink-0 rounded-lg bg-[#F8B4D9] px-5 py-2.5 text-[12px] font-semibold text-[#0b0b10]">
                      View Report
                      <ChevronRight className="size-4" />
                    </span>
                  </div>
                </Link>
              )}

              {/* Bottom spacing */}
              <div className="h-8" />
            </div>
          </div>

          {/* COLUMN C: RIGHT PANEL */}
          <div className="overflow-hidden">
            <CarContextPanel car={car} onOpenAdvisor={() => setShowAdvisorChat(true)} dbAnalysis={dbAnalysis} dbSoldHistory={dbSoldHistory} />
          </div>
        </div>
      </div>

      {/* ═══ REGISTRATION GATE ═══ */}
      <AnimatePresence>
        {showRegistrationGate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[70] flex items-end md:items-center justify-center"
          >
            <div className="absolute inset-0 bg-[#0b0b10]/60 backdrop-blur-md" />
            <div className="absolute inset-x-0 top-0 h-[45vh] bg-gradient-to-b from-transparent via-transparent to-[rgba(11,11,16,0.85)]" />

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.15 }}
              className="relative w-full max-w-md mx-4 rounded-2xl bg-[#0F1012]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="h-0.5 bg-gradient-to-r from-[#F8B4D9] via-[#F8B4D9]/40 to-transparent" />

              <div className="px-6 pt-8 pb-2 text-center">
                <h3 className="text-xl font-bold text-[#FFFCF7]">
                  Sign up to continue
                </h3>
                <p className="text-[12px] text-[#6B7280] mt-1">
                  Create a free account to explore this vehicle
                </p>
              </div>

              <div className="px-6 pt-5 pb-4">
                <button
                  onClick={handleGoogleSignIn}
                  type="button"
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-[#F8B4D9] text-[#0b0b10] font-semibold text-[13px] hover:bg-[#f4cbde] transition-all"
                >
                  <svg className="size-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>
              </div>

              <div className="px-6 flex items-center gap-3 pb-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] text-[#6B7280]">or use email</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <form onSubmit={handleGateSubmit} className="px-6 pb-6 space-y-3">
                <div>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#4B5563]" />
                    <input
                      type="text"
                      value={gateName}
                      onChange={(e) => { setGateName(e.target.value); setGateErrors(prev => ({ ...prev, name: false })) }}
                      placeholder="Your name"
                      className={`w-full bg-white/[0.03] border rounded-xl pl-10 pr-4 py-3 text-[13px] text-[#FFFCF7] placeholder:text-[#4B5563] focus:outline-none transition-colors ${
                        gateErrors.name ? "border-red-500/50" : "border-white/10 focus:border-[#F8B4D9]/50"
                      }`}
                    />
                  </div>
                  {gateErrors.name && <p className="text-[10px] text-red-400 mt-1 pl-1">Enter your name</p>}
                </div>

                <div>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#4B5563]" />
                    <input
                      type="email"
                      value={gateEmail}
                      onChange={(e) => { setGateEmail(e.target.value); setGateErrors(prev => ({ ...prev, email: false })) }}
                      placeholder="your@email.com"
                      className={`w-full bg-white/[0.03] border rounded-xl pl-10 pr-4 py-3 text-[13px] text-[#FFFCF7] placeholder:text-[#4B5563] focus:outline-none transition-colors ${
                        gateErrors.email ? "border-red-500/50" : "border-white/10 focus:border-[#F8B4D9]/50"
                      }`}
                    />
                  </div>
                  {gateErrors.email && <p className="text-[10px] text-red-400 mt-1 pl-1">Enter a valid email</p>}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl border border-white/10 text-[#FFFCF7] font-medium text-[13px] hover:bg-white/[0.05] transition-all"
                >
                  Sign up with email
                </button>

                <p className="text-[10px] text-[#4B5563] text-center pt-1">
                  Free account. No credit card needed.
                </p>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ WELCOME POPUP ═══ */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[80] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-[#0b0b10]/50 backdrop-blur-sm" onClick={() => setShowWelcome(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm mx-4 rounded-2xl bg-[#0F1012] border border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="px-6 pt-7 pb-4 text-center">
                <div className="size-14 rounded-full bg-[#F8B4D9]/10 flex items-center justify-center mx-auto mb-4">
                  <Coins className="size-7 text-[#F8B4D9]" />
                </div>
                <h3 className="text-lg font-bold text-[#FFFCF7]">
                  Welcome to Monza
                </h3>
                <p className="text-3xl font-mono font-black text-[#F8B4D9] mt-2">
                  3,000 tokens
                </p>
                <p className="text-[11px] text-[#6B7280] mt-1">
                  have been added to your account
                </p>
              </div>

              <div className="px-6 pb-5">
                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-3">
                  How it works
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="size-7 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[11px] font-bold text-[#F8B4D9]">1</span>
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-[#FFFCF7]">Browse all vehicles freely</p>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">Explore every car, model, and brand at no cost</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="size-7 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[11px] font-bold text-[#F8B4D9]">2</span>
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-[#FFFCF7]">Generate full analyses with tokens</p>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">Each report costs 1,000 tokens &mdash; you have 3 free</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="size-7 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[11px] font-bold text-[#F8B4D9]">3</span>
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-[#FFFCF7]">Download or receive by email</p>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">Re-downloading a report you already generated is free</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6">
                <button
                  onClick={() => setShowWelcome(false)}
                  className="w-full py-3.5 rounded-xl bg-[#F8B4D9] text-[#0b0b10] font-semibold text-[13px] hover:bg-[#f4cbde] transition-all"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ ANALYSIS DELIVERY POPUP ═══ */}
      <AnimatePresence>
        {showAnalysisPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-[#0b0b10]/50 backdrop-blur-sm" onClick={() => { setShowAnalysisPopup(false); setAnalysisSent(false) }} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm mx-4 rounded-2xl bg-[#0F1012] border border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="h-0.5 bg-gradient-to-r from-[#F8B4D9] via-[#F8B4D9]/40 to-transparent" />

              {analysisSent ? (
                <div className="px-6 py-10 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="size-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4"
                  >
                    <CheckCircle2 className="size-7 text-emerald-400" />
                  </motion.div>
                  <h3 className="text-lg font-bold text-[#FFFCF7]">Analysis sent!</h3>
                  <p className="text-[12px] text-[#6B7280] mt-1">
                    Check your inbox at {user?.email}
                  </p>
                </div>
              ) : (
                <>
                  <div className="px-6 pt-6 pb-4 text-center">
                    <h3 className="text-lg font-bold text-[#FFFCF7]">
                      Your analysis is ready
                    </h3>
                    <p className="text-[12px] text-[#6B7280] mt-1">
                      {car.title}
                    </p>
                  </div>

                  <div className="px-6 pb-6 space-y-3">
                    <button
                      onClick={handleSendAnalysis}
                      className="w-full flex items-center gap-4 rounded-xl bg-[#F8B4D9] px-5 py-4 text-left hover:bg-[#f4cbde] transition-all group"
                    >
                      <div className="size-10 rounded-full bg-[#0b0b10]/10 flex items-center justify-center shrink-0">
                        <Send className="size-5 text-[#0b0b10]" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#0b0b10]">Send to my email</p>
                        <p className="text-[11px] text-[#0b0b10]/60">{user?.email}</p>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowAnalysisPopup(false)
                      }}
                      className="w-full flex items-center gap-4 rounded-xl border border-white/10 px-5 py-4 text-left hover:bg-white/[0.03] transition-all group"
                    >
                      <div className="size-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                        <Download className="size-5 text-[#F8B4D9]" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[#FFFCF7]">Download PDF</p>
                        <p className="text-[11px] text-[#6B7280]">Full investment report</p>
                      </div>
                    </button>

                    {!hasAnalyzed(car.id) && (
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <Coins className="size-3.5 text-[#F8B4D9]" />
                        <span className="text-[11px] text-[#6B7280]">
                          1,000 tokens used &middot; {tokens.toLocaleString()} remaining
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ PAYWALL POPUP ═══ */}
      <AnimatePresence>
        {showPaywall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-[#0b0b10]/50 backdrop-blur-sm" onClick={() => setShowPaywall(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm mx-4 rounded-2xl bg-[#0F1012] border border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="h-0.5 bg-gradient-to-r from-[#F8B4D9] via-[#F8B4D9]/40 to-transparent" />

              <div className="px-6 pt-7 pb-6 text-center">
                <div className="size-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Coins className="size-7 text-[#4B5563]" />
                </div>
                <h3 className="text-lg font-bold text-[#FFFCF7]">
                  You&apos;ve used your free analyses
                </h3>
                <p className="text-[12px] text-[#6B7280] mt-1">
                  Get unlimited access to all vehicle reports
                </p>

                <div className="mt-5 space-y-2 text-left">
                  {[
                    "Unlimited vehicle analyses",
                    "Real-time price alerts",
                    "Personal collector advisor",
                  ].map((benefit) => (
                    <div key={benefit} className="flex items-center gap-2.5">
                      <CheckCircle2 className="size-3.5 text-[#F8B4D9] shrink-0" />
                      <span className="text-[12px] text-[#9CA3AF]">{benefit}</span>
                    </div>
                  ))}
                </div>

                <a
                  href={`https://wa.me/573208492641?text=${encodeURIComponent(
                    `Hi, I'd like to upgrade to Monza Premium for unlimited analyses.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 mt-6 rounded-xl bg-[#F8B4D9] text-[#0b0b10] font-semibold text-[13px] hover:bg-[#f4cbde] transition-all"
                >
                  <MessageCircle className="size-4" />
                  Contact us to upgrade
                </a>

                <button
                  onClick={() => setShowPaywall(false)}
                  className="w-full py-3 mt-2 text-[12px] text-[#6B7280] hover:text-[#9CA3AF] transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ ADVISOR CHAT (Desktop) ═══ */}
      <AdvisorChat
        open={showAdvisorChat}
        onOpenChange={setShowAdvisorChat}
        initialContext={{
          carTitle: car.title,
          carPrice: formatPriceForRegion(car.currentBid, selectedRegion),
          make: car.make,
        }}
      />
    </div>
  )
}
