"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Search as SearchIcon, X } from "lucide-react"
import { useRouter } from "@/i18n/navigation"
import { useUnifiedSearch } from "@/hooks/useUnifiedSearch"
import type { SeriesMatch } from "@/lib/searchIndex"
import { SeriesColumn } from "./SeriesColumn"
import { ListingsColumn } from "./ListingsColumn"
import { saveSearchQuery } from "@/lib/searchHistory"

type Variant = "header" | "sheet" | "inline"

interface UnifiedSearchProps {
  variant: Variant
  initialQuery?: string
  autoFocus?: boolean
  onClose?: () => void
}

type Focused = "series" | "listings"

export function UnifiedSearch({
  variant,
  initialQuery = "",
  autoFocus,
  onClose,
}: UnifiedSearchProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    query,
    setQuery,
    activeSeries,
    setActiveSeries,
    series,
    listings,
    total,
    loading,
    error,
  } = useUnifiedSearch()
  const [focused, setFocused] = useState<Focused>("series")
  const [listingIndex, setListingIndex] = useState(0)

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    setListingIndex(0)
  }, [listings])

  const handleSeriesSelect = useCallback(
    (s: SeriesMatch) => {
      if (query.trim()) saveSearchQuery(query.trim())
      router.push(`/cars/porsche?family=${encodeURIComponent(s.id)}`)
      onClose?.()
    },
    [query, router, onClose],
  )

  const handleSeriesHover = useCallback(
    (id: string | null) => {
      setActiveSeries(id)
    },
    [setActiveSeries],
  )

  const handleListingClickClose = useCallback(() => {
    if (query.trim()) saveSearchQuery(query.trim())
    onClose?.()
  }, [query, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose?.()
        return
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        const delta = e.key === "ArrowDown" ? 1 : -1
        if (focused === "series") {
          if (series.length === 0) return
          const currentIdx = Math.max(
            0,
            series.findIndex((s) => s.id === activeSeries),
          )
          const next = (currentIdx + delta + series.length) % series.length
          setActiveSeries(series[next].id)
        } else {
          if (listings.length === 0) return
          setListingIndex((i) => (i + delta + listings.length) % listings.length)
        }
        return
      }
      if (variant !== "sheet" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault()
        setFocused(e.key === "ArrowRight" ? "listings" : "series")
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        if (focused === "series" && activeSeries) {
          const match = series.find((s) => s.id === activeSeries)
          if (match) handleSeriesSelect(match)
        } else if (focused === "listings" && listings[listingIndex]) {
          if (query.trim()) saveSearchQuery(query.trim())
          router.push(`/cars/porsche/${listings[listingIndex].id}/report`)
          onClose?.()
        }
      }
    },
    [
      focused,
      series,
      listings,
      listingIndex,
      activeSeries,
      variant,
      query,
      router,
      onClose,
      setActiveSeries,
      handleSeriesSelect,
    ],
  )

  const shellClass =
    variant === "header"
      ? "bg-card border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
      : variant === "sheet"
        ? "bg-background"
        : "bg-card border border-border rounded-xl overflow-hidden"

  const isStack = variant === "sheet"

  return (
    <div className={shellClass} onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <SearchIcon className="size-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 992 GT3, 997 Turbo, ..."
          className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="size-6 flex items-center justify-center rounded-full bg-foreground/[0.06] text-muted-foreground hover:bg-foreground/10"
          >
            <X className="size-3" />
          </button>
        ) : null}
      </div>

      <div className={isStack ? "flex flex-col" : "grid grid-cols-[180px_1fr]"}>
        <div
          className={isStack ? "border-b border-border" : "border-r border-border"}
          onMouseEnter={() => setFocused("series")}
        >
          <SeriesColumn
            items={series}
            activeId={activeSeries}
            onHover={handleSeriesHover}
            onSelect={handleSeriesSelect}
            variant={variant}
          />
        </div>
        <div onMouseEnter={() => setFocused("listings")}>
          <ListingsColumn
            items={listings}
            total={total}
            loading={loading}
            error={error}
            query={query}
            activeSeries={activeSeries}
            variant={variant}
            onSelect={handleListingClickClose}
          />
        </div>
      </div>
    </div>
  )
}
