"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Car,
  User,
  X,
  ChevronRight,
  LogOut,
  Home,
  Sun,
  Moon,
} from "lucide-react"
import { CURATED_CARS, searchCars, type CollectorCar } from "@/lib/curatedCars"
import { useAuth } from "@/lib/auth/AuthProvider"
import { AuthModal } from "@/components/auth/AuthModal"
import { useTranslations } from "next-intl"
import { MobileLanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { saveSearchQuery } from "@/lib/searchHistory"
import { getBrandConfig } from "@/lib/brandConfig"
import { useTheme } from "next-themes"

// ─── GET UNIQUE MAKES WITH COUNTS ───
function getMakesWithCounts() {
  const makeCounts: Record<string, { count: number; topCar: CollectorCar }> = {}

  CURATED_CARS.filter(c => c.make !== "Ferrari").forEach((car) => {
    if (!makeCounts[car.make]) {
      makeCounts[car.make] = { count: 0, topCar: car }
    }
    makeCounts[car.make].count++
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

// ─── SMART SEARCH INDEX (from brandConfig) ───
type SearchItem = {
  type: "family" | "series" | "variant"
  label: string
  subtitle: string
  family?: string
  seriesId?: string
  keywords: string[]
}

function buildSearchIndex(): SearchItem[] {
  const config = getBrandConfig("porsche")
  if (!config) return []

  const items: SearchItem[] = []

  for (const group of config.familyGroups) {
    items.push({
      type: "family",
      label: group.label,
      subtitle: `${group.seriesIds.length} series`,
      keywords: [group.label.toLowerCase(), ...group.seriesIds],
    })
  }

  for (const series of config.series) {
    items.push({
      type: "series",
      label: series.label,
      subtitle: `${series.yearRange[0]}–${series.yearRange[1]}`,
      family: series.family,
      seriesId: series.id,
      keywords: [series.label.toLowerCase(), series.id, ...series.keywords],
    })

    if (series.variants) {
      for (const variant of series.variants) {
        items.push({
          type: "variant",
          label: `${series.label} ${variant.label}`,
          subtitle: `${series.family} · ${series.yearRange[0]}–${series.yearRange[1]}`,
          family: series.family,
          seriesId: series.id,
          keywords: [variant.label.toLowerCase(), series.id, variant.label.toLowerCase().replace(/\s+/g, "")],
        })
      }
    }
  }

  return items
}

// ─── BRAND CARD ───
function BrandCard({ make, count, topCar }: { make: string; count: number; topCar: CollectorCar }) {
  const t = useTranslations("mobile")
  const makePath = make.toLowerCase().replace(/\s+/g, "-")

  return (
    <Link
      href={`/cars/${makePath}`}
      className="group relative flex flex-col rounded-2xl bg-card border border-border overflow-hidden active:scale-[0.98] transition-transform"
    >
      <div className="relative h-28 w-full">
        <Image
          src={topCar.image}
          alt={make}
          fill
          className="object-cover"
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-foreground">{make}</h3>
          <ChevronRight className="size-4 text-muted-foreground group-active:text-primary transition-colors" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
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
      className="flex items-center gap-3 p-3 rounded-xl bg-foreground/2 border border-border active:bg-white/[0.05] transition-colors"
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
        <p className="text-[13px] font-medium text-foreground truncate">{car.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[12px] font-display font-medium text-primary">{formatPrice(car.currentBid)}</span>
          <span className="text-[10px] text-emerald-400">{car.trend}</span>
        </div>
      </div>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
    </Link>
  )
}

// ─── SEARCH SHEET (replaces Oracle — clean, no AI branding) ───
function MobileSearchSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const t = useTranslations("mobile")
  const router = useRouter()
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const carResults = query.length > 1 ? searchCars(query) : []
  const searchIndex = buildSearchIndex()
  const taxonomyResults = query.length > 1
    ? searchIndex.filter(item =>
        item.keywords.some(k => k.includes(query.toLowerCase())) ||
        item.label.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    if (!isOpen) setQuery("")
  }, [isOpen])

  const handleTaxonomyClick = (item: SearchItem) => {
    if (item.seriesId) {
      router.push(`/cars/porsche?series=${item.seriesId}`)
    } else {
      router.push("/cars/porsche")
    }
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      saveSearchQuery(query.trim())
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[60] bg-background"
        >
          {/* Header with search */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border px-5 py-4">
            <form onSubmit={handleSubmit} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full bg-foreground/5 border border-border rounded-xl pl-12 pr-12 py-4 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-full bg-foreground/10 text-muted-foreground"
                >
                  <X className="size-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-medium text-muted-foreground"
                >
                  Cancel
                </button>
              )}
            </form>
          </div>

          {/* Results */}
          <div className="overflow-y-auto pb-24" style={{ height: "calc(100vh - 100px)" }}>
            {query.length < 2 ? (
              // Empty state — quick links
              <div className="px-5 py-6">
                <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-4">
                  Popular
                </p>
                <div className="flex flex-wrap gap-2">
                  {buildSearchIndex().filter(i => i.type === "family" || i.type === "series").slice(0, 8).map(i => i.label).map(term => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className="px-4 py-2 rounded-full bg-foreground/5 border border-border text-[13px] text-foreground active:bg-primary/10 active:border-primary/20 transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-6">
                {/* Taxonomy matches (series, families, variants) */}
                {taxonomyResults.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      Models & Series
                    </p>
                    <div className="space-y-1">
                      {taxonomyResults.map((item, i) => (
                        <button
                          key={`${item.type}-${i}`}
                          onClick={() => handleTaxonomyClick(item)}
                          className="flex items-center justify-between w-full p-3 rounded-xl active:bg-foreground/5 transition-colors"
                        >
                          <div>
                            <p className="text-[14px] font-medium text-foreground text-left">{item.label}</p>
                            <p className="text-[11px] text-muted-foreground text-left">{item.subtitle}</p>
                          </div>
                          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Car listings */}
                {carResults.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      {carResults.length} {carResults.length === 1 ? "Listing" : "Listings"}
                    </p>
                    <div className="space-y-3">
                      {carResults.slice(0, 20).map((car) => (
                        <SearchResultCard key={car.id} car={car} onSelect={onClose} />
                      ))}
                    </div>
                  </div>
                )}

                {/* No results */}
                {taxonomyResults.length === 0 && carResults.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="size-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                    <p className="text-[14px] text-muted-foreground">
                      No results for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-1">
                      Try a different model or series
                    </p>
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

// ─── EXPLORE SHEET (Browse brands + search) ───
function MobileExploreSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const t = useTranslations("mobile")
  const makes = getMakesWithCounts()

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[60] bg-background"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-[16px] font-semibold text-foreground">
                {t("exploreBrands")}
              </h2>
              <button
                onClick={onClose}
                className="size-10 flex items-center justify-center rounded-full bg-foreground/5 text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Brands Grid */}
          <div className="overflow-y-auto pb-24" style={{ height: "calc(100vh - 80px)" }}>
            <div className="grid grid-cols-2 gap-3 p-5">
              {makes.map(({ make, count, topCar }) => (
                <div key={make} onClick={onClose}>
                  <BrandCard make={make} count={count} topCar={topCar} />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── PROFILE SHEET (replaces Account — no hamburger duplication) ───
function MobileProfileSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const t = useTranslations()
  const { user, profile, loading, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const [showAuthModal, setShowAuthModal] = useState(false)
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
            className="fixed inset-x-0 bottom-0 z-[60] bg-card rounded-t-3xl border-t border-border"
            style={{ maxHeight: "85vh" }}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-foreground/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4">
              <h2 className="text-[16px] font-semibold text-foreground">{t("mobile.account")}</h2>
              <button
                onClick={onClose}
                className="size-10 flex items-center justify-center rounded-full bg-foreground/5 text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-8 overflow-y-auto" style={{ maxHeight: "calc(85vh - 100px)" }}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : isAuthenticated ? (
                <div className="space-y-6">
                  {/* User Info */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-foreground/5">
                    <div className="size-14 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="size-7 text-primary" />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-foreground">
                        {profile?.name || "User"}
                      </p>
                      <p className="text-[12px] text-muted-foreground">{user.email}</p>
                    </div>
                  </div>

                  {/* Credits */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/15">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
                          {t("auth.credits")}
                        </p>
                        <p className={`text-[32px] font-bold ${creditsRemaining > 0 ? "text-primary" : "text-[#FB923C]"}`}>
                          {creditsRemaining}
                        </p>
                      </div>
                      <button className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold">
                        {t("auth.buy")}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-3">
                      {t("auth.creditsReset")}
                    </p>
                  </div>

                  {/* Language */}
                  <div className="py-4 border-t border-border">
                    <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      {t("language.select")}
                    </p>
                    <MobileLanguageSwitcher onSelect={() => {}} />
                  </div>

                  {/* Theme Toggle */}
                  <div className="py-4 border-t border-border">
                    <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      Appearance
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTheme("light")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-[13px] font-medium transition-colors ${
                          theme === "light"
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-foreground/5 border-border text-muted-foreground"
                        }`}
                      >
                        <Sun className="size-4" />
                        Light
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-[13px] font-medium transition-colors ${
                          theme === "dark"
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-foreground/5 border-border text-muted-foreground"
                        }`}
                      >
                        <Moon className="size-4" />
                        Dark
                      </button>
                    </div>
                  </div>

                  {/* Sign Out */}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border border-border text-muted-foreground active:bg-foreground/5 transition-colors"
                  >
                    <LogOut className="size-5" />
                    <span className="text-[14px] font-medium">{t("auth.signOut")}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6 py-4">
                  <div className="text-center">
                    <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <User className="size-10 text-primary" />
                    </div>
                    <h3 className="text-[18px] font-semibold text-foreground">
                      {t("auth.welcomeBack")}
                    </h3>
                    <p className="text-[14px] text-muted-foreground mt-2">
                      {t("auth.freeCredits")}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      onClose()
                      setTimeout(() => setShowAuthModal(true), 300)
                    }}
                    className="w-full py-4 rounded-xl bg-primary text-primary-foreground text-[15px] font-semibold active:scale-[0.98] transition-transform"
                  >
                    {t("auth.createAccount")}
                  </button>

                  {/* Language */}
                  <div className="py-4 border-t border-border">
                    <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      {t("language.select")}
                    </p>
                    <MobileLanguageSwitcher onSelect={() => {}} />
                  </div>

                  {/* Theme Toggle */}
                  <div className="py-4 border-t border-border">
                    <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      Appearance
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTheme("light")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-[13px] font-medium transition-colors ${
                          theme === "light"
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-foreground/5 border-border text-muted-foreground"
                        }`}
                      >
                        <Sun className="size-4" />
                        Light
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-[13px] font-medium transition-colors ${
                          theme === "dark"
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-foreground/5 border-border text-muted-foreground"
                        }`}
                      >
                        <Moon className="size-4" />
                        Dark
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
  const router = useRouter()
  const [showSearch, setShowSearch] = useState(false)
  const [showExplore, setShowExplore] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  // Hide on car detail pages (has its own CTA)
  const isCarDetailPage = pathname?.includes("/cars/") && pathname?.split("/").length > 3
  if (isCarDetailPage) return null

  // Determine active tab
  const isHome = pathname === "/" || pathname === "/en" || pathname === "/es" || pathname === "/de" || pathname === "/ja"

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="bg-background/95 backdrop-blur-xl border-t border-border px-4 py-2 pb-safe">
          <div className="flex items-center justify-around">
            {/* Home */}
            <button
              onClick={() => router.push("/")}
              className={`flex flex-col items-center gap-1 transition-colors ${
                isHome && !showSearch && !showExplore ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className={`size-10 rounded-full flex items-center justify-center transition-colors ${
                isHome && !showSearch && !showExplore ? "bg-primary/10" : "bg-foreground/5"
              }`}>
                <Home className="size-5" />
              </div>
              <span className="text-[10px] font-medium">Home</span>
            </button>

            {/* Explore */}
            <button
              onClick={() => setShowExplore(true)}
              className="flex flex-col items-center gap-1 text-muted-foreground"
            >
              <div className="size-10 rounded-full bg-foreground/5 flex items-center justify-center">
                <Car className="size-5" />
              </div>
              <span className="text-[10px] font-medium">{t("explore")}</span>
            </button>

            {/* Search */}
            <button
              onClick={() => setShowSearch(true)}
              className="flex flex-col items-center gap-1 text-muted-foreground"
            >
              <div className="size-10 rounded-full bg-foreground/5 flex items-center justify-center">
                <Search className="size-5" />
              </div>
              <span className="text-[10px] font-medium">{t("search")}</span>
            </button>

            {/* Profile */}
            <button
              onClick={() => setShowProfile(true)}
              className="flex flex-col items-center gap-1 text-muted-foreground"
            >
              <div className="size-10 rounded-full bg-foreground/5 flex items-center justify-center">
                <User className="size-5" />
              </div>
              <span className="text-[10px] font-medium">{t("account")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sheets */}
      <MobileSearchSheet isOpen={showSearch} onClose={() => setShowSearch(false)} />
      <MobileExploreSheet isOpen={showExplore} onClose={() => setShowExplore(false)} />
      <MobileProfileSheet isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </>
  )
}
