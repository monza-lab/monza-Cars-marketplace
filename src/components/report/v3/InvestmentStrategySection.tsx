import type { InvestmentAnalysis, ListingType } from "@/lib/reports/types-v3"
import { DataTrustBadge } from "../DataTrustBadge"

interface InvestmentStrategySectionProps {
  data: InvestmentAnalysis | null
  listingType: ListingType
}

function fmtUsd(v: number | null): string {
  if (v == null) return "N/A"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v)
}

export function InvestmentStrategySection({ data, listingType }: InvestmentStrategySectionProps) {
  if (!data?.strategy) return null

  const { strategy } = data

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">
          {listingType === "auction" ? "Bidding Strategy" : "Negotiation Strategy"}
        </h2>
        <div className="flex gap-2">
          <DataTrustBadge level="verified_from_data" />
          <DataTrustBadge level="ai_analysis" />
        </div>
      </div>

      {/* Strategy insight */}
      <p className="text-sm leading-relaxed text-muted-foreground">{strategy.strategyInsight}</p>

      {/* Strategy details based on listing type */}
      {listingType === "auction" ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {strategy.maxBidRecommendation != null && (
            <div className="rounded-lg border border-border bg-background/50 p-4 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Max Bid</p>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">{fmtUsd(strategy.maxBidRecommendation)}</p>
            </div>
          )}
          {strategy.bidTiming && (
            <div className="rounded-lg border border-border bg-background/50 p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Bid Timing</p>
              <p className="mt-1 text-sm text-foreground">{strategy.bidTiming}</p>
            </div>
          )}
          {strategy.reserveStrategy && (
            <div className="rounded-lg border border-border bg-background/50 p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reserve Strategy</p>
              <p className="mt-1 text-sm text-foreground">{strategy.reserveStrategy}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {strategy.openingOffer != null && (
            <div className="rounded-lg border border-border bg-background/50 p-4 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Opening Offer</p>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">{fmtUsd(strategy.openingOffer)}</p>
            </div>
          )}
          {strategy.walkAwayPrice != null && (
            <div className="rounded-lg border border-border bg-background/50 p-4 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Walk-Away Price</p>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">{fmtUsd(strategy.walkAwayPrice)}</p>
            </div>
          )}
        </div>
      )}

      {/* Negotiation leverage */}
      {(strategy.negotiationLeverage?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Negotiation Leverage</h3>
          <ul className="space-y-1.5">
            {strategy.negotiationLeverage.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-amber-500 mt-0.5 shrink-0">&#9656;</span>
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Potential repairs */}
      {strategy.potentialRepairs && (
        <div className="rounded-lg border border-border bg-red-50 dark:bg-red-950/10 p-4">
          <h3 className="text-sm font-semibold text-foreground mb-1">Potential Repair Costs</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold font-mono text-foreground">
              {fmtUsd(strategy.potentialRepairs.low)} — {fmtUsd(strategy.potentialRepairs.high)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{strategy.potentialRepairs.description}</p>
        </div>
      )}

      {/* Investment narrative */}
      {data.investmentNarrative && (
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground mb-1">Market Narrative</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{data.investmentNarrative}</p>
        </div>
      )}
    </section>
  )
}
