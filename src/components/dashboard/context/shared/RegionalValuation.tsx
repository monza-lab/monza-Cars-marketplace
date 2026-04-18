"use client"

import { Globe } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { useCurrency } from "@/lib/CurrencyContext"
import { REGION_FLAGS, REGION_LABEL_KEYS } from "../../constants"
import { formatUsdValue } from "../../utils/valuation"
import type { SegmentStats, ConfidenceTier, CanonicalMarket } from "@/lib/pricing/types"

// Locale-stable integer formatter. toLocaleString() uses the host locale,
// which differs between Node (server render: en-US → "199,999") and the
// browser (/de page → "199.999"), causing React hydration mismatches. Pin
// to en-US so the thousands separator is identical on both sides.
const INTEGER_FMT = new Intl.NumberFormat("en-US")

const TIER_DOT: Record<ConfidenceTier, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-400",
  low: "bg-neutral-500",
  insufficient: "bg-neutral-700",
}

const TIER_LABEL: Record<ConfidenceTier, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  insufficient: "No data",
}

function pickTier(a: ConfidenceTier, b: ConfidenceTier): ConfidenceTier {
  const order: ConfidenceTier[] = ["high", "medium", "low", "insufficient"]
  return order[Math.min(order.indexOf(a), order.indexOf(b))]
}

interface RegionalValuationProps {
  regionalVal: Partial<Record<CanonicalMarket, SegmentStats>>
}

export function RegionalValuationSection({ regionalVal }: RegionalValuationProps) {
  const t = useTranslations("dashboard")
  const { effectiveRegion } = useRegion()
  const { convertFromUsd, currencySymbol } = useCurrency()

  const headlineUsd = (s?: SegmentStats): number | null => {
    if (!s) return null
    return s.marketValue.valueUsd ?? s.askMedian.valueUsd
  }
  const maxHeadline = Math.max(
    ...(["US", "UK", "EU", "JP"] as const).map((r) => headlineUsd(regionalVal[r]) ?? 0),
  )

  return (
    <div className="px-5 py-4 border-b border-border">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-primary" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            {t("brandContext.valuationByMarket")}
          </span>
        </div>
        <p className="text-[8px] text-muted-foreground mt-1 ml-6">Sold • Asking (adjusted)</p>
      </div>
      <div className="space-y-1">
        {(["US", "UK", "EU", "JP"] as const).map((region) => {
          const stats = regionalVal[region]
          const headline = headlineUsd(stats)
          const isSelected = region === effectiveRegion
          const tier: ConfidenceTier = stats
            ? pickTier(stats.marketValue.tier, stats.askMedian.tier)
            : "insufficient"
          const sampleCount = stats
            ? stats.marketValue.soldN + stats.askMedian.askingN
            : 0
          const barWidth = maxHeadline > 0 && headline != null ? (headline / maxHeadline) * 100 : 0
          const hasData = headline != null && headline > 0
          const localHeadline = hasData && headline != null ? convertFromUsd(headline) : null

          const soldFormatted = stats ? formatUsdValue(stats.marketValue.valueUsd) : "—"
          const askFormatted = stats ? formatUsdValue(stats.askMedian.valueUsd) : "—"
          const soldN = stats?.marketValue.soldN ?? 0
          const askN = stats?.askMedian.askingN ?? 0

          const title = stats
            ? `Sold n=${soldN} (${stats.marketValue.tier}) • Asking n=${askN} (${stats.askMedian.tier})${
                stats.askMedian.factorApplied != null
                  ? ` • factor=${stats.askMedian.factorApplied.toFixed(2)} (${stats.askMedian.factorSource})`
                  : ""
              }`
            : "Insufficient data"

          return (
            <div
              key={region}
              className={`relative group rounded-xl py-2.5 px-3 transition-all ${
                isSelected ? "bg-primary/6 border border-primary/10" : "border border-transparent"
              }`}
              title={title}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px]">{REGION_FLAGS[region]}</span>
                <span className={`text-[11px] font-semibold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                  {t(REGION_LABEL_KEYS[region])}
                </span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${TIER_DOT[tier]}`}
                  aria-label={`confidence:${tier}`}
                />
                {isSelected && (
                  <span className="text-[7px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full tracking-wider uppercase">
                    {t("brandContext.yourMarket")}
                  </span>
                )}
                <span className="text-[8px] font-mono text-muted-foreground ml-auto">
                  {sampleCount} listings
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-1.5">
                <span className={`text-[13px] font-mono font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                  {hasData && localHeadline != null
                    ? `${currencySymbol}${INTEGER_FMT.format(Math.round(localHeadline))}`
                    : "—"}
                </span>
                <span className="text-[8px] font-mono text-muted-foreground">
                  {TIER_LABEL[tier]}
                </span>
              </div>

              <div className="h-[4px] rounded-full bg-foreground/4 overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all ${
                    isSelected ? "bg-gradient-to-r from-primary/50 to-primary/80" : "bg-gradient-to-r from-primary/20 to-primary/45"
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              <div className="flex justify-between text-[8px] font-mono text-muted-foreground">
                <span>Sold: {soldFormatted} (n={soldN})</span>
                <span>Ask: {askFormatted} (n={askN})</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
