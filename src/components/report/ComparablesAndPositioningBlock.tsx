"use client"

import { useState } from "react"
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import type { MarketIntelD3 } from "@/lib/fairValue/types"
import type { DbComparableRow } from "@/lib/db/queries"
import { CollapsibleList } from "./primitives/CollapsibleList"

interface ComparablesAndPositioningBlockProps {
  d3: MarketIntelD3
  thisVinPriceUsd: number
  comparables: DbComparableRow[]
  initialTab?: "distribution" | "table"
}

function fmtK(v: number): string {
  return `$${Math.round(v / 1000)}K`
}

export function ComparablesAndPositioningBlock({
  d3,
  thisVinPriceUsd,
  comparables,
  initialTab = "distribution",
}: ComparablesAndPositioningBlockProps) {
  const [tab, setTab] = useState<"distribution" | "table">(initialTab)

  const chartData = d3.variant_distribution_bins.map((b) => ({
    label: fmtK(b.price_bucket_usd_low),
    midUsd: (b.price_bucket_usd_low + b.price_bucket_usd_high) / 2,
    count: b.count,
  }))

  const closestBin = chartData.reduce<(typeof chartData)[number] | null>(
    (acc, b) =>
      acc === null || Math.abs(b.midUsd - thisVinPriceUsd) < Math.abs(acc.midUsd - thisVinPriceUsd)
        ? b
        : acc,
    null
  )

  return (
    <section className="px-4 py-6" aria-labelledby="comparables-heading">
      <h2
        id="comparables-heading"
        className="font-serif text-[20px] font-semibold md:text-[24px]"
      >
        Comparables &amp; Positioning
      </h2>

      <div className="mt-3 flex gap-1 border-b border-border text-[13px]">
        <button
          type="button"
          onClick={() => setTab("distribution")}
          className={`px-3 py-2 transition-colors ${
            tab === "distribution"
              ? "border-b-2 border-primary font-semibold"
              : "text-muted-foreground"
          }`}
        >
          Distribution
        </button>
        <button
          type="button"
          onClick={() => setTab("table")}
          className={`px-3 py-2 transition-colors ${
            tab === "table"
              ? "border-b-2 border-primary font-semibold"
              : "text-muted-foreground"
          }`}
        >
          Comparables ({comparables.length})
        </button>
      </div>

      {tab === "distribution" && (
        <div className="mt-4">
          {chartData.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card/30 p-4 text-[13px] text-muted-foreground">
              Not enough sold comparables to build a distribution chart yet.
            </p>
          ) : (
            <>
              <p className="text-[12px] text-muted-foreground">
                This VIN falls in the{" "}
                <strong className="text-foreground">
                  {d3.vin_percentile_within_variant}th percentile
                </strong>{" "}
                of variant sold prices in the last 12 months.
              </p>
              <div className="mt-3 h-48 w-full">
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value) => [`${value ?? 0} sold`, ""]}
                      labelFormatter={(label) => `Bucket starting ${String(label ?? "")}`}
                    />
                    <Bar dataKey="count" fill="currentColor" className="text-primary" />
                    {closestBin && (
                      <ReferenceLine
                        x={closestBin.label}
                        stroke="currentColor"
                        strokeDasharray="3 3"
                        className="text-destructive"
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "table" && (
        <>
          {comparables.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border bg-card/30 p-4 text-[13px] text-muted-foreground">
              No comparables available for this listing yet.
            </p>
          ) : (
            <CollapsibleList
              items={comparables}
              initialCount={5}
              moreLabel={(hidden) =>
                `Show all ${comparables.length} comparables (+${hidden} more) →`
              }
              render={(c, i) => (
                <div
                  key={`${c.platform}-${i}`}
                  className="grid grid-cols-1 gap-1 rounded-lg border border-border bg-card/30 p-3 text-[12px] md:grid-cols-5"
                >
                  <span className="font-medium md:col-span-2">{c.title}</span>
                  <span>
                    <span className="text-muted-foreground md:hidden">Mileage · </span>
                    {c.mileage?.toLocaleString() ?? "—"}
                  </span>
                  <span className="font-mono">
                    <span className="text-muted-foreground md:hidden">Sold · </span>
                    {fmtK(c.soldPrice)}
                  </span>
                  <span className="text-muted-foreground">
                    {c.soldDate ?? "—"} · {c.platform}
                  </span>
                </div>
              )}
              className="mt-4"
            />
          )}
        </>
      )}
    </section>
  )
}
