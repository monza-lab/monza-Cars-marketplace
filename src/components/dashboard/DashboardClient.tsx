"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { Globe } from "lucide-react"
import { filterAuctionsForRegion } from "./platformMapping"
import type { Auction, LiveRegionTotals } from "./types"
import { aggregateBrands, aggregateFamilies } from "./utils/aggregation"
import { FamilyCard } from "./cards/FamilyCard"
import { MobileRegionPills } from "./mobile/MobileRegionPills"
import { MobileHeroBrand } from "./mobile/MobileHeroBrand"
import { MobileBrandRow } from "./mobile/MobileBrandRow"
import { MobileLiveAuctions } from "./mobile/MobileLiveAuctions"
import { DiscoverySidebar } from "./sidebar/DiscoverySidebar"
import { FamilyContextPanel } from "./context/FamilyContextPanel"
import { BrandContextPanel } from "./context/BrandContextPanel"

// ─── MAIN COMPONENT ───
export function DashboardClient({ auctions, liveRegionTotals, liveNowTotal, seriesCounts }: { auctions: Auction[]; liveRegionTotals?: LiveRegionTotals; liveNowTotal?: number; seriesCounts?: Record<string, number> }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const { selectedRegion } = useRegion()
  const t = useTranslations("dashboard")
  const feedRef = useRef<HTMLDivElement>(null)

  // Filter auctions by region (maps to source platform), then aggregate
  const filteredAuctions = useMemo(() => {
    const regionFiltered = filterAuctionsForRegion(auctions, selectedRegion)
    // Hard requirement: only active listings are ever displayed.
    return regionFiltered.filter(
      a => a.status === "ACTIVE" || a.status === "ENDING_SOON"
    )
  }, [auctions, selectedRegion])

  const liveNowCount = useMemo(() => {
    if (!liveRegionTotals) {
      return filteredAuctions.filter(a => ["ACTIVE", "ENDING_SOON", "LIVE"].includes(a.status)).length
    }

    if (!selectedRegion) {
      return liveRegionTotals.all
    }

    return liveRegionTotals[selectedRegion as keyof LiveRegionTotals] ?? liveRegionTotals.all
  }, [filteredAuctions, liveRegionTotals, selectedRegion])

  // Aggregate filtered auctions into brands
  const brands = useMemo(() => aggregateBrands(filteredAuctions, liveNowCount), [filteredAuctions, liveNowCount])

  // Aggregate into Porsche families for the family-based landing scroll
  const porscheFamilies = useMemo(() => aggregateFamilies(filteredAuctions, seriesCounts), [filteredAuctions, seriesCounts])

  // Reset scroll position when region changes
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0 })
  }, [selectedRegion])

  const safeCurrentIndex = currentIndex >= 0 && currentIndex < brands.length ? currentIndex : 0
  const selectedBrand = brands[safeCurrentIndex] || brands[0]
  // Family-level index for the scroll (bounded to porscheFamilies array)
  const safeFamilyIndex = currentIndex >= 0 && currentIndex < porscheFamilies.length ? currentIndex : 0
  const activeFamily = porscheFamilies[safeFamilyIndex]
  const activeFamilyName = activeFamily?.name

  // Card height = 100vh - 80px
  const getCardHeight = () => typeof window !== "undefined" ? window.innerHeight - 80 : 800

  // Handle scroll snap to update current index (Desktop) — synced with family cards
  useEffect(() => {
    const container = feedRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop
      const slideHeight = getCardHeight()
      const newIndex = Math.round(scrollTop / slideHeight)
      if (newIndex !== safeFamilyIndex && newIndex >= 0 && newIndex < porscheFamilies.length) {
        setCurrentIndex(newIndex)
      }
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [porscheFamilies.length, safeFamilyIndex])

  // Scroll to index when nav is clicked
  const scrollToIndex = (index: number) => {
    const container = feedRef.current
    if (!container) return
    const slideHeight = getCardHeight()
    container.scrollTo({ top: slideHeight * index, behavior: "smooth" })
    setCurrentIndex(index)
  }

  // Scroll to brand by slug (from quick access)
  const scrollToBrand = (brandSlug: string) => {
    const index = brands.findIndex(b => b.slug === brandSlug)
    if (index >= 0) {
      scrollToIndex(index)
    }
  }

  // Scroll to family by name (from sidebar family drill-down)
  // Sidebar uses raw keys like "718", but porscheFamilies uses display names like "718 Cayman/Boxster"
  // Match by slug (raw key, lowercased) or by name as fallback
  const scrollToFamily = (familyName: string) => {
    const slug = familyName.toLowerCase()
    const index = porscheFamilies.findIndex(f => f.slug === slug || f.name === familyName)
    if (index >= 0) {
      scrollToIndex(index)
    }
  }

  if (!selectedBrand) return null

  return (
    <>
      {/* ═══ MOBILE LAYOUT — Vertical Scrollable Feed ═══ */}
      <div className="md:hidden min-h-[100dvh] w-full bg-background pt-14">
        {/* Sticky region pills */}
        <MobileRegionPills />

        {/* Scrollable vertical feed */}
        <div className="pb-24">
          {brands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60dvh] px-8 text-center">
              <Globe className="size-8 text-muted-foreground mb-3" />
              <p className="text-[14px] text-muted-foreground">{t("mobileFeed.noBrands")}</p>
            </div>
          ) : (
            <>
              {/* Hero: first brand */}
              <MobileHeroBrand brand={brands[0]} />

              {/* Section: All Brands */}
              {brands.length > 1 && (
                <div className="mt-2">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                      {t("mobileFeed.brands")}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">{brands.length}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {brands.slice(1).map((brand) => (
                      <MobileBrandRow key={brand.slug} brand={brand} />
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Live Auctions */}
              <MobileLiveAuctions auctions={filteredAuctions} totalLiveCount={liveNowCount} />
            </>
          )}
        </div>
      </div>

      {/* ═══ DESKTOP LAYOUT (3-column) ═══ */}
      <div className="hidden md:flex h-[100dvh] w-full flex-col bg-background overflow-hidden pt-[80px]">
        {/* 3-COLUMN LAYOUT */}
        <div className="flex-1 min-h-0 grid grid-cols-[22%_1fr_28%] grid-rows-[1fr] overflow-hidden">
          {/* COLUMN A: DISCOVERY SIDEBAR (22%) */}
            <DiscoverySidebar
              auctions={filteredAuctions}
              brands={brands}
              onSelectBrand={scrollToBrand}
              onSelectFamily={scrollToFamily}
              activeBrandSlug={selectedBrand?.slug}
              activeFamilyName={activeFamilyName}
              seriesCounts={seriesCounts}
              liveRegionTotals={liveRegionTotals}
            />

          {/* COLUMN B: FAMILY FEED (50%) — scroll through Porsche families */}
          <div
            ref={feedRef}
            className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar scroll-smooth"
          >
            {porscheFamilies.map((family, idx) => (
              <FamilyCard key={family.slug} family={family} index={idx} />
            ))}
          </div>

          {/* COLUMN C: CONTEXT PANEL (28%) — synced with active family in scroll */}
          <div className="h-full overflow-hidden border-l border-primary/8 bg-card">
            {activeFamily ? (
              <FamilyContextPanel
                key={activeFamily.slug}
                family={activeFamily}
                auctions={filteredAuctions}
                allFamilies={porscheFamilies}
              />
            ) : (
              <BrandContextPanel brand={selectedBrand} allBrands={brands} auctions={filteredAuctions} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
