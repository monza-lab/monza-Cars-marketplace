"use client"

import { useMemo } from "react"
import { Globe, Gauge, Wrench } from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { useRegion } from "@/lib/RegionContext"
import { formatRegionalPrice as fmtRegional } from "@/lib/regionPricing"
import { useCurrency } from "@/lib/CurrencyContext"
import { useTranslations } from "next-intl"
import {
  aggregateRegionalPricing,
  findBestRegion,
  deriveModelDepth,
  type Model,
} from "@/lib/makePageHelpers"
import { ownershipCosts, regionLabels } from "@/lib/makePageConstants"

// ─── MOBILE: MODEL CONTEXT (4 panels) ───
export function MobileModelContext({
  model,
  make,
  cars,
  allCars,
  allModels,
  dbOwnershipCosts,
}: {
  model: Model
  make: string
  cars: CollectorCar[]
  allCars: CollectorCar[]
  allModels: Model[]
  dbOwnershipCosts?: { insurance?: number; storage?: number; maintenance?: number } | null
}) {
  const t = useTranslations("makePage")
  const { effectiveRegion } = useRegion()
  const { formatPrice, convertFromUsd, currencySymbol } = useCurrency()

  const allModelCars = allCars.filter(c => c.model === model.name)
  const regionalPricing = useMemo(() => aggregateRegionalPricing(allModelCars), [allModelCars])
  const bestRegion = regionalPricing ? findBestRegion(regionalPricing) : null
  const depth = deriveModelDepth(allModelCars)

  const fallbackCosts = ownershipCosts[make] || ownershipCosts.default
  const baseCosts = {
    insurance: dbOwnershipCosts?.insurance ?? fallbackCosts.insurance,
    storage: dbOwnershipCosts?.storage ?? fallbackCosts.storage,
    maintenance: dbOwnershipCosts?.maintenance ?? fallbackCosts.maintenance,
  }
  const brandAvgPrice = allCars.length > 0 ? allCars.reduce((s, c) => s + c.currentBid, 0) / allCars.length : 1
  const scaleFactor = brandAvgPrice > 0 ? model.avgPrice / brandAvgPrice : 1
  const costs = {
    insurance: Math.round(baseCosts.insurance * scaleFactor),
    storage: Math.round(baseCosts.storage * scaleFactor),
    maintenance: Math.round(baseCosts.maintenance * scaleFactor),
  }
  const totalAnnualCost = costs.insurance + costs.storage + costs.maintenance

  const maxRegionalUsd = regionalPricing
    ? Math.max(...(["US", "EU", "UK", "JP"] as const).map(r =>
      (regionalPricing[r].low + regionalPricing[r].high) / 2
    ))
    : 1

  return (
    <div className="mx-4 mt-3 space-y-3">
      {/* Panel 1: Regional Valuation */}
      {regionalPricing && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="size-3.5 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">
              {t("mobileContext.valuationByMarket")}
            </span>
          </div>
          <div className="space-y-2.5">
            {(["US", "UK", "EU", "JP"] as const).map(region => {
              const pricing = regionalPricing[region]
              const isBest = bestRegion === region
              const isSelected = region === effectiveRegion
              const usdAvg = (pricing.low + pricing.high) / 2
              const barWidth = (usdAvg / maxRegionalUsd) * 100
              return (
                <div key={region} className={isSelected ? "rounded-lg bg-primary/4 -mx-1 px-1 py-1" : ""}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px]">{regionLabels[region]?.flag}</span>
                      <span className={`text-[11px] font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{region}</span>
                      {isBest && <span className="text-[7px] font-bold text-emerald-400">{t("mobileContext.best")}</span>}
                      {isSelected && <span className="text-[7px] font-bold text-primary">{t("mobileContext.yourMarket")}</span>}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] font-mono text-foreground">{fmtRegional(convertFromUsd(pricing.low), currencySymbol)}</span>
                      <span className="text-[8px] text-muted-foreground">→</span>
                      <span className={`text-[10px] font-mono font-semibold ${isBest ? "text-emerald-400" : "text-primary"}`}>
                        {fmtRegional(convertFromUsd(pricing.high), currencySymbol)}
                      </span>
                    </div>
                  </div>
                  <div className="h-[5px] rounded-full bg-foreground/4 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isBest ? "bg-emerald-400/50" : isSelected ? "bg-primary/60" : "bg-primary/30"}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Panel 2: Market Depth — 2x2 grid */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="size-3.5 text-primary" />
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">
            {t("mobileContext.marketDepth")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">{t("mobileContext.auctionsPerYear")}</p>
            <p className="text-[14px] font-mono font-semibold text-foreground">{depth.auctionsPerYear}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">{t("mobileContext.avgDaysToSell")}</p>
            <p className="text-[14px] font-mono font-semibold text-foreground">{depth.avgDaysToSell}d</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">{t("mobileContext.sellThroughRate")}</p>
            <p className="text-[14px] font-mono font-semibold text-emerald-400">{depth.sellThroughRate}%</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">{t("mobileContext.demandScore")}</p>
            <p className="text-[14px] font-display font-medium text-primary">{depth.demandScore}/10</p>
          </div>
        </div>
      </div>

      {/* Panel 4: Ownership Cost */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="size-3.5 text-primary" />
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">
            {t("mobileContext.ownershipCost")}
          </span>
        </div>
        <div className="space-y-2">
          {[
            { label: t("mobileContext.insurance"), value: costs.insurance },
            { label: t("mobileContext.storage"), value: costs.storage },
            { label: t("mobileContext.maintenance"), value: costs.maintenance },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{item.label}</span>
              <span className="text-[11px] font-mono text-muted-foreground">{formatPrice(item.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-border">
            <span className="text-[11px] font-medium text-foreground">{t("mobileContext.total")}</span>
            <span className="text-[12px] font-display font-medium text-primary">{formatPrice(totalAnnualCost)}{t("mobileContext.perYear")}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
