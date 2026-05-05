"use client"

import { useMemo } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useCurrency } from "@/lib/CurrencyContext"
import { Shield, Award, ChevronRight } from "lucide-react"
import { getBrandConfig } from "@/lib/brandConfig"
import { mockWhyBuy } from "../constants"
import { listingPriceUsd, formatUsdValue } from "../utils/valuation"
import { RegionalValuationSection } from "./shared/RegionalValuation"
import { RecentSalesSection } from "./shared/RecentSales"
import { MarketDepthSection } from "./shared/MarketDepth"
import type { Brand, Auction } from "../types"
import type { RegionalValByFamily } from "@/lib/dashboardCache"

export function BrandContextPanel({ brand, allBrands, auctions, regionalValByFamily }: { brand: Brand; allBrands: Brand[]; auctions: Auction[]; regionalValByFamily?: RegionalValByFamily }) {
  const t = useTranslations("dashboard")
  const { formatPrice, rates } = useCurrency()
  const brandAuctions = useMemo(() =>
    auctions.filter(a => a.make === brand.name),
    [auctions, brand.name]
  )

  const whyBuy = getBrandConfig(brand.name)?.defaultThesis || mockWhyBuy[brand.name] || mockWhyBuy["default"]
  const dominantFamily = useMemo(() => {
    const counts = new Map<string, number>()
    for (const auction of brandAuctions) {
      if (!auction.family) continue
      counts.set(auction.family, (counts.get(auction.family) ?? 0) + 1)
    }

    let best: [string, number] | null = null
    for (const entry of counts.entries()) {
      if (!best || entry[1] > best[1]) best = entry
    }

    return best?.[0] ?? null
  }, [brandAuctions])
  const regionalVal = useMemo(
    () => (dominantFamily ? regionalValByFamily?.[dominantFamily] ?? {} : {}),
    [regionalValByFamily, dominantFamily],
  )
  const recentSales = useMemo(() => {
    return brandAuctions
      .filter(a => (a.price > 0 || a.currentBid > 0))
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
      .slice(0, 5)
      .map(a => ({
        title: a.title,
        price: listingPriceUsd(a, rates),
        platform: a.platform?.replace(/_/g, " ") || "Listing",
        date: new Date(a.endTime).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }))
  }, [brandAuctions])
  const depth = useMemo(() => {
    const count = brandAuctions.length
    if (count === 0) {
      const config = getBrandConfig(brand.name)
      return config?.marketDepth ?? { auctionsPerYear: 15, avgDaysToSell: 20, sellThroughRate: 80, demandScore: 6 }
    }
    const withPrice = brandAuctions.filter(a => listingPriceUsd(a, rates) > 0)
    const ended = brandAuctions.filter(a => new Date(a.endTime).getTime() < Date.now())
    const sold = ended.filter(a => a.price > 0 || a.currentBid > 0)
    const sellThrough = ended.length > 0 ? Math.round((sold.length / ended.length) * 100) : 85
    const avgDays = ended.length > 0
      ? Math.round(ended.reduce((sum, a) => {
          const created = new Date(a.endTime).getTime() - (7 * 86400000)
          return sum + (new Date(a.endTime).getTime() - created) / 86400000
        }, 0) / ended.length)
      : 14
    const demandScore = Math.min(10, Math.max(1, Math.round(
      (count >= 20 ? 3 : count >= 10 ? 2 : 1) +
      (withPrice.length / Math.max(count, 1)) * 4 +
      (sellThrough / 100) * 3
    )))
    return {
      auctionsPerYear: Math.max(count * 4, 12),
      avgDaysToSell: avgDays,
      sellThroughRate: sellThrough,
      demandScore,
    }
  }, [brandAuctions, brand.name])

  // Median sold across brand's auctions (USD). Used for the Median Sold metric.
  const medianSoldUsd = useMemo(() => {
    const prices = brandAuctions
      .map(a => listingPriceUsd(a, rates))
      .filter(p => p > 0)
      .sort((a, b) => a - b)
    if (prices.length === 0) return null
    const mid = Math.floor(prices.length / 2)
    return prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2
  }, [brandAuctions, rates])

  // Similar brands (fallback: same price tier, different slug)
  const similarBrands = allBrands
    .filter(b => b.slug !== brand.slug)
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
              {/* TODO: switch to t("brandContext.medianSold") after Task 15 adds i18n key */}
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Median Sold</span>
              <p className="text-[16px] font-bold text-foreground">
                {formatUsdValue(medianSoldUsd)}
              </p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.minPrice")}</span>
              <p className="text-[13px] tabular-nums font-semibold text-foreground">{formatPrice(brand.priceMin)}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.maxPrice")}</span>
              <p className="text-[13px] tabular-nums font-semibold text-foreground">{formatPrice(brand.priceMax)}</p>
            </div>
          </div>
        </div>

        {/* 3. VALUATION BY MARKET — shared section */}
        <RegionalValuationSection regionalVal={regionalVal} />

        {/* 4. RECENT SALES — shared section */}
        <RecentSalesSection sales={recentSales} />

        {/* 5. LIQUIDITY & MARKET DEPTH — shared section */}
        <MarketDepthSection depth={depth} />

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
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {formatPrice(b.priceMin)}–{formatPrice(b.priceMax)}
                    </span>
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
