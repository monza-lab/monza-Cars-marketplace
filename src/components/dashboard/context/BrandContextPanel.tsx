"use client"

import { useMemo } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { Shield, Award, ChevronRight } from "lucide-react"
import { getBrandConfig } from "@/lib/brandConfig"
import { mockWhyBuy } from "../constants"
import { computeRegionalValFromAuctions } from "../utils/valuation"
import { RegionalValuationSection } from "./shared/RegionalValuation"
import { RecentSalesSection } from "./shared/RecentSales"
import { MarketDepthSection } from "./shared/MarketDepth"
import { OwnershipCostSection } from "./shared/OwnershipCost"
import type { Brand, Auction } from "../types"

export function BrandContextPanel({ brand, allBrands, auctions }: { brand: Brand; allBrands: Brand[]; auctions: Auction[] }) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()
  const brandAuctions = useMemo(() =>
    auctions.filter(a => a.make === brand.name),
    [auctions, brand.name]
  )

  const whyBuy = getBrandConfig(brand.name)?.defaultThesis || mockWhyBuy[brand.name] || mockWhyBuy["default"]
  // Compute regional fair values from real median sold prices per region
  const regionalVal = useMemo(() => computeRegionalValFromAuctions(brandAuctions), [brandAuctions])
  const recentSales = useMemo(() => {
    return brandAuctions
      .filter(a => a.currentBid > 0)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
      .slice(0, 5)
      .map(a => ({
        title: a.title,
        price: a.currentBid,
        platform: a.platform?.replace(/_/g, " ") || "Listing",
        date: new Date(a.endTime).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }))
  }, [brandAuctions])
  const ownershipCost = useMemo(() => {
    const config = getBrandConfig(brand.name)
    const base = config?.ownershipCosts ?? { insurance: 8000, storage: 5000, maintenance: 7000 }
    const withBids = brandAuctions.filter(a => a.currentBid > 0)
    const avgPrice = withBids.length > 0
      ? withBids.reduce((sum, a) => sum + a.currentBid, 0) / withBids.length
      : (brand.priceMin + brand.priceMax) / 2
    const scale = avgPrice < 100_000 ? 0.7 : avgPrice < 250_000 ? 1.0 : avgPrice < 500_000 ? 1.3 : 1.6
    return {
      insurance: Math.round(base.insurance * scale),
      storage: Math.round(base.storage * scale),
      maintenance: Math.round(base.maintenance * scale),
    }
  }, [brandAuctions, brand.name, brand.priceMin, brand.priceMax])
  const depth = useMemo(() => {
    const count = brandAuctions.length
    if (count === 0) {
      const config = getBrandConfig(brand.name)
      return config?.marketDepth ?? { auctionsPerYear: 15, avgDaysToSell: 20, sellThroughRate: 80, demandScore: 6 }
    }
    const withBids = brandAuctions.filter(a => a.currentBid > 0)
    const ended = brandAuctions.filter(a => new Date(a.endTime).getTime() < Date.now())
    const sold = ended.filter(a => a.currentBid > 0)
    const sellThrough = ended.length > 0 ? Math.round((sold.length / ended.length) * 100) : 85
    const avgDays = ended.length > 0
      ? Math.round(ended.reduce((sum, a) => {
          const created = new Date(a.endTime).getTime() - (7 * 86400000)
          return sum + (new Date(a.endTime).getTime() - created) / 86400000
        }, 0) / ended.length)
      : 14
    const demandScore = Math.min(10, Math.max(1, Math.round(
      (count >= 20 ? 3 : count >= 10 ? 2 : 1) +
      (withBids.length / Math.max(count, 1)) * 4 +
      (sellThrough / 100) * 3
    )))
    return {
      auctionsPerYear: Math.max(count * 4, 12),
      avgDaysToSell: avgDays,
      sellThroughRate: sellThrough,
      demandScore,
    }
  }, [brandAuctions, brand.name])

  // Similar brands (same grade tier)
  const similarBrands = allBrands
    .filter(b => b.topGrade === brand.topGrade && b.slug !== brand.slug)
    .slice(0, 3)

  return (
    <div className="h-full flex flex-col overflow-y-auto no-scrollbar">
      {/* BRAND CONTEXT — starts directly with brand overview */}
      <div>
        {/* 1. BRAND OVERVIEW */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.overview")}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {whyBuy}
          </p>
        </div>

        {/* 2. PRICE SUMMARY */}
        <div className="px-5 py-3 border-b border-border bg-primary/3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.grade")}</span>
              <p className={`text-[16px] font-bold ${
                brand.topGrade === "AAA" ? "text-positive" : "text-primary"
              }`}>{brand.topGrade}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.minPrice")}</span>
              <p className="text-[13px] font-mono font-semibold text-foreground">{formatPriceForRegion(brand.priceMin, selectedRegion)}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.maxPrice")}</span>
              <p className="text-[13px] font-mono font-semibold text-foreground">{formatPriceForRegion(brand.priceMax, selectedRegion)}</p>
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

        {/* 7. SIMILAR BRANDS */}
        {similarBrands.length > 0 && (
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {t("brandContext.similarBrands")}
              </span>
            </div>
            <div className="space-y-1.5">
              {similarBrands.map((b) => (
                <Link
                  key={b.slug}
                  href={`/cars/${b.slug}`}
                  className="flex items-center justify-between py-1.5 rounded-lg hover:bg-foreground/3 transition-colors px-1 -mx-1 group"
                >
                  <span className="text-[11px] font-medium text-foreground group-hover:text-primary transition-colors">
                    {b.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {formatPriceForRegion(b.priceMin, selectedRegion)}–{formatPriceForRegion(b.priceMax, selectedRegion)}
                    </span>
                    <span className={`text-[9px] font-bold ${
                      b.topGrade === "AAA" ? "text-positive" : "text-primary"
                    }`}>{b.topGrade}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA — pinned bottom */}
      <div className="shrink-0 px-5 py-3 border-t border-border">
        <Link
          href={`/cars/${brand.slug}`}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground hover:bg-primary/80 transition-all"
        >
          {t("brandContext.explore", { brand: brand.name })}
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}
