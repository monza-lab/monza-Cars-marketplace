"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import Image from "next/image"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { UnifiedSearch } from "@/components/search/UnifiedSearch"
import {
  Search,
  Car,
  User,
  X,
  ChevronRight,
  ChevronDown,
  LogOut,
  Home,
  MessageCircle,
  Trash2,
  Clock,
  TrendingUp,
  Bookmark,
  FileText,
} from "lucide-react"
import { Piston } from "@/components/icons/Piston"
import { AccountSheetContent } from "@/components/account/AccountSheetContent"
import { CURATED_CARS, searchCars, type CollectorCar } from "@/lib/curatedCars"
import { useAuth } from "@/lib/auth/AuthProvider"
import { AuthModal } from "@/components/auth/AuthModal"
import { useLocale, useTranslations } from "next-intl"
import {
  saveSearchQuery,
  getSearchHistory,
  clearSearchHistory,
  type SearchHistoryEntry,
} from "@/lib/searchHistory"
import { getBrandConfig } from "@/lib/brandConfig"

// ─── GET UNIQUE MAKES WITH COUNTS ───
// Legacy helper kept for the now-unused BrandCard component below. Filtered to
// Porsche-only to honor the product's "Porsche-only" thesis.
function getMakesWithCounts() {
  const makeCounts: Record<string, { count: number; topCar: CollectorCar }> = {}

  CURATED_CARS.filter(c => c.make === "Porsche").forEach((car) => {
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
          {car.trend && (
            <span className="text-[10px] text-positive">{car.trend}</span>
          )}
        </div>
      </div>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
    </Link>
  )
}

// ─── SEARCH SHEET — discovery-first, filtros visibles, honest-by-data ───

type RegionFilter = "all" | "US" | "UK" | "EU" | "JP"
type StatusFilter = "all" | "live" | "sold"
type PriceBucketId = "any" | "lt50" | "p50_150" | "p150_500" | "p500plus"
type PriceBucket = { id: PriceBucketId; label: string; min?: number; max?: number }

// ─── SEGMENTED CONTROL ───
function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex items-center gap-0.5 rounded-full bg-foreground/[0.05] border border-border p-0.5"
    >
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`flex-1 h-8 rounded-full text-[12px] font-medium transition-all ${
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground active:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── EMPTY STATE — discovery hub ───
function SearchEmptyState({
  recent,
  onRecentClick,
  onClearRecent,
  region,
  setRegion,
  status,
  setStatus,
  priceBucket,
  setPriceBucket,
  familyGroups,
  onFamilyClick,
  trending,
  trendingLoaded,
  onTrendingClick,
  onSubmitAll,
  activeFilterCount,
}: {
  recent: SearchHistoryEntry[]
  onRecentClick: (q: string) => void
  onClearRecent: () => void
  region: RegionFilter
  setRegion: (v: RegionFilter) => void
  status: StatusFilter
  setStatus: (v: StatusFilter) => void
  priceBucket: PriceBucketId
  setPriceBucket: (v: PriceBucketId) => void
  familyGroups: { label: string; seriesIds: string[] }[]
  onFamilyClick: (seriesId: string) => void
  trending: TrendingCar[]
  trendingLoaded: boolean
  onTrendingClick: (car: TrendingCar) => void
  onSubmitAll: () => void
  activeFilterCount: number
}) {
  const t = useTranslations("mobile")
  return (
    <div className="px-4 py-4 space-y-6">
      {/* Recent */}
      {recent.length > 0 && (
        <section aria-label="Recent searches">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
              {t("recent")}
            </p>
            <button
              onClick={onClearRecent}
              aria-label="Clear recent searches"
              className="flex items-center gap-1 text-[11px] text-muted-foreground/80 active:text-foreground"
            >
              <Trash2 className="size-3" />
              {t("clear")}
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {recent.map(r => (
              <button
                key={r.timestamp}
                onClick={() => onRecentClick(r.query)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/[0.04] border border-border text-[12px] font-medium text-foreground/90 active:bg-foreground/[0.08] whitespace-nowrap"
              >
                <Clock className="size-3 text-muted-foreground" />
                {r.query}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <section aria-label="Filters" className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-2">
            {t("market")}
          </p>
          <Segmented<RegionFilter>
            value={region}
            onChange={setRegion}
            ariaLabel="Region filter"
            options={[
              { value: "all", label: "All" },
              { value: "US", label: "US" },
              { value: "UK", label: "UK" },
              { value: "EU", label: "EU" },
              { value: "JP", label: "JP" },
            ]}
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-2">
            {t("status")}
          </p>
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatus}
            ariaLabel="Status filter"
            options={[
              { value: "all", label: "All" },
              { value: "live", label: "Live" },
              { value: "sold", label: "Sold" },
            ]}
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-2">
            {t("priceUsd")}
          </p>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {PRICE_BUCKETS.map(b => {
              const active = b.id === priceBucket
              return (
                <button
                  key={b.id}
                  onClick={() => setPriceBucket(b.id)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full border text-[12px] font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "bg-foreground/[0.04] border-border text-foreground/85 active:bg-foreground/[0.08]"
                  }`}
                >
                  {b.label}
                </button>
              )
            })}
          </div>
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={onSubmitAll}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold active:bg-primary/85"
          >
            {activeFilterCount === 1
              ? t("applyFilters", { count: activeFilterCount })
              : t("applyFiltersPlural", { count: activeFilterCount })}
          </button>
        )}
      </section>

      {/* Browse by family */}
      {familyGroups.length > 0 && (
        <section aria-label="Browse by family">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-2.5">
            {t("browseByFamily")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {familyGroups.map(g => (
              <button
                key={g.label}
                onClick={() => onFamilyClick(g.seriesIds[0] ?? "")}
                className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-foreground/[0.04] border border-border text-foreground/90 active:bg-primary/[0.08] active:border-primary/25 transition-colors"
              >
                <span className="text-[12px] font-medium truncate">{g.label}</span>
                <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Trending */}
      {trendingLoaded && trending.length > 0 && (
        <section aria-label="Trending this week">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground inline-flex items-center gap-1.5">
              <TrendingUp className="size-3" />
              {t("trendingNow")}
            </p>
          </div>
          <div className="space-y-2">
            {trending.slice(0, 4).map(c => (
              <button
                key={c.id}
                onClick={() => onTrendingClick(c)}
                className="flex items-center gap-3 w-full p-2 rounded-xl bg-foreground/[0.02] border border-border active:bg-foreground/[0.06] transition-colors"
              >
                <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-muted">
                  <Image
                    src={c.images?.[0] || c.image || "/cars/placeholder.svg"}
                    alt={c.title}
                    fill
                    className="object-cover"
                    sizes="56px"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-display font-medium text-foreground truncate">
                    {c.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {(platformShortLocal[c.platform] || c.platform)}
                    {c.currentBid > 0 && (
                      <>
                        {" · "}
                        <span className="text-primary tabular-nums font-medium">
                          {formatTrendingPrice(c.currentBid)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── RESULTS STATE — when query has 2+ chars ───
function SearchResultsState({
  query,
  taxonomyResults,
  trendingResults,
  region,
  status,
  priceBucket,
  onClearRegion,
  onClearStatus,
  onClearPrice,
  onTaxonomyClick,
  onListingClick,
  onAskAdvisor,
  onSubmitAll,
}: {
  query: string
  taxonomyResults: SearchItem[]
  trendingResults: TrendingCar[]
  region: RegionFilter
  status: StatusFilter
  priceBucket: PriceBucketId
  onClearRegion: () => void
  onClearStatus: () => void
  onClearPrice: () => void
  onTaxonomyClick: (item: SearchItem) => void
  onListingClick: (car: TrendingCar) => void
  onAskAdvisor: () => void
  onSubmitAll: () => void
}) {
  const t = useTranslations("mobile")
  const filterChips: { label: string; onClear: () => void }[] = []
  if (region !== "all") filterChips.push({ label: region, onClear: onClearRegion })
  if (status !== "all") filterChips.push({ label: status === "live" ? "Live" : "Sold", onClear: onClearStatus })
  if (priceBucket !== "any") {
    const bucket = PRICE_BUCKETS.find(b => b.id === priceBucket)
    if (bucket) filterChips.push({ label: bucket.label, onClear: onClearPrice })
  }

  const empty = taxonomyResults.length === 0 && trendingResults.length === 0

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Active filter chips */}
      {filterChips.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
          {filterChips.map(c => (
            <button
              key={c.label}
              onClick={c.onClear}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/12 border border-primary/25 text-[11px] font-medium text-primary"
            >
              {c.label}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}

      {/* Models & Series */}
      {taxonomyResults.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-2.5">
            {t("modelsSeries")}
          </p>
          <div className="space-y-1">
            {taxonomyResults.map((item, i) => (
              <button
                key={`${item.type}-${i}`}
                onClick={() => onTaxonomyClick(item)}
                className="flex items-center justify-between w-full p-3 rounded-xl active:bg-foreground/[0.05] transition-colors"
              >
                <div className="text-left min-w-0">
                  <p className="text-[14px] font-medium text-foreground truncate">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Listings (from real feed) */}
      {trendingResults.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-2.5">
            {t("listings")}
          </p>
          <div className="space-y-2">
            {trendingResults.map(c => (
              <button
                key={c.id}
                onClick={() => onListingClick(c)}
                className="flex items-center gap-3 w-full p-2 rounded-xl bg-foreground/[0.02] border border-border active:bg-foreground/[0.06] transition-colors"
              >
                <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-muted">
                  <Image
                    src={c.images?.[0] || c.image || "/cars/placeholder.svg"}
                    alt={c.title}
                    fill
                    className="object-cover"
                    sizes="56px"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-display font-medium text-foreground truncate">
                    {c.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {(platformShortLocal[c.platform] || c.platform)}
                    {c.currentBid > 0 && (
                      <>
                        {" · "}
                        <span className="text-primary tabular-nums font-medium">
                          {formatTrendingPrice(c.currentBid)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* See all CTA */}
      {!empty && (
        <button
          onClick={onSubmitAll}
          className="w-full py-3 rounded-xl border border-border bg-foreground/[0.02] text-[12px] font-medium text-foreground/85 active:bg-foreground/[0.06]"
        >
          {t("seeAllResults", { query })}
        </button>
      )}

      {/* Empty state with advisor CTA */}
      {empty && (
        <div className="text-center py-10">
          <Search className="size-10 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-[14px] font-medium text-foreground">
            {t("noResultsTitle", { query })}
          </p>
          <p className="text-[12px] text-muted-foreground mt-1 mb-5">
            {t("advisorContextHint")}
          </p>
          <button
            onClick={onAskAdvisor}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold"
          >
            <MessageCircle className="size-4" />
            {t("askTheAdvisor")}
          </button>
        </div>
      )}
    </div>
  )
}

// Local price formatter (compact) used inside the search sheet only
function formatTrendingPrice(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${value.toLocaleString()}`
}

// Platform short labels (kept local to avoid pulling makePageConstants)
const platformShortLocal: Record<string, string> = {
  BRING_A_TRAILER: "BaT",
  CARS_AND_BIDS: "C&B",
  COLLECTING_CARS: "CC",
  AUTO_SCOUT_24: "AS24",
  AUTO_TRADER: "AT",
  BE_FORWARD: "BF",
  CLASSIC_COM: "Cls",
  ELFERSPOT: "ES",
  RM_SOTHEBYS: "RM",
  BONHAMS: "BON",
  GOODING: "G&C",
}

const PRICE_BUCKETS: PriceBucket[] = [
  { id: "any", label: "Any" },
  { id: "lt50", label: "<$50K", max: 50_000 },
  { id: "p50_150", label: "$50–150K", min: 50_000, max: 150_000 },
  { id: "p150_500", label: "$150–500K", min: 150_000, max: 500_000 },
  { id: "p500plus", label: "$500K+", min: 500_000 },
]

type TrendingCar = {
  id: string
  title: string
  year: number
  make: string
  model: string
  currentBid: number
  platform: string
  images?: string[]
  image?: string
}

function MobileSearchSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const t = useTranslations("mobile")
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [region, setRegion] = useState<RegionFilter>("all")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [priceBucket, setPriceBucket] = useState<PriceBucket["id"]>("any")
  const [recent, setRecent] = useState<SearchHistoryEntry[]>([])
  const [trending, setTrending] = useState<TrendingCar[]>([])
  const [trendingLoaded, setTrendingLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const searchIndex = useMemo(() => buildSearchIndex(), [])
  const taxonomyResults = useMemo(() => {
    if (query.length < 2) return []
    const q = query.toLowerCase()
    return searchIndex
      .filter(item => item.keywords.some(k => k.includes(q)) || item.label.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, searchIndex])

  const trendingResults = useMemo(() => {
    if (query.length < 2) return []
    const q = query.toLowerCase()
    return trending
      .filter(c => `${c.year} ${c.make} ${c.model} ${c.title}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, trending])

  // Load recent + trending when sheet opens
  useEffect(() => {
    if (!isOpen) return
    const recentTimer = window.setTimeout(() => {
      setRecent(getSearchHistory().slice(0, 6))
    }, 0)
    if (!trendingLoaded) {
      const ac = new AbortController()
      // Porsche-only — explicit make param + defense-in-depth client filter.
      fetch("/api/mock-auctions?limit=6&make=Porsche", { signal: ac.signal })
        .then(r => r.ok ? r.json() : { auctions: [] })
        .then((data: { auctions?: TrendingCar[] }) => {
          if (Array.isArray(data.auctions)) {
            setTrending(data.auctions.filter(c => c.make === "Porsche"))
          }
          setTrendingLoaded(true)
        })
        .catch(() => setTrendingLoaded(true))
      return () => {
        window.clearTimeout(recentTimer)
        ac.abort()
      }
    }
    return () => window.clearTimeout(recentTimer)
  }, [isOpen, trendingLoaded])

  // Focus input + reset query on close
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 120)
    }
    if (!isOpen) {
      const resetTimer = window.setTimeout(() => setQuery(""), 0)
      return () => window.clearTimeout(resetTimer)
    }
  }, [isOpen])

  const buildQueryParams = useCallback(() => {
    const sp = new URLSearchParams()
    if (query.trim()) sp.set("q", query.trim())
    if (region !== "all") sp.set("region", region)
    if (status !== "all") sp.set("status", status)
    const bucket = PRICE_BUCKETS.find(b => b.id === priceBucket)
    if (bucket?.min !== undefined) sp.set("priceMin", String(bucket.min))
    if (bucket?.max !== undefined) sp.set("priceMax", String(bucket.max))
    return sp.toString()
  }, [query, region, status, priceBucket])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = query.trim()
    if (trimmed) saveSearchQuery(trimmed)
    const qs = buildQueryParams()
    router.push(qs ? `/search?${qs}` : "/search")
    onClose()
  }

  const handleTaxonomyClick = (item: SearchItem) => {
    if (item.seriesId) router.push(`/cars/porsche?family=${item.seriesId}`)
    else router.push("/cars/porsche")
    onClose()
  }

  const handleRecentClick = (q: string) => {
    setQuery(q)
    inputRef.current?.focus()
  }

  const handleClearRecent = () => {
    clearSearchHistory()
    setRecent([])
  }

  const handleFamilyClick = (seriesId: string) => {
    router.push(`/cars/porsche?family=${seriesId}`)
    onClose()
  }

  const config = useMemo(() => getBrandConfig("porsche"), [])
  const familyGroups = config?.familyGroups ?? []

  const activeFilterCount =
    (region !== "all" ? 1 : 0) + (status !== "all" ? 1 : 0) + (priceBucket !== "any" ? 1 : 0)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[60] bg-background flex flex-col"
        >
          {/* Cancel bar */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-2 shrink-0 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 h-8 text-[13px] font-medium text-muted-foreground active:text-foreground"
            >
              {t("cancel")}
            </button>
          </div>

          {/* UnifiedSearch fills the rest of the sheet */}
          <div className="flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
            <UnifiedSearch variant="sheet" autoFocus onClose={onClose} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// (Legacy MobileExploreSheet removed — Advisor took its place in the bottom nav.)

// ─── PROFILE SHEET (replaces Account — no hamburger duplication) ───
// ─── ACCOUNT SHEET (mobile bottom sheet) — wraps shared AccountSheetContent ───
function MobileProfileSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const t = useTranslations("mobile")
  const [showAuthModal, setShowAuthModal] = useState(false)

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-card rounded-t-3xl border-t border-border flex flex-col"
            style={{ maxHeight: "92dvh" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center py-3 shrink-0">
              <div className="w-10 h-1 rounded-full bg-foreground/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-3 shrink-0">
              <h2 className="font-display text-[20px] font-medium text-foreground">
                {t("account")}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="size-9 flex items-center justify-center rounded-full bg-foreground/5 text-muted-foreground active:bg-foreground/10"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
              <AccountSheetContent
                onClose={onClose}
                onOpenAuth={() => setShowAuthModal(true)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        defaultMode="signup"
      />

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
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [showSearch, setShowSearch] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  // Hide on car detail pages (has its own CTA)
  const isCarDetailPage = pathname?.includes("/cars/") && pathname?.split("/").length > 3
  if (isCarDetailPage) return null

  // Determine active tab
  const isHome = pathname === "/" || pathname === "/en" || pathname === "/es" || pathname === "/de" || pathname === "/ja"
  const homeHref = "/"

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="bg-background/95 backdrop-blur-xl border-t border-border px-4 py-2 pb-safe">
          <div className="flex items-center justify-around">
            {/* Home */}
            <button
              onClick={() => router.push(homeHref)}
              className={`flex flex-col items-center gap-1 transition-colors min-h-[56px] ${
                isHome && !showSearch ? "text-primary" : "text-muted-foreground"
              }`}
              aria-label="Home"
            >
              <div className={`size-10 rounded-full flex items-center justify-center transition-colors ${
                isHome && !showSearch ? "bg-primary/10" : "bg-foreground/5"
              }`}>
                <Home className="size-5" />
              </div>
              <span className="text-[10px] font-medium">Home</span>
            </button>

            {/* Advisor — 1-tap to chat (Pistons funnel + retention driver) */}
            <button
              onClick={() => router.push("/advisor")}
              className={`flex flex-col items-center gap-1 transition-colors min-h-[56px] ${
                pathname?.startsWith("/advisor") ? "text-primary" : "text-muted-foreground"
              }`}
              aria-label="Advisor"
            >
              <div className={`size-10 rounded-full flex items-center justify-center transition-colors ${
                pathname?.startsWith("/advisor") ? "bg-primary/10" : "bg-foreground/5"
              }`}>
                <MessageCircle className="size-5" />
              </div>
              <span className="text-[10px] font-medium">{t("advisor")}</span>
            </button>

            {/* Search */}
            <button
              onClick={() => setShowSearch(true)}
              className="flex flex-col items-center gap-1 text-muted-foreground min-h-[56px]"
              aria-label={t("search")}
            >
              <div className="size-10 rounded-full bg-foreground/5 flex items-center justify-center">
                <Search className="size-5" />
              </div>
              <span className="text-[10px] font-medium">{t("search")}</span>
            </button>

            {/* Profile */}
            <button
              onClick={() => setShowProfile(true)}
              className="flex flex-col items-center gap-1 text-muted-foreground min-h-[56px]"
              aria-label={t("account")}
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
      <MobileProfileSheet isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </>
  )
}
