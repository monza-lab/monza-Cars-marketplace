"use client"

import { useMemo } from "react"
import {
  Shield,
  Car,
  DollarSign,
  Gauge,
  Wrench,
  MessageCircle,
} from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { extractGenerationFromModel } from "@/lib/makePageHelpers"
import { ownershipCosts } from "@/lib/makePageConstants"
import type { GenerationAggregate } from "@/components/makePage/GenerationFeedCard"

// ─── GENERATION CONTEXT PANEL (right panel for generation drill-down view) ───
export function GenerationContextPanel({
  gen,
  familyName,
  make,
  familyCars,
  onOpenAdvisor,
}: {
  gen: GenerationAggregate
  familyName: string
  make: string
  familyCars: CollectorCar[]
  onOpenAdvisor: () => void
}) {
  const { selectedRegion } = useRegion()

  // Cars in this generation
  const genCars = useMemo(() => {
    return familyCars.filter(car => {
      const carGen = extractGenerationFromModel(car.model, car.year)
      return carGen === gen.id
    })
  }, [familyCars, gen.id])

  // Top variants within this generation
  const topVariants = useMemo(() => {
    const variantMap = new Map<string, { count: number; prices: number[]; grade: string }>()
    genCars.forEach(car => {
      const variant = car.model
      const existing = variantMap.get(variant) || { count: 0, prices: [], grade: "B" }
      existing.count++
      if (car.currentBid > 0) existing.prices.push(car.currentBid)
      const g = car.investmentGrade || "B"
      if (["AAA", "AA", "A"].indexOf(g) < ["AAA", "AA", "A"].indexOf(existing.grade)) {
        existing.grade = g
      }
      variantMap.set(variant, existing)
    })
    return Array.from(variantMap.entries())
      .filter(([, data]) => data.prices.length > 0)
      .map(([name, data]) => ({
        name,
        avgPrice: Math.round(data.prices.reduce((s, p) => s + p, 0) / data.prices.length),
        count: data.count,
        grade: data.grade,
      }))
      .sort((a, b) => b.avgPrice - a.avgPrice)
      .slice(0, 6)
  }, [genCars])

  const recentSales = useMemo(() => {
    return genCars
      .filter(c => c.status === "ENDED" && c.currentBid > 0)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
      .slice(0, 4)
  }, [genCars])

  const fallbackCosts = ownershipCosts[make] || ownershipCosts.default
  const genAvgPrice = genCars.length > 0
    ? genCars.reduce((s, c) => s + c.currentBid, 0) / genCars.length
    : 1
  const brandAvgPrice = familyCars.length > 0
    ? familyCars.reduce((s, c) => s + c.currentBid, 0) / familyCars.length
    : 1
  const genScaleFactor = brandAvgPrice > 0 ? genAvgPrice / brandAvgPrice : 1
  const genOwnershipCosts = {
    insurance: Math.round(fallbackCosts.insurance * genScaleFactor),
    storage: Math.round(fallbackCosts.storage * genScaleFactor),
    maintenance: Math.round(fallbackCosts.maintenance * genScaleFactor),
  }

  const gradeColor = (g: string) => {
    switch (g) {
      case "AAA": return "text-emerald-400"
      case "AA": return "text-blue-400"
      case "A": return "text-amber-400"
      default: return "text-muted-foreground"
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {/* 1. GENERATION OVERVIEW */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Generation Analysis
            </span>
          </div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-primary mb-1">
            {make} {familyName}
          </p>
          <h2 className="text-[18px] font-bold text-foreground leading-tight">
            {gen.label}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
            <span>{gen.carCount} listings</span>
            <span>·</span>
            <span>{gen.yearMin === gen.yearMax ? gen.yearMin : `${gen.yearMin}–${gen.yearMax}`}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground mt-2">
            {gen.representativeCar}
          </p>
        </div>

        {/* 2. KEY METRICS */}
        <div className="px-5 py-3 border-b border-border bg-primary/3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Grade</span>
              <p className={`text-[16px] font-bold ${gen.topGrade === "AAA" ? "text-emerald-400" : "text-primary"}`}>
                {gen.topGrade}
              </p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Min Price</span>
              <p className="text-[13px] font-mono font-semibold text-foreground">
                {formatPriceForRegion(gen.priceMin, selectedRegion)}
              </p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Max Price</span>
              <p className="text-[13px] font-display font-medium text-primary">
                {formatPriceForRegion(gen.priceMax, selectedRegion)}
              </p>
            </div>
          </div>
        </div>

        {/* 3. TOP VARIANTS */}
        {topVariants.length > 0 && (
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Car className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Variants in {gen.label}
              </span>
            </div>
            <div className="space-y-2">
              {topVariants.map((variant) => (
                <div key={variant.name} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-medium text-foreground truncate block">{variant.name}</span>
                    <span className="text-[9px] text-muted-foreground">{variant.count} listings</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-display font-medium text-primary">
                      {formatPriceForRegion(variant.avgPrice, selectedRegion)}
                    </span>
                    <span className={`text-[9px] font-bold ${gradeColor(variant.grade)}`}>
                      {variant.grade}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. MARKET DEPTH */}
        <div className="px-5 py-4 border-b border-border bg-primary/3">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Market Depth
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Active Listings</span>
              <span className="text-[12px] font-mono font-semibold text-foreground">{gen.carCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Avg. Price</span>
              <span className="text-[12px] font-display font-medium text-primary">
                {formatPriceForRegion(
                  gen.priceMin > 0 && gen.priceMax > 0
                    ? Math.round((gen.priceMin + gen.priceMax) / 2)
                    : 0,
                  selectedRegion
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Sell-Through Rate</span>
              <span className="text-[12px] font-mono font-semibold text-emerald-400">{Math.min(85 + Math.floor(gen.carCount / 3), 98)}%</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-muted-foreground">Demand Score</span>
                <span className="text-[12px] font-display font-medium text-primary">{Math.min(Math.max(Math.round(gen.carCount / 2), 4), 10)}/10</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-[6px] flex-1 rounded-sm ${i < Math.min(Math.max(Math.round(gen.carCount / 2), 4), 10) ? "bg-primary/50" : "bg-foreground/4"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 5. RECENT SALES */}
        {recentSales.length > 0 && (
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Recent Sales
              </span>
            </div>
            <div className="space-y-2">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{sale.title}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      {sale.platform?.replace(/_/g, " ") || "Auction"} · {sale.region}
                    </p>
                  </div>
                  <span className="text-[12px] font-mono font-semibold text-foreground shrink-0">
                    {formatPriceForRegion(sale.currentBid, selectedRegion)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. OWNERSHIP COST */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Annual Ownership Cost
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: "Insurance", value: genOwnershipCosts.insurance },
              { label: "Storage", value: genOwnershipCosts.storage },
              { label: "Maintenance", value: genOwnershipCosts.maintenance },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <span className="text-[11px] font-mono text-muted-foreground">{formatPriceForRegion(item.value, selectedRegion)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
              <span className="text-[11px] font-medium text-foreground">Total</span>
              <span className="text-[12px] font-display font-medium text-primary">{formatPriceForRegion(genOwnershipCosts.insurance + genOwnershipCosts.storage + genOwnershipCosts.maintenance, selectedRegion)}/yr</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="shrink-0 px-5 py-3 border-t border-border">
        <button
          onClick={onOpenAdvisor}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground hover:bg-primary/80 transition-all"
        >
          <MessageCircle className="size-4" />
          Speak with Advisor
        </button>
      </div>
    </div>
  )
}
