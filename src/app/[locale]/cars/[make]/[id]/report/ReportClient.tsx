"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"
import {
  ArrowLeft,
  TrendingUp,
  Scale,
  ChevronRight,
  MapPin,
  Car,
  Gauge,
  Cog,
  AlertTriangle,
  HelpCircle,
  FileText,
  Users,
  CheckCircle2,
  Lock,
  Coins,
  BarChart3,
  Copy,
  Check,
  Target,
  Award,
  Globe,
  History,
  Download,
} from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import type { SimilarCarResult } from "@/lib/similarCars"
import type { HausReport } from "@/lib/fairValue/types"
import type { ModelMarketStats, RegionalMarketStats } from "@/lib/reports/types"
import type { DbComparableRow } from "@/lib/db/queries"
import { SignalsDetectedSection } from "@/components/report/SignalsDetectedSection"
import { SignalsMissingSection } from "@/components/report/SignalsMissingSection"
import { ModifiersAppliedList } from "@/components/report/ModifiersAppliedList"
import { LandedCostBlock } from "@/components/report/LandedCostBlock"
import { SourcesBlock } from "@/components/report/SourcesBlock"
import { useReport } from "@/hooks/useAnalysis"
import { useRegion } from "@/lib/RegionContext"
import { formatRegionalPrice, formatUsd } from "@/lib/regionPricing"
import { useCurrency } from "@/lib/CurrencyContext"
import { useTheme } from "next-themes"
import { useTokens } from "@/hooks/useTokens"
import { stripHtml } from "@/lib/stripHtml"
import { useAuth } from "@/lib/auth/AuthProvider"
import { OutOfReportsModal } from "@/components/payments/OutOfReportsModal"

// ─── DATA CONSTANTS (display helpers only — no fabricated data) ───

const platformLabels: Record<string, { short: string; color: string }> = {
  BRING_A_TRAILER: { short: "BaT", color: "bg-amber-500/20 text-destructive" },
  CARS_AND_BIDS: { short: "C&B", color: "bg-blue-500/20 text-blue-400" },
  COLLECTING_CARS: { short: "CC", color: "bg-purple-500/20 text-purple-400" },
  AUTO_SCOUT_24: { short: "AS24", color: "bg-green-500/20 text-green-400" },
  RM_SOTHEBYS: { short: "RM", color: "bg-rose-500/20 text-rose-400" },
  GOODING: { short: "Gooding", color: "bg-positive/20 text-positive" },
  BONHAMS: { short: "Bonhams", color: "bg-cyan-500/20 text-cyan-400" },
}

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
    const avg = (p.low + p.high) / 2
    if (avg < bestAvg) { bestAvg = avg; best = r }
  }
  return best
}

// ─── SECTION IDS for scroll-spy ───
const SECTION_IDS = [
  "summary",
  "identity",
  "valuation",
  "performance",
  "risk",
  "dueDiligence",
  "marketContext",
  "similar",
  "verdict",
] as const

type SectionId = typeof SECTION_IDS[number]

const SECTION_ICONS: Record<SectionId, React.ComponentType<{ className?: string }>> = {
  summary: Scale,
  identity: Car,
  valuation: Globe,
  performance: TrendingUp,
  risk: AlertTriangle,
  dueDiligence: HelpCircle,
  marketContext: BarChart3,
  similar: Users,
  verdict: Award,
}

// ═══════════════════════════════════════════════════════════════
// ─── MAIN COMPONENT ───
// ═══════════════════════════════════════════════════════════════
export function ReportClient({ car, similarCars, existingReport, marketStats, dbComparables = [] }: {
  car: CollectorCar
  similarCars: SimilarCarResult[]
  existingReport: HausReport | null
  marketStats: ModelMarketStats | null
  dbComparables?: DbComparableRow[]
}) {
  const { report: generatedReport, generating, error: reportError, triggerGeneration, creditsRemaining } = useReport(car.id)
  void generating
  void creditsRemaining

  // Prefer the server-fetched HausReport; fall back to any report the hook just produced.
  // The hook's triggerGeneration now reloads the page on success, so the server component
  // re-fetches the persisted HausReport via assembleHausReportFromDB.
  const report: HausReport | null = existingReport ?? (generatedReport as unknown as HausReport | null)
  const hasSignals = !!(report?.signals_extracted_at)
  const hasStats = !!(marketStats && marketStats.totalDataPoints > 0)
  const regions: RegionalMarketStats[] = marketStats?.regions ?? []

  const locale = useLocale()
  const t = useTranslations("investmentReport")
  const tPricing = useTranslations("pricing")
  const tFairValue = useTranslations("report.fairValue")
  const tVerdict = useTranslations("report.verdict")
  const { effectiveRegion } = useRegion()
  const { formatPrice, convertFromUsd, currencySymbol } = useCurrency()
  const { resolvedTheme } = useTheme()

  // Scroll-spy state
  const [activeSection, setActiveSection] = useState<SectionId>("summary")
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>(
    Object.fromEntries(SECTION_IDS.map(id => [id, null])) as Record<SectionId, HTMLElement | null>
  )

  // Token system
  const {
    user,
    isRegistered,
    isLoading: tokensLoading,
    tokens,
    consumeForAnalysis,
    hasAnalyzed,
    addTokens,
    setPlan,
  } = useTokens()

  const [hasAccess, setHasAccess] = useState(false)
  const [copiedQuestions, setCopiedQuestions] = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [purchaseProcessing, setPurchaseProcessing] = useState<string | null>(null)
  const [outOfReportsOpen, setOutOfReportsOpen] = useState(false)
  const { profile: authProfile } = useAuth()

  // Show paywall when API returns INSUFFICIENT_CREDITS
  useEffect(() => {
    if (reportError === "INSUFFICIENT_CREDITS") {
      setOutOfReportsOpen(true)
    }
  }, [reportError])
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [showDownloadSheet, setShowDownloadSheet] = useState(false)

  // Check access on mount
  useEffect(() => {
    if (!tokensLoading) {
      setHasAccess(hasAnalyzed(car.id))
    }
  }, [tokensLoading, car.id, hasAnalyzed])

  const handleUnlock = () => {
    if (hasAnalyzed(car.id)) {
      setHasAccess(true)
      // If we already unlocked locally but the DB has no HausReport yet, kick off
      // the real generation pipeline so the server component can reload a populated report.
      if (!existingReport) void triggerGeneration()
      return
    }
    const success = consumeForAnalysis(car.id)
    if (success) {
      setHasAccess(true)
      // Fire /api/analyze → persist HausReport → hook reloads the page on success.
      if (!existingReport) void triggerGeneration()
    } else {
      setShowPricing(true)
    }
  }

  const handlePurchase = (planId: "single" | "explorer" | "unlimited") => {
    setPurchaseProcessing(planId)
    setTimeout(() => {
      const tokensToAdd = planId === "single" ? 1000 : planId === "explorer" ? 5000 : 999000
      addTokens(tokensToAdd)
      setPlan(planId)
      consumeForAnalysis(car.id)
      setPurchaseProcessing(null)
      setPurchaseSuccess(true)
      setTimeout(() => {
        setPurchaseSuccess(false)
        setShowPricing(false)
        setHasAccess(true)
      }, 1500)
    }, 1500)
  }

  // ─── COMPUTED DATA (DB-only — no fabricated fallbacks) ───
  const isLive = car.status === "ACTIVE" || car.status === "ENDING_SOON"

  // Red flags & questions: legacy fields not in HausReport — derived from signals_missing going forward.
  // For now, fall back to empty arrays until signal→question mapping is wired.
  const flags: string[] = []
  const questions: string[] = []
  const strengths: string[] = []
  const hasDbRiskData = flags.length > 0
  const hasDbQuestions = questions.length > 0

  // No fake comparables — regional stats replace this
  // Real comparable sales from the Comparable table. Empty array when the
  // backend hasn't populated it yet — the UI renders an honest empty state.
  const marketAvgForDelta = marketStats
    ? (marketStats.primaryFairValueLow + marketStats.primaryFairValueHigh) / 2
    : null
  const comps = dbComparables.map(c => ({
    title: c.title,
    price: c.soldPrice,
    date: c.soldDate ? new Date(c.soldDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "N/A",
    platform: c.platform === "BRING_A_TRAILER" ? "BaT" : c.platform === "CARS_AND_BIDS" ? "C&B" : c.platform === "COLLECTING_CARS" ? "CC" : c.platform === "AUTO_SCOUT_24" ? "AS24" : c.platform,
    delta: marketAvgForDelta ? Math.round(((c.soldPrice - marketAvgForDelta) / marketAvgForDelta) * 100) : 0,
  }))

  const platform = platformLabels[car.platform]

  // Fair value: from report or market stats (real data only)
  const fairLow = report?.fair_value_low ?? marketStats?.primaryFairValueLow ?? 0
  const fairHigh = report?.fair_value_high ?? marketStats?.primaryFairValueHigh ?? 0
  const regionRange = car.fairValueByRegion[effectiveRegion as keyof typeof car.fairValueByRegion] || car.fairValueByRegion.US
  const bidInCurrency = convertFromUsd(car.currentBid)
  const pricePosition = fairHigh > fairLow
    ? Math.min(Math.max(((bidInCurrency - fairLow) / (fairHigh - fairLow)) * 100, 0), 100) : 50
  const isBelowFair = bidInCurrency < (fairLow + fairHigh) / 2

  const pricing = car.fairValueByRegion
  const bestRegion = findBestRegion(pricing)
  const maxRegionalUsd = Math.max(
    ...(["US", "EU", "UK", "JP"] as const).map(r =>
      (pricing[r].low + pricing[r].high) / 2
    )
  )

  // Risk score: derived from signal completeness (detected / (detected + missing)).
  // Higher signal coverage ⇒ lower uncertainty ⇒ lower risk score.
  const detectedCount = report?.signals_detected.length ?? 0
  const missingCount = report?.signals_missing.length ?? 0
  const totalSignalCount = detectedCount + missingCount
  const signalCoverage = totalSignalCount > 0 ? detectedCount / totalSignalCount : 0
  const riskScore = hasSignals
    ? Math.round(100 - signalCoverage * 70) // 30–100 range
    : 50 // neutral default when signals not yet extracted

  // Verdict logic — purely factual: based on price delta vs specific-car fair value midpoint.
  const specificMid = report?.specific_car_fair_value_mid ?? 0
  const isAboveFair = car.price > 0 && fairHigh > 0 && car.price > fairHigh
  const deltaVsSpecific = hasSignals && specificMid > 0
    ? Math.round(((car.currentBid - specificMid) / specificMid) * 100)
    : 0
  const verdict = !hasSignals ? null :
    deltaVsSpecific <= -5 ? "buy" :
    deltaVsSpecific >= 5 ? "watch" : "hold"

  // Arbitrage: difference between cheapest and most expensive region
  const cheapestRegionAvgUsd = (pricing[bestRegion as keyof typeof pricing].low + pricing[bestRegion as keyof typeof pricing].high) / 2
  const arbitrageSavings = maxRegionalUsd - cheapestRegionAvgUsd
  const hasArbitrage = arbitrageSavings > car.currentBid * 0.05

  // ─── SCROLL SPY ───
  const handleScrollSpy = useCallback(() => {
    const offset = 120
    let current: SectionId = "summary"
    for (const id of SECTION_IDS) {
      const el = sectionRefs.current[id]
      if (el) {
        const rect = el.getBoundingClientRect()
        if (rect.top <= offset) current = id
      }
    }
    setActiveSection(current)
  }, [])

  useEffect(() => {
    window.addEventListener("scroll", handleScrollSpy, { passive: true })
    return () => window.removeEventListener("scroll", handleScrollSpy)
  }, [handleScrollSpy])

  const scrollToSection = (id: SectionId) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const setSectionRef = (id: SectionId) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el
  }

  // Copy questions to clipboard
  const handleCopyQuestions = () => {
    navigator.clipboard.writeText(questions.join("\n"))
    setCopiedQuestions(true)
    setTimeout(() => setCopiedQuestions(false), 2000)
  }

  // ─── PDF DOWNLOAD (pure jsPDF — no html2canvas) ───
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      const jsPDFModule = await import("jspdf")
      const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const W = 210
      const H = 297
      const M = 15 // margin
      const CW = W - M * 2 // content width
      let pg = 0

      // ─── Theme-aware color palette ───
      const isDark = resolvedTheme === "dark"
      const pal = isDark ? {
        bg: [14, 10, 12] as const,           // #0E0A0C
        fg: [232, 226, 222] as const,        // #E8E2DE
        card: [22, 17, 19] as const,         // #161113
        primary: [212, 115, 138] as const,   // #D4738A
        muted: [107, 99, 101] as const,      // #6B6365
        dim: [80, 72, 75] as const,
        border: [42, 34, 38] as const,       // #2A2226
        barBg: [35, 28, 32] as const,
        barFill: [60, 52, 56] as const,
        onPrimary: [14, 10, 12] as const,
        letterBody: [180, 175, 172] as const,
        closingText: [160, 155, 152] as const,
        footerDim: [100, 94, 96] as const,
        greenTintBg: [15, 25, 20] as const,
        redTintBg: [30, 18, 18] as const,
      } : {
        bg: [253, 251, 249] as const,        // #FDFBF9
        fg: [42, 35, 32] as const,           // #2A2320
        card: [245, 242, 238] as const,      // #F5F2EE
        primary: [122, 46, 74] as const,     // #7A2E4A
        muted: [154, 142, 136] as const,     // #9A8E88
        dim: [185, 175, 168] as const,
        border: [232, 226, 220] as const,    // #E8E2DC
        barBg: [238, 233, 228] as const,
        barFill: [210, 202, 196] as const,
        onPrimary: [253, 251, 249] as const,
        letterBody: [100, 90, 85] as const,
        closingText: [120, 110, 105] as const,
        footerDim: [175, 165, 158] as const,
        greenTintBg: [235, 250, 242] as const,
        redTintBg: [255, 242, 240] as const,
      }

      // ─── Helpers ───
      const bg = () => { pdf.setFillColor(pal.bg[0], pal.bg[1], pal.bg[2]); pdf.rect(0, 0, W, H, "F") }
      const pink = () => pdf.setTextColor(pal.primary[0], pal.primary[1], pal.primary[2])
      const white = () => pdf.setTextColor(pal.fg[0], pal.fg[1], pal.fg[2])
      const gray = () => pdf.setTextColor(pal.muted[0], pal.muted[1], pal.muted[2])
      const dim = () => pdf.setTextColor(pal.dim[0], pal.dim[1], pal.dim[2])
      const accentBar = () => { pdf.setFillColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.rect(0, 0, W, 1.2, "F") }

      const clientName = user?.name || "Valued Client"
      const firstName = clientName.split(" ")[0]

      const chrome = (title: string) => {
        pg++
        accentBar()
        pdf.setFontSize(7); dim()
        pdf.text("MONZA HAUS", M, 8)
        pdf.text(title.toUpperCase(), W - M, 8, { align: "right" })
        pdf.setDrawColor(pal.border[0], pal.border[1], pal.border[2]); pdf.setLineWidth(0.15)
        pdf.line(M, 11, W - M, 11)
        pdf.line(M, H - 12, W - M, H - 12)
        pdf.setFontSize(6.5); dim()
        pdf.text(`Prepared for ${clientName}`, M, H - 7)
        pdf.text(`${pg}`, W - M, H - 7, { align: "right" })
      }

      const sectionTitle = (num: number, title: string, y: number) => {
        pdf.setFontSize(7); pink()
        pdf.text(`SECTION ${String(num).padStart(2, "0")}`, M, y)
        pdf.setFontSize(14); white()
        pdf.text(title, M, y + 7)
        pdf.setDrawColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.setLineWidth(0.3)
        pdf.line(M, y + 10, M + 25, y + 10)
        return y + 16
      }

      const label = (text: string, x: number, y: number) => {
        pdf.setFontSize(7); dim(); pdf.text(text.toUpperCase(), x, y)
      }
      const value = (text: string, x: number, y: number, color?: "pink" | "white" | "green" | "red") => {
        pdf.setFontSize(10)
        if (color === "pink") pink()
        else if (color === "green") pdf.setTextColor(52, 211, 153)
        else if (color === "red") pdf.setTextColor(248, 113, 113)
        else white()
        pdf.text(text, x, y)
      }
      const row = (k: string, v: string, y: number) => {
        pdf.setFontSize(8); gray(); pdf.text(k, M, y)
        pdf.setFontSize(8); white(); pdf.text(v, M + 75, y)
        return y + 5.5
      }
      const bullet = (text: string, y: number, color?: "pink" | "green" | "red") => {
        pdf.setFontSize(7)
        if (color === "pink") pink()
        else if (color === "green") pdf.setTextColor(52, 211, 153)
        else if (color === "red") pdf.setTextColor(248, 113, 113)
        else gray()
        pdf.text("●", M, y)
        pdf.setFontSize(8); white()
        const lines = pdf.splitTextToSize(text, CW - 6)
        pdf.text(lines, M + 5, y)
        return y + lines.length * 4.2
      }

      // ─── PDF-safe helpers ───
      // Clean title: strip listing cruft, normalize to "{year} {make} {model} {trim}"
      const cleanTitle = (c: typeof car) => {
        const parts = [String(c.year), c.make, c.model]
        if (c.trim && c.trim !== "—" && c.trim !== c.model) parts.push(c.trim)
        return parts.join(" ").replace(/\*+/g, "").replace(/\s+/g, " ").trim()
      }
      const pdfTitle = cleanTitle(car)

      // PDF-safe currency formatter: avoid CJK characters that jsPDF can't render
      const fmtPdf = (amount: number, currency: string) => {
        if (currency === "JPY") return `¥${Math.round(amount).toLocaleString()}`
        if (currency === "GBP") return `£${Math.round(amount).toLocaleString()}`
        if (currency === "EUR") return `€${Math.round(amount).toLocaleString()}`
        return `$${Math.round(amount).toLocaleString()}`
      }

      // Smart thesis: fallback when DB thesis is empty or generic
      const rawThesis = stripHtml(car.thesis) || ""
      const isGenericThesis = !rawThesis || rawThesis.length < 50 || /Live auction listing from|Live Data/i.test(rawThesis)
      const pdfThesis = isGenericThesis
        ? `${pdfTitle} — ${car.transmission}, ${car.mileage.toLocaleString()} ${car.mileageUnit}. Currently listed at $${car.currentBid.toLocaleString()} on ${car.platform.replace(/_/g, " ")}. Fair value range: ${fmtPdf(fairLow, regionRange.currency)}–${fmtPdf(fairHigh, regionRange.currency)}.`
        : rawThesis

      // Fetch car images for PDF embedding (up to 6)
      const allImageUrls = [...new Set([car.image, ...(car.images || [])].filter(Boolean))].slice(0, 6)
      const carImagesData: string[] = []
      for (const imgUrl of allImageUrls) {
        try {
          const imgResp = await fetch(imgUrl)
          const blob = await imgResp.blob()
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          carImagesData.push(dataUrl)
        } catch { /* skip if fetch fails (CORS etc.) */ }
      }
      const carImageData = carImagesData[0] || null

      // ═══ PAGE 1: COVER ═══
      bg()
      pdf.setFillColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.rect(0, 0, W, 2, "F")
      pdf.setFontSize(8); pink(); pdf.text("MONZA HAUS", M, 20)
      pdf.setFontSize(7); dim()
      pdf.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), W - M, 20, { align: "right" })
      pdf.setDrawColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.setLineWidth(0.5); pdf.line(M, 60, M + 40, 60)
      pdf.setFontSize(11); pink(); pdf.text("INVESTMENT DOSSIER", M, 72)
      pdf.setFontSize(30); white()
      const tLines = pdf.splitTextToSize(pdfTitle, CW)
      pdf.text(tLines, M, 87)
      const tEnd = 87 + tLines.length * 11
      pdf.setFontSize(9); gray()
      pdf.text(`Fair Value: ${fmtPdf(fairLow, regionRange.currency)} – ${fmtPdf(fairHigh, regionRange.currency)}    Signals: ${detectedCount}/${totalSignalCount || "—"}`, M, tEnd + 8)
      const vy = tEnd + 18
      const vBadgeClr = verdict === "buy" ? [52, 211, 153] : verdict === "hold" ? [251, 191, 36] : pal.primary
      pdf.setFillColor(vBadgeClr[0], vBadgeClr[1], vBadgeClr[2])
      pdf.rect(M, vy - 4, 26, 8, "F")
      pdf.setFontSize(8); pdf.setTextColor(pal.onPrimary[0], pal.onPrimary[1], pal.onPrimary[2])
      pdf.text((verdict ?? "hold").toUpperCase(), M + 13, vy + 1, { align: "center" })
      gray(); pdf.text(`Risk: ${riskScore}/100  |  Position: ${pricePosition}% of fair value  |  Similar: ${similarCars.length} vehicles`, M + 30, vy + 1)
      // Personalized "Prepared for" — prominent
      const prepY = vy + 16
      pdf.setDrawColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.setLineWidth(0.2); pdf.line(M, prepY, M + 20, prepY)
      pdf.setFontSize(8); dim(); pdf.text("PREPARED EXCLUSIVELY FOR", M, prepY + 7)
      pdf.setFontSize(18); white(); pdf.text(clientName, M, prepY + 17)
      pdf.setFontSize(8); gray()
      pdf.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), M, prepY + 24)
      // Financial box — dynamic position below "Prepared for" section
      const bY = Math.max(prepY + 34, 180)
      pdf.setDrawColor(pal.border[0], pal.border[1], pal.border[2]); pdf.setLineWidth(0.3); pdf.rect(M, bY, CW, 38, "S")
      label("LISTING PRICE", M + 8, bY + 9); label("FAIR VALUE (USD)", M + 65, bY + 9); label("BEST REGION", M + 135, bY + 9)
      pdf.setFontSize(12); pink(); pdf.text(`$${car.currentBid.toLocaleString()}`, M + 8, bY + 21)
      white(); pdf.text(`$${pricing.US.low.toLocaleString()} – $${pricing.US.high.toLocaleString()}`, M + 65, bY + 21)
      pdf.text(regionLabels[bestRegion]?.short || "US", M + 135, bY + 21)
      pdf.setDrawColor(pal.border[0], pal.border[1], pal.border[2]); pdf.line(M + 58, bY + 3, M + 58, bY + 35); pdf.line(M + 128, bY + 3, M + 128, bY + 35)
      pdf.setFontSize(6.5); dim(); pdf.text("CONFIDENTIAL", M, H - 15); pdf.text("www.monzahaus.com", W - M, H - 15, { align: "right" })
      pdf.setFillColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.rect(0, H - 2, W, 2, "F")

      const secNames = ["Executive Summary", "Vehicle Identity", "Regional Valuation", "Performance & Returns", "Risk Assessment", "Due Diligence", "Market Context", "Similar Vehicles", "Final Verdict"]

      // ═══ PAGE 2: PERSONAL LETTER ═══
      pdf.addPage(); bg(); chrome("Welcome")
      // Decorative top line
      pdf.setDrawColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.setLineWidth(0.4)
      pdf.line(M, 22, M + 20, 22)
      // Greeting
      pdf.setFontSize(22); white()
      pdf.text(`Dear ${firstName},`, M, 34)
      // Letter body
      pdf.setFontSize(10); pdf.setTextColor(pal.letterBody[0], pal.letterBody[1], pal.letterBody[2])
      const letterBody = [
        `Thank you for trusting MONZA Haus with your investment analysis of the ${pdfTitle}.`,
        "",
        "We understand that acquiring a collector vehicle is more than a financial decision — it's a deeply personal one. Every car tells a story, and the right one becomes part of yours.",
        "",
        `This dossier was prepared exclusively for you. Inside, you'll find a comprehensive analysis covering ${secNames.length} key dimensions: from regional valuation and arbitrage opportunities to technical deep-dives, condition assessments, and our final investment verdict.`,
        "",
        "Our goal is simple: to give you the clarity and confidence to make the best decision — whether that's bidding today or waiting for the right moment.",
        "",
        "We're honored to be part of your journey.",
      ]
      let ly = 44
      letterBody.forEach(line => {
        if (line === "") { ly += 4; return }
        const wrapped = pdf.splitTextToSize(line, CW)
        pdf.text(wrapped, M, ly)
        ly += wrapped.length * 5
      })
      // Signature
      ly += 10
      pdf.setDrawColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.setLineWidth(0.3)
      pdf.line(M, ly, M + 15, ly)
      ly += 8
      pdf.setFontSize(10); pink()
      pdf.text("The MONZA Haus Team", M, ly)
      pdf.setFontSize(8); gray()
      pdf.text("www.monzahaus.com", M, ly + 6)
      // Bottom decorative element
      pdf.setDrawColor(pal.border[0], pal.border[1], pal.border[2]); pdf.setLineWidth(0.15)
      pdf.line(M, H - 40, W - M, H - 40)
      pdf.setFontSize(7); dim()
      pdf.text("\"The best investment you can make is an informed one.\"", W / 2, H - 33, { align: "center" })

      // ═══ PAGE 3: TABLE OF CONTENTS ═══
      pdf.addPage(); bg(); chrome("Contents")
      pdf.setFontSize(18); white(); pdf.text("Contents", M, 30)
      pdf.setDrawColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.setLineWidth(0.4); pdf.line(M, 34, M + 28, 34)
      secNames.forEach((name, i) => {
        const y = 44 + i * 14
        pdf.setFontSize(8); pink(); pdf.text(String(i + 1).padStart(2, "0"), M, y)
        pdf.setFontSize(10); white(); pdf.text(name, M + 12, y)
        pdf.setDrawColor(pal.border[0], pal.border[1], pal.border[2]); pdf.setLineWidth(0.1); pdf.line(M + 80, y, W - M - 12, y)
        pdf.setFontSize(8); dim(); pdf.text(String(i + 3), W - M - 3, y, { align: "right" })
      })

      // ─── Card helper: themed card with border like the web ───
      const card = (x: number, y: number, w: number, h: number) => {
        pdf.setFillColor(pal.card[0], pal.card[1], pal.card[2])
        pdf.rect(x, y, w, h, "F")
        pdf.setDrawColor(pal.border[0], pal.border[1], pal.border[2]); pdf.setLineWidth(0.08)
        pdf.rect(x, y, w, h, "S")
      }
      // Badge helper: colored pill
      const badge = (text: string, x: number, y: number, bgR: number, bgG: number, bgB: number, txR: number, txG: number, txB: number) => {
        const tw = pdf.getTextWidth(text) + 4
        pdf.setFillColor(bgR, bgG, bgB); pdf.rect(x, y - 3, tw, 5, "F")
        pdf.setFontSize(6.5); pdf.setTextColor(txR, txG, txB); pdf.text(text, x + 2, y + 0.5)
        return tw
      }
      // Card row: key-value inside a card context
      const cardRow = (k: string, v: string, x: number, y: number, w: number) => {
        pdf.setFontSize(7.5); gray(); pdf.text(k, x + 4, y)
        pdf.setFontSize(7.5); white(); pdf.text(v, x + w - 4, y, { align: "right" })
        pdf.setDrawColor(pal.border[0], pal.border[1], pal.border[2]); pdf.setLineWidth(0.08); pdf.line(x + 4, y + 1.5, x + w - 4, y + 1.5)
        return y + 5.5
      }

      // ═══ PAGE 4: EXECUTIVE SUMMARY ═══
      pdf.addPage(); bg(); chrome("Executive Summary")
      let y = sectionTitle(1, "Executive Summary", 16)
      // 6-metric card grid (3 cols x 2 rows)
      const mData = [
        { lbl: "SIGNALS DETECTED", val: `${detectedCount}/${totalSignalCount || "—"}`, clr: detectedCount > 0 ? [52,211,153] : [pal.muted[0],pal.muted[1],pal.muted[2]] },
        { lbl: "CURRENT PRICE", val: `$${car.currentBid.toLocaleString()}`, clr: [pal.primary[0],pal.primary[1],pal.primary[2]] },
        { lbl: "FAIR VALUE", val: `$${pricing.US.low.toLocaleString()} – $${pricing.US.high.toLocaleString()}`, clr: [pal.fg[0],pal.fg[1],pal.fg[2]] },
        { lbl: "MARKET POSITION", val: `${pricePosition}%`, clr: pricePosition <= 100 ? [52,211,153] : [pal.primary[0],pal.primary[1],pal.primary[2]] },
        { lbl: "RISK SCORE", val: `${riskScore}/100`, clr: riskScore < 35 ? [52,211,153] : riskScore < 55 ? [pal.primary[0],pal.primary[1],pal.primary[2]] : [248,113,113] },
        { lbl: "SIMILAR CARS", val: `${similarCars.length}`, clr: [pal.fg[0],pal.fg[1],pal.fg[2]] },
      ]
      const mw = (CW - 6) / 3
      mData.forEach((m, i) => {
        const col = i % 3; const rw = Math.floor(i / 3)
        const mx = M + col * (mw + 3); const my = y + rw * 22
        card(mx, my, mw, 19)
        pdf.setFontSize(6); dim(); pdf.text(m.lbl, mx + 4, my + 6)
        pdf.setFontSize(m.val.length > 20 ? 9 : 13); pdf.setTextColor(m.clr[0], m.clr[1], m.clr[2])
        pdf.text(m.val, mx + 4, my + 14)
      })
      y += 50

      // Thesis card
      card(M, y, CW, 24)
      pdf.setFontSize(6); dim(); pdf.text("INVESTMENT THESIS", M + 4, y + 5)
      pdf.setDrawColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.setLineWidth(0.3); pdf.line(M + 4, y + 7, M + 18, y + 7)
      pdf.setFontSize(8); white()
      const thesisLines = pdf.splitTextToSize(pdfThesis, CW - 8)
      pdf.text(thesisLines, M + 4, y + 12)
      y += 30

      // Price position gauge card
      card(M, y, CW, 22)
      pdf.setFontSize(6); dim(); pdf.text("PRICE POSITION IN FAIR RANGE", M + 4, y + 5)
      // Gradient bar: green → pink → red
      const gY = y + 9; const gW = CW - 8
      for (let gi = 0; gi < gW; gi++) {
        const pct = gi / gW
        const r = pct < 0.5 ? Math.round(52 + (pal.primary[0] - 52) * pct * 2) : Math.round(pal.primary[0] + (248 - pal.primary[0]) * (pct - 0.5) * 2)
        const g = pct < 0.5 ? Math.round(211 + (pal.primary[1] - 211) * pct * 2) : Math.round(pal.primary[1] + (113 - pal.primary[1]) * (pct - 0.5) * 2)
        const b = pct < 0.5 ? Math.round(153 + (pal.primary[2] - 153) * pct * 2) : Math.round(pal.primary[2] + (113 - pal.primary[2]) * (pct - 0.5) * 2)
        pdf.setFillColor(r, g, b); pdf.rect(M + 4 + gi, gY, 1.2, 4, "F")
      }
      // Position dot
      const dotX = M + 4 + (pricePosition / 100) * gW
      pdf.setFillColor(pal.fg[0], pal.fg[1], pal.fg[2]); pdf.circle(dotX, gY + 2, 2.5, "F")
      pdf.setFillColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.circle(dotX, gY + 2, 1.8, "F")
      pdf.setFontSize(6); gray()
      pdf.text(fmtPdf(fairLow, regionRange.currency), M + 4, gY + 9)
      pdf.text(fmtPdf(fairHigh, regionRange.currency), M + 4 + gW, gY + 9, { align: "right" })
      pdf.setFontSize(7); white(); pdf.text(`${pricePosition.toFixed(0)}%`, dotX, gY + 9, { align: "center" })
      y += 28

      // ═══ PAGE 5: VEHICLE IDENTITY ═══
      pdf.addPage(); bg(); chrome("Vehicle Identity")
      y = sectionTitle(2, "Vehicle Identity", 16)
      // Specs card (2 columns) — include all available fields
      const specs: [string, string][] = [
        ["Year", String(car.year)], ["Make", car.make], ["Model", car.model], ["Trim", car.trim || "—"],
        ["Engine", car.engine], ["Transmission", car.transmission],
        ["Mileage", `${car.mileage.toLocaleString()} ${car.mileageUnit}`], ["Location", car.location],
      ]
      if (car.exteriorColor) specs.push(["Exterior", car.exteriorColor])
      if (car.interiorColor) specs.push(["Interior", car.interiorColor])
      if (car.vin) specs.push(["VIN", car.vin])
      // Ensure even number for 2-col layout
      if (specs.length % 2 !== 0) specs.push(["", ""])
      const halfW = (CW - 4) / 2
      card(M, y, halfW, specs.length / 2 * 5.5 + 6)
      card(M + halfW + 4, y, halfW, specs.length / 2 * 5.5 + 6)
      specs.forEach((s, i) => {
        const col = i < specs.length / 2 ? 0 : 1
        const ri = col === 0 ? i : i - specs.length / 2
        const sx = col === 0 ? M : M + halfW + 4
        y = Math.max(y, y) // keep y stable
        cardRow(s[0], s[1], sx, y + 5 + ri * 5.5, halfW)
      })
      y += specs.length / 2 * 5.5 + 10

      // Car photo (if available)
      if (carImageData) {
        try {
          const imgFormat = carImageData.includes("image/png") ? "PNG" : "JPEG"
          const imgW = CW
          const imgH = imgW * (9 / 16) // 16:9 aspect ratio
          pdf.addImage(carImageData, imgFormat, M, y, imgW, imgH)
          y += imgH + 6
        } catch { /* skip if image can't be embedded */ }
      }

      // Auction info card
      card(M, y, CW, 22)
      pdf.setFontSize(6); dim(); pdf.text("AUCTION STATUS", M + 4, y + 5)
      const statClr = isLive ? [52, 211, 153] : [130, 130, 140]
      pdf.setFillColor(statClr[0], statClr[1], statClr[2]); pdf.circle(M + 4 + 47, y + 4.5, 1, "F")
      pdf.setFontSize(7); pdf.setTextColor(statClr[0], statClr[1], statClr[2]); pdf.text(car.status, M + 50, y + 5)
      pdf.setFontSize(8); pink(); pdf.text(`$${car.currentBid.toLocaleString()}`, M + 4, y + 12)
      pdf.setFontSize(7); gray(); pdf.text(`${car.bidCount} bids · ${car.platform.replace(/_/g, " ")}`, M + 4, y + 17)
      y += 28

      // History card
      const histText = stripHtml(car.history) || "—"
      const histLines = pdf.splitTextToSize(histText, CW - 10)
      const histH = Math.max(16, 8 + histLines.length * 4)
      card(M, y, CW, histH)
      pdf.setDrawColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.setLineWidth(0.4); pdf.line(M, y, M, y + histH)
      pdf.setFontSize(6); dim(); pdf.text("HISTORY & PROVENANCE", M + 5, y + 5)
      pdf.setFontSize(8); white()
      pdf.text(histLines, M + 5, y + 11)
      y += histH + 4

      // Description card (from listing — if available)
      const descText = stripHtml(car.description || car.sellerNotes || "")
      if (descText && descText.length > 10) {
        const descTrunc = descText.length > 600 ? descText.slice(0, 600) + "..." : descText
        const descLines = pdf.splitTextToSize(descTrunc, CW - 10)
        const descH = Math.max(16, 8 + descLines.length * 4)
        // New page if not enough space
        if (y + descH > H - 20) { pdf.addPage(); bg(); chrome("Vehicle Identity"); y = 16 }
        card(M, y, CW, descH)
        pdf.setFontSize(6); dim(); pdf.text("LISTING DESCRIPTION", M + 4, y + 5)
        pdf.setFontSize(7.5); white()
        pdf.text(descLines, M + 4, y + 11)
        y += descH + 4
      }

      // ═══ PHOTO GALLERY PAGE (if multiple images) ═══
      if (carImagesData.length > 1) {
        pdf.addPage(); bg(); chrome("Vehicle Gallery")
        y = 16
        pdf.setFontSize(14); white(); pdf.text("Vehicle Gallery", M, y + 7)
        pdf.setDrawColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.setLineWidth(0.3)
        pdf.line(M, y + 10, M + 25, y + 10)
        y += 18
        // Layout: first image large, rest in 2-col grid
        const galleryImages = carImagesData.slice(1) // skip first (already shown in identity)
        galleryImages.forEach((imgData, idx) => {
          try {
            const imgFormat = imgData.includes("image/png") ? "PNG" : "JPEG"
            if (idx === 0) {
              // Large hero image
              const imgW = CW
              const imgH = imgW * (9 / 16)
              if (y + imgH > H - 20) { pdf.addPage(); bg(); chrome("Vehicle Gallery"); y = 16 }
              pdf.addImage(imgData, imgFormat, M, y, imgW, imgH)
              y += imgH + 4
            } else {
              // 2-col grid
              const col = (idx - 1) % 2
              const gImgW = (CW - 4) / 2
              const gImgH = gImgW * (9 / 16)
              if (col === 0 && y + gImgH > H - 20) { pdf.addPage(); bg(); chrome("Vehicle Gallery"); y = 16 }
              const gx = M + col * (gImgW + 4)
              pdf.addImage(imgData, imgFormat, gx, y, gImgW, gImgH)
              if (col === 1 || idx === galleryImages.length - 1) y += gImgH + 4
            }
          } catch { /* skip broken image */ }
        })
      }

      // ═══ PAGE 6: REGIONAL VALUATION ═══
      pdf.addPage(); bg(); chrome("Regional Valuation")
      y = sectionTitle(3, "Regional Valuation", 16)
      // Regional bars card
      card(M, y, CW, 6 + 4 * 16)
      pdf.setFontSize(6); dim(); pdf.text("REGIONAL FAIR VALUE COMPARISON", M + 4, y + 5)
      ;(["US", "EU", "UK", "JP"] as const).forEach((r, i) => {
        const ry = y + 10 + i * 16
        const rp = pricing[r]
        const avgUsd = (rp.low + rp.high) / 2
        const barPct = maxRegionalUsd > 0 ? (avgUsd / maxRegionalUsd) * 100 : 50
        const isBest = r === bestRegion
        // Label row
        pdf.setFontSize(9); if (isBest) pink(); else white()
        pdf.text(regionLabels[r].short, M + 4, ry)
        if (isBest) badge("BEST BUY", M + 18, ry, 20, 60, 45, 52, 211, 153)
        pdf.setFontSize(7); gray()
        pdf.text(`${fmtPdf(rp.low, rp.currency)} – ${fmtPdf(rp.high, rp.currency)}`, W - M - 4, ry, { align: "right" })
        // Bar
        const bw = (barPct / 100) * (CW - 8)
        pdf.setFillColor(pal.barBg[0], pal.barBg[1], pal.barBg[2]); pdf.rect(M + 4, ry + 3, CW - 8, 3.5, "F")
        pdf.setFillColor(isBest ? 52 : pal.primary[0], isBest ? 211 : pal.primary[1], isBest ? 153 : pal.primary[2])
        pdf.rect(M + 4, ry + 3, bw, 3.5, "F")
        pdf.setFontSize(6); dim(); pdf.text(`$${Math.round(avgUsd).toLocaleString()}`, M + 4, ry + 10)
      })
      y += 6 + 4 * 16 + 4

      // Gauge card
      card(M, y, CW, 22)
      pdf.setFontSize(6); dim(); pdf.text("MARKET POSITION", M + 4, y + 5)
      const g2Y = y + 9; const g2W = CW - 8
      for (let gi = 0; gi < g2W; gi++) {
        const pct = gi / g2W
        const r2 = pct < 0.5 ? Math.round(52 + (pal.primary[0] - 52) * pct * 2) : Math.round(pal.primary[0] + (248 - pal.primary[0]) * (pct - 0.5) * 2)
        const g2 = pct < 0.5 ? Math.round(211 + (pal.primary[1] - 211) * pct * 2) : Math.round(pal.primary[1] + (113 - pal.primary[1]) * (pct - 0.5) * 2)
        const b2 = pct < 0.5 ? Math.round(153 + (pal.primary[2] - 153) * pct * 2) : Math.round(pal.primary[2] + (113 - pal.primary[2]) * (pct - 0.5) * 2)
        pdf.setFillColor(r2, g2, b2); pdf.rect(M + 4 + gi, g2Y, 1.2, 4, "F")
      }
      const d2X = M + 4 + (pricePosition / 100) * g2W
      pdf.setFillColor(pal.fg[0], pal.fg[1], pal.fg[2]); pdf.circle(d2X, g2Y + 2, 2.5, "F")
      pdf.setFillColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.circle(d2X, g2Y + 2, 1.8, "F")
      pdf.setFontSize(7)
      if (isBelowFair) { pdf.setTextColor(52, 211, 153); pdf.text("Below fair value — potential opportunity", M + 4, g2Y + 9) }
      else { pdf.setTextColor(251, 191, 36); pdf.text("At or above fair value midpoint", M + 4, g2Y + 9) }
      y += 28

      // Arbitrage card
      if (hasArbitrage) {
        pdf.setFillColor(pal.greenTintBg[0], pal.greenTintBg[1], pal.greenTintBg[2]); pdf.rect(M, y, CW, 14, "F")
        pdf.setDrawColor(52, 211, 153); pdf.setLineWidth(0.2); pdf.rect(M, y, CW, 14, "S")
        pdf.setFontSize(8); pdf.setTextColor(52, 211, 153)
        pdf.text("ARBITRAGE OPPORTUNITY", M + 4, y + 5)
        pdf.setFontSize(7.5); pdf.setTextColor(pal.muted[0], pal.muted[1], pal.muted[2])
        pdf.text(`Buy in ${regionLabels[bestRegion]?.short || bestRegion} — save $${Math.round(arbitrageSavings).toLocaleString()} vs most expensive region`, M + 4, y + 11)
        y += 18
      }

      // ═══ PAGE 8: PERFORMANCE & RETURNS ═══
      pdf.addPage(); bg(); chrome("Performance & Returns")
      y = sectionTitle(4, "Performance & Returns", 16)

      // Signal Synthesis card (replaces legacy Investment Grade Breakdown)
      card(M, y, CW, 32)
      pdf.setFontSize(6); dim(); pdf.text("SIGNAL SYNTHESIS", M + 4, y + 5)
      const synthesisLabel = detectedCount >= 5 ? "Well-Documented" : detectedCount >= 2 ? "Partial Coverage" : totalSignalCount > 0 ? "Sparse" : "Pending"
      const synthesisClr = detectedCount >= 5 ? [52,211,153] : detectedCount >= 2 ? [96,165,250] : [251,191,36]
      pdf.setFontSize(22); pdf.setTextColor(synthesisClr[0], synthesisClr[1], synthesisClr[2])
      pdf.text(`${detectedCount}/${totalSignalCount || "—"}`, M + 4, y + 18)
      pdf.setFontSize(10); pdf.text(synthesisLabel, M + 40, y + 18)
      pdf.setFontSize(7); gray()
      pdf.text(`Price Position: ${pricePosition.toFixed(0)}%  |  Risk Score: ${riskScore}/100  |  Similar: ${similarCars.length} vehicles`, M + 4, y + 26)
      y += 38

      // Price vs Fair Value card
      card(M, y, CW, 36)
      pdf.setFontSize(6); dim(); pdf.text("PRICE vs FAIR VALUE", M + 4, y + 5)
      const pvLabels = [
        { lbl: "LISTING PRICE", val: `$${car.currentBid.toLocaleString()}`, clr: [pal.primary[0], pal.primary[1], pal.primary[2]] },
        { lbl: "FAIR LOW", val: fmtPdf(fairLow, regionRange.currency), clr: [52, 211, 153] },
        { lbl: "FAIR HIGH", val: fmtPdf(fairHigh, regionRange.currency), clr: [248, 113, 113] },
      ]
      const pvW = (CW - 12) / 3
      pvLabels.forEach((pv, i) => {
        const px = M + 4 + i * (pvW + 3)
        pdf.setFontSize(6); dim(); pdf.text(pv.lbl, px, y + 12)
        pdf.setFontSize(11); pdf.setTextColor(pv.clr[0], pv.clr[1], pv.clr[2])
        pdf.text(pv.val, px, y + 20)
      })
      // Position bar
      const pvGY = y + 25; const pvGW = CW - 8
      pdf.setFillColor(pal.barBg[0], pal.barBg[1], pal.barBg[2]); pdf.rect(M + 4, pvGY, pvGW, 3, "F")
      const pvDot = M + 4 + (pricePosition / 100) * pvGW
      pdf.setFillColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.rect(M + 4, pvGY, pvDot - M - 4, 3, "F")
      pdf.setFillColor(pal.fg[0], pal.fg[1], pal.fg[2]); pdf.circle(pvDot, pvGY + 1.5, 2, "F")
      pdf.setFillColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.circle(pvDot, pvGY + 1.5, 1.3, "F")
      pdf.setFontSize(7); gray(); pdf.text(`${pricePosition.toFixed(0)}% of fair range`, M + 4, pvGY + 8)
      y += 42

      // ═══ PAGE 8: RISK ASSESSMENT ═══
      pdf.addPage(); bg(); chrome("Risk Assessment")
      y = sectionTitle(5, "Risk Assessment", 16)
      // Risk gauge card
      card(M, y, CW, 26)
      pdf.setFontSize(6); dim(); pdf.text("RISK SCORE", M + 4, y + 5)
      pdf.setFontSize(20)
      const rsClr = riskScore < 35 ? [52,211,153] : riskScore < 55 ? [pal.primary[0],pal.primary[1],pal.primary[2]] : [248,113,113]
      pdf.setTextColor(rsClr[0], rsClr[1], rsClr[2])
      pdf.text(`${riskScore}`, M + 4, y + 16)
      pdf.setFontSize(9); gray(); pdf.text("/100", M + 18, y + 16)
      // Gauge bar
      const rGY = y + 19
      for (let gi = 0; gi < CW - 8; gi++) {
        const pct = gi / (CW - 8)
        const gr = pct < 0.35 ? 52 : pct < 0.55 ? 251 : 248
        const gg = pct < 0.35 ? 211 : pct < 0.55 ? 191 : 113
        const gb = pct < 0.35 ? 153 : pct < 0.55 ? 36 : 113
        pdf.setFillColor(gr, gg, gb); pdf.rect(M + 4 + gi, rGY, 1.2, 3, "F")
      }
      const rDot = M + 4 + (riskScore / 100) * (CW - 8)
      pdf.setFillColor(pal.fg[0], pal.fg[1], pal.fg[2]); pdf.circle(rDot, rGY + 1.5, 2, "F")
      pdf.setFillColor(rsClr[0], rsClr[1], rsClr[2]); pdf.circle(rDot, rGY + 1.5, 1.3, "F")
      y += 32

      // Key strengths card (Collectibility / Why Buy) — not available on HausReport v1
      const keyStrengths: string[] = []
      if (keyStrengths.length > 0) {
        const ksH = 7 + keyStrengths.length * 7
        card(M, y, CW, ksH)
        pdf.setFontSize(6); dim(); pdf.text("INVESTMENT STRENGTHS", M + 4, y + 5)
        keyStrengths.forEach((s, i) => {
          const sy2 = y + 11 + i * 7
          pdf.setFillColor(52, 211, 153); pdf.circle(M + 6, sy2 - 0.5, 0.8, "F")
          pdf.setFontSize(7.5); white()
          const sLines = pdf.splitTextToSize(s, CW - 12)
          pdf.text(sLines, M + 10, sy2)
        })
        y += ksH + 4
      }

      // Red flags card (Model-Specific Concerns)
      const rfH = 7 + flags.length * 7
      card(M, y, CW, rfH)
      pdf.setFontSize(6); dim(); pdf.text("RED FLAGS & MODEL-SPECIFIC CONCERNS", M + 4, y + 5)
      flags.forEach((f, i) => {
        const fy = y + 11 + i * 7
        pdf.setFillColor(248, 113, 113); pdf.circle(M + 6, fy - 0.5, 0.8, "F")
        pdf.setFontSize(7.5); white()
        const fLines = pdf.splitTextToSize(f, CW - 12)
        pdf.text(fLines, M + 10, fy)
      })

      // Risk context card
      y += 11 + flags.length * 7 + 4
      const riskLevel = riskScore < 35 ? "low" : riskScore < 55 ? "moderate" : "elevated"
      card(M, y, CW, 18)
      pdf.setFontSize(6); dim(); pdf.text("RISK CONTEXT", M + 4, y + 5)
      pdf.setFontSize(8); white()
      const riskCtx = pdf.splitTextToSize(`Score ${riskScore}/100 indicates ${riskLevel} risk. Key concerns center on ${flags[0]?.toLowerCase() || "general market conditions"}. ${riskLevel === "low" ? "This vehicle presents a favorable risk profile for investment." : riskLevel === "moderate" ? "Recommend thorough pre-purchase inspection." : "Elevated risk — proceed with caution and specialist inspection."}`, CW - 8)
      pdf.text(riskCtx, M + 4, y + 11)

      // ═══ PAGE 9: DUE DILIGENCE ═══
      pdf.addPage(); bg(); chrome("Due Diligence")
      y = sectionTitle(6, "Due Diligence", 16)
      // Questions card
      card(M, y, CW, 7 + questions.length * 6.5)
      pdf.setFontSize(6); dim(); pdf.text("QUESTIONS FOR THE SELLER", M + 4, y + 5)
      questions.forEach((q, i) => {
        const qy = y + 11 + i * 6.5
        pdf.setFillColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.circle(M + 7, qy - 0.5, 2, "F")
        pdf.setFontSize(6); pdf.setTextColor(pal.onPrimary[0], pal.onPrimary[1], pal.onPrimary[2]); pdf.text(String(i + 1), M + 7, qy + 0.3, { align: "center" })
        pdf.setFontSize(7.5); white(); pdf.text(q, M + 12, qy)
      })
      y += 11 + questions.length * 6.5 + 4

      // Action Items if Purchasing — derived from real data
      const actionItems: string[] = []
      if (flags.length > 0) actionItems.push(`Comprehensive inspection focusing on: ${flags[0].toLowerCase()}`)
      if (isBelowFair) actionItems.push(`Listed below fair value — strong negotiation position at ${pricePosition.toFixed(0)}% of fair range`)
      else actionItems.push(`Listed at ${pricePosition.toFixed(0)}% of fair range — negotiate toward ${fmtPdf(fairLow, regionRange.currency)}`)
      if (hasArbitrage) actionItems.push(`Consider buying in ${regionLabels[bestRegion]?.short || bestRegion} to save $${Math.round(arbitrageSavings).toLocaleString()}`)
      if (car.vin) actionItems.push("Run VIN history report before committing")
      actionItems.push("Verify service records and maintenance history with authorized dealer")

      const aiH = 7 + actionItems.length * 7
      card(M, y, CW, aiH)
      pdf.setFontSize(6); dim(); pdf.text("ACTION ITEMS IF PURCHASING", M + 4, y + 5)
      actionItems.forEach((item, i) => {
        const aiy = y + 11 + i * 7
        pdf.setFontSize(7); pink(); pdf.text(`${i + 1}`, M + 6, aiy)
        pdf.setFontSize(7.5); white()
        const aiLines = pdf.splitTextToSize(item, CW - 14)
        pdf.text(aiLines, M + 12, aiy)
      })

      // ═══ PAGE 10: MARKET CONTEXT ═══
      pdf.addPage(); bg(); chrome("Market Context")
      y = sectionTitle(7, "Market Context", 16)

      // Market overview card — trend + total data points (HausReport v1 doesn't include trend; fall back to car.trend).
      const trendPct = 0
      const trendDir = car.trend ?? "stable"
      const totalComps = report?.comparables_count ?? similarCars.length
      const mktOverviewH = 28
      card(M, y, CW, mktOverviewH)
      pdf.setFontSize(6); dim(); pdf.text("MARKET OVERVIEW", M + 4, y + 5)
      // Trend
      const trendClr = trendDir === "up" ? [52, 211, 153] : trendDir === "down" ? [248, 113, 113] : [251, 191, 36]
      pdf.setFontSize(16); pdf.setTextColor(trendClr[0], trendClr[1], trendClr[2])
      pdf.text(`${trendPct > 0 ? "+" : ""}${trendPct.toFixed(1)}%`, M + 4, y + 16)
      pdf.setFontSize(7); gray(); pdf.text("Price Trend", M + 4, y + 21)
      // Data points
      pdf.setFontSize(16); white(); pdf.text(`${totalComps}`, M + 55, y + 16)
      pdf.setFontSize(7); gray(); pdf.text("Comparable Sales", M + 55, y + 21)
      // Sources
      const sources = regions.flatMap(r => r.sources || []).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4)
      if (sources.length > 0) {
        pdf.setFontSize(16); white(); pdf.text(`${sources.length}`, M + 115, y + 16)
        pdf.setFontSize(7); gray(); pdf.text("Data Sources", M + 115, y + 21)
      }
      y += mktOverviewH + 4

      // Current market conditions
      const mktConditions: string[] = []
      if (trendDir === "up") mktConditions.push(`Market trending upward at ${trendPct > 0 ? "+" : ""}${trendPct.toFixed(1)}% — rising demand for this model`)
      else if (trendDir === "down") mktConditions.push(`Market trending downward at ${trendPct.toFixed(1)}% — potential buying opportunity`)
      else mktConditions.push("Market is stable — prices holding steady across comparable sales")
      if (totalComps >= 10) mktConditions.push(`Strong data depth with ${totalComps} comparable sales — high confidence in valuation`)
      else if (totalComps >= 3) mktConditions.push(`${totalComps} comparable sales available — reasonable confidence in pricing`)
      else mktConditions.push("Limited comparable data — valuations carry higher uncertainty")
      if (sources.length > 0) mktConditions.push(`Data sourced from: ${sources.join(", ")}`)

      const mktCondH = 7 + mktConditions.length * 7
      card(M, y, CW, mktCondH)
      pdf.setFontSize(6); dim(); pdf.text("CURRENT MARKET CONDITIONS", M + 4, y + 5)
      mktConditions.forEach((cond, i) => {
        const cy3 = y + 11 + i * 7
        pdf.setFillColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.circle(M + 6, cy3 - 0.5, 0.8, "F")
        pdf.setFontSize(7.5); white()
        const condLines = pdf.splitTextToSize(cond, CW - 12)
        pdf.text(condLines, M + 10, cy3)
      })
      y += mktCondH + 4

      // Comps card
      card(M, y, CW, 7 + comps.length * 10)
      pdf.setFontSize(6); dim(); pdf.text("COMPARABLE SALES", M + 4, y + 5)
      comps.forEach((s, i) => {
        const sy = y + 11 + i * 10
        pdf.setFontSize(8); white(); pdf.text(s.title, M + 4, sy)
        pdf.setFontSize(7); gray(); pdf.text(`${s.date} · ${s.platform}`, M + 4, sy + 4.5)
        pdf.setFontSize(9); white(); pdf.text(`$${s.price.toLocaleString()}`, W - M - 28, sy, { align: "right" })
        const dClr = s.delta > 0 ? [52,211,153] : [248,113,113]
        badge(`${s.delta > 0 ? "+" : ""}${s.delta}%`, W - M - 22, sy, dClr[0] > 200 ? 40 : 15, dClr[1] > 150 ? 30 : 25, dClr[2] > 150 ? 25 : 18, dClr[0], dClr[1], dClr[2])
      })

      // ═══ PAGE 15: SIMILAR VEHICLES ═══
      pdf.addPage(); bg(); chrome("Similar Vehicles")
      y = sectionTitle(9, "Similar Vehicles", 16)
      const maxSimBid = Math.max(car.currentBid, ...similarCars.map(sc => sc.car.currentBid))
      similarCars.forEach((sc, i) => {
        card(M, y, CW, 16)
        pdf.setFontSize(8); white(); pdf.text(sc.car.title, M + 4, y + 5)
        pdf.setFontSize(7); gray(); pdf.text(sc.car.trend, M + 4, y + 10)
        // Price + bar
        pdf.setFontSize(9); pink(); pdf.text(`$${sc.car.currentBid.toLocaleString()}`, W - M - 4, y + 5, { align: "right" })
        const sbPct = sc.car.currentBid / maxSimBid
        pdf.setFillColor(pal.barBg[0], pal.barBg[1], pal.barBg[2]); pdf.rect(M + 4, y + 12, CW - 8, 2, "F")
        pdf.setFillColor(pal.barFill[0], pal.barFill[1], pal.barFill[2]); pdf.rect(M + 4, y + 12, (CW - 8) * sbPct, 2, "F")
        y += 20
      })

      // ═══ PAGE 16: FINAL VERDICT ═══
      pdf.addPage(); bg(); chrome("Final Verdict")
      y = sectionTitle(10, "Final Verdict", 16)
      // Large verdict badge
      const vClr = verdict === "buy" ? [52,211,153] : verdict === "hold" ? [251,191,36] : [pal.primary[0], pal.primary[1], pal.primary[2]]
      pdf.setFillColor(vClr[0], vClr[1], vClr[2]); pdf.rect(M, y, 55, 18, "F")
      pdf.setFontSize(22); pdf.setTextColor(pal.onPrimary[0], pal.onPrimary[1], pal.onPrimary[2])
      pdf.text((verdict ?? "hold").toUpperCase(), M + 27.5, y + 12.5, { align: "center" })
      y += 25
      // Verdict metrics card (3 cols)
      const vMetrics = [
        { lbl: "SIGNALS", val: `${detectedCount}/${totalSignalCount || "—"}`, clr: detectedCount > 0 ? [52,211,153] : [pal.muted[0],pal.muted[1],pal.muted[2]] },
        { lbl: "FAIR VALUE", val: `${pricePosition}%`, clr: pricePosition <= 100 ? [52,211,153] : [pal.primary[0],pal.primary[1],pal.primary[2]] },
        { lbl: "RISK", val: `${riskScore}/100`, clr: rsClr },
      ]
      const vmW = (CW - 6) / 3
      vMetrics.forEach((vm, i) => {
        const vx = M + i * (vmW + 3)
        card(vx, y, vmW, 16)
        pdf.setFontSize(6); dim(); pdf.text(vm.lbl, vx + 4, y + 5)
        pdf.setFontSize(14); pdf.setTextColor(vm.clr[0], vm.clr[1], vm.clr[2])
        pdf.text(vm.val, vx + 4, y + 13)
      })
      y += 22
      // Summary rows card
      card(M, y, CW, 48)
      pdf.setFontSize(6); dim(); pdf.text("SUMMARY", M + 4, y + 5)
      let sy = y + 10
      sy = cardRow("Price Position", `${pricePosition.toFixed(0)}% of fair range`, M, sy, CW)
      sy = cardRow("Below Fair Value?", isBelowFair ? "YES" : "NO", M, sy, CW)
      sy = cardRow("Best Buy Region", regionLabels[bestRegion]?.short || bestRegion, M, sy, CW)
      if (hasArbitrage) { sy = cardRow("Arbitrage Savings", `$${Math.round(arbitrageSavings).toLocaleString()}`, M, sy, CW) }
      sy = cardRow("Similar Vehicles", `${similarCars.length}`, M, sy, CW)

      // Disclaimer card
      sy += 6
      const disclaimerText = "This analysis is based on current market data and historical trends. Collector car values can fluctuate based on market conditions, economic factors, and individual vehicle condition. This report represents professional analysis, not financial advice."
      const disclaimerLines = pdf.splitTextToSize(disclaimerText, CW - 8)
      const disclaimerH = 8 + disclaimerLines.length * 3.5
      if (sy + disclaimerH > H - 20) { pdf.addPage(); bg(); chrome("Final Verdict"); sy = 16 }
      pdf.setFillColor(pal.card[0], pal.card[1], pal.card[2]); pdf.rect(M, sy, CW, disclaimerH, "F")
      pdf.setDrawColor(pal.border[0], pal.border[1], pal.border[2]); pdf.setLineWidth(0.08); pdf.rect(M, sy, CW, disclaimerH, "S")
      pdf.setFontSize(6); dim(); pdf.text("DISCLAIMER", M + 4, sy + 4)
      pdf.setFontSize(6.5); pdf.setTextColor(pal.muted[0], pal.muted[1], pal.muted[2])
      pdf.text(disclaimerLines, M + 4, sy + 8)
      // Original listing URL
      if (car.sourceUrl) {
        sy += disclaimerH + 3
        pdf.setFontSize(6); dim(); pdf.text("ORIGINAL LISTING:", M, sy)
        pdf.setFontSize(5.5); pdf.setTextColor(pal.primary[0], pal.primary[1], pal.primary[2])
        const urlText = car.sourceUrl.length > 90 ? car.sourceUrl.slice(0, 90) + "..." : car.sourceUrl
        pdf.text(urlText, M + 25, sy)
      }

      // ═══ CLOSING PAGE: THANK YOU ═══
      pdf.addPage(); bg()
      // No chrome on this page — clean, personal
      pdf.setFillColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.rect(0, 0, W, 1.2, "F")
      // Centered decorative line
      pdf.setDrawColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.setLineWidth(0.4)
      pdf.line(W / 2 - 15, 50, W / 2 + 15, 50)
      // Thank you message
      pdf.setFontSize(24); white()
      pdf.text(`Thank you, ${firstName}.`, W / 2, 68, { align: "center" })
      // Body text
      pdf.setFontSize(10); pdf.setTextColor(pal.closingText[0], pal.closingText[1], pal.closingText[2])
      const closingLines = [
        "We hope this dossier gives you the confidence and clarity",
        "to make the right decision at the right time.",
        "",
        "Whether you choose to bid today or continue exploring,",
        "MONZA Haus is here to support your journey.",
        "",
        "Great cars find great owners — and we believe",
        `the ${pdfTitle} deserves someone who truly`,
        "understands its value.",
      ]
      let cy = 82
      closingLines.forEach(line => {
        if (line === "") { cy += 5; return }
        pdf.text(line, W / 2, cy, { align: "center" })
        cy += 6
      })
      // Divider
      cy += 12
      pdf.setDrawColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.setLineWidth(0.2)
      pdf.line(W / 2 - 20, cy, W / 2 + 20, cy)
      cy += 12
      // What's next section
      pdf.setFontSize(8); pink()
      pdf.text("WHAT'S NEXT", W / 2, cy, { align: "center" })
      cy += 8
      pdf.setFontSize(9); pdf.setTextColor(pal.closingText[0], pal.closingText[1], pal.closingText[2])
      const nextSteps = [
        "Explore more vehicles in our curated marketplace",
        "Generate dossiers for any listing that catches your eye",
        "Compare investment grades across your shortlist",
      ]
      nextSteps.forEach((step, i) => {
        pdf.setFontSize(7); pink(); pdf.text(`${i + 1}`, W / 2 - 45, cy, { align: "center" })
        pdf.setFontSize(9); pdf.setTextColor(pal.closingText[0], pal.closingText[1], pal.closingText[2]); pdf.text(step, W / 2 - 38, cy)
        cy += 7
      })
      // Brand footer
      pdf.setDrawColor(pal.border[0], pal.border[1], pal.border[2]); pdf.setLineWidth(0.15)
      pdf.line(M, H - 45, W - M, H - 45)
      pdf.setFontSize(9); pink()
      pdf.text("MONZA HAUS", W / 2, H - 36, { align: "center" })
      pdf.setFontSize(7); pdf.setTextColor(pal.footerDim[0], pal.footerDim[1], pal.footerDim[2])
      pdf.text("Collector Vehicle Intelligence", W / 2, H - 30, { align: "center" })
      pdf.text("www.monzahaus.com", W / 2, H - 24, { align: "center" })
      // Bottom accent
      pdf.setFillColor(pal.primary[0], pal.primary[1], pal.primary[2]); pdf.rect(0, H - 2, W, 2, "F")

      // Save
      const carSlug = `${car.year}-${car.make}-${car.model}`.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")
      const userSlug = user?.name ? `_${user.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")}` : ""
      pdf.save(`Monza-Dossier_${carSlug}${userSlug}.pdf`)
    } catch (err) {
      console.error("PDF generation failed:", err)
    } finally {
      setDownloadingPdf(false)
    }
  }

  // ─── EXCEL DOWNLOAD ───
  const handleDownloadExcel = async () => {
    setDownloadingExcel(true)
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.utils.book_new()

      // ═══ Sheet 1: Summary ═══
      const coverData: (string | number)[][] = [
        ["MONZA HAUS — Investment Dossier"],
        [""],
        ["VEHICLE"],
        ["Full Title", `${car.year} ${car.make} ${car.model}${car.trim && car.trim !== "—" && car.trim !== car.model ? " " + car.trim : ""}`],
        ["Year", car.year],
        ["Make", car.make],
        ["Model", car.model],
        ["Trim", car.trim || "—"],
        ["Engine", car.engine],
        ["Transmission", car.transmission],
        ["Mileage", car.mileage],
        ["Mileage Unit", car.mileageUnit],
        ...(car.exteriorColor ? [["Exterior Color", car.exteriorColor]] : []),
        ...(car.interiorColor ? [["Interior Color", car.interiorColor]] : []),
        [""],
        ["LISTING"],
        ["Platform", car.platform.replace(/_/g, " ")],
        ["Status", car.status],
        ["Listing Price (USD)", car.currentBid],
        ["Bid Count", car.bidCount],
        ["Location", car.location],
        ["Region", car.region],
        ["Category", car.category],
        [""],
        ["INVESTMENT ANALYSIS"],
        ["Signals Detected", `${detectedCount}/${totalSignalCount || "—"}`],
        ["Verdict", (verdict ?? "hold").toUpperCase()],
        ["Fair Value Low (USD)", fairLow],
        ["Fair Value High (USD)", fairHigh],
        ["Fair Value Midpoint (USD)", Math.round((fairLow + fairHigh) / 2)],
        ["Price Position (%)", pricePosition],
        ["Below Fair Value?", isBelowFair ? "YES" : "NO"],
        ["Risk Score (0-100)", riskScore],
        ["Trend", car.trend],
        [""],
        ["ARBITRAGE"],
        ["Best Buy Region", regionLabels[bestRegion]?.short || bestRegion],
        ["Arbitrage Savings (USD)", hasArbitrage ? Math.round(arbitrageSavings) : 0],
        ...(report ? [
          [""],
          ["MARKET DATA (from report)"],
          ["Median Price (USD)", report.median_price ?? "N/A"],
          ["Fair Value Low (USD)", report.fair_value_low ?? "N/A"],
          ["Fair Value High (USD)", report.fair_value_high ?? "N/A"],
          ["Specific-Car Fair Value Low", report.specific_car_fair_value_low ?? "N/A"],
          ["Specific-Car Fair Value Mid", report.specific_car_fair_value_mid ?? "N/A"],
          ["Specific-Car Fair Value High", report.specific_car_fair_value_high ?? "N/A"],
          ["Comparables Count", report.comparables_count ?? 0],
          ["Comparable Layer Used", report.comparable_layer_used ?? "N/A"],
        ] as (string | number)[][] : []),
        [""],
        [`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`],
        ...(user?.name ? [[`Prepared for: ${user.name}`]] : []),
        ["CONFIDENTIAL — www.monzahaus.com"],
      ]
      const ws1 = XLSX.utils.aoa_to_sheet(coverData)
      ws1["!cols"] = [{ wch: 28 }, { wch: 50 }]
      ws1["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
      XLSX.utils.book_append_sheet(wb, ws1, "Summary")

      // ═══ Sheet 2: Regional Valuation ═══
      const valuationRows: (string | number)[][] = [
        ["REGIONAL FAIR VALUE COMPARISON"],
        [""],
        ["Region", "Currency", "Fair Low", "Fair High", "Fair Avg", "Avg (USD)", "Premium vs Best", "Best Buy?"],
      ]
      const regionKeys = ["US", "EU", "UK", "JP"] as const
      const bestAvgUsd = (pricing[bestRegion as keyof typeof pricing].low + pricing[bestRegion as keyof typeof pricing].high) / 2
      for (const r of regionKeys) {
        const rp = pricing[r]
        const avg = (rp.low + rp.high) / 2
        const avgUsd = avg
        const diff = avgUsd - bestAvgUsd
        const premiumPct = bestAvgUsd > 0 ? ((diff / bestAvgUsd) * 100) : 0
        valuationRows.push([
          regionLabels[r].short,
          rp.currency,
          Math.round(rp.low),
          Math.round(rp.high),
          Math.round(avg),
          Math.round(avgUsd),
          r === bestRegion ? 0 : Math.round(diff),
          r === bestRegion ? "YES" : "NO",
        ])
      }
      valuationRows.push(
        [""],
        ["PRICE ANALYSIS"],
        ["Listing Price (USD)", car.currentBid],
        ["Fair Midpoint (USD)", Math.round((fairLow + fairHigh) / 2)],
        ["Price Position (%)", pricePosition],
        ["Discount/Premium (USD)", Math.round(car.currentBid - (fairLow + fairHigh) / 2)],
        ["Below Fair Value?", isBelowFair ? "YES" : "NO"],
      )
      const ws2 = XLSX.utils.aoa_to_sheet(valuationRows)
      ws2["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 10 }]
      ws2["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }]
      XLSX.utils.book_append_sheet(wb, ws2, "Valuation")

      // ═══ Sheet 3: Similar Vehicles ═══
      if (similarCars.length > 0) {
        const simRows: (string | number)[][] = [
          ["SIMILAR VEHICLES ON MARKET"],
          [""],
          ["Title", "Year", "Make", "Model", "Price (USD)", "Trend", "Platform", "Mileage", "Match Score", "Match Reasons"],
        ]
        for (const sc of similarCars) {
          simRows.push([
            sc.car.title,
            sc.car.year,
            sc.car.make,
            sc.car.model,
            sc.car.currentBid,
            sc.car.trend,
            sc.car.platform.replace(/_/g, " "),
            sc.car.mileage,
            Math.round(sc.score * 100),
            sc.matchReasons.join(", "),
          ])
        }
        // Summary stats
        const simPrices = similarCars.map(sc => sc.car.currentBid).filter(p => p > 0)
        if (simPrices.length > 0) {
          const simAvg = Math.round(simPrices.reduce((a, b) => a + b, 0) / simPrices.length)
          const simMin = Math.min(...simPrices)
          const simMax = Math.max(...simPrices)
          const simSorted = [...simPrices].sort((a, b) => a - b)
          const simMedian = simSorted[Math.floor(simSorted.length / 2)]
          simRows.push(
            [""],
            ["STATISTICS"],
            ["Count", similarCars.length],
            ["Avg Price (USD)", simAvg],
            ["Median Price (USD)", simMedian],
            ["Min Price (USD)", simMin],
            ["Max Price (USD)", simMax],
            ["Price Range (USD)", simMax - simMin],
            ["This Car vs Avg", car.currentBid - simAvg],
            ["This Car vs Avg (%)", simAvg > 0 ? Math.round(((car.currentBid - simAvg) / simAvg) * 100) : 0],
          )
        }
        const wsSim = XLSX.utils.aoa_to_sheet(simRows)
        wsSim["!cols"] = [{ wch: 40 }, { wch: 6 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 7 }, { wch: 8 }, { wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 30 }]
        wsSim["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }]
        XLSX.utils.book_append_sheet(wb, wsSim, "Similar Vehicles")
      }

      // ═══ Sheet 4: Comparable Sales ═══
      if (comps.length > 0) {
        const compsRows: (string | number)[][] = [
          ["COMPARABLE SALES"],
          [""],
          ["Vehicle", "Sale Price (USD)", "Date", "Platform", "Delta vs Current (%)"],
        ]
        for (const s of comps) {
          compsRows.push([s.title, s.price, s.date, s.platform, s.delta])
        }
        const avgCompPrice = Math.round(comps.reduce((sum, s) => sum + s.price, 0) / comps.length)
        const sortedDeltas = [...comps].sort((a, b) => a.delta - b.delta)
        const medianDelta = sortedDeltas[Math.floor(sortedDeltas.length / 2)].delta
        compsRows.push(
          [""],
          ["STATISTICS"],
          ["Count", comps.length],
          ["Avg Sale Price (USD)", avgCompPrice],
          ["Median Delta (%)", medianDelta],
          ["This Car vs Avg Comp", car.currentBid - avgCompPrice],
        )
        const ws3 = XLSX.utils.aoa_to_sheet(compsRows)
        ws3["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 18 }]
        ws3["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }]
        XLSX.utils.book_append_sheet(wb, ws3, "Comparable Sales")
      }

      // ═══ Sheet 5: Regional Market Data (if available) ═══
      if (regions.length > 0) {
        const regionRows: (string | number)[][] = [
          ["REGIONAL MARKET DATA"],
          [""],
          ["Region", "Tier", "Median Price", "P25", "P75", "Min", "Max", "Count", "Trend", "Currency"],
        ]
        for (const r of regions) {
          regionRows.push([
            r.region,
            r.tierLabel,
            r.medianPrice,
            r.p25Price,
            r.p75Price,
            r.minPrice,
            r.maxPrice,
            r.totalListings,
            `${r.trendDirection} (${r.trendPercent > 0 ? "+" : ""}${r.trendPercent}%)`,
            r.currency,
          ])
        }
        const wsSold = XLSX.utils.aoa_to_sheet(regionRows)
        wsSold["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 16 }, { wch: 8 }]
        wsSold["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }]
        XLSX.utils.book_append_sheet(wb, wsSold, "Regional Data")
      }

      // ═══ Sheet 6: Due Diligence (only if data available) ═══
      if (flags.length > 0 || questions.length > 0) {
        const ddRows: (string | number)[][] = [
          ["DUE DILIGENCE CHECKLIST"],
          [""],
        ]
        if (flags.length > 0) {
          ddRows.push(
            ["RED FLAGS — Key Risk Areas"],
            ["#", "Risk Item"],
            ...flags.map((f, i) => [i + 1, f]),
            [""],
          )
        }
        if (questions.length > 0) {
          ddRows.push(
            ["SELLER QUESTIONS — Pre-Purchase"],
            ["#", "Question"],
            ...questions.map((q, i) => [i + 1, q]),
          )
        }
        const wsDd = XLSX.utils.aoa_to_sheet(ddRows)
        wsDd["!cols"] = [{ wch: 6 }, { wch: 60 }]
        wsDd["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
        XLSX.utils.book_append_sheet(wb, wsDd, "Due Diligence")
      }

      const carSlug = `${car.year}-${car.make}-${car.model}`.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")
      const userSlug = user?.name ? `_${user.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")}` : ""
      XLSX.writeFile(wb, `Monza-Data_${carSlug}${userSlug}.xlsx`)
    } catch (err) {
      console.error("Excel generation failed:", err)
    } finally {
      setDownloadingExcel(false)
    }
  }

  // ─── PAYWALL BLUR WRAPPER ───
  const PaywallSection = ({ children, sectionId }: { children: React.ReactNode; sectionId: SectionId }) => {
    if (sectionId === "summary" || hasAccess) return <>{children}</>
    return (
      <div className="relative">
        <div className="blur-sm pointer-events-none select-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-2xl">
          <div className="text-center px-6 py-8">
            <Lock className="size-8 text-primary mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-foreground mb-1">{t("unlockReport")}</p>
            <p className="text-[11px] text-muted-foreground max-w-[280px]">{t("unlockDesc")}</p>
            <button
              onClick={handleUnlock}
              className="mt-4 flex items-center gap-2 mx-auto rounded-xl bg-primary px-6 py-3 text-[12px] font-semibold text-background hover:bg-primary/80 active:scale-[0.97] transition-all"
            >
              <Coins className="size-4" />
              {t("unlockCost")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── SECTION HEADER ───
  const SectionHeader = ({ id, title }: { id: SectionId; title: string }) => {
    const Icon = SECTION_ICONS[id]
    const sectionNumber = SECTION_IDS.indexOf(id) + 1
    return (
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <div>
          <span className="text-[9px] tabular-nums text-muted-foreground tracking-wider">SECTION {String(sectionNumber).padStart(2, "0")}</span>
          <h2 className="text-[16px] md:text-[18px] font-bold text-foreground leading-tight">{title}</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ═══ STICKY NAV — Desktop: sidebar, Mobile: top pills ═══ */}

      {/* MOBILE: Sticky top pills */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-2 px-3 py-2">
          <Link
            href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
            className="shrink-0 p-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex-1 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 min-w-max">
              {SECTION_IDS.map(id => {
                const Icon = SECTION_ICONS[id]
                const isActive = activeSection === id
                const isLocked = id !== "summary" && !hasAccess
                return (
                  <button
                    key={id}
                    onClick={() => scrollToSection(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? "bg-primary/15 text-primary border border-primary/20"
                        : "text-muted-foreground hover:text-muted-foreground"
                    }`}
                  >
                    {isLocked ? <Lock className="size-2.5" /> : <Icon className="size-2.5" />}
                    {t(`sections.${id}`)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP: Fixed left sidebar nav */}
      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-[240px] flex-col bg-background border-r border-border z-40 pt-[var(--app-header-h,80px)]">
        <div className="px-4 py-4 border-b border-border">
          <Link
            href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
            className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="size-3" />
            {t("backToVehicle")}
          </Link>
          <h1 className="text-[13px] font-bold text-foreground mt-2 leading-tight">{car.title}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-muted-foreground">{t("title")}</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {SECTION_IDS.map((id, i) => {
            const Icon = SECTION_ICONS[id]
            const isActive = activeSection === id
            const isLocked = id !== "summary" && !hasAccess
            return (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all mb-0.5 ${
                  isActive
                    ? "bg-primary/8 text-primary"
                    : "text-muted-foreground hover:text-muted-foreground hover:bg-foreground/2"
                }`}
              >
                <span className="text-[9px] tabular-nums w-4 text-right">{String(i + 1).padStart(2, "0")}</span>
                {isLocked ? <Lock className="size-3.5 shrink-0" /> : <Icon className="size-3.5 shrink-0" />}
                <span className="text-[11px] font-medium">{t(`sections.${id}`)}</span>
              </button>
            )
          })}
        </nav>

        {hasAccess ? (
          <div className="p-3 border-t border-border">
            <button
              onClick={() => setShowDownloadSheet(true)}
              disabled={downloadingPdf || downloadingExcel}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-primary text-background hover:bg-primary/80 active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {(downloadingPdf || downloadingExcel) ? (
                <>
                  <div className="size-4 rounded-full border-2 border-background/30 border-t-background animate-spin shrink-0" />
                  <span className="text-[12px] font-semibold">{t("downloadGenerating")}</span>
                </>
              ) : (
                <>
                  <Download className="size-4 shrink-0" />
                  <span className="text-[12px] font-semibold flex-1 text-left">{t("downloadButton")}</span>
                  <ChevronRight className="size-3.5 opacity-50 shrink-0" />
                </>
              )}
            </button>
          </div>
        ) : !tokensLoading && (
          <div className="p-4 border-t border-border">
            <button
              onClick={handleUnlock}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[11px] font-semibold uppercase tracking-wider text-background hover:bg-primary/80 transition-colors"
            >
              <Lock className="size-3.5" />
              {t("unlockReport")}
            </button>
            <p className="text-[9px] text-muted-foreground text-center mt-2">{t("unlockCost")}</p>
          </div>
        )}
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="md:ml-[240px] pt-[52px] md:pt-[var(--app-header-h,80px)]">
        <div className={`max-w-[840px] mx-auto px-4 md:px-8 ${hasAccess ? "pb-32" : "pb-24"}`}>

          {/* ═══ COVER / HERO ═══ */}
          <div className="relative aspect-[16/9] md:aspect-[21/9] rounded-2xl md:rounded-3xl overflow-hidden mt-4 md:mt-6">
            <Image
              src={car.image}
              alt={car.title}
              fill
              className="object-cover"
              priority
              sizes="(min-width: 768px) 840px, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
            <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 right-4 md:right-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-bold border border-primary/20 backdrop-blur-md">
                  {t("title")}
                </span>
                {!hasAccess && (
                  <span className="px-2 py-0.5 rounded-full bg-black/30 text-white/70 text-[9px] font-medium backdrop-blur-md">
                    {t("freePreview")}
                  </span>
                )}
              </div>
              <h1 className="text-[20px] md:text-[28px] font-bold text-white">{car.title}</h1>
              <p className="text-[11px] md:text-[13px] text-white/60 mt-1">{t("subtitle")}</p>
            </div>
          </div>

          <div className="space-y-6 md:space-y-8 mt-6 md:mt-8">

            {/* ═══════════════════════════════════════
                §1 — EXECUTIVE SUMMARY (always visible)
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("summary")} id="section-summary" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <SectionHeader id="summary" title={t("sections.summary")} />

              {/* Specific-Car Fair Value headline (replaces legacy Grade) */}
              {report && (
                <div className="rounded-2xl border border-border bg-card p-5 mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {tFairValue("specificCarTitle")}
                  </p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {formatUsd(report.specific_car_fair_value_low)} – {formatUsd(report.specific_car_fair_value_high)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tFairValue("baselineSubtitle", { count: report.comparables_count })}
                  </p>
                </div>
              )}

              {/* 5-metric grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* Current Price */}
                <div className="rounded-xl bg-card border border-border p-4">
                  <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">{t("summary.currentPrice")}</span>
                  <p className="text-[20px] font-bold tabular-nums text-primary mt-1">{formatPrice(car.currentBid)}</p>
                </div>
                {/* Fair Value */}
                <div className="rounded-xl bg-card border border-border p-4">
                  <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">{t("summary.fairValue")}</span>
                  <p className="text-[14px] tabular-nums font-semibold text-foreground mt-2">
                    {formatRegionalPrice(convertFromUsd(fairLow), currencySymbol)} – {formatRegionalPrice(convertFromUsd(fairHigh), currencySymbol)}
                  </p>
                </div>
                {/* Market Position */}
                <div className="rounded-xl bg-card border border-border p-4">
                  <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">Market Position</span>
                  <p className={`text-[24px] font-bold tabular-nums mt-1 ${pricePosition <= 100 ? "text-positive" : "text-primary"}`}>
                    {pricePosition.toFixed(0)}%
                  </p>
                </div>
                {/* Similar Cars */}
                <div className="rounded-xl bg-card border border-border p-4">
                  <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">Similar Cars</span>
                  <p className="text-[24px] font-bold tabular-nums text-foreground mt-1">{similarCars.length}</p>
                </div>
                {/* Risk Score */}
                <div className="rounded-xl bg-card border border-border p-4">
                  <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">{t("summary.riskScore")}</span>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-[6px] rounded-full bg-foreground/[0.04] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${riskScore <= 30 ? "bg-positive" : riskScore <= 50 ? "bg-amber-400" : "bg-destructive"}`}
                        style={{ width: `${riskScore}%` }}
                      />
                    </div>
                    <span className={`text-[12px] font-bold ${riskScore <= 30 ? "text-positive" : riskScore <= 50 ? "text-destructive" : "text-destructive"}`}>
                      {riskScore}/100
                    </span>
                  </div>
                </div>
              </div>

              {/* Verdict one-liner */}
              <div className="mt-4 rounded-xl bg-primary/5 border border-primary/15 p-4">
                <div className="flex items-start gap-3">
                  <Scale className="size-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-semibold text-primary mb-1">{t("summary.verdict")}</p>
                    <p className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-line">{stripHtml(car.thesis)}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════
                §2 — VEHICLE IDENTITY & PROVENANCE
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("identity")} id="section-identity" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="identity">
                <SectionHeader id="identity" title={t("sections.identity")} />

                {/* Specs grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  {[
                    { label: t("identity.engine"), value: car.engine, icon: <Gauge className="size-4" /> },
                    { label: t("identity.transmission"), value: car.transmission, icon: <Cog className="size-4" /> },
                    { label: t("identity.mileage"), value: `${car.mileage.toLocaleString()} ${car.mileageUnit}`, icon: <TrendingUp className="size-4" /> },
                    { label: t("identity.location"), value: car.location, icon: <MapPin className="size-4" /> },
                    { label: t("identity.category"), value: car.category, icon: <Car className="size-4" /> },
                  ].map((spec, i) => (
                    <div key={i} className="rounded-xl bg-card border border-border p-4">
                      <div className="flex items-center gap-2 text-primary/60 mb-2">
                        {spec.icon}
                        <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">{spec.label}</span>
                      </div>
                      <span className="text-[14px] font-semibold text-foreground">{spec.value}</span>
                    </div>
                  ))}
                </div>

                {/* Provenance */}
                <div className="rounded-xl bg-card border border-border p-5 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <History className="size-4 text-primary" />
                    <h3 className="text-[12px] font-semibold text-foreground">{t("identity.provenance")}</h3>
                  </div>
                  <div className="border-l-2 border-primary/20 pl-4">
                    <p className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-line">{stripHtml(car.history)}</p>
                  </div>
                </div>

                {/* Platform data */}
                <div className="rounded-xl bg-card border border-border p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="size-4 text-primary" />
                    <h3 className="text-[12px] font-semibold text-foreground">{t("identity.platformData")}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("identity.platform")}</span>
                      <div className="flex items-center gap-2 mt-1">
                        {platform && <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${platform.color}`}>{platform.short}</span>}
                        <span className="text-[12px] text-muted-foreground">{car.platform.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("identity.currentBid")}</span>
                      <p className="text-[16px] tabular-nums font-bold text-primary mt-1">{formatPrice(car.currentBid)}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("identity.bidCount")}</span>
                      <p className="text-[14px] font-semibold text-foreground mt-1">{car.bidCount}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("identity.status")}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        {isLive && <div className="size-1.5 rounded-full bg-positive animate-pulse" />}
                        <span className={`text-[12px] font-semibold ${isLive ? "text-positive" : "text-muted-foreground"}`}>
                          {car.status === "ENDED" ? "Ended" : isLive ? `Live · ${timeLeft(car.endTime)}` : car.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §3 — MARKET VALUATION & REGIONAL ARBITRAGE
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("valuation")} id="section-valuation" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="valuation">
                <SectionHeader id="valuation" title={t("sections.valuation")} />

                {/* Regional breakdown bars */}
                <div className="rounded-xl bg-card border border-border p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-4">{t("valuation.regionalBreakdown")}</h3>
                  <div className="space-y-4">
                    {(["US", "EU", "UK", "JP"] as const).map(r => {
                      const rp = pricing[r]
                      const avgUsd = (rp.low + rp.high) / 2
                      const barWidth = maxRegionalUsd > 0 ? (avgUsd / maxRegionalUsd) * 100 : 50
                      const isBest = r === bestRegion
                      const isUserRegion = r === effectiveRegion
                      return (
                        <div key={r}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px]">{regionLabels[r].flag}</span>
                              <span className="text-[12px] font-medium text-foreground">{regionLabels[r].short}</span>
                              {isBest && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-positive/15 text-positive border border-positive/20">
                                  {t("valuation.bestBuy")}
                                </span>
                              )}
                              {isUserRegion && !isBest && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-primary/15 text-primary border border-primary/20">
                                  {t("valuation.yourMarket")}
                                </span>
                              )}
                            </div>
                            <span className="text-[12px] tabular-nums text-muted-foreground">
                              {formatRegionalPrice(convertFromUsd(rp.low), currencySymbol)} – {formatRegionalPrice(convertFromUsd(rp.high), currencySymbol)}
                            </span>
                          </div>
                          <div className="relative h-[8px] rounded-full bg-foreground/[0.04] overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.8, delay: 0.1 }}
                              className={`h-full rounded-full ${isBest ? "bg-positive" : "bg-primary/40"}`}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Market position gauge */}
                <div className="rounded-xl bg-card border border-border p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-3">{t("valuation.marketPositionGauge")}</h3>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] tabular-nums text-muted-foreground">{formatRegionalPrice(convertFromUsd(fairLow), currencySymbol)}</span>
                    <span className="text-[9px] text-muted-foreground">{effectiveRegion} Fair Value Range</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{formatRegionalPrice(convertFromUsd(fairHigh), currencySymbol)}</span>
                  </div>
                  <div className="relative h-[12px] rounded-full bg-foreground/[0.04] overflow-hidden">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400/20 via-primary/20 to-red-400/20" />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 size-[14px] rounded-full bg-primary border-2 border-background shadow-lg shadow-primary/40"
                      style={{ left: `calc(${pricePosition}% - 7px)` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {isBelowFair ? (
                      <>
                        <CheckCircle2 className="size-3.5 text-positive" />
                        <span className="text-[11px] font-medium text-positive">{t("valuation.belowFair")}</span>
                      </>
                    ) : pricePosition > 80 ? (
                      <>
                        <AlertTriangle className="size-3.5 text-destructive" />
                        <span className="text-[11px] font-medium text-destructive">{t("valuation.aboveFair")}</span>
                      </>
                    ) : (
                      <>
                        <Target className="size-3.5 text-destructive" />
                        <span className="text-[11px] font-medium text-destructive">{t("valuation.atFair")}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Modifiers applied list — adjustments to specific-car fair value */}
                <div className="mb-4">
                  <ModifiersAppliedList modifiers={report?.modifiers_applied ?? []} />
                </div>

                {/* Arbitrage alert */}
                {hasArbitrage && (
                  <div className="rounded-xl bg-positive/[0.05] border border-positive/20 p-5 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="size-8 rounded-lg bg-positive/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Globe className="size-4 text-positive" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-positive mb-1">{t("valuation.arbitrageAlert")}</p>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">
                          {t("valuation.arbitrageDesc", { region: regionLabels[bestRegion]?.short || bestRegion, amount: formatUsd(arbitrageSavings) })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Comparable sales */}
                <div className="rounded-xl bg-card border border-border p-5">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-4">{t("valuation.comparables")}</h3>
                  {comps.length > 0 ? (
                    <div className="space-y-2">
                      {comps.map((sale, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-foreground/2 border border-border">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-foreground truncate">{sale.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{sale.date} · {sale.platform}</p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="text-[16px] font-bold tabular-nums text-foreground">{formatPrice(sale.price)}</p>
                            <span className={`text-[10px] tabular-nums font-semibold ${sale.delta > 0 ? "text-positive" : "text-destructive"}`}>
                              {sale.delta > 0 ? "+" : ""}{sale.delta}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-muted-foreground italic">Awaiting backend data</p>
                  )}
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §3b — SIGNALS DETECTED
                ═══════════════════════════════════════ */}
            <section className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <SignalsDetectedSection signals={report?.signals_detected ?? []} />
            </section>

            {/* ═══════════════════════════════════════
                §4 — INVESTMENT PERFORMANCE
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("performance")} id="section-performance" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="performance">
                <SectionHeader id="performance" title={t("sections.performance")} />

                {/* Market Position */}
                <div className="rounded-xl bg-card border border-border p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-4">
                    Market Position
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-semibold text-primary">Listing Price vs Fair Value</span>
                        <span className={`text-[14px] tabular-nums font-bold ${pricePosition <= 100 ? "text-positive" : "text-primary"}`}>{pricePosition.toFixed(0)}%</span>
                      </div>
                      <div className="relative h-[10px] rounded-full bg-foreground/[0.04] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pricePosition, 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.1 }}
                          className={`h-full rounded-full bg-gradient-to-r ${pricePosition <= 100 ? "from-emerald-400 to-emerald-400/60" : "from-primary to-primary/60"}`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Fair Value: {formatRegionalPrice(convertFromUsd(fairLow), currencySymbol)} – {formatRegionalPrice(convertFromUsd(fairHigh), currencySymbol)}</span>
                      <span>{isBelowFair ? "Below fair value" : "At or above fair value"}</span>
                    </div>
                  </div>
                  {isBelowFair && (
                    <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-positive/[0.05] border border-positive/10">
                      <TrendingUp className="size-3.5 text-positive" />
                      <span className="text-[11px] text-positive">Priced below fair value — potential opportunity</span>
                    </div>
                  )}
                </div>

                {/* Similar Cars Price Comparison */}
                {similarCars.length > 0 && (() => {
                  const allCars = [{ ...car, isCurrent: true }, ...similarCars.map(sc => ({ ...sc.car, isCurrent: false }))]
                  const maxBid = Math.max(...allCars.map(c => c.currentBid))
                  return (
                    <div className="rounded-xl bg-card border border-border p-5 mt-4">
                      <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-1">{t("performance.similarComparison")}</h3>
                      <p className="text-[10px] text-muted-foreground mb-5">{t("performance.similarComparisonDesc")}</p>

                      <div className="space-y-3">
                        {allCars.map((c, i) => {
                          const barPct = maxBid > 0 ? (c.currentBid / maxBid) * 100 : 50
                          const isCurrent = "isCurrent" in c && c.isCurrent
                          return (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className={`text-[11px] font-medium truncate ${isCurrent ? "text-primary" : "text-foreground"}`}>
                                    {c.title}
                                  </span>
                                  {isCurrent && (
                                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[7px] font-bold bg-primary/15 text-primary border border-primary/20">
                                      THIS CAR
                                    </span>
                                  )}
                                </div>
                                <span className={`text-[12px] tabular-nums font-semibold shrink-0 ml-3 ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                                  {formatPrice(c.currentBid)}
                                </span>
                              </div>
                              <div className="relative h-[6px] rounded-full bg-foreground/[0.04] overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${barPct}%` }}
                                  transition={{ duration: 0.7, delay: 0.1 + i * 0.08 }}
                                  className={`h-full rounded-full ${isCurrent ? "bg-primary" : "bg-foreground/10"}`}
                                />
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className={`text-[9px] ${c.trend === "Appreciating" ? "text-positive" : c.trend === "Stable" ? "text-destructive" : "text-destructive"}`}>
                                  {c.trend}
                                </span>
                                <span className="text-[9px] text-muted-foreground">{c.category}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Summary stats */}
                      <div className="mt-5 pt-4 border-t border-border grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <span className="text-[8px] font-medium tracking-[0.1em] uppercase text-muted-foreground block">{t("performance.avgPrice")}</span>
                          <span className="text-[13px] tabular-nums font-bold text-foreground mt-0.5 block">
                            {formatPrice(Math.round(allCars.reduce((s, c) => s + c.currentBid, 0) / allCars.length))}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="text-[8px] font-medium tracking-[0.1em] uppercase text-muted-foreground block">{t("performance.priceRank")}</span>
                          <span className="text-[13px] tabular-nums font-bold text-primary mt-0.5 block">
                            #{[...allCars].sort((a, b) => b.currentBid - a.currentBid).findIndex(c => "isCurrent" in c && c.isCurrent) + 1}/{allCars.length}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="text-[8px] font-medium tracking-[0.1em] uppercase text-muted-foreground block">{t("performance.vsMkt")}</span>
                          {(() => {
                            const avg = similarCars.reduce((s, c) => s + c.car.currentBid, 0) / similarCars.length
                            const diff = ((car.currentBid - avg) / avg) * 100
                            return (
                              <span className={`text-[13px] tabular-nums font-bold mt-0.5 block ${diff > 0 ? "text-primary" : "text-positive"}`}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §5 — RISK ASSESSMENT
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("risk")} id="section-risk" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="risk">
                <SectionHeader id="risk" title={t("sections.risk")} />

                {/* Risk gauge */}
                <div className="rounded-xl bg-card border border-border p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-3">{t("risk.overallScore")}</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="relative h-[10px] rounded-full bg-foreground/[0.04] overflow-hidden">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400/30 via-amber-400/30 to-red-400/30" />
                        <motion.div
                          initial={{ left: 0 }}
                          animate={{ left: `calc(${riskScore}% - 8px)` }}
                          transition={{ duration: 0.8 }}
                          className="absolute top-1/2 -translate-y-1/2 size-[16px] rounded-full bg-white border-2 border-background shadow-lg"
                          style={{ left: `calc(${riskScore}% - 8px)` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[9px] text-positive">{t("risk.low")}</span>
                        <span className="text-[9px] text-destructive">{t("risk.moderate")}</span>
                        <span className="text-[9px] text-destructive">{t("risk.high")}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[28px] font-black ${riskScore <= 30 ? "text-positive" : riskScore <= 50 ? "text-destructive" : "text-destructive"}`}>
                        {riskScore}
                      </span>
                      <span className="text-[12px] text-muted-foreground">/100</span>
                    </div>
                  </div>
                </div>

                {/* Red flags — only show when DB data available */}
                {hasDbRiskData ? (
                  <div className="rounded-xl bg-card border border-border p-5">
                    <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-3">{t("risk.knownIssues")}</h3>
                    <div className="space-y-2">
                      {flags.map((flag, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-border">
                          <AlertTriangle className="size-4 text-primary mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-foreground">{flag}</p>
                          </div>
                          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                            i < 2 ? "bg-primary/15 text-primary" : "bg-foreground/5 text-muted-foreground"
                          }`}>
                            {i < 2 ? t("risk.critical") : t("risk.monitor")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-card border border-border p-5">
                    <p className="text-[13px] text-muted-foreground text-center">
                      Detailed risk analysis not yet available for this vehicle.
                    </p>
                  </div>
                )}
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §6 — DUE DILIGENCE TOOLKIT
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("dueDiligence")} id="section-dueDiligence" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="dueDiligence">
                <SectionHeader id="dueDiligence" title={t("sections.dueDiligence")} />

                {/* Questions to ask */}
                <div className="rounded-xl bg-card border border-border p-5 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">{t("dueDiligence.questionsToAsk")}</h3>
                    <button
                      onClick={handleCopyQuestions}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/[0.03] border border-border text-[10px] font-medium text-muted-foreground hover:text-primary hover:border-primary/20 transition-all"
                    >
                      {copiedQuestions ? <Check className="size-3 text-positive" /> : <Copy className="size-3" />}
                      {copiedQuestions ? t("dueDiligence.copied") : t("dueDiligence.copyAll")}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {questions.map((q, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-foreground/2">
                        <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-[13px] text-foreground/80">{q}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inspection checklist */}
                <div className="rounded-xl bg-card border border-border p-5">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-3">{t("dueDiligence.inspectionChecklist")}</h3>
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
                        <div className="flex items-center gap-3">
                          <div className={`size-5 rounded-md flex items-center justify-center ${check.critical ? "bg-primary/10" : "bg-foreground/5"}`}>
                            <CheckCircle2 className={`size-3 ${check.critical ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <span className="text-[13px] text-foreground/80">{check.item}</span>
                        </div>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          check.critical ? "bg-primary/15 text-primary" : "bg-muted-foreground/20 text-muted-foreground"
                        }`}>
                          {check.critical ? t("dueDiligence.required") : t("dueDiligence.recommended")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §7 — MARKET CONTEXT
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("marketContext")} id="section-marketContext" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="marketContext">
                <SectionHeader id="marketContext" title={t("sections.marketContext")} />

                {/* Brand thesis */}
                <div className="rounded-xl bg-primary/5 border border-primary/15 p-5 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-1.5 rounded-full bg-primary" />
                    <h3 className="text-[12px] font-semibold text-primary">{t("marketContext.brandThesis")}: {car.make}</h3>
                  </div>
                  <p className="text-[13px] leading-relaxed text-foreground/80 whitespace-pre-line">{stripHtml(car.thesis)}</p>
                </div>

              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §9 — SIMILAR VEHICLES
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("similar")} id="section-similar" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="similar">
                <SectionHeader id="similar" title={t("sections.similar")} />
                <p className="text-[11px] text-muted-foreground mb-4">{t("similar.compareNote")}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {similarCars.slice(0, 6).map(sc => (
                    <Link
                      key={sc.car.id}
                      href={`/cars/${sc.car.make.toLowerCase().replace(/\s+/g, "-")}/${sc.car.id}`}
                      className="group flex items-center gap-4 rounded-xl bg-foreground/2 hover:bg-foreground/[0.04] border border-border hover:border-primary/15 p-3 transition-all"
                    >
                      <div className="relative w-20 h-14 rounded-lg overflow-hidden shrink-0">
                        <Image
                          src={sc.car.image}
                          alt={sc.car.title}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate group-hover:text-primary transition-colors">{sc.car.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[12px] tabular-nums font-semibold text-primary">{formatPrice(sc.car.currentBid)}</span>
                          <span className="text-[10px] text-positive">{sc.car.trend}</span>
                        </div>
                        {sc.matchReasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {sc.matchReasons.slice(0, 2).map(reason => (
                              <span key={reason} className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground">
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §9b — SIGNALS MISSING (pre-verdict)
                ═══════════════════════════════════════ */}
            <section className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <SignalsMissingSection signals={report?.signals_missing ?? []} />
            </section>

            {/* ═══════════════════════════════════════
                §10 — INVESTMENT VERDICT
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("verdict")} id="section-verdict" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="verdict">
                <SectionHeader id="verdict" title={t("sections.verdict")} />

                {/* Verdict card */}
                <div className="rounded-2xl bg-gradient-to-br from-primary/8 via-card to-card border border-primary/20 p-6 md:p-8 mb-4">
                  <div className="text-center mb-6">
                    {verdict ? (
                      <>
                        <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">{t("verdict.recommendation")}</span>
                        <p className={`text-[40px] md:text-[48px] font-black mt-1 ${
                          verdict === "buy" ? "text-positive" : verdict === "hold" ? "text-primary" : "text-destructive"
                        }`}>
                          {t(`verdict.${verdict}`)}
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                          Analysis Pending
                        </span>
                        <p className="text-[26px] md:text-[32px] font-semibold text-muted-foreground mt-2">
                          Awaiting full analysis
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Investment verdict unlocks when deep analysis completes.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="text-center">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Signals</span>
                      <p className={`text-[20px] font-black ${detectedCount > 0 ? "text-positive" : "text-muted-foreground"}`}>
                        {detectedCount}/{totalSignalCount || "—"}
                      </p>
                    </div>
                    <div className="h-8 w-px bg-foreground/10" />
                    <div className="text-center">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">% of Fair Range</span>
                      <p className={`text-[20px] font-black ${pricePosition <= 100 ? "text-positive" : "text-primary"}`}>{pricePosition.toFixed(0)}%</p>
                    </div>
                    <div className="h-8 w-px bg-foreground/10" />
                    <div className="text-center">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Risk</span>
                      <p className={`text-[20px] font-black ${
                        riskScore < 35 ? "text-positive" :
                        riskScore < 55 ? "text-primary" :
                        "text-destructive"
                      }`}>{riskScore}/100</p>
                    </div>
                  </div>

                  {/* Factual synthesis (replaces grade narrative) */}
                  {report && (
                    <p className="text-sm text-foreground text-center mb-4">
                      {tVerdict("factualSummary", {
                        deltaPercent: deltaVsSpecific,
                        detected: detectedCount,
                        total: totalSignalCount,
                      })}
                    </p>
                  )}

                  {/* Strategy */}
                  <div className="rounded-xl bg-foreground/[0.03] border border-border p-4">
                    <h4 className="text-[11px] font-semibold text-foreground mb-2">{t("verdict.strategyTitle")}</h4>
                    {verdict ? (
                      <p className="text-[12px] text-muted-foreground leading-relaxed">
                        {t(`verdict.${verdict}Strategy`)}
                      </p>
                    ) : (
                      <p className="text-[12px] text-muted-foreground leading-relaxed italic">
                        Strategy recommendation will appear once the full investment analysis is generated.
                      </p>
                    )}
                  </div>
                </div>

                {/* Key takeaways */}
                <div className="rounded-xl bg-card border border-border p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-3">{t("verdict.keyTakeaways")}</h3>
                  <div className="space-y-2">
                    {[
                      `Priced at ${pricePosition.toFixed(0)}% of the fair value range`,
                      isBelowFair ? `Currently priced below fair value in ${effectiveRegion}` : `Trading near fair value in ${effectiveRegion}`,
                      ...(report ? [`${detectedCount} of ${totalSignalCount || 0} high-value signals detected`] : []),
                      hasArbitrage ? `Arbitrage opportunity: ${formatUsd(arbitrageSavings)} savings via ${regionLabels[bestRegion]?.short} market` : `${car.make} brand showing consistent appreciation trend`,
                    ].map((takeaway, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-foreground/2">
                        <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-[13px] text-foreground/80">{takeaway}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="rounded-xl bg-foreground/2 border border-border p-4">
                  <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                    {t("verdict.disclaimer")}
                  </p>
                </div>
              </PaywallSection>
            </section>

            {/* ═══ LANDED COST ═══ */}
            {report?.landed_cost ? (
              <>
                <LandedCostBlock breakdown={report.landed_cost} locale={locale} />
                <SourcesBlock sources={report.landed_cost.sourcesUsed} />
              </>
            ) : report ? (
              <section className="rounded-lg border border-border p-6 my-8">
                <h2 className="text-lg font-semibold tracking-tight">
                  Landed Cost (Estimate)
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Landed cost not estimated for vehicles originating in this
                  country.{" "}
                  <Link href="/contact" className="underline">
                    Contact Monza Haus for a custom quote →
                  </Link>
                </p>
              </section>
            ) : null}

          </div>
        </div>
      </div>

      {/* ═══ MOBILE: Floating download button ═══ */}
      {hasAccess && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-primary/10">
          <div className="px-4 py-2.5">
            <button
              onClick={() => setShowDownloadSheet(true)}
              disabled={downloadingPdf || downloadingExcel}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-primary/20 bg-primary/5 text-primary font-semibold text-[12px] hover:bg-primary/10 active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {(downloadingPdf || downloadingExcel) ? (
                <>
                  <div className="size-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  <span>{t("downloadGenerating")}</span>
                </>
              ) : (
                <>
                  <Download className="size-3.5" />
                  <span>{t("downloadButton")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══ DOWNLOAD SHEET ═══ */}
      <AnimatePresence>
        {showDownloadSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] flex items-end md:items-center justify-center"
          >
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => !downloadingPdf && !downloadingExcel && setShowDownloadSheet(false)} />

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 28, stiffness: 250, delay: 0.05 }}
              className="relative w-full max-w-sm mx-4 mb-0 md:mb-0 rounded-t-2xl md:rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
            >
              {/* Accent line */}
              <div className="h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

              {/* Header */}
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="size-11 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Download className="size-5 text-primary" />
                </div>
                <h3 className="text-[16px] font-bold text-foreground">{t("downloadButton")}</h3>
                <p className="text-[11px] text-muted-foreground mt-1">{car.title}</p>
              </div>

              {/* Options */}
              <div className="px-5 pb-6 space-y-2.5">
                <button
                  onClick={() => { handleDownloadPdf(); setShowDownloadSheet(false) }}
                  disabled={downloadingPdf}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/80 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {downloadingPdf ? (
                    <div className="size-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin shrink-0" />
                  ) : (
                    <FileText className="size-5 shrink-0" />
                  )}
                  <div className="text-left flex-1">
                    <p className="text-[13px] font-bold">{t("downloadPdf")}</p>
                    <p className="text-[10px] opacity-60">{t("downloadPdfDesc")}</p>
                  </div>
                  <ChevronRight className="size-4 opacity-40 shrink-0" />
                </button>

                <button
                  onClick={() => { handleDownloadExcel(); setShowDownloadSheet(false) }}
                  disabled={downloadingExcel}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-secondary text-foreground hover:bg-accent active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {downloadingExcel ? (
                    <div className="size-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
                  ) : (
                    <BarChart3 className="size-5 text-primary shrink-0" />
                  )}
                  <div className="text-left flex-1">
                    <p className="text-[13px] font-semibold">{t("downloadExcel")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("downloadExcelDesc")}</p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ PRICING MODAL ═══ */}
      <AnimatePresence>
        {showPricing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[80] flex items-end md:items-center justify-center"
          >
            <div className="absolute inset-0 bg-background/70 backdrop-blur-md" onClick={() => !purchaseProcessing && setShowPricing(false)} />

            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.1 }}
              className="relative w-full max-w-2xl mx-4 mb-0 md:mb-0 rounded-t-2xl md:rounded-2xl bg-card border border-border shadow-2xl overflow-hidden max-h-[90vh] md:max-h-[85vh] overflow-y-auto"
            >
              {/* Top gradient bar */}
              <div className="h-0.5 bg-gradient-to-r from-primary via-primary/40 to-transparent" />

              {/* Close button */}
              <button
                onClick={() => !purchaseProcessing && setShowPricing(false)}
                className="absolute top-4 right-4 z-10 size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
              >
                <span className="text-[16px]">&times;</span>
              </button>

              {/* SUCCESS STATE */}
              {purchaseSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="px-6 py-16 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
                    className="size-16 rounded-full bg-positive/10 flex items-center justify-center mx-auto mb-4"
                  >
                    <Check className="size-8 text-positive" />
                  </motion.div>
                  <h3 className="text-[20px] font-bold text-foreground">{tPricing("successTitle")}</h3>
                  <p className="text-[13px] text-muted-foreground mt-2">{tPricing("successDesc")}</p>
                </motion.div>
              ) : (
                <>
                  {/* Header */}
                  <div className="px-6 pt-8 pb-2 text-center">
                    <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Scale className="size-6 text-primary" />
                    </div>
                    <h3 className="text-[20px] font-bold text-foreground">{tPricing("title")}</h3>
                    <p className="text-[12px] text-muted-foreground mt-1 max-w-md mx-auto">{tPricing("subtitle")}</p>
                  </div>

                  {/* Plans grid */}
                  <div className="px-6 pt-5 pb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* ─── SINGLE REPORT ─── */}
                    <div className="rounded-xl border border-border bg-foreground/2 p-5 flex flex-col">
                      <div className="mb-4">
                        <h4 className="text-[13px] font-semibold text-foreground">{tPricing("single.name")}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{tPricing("single.desc")}</p>
                      </div>
                      <div className="mb-4">
                        <span className="text-[32px] font-black text-foreground">{tPricing("single.price")}</span>
                        <span className="text-[11px] text-muted-foreground ml-1.5">{tPricing("single.period")}</span>
                      </div>
                      <div className="space-y-2 mb-5 flex-1">
                        {(["feature1", "feature2", "feature3", "feature4"] as const).map(key => (
                          <div key={key} className="flex items-center gap-2">
                            <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                            <span className="text-[11px] text-muted-foreground">{tPricing(`single.${key}`)}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => handlePurchase("single")}
                        disabled={!!purchaseProcessing}
                        className="w-full py-3 rounded-xl border border-border text-foreground font-semibold text-[12px] hover:bg-accent disabled:opacity-50 transition-all"
                      >
                        {purchaseProcessing === "single" ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="size-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            {tPricing("processing")}
                          </span>
                        ) : tPricing("single.cta")}
                      </button>
                    </div>

                    {/* ─── EXPLORER PACK (HIGHLIGHTED) ─── */}
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex flex-col relative">
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 rounded-full bg-primary text-background text-[9px] font-bold uppercase tracking-wider">
                          {tPricing("explorer.badge")}
                        </span>
                      </div>
                      <div className="mb-4 mt-1">
                        <h4 className="text-[13px] font-semibold text-foreground">{tPricing("explorer.name")}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{tPricing("explorer.desc")}</p>
                      </div>
                      <div className="mb-1">
                        <span className="text-[32px] font-black text-foreground">{tPricing("explorer.price")}</span>
                        <span className="text-[11px] text-muted-foreground ml-1.5">{tPricing("explorer.period")}</span>
                      </div>
                      <p className="text-[10px] text-primary tabular-nums font-semibold mb-4">{tPricing("explorer.perReport")}</p>
                      <div className="space-y-2 mb-5 flex-1">
                        {(["feature1", "feature2", "feature3", "feature4"] as const).map(key => (
                          <div key={key} className="flex items-center gap-2">
                            <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                            <span className="text-[11px] text-muted-foreground">{tPricing(`explorer.${key}`)}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => handlePurchase("explorer")}
                        disabled={!!purchaseProcessing}
                        className="w-full py-3 rounded-xl bg-primary text-background font-semibold text-[12px] hover:bg-primary/80 disabled:opacity-50 active:scale-[0.97] transition-all"
                      >
                        {purchaseProcessing === "explorer" ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="size-3.5 rounded-full border-2 border-background border-t-transparent animate-spin" />
                            {tPricing("processing")}
                          </span>
                        ) : tPricing("explorer.cta")}
                      </button>
                    </div>

                    {/* ─── UNLIMITED ─── */}
                    <div className="rounded-xl border border-border bg-foreground/2 p-5 flex flex-col">
                      <div className="mb-4">
                        <h4 className="text-[13px] font-semibold text-foreground">{tPricing("unlimited.name")}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{tPricing("unlimited.desc")}</p>
                      </div>
                      <div className="mb-4">
                        <span className="text-[32px] font-black text-foreground">{tPricing("unlimited.price")}</span>
                        <span className="text-[11px] text-muted-foreground ml-0.5">{tPricing("unlimited.period")}</span>
                      </div>
                      <div className="space-y-2 mb-5 flex-1">
                        {(["feature1", "feature2", "feature3", "feature4"] as const).map(key => (
                          <div key={key} className="flex items-center gap-2">
                            <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                            <span className="text-[11px] text-muted-foreground">{tPricing(`unlimited.${key}`)}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => handlePurchase("unlimited")}
                        disabled={!!purchaseProcessing}
                        className="w-full py-3 rounded-xl border border-border text-foreground font-semibold text-[12px] hover:bg-accent disabled:opacity-50 transition-all"
                      >
                        {purchaseProcessing === "unlimited" ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="size-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            {tPricing("processing")}
                          </span>
                        ) : tPricing("unlimited.cta")}
                      </button>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-6 pb-6 pt-2">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Coins className="size-3.5 text-primary" />
                      <span className="text-[11px] text-muted-foreground">
                        {tPricing("currentBalance")}: <span className="tabular-nums font-semibold text-foreground">{tokens.toLocaleString()}</span> {tPricing("tokens")}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">
                      {tPricing("guarantee")}
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <OutOfReportsModal
        open={outOfReportsOpen}
        onOpenChange={setOutOfReportsOpen}
        nextResetDate={authProfile?.creditResetDate}
      />
    </div>
  )
}
