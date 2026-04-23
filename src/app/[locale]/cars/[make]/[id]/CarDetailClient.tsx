"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Link, useRouter } from "@/i18n/navigation"
import { stripHtml } from "@/lib/stripHtml"
import { motion, AnimatePresence } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"
import {
  ArrowLeft,
  TrendingUp,
  Globe,
  Scale,
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
import type { SimilarCarResult } from "@/lib/similarCars"
import type { DbMarketDataRow, DbComparableRow, DbAnalysisRow, DbSoldRecord } from "@/lib/db/queries"
import type { HausReport } from "@/lib/fairValue/types"
import { useRegion } from "@/lib/RegionContext"
import { formatRegionalPrice, formatUsd } from "@/lib/regionPricing"
import { useCurrency } from "@/lib/CurrencyContext"
import { isAuctionPlatform, getPriceLabel, getStatusLabel, getPlatformName } from "@/lib/makePageConstants"
import { AdvisorChat } from "@/components/advisor/AdvisorChat"
import { useAdvisorChatHandoff } from "@/components/advisor/AdvisorHandoffContext"
import { MobileCarCTA } from "@/components/mobile"
import { useTokens } from "@/hooks/useTokens"
import { HausReportTeaser } from "@/components/report/HausReportTeaser"
import { ListingHook } from "@/components/detail/ListingHook"
import { formatPoint } from "@/lib/landedCost/format"

// ─── MOCK DATA ───
// ─── HARDCODED RED FLAGS / SELLER QUESTIONS REMOVED ───
// Per-make lists used to live here. Real source of truth is dbAnalysis
// (Analysis table, AI-generated). When dbAnalysis is missing or empty the
// UI renders an explicit empty state instead of per-make fake fallbacks.

// ─── HARDCODED FAKE DATA REMOVED ───
// Ownership costs, comparable sales, upcoming events, and shipping estimates
// used to live here as per-make fake arrays. They've been deleted so the UI
// renders honest empty states wherever the backend hasn't populated real data.
// When the backend starts writing to the "Comparable" table (and equivalents
// for ownership/shipping/events) the UI will pick it up automatically.

// ─── PLATFORM LABELS ───
const platformLabels: Record<string, { short: string; color: string }> = {
  BRING_A_TRAILER: { short: "BaT", color: "bg-amber-500/20 text-destructive" },
  CARS_AND_BIDS: { short: "C&B", color: "bg-blue-500/20 text-blue-400" },
  COLLECTING_CARS: { short: "CC", color: "bg-purple-500/20 text-purple-400" },
  AUTO_SCOUT_24: { short: "AS24", color: "bg-green-500/20 text-green-400" },
  RM_SOTHEBYS: { short: "RM", color: "bg-rose-500/20 text-rose-400" },
  GOODING: { short: "Gooding", color: "bg-positive/20 text-positive" },
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
  if (diff <= 0) return "—"
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
    const avg = (p.low + p.high) / 2
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
    <div className="rounded-xl bg-card border border-border border-l-2 border-l-primary/20 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-foreground/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-primary">{icon}</div>
          <span className="text-[13px] font-medium text-foreground">{title}</span>
          {badge}
        </div>
        <ChevronDown className={`size-4 text-primary/40 transition-transform ${isOpen ? "rotate-180" : ""}`} />
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
    <div className="rounded-xl bg-card border border-border border-l-2 border-l-primary/30 p-4">
      <div className="flex items-center gap-2 text-primary/60 mb-2">
        {icon}
        <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">{label}</span>
      </div>
      <span className="text-[20px] font-bold text-foreground">{value}</span>
    </div>
  )
}

// ─── SIMILAR CAR CARD ───
function SimilarCarCard({ car, matchReasons }: { car: CollectorCar; matchReasons?: string[] }) {
  const { formatPrice } = useCurrency()
  return (
    <Link
      href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
      className="group flex items-center gap-4 rounded-xl bg-foreground/2 hover:bg-foreground/4 border border-border hover:border-primary/15 p-3 transition-all"
    >
      <div className="relative w-20 h-14 rounded-lg overflow-hidden shrink-0">
        <Image
          src={car.image}
          alt={car.title}
          fill
          className="object-cover"
          sizes="80px"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {car.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[12px] font-display font-medium text-primary">
            {formatPrice(car.currentBid)}
          </span>
          {car.mileage > 0 && (
            <span className="text-[9px] text-muted-foreground">
              {car.mileage.toLocaleString()} {car.mileageUnit}
            </span>
          )}
        </div>
        {matchReasons && matchReasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {matchReasons.slice(0, 2).map(reason => (
              <span key={reason} className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground">
                {reason}
              </span>
            ))}
          </div>
        )}
      </div>
      <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </Link>
  )
}

// ─── SIDEBAR MINI CAR CARD (compact for left sidebar) ───
function SidebarCarCard({ car }: { car: CollectorCar }) {
  const { formatPrice } = useCurrency()
  return (
    <Link
      href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
      className="group flex items-center gap-3 p-2 rounded-lg hover:bg-foreground/4 transition-colors"
    >
      <div className="relative w-14 h-10 rounded-md overflow-hidden shrink-0">
        <Image
          src={car.image}
          alt={car.title}
          fill
          className="object-cover"
          sizes="56px"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground truncate group-hover:text-primary transition-colors">
          {car.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] font-display font-medium text-primary">
            {formatPrice(car.currentBid)}
          </span>
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
  dbAnalysis,
}: {
  car: CollectorCar
  similarCars: SimilarCarResult[]
  dbAnalysis?: DbAnalysisRow | null
}) {
  const locale = useLocale()
  const { effectiveRegion } = useRegion()
  const { formatPrice, convertFromUsd } = useCurrency()
  const isLive = car.status === "ACTIVE" || car.status === "ENDING_SOON"
  const flags: string[] = dbAnalysis?.redFlags ?? []
  const platform = platformLabels[car.platform]

  // Market position: where current price sits within selected region's fair value range
  const regionRange = car.fairValueByRegion[effectiveRegion as keyof typeof car.fairValueByRegion] || car.fairValueByRegion.US
  const fairLow = regionRange.low
  const fairHigh = regionRange.high
  // Convert currentBid (USD) to selected currency for comparison
  const bidInCurrency = convertFromUsd(car.currentBid)
  const pricePosition = fairHigh > fairLow
    ? Math.min(Math.max(((bidInCurrency - fairLow) / (fairHigh - fairLow)) * 100, 0), 100)
    : 50
  const isBelowFair = bidInCurrency < (fairLow + fairHigh) / 2
  const priceLabel = getPriceLabel(car.platform, car.status)

  return (
    <div className="h-full flex flex-col overflow-hidden border-r border-border">
      {/* ── Back nav ── */}
      <div className="px-4 pt-3 pb-1 shrink-0">
        <Link
          href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}`}
          className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="size-3" />
          <span>{car.make.toUpperCase()}</span>
          <ChevronRight className="size-2.5 text-muted-foreground" />
          <span className="text-muted-foreground">{car.model}</span>
        </Link>
      </div>

      {/* ── Identity: title + trend ── */}
      <div className="px-4 pb-3 shrink-0 border-b border-border">
        <h2 className="text-[12px] font-semibold text-foreground leading-tight">{car.title}</h2>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[11px] tabular-nums font-semibold ${
            car.trendValue > 0 ? "text-positive" : car.trendValue < 0 ? "text-destructive" : "text-muted-foreground"
          }`}>
            {car.trendValue > 0 ? "+" : ""}{car.trendValue}% {car.trendValue > 0 ? "↑" : car.trendValue < 0 ? "↓" : "→"}
          </span>
        </div>
      </div>

      {/* ── Price ── */}
      <div className="px-4 py-3 shrink-0 border-b border-border">
        <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{priceLabel}</span>
        <p className="text-[20px] font-display font-medium text-primary mt-0.5">{formatPrice(car.currentBid)}</p>
      </div>

      {/* ── Market Position (hidden when no price data) ── */}
      {car.currentBid > 0 && (
      <div className="px-4 py-3 shrink-0 border-b border-border">
        <span className="text-[8px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-2 block">Market Position</span>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] tabular-nums text-muted-foreground">{formatRegionalPrice(fairLow, regionRange.currency)}</span>
          <span className="text-[9px] text-muted-foreground">Fair Value Range ({effectiveRegion})</span>
          <span className="text-[10px] tabular-nums text-muted-foreground">{formatRegionalPrice(fairHigh, regionRange.currency)}</span>
        </div>
        {/* Position bar */}
        <div className="relative h-[8px] rounded-full bg-foreground/4 overflow-hidden">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400/20 via-primary/20 to-red-400/20" />
          {/* Indicator dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 size-[10px] rounded-full bg-primary border-2 border-background shadow-lg shadow-primary/30"
            style={{ left: `calc(${pricePosition}% - 5px)` }}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          {isBelowFair ? (
            <>
              <CheckCircle2 className="size-3 text-positive" />
              <span className="text-[10px] font-medium text-positive">Below market average</span>
            </>
          ) : (
            <>
              <TrendingUp className="size-3 text-destructive" />
              <span className="text-[10px] font-medium text-destructive">Above market average</span>
            </>
          )}
        </div>
      </div>
      )}

      {/* ── Live listing block (CONDITIONAL) ── */}
      {isLive && (
        <div className="mx-3 my-3 shrink-0 rounded-lg border border-positive/20 bg-positive/[0.04] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-positive animate-pulse" />
              <span className="text-[10px] font-semibold text-positive uppercase tracking-wider">{isAuctionPlatform(car.platform) ? "Live Auction" : "For Sale"}</span>
            </div>
            {platform && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold ${platform.color}`}>
                {platform.short}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            {isAuctionPlatform(car.platform) && car.bidCount > 0 && <span className="text-[11px] text-muted-foreground">{car.bidCount} bids</span>}
            {isAuctionPlatform(car.platform) && <span className="text-[11px] tabular-nums text-destructive">{timeLeft(car.endTime)}</span>}
          </div>
          {car.sourceUrl && (
            <a
              href={car.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-foreground/3 py-1.5 text-[10px] text-muted-foreground hover:bg-foreground/6 transition-colors"
            >
              Ver en {platform?.short || car.platform.replace(/_/g, " ")}
              <ChevronRight className="size-3" />
            </a>
          )}
        </div>
      )}

      {/* ── Sold / Platform info (when NOT live) ── */}
      {!isLive && car.status === "ENDED" && (
        <div className="mx-3 my-3 shrink-0 rounded-lg border border-border bg-foreground/2 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {platform && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold ${platform.color}`}>
                  {platform.short}
                </span>
              )}
              {isAuctionPlatform(car.platform) && car.bidCount > 0 && <span className="text-[10px] text-muted-foreground">{car.bidCount} bids</span>}
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">{getStatusLabel(car.platform, car.status)}</span>
          </div>
          {car.sourceUrl && (
            <a
              href={car.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-foreground/3 py-1.5 text-[10px] text-muted-foreground hover:bg-foreground/6 transition-colors"
            >
              Ver en {platform?.short || car.platform.replace(/_/g, " ")}
              <ChevronRight className="size-3" />
            </a>
          )}
        </div>
      )}

      {/* ── Specs ── */}
      <div className="px-4 py-3 shrink-0 border-b border-border">
        <span className="text-[8px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-2 block">Vehicle</span>
        <div className="space-y-1.5">
          {[
            { icon: <Gauge className="size-3.5" />, value: `${car.mileage.toLocaleString(locale)} ${car.mileageUnit}` },
            { icon: <Cog className="size-3.5" />, value: car.engine },
            { icon: <Cog className="size-3.5" />, value: car.transmission },
            { icon: <MapPin className="size-3.5" />, value: car.location },
          ].map((spec, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-muted-foreground">{spec.icon}</span>
              <span className="text-[11px] text-muted-foreground truncate">{spec.value}</span>
            </div>
          ))}
          {car.vin && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground"><FileText className="size-3.5" /></span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{car.vin}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Risk / Inspection ── */}
      {flags.length > 0 && (
        <div className="px-4 py-3 shrink-0 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="size-3.5 text-destructive" />
            <span className="text-[10px] font-semibold text-muted-foreground">{flags.length} inspection points</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed pl-[22px]">
            {flags[0]}
          </p>
        </div>
      )}

      {/* ── Similar vehicles (scrollable) ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <span className="text-[8px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Similar · {similarCars.length}
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-2">
          <div className="space-y-1 pb-4">
            {similarCars.map(c => (
              <SidebarCarCard key={c.car.id} car={c.car} />
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
  const { effectiveRegion } = useRegion()
  const { formatPrice, convertFromUsd, currencySymbol } = useCurrency()
  // Ownership cost: surface only whatever the AI analysis actually returned.
  // Storage is not analyzed today, so we leave it null. Sections render empty
  // states when no real data is present (no more per-make fake fallbacks).
  const costs = dbAnalysis && (dbAnalysis.insuranceEstimate || dbAnalysis.yearlyMaintenance)
    ? {
        insurance: dbAnalysis.insuranceEstimate ?? null,
        storage: null as number | null,
        maintenance: dbAnalysis.yearlyMaintenance ?? null,
      }
    : null
  const totalAnnualCost = costs
    ? (costs.insurance ?? 0) + (costs.storage ?? 0) + (costs.maintenance ?? 0)
    : null
  // Shipping and upcoming events have no DB source yet — render empty states.
  const shipping = null as { domestic: number; euImport: number; ukImport: number } | null
  const events: { name: string; type: string; impact: "positive" | "neutral" | "negative" }[] = []

  // Regional pricing — use real per-region fair values from DB
  const pricing = car.fairValueByRegion
  const bestRegion = findBestRegion(pricing)
  const maxRegionalUsd = Math.max(
    ...((["US", "EU", "UK", "JP"] as const).map(r =>
      (pricing[r].low + pricing[r].high) / 2
    ))
  )

  // Market position: where is the current bid relative to fair value?
  const regionRange = pricing[effectiveRegion as keyof typeof pricing] || pricing.US
  const fairMid = (regionRange.low + regionRange.high) / 2
  const pricePosition = fairMid > 0 ? Math.round((car.currentBid / fairMid) * 100) : 50

  return (
    <div className="h-full flex flex-col overflow-hidden border-l border-border">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">

        {/* 0. CAR IDENTITY HEADER */}
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Investment Analysis
            </span>
          </div>
          <h2 className="text-[14px] font-display font-normal text-foreground leading-tight">{car.title}</h2>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
            <span>{car.transmission}</span>
            <span>·</span>
            <span>{car.mileage.toLocaleString()} {car.mileageUnit}</span>
            {car.vin && (
              <>
                <span>·</span>
                <span className="tabular-nums">{car.vin}</span>
              </>
            )}
          </div>
        </div>

        {/* 1. PRICE + TREND */}
        <div className="px-5 py-3 border-b border-border bg-primary/3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">
                {getPriceLabel(car.platform, car.status)}
              </span>
              <p className="text-[13px] tabular-nums font-semibold text-foreground">{formatPrice(car.currentBid)}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Trend</span>
              <p className="text-[13px] tabular-nums font-semibold text-positive">{car.trend}</p>
            </div>
          </div>
        </div>

        {/* 2. VALUATION BY MARKET */}
        <div className="px-5 py-4 border-b border-border">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Valuation by Market
              </span>
            </div>
            <p className="text-[8px] text-muted-foreground mt-1 ml-6">Fair value range by region</p>
          </div>
          <div className="space-y-2.5">
            {(["US", "UK", "EU", "JP"] as const).map(region => {
              const rp = pricing[region]
              const isBest = bestRegion === region
              const isSelected = region === effectiveRegion
              const avg = (rp.low + rp.high) / 2
              const barWidth = (avg / maxRegionalUsd) * 100
              return (
                <div key={region} className={isSelected ? "rounded-lg bg-primary/4 -mx-2 px-2 py-1.5" : ""}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px]">{regionLabels[region].flag}</span>
                      <span className={`text-[11px] font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{region}</span>
                      {isBest && (
                        <span className="text-[8px] font-bold text-positive tracking-wide">BEST</span>
                      )}
                      {isSelected && (
                        <span className="text-[8px] font-bold text-primary tracking-wide">YOUR MARKET</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[11px] tabular-nums font-semibold text-foreground">
                        {formatRegionalPrice(convertFromUsd(rp.low), currencySymbol)}
                      </span>
                      <span className="text-[9px] text-muted-foreground">→</span>
                      <span className={`text-[11px] tabular-nums font-semibold ${isBest ? "text-positive" : "text-primary"}`}>
                        {formatRegionalPrice(convertFromUsd(rp.high), currencySymbol)}
                      </span>
                    </div>
                  </div>
                  {region !== effectiveRegion && (
                    <div className="flex justify-end mb-1">
                      <span className="text-[9px] tabular-nums text-muted-foreground">
                        ≈ {formatPrice(rp.high)}
                      </span>
                    </div>
                  )}
                  <div className="h-[6px] rounded-full bg-foreground/4 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isBest ? "bg-gradient-to-r from-emerald-400/30 to-emerald-400/60" : isSelected ? "bg-gradient-to-r from-primary/40 to-primary/70" : "bg-gradient-to-r from-primary/25 to-primary/50"}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. MARKET POSITION */}
        <div className="px-5 py-4 border-b border-border bg-primary/3">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Market Position
            </span>
          </div>
          {/* Price vs Fair Value gauge */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground">Price vs Fair Value</span>
              <span className={`text-[11px] tabular-nums font-bold ${pricePosition <= 90 ? "text-positive" : pricePosition <= 110 ? "text-primary" : "text-destructive"}`}>
                {pricePosition}%
              </span>
            </div>
            <div className="h-[8px] rounded-full bg-foreground/4 overflow-hidden">
              <div
                className={`h-full rounded-full ${pricePosition <= 90 ? "bg-positive/50" : pricePosition <= 110 ? "bg-primary/50" : "bg-destructive/50"}`}
                style={{ width: `${Math.min(pricePosition, 150) / 1.5}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[9px] text-muted-foreground">{formatPrice(regionRange.low)}</span>
              <span className="text-[9px] text-muted-foreground">{formatPrice(regionRange.high)}</span>
            </div>
          </div>
          {/* Position label */}
          <div className="rounded-lg bg-foreground/3 border border-border px-3 py-2">
            <span className="text-[11px] text-muted-foreground">
              {pricePosition <= 85
                ? "Priced well below fair value range — strong buyer opportunity"
                : pricePosition <= 100
                  ? "Priced within the lower half of fair value range"
                  : pricePosition <= 115
                    ? "Priced at market — fair value for current conditions"
                    : "Priced above fair value midpoint — verify condition justifies premium"}
            </span>
          </div>
        </div>

        {/* 5. ANNUAL OWNERSHIP COST */}
        <div className="px-5 py-4 border-b border-border bg-primary/3">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Annual Ownership Cost
            </span>
          </div>
          {costs ? (
            <div className="space-y-2">
              {[
                { label: "Insurance", value: costs.insurance },
                { label: "Storage", value: costs.storage },
                { label: "Maintenance", value: costs.maintenance },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{item.label}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {item.value == null ? "—" : formatPrice(item.value)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
                <span className="text-[11px] font-medium text-foreground">Total</span>
                <span className="text-[12px] font-display font-medium text-primary">
                  {totalAnnualCost ? `${formatPrice(totalAnnualCost)}/yr` : "—"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">Awaiting backend data</p>
          )}
        </div>

        {/* 6. SHIPPING COSTS */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Shipping Estimates
            </span>
          </div>
          {shipping ? (
            <div className="space-y-2">
              {[
                { label: "Domestic (Enclosed)", value: shipping.domestic },
                { label: "EU Import", value: shipping.euImport },
                { label: "UK Import", value: shipping.ukImport },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{item.label}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{formatPrice(item.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">Awaiting backend data</p>
          )}
        </div>

        {/* 7. EVENTS & COMMUNITY */}
        <div className="px-5 py-4 border-b border-border bg-primary/3">
          <div className="flex items-center gap-2 mb-3">
            <Users className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Events & Community
            </span>
          </div>
          {events.length > 0 ? (
            <div className="space-y-2">
              {events.map((event, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`size-1.5 rounded-full ${
                      event.impact === "positive" ? "bg-positive" :
                      event.impact === "negative" ? "bg-destructive" : "bg-muted-foreground"
                    }`} />
                    <span className="text-[11px] text-muted-foreground">{event.name}</span>
                  </div>
                  <span className={`text-[9px] font-semibold ${
                    event.impact === "positive" ? "text-positive" :
                    event.impact === "negative" ? "text-destructive" : "text-muted-foreground"
                  }`}>
                    {event.impact === "positive" ? "+" : event.impact === "negative" ? "−" : "~"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">Awaiting backend data</p>
          )}
        </div>
      </div>

      {/* Report CTA */}
      <div className="shrink-0 px-4 pt-3">
        <Link
          href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}/report`}
          className="block rounded-xl border border-primary/20 bg-primary/6 p-4 hover:bg-primary/10 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <FileText className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-foreground">Full Investment Report</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Valuation, risks, comps &amp; costs</p>
            </div>
            <ChevronRight className="size-4 text-primary group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>

      {/* CTA pinned bottom */}
      <div className="shrink-0 p-4 border-t border-border">
        <button
          onClick={onOpenAdvisor}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/80 transition-colors"
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
export function CarDetailClient({ car, similarCars, dbMarketData, dbComparables = [], dbAnalysis, dbSoldHistory = [], existingReport = null, userAlreadyPaid = false, landedCostTeaser = null }: {
  car: CollectorCar
  similarCars: SimilarCarResult[]
  dbMarketData?: DbMarketDataRow | null
  dbComparables?: DbComparableRow[]
  dbAnalysis?: DbAnalysisRow | null
  dbSoldHistory?: DbSoldRecord[]
  existingReport?: HausReport | null
  userAlreadyPaid?: boolean
  landedCostTeaser?: {
    amount: number
    currency: "USD" | "EUR" | "GBP" | "JPY"
    destination: "US" | "DE" | "UK" | "JP"
  } | null
}) {
  const locale = useLocale()
  const t = useTranslations("carDetail")
  const tAuction = useTranslations("auctionDetail")
  const tStatus = useTranslations("status")
  const { effectiveRegion } = useRegion()
  const { formatPrice, convertFromUsd } = useCurrency()
  const router = useRouter()
  const makeSlug = car.make.toLowerCase().replace(/\s+/g, "-")
  const handleOpenReport = () => router.push(`/cars/${makeSlug}/${car.id}/report`)

  const [showSticky, setShowSticky] = useState(false)
  const [showAdvisorChat, setShowAdvisorChat] = useState(false)
  const { openChatConversationId } = useAdvisorChatHandoff()
  useEffect(() => {
    if (openChatConversationId) setShowAdvisorChat(true)
  }, [openChatConversationId])
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

  // DB analysis is the only source for red flags and critical questions.
  const flags: string[] = dbAnalysis?.redFlags ?? []
  const questions: string[] = dbAnalysis?.criticalQuestions ?? []

  // Ownership cost: surface only what the AI analysis returned. No per-make
  // fake fallback — storage is not analyzed today, so leave it null.
  const costs = dbAnalysis && (dbAnalysis.insuranceEstimate || dbAnalysis.yearlyMaintenance)
    ? {
        insurance: dbAnalysis.insuranceEstimate ?? null,
        storage: null as number | null,
        maintenance: dbAnalysis.yearlyMaintenance ?? null,
      }
    : null

  // Comparable sales: only real DB rows. Empty array when Comparable table has nothing.
  const comps = dbComparables.length > 0
    ? dbComparables.map(c => ({
        title: c.title,
        price: c.soldPrice,
        date: c.soldDate ? new Date(c.soldDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "N/A",
        platform: c.platform === "BRING_A_TRAILER" ? "BaT" : c.platform === "CARS_AND_BIDS" ? "C&B" : c.platform === "COLLECTING_CARS" ? "CC" : c.platform === "AUTO_SCOUT_24" ? "AS24" : c.platform,
        delta: dbMarketData?.avgPrice ? Math.round(((c.soldPrice - dbMarketData.avgPrice) / dbMarketData.avgPrice) * 100) : 0,
      }))
    : []

  // No DB source yet for upcoming events or shipping costs — render empty states.
  const events: { name: string; type: string; impact: "positive" | "neutral" | "negative" }[] = []
  const shipping = null as { domestic: number; euImport: number; ukImport: number } | null
  const totalAnnualCost = costs
    ? (costs.insurance ?? 0) + (costs.storage ?? 0) + (costs.maintenance ?? 0)
    : null

  // ─── Investment Passport computations (for mobile) ───
  // Use real per-region fair values from DB
  const mobilePricing = car.fairValueByRegion
  const regionRange = mobilePricing[effectiveRegion as keyof typeof mobilePricing] || mobilePricing.US
  const fairLow = dbMarketData?.lowPrice ?? regionRange.low
  const fairHigh = dbMarketData?.highPrice ?? regionRange.high
  const bidInCurrency = convertFromUsd(car.currentBid)
  const pricePosition = fairHigh > fairLow
    ? Math.min(Math.max(((bidInCurrency - fairLow) / (fairHigh - fairLow)) * 100, 0), 100) : 50
  const isBelowFair = bidInCurrency < (fairLow + fairHigh) / 2

  const pricing = mobilePricing
  const bestRegion = findBestRegion(pricing)
  const maxRegionalUsd = Math.max(
    ...((["US", "EU", "UK", "JP"] as const).map(r =>
      (pricing[r].low + pricing[r].high) / 2
    ))
  )

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
    <div className="min-h-screen bg-background">
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
              className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border"
            >
              <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Link
                    href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ArrowLeft className="size-5" />
                  </Link>
                  <div>
                    <h1 className="text-[14px] font-semibold text-foreground">{car.title}</h1>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[18px] font-display font-medium text-primary">
                        {formatPrice(car.currentBid)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {getPriceLabel(car.platform, car.status).toLowerCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}/report`}
                  className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[11px] font-semibold uppercase text-primary-foreground active:bg-primary/80 transition-colors"
                >
                  <FileText className="size-3.5" />
                  Report
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ HERO SECTION — Swipeable gallery ═══ */}
        <div ref={heroRef} className="relative h-[40dvh] min-h-[340px]">
          {car.images && car.images.length > 1 ? (
            <div className="relative h-full w-full overflow-hidden">
              <div className="flex h-full overflow-x-auto snap-x snap-mandatory no-scrollbar">
                {car.images.slice(0, 8).map((img, i) => (
                  <div key={i} className="relative h-full w-full shrink-0 snap-center">
                    <Image src={img} alt={`${car.title} — ${i + 1}`} fill className="object-cover" priority={i === 0} referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
              {/* Photo counter */}
              <div className="absolute bottom-28 right-4 z-10 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-[10px] font-medium text-white/80">
                {car.images.length} photos
              </div>
            </div>
          ) : (
            <Image src={car.image} alt={car.title} fill className="object-cover" priority referrerPolicy="no-referrer" />
          )}
          {/* Always-dark gradient for text readability in both themes */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10 pointer-events-none" />

          {/* Fixed back button — always visible, large touch target */}
          <div className="absolute top-0 left-0 right-0 pt-safe px-4 pb-2 flex items-center justify-between z-10">
            <Link
              href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}`}
              className="flex items-center gap-2 px-3 py-2.5 rounded-full bg-black/40 backdrop-blur-md text-white/80 active:bg-black/60 transition-colors"
            >
              <ArrowLeft className="size-5" />
              <span className="text-[12px] font-medium">{t("backTo", { make: car.make })}</span>
            </Link>
          </div>

          {/* Badges */}
          <div className="absolute top-0 right-4 pt-safe flex items-center gap-2 z-10">
            {isLive && (
              <div className="flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-md px-3 py-1.5">
                <div className="size-2 rounded-full bg-positive animate-pulse" />
                <span className="text-[10px] font-medium text-positive">LIVE</span>
              </div>
            )}
            <div className="rounded-full px-3 py-1.5 text-[10px] font-medium backdrop-blur-md bg-black/40 text-white/70">
              {getPlatformName(car.platform)}
            </div>
          </div>

          {/* Title & Quick Stats — white text over dark gradient */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pb-10">
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-primary">
              {car.category}
            </span>
            <h1 className="mt-2 text-3xl font-display font-light text-white tracking-tight">{car.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wider">
                  {getPriceLabel(car.platform, car.status)}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-display font-medium text-primary">
                    {formatPrice(car.currentBid)}
                  </p>
                  <span className="text-[12px] tabular-nums font-semibold text-positive">{car.trend}</span>
                </div>
                {landedCostTeaser && (
                  <p className="mt-1 text-[11px] tabular-nums text-white/60 flex items-center gap-1.5">
                    <span>
                      Est. landed cost to {landedCostTeaser.destination}:{" "}
                      <span className="text-white/90 font-medium">
                        {formatPoint(
                          landedCostTeaser.amount,
                          landedCostTeaser.currency,
                          locale,
                        )}
                      </span>
                    </span>
                    <span
                      title="Estimated total to your country including shipping, duties, taxes, and fees. Full breakdown in Haus Report."
                      className="cursor-help opacity-60 text-[10px]"
                    >
                      ⓘ
                    </span>
                  </p>
                )}
              </div>
              {isLive && isAuctionPlatform(car.platform) && (
                <>
                  <div className="h-8 w-px bg-white/10" />
                  <div>
                    <p className="text-[10px] text-white/50 uppercase tracking-wider">{t("timeLeft")}</p>
                    <p className="text-xl font-bold text-destructive tabular-nums">{timeLeft(car.endTime)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ═══ INVESTMENT PASSPORT ═══ */}
        <div className="relative z-10 -mt-6 mx-4">
          <div className="rounded-2xl bg-card backdrop-blur-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="size-4 text-primary" />
              <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-primary">
                {t("investmentPassport.title")}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Cell 1: Trend */}
              <div className="rounded-xl bg-foreground/3 border border-border p-3">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Trend
                </span>
                <span className={`text-[28px] font-bold tabular-nums ${
                  car.trendValue > 0 ? "text-positive"
                  : car.trendValue < 0 ? "text-destructive"
                  : "text-muted-foreground"
                }`}>{car.trend}</span>
              </div>

              {/* Cell 2: Market Position */}
              <div className="rounded-xl bg-foreground/3 border border-border p-3">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  {t("investmentPassport.marketPosition")}
                </span>
                <div className="relative h-[6px] rounded-full bg-foreground/4 overflow-hidden mt-2 mb-1.5">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400/20 via-primary/20 to-red-400/20" />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 size-[8px] rounded-full bg-primary border-2 border-background shadow-lg shadow-primary/30"
                    style={{ left: `calc(${pricePosition}% - 4px)` }}
                  />
                </div>
                <span className={`text-[11px] font-medium ${isBelowFair ? "text-positive" : "text-destructive"}`}>
                  {isBelowFair ? t("investmentPassport.belowMarket") : t("investmentPassport.aboveMarket")}
                </span>
              </div>

              {/* Cell 3: Fair Value */}
              <div className="rounded-xl bg-foreground/3 border border-border p-3">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Fair Value
                </span>
                <span className="text-[22px] font-bold tabular-nums text-foreground">
                  {formatPrice(Math.round((regionRange.low + regionRange.high) / 2))}
                </span>
              </div>

              {/* Cell 4: Annual Cost */}
              <div className="rounded-xl bg-foreground/3 border border-border p-3">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  {t("investmentPassport.annualCost")}
                </span>
                <span className="text-[22px] font-bold tabular-nums text-foreground">
                  {totalAnnualCost ? formatPrice(totalAnnualCost) : "—"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {totalAnnualCost ? "/yr" : " pending"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ HAUS REPORT TEASER ═══ */}
        <div className="mx-4 mt-4">
          <HausReportTeaser
            reportExists={!!existingReport}
            userAlreadyPaid={userAlreadyPaid}
            onClick={handleOpenReport}
          />
        </div>

        {/* ═══ REPORT CTA — VISIBLE TO ALL ═══ */}
        <Link
          href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}/report`}
          className="mx-4 mt-4 flex items-center gap-4 rounded-2xl border border-primary/25 bg-primary/8 p-4 active:bg-primary/15 transition-colors"
        >
          <div className="size-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <FileText className="size-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-foreground">Full Investment Report</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Valuation · Risks · Comps · Costs</p>
          </div>
          <span className="shrink-0 rounded-xl bg-primary px-4 py-2 text-[12px] font-bold text-primary-foreground">
            View
            <ChevronRight className="inline size-3.5 ml-0.5 -mr-0.5" />
          </span>
        </Link>

        {/* ═══ CONTINUOUS SCROLL CONTENT ═══ */}
        <div className="px-4 py-6 space-y-4 pb-32">

          {/* 1. About This Vehicle */}
          <div className="rounded-2xl bg-primary/6 border border-primary/15 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-primary" />
                <h2 className="text-[13px] font-semibold text-primary">{t("aboutThisVehicle")}</h2>
              </div>
              <span className="text-[9px] text-primary/50 bg-primary/8 px-2 py-0.5 rounded">{t("editorial")}</span>
            </div>
            <ListingHook
              listingId={car.id}
              fallback={
                <p className="text-[14px] leading-relaxed text-muted-foreground whitespace-pre-line">{stripHtml(car.thesis)}</p>
              }
            />
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
            <div className="border-l-2 border-primary/20 pl-4">
              <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-line">{stripHtml(car.history)}</p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 italic">{t("source", { platform: car.platform.replace(/_/g, " ") })}</p>
          </CollapsibleSection>

          {/* 4. Regional Valuation */}
          <div className="rounded-xl bg-card border border-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {t("regionalValuation")}
              </span>
            </div>
            <div className="space-y-2.5">
              {(["US", "UK", "EU", "JP"] as const).map(region => {
                const rp = pricing[region]
                const isBest = bestRegion === region
                const isSelected = region === effectiveRegion
                const usdAvg = (rp.low + rp.high) / 2
                const barWidth = (usdAvg / maxRegionalUsd) * 100
                return (
                  <div key={region} className={isSelected ? "rounded-lg bg-primary/4 -mx-2 px-2 py-1.5" : ""}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px]">{regionLabels[region].flag}</span>
                        <span className={`text-[11px] font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{region}</span>
                        {isBest && <span className="text-[8px] font-bold text-positive tracking-wide">BEST</span>}
                        {isSelected && <span className="text-[8px] font-bold text-primary tracking-wide">YOUR MARKET</span>}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[11px] tabular-nums font-semibold text-foreground">
                          {formatRegionalPrice(rp.low, rp.currency)}
                        </span>
                        <span className="text-[9px] text-muted-foreground">→</span>
                        <span className={`text-[11px] tabular-nums font-semibold ${isBest ? "text-positive" : "text-primary"}`}>
                          {formatRegionalPrice(rp.high, rp.currency)}
                        </span>
                      </div>
                    </div>
                    <div className="h-[6px] rounded-full bg-foreground/4 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isBest ? "bg-gradient-to-r from-emerald-400/30 to-emerald-400/60" : isSelected ? "bg-gradient-to-r from-primary/40 to-primary/70" : "bg-gradient-to-r from-primary/25 to-primary/50"}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 5. Market Position */}
          <div className="rounded-xl bg-primary/3 border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Market Position
              </span>
            </div>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-muted-foreground">Price vs Fair Value</span>
                <span className={`text-[11px] tabular-nums font-bold ${pricePosition <= 90 ? "text-positive" : pricePosition <= 110 ? "text-primary" : "text-destructive"}`}>
                  {pricePosition}%
                </span>
              </div>
              <div className="h-[8px] rounded-full bg-foreground/4 overflow-hidden">
                <div
                  className={`h-full rounded-full ${pricePosition <= 90 ? "bg-positive/50" : pricePosition <= 110 ? "bg-primary/50" : "bg-destructive/50"}`}
                  style={{ width: `${Math.min(pricePosition, 150) / 1.5}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] text-muted-foreground">{formatPrice(regionRange.low)}</span>
                <span className="text-[9px] text-muted-foreground">{formatPrice(regionRange.high)}</span>
              </div>
            </div>
            <div className="rounded-lg bg-foreground/3 border border-border px-3 py-2">
              <span className="text-[11px] text-muted-foreground">
                {pricePosition <= 85
                  ? "Priced well below fair value — strong buyer opportunity"
                  : pricePosition <= 100
                    ? "Priced within the lower half of fair value range"
                    : pricePosition <= 115
                      ? "Priced at market — fair value for current conditions"
                      : "Priced above fair value — verify condition justifies premium"}
              </span>
            </div>
          </div>

          {/* 7. Sale Information */}
          <div className="rounded-xl bg-card border border-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="size-4 text-primary" />
              <h2 className="text-[13px] font-semibold text-foreground">{t("saleInformation")}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3 bg-foreground/2 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t("platform")}</p>
                <p className="text-[14px] font-semibold text-foreground">{car.platform.replace(/_/g, " ")}</p>
              </div>
              <div className="rounded-xl p-3 bg-foreground/2 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  {getPriceLabel(car.platform, car.status)}
                </p>
                <p className="text-[14px] font-display font-medium text-primary">{formatPrice(car.currentBid)}</p>
              </div>
              {isAuctionPlatform(car.platform) && (
              <div className="rounded-xl p-3 bg-foreground/2 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t("bids")}</p>
                <p className="text-[14px] font-semibold text-foreground">{car.bidCount}</p>
              </div>
              )}
              <div className="rounded-xl p-3 bg-foreground/2 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t("status")}</p>
                <p className={`text-[14px] font-semibold ${car.status === "ACTIVE" || car.status === "ENDING_SOON" ? "text-positive" : "text-muted-foreground"}`}>
                  {getStatusLabel(car.platform, car.status)}
                </p>
              </div>
            </div>
          </div>

          {/* 8. Key Inspection Points */}
          <CollapsibleSection
            title={t("keyInspectionPoints")}
            icon={<AlertTriangle className="size-5" />}
            defaultOpen
            badge={<span className="text-[10px] text-primary/60 bg-primary/10 px-2 py-0.5 rounded-full">{flags.length} items</span>}
          >
            {flags.length > 0 ? (
              <div className="space-y-2">
                {flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-primary/3">
                    <AlertTriangle className="size-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-[13px] text-foreground">{flag}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground italic">Awaiting backend analysis</p>
            )}
          </CollapsibleSection>

          {/* 9. Questions to Ask Seller */}
          <CollapsibleSection
            title={t("questionsToAsk")}
            icon={<HelpCircle className="size-5" />}
            badge={<span className="text-[10px] text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-full">{questions.length}</span>}
          >
            {questions.length > 0 ? (
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-foreground/2">
                    <span className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-[13px] text-muted-foreground">{q}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground italic">Awaiting backend analysis</p>
            )}
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
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-foreground/2">
                  <span className="text-[13px] text-muted-foreground">{check.item}</span>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                    check.critical ? "bg-primary/15 text-primary" : "bg-muted-foreground/20 text-muted-foreground"
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
          >
            {comps.length > 0 ? (
              <div className="space-y-3">
                {comps.map((sale, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-foreground/2 border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{sale.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{sale.date} · {sale.platform}</p>
                    </div>
                    <p className="text-[16px] font-bold tabular-nums text-foreground shrink-0 ml-3">{formatPrice(sale.price)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground italic">Awaiting backend data</p>
            )}
          </CollapsibleSection>

          {/* 12. Ownership Cost & Shipping */}
          <CollapsibleSection title={t("ownershipAndShipping")} icon={<Wrench className="size-5" />}>
            {costs || shipping ? (
              <div className="space-y-3">
                {costs && (
                  <>
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <div className="flex items-center gap-3">
                        <Shield className="size-4 text-muted-foreground" />
                        <span className="text-[13px] text-muted-foreground">{t("ownershipCosts.insurance")}</span>
                      </div>
                      <span className="text-[14px] tabular-nums font-semibold text-foreground">
                        {costs.insurance == null ? "—" : formatPrice(costs.insurance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <div className="flex items-center gap-3">
                        <MapPin className="size-4 text-muted-foreground" />
                        <span className="text-[13px] text-muted-foreground">{t("ownershipCosts.storage")}</span>
                      </div>
                      <span className="text-[14px] tabular-nums font-semibold text-foreground">
                        {costs.storage == null ? "—" : formatPrice(costs.storage)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <div className="flex items-center gap-3">
                        <Wrench className="size-4 text-muted-foreground" />
                        <span className="text-[13px] text-muted-foreground">{t("ownershipCosts.service")}</span>
                      </div>
                      <span className="text-[14px] tabular-nums font-semibold text-foreground">
                        {costs.maintenance == null ? "—" : formatPrice(costs.maintenance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[13px] font-semibold text-foreground">{t("totalAnnual")}</span>
                      <span className="text-[18px] font-display font-medium text-primary">
                        {totalAnnualCost ? `${formatPrice(totalAnnualCost)}/yr` : "—"}
                      </span>
                    </div>
                  </>
                )}
                {shipping && (
                  <div className="border-t border-border pt-3 mt-1">
                    <div className="flex items-center gap-2 mb-3">
                      <Truck className="size-4 text-primary" />
                      <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                        Shipping Estimates
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-foreground/2">
                        <span className="text-[13px] text-muted-foreground">{t("domestic")}</span>
                        <span className="text-[14px] tabular-nums font-semibold text-foreground">{formatPrice(shipping.domestic)}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-foreground/2">
                        <span className="text-[13px] text-muted-foreground">{t("euImport")}</span>
                        <span className="text-[14px] tabular-nums font-semibold text-foreground">{formatPrice(shipping.euImport)}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-foreground/2">
                        <span className="text-[13px] text-muted-foreground">{t("ukImport")}</span>
                        <span className="text-[14px] tabular-nums font-semibold text-foreground">{formatPrice(shipping.ukImport)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground italic">Awaiting backend data</p>
            )}
          </CollapsibleSection>

          {/* 13. Events & Community */}
          <CollapsibleSection title={t("eventsAndCommunity")} icon={<Users className="size-5" />}>
            {events.length > 0 ? (
              <div className="space-y-2">
                {events.map((event, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-foreground/2">
                    <div className="flex items-center gap-3">
                      <span className={`size-2 rounded-full ${
                        event.impact === "positive" ? "bg-positive" :
                        event.impact === "negative" ? "bg-destructive" : "bg-muted-foreground"
                      }`} />
                      <div>
                        <p className="text-[13px] text-foreground">{event.name}</p>
                        <p className="text-[10px] text-muted-foreground">{event.type}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                      event.impact === "positive" ? "bg-positive/10 text-positive" :
                      event.impact === "negative" ? "bg-destructive/10 text-destructive" :
                      "bg-foreground/5 text-muted-foreground"
                    }`}>
                      {event.impact === "positive" ? "Value +" : event.impact === "negative" ? "Value -" : "Neutral"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground italic">Awaiting backend data</p>
            )}
          </CollapsibleSection>

          {/* 14. Similar Cars */}
          {similarCars.length > 0 && (
            <CollapsibleSection title={t("similarVehicles", { count: similarCars.length })} icon={<Car className="size-5" />} defaultOpen>
              <div className="space-y-3">
                {similarCars.slice(0, 4).map(c => (
                  <SimilarCarCard key={c.car.id} car={c.car} matchReasons={c.matchReasons} />
                ))}
              </div>
            </CollapsibleSection>
          )}

        </div>

        {/* ═══ MOBILE CTA ═══ */}
        <MobileCarCTA
          carId={car.id}
          make={car.make}
          sourceUrl={car.sourceUrl}
          platform={car.platform}
          onOpenAdvisor={() => setShowAdvisorChat(true)}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          DESKTOP LAYOUT (3-column grid)
          ═══════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex h-[100dvh] w-full flex-col bg-background overflow-hidden pt-[var(--app-header-h,80px)]">
        <div className="flex-1 min-h-0 grid grid-cols-[22%_1fr_28%] grid-rows-[1fr] overflow-hidden">

          {/* COLUMN A: LEFT SIDEBAR */}
          <CarNavSidebar car={car} similarCars={similarCars} dbAnalysis={dbAnalysis} />

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
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                {/* Overlays on hero */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  {isLive && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-positive/30">
                      <div className="size-1.5 rounded-full bg-positive animate-pulse" />
                      <span className="text-[10px] font-semibold text-positive">LIVE</span>
                    </span>
                  )}
                </div>
                {/* Bottom text on hero */}
                <div className="absolute bottom-4 left-4 right-4">
                  <span className="text-[9px] font-semibold tracking-[0.25em] uppercase text-primary">
                    {car.category}
                  </span>
                  <h1 className="text-2xl font-display font-light text-white mt-1">{car.title}</h1>
                </div>
              </div>

              {/* ABOUT THIS VEHICLE */}
              <div className="rounded-xl bg-primary/6 border border-primary/15 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="size-1.5 rounded-full bg-primary" />
                    <h2 className="text-[12px] font-semibold text-primary">{t("aboutThisVehicle")}</h2>
                  </div>
                  <span className="text-[9px] text-primary/50 bg-primary/8 px-2 py-0.5 rounded">{t("editorial")}</span>
                </div>
                <ListingHook
                  listingId={car.id}
                  fallback={
                    <p className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-line">{stripHtml(car.thesis)}</p>
                  }
                />
              </div>

              {/* HAUS REPORT TEASER */}
              <HausReportTeaser
                reportExists={!!existingReport}
                userAlreadyPaid={userAlreadyPaid}
                onClick={handleOpenReport}
              />

              {/* PROVENANCE */}
              <div className="rounded-xl bg-card border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <History className="size-4 text-primary" />
                  <h2 className="text-[12px] font-semibold text-foreground">{t("sellersDescription")}</h2>
                </div>
                <div className="border-l-2 border-primary/20 pl-4">
                  <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-line">{stripHtml(car.history)}</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 italic">{t("source", { platform: car.platform.replace(/_/g, " ") })}</p>
              </div>

              {/* KEY INSPECTION POINTS */}
              <div className="rounded-xl bg-card border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="size-4 text-primary" />
                  <h2 className="text-[12px] font-semibold text-foreground">Key Inspection Points</h2>
                  <span className="text-[9px] text-primary/60 bg-primary/10 px-2 py-0.5 rounded-full">{flags.length}</span>
                </div>
                {flags.length > 0 ? (
                  <div className="space-y-2">
                    {flags.map((flag, i) => (
                      <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-primary/3">
                        <AlertTriangle className="size-3.5 text-primary mt-0.5 shrink-0" />
                        <span className="text-[12px] text-foreground">{flag}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground italic">Awaiting backend analysis</p>
                )}
              </div>

              {/* QUESTIONS TO ASK */}
              <div className="rounded-xl bg-card border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <HelpCircle className="size-4 text-primary" />
                  <h2 className="text-[12px] font-semibold text-foreground">Questions to Ask the Seller</h2>
                </div>
                {questions.length > 0 ? (
                  <div className="space-y-2">
                    {questions.map((q, i) => (
                      <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-foreground/2">
                        <span className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-[9px] font-bold text-primary shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-[12px] text-muted-foreground">{q}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground italic">Awaiting backend analysis</p>
                )}
              </div>

              {/* PRE-PURCHASE INSPECTION */}
              <div className="rounded-xl bg-card border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="size-4 text-primary" />
                  <h2 className="text-[12px] font-semibold text-foreground">Pre-Purchase Inspection</h2>
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
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-foreground/2">
                      <span className="text-[12px] text-muted-foreground">{check.item}</span>
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                        check.critical ? "bg-primary/15 text-primary" : "bg-muted-foreground/20 text-muted-foreground"
                      }`}>
                        {check.critical ? "Critical" : "Recommended"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* COMPARABLE SALES */}
              <div className="rounded-xl bg-card border border-border p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="size-4 text-primary" />
                    <h2 className="text-[12px] font-semibold text-foreground">Recent Comparable Sales</h2>
                  </div>
                </div>
                {comps.length > 0 ? (
                  <div className="space-y-2">
                    {comps.map((sale, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-foreground/2 border border-border/50">
                        <div>
                          <p className="text-[12px] font-medium text-foreground">{sale.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{sale.date} · {sale.platform}</p>
                        </div>
                        <span className="text-[14px] tabular-nums font-bold text-foreground">{formatPrice(sale.price)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground italic">Awaiting backend data</p>
                )}
              </div>

              {/* FULL REPORT CTA */}
              <Link
                href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}/report`}
                className="block rounded-xl border border-primary/15 bg-primary/4 p-5 hover:bg-primary/6 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="size-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground">Full Investment Report</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Valuation, risks, comps &amp; ownership costs</p>
                  </div>
                  <span className="flex items-center gap-2 shrink-0 rounded-lg bg-primary px-5 py-2.5 text-[12px] font-semibold text-primary-foreground">
                    View Report
                    <ChevronRight className="size-4" />
                  </span>
                </div>
              </Link>

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
            <div className="absolute inset-0 bg-background/60 backdrop-blur-md" />
            <div className="absolute inset-x-0 top-0 h-[45vh] bg-gradient-to-b from-transparent via-transparent to-background/85" />

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.15 }}
              className="relative w-full max-w-md mx-4 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl overflow-hidden"
            >
              <div className="h-0.5 bg-gradient-to-r from-primary via-primary/40 to-transparent" />

              <div className="px-6 pt-8 pb-2 text-center">
                <h3 className="text-xl font-bold text-foreground">
                  Sign up to continue
                </h3>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Create a free account to explore this vehicle
                </p>
              </div>

              <div className="px-6 pt-5 pb-4">
                <button
                  onClick={handleGoogleSignIn}
                  type="button"
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-[13px] hover:bg-primary/80 transition-all"
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
                <div className="flex-1 h-px bg-foreground/10" />
                <span className="text-[10px] text-muted-foreground">or use email</span>
                <div className="flex-1 h-px bg-foreground/10" />
              </div>

              <form onSubmit={handleGateSubmit} className="px-6 pb-6 space-y-3">
                <div>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={gateName}
                      onChange={(e) => { setGateName(e.target.value); setGateErrors(prev => ({ ...prev, name: false })) }}
                      placeholder="Your name"
                      className={`w-full bg-foreground/3 border rounded-xl pl-10 pr-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors ${
                        gateErrors.name ? "border-destructive/50" : "border-border focus:border-primary/50"
                      }`}
                    />
                  </div>
                  {gateErrors.name && <p className="text-[10px] text-destructive mt-1 pl-1">Enter your name</p>}
                </div>

                <div>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={gateEmail}
                      onChange={(e) => { setGateEmail(e.target.value); setGateErrors(prev => ({ ...prev, email: false })) }}
                      placeholder="your@email.com"
                      className={`w-full bg-foreground/3 border rounded-xl pl-10 pr-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors ${
                        gateErrors.email ? "border-destructive/50" : "border-border focus:border-primary/50"
                      }`}
                    />
                  </div>
                  {gateErrors.email && <p className="text-[10px] text-destructive mt-1 pl-1">Enter a valid email</p>}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl border border-border text-foreground font-medium text-[13px] hover:bg-white/[0.05] transition-all"
                >
                  Sign up with email
                </button>

                <p className="text-[10px] text-muted-foreground text-center pt-1">
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
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm" onClick={() => setShowWelcome(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm mx-4 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
            >
              <div className="px-6 pt-7 pb-4 text-center">
                <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Coins className="size-7 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Welcome to Monza
                </h3>
                <p className="text-3xl tabular-nums font-black text-primary mt-2">
                  300 Pistons
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  have been added to your account
                </p>
              </div>

              <div className="px-6 pb-5">
                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-3">
                  How it works
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="size-7 rounded-full bg-foreground/5 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[11px] font-bold text-primary">1</span>
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-foreground">Browse all vehicles freely</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Explore every car, model, and brand at no cost</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="size-7 rounded-full bg-foreground/5 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[11px] font-bold text-primary">2</span>
                  </div>
                  <div>
                      <p className="text-[12px] font-medium text-foreground">Generate full analyses with Pistons</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Each report costs 100 Pistons &mdash; you have 300 free each month</p>
                  </div>
                </div>
                  <div className="flex items-start gap-3">
                    <div className="size-7 rounded-full bg-foreground/5 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[11px] font-bold text-primary">3</span>
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-foreground">Download or receive by email</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Re-downloading a report you already generated is free</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6">
                <button
                  onClick={() => setShowWelcome(false)}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-[13px] hover:bg-primary/80 transition-all"
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
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm" onClick={() => { setShowAnalysisPopup(false); setAnalysisSent(false) }} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm mx-4 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
            >
              <div className="h-0.5 bg-gradient-to-r from-primary via-primary/40 to-transparent" />

              {analysisSent ? (
                <div className="px-6 py-10 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="size-14 rounded-full bg-positive/10 flex items-center justify-center mx-auto mb-4"
                  >
                    <CheckCircle2 className="size-7 text-positive" />
                  </motion.div>
                  <h3 className="text-lg font-bold text-foreground">Analysis sent!</h3>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    Check your inbox at {user?.email}
                  </p>
                </div>
              ) : (
                <>
                  <div className="px-6 pt-6 pb-4 text-center">
                    <h3 className="text-lg font-bold text-foreground">
                      Your analysis is ready
                    </h3>
                    <p className="text-[12px] text-muted-foreground mt-1">
                      {car.title}
                    </p>
                  </div>

                  <div className="px-6 pb-6 space-y-3">
                    <button
                      onClick={handleSendAnalysis}
                      className="w-full flex items-center gap-4 rounded-xl bg-primary px-5 py-4 text-left hover:bg-primary/80 transition-all group"
                    >
                      <div className="size-10 rounded-full bg-background/10 flex items-center justify-center shrink-0">
                        <Send className="size-5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-primary-foreground">Send to my email</p>
                        <p className="text-[11px] text-primary-foreground/60">{user?.email}</p>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowAnalysisPopup(false)
                      }}
                      className="w-full flex items-center gap-4 rounded-xl border border-border px-5 py-4 text-left hover:bg-foreground/3 transition-all group"
                    >
                      <div className="size-10 rounded-full bg-foreground/5 flex items-center justify-center shrink-0">
                        <Download className="size-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-foreground">Download PDF</p>
                        <p className="text-[11px] text-muted-foreground">Full investment report</p>
                      </div>
                    </button>

                    {!hasAnalyzed(car.id) && (
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <Coins className="size-3.5 text-primary" />
                        <span className="text-[11px] text-muted-foreground">
                          100 Pistons used &middot; {tokens.toLocaleString()} remaining
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
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm" onClick={() => setShowPaywall(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm mx-4 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
            >
              <div className="h-0.5 bg-gradient-to-r from-primary via-primary/40 to-transparent" />

              <div className="px-6 pt-7 pb-6 text-center">
                <div className="size-14 rounded-full bg-foreground/5 flex items-center justify-center mx-auto mb-4">
                  <Coins className="size-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  You&apos;ve used your free analyses
                </h3>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Get unlimited access to all vehicle reports
                </p>

                <div className="mt-5 space-y-2 text-left">
                  {[
                    "Unlimited vehicle analyses",
                    "Real-time price alerts",
                    "Personal collector advisor",
                  ].map((benefit) => (
                    <div key={benefit} className="flex items-center gap-2.5">
                      <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                      <span className="text-[12px] text-muted-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>

                <a
                  href={`https://wa.me/573208492641?text=${encodeURIComponent(
                    `Hi, I'd like to upgrade to Monza Premium for unlimited analyses.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 mt-6 rounded-xl bg-primary text-primary-foreground font-semibold text-[13px] hover:bg-primary/80 transition-all"
                >
                  <MessageCircle className="size-4" />
                  Contact us to upgrade
                </a>

                <button
                  onClick={() => setShowPaywall(false)}
                  className="w-full py-3 mt-2 text-[12px] text-muted-foreground hover:text-muted-foreground transition-colors"
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
        conversationId={openChatConversationId ?? null}
        initialContext={{
          car,
          make: car.make,
          dbMarketData,
          dbComparables,
          dbAnalysis,
          dbSoldHistory,
        }}
      />
    </div>
  )
}
