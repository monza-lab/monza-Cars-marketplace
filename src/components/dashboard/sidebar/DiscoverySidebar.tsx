"use client"

import { useMemo } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { useCurrency } from "@/lib/CurrencyContext"
import { getBrandConfig, getSeriesConfig } from "@/lib/brandConfig"
import { Clock, Car, ChevronRight } from "lucide-react"
import { SafeImage } from "../cards/SafeImage"
import { timeLeft } from "../utils/timeLeft"
import { platformShort } from "../constants"
import { filterLiveSidebarAuctions, useLiveSidebarListings } from "./useLiveSidebarListings"
import type { Auction, Brand, LiveRegionTotals } from "../types"

interface DiscoverySidebarProps {
  auctions: Auction[]
  brands: Brand[]
  onSelectBrand: (brandSlug: string) => void
  onSelectFamily?: (familyName: string) => void
  activeBrandSlug?: string
  activeFamilyName?: string
  seriesCounts?: Record<string, number>
  seriesCountsByRegion?: {
    all: Record<string, number>
    US: Record<string, number>
    UK: Record<string, number>
    EU: Record<string, number>
    JP: Record<string, number>
  }
  liveRegionTotals?: LiveRegionTotals
}

export function DiscoverySidebar({
  auctions,
  brands,
  onSelectBrand,
  onSelectFamily,
  activeBrandSlug,
  activeFamilyName,
  seriesCounts,
  seriesCountsByRegion,
  liveRegionTotals: _liveRegionTotals,
}: DiscoverySidebarProps) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()
  const { formatPrice } = useCurrency()

  // Extract model families for the active brand (drill-down navigation)
  const activeBrandFamilies = useMemo(() => {
    if (!activeBrandSlug) return []
    const brandName = brands.find(b => b.slug === activeBrandSlug)?.name
    if (!brandName) return []

    const regionKey =
      selectedRegion === "US" ||
      selectedRegion === "UK" ||
      selectedRegion === "EU" ||
      selectedRegion === "JP"
        ? selectedRegion
        : "all"

    const brandSeries = getBrandConfig(brandName)?.series ?? []

    return brandSeries
      .map((series) => {
        const count =
          seriesCountsByRegion?.[regionKey]?.[series.id] ??
          (regionKey === "all" ? seriesCounts?.[series.id] : seriesCountsByRegion?.all?.[series.id]) ??
          seriesCounts?.[series.id] ??
          0
        return {
          name: series.label,
          slug: series.id,
          count,
          yearMin: series.yearRange[0],
          yearMax: series.yearRange[1],
        }
      })
      .sort((a, b) => {
        const orderA = getSeriesConfig(a.slug, brandName)?.order ?? 99
        const orderB = getSeriesConfig(b.slug, brandName)?.order ?? 99
        if (orderA !== orderB) return orderA - orderB
        return b.count - a.count
      })
  }, [activeBrandSlug, brands, seriesCounts, seriesCountsByRegion, selectedRegion])

  const activeFamilyCount = useMemo(() => {
    if (!activeFamilyName) return null

    const normalized = activeFamilyName.toLowerCase()
    const family = activeBrandFamilies.find((entry) => {
      const familySlug = entry.slug.toLowerCase()
      return entry.name === activeFamilyName || familySlug === normalized || normalized.startsWith(familySlug)
    })

    return family?.count ?? null
  }, [activeBrandFamilies, activeFamilyName])

  const seedKey = `${selectedRegion ?? "all"}|${activeFamilyName ?? "all"}`
  const seedAuctions = useMemo(
    () => filterLiveSidebarAuctions(auctions, { activeFamilyName, pageSize: 8 }),
    [auctions, activeFamilyName],
  )
  const {
    liveAuctions,
    liveCount,
    scrollRootRef,
    sentinelRef,
    isLoading,
    isFetchingMore,
    hasMore,
  } = useLiveSidebarListings({
    seedAuctions,
    seedKey,
    make: auctions[0]?.make ?? "Porsche",
    activeFamilyName,
    region: selectedRegion,
    pageSize: 8,
  })

  const timeLabels = {
    ended: t("asset.ended"),
    day: t("asset.timeDay"),
    hour: t("asset.timeHour"),
    minute: t("asset.timeMin"),
  }

  return (
    <div className="h-full flex flex-col border-r border-border overflow-hidden">

      {/* ═══ TOP HALF: FIND YOUR CAR ═══ */}
      <div className="flex-1 min-h-0 flex flex-col">

        {/* Section header */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-1.5">
          <span className="text-[9px] font-semibold tracking-[0.25em] uppercase text-muted-foreground">
            {t("sidebar.popular")}
          </span>
          <span className="text-[9px] tabular-nums text-muted-foreground">
            {t("sidebar.brandsCount", { count: brands.length })}
          </span>
        </div>

        {/* Brands list with inline families (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {brands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center px-4">
              <p className="text-[11px] text-muted-foreground">{t("sidebar.noResults")}</p>
            </div>
          ) : (
            brands.map((brand) => {
              const isActive = activeBrandSlug === brand.slug
              return (
                <div key={brand.slug}>
                  <button
                    onClick={() => onSelectBrand(brand.slug)}
                    className={`w-full text-left px-4 py-2.5 border-b border-border/50 transition-all group ${
                      isActive
                        ? "bg-primary/6 border-l-2 border-l-primary"
                        : "hover:bg-foreground/2 border-l-2 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[12px] font-semibold transition-colors ${
                        isActive ? "text-primary" : "text-foreground group-hover:text-primary"
                      }`}>
                        {brand.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {brand.carCount}
                        </span>
                        <ChevronRight className={`size-3 transition-all ${
                          isActive ? "text-primary rotate-90" : "text-muted-foreground group-hover:text-muted-foreground"
                        }`} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {formatPrice(brand.priceMin)} – {formatPrice(brand.priceMax)}
                      </span>
                      <span className="text-[9px] text-positive font-medium">
                        {brand.avgTrend}
                      </span>
                    </div>
                  </button>

                  {/* Families drill-down (shown when brand is active) */}
                  {isActive && activeBrandFamilies.length > 0 && (
                    <div className="bg-foreground/2 border-b border-border/50">
                      <div className="px-4 pl-6 py-1.5">
                        <span className="text-[8px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                          {t("sidebar.families")}
                        </span>
                      </div>
                      {activeBrandFamilies.map((family) => {
                        const familySlug = family.name.toLowerCase()
                        const isFamilyActive = activeFamilyName === family.name || activeFamilyName?.toLowerCase().startsWith(familySlug)
                        return (
                        <button
                          key={family.name}
                          onClick={() => onSelectFamily?.(family.name)}
                          className={`w-full flex items-center justify-between px-4 pl-7 py-2 transition-colors group/fam ${
                            isFamilyActive
                              ? "bg-primary/8 border-l-2 border-l-primary"
                              : "hover:bg-foreground/3 border-l-2 border-l-transparent"
                          }`}
                        >
                          <span className={`text-[11px] font-medium transition-colors ${
                            isFamilyActive ? "text-primary" : "text-muted-foreground group-hover/fam:text-primary"
                          }`}>
                            {family.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] tabular-nums text-primary">
                              {family.count}
                            </span>
                            <span className="text-[8px] text-muted-foreground">
                              {family.yearMin === family.yearMax
                                ? `${family.yearMin}`
                                : `${family.yearMin}–${family.yearMax}`}
                            </span>
                          </div>
                        </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ═══ BOTTOM HALF: LIVE BIDS ═══ */}
      <div className="flex-1 min-h-0 flex flex-col border-t border-border">

        {/* Live header */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-card">
          <div className="size-2 rounded-full bg-positive animate-pulse" />
          <span className="text-[9px] font-semibold tracking-[0.25em] uppercase text-muted-foreground">
            {t("sidebar.liveNow")}
          </span>
          <span className="text-[10px] font-display font-medium text-primary">
            {activeFamilyCount ?? liveCount}
          </span>
        </div>

        {/* Live auctions list (scrollable) */}
        <div ref={scrollRootRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {isLoading && liveAuctions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center px-4">
              <p className="text-[11px] text-muted-foreground">{t("sidebar.noLiveListings")}</p>
            </div>
          ) : liveAuctions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center px-4">
              <p className="text-[11px] text-muted-foreground">{t("sidebar.noLiveListings")}</p>
            </div>
          ) : (
            <>
              {liveAuctions.map((auction) => {
              const isEndingSoon = auction.status === "ENDING_SOON"
              const remaining = timeLeft(auction.endTime, timeLabels)

              return (
                <Link
                  key={auction.id}
                  href={`/cars/${auction.make.toLowerCase().replace(/\s+/g, "-")}/${auction.id}`}
                  className="group relative block px-4 py-2.5 border-b border-border/50 hover:bg-foreground/2 transition-all"
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="relative w-14 h-11 rounded-lg overflow-hidden shrink-0 bg-card">
                      <SafeImage
                        src={auction.images[0]}
                        alt={auction.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        fallback={
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Car className="size-3.5 text-muted-foreground" />
                          </div>
                        }
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {auction.year} {auction.make} {auction.model}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[12px] font-display font-medium text-primary">
                          {formatPrice(auction.currentBid)}
                        </span>
                        <div className="flex items-center gap-1 ml-auto">
                          <Clock className={`size-2.5 ${isEndingSoon ? "text-destructive" : "text-muted-foreground"}`} />
                          <span className={`text-[9px] tabular-nums font-medium ${
                            isEndingSoon ? "text-destructive" : "text-muted-foreground"
                          }`}>
                            {remaining}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] text-muted-foreground">
                          {platformShort[auction.platform] || auction.platform}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
              })}
              {hasMore && (
                <div ref={sentinelRef} className="h-20 flex items-center justify-center">
                  {isFetchingMore && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
