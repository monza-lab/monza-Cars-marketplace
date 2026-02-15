"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { Link, useRouter } from "@/i18n/navigation"
import Image from "next/image"
import { useLocale, useTranslations } from "next-intl"
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  Gavel,
  Gauge,
  Cog,
  Paintbrush,
  MapPin,
  Calendar,
  Car,
  Sparkles,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  DollarSign,
  BarChart3,
  Target,
  Zap,
  FileText,
  MessageCircle,
  Database,
  Fingerprint,
  History,
  Palette,
  BadgeCheck,
} from "lucide-react"
import { PriceChart } from "@/components/auction/PriceChart"
import type { PriceHistoryEntry } from "@/types/auction"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuctionBid {
  id: string
  amount: number
  bidder: string
  timestamp: string
}

interface AuctionAnalysis {
  id: string
  summary: string
  marketPosition: string
  conditionAssessment: string
  pricePrediction: {
    low: number
    mid: number
    high: number
    confidence: number
  }
  pros: string[]
  cons: string[]
  comparableSales: {
    title: string
    price: number
    date: string
    platform: string
  }[]
  riskFactors: string[]
  recommendation: string
  score: number
  createdAt: string
}

interface AuctionDetail {
  id: string
  title: string
  year: number
  make: string
  model: string
  trim: string | null
  platform: string
  platformUrl: string
  imageUrl: string | null
  images: string[]
  currentBid: number | null
  bidCount: number
  endDate: string
  status: "active" | "ended" | "upcoming"
  reserveStatus: "met" | "not_met" | "no_reserve" | "unknown"
  mileage: number | null
  transmission: string | null
  engine: string | null
  drivetrain: string | null
  exteriorColor: string | null
  interiorColor: string | null
  vin: string | null
  location: string | null
  description: string | null
  sellerNotes: string | null
  bids: AuctionBid[]
  analysis: AuctionAnalysis | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Mock Data for Deep Analytics
// ---------------------------------------------------------------------------

const KNOWN_MAKE_KEYS = ["Lamborghini", "Porsche", "Ferrari", "Nissan"] as const
type KnownMakeKey = (typeof KNOWN_MAKE_KEYS)[number]
type MakeKey = KnownMakeKey | "default"

function getMakeKey(make: string): MakeKey {
  return (KNOWN_MAKE_KEYS as readonly string[]).includes(make)
    ? (make as KnownMakeKey)
    : "default"
}

const mockFinancials: Record<string, { holding: number; appreciation: string; maintenance: number; insurance: number }> = {
  Lamborghini: { holding: 45000, appreciation: "+9%", maintenance: 25000, insurance: 18000 },
  Porsche: { holding: 12000, appreciation: "+8%", maintenance: 6000, insurance: 5500 },
  Ferrari: { holding: 35000, appreciation: "+10%", maintenance: 18000, insurance: 15000 },
  Nissan: { holding: 8000, appreciation: "+15%", maintenance: 4000, insurance: 3500 },
  default: { holding: 6000, appreciation: "+5%", maintenance: 3500, insurance: 2500 },
}

// ---------------------------------------------------------------------------
// Mock Registry Intelligence Data
// ---------------------------------------------------------------------------

interface RegistrySpotting {
  year: number
  event: string
  location: string
  source?: string
}

interface RegistryConfig {
  exteriorColor: string
  exteriorCode: string
  interiorColor: string
  interiorMaterial: string
  keyOptions: string[]
}

interface RegistryData {
  chassisPrefix: string
  productionSequence: string
  totalProduced: number
  config: RegistryConfig
  spottings: RegistrySpotting[]
  verified: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number | null, locale: string): string {
  if (amount === null) return "—"
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatShort(n: number, locale: string): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })}M`
  if (n >= 1_000) return `$${(n / 1_000).toLocaleString(locale, { maximumFractionDigits: 0 })}K`
  return `$${n.toLocaleString(locale)}`
}

function timeLeft(
  endTime: string,
  labels: { ended: string; day: string; hour: string; minute: string }
): string {
  const diff = new Date(endTime).getTime() - Date.now()
  if (diff <= 0) return labels.ended
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}${labels.day} ${hrs}${labels.hour}`
  const mins = Math.floor((diff % 3600000) / 60000)
  return `${hrs}${labels.hour} ${mins}${labels.minute}`
}

// ---------------------------------------------------------------------------
// Image Gallery Component
// ---------------------------------------------------------------------------

function StickyGallery({ images, title }: { images: string[]; title: string }) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="sticky top-[100px] h-[calc(100vh-120px)]">
        <div className="h-full rounded-2xl bg-[rgba(15,14,22,0.6)] border border-[rgba(248,180,217,0.1)] flex items-center justify-center">
          <Car className="size-20 text-[rgba(255,252,247,0.1)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="sticky top-[100px] h-[calc(100vh-120px)] flex flex-col gap-3">
      {/* Main Image */}
      <div className="relative flex-1 rounded-2xl overflow-hidden bg-[rgba(15,14,22,0.6)] border border-[rgba(248,180,217,0.1)] group">
        <Image
          src={images[currentIndex]}
          alt={`${title} - ${currentIndex + 1}`}
          fill
          className="object-cover"
          sizes="50vw"
          priority
          referrerPolicy="no-referrer"
          unoptimized
        />

        {/* Navigation */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrentIndex((p) => (p === 0 ? images.length - 1 : p - 1))}
              className="absolute left-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-[#0b0b10]/70 backdrop-blur-md flex items-center justify-center text-[#FFFCF7] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#0b0b10]"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => setCurrentIndex((p) => (p === images.length - 1 ? 0 : p + 1))}
              className="absolute right-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-[#0b0b10]/70 backdrop-blur-md flex items-center justify-center text-[#FFFCF7] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#0b0b10]"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}

        {/* Counter */}
        <div className="absolute bottom-4 right-4 rounded-full bg-[#0b0b10]/70 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-[#FFFCF7]">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {images.slice(0, 6).map((img, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`relative h-16 w-24 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                idx === currentIndex
                  ? "border-[#F8B4D9] shadow-lg shadow-[#F8B4D9]/20"
                  : "border-[rgba(248,180,217,0.1)] opacity-60 hover:opacity-100"
              }`}
            >
              <Image src={img} alt={`Thumb ${idx + 1}`} fill className="object-cover" sizes="96px" referrerPolicy="no-referrer" unoptimized />
            </button>
          ))}
          {images.length > 6 && (
            <div className="h-16 w-24 shrink-0 rounded-lg bg-[rgba(15,14,22,0.6)] border border-[rgba(248,180,217,0.1)] flex items-center justify-center">
              <span className="text-[12px] text-[rgba(255,252,247,0.5)]">+{images.length - 6}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MODULE A: Executive Summary + Buy Box
// ---------------------------------------------------------------------------

function ExecutiveSummary({
  auction,
  t,
  locale,
}: {
  auction: AuctionDetail
  t: ReturnType<typeof useTranslations>
  locale: string
}) {
  const isLive = auction.status === "active"
  const bidTargetLow = auction.analysis?.pricePrediction.low || auction.currentBid! * 1.05
  const bidTargetHigh = auction.analysis?.pricePrediction.high || auction.currentBid! * 1.15

  return (
    <div className="border-b border-[rgba(255,255,255,0.05)] pb-6">
      {/* Title */}
      <h1 className="text-3xl font-bold text-[#FFFCF7] tracking-tight leading-tight">
        {auction.year} {auction.make} {auction.model}
      </h1>
      {auction.trim && (
        <p className="text-[15px] text-[rgba(255,252,247,0.5)] mt-1">{auction.trim}</p>
      )}

      {/* The Buy Box */}
      <div className="mt-6 rounded-xl bg-[rgba(248,180,217,0.04)] border border-[rgba(248,180,217,0.1)] p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Current Bid */}
          <div>
            <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-[rgba(255,252,247,0.4)]">
              {isLive ? t("labels.currentBid") : t("labels.finalPrice")}
            </p>
            <p className="text-4xl font-bold text-[#FFFCF7] font-mono mt-1">
              {formatCurrency(auction.currentBid, locale)}
            </p>
            <div className="flex items-center gap-3 mt-2 text-[rgba(255,252,247,0.5)]">
              <span className="flex items-center gap-1 text-[12px]">
                <Gavel className="size-3" />
                {t("bids.count", { count: auction.bidCount })}
              </span>
              {isLive && (
                <span className="flex items-center gap-1 text-[12px]">
                  <Clock className="size-3" />
                  {timeLeft(auction.endDate, {
                    ended: t("time.ended"),
                    day: t("time.units.day"),
                    hour: t("time.units.hour"),
                    minute: t("time.units.minute"),
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Bid Target */}
          <div className="text-right">
            <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#F8B4D9]">
              {t("labels.recommendedCap")}
            </p>
            <p className="text-2xl font-bold text-[#F8B4D9] font-mono mt-1">
              {formatShort(bidTargetLow, locale)} — {formatShort(bidTargetHigh, locale)}
            </p>
            <p className="text-[11px] text-[rgba(255,252,247,0.4)] mt-1">
              {t("labels.basedOnMarketAnalysis")}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-5">
          {isLive && (
            <button className="flex-1 rounded-full bg-[#F8B4D9] py-3.5 text-[13px] font-semibold tracking-[0.05em] uppercase text-[#0b0b10] hover:bg-[#f4cbde] transition-colors">
              {t("actions.placeBid")}
            </button>
          )}
          <a
            href={auction.platformUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-full border border-[rgba(248,180,217,0.2)] py-3.5 text-center text-[13px] font-medium tracking-[0.05em] uppercase text-[rgba(255,252,247,0.7)] hover:text-[#FFFCF7] hover:border-[rgba(248,180,217,0.4)] transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink className="size-4" />
            {t("actions.viewOriginalListing")}
          </a>
        </div>

        {/* WhatsApp Concierge */}
        <a
          href={`https://wa.me/573208492641?text=${encodeURIComponent(
            t("whatsapp.prefill", {
              year: auction.year,
              make: auction.make,
              model: auction.model,
            })
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2.5 rounded-full border border-[#F8B4D9]/40 bg-[rgba(15,14,22,0.8)] backdrop-blur-md py-3.5 text-[13px] font-medium tracking-[0.05em] uppercase text-[#FFFCF7] hover:border-[#F8B4D9]/70 hover:bg-[rgba(248,180,217,0.08)] transition-all group"
        >
          <MessageCircle className="size-4 text-[#F8B4D9] group-hover:scale-110 transition-transform" />
          <span>{t("actions.chatWithAnalyst")}</span>
        </a>
      </div>

      {/* Quick Specs */}
      <div className="mt-5 grid grid-cols-4 gap-3">
        {[
          {
            label: t("specs.mileage"),
            value: auction.mileage
              ? `${auction.mileage.toLocaleString(locale)} ${t("units.miles")}`
              : "—",
            icon: Gauge,
          },
          { label: t("specs.engine"), value: auction.engine || "—", icon: Cog },
          { label: t("specs.transmission"), value: auction.transmission || "—", icon: Cog },
          { label: t("specs.location"), value: auction.location || "—", icon: MapPin },
        ].map((spec) => (
          <div key={spec.label} className="space-y-1">
            <div className="flex items-center gap-1 text-[rgba(255,252,247,0.4)]">
              <spec.icon className="size-3" />
              <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{spec.label}</span>
            </div>
            <p className="text-[13px] text-[#FFFCF7] truncate">{spec.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MODULE B: Strategy & Alpha
// ---------------------------------------------------------------------------

function StrategyModule({
  auction,
  t,
}: {
  auction: AuctionDetail
  t: ReturnType<typeof useTranslations>
}) {
  const makeKey = getMakeKey(auction.make)
  const score = auction.analysis?.score || 75

  return (
    <div className="border-b border-[rgba(255,255,255,0.05)] py-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="size-4 text-[#F8B4D9]" />
        <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#F8B4D9]">
          {t("modules.strategyInsights")}
        </h2>
      </div>

      <p className="text-[14px] leading-relaxed text-[rgba(255,252,247,0.8)]">
        {t(`mock.strategy.${makeKey}.strategy`)}
      </p>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mt-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase ${
          score >= 80 ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" :
          score >= 60 ? "bg-[rgba(248,180,217,0.1)] text-[#F8B4D9] border border-[rgba(248,180,217,0.2)]" :
          "bg-amber-500/15 text-amber-400 border border-amber-500/30"
        }`}>
          <Target className="size-3" />
          {t("labels.grade")} {score >= 80 ? "AAA" : score >= 60 ? "AA" : "A"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-[10px] font-medium text-[rgba(255,252,247,0.6)] border border-[rgba(255,255,255,0.08)]">
          {t("labels.complexity")}: {t(`mock.strategy.${makeKey}.complexity`)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-[10px] font-medium text-[rgba(255,252,247,0.6)] border border-[rgba(255,255,255,0.08)]">
          {t("labels.demand")}: {t(`mock.strategy.${makeKey}.demand`)}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MODULE C: Financial Projection
// ---------------------------------------------------------------------------

function FinancialsModule({
  auction,
  t,
  locale,
}: {
  auction: AuctionDetail
  t: ReturnType<typeof useTranslations>
  locale: string
}) {
  const [period, setPeriod] = useState<1 | 3 | 5>(1)
  const data = mockFinancials[auction.make] || mockFinancials.default
  const currentValue = auction.currentBid || 100000

  const appreciationRate = parseFloat(data.appreciation) / 100
  const projectedValue = currentValue * Math.pow(1 + appreciationRate, period)
  const totalHoldingCost = data.holding * period
  const netGain = projectedValue - currentValue - totalHoldingCost

  return (
    <div className="border-b border-[rgba(255,255,255,0.05)] py-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-[#F8B4D9]" />
          <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#F8B4D9]">
            {t("modules.financialProjection")}
          </h2>
        </div>

        {/* Period Tabs */}
        <div className="flex rounded-full bg-[rgba(255,255,255,0.04)] p-0.5">
          {[1, 3, 5].map((y) => (
            <button
              key={y}
              onClick={() => setPeriod(y as 1 | 3 | 5)}
              className={`px-3 py-1 rounded-full text-[10px] font-medium transition-all ${
                period === y
                  ? "bg-[#F8B4D9] text-[#0b0b10]"
                  : "text-[rgba(255,252,247,0.5)] hover:text-[#FFFCF7]"
              }`}
            >
              {y}Y
            </button>
          ))}
        </div>
      </div>

      {/* Data Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] p-3">
          <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-[rgba(255,252,247,0.4)]">
            {t("financial.holdingCost", { years: period })}
          </p>
          <p className="text-[18px] font-bold text-[#FFFCF7] font-mono mt-1">
            {formatShort(totalHoldingCost, locale)}
          </p>
          <p className="text-[10px] text-[rgba(255,252,247,0.4)] mt-1">
            {t("financial.maint")}: {formatShort(data.maintenance, locale)}/{t("financial.perYear")} · {t("financial.ins")}: {formatShort(data.insurance, locale)}/{t("financial.perYear")}
          </p>
        </div>
        <div className="rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] p-3">
          <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-[rgba(255,252,247,0.4)]">
            {t("financial.appreciation")}
          </p>
          <p className="text-[18px] font-bold text-emerald-400 font-mono mt-1">
            {data.appreciation} / {t("financial.perYear")}
          </p>
          <p className="text-[10px] text-[rgba(255,252,247,0.4)] mt-1">
            {t("financial.projected")}: {formatShort(projectedValue, locale)}
          </p>
        </div>
      </div>

      {/* Net Yield Bar */}
      <div className="mt-4 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[rgba(255,252,247,0.4)]">
            {t("financial.netYield", { years: period })}
          </span>
          <span className={`text-[14px] font-bold font-mono ${netGain >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {netGain >= 0 ? "+" : ""}{formatShort(netGain, locale)}
          </span>
        </div>
        <div className="h-2 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
          <div
            className={`h-full rounded-full ${netGain >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
            style={{ width: `${Math.min(Math.abs(netGain / currentValue) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MODULE D: Risk Assessment
// ---------------------------------------------------------------------------

function RiskModule({
  auction,
  t,
}: {
  auction: AuctionDetail
  t: ReturnType<typeof useTranslations>
}) {
  const [showQuestions, setShowQuestions] = useState(false)
  const makeKey = getMakeKey(auction.make)
  const redFlags = (t.raw(`mock.redFlags.${makeKey}`) as unknown as string[]) ?? []
  const questions = (t.raw(`mock.sellerQuestions.${makeKey}`) as unknown as string[]) ?? []

  return (
    <div className="border-b border-[rgba(255,255,255,0.05)] py-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="size-4 text-amber-400" />
        <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-amber-400">
          {t("modules.dueDiligence")}
        </h2>
      </div>

      {/* Red Flags */}
      <div className="space-y-2">
        {redFlags.map((flag: string, i: number) => (
          <div key={i} className="flex items-start gap-2 text-[13px] text-[rgba(255,252,247,0.7)]">
            <AlertCircle className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
            <span>{flag}</span>
          </div>
        ))}
      </div>

      {/* Seller Questions Toggle */}
      <button
        onClick={() => setShowQuestions(!showQuestions)}
        className="mt-4 flex items-center gap-2 text-[12px] font-medium text-[#F8B4D9] hover:text-[#f4cbde] transition-colors"
      >
        <HelpCircle className="size-4" />
        {showQuestions ? t("actions.hide") : t("actions.show")} {t("labels.sellerQuestions", { count: questions.length })}
      </button>

      {showQuestions && (
        <div className="mt-3 space-y-2 pl-4 border-l-2 border-[rgba(248,180,217,0.2)]">
          {questions.map((q: string, i: number) => (
            <p key={i} className="text-[12px] text-[rgba(255,252,247,0.6)]">
              {q}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MODULE E: Market Context (Comparables)
// ---------------------------------------------------------------------------

function ComparablesModule({
  auction,
  t,
  locale,
}: {
  auction: AuctionDetail
  t: ReturnType<typeof useTranslations>
  locale: string
}) {
  const makeKey = getMakeKey(auction.make)
  const fallbackSales = (t.raw(`mock.comparables.${makeKey}`) as unknown as {
    title: string
    price: number
    date: string
    platform: string
  }[]) ?? []
  const sales = auction.analysis?.comparableSales || fallbackSales

  return (
    <div className="py-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="size-4 text-[#F8B4D9]" />
        <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#F8B4D9]">
          {t("modules.comparableSales")}
        </h2>
      </div>

      <div className="space-y-2">
        {sales.slice(0, 5).map((sale: { title: string; price: number; date: string; platform: string }, i: number) => (
          <div
            key={i}
            className="flex items-center justify-between py-2.5 border-b border-[rgba(255,255,255,0.04)] last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[#FFFCF7] truncate">{sale.title}</p>
              <p className="text-[10px] text-[rgba(255,252,247,0.4)] mt-0.5">
                {sale.date} · {sale.platform}
              </p>
            </div>
            <span className="text-[14px] font-bold font-mono text-[#FFFCF7] ml-4">
              {formatShort(sale.price, locale)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MODULE F: Registry Intelligence
// ---------------------------------------------------------------------------

function RegistryIntelligenceModule({
  auction,
  t,
  locale,
}: {
  auction: AuctionDetail
  t: ReturnType<typeof useTranslations>
  locale: string
}) {
  const makeKey = getMakeKey(auction.make)
  const registryData =
    (t.raw(`mock.registry.${makeKey}`) as unknown as RegistryData) ||
    (t.raw("mock.registry.default") as unknown as RegistryData)
  const chassisNumber = auction.vin || `${registryData.chassisPrefix}${Math.floor(Math.random() * 9000) + 1000}`

  return (
    <div className="border-b border-[rgba(255,255,255,0.05)] py-5">
      {/* Header with Verified Badge */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-[#F8B4D9]" />
          <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#F8B4D9]">
            {t("modules.registryIntelligence")}
          </h2>
        </div>
        {registryData.verified && (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1">
            <BadgeCheck className="size-3 text-emerald-400" />
            <span className="text-[9px] font-semibold tracking-wider uppercase text-emerald-400">
              {t("labels.verified")}
            </span>
          </div>
        )}
      </div>

      {/* Chassis Identity - Terminal Style */}
      <div className="rounded-lg bg-[#0b0b10] border border-[rgba(255,255,255,0.06)] p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Fingerprint className="size-3.5 text-[rgba(255,252,247,0.4)]" />
          <span className="text-[9px] font-medium tracking-[0.2em] uppercase text-[rgba(255,252,247,0.4)]">
            {t("labels.chassisIdentity")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] text-[rgba(255,252,247,0.35)] uppercase tracking-wider mb-1">{t("labels.vinOrChassis")}</p>
            <p className="text-[15px] font-mono font-medium text-[#FFFCF7] tracking-wide">{chassisNumber}</p>
          </div>
          <div>
            <p className="text-[9px] text-[rgba(255,252,247,0.35)] uppercase tracking-wider mb-1">{t("labels.production")}</p>
            <p className="text-[13px] font-mono text-[#F8B4D9]">{registryData.productionSequence}</p>
            {registryData.totalProduced > 0 && (
              <p className="text-[10px] text-[rgba(255,252,247,0.4)] mt-0.5">
                {t("labels.totalProduced")}: {registryData.totalProduced.toLocaleString(locale)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Configuration - The Spec */}
      <div className="rounded-lg bg-[rgba(15,14,22,0.5)] border border-[rgba(255,255,255,0.04)] p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="size-3.5 text-[rgba(255,252,247,0.4)]" />
          <span className="text-[9px] font-medium tracking-[0.2em] uppercase text-[rgba(255,252,247,0.4)]">
            {t("labels.factoryConfiguration")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
          <div>
            <p className="text-[9px] text-[rgba(255,252,247,0.35)] uppercase tracking-wider mb-1">{t("labels.exterior")}</p>
            <p className="text-[12px] text-[#FFFCF7]">{registryData.config.exteriorColor}</p>
            <p className="text-[10px] font-mono text-[rgba(255,252,247,0.4)]">{registryData.config.exteriorCode}</p>
          </div>
          <div>
            <p className="text-[9px] text-[rgba(255,252,247,0.35)] uppercase tracking-wider mb-1">{t("labels.interior")}</p>
            <p className="text-[12px] text-[#FFFCF7]">{registryData.config.interiorColor}</p>
            <p className="text-[10px] text-[rgba(255,252,247,0.4)]">{registryData.config.interiorMaterial}</p>
          </div>
        </div>

        {/* Key Options */}
        <div>
          <p className="text-[9px] text-[rgba(255,252,247,0.35)] uppercase tracking-wider mb-2">{t("labels.keyOptions")}</p>
          <div className="flex flex-wrap gap-1.5">
            {registryData.config.keyOptions.map((option, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded bg-[rgba(248,180,217,0.08)] border border-[rgba(248,180,217,0.12)] px-2 py-1 text-[10px] font-medium text-[rgba(255,252,247,0.7)]"
              >
                {option}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Asset Lifecycle - Spotting Timeline */}
      <div className="rounded-lg bg-[rgba(15,14,22,0.5)] border border-[rgba(255,255,255,0.04)] p-4">
        <div className="flex items-center gap-2 mb-4">
          <History className="size-3.5 text-[rgba(255,252,247,0.4)]" />
          <span className="text-[9px] font-medium tracking-[0.2em] uppercase text-[rgba(255,252,247,0.4)]">
            {t("labels.assetLifecycle")}
          </span>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gradient-to-b from-[#F8B4D9]/40 via-[rgba(255,255,255,0.1)] to-transparent" />

          <div className="space-y-3">
            {registryData.spottings.map((spot, i) => (
              <div key={i} className="flex items-start gap-3 pl-0">
                {/* Timeline dot */}
                <div className={`relative z-10 size-2.5 rounded-full mt-1.5 shrink-0 ${
                  i === registryData.spottings.length - 1
                    ? "bg-[#F8B4D9] shadow-lg shadow-[#F8B4D9]/30"
                    : "bg-[rgba(255,255,255,0.2)] border border-[rgba(255,255,255,0.1)]"
                }`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-mono font-semibold text-[#FFFCF7]">{spot.year}</span>
                    <span className="text-[11px] text-[rgba(255,252,247,0.7)]">{spot.event}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <MapPin className="size-2.5 text-[rgba(255,252,247,0.3)]" />
                    <span className="text-[10px] text-[rgba(255,252,247,0.4)]">{spot.location}</span>
                    {spot.source && (
                      <>
                        <span className="text-[rgba(255,252,247,0.2)]">·</span>
                        <span className="text-[10px] text-[rgba(248,180,217,0.6)]">{spot.source}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Registry Data Source */}
      <p className="mt-3 text-[9px] text-[rgba(255,252,247,0.25)] text-center">
        {t("registry.dataSource", {
          date: new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(new Date()),
        })}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#0b0b10] pt-[100px]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="aspect-[4/3] rounded-2xl bg-[rgba(248,180,217,0.05)] animate-pulse" />
          <div className="space-y-6">
            <div className="h-10 w-3/4 bg-[rgba(248,180,217,0.05)] rounded animate-pulse" />
            <div className="h-32 bg-[rgba(248,180,217,0.05)] rounded-xl animate-pulse" />
            <div className="h-24 bg-[rgba(248,180,217,0.05)] rounded-xl animate-pulse" />
            <div className="h-24 bg-[rgba(248,180,217,0.05)] rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AuctionDetailClient() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations("auctionDetail")
  const locale = useLocale()
  const auctionId = params.id as string

  const [auction, setAuction] = useState<AuctionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([])
  const [error, setError] = useState<
    | null
    | { code: "not_found" }
    | { code: "failed_to_load"; status: number }
    | { code: "network_error" }
  >(null)

  useEffect(() => {
    if (!auctionId) return

    async function fetchAuction() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/auctions/${auctionId}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError({ code: "not_found" })
            return
          }
          setError({ code: "failed_to_load", status: res.status })
          return
        }
        const json = await res.json()
        const rawAuction = json.data ?? json

        const data: AuctionDetail = {
          id: rawAuction.id,
          title: rawAuction.title,
          year: rawAuction.year,
          make: rawAuction.make,
          model: rawAuction.model,
          trim: rawAuction.trim ?? null,
          platform: rawAuction.platform?.toLowerCase().replace(/_/g, "-") ?? "",
          platformUrl: rawAuction.url ?? "",
          imageUrl: rawAuction.images?.[0] ?? null,
          images: rawAuction.images ?? [],
          currentBid: rawAuction.currentBid ?? rawAuction.finalPrice ?? null,
          bidCount: rawAuction.bidCount ?? 0,
          endDate: rawAuction.endTime ?? "",
          status: rawAuction.status === "ACTIVE" || rawAuction.status === "ENDING_SOON"
            ? "active"
            : rawAuction.status === "ENDED" || rawAuction.status === "SOLD" || rawAuction.status === "NO_SALE"
            ? "ended"
            : "upcoming",
          reserveStatus: rawAuction.reserveStatus === "NO_RESERVE"
            ? "no_reserve"
            : rawAuction.reserveStatus === "RESERVE_MET"
            ? "met"
            : rawAuction.reserveStatus === "RESERVE_NOT_MET"
            ? "not_met"
            : "unknown",
          mileage: rawAuction.mileage ?? null,
          transmission: rawAuction.transmission ?? null,
          engine: rawAuction.engine ?? null,
          drivetrain: null,
          exteriorColor: rawAuction.exteriorColor ?? null,
          interiorColor: rawAuction.interiorColor ?? null,
          vin: rawAuction.vin ?? null,
          location: rawAuction.location ?? null,
          description: rawAuction.description ?? null,
          sellerNotes: rawAuction.sellerNotes ?? null,
          bids: (rawAuction.priceHistory ?? []).map((ph: { id: string; bid: number; timestamp: string }, idx: number) => ({
            id: ph.id,
            amount: ph.bid,
            bidder: `Bidder ${idx + 1}`,
            timestamp: ph.timestamp,
          })),
          analysis: rawAuction.analysis ? {
            id: rawAuction.analysis.id,
            summary: rawAuction.analysis.rawAnalysis?.summary ?? "",
            marketPosition: rawAuction.analysis.rawAnalysis?.marketPosition ?? "",
            conditionAssessment: rawAuction.analysis.rawAnalysis?.conditionAssessment ?? "",
            pricePrediction: {
              low: rawAuction.analysis.bidTargetLow ?? 0,
              mid: ((rawAuction.analysis.bidTargetLow ?? 0) + (rawAuction.analysis.bidTargetHigh ?? 0)) / 2,
              high: rawAuction.analysis.bidTargetHigh ?? 0,
              confidence: rawAuction.analysis.confidence === "HIGH" ? 0.9 : rawAuction.analysis.confidence === "MEDIUM" ? 0.7 : 0.5,
            },
            pros: rawAuction.analysis.keyStrengths ?? [],
            cons: rawAuction.analysis.redFlags ?? [],
            comparableSales: (rawAuction.comparables ?? []).map((c: { title: string; soldPrice: number; soldDate: string; platform: string }) => ({
              title: c.title,
              price: c.soldPrice,
              date: c.soldDate,
              platform: c.platform,
            })),
            riskFactors: rawAuction.analysis.redFlags ?? [],
            recommendation: rawAuction.analysis.rawAnalysis?.recommendation ?? "",
            score: rawAuction.analysis.investmentGrade === "EXCELLENT" ? 95 : rawAuction.analysis.investmentGrade === "GOOD" ? 80 : rawAuction.analysis.investmentGrade === "FAIR" ? 65 : 50,
            createdAt: rawAuction.analysis.createdAt,
          } : null,
          createdAt: rawAuction.createdAt,
          updatedAt: rawAuction.updatedAt,
        }
        setAuction(data)
      } catch {
        setError({ code: "network_error" })
      } finally {
        setLoading(false)
      }
    }

    fetchAuction()
  }, [auctionId])

  // Fetch Supabase price history for live listings
  useEffect(() => {
    if (!auctionId || !auctionId.startsWith("live-")) return

    async function fetchPriceHistory() {
      try {
        const res = await fetch(`/api/listings/${auctionId}/price-history`)
        if (!res.ok) return
        const json = await res.json()
        setPriceHistory(json.data ?? [])
      } catch {
        // Non-critical; price chart just won't show
      }
    }

    fetchPriceHistory()
  }, [auctionId])

  if (loading) return <DetailSkeleton />

  if (error || !auction) {
    const title =
      error?.code === "failed_to_load"
        ? t("errors.failedToLoad", { status: error.status })
        : error?.code === "network_error"
          ? t("errors.networkError")
          : t("errors.notFound")

    return (
      <div className="min-h-screen bg-[#0b0b10] pt-[100px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="mx-auto rounded-full bg-red-500/10 p-4 w-fit">
            <AlertCircle className="size-8 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-[#FFFCF7]">{title}</h2>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-[13px] text-[#F8B4D9] hover:text-[#f4cbde] transition-colors"
          >
            <ArrowLeft className="size-4" />
            {t("actions.goBack")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0b10] pt-[100px]">
      {/* Back Navigation */}
      <div className="fixed top-[100px] left-0 right-0 z-30 bg-[#0b0b10]/80 backdrop-blur-md border-b border-[rgba(248,180,217,0.06)]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between h-12">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-[12px] text-[rgba(255,252,247,0.5)] hover:text-[#F8B4D9] transition-colors"
            >
              <ArrowLeft className="size-4" />
              {t("actions.backToFeed")}
            </button>
            {auction.status === "active" && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                {t("labels.liveAuction")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT: Sticky Image Gallery */}
          <StickyGallery images={auction.images} title={auction.title} />

          {/* RIGHT: Data Terminal (Scrollable) */}
          <div className="h-[calc(100vh-180px)] overflow-y-auto no-scrollbar pr-2">
            {/* MODULE A: Executive Summary */}
            <ExecutiveSummary auction={auction} t={t} locale={locale} />

            {/* Price History Chart (live listings from Supabase) */}
            {priceHistory.length > 0 && (
              <div className="border-b border-[rgba(255,255,255,0.05)] py-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-4 text-[#F8B4D9]" />
                  <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#F8B4D9]">
                    {t("modules.comparableSales") ?? "Price History"}
                  </h2>
                </div>
                <PriceChart priceHistory={priceHistory} />
              </div>
            )}

            {/* MODULE F: Registry Intelligence */}
            <RegistryIntelligenceModule auction={auction} t={t} locale={locale} />

            {/* MODULE B: Strategy & Alpha */}
            <StrategyModule auction={auction} t={t} />

            {/* MODULE C: Financial Projection */}
            <FinancialsModule auction={auction} t={t} locale={locale} />

            {/* MODULE D: Risk Assessment */}
            <RiskModule auction={auction} t={t} />

            {/* MODULE E: Comparables */}
            <ComparablesModule auction={auction} t={t} locale={locale} />

            {/* VIN */}
            {auction.vin && (
              <div className="py-5 border-t border-[rgba(255,255,255,0.05)]">
                <p className="text-[9px] font-medium tracking-[0.2em] uppercase text-[rgba(255,252,247,0.4)]">
                  {t("labels.vin")}
                </p>
                <p className="text-[12px] font-mono text-[rgba(255,252,247,0.6)] mt-1">{auction.vin}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
