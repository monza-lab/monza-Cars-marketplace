"use client"

import { useMemo } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { Shield, ChevronRight } from "lucide-react"
import { extractSeries, getSeriesThesis } from "@/lib/brandConfig"
import { computeRegionalValFromAuctions } from "../utils/valuation"
import { RegionalValuationSection } from "./shared/RegionalValuation"
import { RecentSalesSection } from "./shared/RecentSales"
import { MarketDepthSection } from "./shared/MarketDepth"
import { OwnershipCostSection } from "./shared/OwnershipCost"
import type { PorscheFamily, Auction } from "../types"

export function FamilyContextPanel({ family, auctions, allFamilies }: { family: PorscheFamily; auctions: Auction[]; allFamilies: PorscheFamily[] }) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  const thesis = getSeriesThesis(family.slug, "Porsche") || "A compelling Porsche family with strong collector appeal."

  // Get auctions for this family — all derived data depends on this
  const familyAuctions = useMemo(() => {
    const familyKey = family.slug
    return auctions.filter(a => {
      const series = extractSeries(a.model, a.year, a.make || "Porsche", a.title).toLowerCase()
      return series === familyKey
    })
  }, [auctions, family.slug])

  // ─── DYNAMIC: Valuation by Market from real median sold prices per region ───
  const regionalVal = useMemo(() => computeRegionalValFromAuctions(familyAuctions), [familyAuctions])

  // ─── DYNAMIC: Market Depth from real auction counts ───
  const depth = useMemo(() => {
    const count = familyAuctions.length
    const withBids = familyAuctions.filter(a => a.currentBid > 0)
    const ended = familyAuctions.filter(a => new Date(a.endTime).getTime() < Date.now())
    const sold = ended.filter(a => a.currentBid > 0)
    const sellThrough = ended.length > 0 ? Math.round((sold.length / ended.length) * 100) : 85
    const avgDays = ended.length > 0
      ? Math.round(ended.reduce((sum, a) => {
          const created = new Date(a.endTime).getTime() - (7 * 86400000) // estimate listing duration
          return sum + (new Date(a.endTime).getTime() - created) / 86400000
        }, 0) / ended.length)
      : 14
    const demandScore = Math.min(10, Math.max(1, Math.round(
      (count >= 20 ? 3 : count >= 10 ? 2 : 1) +
      (withBids.length / Math.max(count, 1)) * 4 +
      (sellThrough / 100) * 3
    )))
    return {
      auctionsPerYear: Math.max(count * 4, 12), // annualize from current listings
      avgDaysToSell: avgDays,
      sellThroughRate: sellThrough,
      demandScore,
    }
  }, [familyAuctions])

  // ─── DYNAMIC: Ownership Cost scaled by family avg price ───
  const ownershipCost = useMemo(() => {
    const withBids = familyAuctions.filter(a => a.currentBid > 0)
    const avgPrice = withBids.length > 0
      ? withBids.reduce((sum, a) => sum + a.currentBid, 0) / withBids.length
      : (family.priceMin + family.priceMax) / 2
    // Scale: base Porsche costs, adjusted by price tier
    // Under $100K = 0.7x, $100-250K = 1x, $250-500K = 1.3x, $500K+ = 1.6x
    const scale = avgPrice < 100_000 ? 0.7 : avgPrice < 250_000 ? 1.0 : avgPrice < 500_000 ? 1.3 : 1.6
    return {
      insurance: Math.round(8500 * scale),
      storage: Math.round(6000 * scale),
      maintenance: Math.round(8000 * scale),
    }
  }, [familyAuctions, family.priceMin, family.priceMax])

  // Recent sales from this family
  const recentSales = useMemo(() => {
    return familyAuctions
      .filter(a => a.currentBid > 0)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
      .slice(0, 5)
      .map(a => ({
        title: `${a.year} ${a.model}`,
        price: a.currentBid,
        platform: a.platform?.replace(/_/g, " ") || "Listing",
        date: new Date(a.endTime).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }))
  }, [familyAuctions])

  const yearLabel = family.yearMin === family.yearMax
    ? `${family.yearMin}`
    : `${family.yearMin}–${family.yearMax}`

  return (
    <div className="h-full flex flex-col overflow-y-auto no-scrollbar">
      <div>
        {/* 1. FAMILY OVERVIEW */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.overview")}
            </span>
          </div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-primary mb-1">
            Porsche
          </p>
          <h3 className="text-[18px] font-bold text-foreground tracking-tight mb-2">
            {family.name}
          </h3>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {thesis}
          </p>
        </div>

        {/* 2. KEY METRICS */}
        <div className="px-5 py-3 border-b border-border bg-primary/3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.grade")}</span>
              <p className={`text-[16px] font-bold ${
                family.topGrade === "AAA" ? "text-positive" : "text-primary"
              }`}>{family.topGrade}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.minPrice")}</span>
              <p className="text-[13px] font-mono font-semibold text-foreground">{formatPriceForRegion(family.priceMin, selectedRegion)}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.maxPrice")}</span>
              <p className="text-[13px] font-mono font-semibold text-foreground">{formatPriceForRegion(family.priceMax, selectedRegion)}</p>
            </div>
          </div>
        </div>

        {/* 3. VALUATION BY MARKET — shared section */}
        <RegionalValuationSection regionalVal={regionalVal} />

        {/* 4. RECENT SALES — shared section */}
        <RecentSalesSection sales={recentSales} />

        {/* 5. LIQUIDITY & MARKET DEPTH — shared section */}
        <MarketDepthSection depth={depth} />

        {/* 6. OWNERSHIP COST — shared section */}
        <OwnershipCostSection ownershipCost={ownershipCost} />

      </div>

      {/* CTA — pinned bottom */}
      <div className="shrink-0 px-5 py-3 border-t border-border">
        <Link
          href={`/cars/porsche?family=${encodeURIComponent(family.slug)}`}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground hover:bg-primary/80 transition-all"
        >
          Explore {family.name} Collection
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}
