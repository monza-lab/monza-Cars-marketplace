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
} from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { AdvisorChat } from "@/components/advisor/AdvisorChat"
import { MobileCarCTA } from "@/components/mobile"

// ─── TABS ───
type TabId = "overview" | "investment" | "diligence" | "market"

const tabIcons: Record<TabId, React.ReactNode> = {
  overview: <FileText className="size-4" />,
  investment: <TrendingUp className="size-4" />,
  diligence: <Shield className="size-4" />,
  market: <Globe className="size-4" />,
}

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

// ─── HELPERS ───
function formatPrice(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function timeLeft(endTime: Date): string {
  const diff = endTime.getTime() - Date.now()
  if (diff <= 0) return "Ended"
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hrs}h`
  const mins = Math.floor((diff % 3600000) / 60000)
  return `${hrs}h ${mins}m`
}

// ─── COLLAPSIBLE SECTION ───
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
    <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-[#F8B4D9]">{icon}</div>
          <span className="text-[13px] font-medium text-[#F2F0E9]">{title}</span>
          {badge}
        </div>
        <ChevronDown className={`size-4 text-[#4B5563] transition-transform ${isOpen ? "rotate-180" : ""}`} />
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

// ─── STAT CARD ───
function StatCard({ label, value, subvalue, icon, trend }: {
  label: string
  value: string
  subvalue?: string
  icon: React.ReactNode
  trend?: "up" | "down" | "neutral"
}) {
  return (
    <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
      <div className="flex items-center gap-2 text-[#4B5563] mb-2">
        {icon}
        <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[20px] font-bold text-[#F2F0E9]">{value}</span>
        {trend && (
          <span className={`text-[11px] font-medium ${
            trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-[#9CA3AF]"
          }`}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
          </span>
        )}
      </div>
      {subvalue && <p className="text-[11px] text-[#4B5563] mt-1">{subvalue}</p>}
    </div>
  )
}

// ─── SIMILAR CAR CARD ───
function SimilarCarCard({ car }: { car: CollectorCar }) {
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
        <p className="text-[12px] font-medium text-[#F2F0E9] truncate group-hover:text-[#F8B4D9] transition-colors">
          {car.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[12px] font-mono font-semibold text-[#F8B4D9]">
            {formatPrice(car.currentBid)}
          </span>
          <span className="text-[10px] text-emerald-400">{car.trend}</span>
        </div>
      </div>
      <ChevronRight className="size-4 text-[#4B5563] group-hover:text-[#F8B4D9] transition-colors shrink-0" />
    </Link>
  )
}

// ─── MAIN COMPONENT ───
export function CarDetailClient({ car, similarCars }: { car: CollectorCar; similarCars: CollectorCar[] }) {
  const locale = useLocale()
  const t = useTranslations("carDetail")
  const tAuction = useTranslations("auctionDetail")
  const tStatus = useTranslations("status")

  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [showSticky, setShowSticky] = useState(false)
  const [showAdvisorChat, setShowAdvisorChat] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: t("overview"), icon: tabIcons.overview },
    { id: "investment", label: t("investment"), icon: tabIcons.investment },
    { id: "diligence", label: t("dueDiligence"), icon: tabIcons.diligence },
    { id: "market", label: t("market"), icon: tabIcons.market },
  ]

  const isLive = car.status === "ACTIVE" || car.status === "ENDING_SOON"
  const flags = redFlags[car.make] || redFlags.default
  const questions = sellerQuestions[car.make] || sellerQuestions.default
  const costs = ownershipCosts[car.make] || ownershipCosts.default
  const comps = comparableSales[car.make] || comparableSales.default
  const events = eventsData[car.make] || eventsData.default
  const shipping = shippingCosts[car.make] || shippingCosts.default
  const totalAnnualCost = costs.insurance + costs.storage + costs.maintenance

  // Scroll handler for sticky bar
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

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* ═══ STICKY SUMMARY BAR ═══ */}
      <AnimatePresence>
        {showSticky && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/5"
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
                  <h1 className="text-[14px] font-semibold text-[#F2F0E9]">{car.title}</h1>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[18px] font-bold font-mono text-[#F8B4D9]">
                      {formatPrice(car.currentBid)}
                    </span>
                    <span className="text-[10px] text-[#4B5563]">
                      {car.status === "ENDED" ? "sold" : "current bid"}
                    </span>
                  </div>
                </div>
              </div>
              <a
                href={`https://wa.me/491726690998?text=${encodeURIComponent(
                  `Hola, estoy interesado en el ${car.title} en Monza Lab.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full bg-[#F8B4D9] px-5 py-2 text-[11px] font-semibold uppercase text-[#050505] hover:bg-[#fce4ec] transition-colors"
              >
                <MessageCircle className="size-4" />
                Contact
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ HERO SECTION ═══ */}
      <div ref={heroRef} className="relative h-[50vh] min-h-[400px]">
        <Image
          src={car.image}
          alt={car.title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/70 to-transparent" />

        {/* Navigation */}
        <div className="absolute top-24 left-0 right-0 px-6 md:px-12">
          <Link
            href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}`}
            className="inline-flex items-center gap-2 text-[12px] text-white/50 hover:text-[#F8B4D9] transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to {car.make}
          </Link>
        </div>

        {/* Badges */}
        <div className="absolute top-24 right-6 md:right-12 flex items-center gap-2">
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
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="max-w-7xl mx-auto">
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#F8B4D9]">
              {car.category}
            </span>
            <h1 className="mt-2 text-3xl md:text-5xl font-bold text-[#F2F0E9] tracking-tight">
              {car.title}
            </h1>

            {/* Quick Stats Row - Real data only */}
            <div className="mt-6 flex flex-wrap items-center gap-6">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">
                  {car.status === "ENDED" ? t("soldFor") : t("currentBid")}
                </p>
                <p className="text-2xl md:text-3xl font-bold font-mono text-[#F2F0E9]">
                  {formatPrice(car.currentBid)}
                </p>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">{tAuction("specs.mileage")}</p>
                <p className="text-xl font-bold text-[#F2F0E9]">
                  {car.mileage.toLocaleString(locale)} {car.mileageUnit}
                </p>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">{tAuction("specs.location")}</p>
                <p className="text-xl font-bold text-[#F2F0E9]">{car.region}</p>
              </div>
              {isLive && (
                <>
                  <div className="h-10 w-px bg-white/10" />
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">{t("timeLeft")}</p>
                    <p className="text-xl font-bold text-amber-400 font-mono">{timeLeft(car.endTime)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TAB NAVIGATION ═══ */}
      <div className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9] border border-[rgba(248,180,217,0.25)]"
                    : "text-[#4B5563] hover:text-[#9CA3AF] border border-transparent"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
        <AnimatePresence mode="wait">
          {/* ─── OVERVIEW TAB ─── */}
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* About This Vehicle */}
              <div className="rounded-2xl bg-[rgba(248,180,217,0.05)] border border-[rgba(248,180,217,0.1)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-5 text-[#F8B4D9]" />
                    <h2 className="text-[13px] font-semibold text-[#F2F0E9]">{t("aboutThisVehicle")}</h2>
                  </div>
                  <span className="text-[9px] text-[#4B5563] bg-white/5 px-2 py-0.5 rounded">{t("editorial")}</span>
                </div>
                <p className="text-[14px] leading-relaxed text-[#9CA3AF]">{car.thesis}</p>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={tAuction("specs.mileage")} value={`${car.mileage.toLocaleString(locale)} ${car.mileageUnit}`} icon={<Gauge className="size-4" />} />
                <StatCard label={tAuction("specs.engine")} value={car.engine} icon={<Cog className="size-4" />} />
                <StatCard label={tAuction("specs.transmission")} value={car.transmission} icon={<Cog className="size-4" />} />
                <StatCard label={tAuction("specs.location")} value={car.location} icon={<MapPin className="size-4" />} />
              </div>

              {/* Additional Specs — only shown when data exists */}
              {(car.exteriorColor || car.interiorColor || car.vin) && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {car.exteriorColor && (
                    <StatCard label="Exterior" value={car.exteriorColor} icon={<Car className="size-4" />} />
                  )}
                  {car.interiorColor && (
                    <StatCard label="Interior" value={car.interiorColor} icon={<Car className="size-4" />} />
                  )}
                  {car.vin && (
                    <StatCard label="VIN" value={car.vin} icon={<Shield className="size-4" />} />
                  )}
                </div>
              )}

              {/* Provenance */}
              <CollapsibleSection title={t("sellersDescription")} icon={<History className="size-5" />} defaultOpen>
                <p className="text-[13px] text-[#9CA3AF] leading-relaxed">{car.history}</p>
                <p className="text-[10px] text-[#4B5563] mt-3 italic">{t("source", { platform: car.platform.replace(/_/g, " ") })}</p>
              </CollapsibleSection>

              {/* Similar Cars */}
              {similarCars.length > 0 && (
                <CollapsibleSection title={t("similarVehicles", { count: similarCars.length })} icon={<Car className="size-5" />} defaultOpen>
                  <div className="space-y-3">
                    {similarCars.slice(0, 4).map(c => (
                      <SimilarCarCard key={c.id} car={c} />
                    ))}
                  </div>
                </CollapsibleSection>
              )}
            </motion.div>
          )}

          {/* ─── INVESTMENT TAB ─── */}
          {activeTab === "investment" && (
            <motion.div
              key="investment"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Sale Information - Real Data */}
              <div className="rounded-2xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Globe className="size-5 text-[#F8B4D9]" />
                  <h2 className="text-[13px] font-semibold text-[#F2F0E9]">{t("saleInformation")}</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-xl p-4 bg-white/[0.02] border border-white/5">
                    <p className="text-[10px] text-[#4B5563] uppercase tracking-wider mb-2">{t("platform")}</p>
                    <p className="text-[16px] font-semibold text-[#F2F0E9]">{car.platform.replace(/_/g, " ")}</p>
                  </div>
                  <div className="rounded-xl p-4 bg-white/[0.02] border border-white/5">
                    <p className="text-[10px] text-[#4B5563] uppercase tracking-wider mb-2">
                      {car.status === "ENDED" ? t("soldFor") : t("currentBid")}
                    </p>
                    <p className="text-[16px] font-bold font-mono text-[#F8B4D9]">{formatPrice(car.currentBid)}</p>
                  </div>
                  <div className="rounded-xl p-4 bg-white/[0.02] border border-white/5">
                    <p className="text-[10px] text-[#4B5563] uppercase tracking-wider mb-2">{t("bids")}</p>
                    <p className="text-[16px] font-semibold text-[#F2F0E9]">{car.bidCount}</p>
                  </div>
                  <div className="rounded-xl p-4 bg-white/[0.02] border border-white/5">
                    <p className="text-[10px] text-[#4B5563] uppercase tracking-wider mb-2">{t("status")}</p>
                    <p className={`text-[16px] font-semibold ${car.status === "ACTIVE" || car.status === "ENDING_SOON" ? "text-emerald-400" : "text-[#9CA3AF]"}`}>
                      {car.status === "ENDED"
                        ? tStatus("sold")
                        : car.status === "ENDING_SOON"
                          ? tStatus("endingSoon")
                          : tStatus("active")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <AlertTriangle className="size-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12px] text-amber-200/80">
                    <strong>{t("note.label")}</strong> {t("note.text")}
                  </p>
                </div>
              </div>

              {/* Annual Ownership Breakdown */}
              <CollapsibleSection title={t("ownershipCosts.title")} icon={<Wrench className="size-5" />} defaultOpen badge={
                <span className="text-[9px] text-[#4B5563] bg-white/5 px-2 py-0.5 rounded">{t("ownershipCosts.estimates")}</span>
              }>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <Shield className="size-4 text-[#4B5563]" />
                      <span className="text-[13px] text-[#9CA3AF]">{t("ownershipCosts.insurance")}</span>
                    </div>
                    <span className="text-[15px] font-mono font-semibold text-[#F2F0E9]">{formatPrice(costs.insurance)}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <MapPin className="size-4 text-[#4B5563]" />
                      <span className="text-[13px] text-[#9CA3AF]">{t("ownershipCosts.storage")}</span>
                    </div>
                    <span className="text-[15px] font-mono font-semibold text-[#F2F0E9]">{formatPrice(costs.storage)}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <Wrench className="size-4 text-[#4B5563]" />
                      <span className="text-[13px] text-[#9CA3AF]">{t("ownershipCosts.service")}</span>
                    </div>
                    <span className="text-[15px] font-mono font-semibold text-[#F2F0E9]">{formatPrice(costs.maintenance)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-[13px] font-semibold text-[#F2F0E9]">Total Annual</span>
                    <span className="text-[20px] font-mono font-bold text-[#F8B4D9]">{formatPrice(totalAnnualCost)}/yr</span>
                  </div>
                </div>
              </CollapsibleSection>
            </motion.div>
          )}

          {/* ─── DUE DILIGENCE TAB ─── */}
          {activeTab === "diligence" && (
            <motion.div
              key="diligence"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Key Inspection Points */}
              <div className="rounded-2xl bg-[rgba(248,180,217,0.05)] border border-[rgba(248,180,217,0.15)] p-6">
                <div className="flex items-center gap-2 mb-6">
                  <AlertTriangle className="size-5 text-[#F8B4D9]" />
                  <h2 className="text-[13px] font-semibold text-[#F8B4D9]">Key Inspection Points</h2>
                  <span className="text-[10px] text-[#F8B4D9]/60 bg-[rgba(248,180,217,0.1)] px-2 py-0.5 rounded-full">{flags.length} items</span>
                </div>
                <div className="space-y-3">
                  {flags.map((flag, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(248,180,217,0.03)]">
                      <AlertTriangle className="size-4 text-[#F8B4D9] mt-0.5 shrink-0" />
                      <span className="text-[13px] text-[#F2F0E9]">{flag}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seller Questions */}
              <CollapsibleSection title="Questions to Ask the Seller" icon={<HelpCircle className="size-5" />} defaultOpen badge={
                <span className="text-[10px] text-[#9CA3AF] bg-white/5 px-2 py-0.5 rounded-full">{questions.length} questions</span>
              }>
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

              {/* Pre-Purchase Inspection */}
              <CollapsibleSection title="Recommended Pre-Purchase Inspection" icon={<CheckCircle2 className="size-5" />}>
                <div className="space-y-3">
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
            </motion.div>
          )}

          {/* ─── MARKET TAB ─── */}
          {activeTab === "market" && (
            <motion.div
              key="market"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Comparable Sales */}
              <div className="rounded-2xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-5 text-[#F8B4D9]" />
                    <h2 className="text-[13px] font-semibold text-[#F2F0E9]">Recent Comparable Sales</h2>
                  </div>
                  <span className="text-[9px] text-[#4B5563] bg-white/5 px-2 py-0.5 rounded">Sample Data</span>
                </div>
                <div className="space-y-3">
                  {comps.map((sale, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="flex-1">
                        <p className="text-[14px] font-medium text-[#F2F0E9]">{sale.title}</p>
                        <p className="text-[11px] text-[#4B5563] mt-1">{sale.date} · {sale.platform}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[18px] font-bold font-mono text-[#F2F0E9]">{formatPrice(sale.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[#4B5563] mt-4 italic">
                  Sample data for illustration. Real comparable sales data coming soon.
                </p>
              </div>

              {/* Events & Community */}
              <CollapsibleSection title="Events, Shows & Community" icon={<Users className="size-5" />} defaultOpen>
                <div className="space-y-3">
                  {events.map((event, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <span className={`size-2 rounded-full ${
                          event.impact === "positive" ? "bg-emerald-400" :
                          event.impact === "negative" ? "bg-red-400" : "bg-[#4B5563]"
                        }`} />
                        <div>
                          <p className="text-[13px] text-[#F2F0E9]">{event.name}</p>
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

              {/* Transportation Costs */}
              <CollapsibleSection
                title="Transportation & Shipping"
                icon={<Truck className="size-5" />}
                badge={<span className="text-[9px] text-[#4B5563] bg-white/5 px-2 py-0.5 rounded">Estimates</span>}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                    <span className="text-[13px] text-[#9CA3AF]">Domestic (Enclosed)</span>
                    <span className="text-[14px] font-mono font-semibold text-[#F2F0E9]">{formatPrice(shipping.domestic)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                    <span className="text-[13px] text-[#9CA3AF]">EU Import (incl. duties)</span>
                    <span className="text-[14px] font-mono font-semibold text-[#F2F0E9]">{formatPrice(shipping.euImport)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                    <span className="text-[13px] text-[#9CA3AF]">UK Import (incl. duties)</span>
                    <span className="text-[14px] font-mono font-semibold text-[#F2F0E9]">{formatPrice(shipping.ukImport)}</span>
                  </div>
                </div>
                <p className="text-[10px] text-[#4B5563] mt-3 italic">
                  Estimated costs based on typical enclosed transport rates. Actual quotes may vary.
                </p>
              </CollapsibleSection>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ DESKTOP FLOATING CTA ═══ */}
      <div className="hidden md:block fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setShowAdvisorChat(true)}
          className="flex items-center gap-2 rounded-full bg-[#F8B4D9] px-6 py-4 text-[12px] font-semibold uppercase text-[#050505] shadow-lg shadow-[#F8B4D9]/20 hover:bg-[#fce4ec] hover:scale-105 transition-all"
        >
          <MessageCircle className="size-5" />
          Contact Advisor
        </button>
      </div>

      {/* ═══ MOBILE CTA (AI Oracle) ═══ */}
      <MobileCarCTA
        carTitle={car.title}
        carPrice={formatPrice(car.currentBid)}
        make={car.make}
      />

      {/* ═══ ADVISOR CHAT (Desktop) ═══ */}
      <AdvisorChat
        open={showAdvisorChat}
        onOpenChange={setShowAdvisorChat}
        initialContext={{
          carTitle: car.title,
          carPrice: formatPrice(car.currentBid),
          make: car.make,
        }}
      />
    </div>
  )
}
