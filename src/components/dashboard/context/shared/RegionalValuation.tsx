"use client"

import { Globe } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { useCurrency } from "@/lib/CurrencyContext"
import { REGION_FLAGS, REGION_LABEL_KEYS } from "../../constants"
import { formatRegionalVal, formatUsdEquiv, getValuationConfidence } from "../../utils/valuation"
import type { RegionalValuation } from "../../utils/valuation"

interface RegionalValuationProps {
  regionalVal: Record<string, RegionalValuation>
}

export function RegionalValuationSection({ regionalVal }: RegionalValuationProps) {
  const t = useTranslations("dashboard")
  const { effectiveRegion } = useRegion()
  const { convertFromUsd, currencySymbol } = useCurrency()

  return (
    <div className="px-5 py-4 border-b border-border">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-primary" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            {t("brandContext.valuationByMarket")}
          </span>
        </div>
        <p className="text-[8px] text-muted-foreground mt-1 ml-6">Fair Value by Market</p>
      </div>
      <div className="space-y-1">
        {(["US", "UK", "EU", "JP"] as const).map((region) => {
          const val = regionalVal[region]
          if (!val) return null
          const localCurrent = convertFromUsd(val.usdCurrent * 1_000_000) / 1_000_000
          const maxUsdCurrent = Math.max(...Object.values(regionalVal).map(v => v.usdCurrent))
          const barWidth = maxUsdCurrent > 0 ? (val.usdCurrent / maxUsdCurrent) * 100 : 0
          const isSelected = region === effectiveRegion
          const confidence = getValuationConfidence(val.sampleCount, val.minUsd, val.maxUsd)
          const hasLocalData = val.sampleCount > 0
          const localValue = hasLocalData ? formatRegionalVal(localCurrent, currencySymbol) : "—"
          const usdValue = hasLocalData ? `${formatUsdEquiv(val.usdCurrent)} USD` : "No local data"
          return (
            <div key={region} className={`rounded-xl py-2.5 px-3 transition-all ${isSelected ? "bg-primary/6 border border-primary/10" : "border border-transparent"}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px]">{REGION_FLAGS[region]}</span>
                <span className={`text-[11px] font-semibold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{t(REGION_LABEL_KEYS[region])}</span>
                {isSelected && (
                  <span className="text-[7px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full tracking-wider uppercase">
                    {t("brandContext.yourMarket")}
                  </span>
                )}
                <span className="text-[8px] font-mono text-muted-foreground">
                  {val.sampleCount} listings
                </span>
                <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full tracking-wider uppercase ${confidence.className}`}>
                  {confidence.label}
                </span>
              </div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className={`text-[13px] font-mono font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                  {localValue}
                </span>
              </div>
              <div className="h-[4px] rounded-full bg-foreground/4 overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all ${isSelected ? "bg-gradient-to-r from-primary/50 to-primary/80" : "bg-gradient-to-r from-primary/20 to-primary/45"}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="flex justify-end">
                <span className="text-[8px] font-mono text-muted-foreground">
                  {usdValue}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
