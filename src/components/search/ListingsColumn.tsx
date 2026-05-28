"use client"

import Image from "next/image"
import { ChevronRight } from "lucide-react"
import { Link } from "@/i18n/navigation"
import type { UnifiedListing } from "@/hooks/useUnifiedSearch"

interface ListingsColumnProps {
  items: UnifiedListing[]
  total: number
  loading: boolean
  error: string | null
  query: string
  activeSeries: string | null
  variant: "header" | "sheet" | "inline"
  onSelect: () => void
}

const PLATFORM_LABEL: Record<string, string> = {
  BRING_A_TRAILER: "BaT",
  CARS_AND_BIDS: "C&B",
  COLLECTING_CARS: "CC",
  AUTO_SCOUT_24: "AS24",
  RM_SOTHEBYS: "RM",
  GOODING: "G&C",
  BONHAMS: "Bonhams",
  ELFERSPOT: "ES",
  BE_FORWARD: "BF",
}

function formatPriceUsd(value: number | null): string {
  if (value == null) return "POA"
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${value.toLocaleString()}`
}

export function ListingsColumn({
  items,
  total,
  loading,
  error,
  query,
  activeSeries,
  variant,
  onSelect,
}: ListingsColumnProps) {
  const isStack = variant === "sheet"
  const scrollClass = isStack ? "" : "max-h-[360px] overflow-y-auto"
  const viewAllHref = activeSeries
    ? `/cars/porsche?family=${encodeURIComponent(activeSeries)}`
    : query.trim()
      ? `/search?q=${encodeURIComponent(query.trim())}`
      : "/search"

  return (
    <div className={scrollClass}>
      <p className="px-3 pt-2 pb-1 text-[9px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
        Listings
      </p>
      {error ? (
        <p className="px-3 py-4 text-[11px] text-muted-foreground">{error}</p>
      ) : loading && items.length === 0 ? (
        <p className="px-3 py-4 text-[11px] text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="px-3 py-4 text-[11px] text-muted-foreground">
          {activeSeries
            ? `No live listings for ${activeSeries} right now.`
            : "No listings match."}
        </p>
      ) : (
        <ul role="listbox" aria-label="Listings" className="pb-1">
          {items.map((l) => {
            const href = `/cars/porsche/${l.id}/report`
            const platformShort = PLATFORM_LABEL[l.platform] ?? l.platform
            return (
              <li key={l.id}>
                <Link
                  href={href}
                  onClick={onSelect}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-foreground/[0.05] transition-colors"
                >
                  <div className="relative w-12 h-9 rounded-md overflow-hidden bg-muted shrink-0">
                    {l.image ? (
                      <Image
                        src={l.image}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate" title={l.title}>
                      {l.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      <span className="tabular-nums text-primary">{formatPriceUsd(l.priceUsd)}</span>
                      <span> · </span>
                      <span>{platformShort}</span>
                      {l.status === "sold" ? <span> · sold</span> : null}
                    </p>
                  </div>
                  <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {items.length > 0 && total > items.length ? (
        <Link
          href={viewAllHref}
          onClick={onSelect}
          className="block px-3 py-2 text-[11px] text-primary hover:text-foreground border-t border-border"
        >
          → View all {total} listings
        </Link>
      ) : null}
    </div>
  )
}
