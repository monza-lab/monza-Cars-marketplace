"use client"

import { ExternalLink } from "lucide-react"
import type { MarketIntelD2 } from "@/lib/fairValue/types"
import { SourceBadge } from "./primitives/SourceBadge"

type Region = MarketIntelD2["by_region"][number]["region"]

const FLAG: Record<Region, string> = {
  US: "🇺🇸",
  EU: "🇪🇺",
  UK: "🇬🇧",
  JP: "🇯🇵",
}

function fmtK(v: number | null): string {
  if (v === null) return "—"
  return `$${Math.round(v / 1000)}K`
}

interface ArbitrageSignalBlockProps {
  d2: MarketIntelD2
  thisListingPriceUsd: number
  landedCostMethodologyHref?: string
  onLandedCostMethodologyClick?: () => void
}

export function ArbitrageSignalBlock({
  d2,
  thisListingPriceUsd,
  landedCostMethodologyHref,
  onLandedCostMethodologyClick,
}: ArbitrageSignalBlockProps) {
  return (
    <section className="px-4 py-6" aria-labelledby="arbitrage-heading">
      <h2
        id="arbitrage-heading"
        className="font-serif text-[20px] font-semibold md:text-[24px]"
      >
        {/* [HARDCODED] */}Cross-Border Opportunity
      </h2>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {/* [HARDCODED] */}Cheapest comparable per region, landed to {d2.target_region}
      </p>

      {(landedCostMethodologyHref || onLandedCostMethodologyClick) && (
        <div className="mt-2">
          {landedCostMethodologyHref ? (
            <a
              href={landedCostMethodologyHref}
              className="inline-block"
              aria-label="Landed-cost methodology" /* [HARDCODED] */
            >
              <SourceBadge name="Landed-cost methodology" /* [HARDCODED] */ />
            </a>
          ) : (
            <SourceBadge
              name="Landed-cost methodology" /* [HARDCODED] */
              onClick={onLandedCostMethodologyClick}
            />
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {d2.by_region.map((row) => {
          const isTarget = row.region === d2.target_region
          return (
            <div
              key={row.region}
              className={`rounded-xl border p-4 ${
                isTarget ? "border-primary bg-primary/5" : "border-border bg-card/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">
                  {FLAG[row.region]} {row.region}
                  {isTarget && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {/* [HARDCODED] */}(this listing)
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-2 font-mono text-[18px] font-bold">
                {isTarget ? fmtK(thisListingPriceUsd) : fmtK(row.cheapest_comparable_usd)}
              </p>
              {!isTarget && row.landed_cost_to_target_usd !== null && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {/* [HARDCODED] */}+ landed {fmtK(row.landed_cost_to_target_usd)} ={" "}
                  {fmtK(row.total_landed_to_target_usd)}
                </p>
              )}
              {!isTarget && row.cheapest_comparable_usd === null && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {/* [HARDCODED] */}No comparable available
                </p>
              )}
              {row.cheapest_comparable_url && (
                <a
                  href={row.cheapest_comparable_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  {/* [HARDCODED] */}View listing <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          )
        })}
      </div>

      {d2.narrative_insight && (
        <p className="mt-4 rounded-lg bg-primary/5 p-3 text-[13px] italic">
          {d2.narrative_insight}
        </p>
      )}
    </section>
  )
}
