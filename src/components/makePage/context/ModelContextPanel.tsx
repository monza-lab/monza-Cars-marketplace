"use client"

import { useMemo } from "react"
import { Link } from "@/i18n/navigation"
import {
  Shield,
  Globe,
  DollarSign,
  Gauge,
  Award,
  MessageCircle,
  FileText,
  ChevronRight,
} from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { useRegion } from "@/lib/RegionContext"
import { formatRegionalPrice as fmtRegional } from "@/lib/regionPricing"
import { useCurrency } from "@/lib/CurrencyContext"
import { useLocale, useTranslations } from "next-intl"
import {
  extractFamily,
  aggregateRegionalPricing,
  findBestRegion,
  deriveModelDepth,
  type Model,
} from "@/lib/makePageHelpers"
import {
  platformLabels,
  regionLabels,
} from "@/lib/makePageConstants"
import { formatUsdValue } from "@/components/dashboard/utils/valuation"

export function ModelContextPanel({
  model,
  make,
  cars,
  allCars,
  allModels,
  onOpenAdvisor,
}: {
  model: Model
  make: string
  cars: CollectorCar[]
  allCars: CollectorCar[]
  allModels: Model[]
  onOpenAdvisor: () => void
}) {
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const locale = useLocale()
  const { effectiveRegion } = useRegion()
  const { formatPrice, convertFromUsd, currencySymbol, rates } = useCurrency()

  // All cars of this model family (unfiltered) for regional analysis
  const allModelCars = allCars.filter(c => extractFamily(c.model, c.year, make) === model.name)
  const regionalPricing = useMemo(() => aggregateRegionalPricing(allModelCars, rates), [allModelCars, rates])

  // Model-specific thesis (from the representative car's real data)
  const modelThesis = model.representativeCar.thesis

  const brandAvgPrice = allCars.length > 0 ? allCars.reduce((s, c) => s + c.currentBid, 0) / allCars.length : 1
  const scaleFactor = brandAvgPrice > 0 ? model.avgPrice / brandAvgPrice : 1

  // Determine best-value region
  const bestRegion = regionalPricing ? findBestRegion(regionalPricing) : null

  // Market depth data
  // Model-specific liquidity (derived from real car data)
  const depth = deriveModelDepth(allModelCars)

  // Similar models (same brand, different model)
  const similarModels = allModels
    .filter(m => m.slug !== model.slug)
    .slice(0, 3)

  // Recent sales (use actual car data from this model)
  const recentSales = allModelCars
    .filter(c => c.status === "ENDED")
    .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
    .slice(0, 4)

  // Regional price bar max value for relative widths
  const maxRegionalUsd = regionalPricing
    ? Math.max(...(["US", "EU", "UK", "JP"] as const).map(r =>
      (regionalPricing[r].low + regionalPricing[r].high) / 2
    ))
    : 1

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">

        {/* 1. MODEL OVERVIEW */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Investment Analysis
            </span>
          </div>
          <h2 className="text-[14px] font-display font-normal text-foreground leading-tight">
            {make} {model.representativeCar.model}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
            <span>{model.carCount} cars</span>
            <span>·</span>
            <span>{model.years}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground mt-2">
            {modelThesis}
          </p>
        </div>

        {/* 2. PRICE SUMMARY */}
        <div className="px-5 py-3 border-b border-border bg-primary/3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Median Sold</span>
              <p className="text-[16px] font-bold text-foreground">
                {formatUsdValue(model.avgPrice)}
              </p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Min Price</span>
              <p className="text-[13px] tabular-nums font-semibold text-foreground">{formatPrice(model.priceMin)}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Max Price</span>
              <p className="text-[13px] tabular-nums font-semibold text-foreground">{formatPrice(model.priceMax)}</p>
            </div>
          </div>
        </div>

        {/* 3. VALUATION BY MARKET — with visual bars */}
        {regionalPricing && (
          <div className="px-5 py-4 border-b border-border">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-primary" />
                <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                  Valuation by Market
                </span>
              </div>
              <p className="text-[8px] text-muted-foreground mt-1 ml-6">Fair value range by region</p>
            </div>
            <div className="space-y-2.5">
              {(["US", "UK", "EU", "JP"] as const).map(region => {
                const pricing = regionalPricing[region]
                const isBest = bestRegion === region
                const isSelected = region === effectiveRegion
                const usdAvg = (pricing.low + pricing.high) / 2
                const barWidth = (usdAvg / maxRegionalUsd) * 100
                return (
                  <div key={region} className={isSelected ? "rounded-lg bg-primary/4 -mx-2 px-2 py-1.5" : ""}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px]">{regionLabels[region].flag}</span>
                        <span className={`text-[11px] font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{region}</span>
                        {isBest && (
                          <span className="text-[8px] font-bold text-positive tracking-wide">BEST</span>
                        )}
                        {isSelected && (
                          <span className="text-[8px] font-bold text-primary tracking-wide">YOUR MARKET</span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[11px] tabular-nums font-semibold text-foreground">
                          {fmtRegional(convertFromUsd(pricing.low), currencySymbol)}
                        </span>
                        <span className="text-[9px] text-muted-foreground">→</span>
                        <span className={`text-[11px] tabular-nums font-semibold ${isBest ? "text-positive" : "text-primary"}`}>
                          {fmtRegional(convertFromUsd(pricing.high), currencySymbol)}
                        </span>
                      </div>
                    </div>
                    {region !== effectiveRegion && (
                      <div className="flex justify-end mb-1">
                        <span className="text-[9px] tabular-nums text-muted-foreground">
                          ≈ {formatPrice(pricing.high)}
                        </span>
                      </div>
                    )}
                    <div className="h-[6px] rounded-full bg-foreground/4 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isBest ? "bg-gradient-to-r from-emerald-400/30 to-emerald-400/60" : isSelected ? "bg-gradient-to-r from-primary/40 to-primary/70" : "bg-gradient-to-r from-primary/25 to-primary/50"}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 4. RECENT SALES */}
        {recentSales.length > 0 && (
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Recent Sales
              </span>
            </div>
            <div className="space-y-2">
              {recentSales.map((sale) => {
                const platform = platformLabels[sale.platform]
                return (
                  <div key={sale.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-muted-foreground truncate">{sale.title}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {platform?.short || sale.platform} · {regionLabels[sale.region]?.flag} {sale.region}
                      </p>
                    </div>
                    <span className="text-[12px] tabular-nums font-semibold text-foreground shrink-0">
                      {formatPrice(sale.currentBid)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 5. LIQUIDITY & MARKET DEPTH */}
        <div className="px-5 py-4 border-b border-border bg-primary/3">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Liquidity & Market Depth
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Auctions / Year</span>
              <span className="text-[12px] tabular-nums font-semibold text-foreground">{depth.auctionsPerYear}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Avg Days to Sell</span>
              <span className="text-[12px] tabular-nums font-semibold text-foreground">{depth.avgDaysToSell}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Sell-Through Rate</span>
              <span className="text-[12px] tabular-nums font-semibold text-positive">{depth.sellThroughRate}%</span>
            </div>
            {/* Demand score visual */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-muted-foreground">Demand Score</span>
                <span className="text-[12px] font-display font-medium text-primary">{depth.demandScore}/10</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-[6px] flex-1 rounded-sm ${i < depth.demandScore ? "bg-primary/50" : "bg-foreground/4"
                      }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 6. SIMILAR MODELS */}
        {similarModels.length > 0 && (
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Other {make} Models
              </span>
            </div>
            <div className="space-y-1.5">
              {similarModels.map((m) => (
                <div
                  key={m.slug}
                  className="flex items-center justify-between py-1.5 rounded-lg hover:bg-foreground/3 transition-colors px-1 -mx-1"
                >
                  <span className="text-[11px] font-medium text-foreground">
                    {m.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {formatPrice(m.priceMin)}-{formatPrice(m.priceMax)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Report CTA */}
      <div className="shrink-0 px-4 pt-3">
        <Link
          href={`/cars/${make.toLowerCase().replace(/\s+/g, "-")}/${model.representativeCar.id}/report`}
          className="block rounded-xl border border-primary/20 bg-primary/6 p-4 hover:bg-primary/10 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <FileText className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-foreground">Full Investment Report</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Valuation, risks, comps &amp; costs</p>
            </div>
            <ChevronRight className="size-4 text-primary group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>

      {/* CTA — pinned bottom */}
      <div className="shrink-0 px-5 py-3 border-t border-border">
        <button
          onClick={onOpenAdvisor}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground hover:bg-primary/80 transition-all"
        >
          <MessageCircle className="size-4" />
          {t("sidebar.speakWithAdvisor")}
        </button>
      </div>
    </div>
  )
}
