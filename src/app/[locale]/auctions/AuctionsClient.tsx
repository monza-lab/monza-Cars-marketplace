"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import { Link, useRouter } from "@/i18n/navigation"
import Image from "next/image"
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ChevronDown,
  X,
  Clock,
  Gavel,
  ArrowUpDown,
  Loader2,
  Car,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useCurrency } from "@/lib/CurrencyContext"
import { isAuctionPlatform } from "@/components/dashboard/platformMapping"
import { useLocale, useTranslations } from "next-intl"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Auction {
  id: string
  title: string
  year: number
  make: string
  model: string
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
  location: string | null
  hasAnalysis: boolean
}

interface AuctionsResponse {
  auctions: Auction[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface Filters {
  platform: string
  make: string
  model: string
  status: string
  search: string
  sort: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL = "__all__"

const PLATFORMS = [
  { value: "bring-a-trailer", label: "Bring a Trailer" },
  { value: "cars-and-bids", label: "Cars & Bids" },
  { value: "pcarmarket", label: "PCAR Market" },
  { value: "hemmings", label: "Hemmings" },
  { value: "collectingcars", label: "Collecting Cars" },
]

const SORT_OPTIONS = [
  { value: "ending-soon", key: "endingSoon" as const },
  { value: "newly-listed", key: "newlyListed" as const },
  { value: "price-low", key: "priceLow" as const },
  { value: "price-high", key: "priceHigh" as const },
  { value: "most-bids", key: "mostBids" as const },
]

const STATUS_OPTIONS = [
  { value: "active", key: "active" as const },
  { value: "ended", key: "ended" as const },
  { value: "upcoming", key: "upcoming" as const },
]

// Porsche-only by product design.
const POPULAR_MAKES = ["", "Porsche"]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeRemaining(
  endDate: string,
  labels: { ended: string; day: string; hour: string; minute: string }
): string {
  const end = new Date(endDate)
  const now = new Date()
  const diff = end.getTime() - now.getTime()

  if (diff <= 0) return labels.ended

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return `${days}${labels.day} ${hours}${labels.hour}`
  if (hours > 0) return `${hours}${labels.hour} ${minutes}${labels.minute}`
  return `${minutes}${labels.minute}`
}

function getReserveBadge(
  status: Auction["reserveStatus"]
): {
  key: "noReserve" | "reserveMet" | "reserveNotMet"
  className: string
} | null {
  switch (status) {
    case "no_reserve":
      return {
        key: "noReserve",
        className: "bg-primary/20 text-destructive border-primary/30",
      }
    case "met":
      return {
        key: "reserveMet",
        className: "bg-positive/20 text-positive border-positive/30",
      }
    case "not_met":
      return {
        key: "reserveNotMet",
        className: "bg-destructive/20 text-destructive border-destructive/30",
      }
    default:
      return null
  }
}

function getPlatformColor(platform: string): string {
  switch (platform) {
    case "bring-a-trailer":
      return "bg-destructive/20 text-destructive border-destructive/30"
    case "cars-and-bids":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30"
    case "pcarmarket":
      return "bg-destructive/20 text-destructive border-destructive/30"
    case "hemmings":
      return "bg-green-500/20 text-green-400 border-green-500/30"
    case "collectingcars":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30"
    default:
      return "bg-foreground/8 text-muted-foreground border-border"
  }
}

function getPlatformLabel(platform: string): string {
  return (
    PLATFORMS.find((p) => p.value === platform)?.label ??
    platform.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AuctionCardSkeleton({ view }: { view: "grid" | "list" }) {
  if (view === "list") {
    return (
      <Card className="border-border/60 bg-card/50 overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <Skeleton className="h-48 w-full sm:h-auto sm:w-64 bg-foreground/5" />
          <CardContent className="flex-1 p-4">
            <Skeleton className="h-5 w-3/4 mb-2 bg-foreground/5" />
            <Skeleton className="h-4 w-1/2 mb-4 bg-foreground/5" />
            <div className="flex gap-4">
              <Skeleton className="h-8 w-24 bg-foreground/5" />
              <Skeleton className="h-8 w-24 bg-foreground/5" />
            </div>
          </CardContent>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border-border/60 bg-card/50 overflow-hidden">
      <Skeleton className="h-48 w-full bg-foreground/5" />
      <CardContent className="p-4">
        <Skeleton className="h-5 w-3/4 mb-2 bg-foreground/5" />
        <Skeleton className="h-4 w-1/2 mb-4 bg-foreground/5" />
        <div className="flex justify-between">
          <Skeleton className="h-8 w-24 bg-foreground/5" />
          <Skeleton className="h-8 w-20 bg-foreground/5" />
        </div>
      </CardContent>
    </Card>
  )
}

function AuctionCard({
  auction,
  view,
}: {
  auction: Auction
  view: "grid" | "list"
}) {
  const locale = useLocale()
  const t = useTranslations("auctionsList")
  const tStatus = useTranslations("status")
  const { formatPrice } = useCurrency()

  const [isEnding, setIsEnding] = useState(false)

  useEffect(() => {
    if (auction.status !== "active") {
      setIsEnding(false)
      return
    }

    const ONE_DAY_MS = 1000 * 60 * 60 * 24
    const update = () => {
      const msLeft = new Date(auction.endDate).getTime() - Date.now()
      setIsEnding(msLeft > 0 && msLeft < ONE_DAY_MS)
    }

    update()
    const id = window.setInterval(update, 60_000)
    return () => window.clearInterval(id)
  }, [auction.endDate, auction.status])

  const reserveBadge = getReserveBadge(auction.reserveStatus)
  const hasEnded = auction.status === "ended"
  const isAuction = isAuctionPlatform(auction.platform)
  const endedLabel = isAuction ? tStatus("ended") : tStatus("sold")

  if (view === "list") {
    return (
      <Link href={`/auctions/${auction.id}`} className="block group">
        <Card className="border-border/60 bg-card/50 overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 group-hover:bg-card/80">
          <div className="flex flex-col sm:flex-row">
            {/* Image */}
            <div className="relative h-48 w-full sm:h-auto sm:w-64 shrink-0 overflow-hidden">
              {auction.imageUrl ? (
                <Image
                  src={auction.imageUrl}
                  alt={auction.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 256px"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-foreground/5">
                  <Car className="size-12 text-muted-foreground/60" />
                </div>
              )}
              {/* Platform badge */}
              <div className="absolute top-2 left-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] backdrop-blur-sm ${getPlatformColor(auction.platform)}`}
                >
                  {getPlatformLabel(auction.platform)}
                </Badge>
              </div>
              {auction.hasAnalysis && (
                <div className="absolute top-2 right-2">
                  <Badge className="bg-primary/90 text-black text-[10px] font-semibold border-0">
                    {t("badges.aiAnalyzed")}
                  </Badge>
                </div>
              )}
            </div>

            {/* Content */}
            <CardContent className="flex flex-1 flex-col justify-between gap-3 p-4">
              <div>
                <h3 className="font-semibold text-foreground text-base leading-tight mb-1 group-hover:text-destructive transition-colors">
                  {auction.title}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground/80">
                  {auction.mileage !== null && (
                    <span>
                      {auction.mileage.toLocaleString(locale)} {t("units.milesLong")}
                    </span>
                  )}
                  {auction.transmission && <span>{auction.transmission}</span>}
                  {auction.location && <span>{auction.location}</span>}
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-center gap-4">
                  {/* Current bid */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-0.5">
                      {hasEnded ? t("card.soldFor") : t("card.currentBid")}
                    </p>
                    <p className="text-lg font-bold text-destructive">
                      {auction.currentBid !== null ? formatPrice(auction.currentBid) : t("card.noBids")}
                    </p>
                  </div>
                  {/* Bids */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-0.5">
                      {t("card.bids")}
                    </p>
                    <p className="text-sm font-medium text-foreground/80">
                      {auction.bidCount}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {reserveBadge && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${reserveBadge.className}`}
                    >
                      {t(`reserve.${reserveBadge.key}`)}
                    </Badge>
                  )}
                  {!hasEnded ? (
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        isEnding
                          ? "bg-destructive/20 text-destructive border-destructive/30 animate-pulse"
                          : "bg-foreground/5 text-muted-foreground border-border"
                      }`}
                    >
                      <Clock className="size-3 mr-1" />
                      {formatTimeRemaining(auction.endDate, {
                        ended: endedLabel,
                        day: t("time.units.day"),
                        hour: t("time.units.hour"),
                        minute: t("time.units.minute"),
                      })}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-foreground/5 text-muted-foreground/80 border-border"
                    >
                      {endedLabel}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      </Link>
    )
  }

  // Grid view
  return (
    <Link href={`/auctions/${auction.id}`} className="block group">
      <Card className="border-border/60 bg-card/50 overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 group-hover:bg-card/80 h-full flex flex-col">
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden">
          {auction.imageUrl ? (
            <Image
              src={auction.imageUrl}
              alt={auction.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-foreground/5">
              <Car className="size-12 text-muted-foreground/60" />
            </div>
          )}

          {/* Overlay badges */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
            <Badge
              variant="outline"
              className={`text-[10px] backdrop-blur-sm ${getPlatformColor(auction.platform)}`}
            >
              {getPlatformLabel(auction.platform)}
            </Badge>
            {auction.hasAnalysis && (
              <Badge className="bg-primary/90 text-black text-[10px] font-semibold border-0">
                {t("badges.aiAnalyzed")}
              </Badge>
            )}
          </div>

          {/* Time remaining overlay */}
          {!hasEnded && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6">
              <div
                className={`flex items-center gap-1 text-xs font-medium ${
                  isEnding ? "text-destructive" : "text-foreground/80"
                }`}
              >
                <Clock className="size-3" />
                {formatTimeRemaining(auction.endDate, {
                  ended: endedLabel,
                  day: t("time.units.day"),
                  hour: t("time.units.hour"),
                  minute: t("time.units.minute"),
                })}
                {isEnding && t("time.remainingSuffix")}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="flex flex-1 flex-col justify-between gap-3 p-4">
          <div>
            <h3 className="font-semibold text-foreground text-sm leading-tight mb-1.5 line-clamp-2 group-hover:text-destructive transition-colors">
              {auction.title}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground/80">
              {auction.mileage !== null && (
                <span>
                  {auction.mileage.toLocaleString(locale)} {t("units.milesShort")}
                </span>
              )}
              {auction.transmission && (
                <>
                  <span className="text-muted-foreground/40">|</span>
                  <span>{auction.transmission}</span>
                </>
              )}
              {auction.location && (
                <>
                  <span className="text-muted-foreground/40">|</span>
                  <span>{auction.location}</span>
                </>
              )}
            </div>
          </div>

          <Separator className="bg-foreground/5/80" />

          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-0.5">
                {hasEnded ? t("card.soldFor") : t("card.currentBid")}
              </p>
              <p className="text-lg font-bold text-destructive">
                {auction.currentBid !== null ? formatPrice(auction.currentBid) : t("card.noBids")}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {reserveBadge && (
                <Badge
                  variant="outline"
                  className={`text-[10px] ${reserveBadge.className}`}
                >
                  {t(`reserve.${reserveBadge.key}`)}
                </Badge>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground/80">
                <Gavel className="size-3" />
                {auction.bidCount}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Sidebar Filters
// ---------------------------------------------------------------------------

function FilterSidebar({
  filters,
  onFilterChange,
  onReset,
  resultCount,
}: {
  filters: Filters
  onFilterChange: (key: keyof Filters, value: string) => void
  onReset: () => void
  resultCount: number
}) {
  const t = useTranslations("auctionsList")

  const hasActiveFilters =
    filters.platform || filters.make || filters.model || filters.status

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/90 uppercase tracking-wider">
          {t("filters.title")}
        </h3>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="text-xs text-destructive hover:text-destructive transition-colors"
          >
            {t("filters.clearAll")}
          </button>
        )}
      </div>

      {/* Platform */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("filters.platform")}
        </label>
        <Select
          value={filters.platform}
          onValueChange={(v) => onFilterChange("platform", v)}
        >
          <SelectTrigger className="w-full bg-card/80 border-border text-foreground/90 h-9 text-sm">
            <SelectValue placeholder={t("filters.allPlatforms")} />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem
              key={ALL}
              value={ALL}
              className="text-foreground/90 focus:bg-foreground/5 focus:text-destructive"
            >
              {t("filters.allPlatforms")}
            </SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem
                key={p.value}
                value={p.value}
                className="text-foreground/90 focus:bg-foreground/5 focus:text-destructive"
              >
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Make */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("filters.make")}
        </label>
        <Select
          value={filters.make}
          onValueChange={(v) => onFilterChange("make", v)}
        >
          <SelectTrigger className="w-full bg-card/80 border-border text-foreground/90 h-9 text-sm">
            <SelectValue placeholder={t("filters.allMakes")} />
          </SelectTrigger>
          <SelectContent className="bg-card border-border max-h-60">
            {POPULAR_MAKES.map((m) => (
              <SelectItem
                key={m || "__all__"}
                value={m || ALL}
                className="text-foreground/90 focus:bg-foreground/5 focus:text-destructive"
              >
                {m || t("filters.allMakes")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model - free text */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("filters.model")}
        </label>
        <Input
          placeholder={t("filters.modelPlaceholder")}
          value={filters.model}
          onChange={(e) => onFilterChange("model", e.target.value)}
          className="bg-card/80 border-border text-foreground/90 placeholder:text-muted-foreground/60 h-9 text-sm"
        />
      </div>

      {/* Status */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("filters.status")}
        </label>
        <Select
          value={filters.status}
          onValueChange={(v) => onFilterChange("status", v)}
        >
          <SelectTrigger className="w-full bg-card/80 border-border text-foreground/90 h-9 text-sm">
            <SelectValue placeholder={t("filters.allStatuses")} />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem
              key={ALL}
              value={ALL}
              className="text-foreground/90 focus:bg-foreground/5 focus:text-destructive"
            >
              {t("filters.allStatuses")}
            </SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem
                key={s.value || "__all__"}
                value={s.value}
                className="text-foreground/90 focus:bg-foreground/5 focus:text-destructive"
              >
                {t(`statuses.${s.key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator className="bg-foreground/5" />

      <p className="text-xs text-muted-foreground/60">
        {t("filters.resultsFound", { count: resultCount })}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mobile Filter Sheet (inline accordion-style)
// ---------------------------------------------------------------------------

function MobileFilters({
  filters,
  onFilterChange,
  onReset,
  open,
  onToggle,
}: {
  filters: Filters
  onFilterChange: (key: keyof Filters, value: string) => void
  onReset: () => void
  open: boolean
  onToggle: () => void
}) {
  const t = useTranslations("auctionsList")

  const hasActiveFilters =
    filters.platform || filters.make || filters.model || filters.status
  const activeCount = [
    filters.platform,
    filters.make,
    filters.model,
    filters.status,
  ].filter(Boolean).length

  return (
    <div className="lg:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="bg-card/80 border-border text-foreground/80 hover:bg-foreground/5 hover:text-destructive"
      >
        <SlidersHorizontal className="size-4 mr-1.5" />
        {t("filters.title")}
        {activeCount > 0 && (
          <Badge className="ml-1.5 bg-primary/20 text-destructive border-primary/30 text-[10px] px-1.5">
            {activeCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="mt-3 rounded-lg border border-border bg-card/90 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground/80">
              {t("filters.mobileTitle")}
            </span>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={onReset}
                  className="text-xs text-destructive hover:text-destructive"
                >
                  {t("filters.clear")}
                </button>
              )}
              <button onClick={onToggle}>
                <X className="size-4 text-muted-foreground/80 hover:text-foreground/80" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              value={filters.platform}
              onValueChange={(v) => onFilterChange("platform", v)}
            >
              <SelectTrigger className="bg-foreground/5 border-border text-foreground/90 h-9 text-xs">
                <SelectValue placeholder={t("filters.platform")} />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem key={ALL} value={ALL} className="text-foreground/90 text-xs">
                  {t("filters.allPlatforms")}
                </SelectItem>
                {PLATFORMS.map((p) => (
                  <SelectItem
                    key={p.value}
                    value={p.value}
                    className="text-foreground/90 text-xs"
                  >
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.make}
              onValueChange={(v) => onFilterChange("make", v)}
            >
              <SelectTrigger className="bg-foreground/5 border-border text-foreground/90 h-9 text-xs">
                <SelectValue placeholder={t("filters.make")} />
              </SelectTrigger>
              <SelectContent className="bg-card border-border max-h-60">
                {POPULAR_MAKES.map((m) => (
                  <SelectItem
                    key={m || "__all__"}
                    value={m || ALL}
                    className="text-foreground/90 text-xs"
                  >
                    {m || t("filters.allMakes")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder={t("filters.model")}
              value={filters.model}
              onChange={(e) => onFilterChange("model", e.target.value)}
              className="bg-foreground/5 border-border text-foreground/90 placeholder:text-muted-foreground/60 h-9 text-xs"
            />

            <Select
              value={filters.status}
              onValueChange={(v) => onFilterChange("status", v)}
            >
              <SelectTrigger className="bg-foreground/5 border-border text-foreground/90 h-9 text-xs">
                <SelectValue placeholder={t("filters.status")} />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem key={ALL} value={ALL} className="text-foreground/90 text-xs">
                  {t("filters.allStatuses")}
                </SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem
                    key={s.value}
                    value={s.value}
                    className="text-foreground/90 text-xs"
                  >
                    {t(`statuses.${s.key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ onReset }: { onReset: () => void }) {
  const t = useTranslations("auctionsList")

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="rounded-full bg-foreground/5/60 p-5 mb-5">
        <Car className="size-10 text-muted-foreground/60" />
      </div>
      <h3 className="text-lg font-semibold text-foreground/90 mb-2">
        {t("empty.title")}
      </h3>
      <p className="text-sm text-muted-foreground/80 max-w-sm mb-6">
        {t("empty.subtitle")}
      </p>
      <Button
        variant="outline"
        onClick={onReset}
        className="bg-card border-border text-foreground/80 hover:bg-foreground/5 hover:text-destructive"
      >
        {t("empty.clearFilters")}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Client Component
// ---------------------------------------------------------------------------

export default function AuctionsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const t = useTranslations("auctionsList")
  const tStatus = useTranslations("status")

  // State
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<"grid" | "list">("grid")
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Derive filters from URL search params
  const filters: Filters = {
    platform: searchParams.get("platform") ?? "",
    make: searchParams.get("make") ?? "",
    model: searchParams.get("model") ?? "",
    status: searchParams.get("status") ?? "",
    search: searchParams.get("search") ?? "",
    sort: searchParams.get("sort") ?? "ending-soon",
  }
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))

  // Sync filters to URL
  const updateURL = useCallback(
    (newFilters: Filters) => {
      const params = new URLSearchParams()
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value && value !== "__all__") {
          params.set(key, value)
        }
      })
      startTransition(() => {
        router.push(`/auctions?${params.toString()}`, { scroll: false })
      })
    },
    [router]
  )

  const handleFilterChange = useCallback(
    (key: keyof Filters, value: string) => {
      const cleaned = value === "__all__" ? "" : value
      const newFilters = { ...filters, [key]: cleaned }
      updateURL(newFilters)
    },
    [filters, updateURL]
  )

  const handleSearch = useCallback(
    (value: string) => {
      const newFilters = { ...filters, search: value }
      updateURL(newFilters)
    },
    [filters, updateURL]
  )

  const handleReset = useCallback(() => {
    updateURL({
      platform: "",
      make: "",
      model: "",
      status: "",
      search: "",
      sort: "ending-soon",
    })
  }, [updateURL])

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("page", newPage.toString())
      startTransition(() => {
        router.push(`/auctions?${params.toString()}`)
      })
    },
    [searchParams, router]
  )

  // Fetch auctions from API
  useEffect(() => {
    const controller = new AbortController()

    async function fetchAuctions() {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (filters.platform) params.set("platform", filters.platform)
        if (filters.make) params.set("make", filters.make)
        if (filters.model) params.set("model", filters.model)
        if (filters.status) params.set("status", filters.status)
        if (filters.search) params.set("search", filters.search)
        if (filters.sort) params.set("sort", filters.sort)
        params.set("page", page.toString())
        params.set("limit", "24")

        const res = await fetch(`/api/auctions?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!res.ok) {
          throw new Error(`Failed to fetch auctions (${res.status})`)
        }

        const json = await res.json()
        const auctionsList = json.data ?? json.auctions ?? []
        const meta = json.meta ?? {}
        setAuctions(auctionsList)
        setTotal(meta.total ?? json.total ?? 0)
        setTotalPages(meta.totalPages ?? json.totalPages ?? 0)
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchAuctions()

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchParams.get("platform"),
    searchParams.get("make"),
    searchParams.get("model"),
    searchParams.get("status"),
    searchParams.get("search"),
    searchParams.get("sort"),
    searchParams.get("page"),
  ])

  // Debounced search
  const [searchInput, setSearchInput] = useState(filters.search)

  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        handleSearch(searchInput)
      }
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-6">
            {/* Title row */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  {t("header.title")}
                </h1>
                <p className="text-sm text-muted-foreground/80 mt-0.5">
                  {t("header.subtitle")}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground/60">
                <div className="h-2 w-2 rounded-full bg-positive animate-pulse" />
                {tStatus("live")}
              </div>
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/80" />
              <Input
                placeholder={t("header.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 bg-card/80 border-border text-foreground/90 placeholder:text-muted-foreground/60 h-10"
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput("")
                    handleSearch("")
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="size-4 text-muted-foreground/80 hover:text-foreground/80" />
                </button>
              )}
            </div>

            {/* Controls bar */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <MobileFilters
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onReset={handleReset}
                  open={mobileFiltersOpen}
                  onToggle={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                />

                {/* Result count */}
                <p className="text-sm text-muted-foreground/80 hidden sm:block">
                  {loading ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="size-3 animate-spin" />
                      {t("common.loading")}
                    </span>
                  ) : (
                    <>
                      <span className="font-medium text-foreground/80">
                        {total}
                      </span>{" "}
                      {t("results.listingsLabel", { count: total })}
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Sort */}
                <Select
                  value={filters.sort}
                  onValueChange={(v) => handleFilterChange("sort", v)}
                >
                  <SelectTrigger className="bg-card/80 border-border text-foreground/80 h-8 text-xs w-[160px]">
                    <ArrowUpDown className="size-3 mr-1 text-muted-foreground/80" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {SORT_OPTIONS.map((s) => (
                      <SelectItem
                        key={s.value}
                        value={s.value}
                        className="text-foreground/90 text-xs focus:bg-foreground/5 focus:text-destructive"
                      >
                        {t(`sort.${s.key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* View toggle */}
                <div className="hidden sm:flex items-center rounded-md border border-border bg-card/80">
                  <button
                    onClick={() => setView("grid")}
                    className={`p-1.5 rounded-l-md transition-colors ${
                      view === "grid"
                        ? "bg-primary/20 text-destructive"
                        : "text-muted-foreground/80 hover:text-foreground/80"
                    }`}
                  >
                    <LayoutGrid className="size-4" />
                  </button>
                  <button
                    onClick={() => setView("list")}
                    className={`p-1.5 rounded-r-md transition-colors ${
                      view === "list"
                        ? "bg-primary/20 text-destructive"
                        : "text-muted-foreground/80 hover:text-foreground/80"
                    }`}
                  >
                    <List className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-[200px]">
              <Card className="border-border/60 bg-card/30 p-5">
                <FilterSidebar
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onReset={handleReset}
                  resultCount={total}
                />
              </Card>
            </div>
          </aside>

          {/* Auction grid/list */}
          <main className="flex-1 min-w-0">
            {/* Error state */}
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 mb-6 flex items-center gap-3">
                <AlertCircle className="size-5 text-destructive shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Failed to load auctions
                  </p>
                  <p className="text-xs text-destructive/70 mt-0.5">{error}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="ml-auto border-destructive/30 text-destructive hover:bg-destructive/20"
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div
                className={
                  view === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
                    : "flex flex-col gap-4"
                }
              >
                {Array.from({ length: 9 }).map((_, i) => (
                  <AuctionCardSkeleton key={i} view={view} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && auctions.length === 0 && (
              <EmptyState onReset={handleReset} />
            )}

            {/* Auction cards */}
            {!loading && !error && auctions.length > 0 && (
              <div
                className={
                  view === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
                    : "flex flex-col gap-4"
                }
              >
                {auctions.map((auction) => (
                  <AuctionCard key={auction.id} auction={auction} view={view} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && !error && totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="bg-card/80 border-border text-foreground/80 hover:bg-foreground/5 hover:text-destructive disabled:opacity-30"
                >
                  <ChevronLeft className="size-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Page{" "}
                  <span className="font-medium text-foreground/90">{page}</span>
                  {" "}of{" "}
                  <span className="font-medium text-foreground/90">{totalPages}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="bg-card/80 border-border text-foreground/80 hover:bg-foreground/5 hover:text-destructive disabled:opacity-30"
                >
                  Next
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
