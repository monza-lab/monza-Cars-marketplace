"use client"

import { Gauge } from "lucide-react"
import { useTranslations } from "next-intl"

export type MarketDepthData = {
  auctionsPerYear: number
  avgDaysToSell: number
  sellThroughRate: number
  demandScore: number
}

interface MarketDepthProps {
  depth: MarketDepthData
}

export function MarketDepthSection({ depth }: MarketDepthProps) {
  const t = useTranslations("dashboard")

  return (
    <div className="px-5 py-4 border-b border-border bg-primary/3">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="size-4 text-primary" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {t("brandContext.liquidityDepth")}
        </span>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{t("brandContext.listingsPerYear")}</span>
          <span className="text-[12px] font-mono font-semibold text-foreground">{depth.auctionsPerYear}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{t("brandContext.avgDaysToSell")}</span>
          <span className="text-[12px] font-mono font-semibold text-foreground">{depth.avgDaysToSell}d</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{t("brandContext.sellThroughRate")}</span>
          <span className="text-[12px] font-mono font-semibold text-positive">{depth.sellThroughRate}%</span>
        </div>
        {/* Demand score visual */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground">{t("brandContext.demandScore")}</span>
            <span className="text-[12px] font-display font-medium text-primary">{depth.demandScore}/10</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`h-[6px] flex-1 rounded-sm ${
                  i < depth.demandScore ? "bg-primary/50" : "bg-foreground/4"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
