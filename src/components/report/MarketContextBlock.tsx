import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react"
import type { RegionalMarketStats } from "@/lib/reports/types"

const FLAG: Record<string, string> = {
  US: "🇺🇸",
  EU: "🇪🇺",
  UK: "🇬🇧",
  JP: "🇯🇵",
}

function fmtK(v: number): string {
  return `$${Math.round(v / 1000)}K`
}

function trendIconFor(direction: RegionalMarketStats["trendDirection"]): LucideIcon {
  if (direction === "up") return TrendingUp
  if (direction === "down") return TrendingDown
  return Minus
}

function trendClassFor(direction: RegionalMarketStats["trendDirection"]): string {
  if (direction === "up") return "text-positive"
  if (direction === "down") return "text-destructive"
  return "text-muted-foreground"
}

interface MarketContextBlockProps {
  regions: RegionalMarketStats[]
}

export function MarketContextBlock({ regions }: MarketContextBlockProps) {
  if (regions.length === 0) {
    return null
  }

  return (
    <section className="px-4 py-6" aria-labelledby="market-context-heading">
      <h2
        id="market-context-heading"
        className="font-serif text-[18px] font-semibold md:text-[20px]"
      >
        Market Context
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {regions.map((r) => {
          const Trend = trendIconFor(r.trendDirection)
          return (
            <div
              key={r.region}
              className="rounded-lg border border-border bg-card/30 p-3"
            >
              <p className="text-[13px] font-semibold">
                {FLAG[r.region] ?? ""} {r.region}
              </p>
              <p className="mt-1 font-mono text-[15px]">{fmtK(r.medianPriceUsd)}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                {r.totalListings} sold
                <Trend
                  className={`size-3 ${trendClassFor(r.trendDirection)}`}
                  aria-label={`trend ${r.trendDirection}`}
                />
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
