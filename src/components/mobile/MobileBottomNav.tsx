"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  Search,
  Car,
  User,
  X,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Zap,
  ChevronRight,
  LogOut,
} from "lucide-react"
import { CURATED_CARS, searchCars, type CollectorCar } from "@/lib/curatedCars"
import { useAuth } from "@/lib/auth/AuthProvider"
import { AuthModal } from "@/components/auth/AuthModal"
import { useTranslations } from "next-intl"
import { MobileLanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { saveSearchQuery } from "@/lib/searchHistory"

// ─── GET UNIQUE MAKES WITH COUNTS ───
function getMakesWithCounts() {
  const makeCounts: Record<string, { count: number; topCar: CollectorCar }> = {}

  CURATED_CARS.filter(c => c.make !== "Ferrari").forEach((car) => {
    if (!makeCounts[car.make]) {
      makeCounts[car.make] = { count: 0, topCar: car }
    }
    makeCounts[car.make].count++
    // Keep the most valuable car as the representative
    if (car.currentBid > makeCounts[car.make].topCar.currentBid) {
      makeCounts[car.make].topCar = car
    }
  })

  return Object.entries(makeCounts)
    .map(([make, data]) => ({
      make,
      count: data.count,
      topCar: data.topCar,
    }))
    .sort((a, b) => b.count - a.count)
}

// ─── FORMAT PRICE ───
function formatPrice(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

// ─── BRAND CARD ───
function BrandCard({ make, count, topCar }: { make: string; count: number; topCar: CollectorCar }) {
  const t = useTranslations("mobile")
  const makePath = make.toLowerCase().replace(/\s+/g, "-")

  return (
    <Link
      href={`/cars/${makePath}`}
      className="group relative flex flex-col rounded-2xl bg-[#0F1012] border border-white/5 overflow-hidden active:scale-[0.98] transition-transform"
    >
      {/* Image */}
      <div className="relative h-28 w-full">
        <Image
          src={topCar.image}
          alt={make}
          fill
          className="object-cover"
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1012] via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#FFFCF7]">{make}</h3>
          <ChevronRight className="size-4 text-[#4B5563] group-active:text-[#F8B4D9] transition-colors" />
        </div>
        <p className="text-[11px] text-[#4B5563] mt-0.5">
          {count > 1 ? t("vehicles", { count }) : t("vehicle", { count })}
        </p>
      </div>
    </Link>
  )
}

// ─── SEARCH RESULT CARD ───
function SearchResultCard({ car, onSelect }: { car: CollectorCar; onSelect: () => void }) {
  const makePath = car.make.toLowerCase().replace(/\s+/g, "-")

  return (
    <Link
      href={`/cars/${makePath}/${car.id}`}
      onClick={onSelect}
      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 active:bg-white/[0.05] transition-colors"
    >
      <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0">
        <Image
          src={car.image}
          alt={car.title}
          fill
          className="object-cover"
          sizes="64px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[#FFFCF7] truncate">{car.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[12px] font-mono font-semibold text-[#F8B4D9]">{formatPrice(car.currentBid)}</span>
          <span className="text-[10px] text-emerald-400">{car.trend}</span>
        </div>
      </div>
      <ChevronRight className="size-4 text-[#4B5563] shrink-0" />
    </Link>
  )
}

// ─── MOBILE ORACLE OVERLAY ───
function MobileOracleOverlay({
  isOpen,
  onClose,
  query,
}: {
  isOpen: boolean
  onClose: () => void
  query: string
}) {
  const t = useTranslations()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [displayedText, setDisplayedText] = useState("")

  type ChipId = "view_details" | "view_similar" | "view_collection"
  type Chip = { id: ChipId; label: string }

  const [chips, setChips] = useState<Chip[]>([])

  // Get intelligent response
  const matchingCars = searchCars(query)

  // Generate response
  let response = {
    answer: "",
    chips: [] as Chip[],
    carContext: null as { id: string; make: string } | null,
  }

  if (matchingCars.length === 1) {
    const car = matchingCars[0]
    response = {
      answer: t("oracle.responses.singleCar", {
        title: car.title,
        thesis: car.thesis,
        fairLow: formatPrice(car.fairValueByRegion.US.low),
        fairHigh: formatPrice(car.fairValueByRegion.US.high),
        grade: car.investmentGrade,
        trend: car.trend,
      }),
      chips: [
        { id: "view_details", label: t("oracle.chips.viewCarDetails") },
        { id: "view_similar", label: t("oracle.chips.similarCars") },
      ],
      carContext: { id: car.id, make: car.make },
    }
  } else if (matchingCars.length > 1) {
    const carList = matchingCars.slice(0, 5).map(car =>
      `• **${car.title}** — ${formatPrice(car.currentBid)}`
    ).join("\n")
    response = {
      answer: `${t("oracle.responses.multipleFound", { count: matchingCars.length })}\n\n${carList}`,
      chips: [
        { id: "view_collection", label: t("oracle.viewCollection") },
      ],
      carContext: null,
    }
  } else {
    const nonFerrari = CURATED_CARS.filter(c => c.make !== "Ferrari")
    const totalCars = nonFerrari.length
    const avgAppreciation = nonFerrari.reduce((sum, c) => sum + c.trendValue, 0) / totalCars
    response = {
      answer: t("oracle.responses.noMatch", {
        totalCars,
        avgAppreciation: avgAppreciation.toFixed(0),
      }),
      chips: [
        { id: "view_collection", label: t("oracle.viewCollection") },
      ],
      carContext: null,
    }
  }

  // Loading effect
  useEffect(() => {
    if (!isOpen) {
      setDisplayedText("")
      setIsLoading(true)
      setChips([])
      return
    }
    const timer = setTimeout(() => setIsLoading(false), 600)
    return () => clearTimeout(timer)
  }, [isOpen])

  // Typewriter effect
  useEffect(() => {
    if (isLoading || !isOpen) return

    const fullText = response.answer
    let charIndex = 0

    const typeInterval = setInterval(() => {
      if (charIndex <= fullText.length) {
        setDisplayedText(fullText.slice(0, charIndex))
        charIndex += 3
      } else {
        clearInterval(typeInterval)
        setChips(response.chips)
      }
    }, 8)

    return () => clearInterval(typeInterval)
  }, [isLoading, isOpen, response.answer, response.chips])

  const handleChipClick = (chip: Chip) => {
    if (response.carContext && chip.id === "view_details") {
      const makePath = response.carContext.make.toLowerCase().replace(/\s+/g, "-")
      router.push(`/cars/${makePath}/${response.carContext.id}`)
    } else if (response.carContext && chip.id === "view_similar") {
      const makePath = response.carContext.make.toLowerCase().replace(/\s+/g, "-")
      router.push(`/cars/${makePath}`)
    } else {
      router.push("/")
    }
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-[#0b0b10]/98 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#F8B4D9]" />
              <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#F8B4D9]">
                {t("oracle.aiAnalysis")}
              </span>
            </div>
            <button
              onClick={onClose}
              className="size-10 flex items-center justify-center rounded-full bg-white/5 text-[#9CA3AF]"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Query */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-[12px] text-[#4B5563]">
              {t("oracle.youAsked")} <span className="text-[#FFFCF7]">"{query}"</span>
            </p>
          </div>

          {/* Content */}
          <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
            {isLoading ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-2 rounded-full bg-[#F8B4D9] animate-pulse" />
                  <span className="text-[13px] text-[#9CA3AF]">{t("oracle.analyzingMarket")}</span>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
                  <div className="h-4 bg-white/5 rounded animate-pulse w-5/6" />
                  <div className="h-4 bg-white/5 rounded animate-pulse w-4/6" />
                </div>
              </div>
            ) : (
              <div className="text-[15px] leading-relaxed text-[#FFFCF7] whitespace-pre-wrap">
                {displayedText.split("\n").map((line, i) => {
                  const parts = line.split(/(\*\*[^*]+\*\*)/g)
                  return (
                    <p key={i} className={line.startsWith("•") ? "pl-4 my-1" : "my-2"}>
                      {parts.map((part, j) => {
                        if (part.startsWith("**") && part.endsWith("**")) {
                          return <span key={j} className="font-semibold text-[#F8B4D9]">{part.slice(2, -2)}</span>
                        }
                        return <span key={j}>{part}</span>
                      })}
                    </p>
                  )
                })}
              </div>
            )}
          </div>

          {/* Chips */}
          <AnimatePresence>
            {chips.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0b0b10] via-[#0b0b10] to-transparent pt-16"
              >
                <div className="flex flex-wrap gap-2">
                  {chips.map((chip, i) => (
                    <button
                      key={chip.id}
                      onClick={() => handleChipClick(chip)}
                      className="flex items-center gap-2 rounded-full bg-[rgba(248,180,217,0.1)] border border-[rgba(248,180,217,0.2)] px-5 py-3 text-[13px] font-medium text-[#F8B4D9] active:scale-95 transition-transform"
                    >
                      {i === 0 && <Car className="size-4" />}
                      {i === 1 && <BarChart3 className="size-4" />}
                      {chip.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── MOBILE BROWSE SHEET ───
function MobileBrowseSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const t = useTranslations("mobile")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSection, setActiveSection] = useState<"brands" | "search">("brands")
  const inputRef = useRef<HTMLInputElement>(null)

  const makes = getMakesWithCounts()
  const searchResults = searchQuery.length > 0 ? searchCars(searchQuery) : []

  // Focus input when opening search
  useEffect(() => {
    if (isOpen && activeSection === "search" && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, activeSection])

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("")
      setActiveSection("brands")
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[60] bg-[#0b0b10]"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#0b0b10]/95 backdrop-blur-xl border-b border-white/5">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-[16px] font-semibold text-[#FFFCF7]">
                {activeSection === "brands" ? t("exploreBrands") : t("search")}
              </h2>
              <button
                onClick={onClose}
                className="size-10 flex items-center justify-center rounded-full bg-white/5 text-[#9CA3AF]"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Section Tabs */}
            <div className="flex gap-2 px-5 pb-4">
              <button
                onClick={() => setActiveSection("brands")}
                className={`flex-1 py-2.5 rounded-full text-[12px] font-medium transition-colors ${
                  activeSection === "brands"
                    ? "bg-[#F8B4D9] text-[#0b0b10]"
                    : "bg-white/5 text-[#9CA3AF]"
                }`}
              >
                <Car className="size-4 inline mr-2" />
                {t("brands")}
              </button>
              <button
                onClick={() => setActiveSection("search")}
                className={`flex-1 py-2.5 rounded-full text-[12px] font-medium transition-colors ${
                  activeSection === "search"
                    ? "bg-[#F8B4D9] text-[#0b0b10]"
                    : "bg-white/5 text-[#9CA3AF]"
                }`}
              >
                <Search className="size-4 inline mr-2" />
                {t("search")}
              </button>
            </div>

            {/* Search Input (only in search mode) */}
            {activeSection === "search" && (
              <div className="px-5 pb-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-[#4B5563]" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("searchPlaceholder")}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-[15px] text-[#FFFCF7] placeholder:text-[#4B5563] focus:outline-none focus:border-[#F8B4D9]/30"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-full bg-white/10 text-[#9CA3AF]"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="overflow-y-auto pb-24" style={{ height: "calc(100vh - 180px)" }}>
            {activeSection === "brands" ? (
              // Brands Grid
              <div className="grid grid-cols-2 gap-3 p-5">
                {makes.map(({ make, count, topCar }) => (
                  <div key={make} onClick={onClose}>
                    <BrandCard make={make} count={count} topCar={topCar} />
                  </div>
                ))}
              </div>
            ) : (
              // Search Results
              <div className="px-5 py-4">
                {searchQuery.length === 0 ? (
                  <div className="text-center py-12">
                    <Search className="size-12 text-[#4B5563] mx-auto mb-4" />
                    <p className="text-[#9CA3AF] text-[14px]">
                      {t("vehicles", { count: CURATED_CARS.filter(c => c.make !== "Ferrari").length })}
                    </p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-12">
                    <Car className="size-12 text-[#4B5563] mx-auto mb-4" />
                    <p className="text-[#9CA3AF] text-[14px]">
                      {t("noResults", { query: searchQuery })}
                    </p>
                    <p className="text-[#4B5563] text-[12px] mt-2">
                      {t("tryAnother")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[11px] text-[#4B5563] uppercase tracking-wider mb-4">
                      {searchResults.length > 1 ? t("results", { count: searchResults.length }) : t("result", { count: searchResults.length })}
                    </p>
                    {searchResults.slice(0, 20).map((car) => (
                      <SearchResultCard key={car.id} car={car} onSelect={onClose} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── MOBILE ACCOUNT SHEET ───
function MobileAccountSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const t = useTranslations()
  const { user, profile, loading, signOut } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(false)
  const isAuthenticated = !!user
  const creditsRemaining = profile?.creditsBalance ?? 0

  const handleSignOut = async () => {
    await signOut()
    onClose()
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-[#0F1012] rounded-t-3xl border-t border-white/10"
            style={{ maxHeight: "85vh" }}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4">
              <h2 className="text-[16px] font-semibold text-[#FFFCF7]">{t("mobile.account")}</h2>
              <button
                onClick={onClose}
                className="size-10 flex items-center justify-center rounded-full bg-white/5 text-[#9CA3AF]"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-8 overflow-y-auto" style={{ maxHeight: "calc(85vh - 100px)" }}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="size-8 border-2 border-[#F8B4D9] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : isAuthenticated ? (
                <div className="space-y-6">
                  {/* User Info */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5">
                    <div className="size-14 rounded-full bg-[#F8B4D9]/20 flex items-center justify-center">
                      <User className="size-7 text-[#F8B4D9]" />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-[#FFFCF7]">
                        {profile?.name || "User"}
                      </p>
                      <p className="text-[12px] text-[#4B5563]">{user.email}</p>
                    </div>
                  </div>

                  {/* Credits */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-[rgba(248,180,217,0.1)] to-transparent border border-[rgba(248,180,217,0.15)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#4B5563]">
                          {t("auth.credits")}
                        </p>
                        <p className={`text-[32px] font-bold ${creditsRemaining > 0 ? "text-[#F8B4D9]" : "text-[#FB923C]"}`}>
                          {creditsRemaining}
                        </p>
                      </div>
                      <button className="px-5 py-2.5 rounded-full bg-[#F8B4D9] text-[#0b0b10] text-[12px] font-semibold">
                        {t("auth.buy")}
                      </button>
                    </div>
                    <p className="text-[11px] text-[#4B5563] mt-3">
                      {t("auth.creditsReset")}
                    </p>
                  </div>

                  {/* Language Switcher */}
                  <div className="py-4 border-t border-white/5">
                    <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#4B5563] mb-3">
                      {t("language.select")}
                    </p>
                    <MobileLanguageSwitcher onSelect={() => {}} />
                  </div>

                  {/* Sign Out */}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border border-white/10 text-[#9CA3AF] active:bg-white/5 transition-colors"
                  >
                    <LogOut className="size-5" />
                    <span className="text-[14px] font-medium">{t("auth.signOut")}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6 py-4">
                  <div className="text-center">
                    <div className="size-20 rounded-full bg-[rgba(248,180,217,0.1)] flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="size-10 text-[#F8B4D9]" />
                    </div>
                    <h3 className="text-[18px] font-semibold text-[#FFFCF7]">
                      {t("auth.welcomeBack")}
                    </h3>
                    <p className="text-[14px] text-[#9CA3AF] mt-2">
                      {t("auth.freeCredits")}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      onClose()
                      setTimeout(() => setShowAuthModal(true), 300)
                    }}
                    className="w-full py-4 rounded-xl bg-[#F8B4D9] text-[#0b0b10] text-[15px] font-semibold active:scale-[0.98] transition-transform"
                  >
                    {t("auth.createAccount")}
                  </button>

                  {/* Language Switcher for non-authenticated */}
                  <div className="py-4 border-t border-white/5">
                    <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#4B5563] mb-3">
                      {t("language.select")}
                    </p>
                    <MobileLanguageSwitcher onSelect={() => {}} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal (separate from sheet) */}
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[59] bg-black/60 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ─── MAIN MOBILE BOTTOM NAV ───
export function MobileBottomNav() {
  const t = useTranslations("mobile")
  const pathname = usePathname()
  const [oracleQuery, setOracleQuery] = useState("")
  const [showOracle, setShowOracle] = useState(false)
  const [showBrowse, setShowBrowse] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showOracleInput, setShowOracleInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when showing
  useEffect(() => {
    if (showOracleInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showOracleInput])

  const handleOracleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (oracleQuery.trim()) {
      saveSearchQuery(oracleQuery.trim())
      setShowOracleInput(false)
      setShowOracle(true)
    }
  }

  const handleCloseOracle = () => {
    setShowOracle(false)
    setOracleQuery("")
  }

  // Hide on car detail pages (has its own CTA)
  const isCarDetailPage = pathname?.includes("/cars/") && pathname?.split("/").length > 3
  if (isCarDetailPage) return null

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        {/* Oracle Input (expandable) */}
        <AnimatePresence>
          {showOracleInput && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="px-4 pb-3"
            >
              <form onSubmit={handleOracleSubmit} className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={oracleQuery}
                  onChange={(e) => setOracleQuery(e.target.value)}
                  placeholder={t("askAnything")}
                  className="w-full bg-[#0F1012] border border-[rgba(248,180,217,0.2)] rounded-2xl pl-5 pr-14 py-4 text-[15px] text-[#FFFCF7] placeholder:text-[#4B5563] focus:outline-none focus:border-[#F8B4D9]/50"
                />
                <button
                  type="submit"
                  disabled={!oracleQuery.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-xl bg-[#F8B4D9] text-[#0b0b10] disabled:opacity-50 disabled:bg-white/10 disabled:text-[#4B5563]"
                >
                  <ArrowRight className="size-5" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nav Bar */}
        <div className="bg-[#0b0b10]/95 backdrop-blur-xl border-t border-white/5 px-6 py-3 pb-safe">
          <div className="flex items-center justify-around">
            {/* AI Oracle Button */}
            <button
              onClick={() => setShowOracleInput(!showOracleInput)}
              className={`flex flex-col items-center gap-1 transition-colors ${
                showOracleInput ? "text-[#F8B4D9]" : "text-[#9CA3AF]"
              }`}
            >
              <div className={`size-11 rounded-full flex items-center justify-center transition-colors ${
                showOracleInput ? "bg-[#F8B4D9] text-[#0b0b10]" : "bg-white/5"
              }`}>
                <Sparkles className="size-5" />
              </div>
              <span className="text-[10px] font-medium">{t("aiOracle")}</span>
            </button>

            {/* Browse */}
            <button
              onClick={() => setShowBrowse(true)}
              className="flex flex-col items-center gap-1 text-[#9CA3AF]"
            >
              <div className="size-11 rounded-full bg-white/5 flex items-center justify-center">
                <Car className="size-5" />
              </div>
              <span className="text-[10px] font-medium">{t("explore")}</span>
            </button>

            {/* Account */}
            <button
              onClick={() => setShowAccount(true)}
              className="flex flex-col items-center gap-1 text-[#9CA3AF]"
            >
              <div className="size-11 rounded-full bg-white/5 flex items-center justify-center">
                <User className="size-5" />
              </div>
              <span className="text-[10px] font-medium">{t("account")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Oracle Overlay */}
      <MobileOracleOverlay
        isOpen={showOracle}
        onClose={handleCloseOracle}
        query={oracleQuery}
      />

      {/* Browse Sheet */}
      <MobileBrowseSheet isOpen={showBrowse} onClose={() => setShowBrowse(false)} />

      {/* Account Sheet */}
      <MobileAccountSheet isOpen={showAccount} onClose={() => setShowAccount(false)} />
    </>
  )
}
