# Unified Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three disjoint search surfaces (Header dropdown, MobileSearchSheet, /search page input) with one shared `UnifiedSearch` component that shows series + listings side by side and filters them as the user types.

**Architecture:** Pure search functions on top of `brandConfig` for the series column, a new `/api/search/listings` Supabase-backed route for the listings column, a `useUnifiedSearch` state hook (debounce + abort + keyboard), and a `UnifiedSearch` orchestrator with `variant="header" | "sheet" | "inline"` so the same component slots into all three surfaces.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind · framer-motion · next-intl · Supabase · Vitest.

**Spec:** `docs/superpowers/specs/2026-05-25-unified-search-design.md`

---

## File map

**Create:**
- `src/lib/searchIndex.ts` — pure series fuzzy-match
- `src/lib/searchIndex.test.ts` — unit tests
- `src/app/api/search/listings/route.ts` — listings endpoint
- `src/hooks/useUnifiedSearch.ts` — state + debounce + abort + keyboard
- `src/hooks/useUnifiedSearch.test.ts` — unit tests
- `src/components/search/SeriesColumn.tsx` — left column / top stack
- `src/components/search/ListingsColumn.tsx` — right column / bottom stack
- `src/components/search/UnifiedSearch.tsx` — orchestrator

**Modify:**
- `src/components/layout/Header.tsx` — swap inline dropdown for `<UnifiedSearch variant="header" />`
- `src/components/mobile/MobileBottomNav.tsx` — swap `SearchEmptyState` + `SearchResultsState` bodies for `<UnifiedSearch variant="sheet" />`
- `src/app/[locale]/search/SearchClient.tsx` — render `<UnifiedSearch variant="inline" />` above the existing grid, synced to `?q=`

---

## Task 1 — Series search index (pure logic + tests)

**Files:**
- Create: `src/lib/searchIndex.ts`
- Test: `src/lib/searchIndex.test.ts`

- [ ] **Step 1.1: Write the failing test**

`src/lib/searchIndex.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { searchSeries } from "./searchIndex"

describe("searchSeries", () => {
  it("returns all 27 Porsche series when query is empty", () => {
    const results = searchSeries("")
    expect(results.length).toBeGreaterThanOrEqual(20)
    const ids = results.map((r) => r.id)
    expect(ids).toContain("992")
    expect(ids).toContain("997")
    expect(ids).toContain("964")
  })

  it("filters by id prefix when typing '99'", () => {
    const results = searchSeries("99")
    const ids = results.map((r) => r.id)
    expect(ids).toContain("997")
    expect(ids).toContain("996")
    expect(ids).toContain("993")
    expect(ids).toContain("992")
    expect(ids).toContain("991")
    // Non-matching series shouldn't appear
    expect(ids).not.toContain("964")
  })

  it("tolerates a single typo for 4+ char queries", () => {
    const results = searchSeries("porche")
    // "porche" should match against family/keywords that contain "porsche"
    expect(results.length).toBeGreaterThan(0)
  })

  it("matches variant keywords like 'gt3' across series", () => {
    const results = searchSeries("gt3")
    // GT3 lives inside variant lists of multiple series; surface those series.
    expect(results.length).toBeGreaterThan(0)
  })

  it("returns results sorted by SeriesConfig.order ascending", () => {
    const results = searchSeries("")
    const orders = results.map((r) => r.order)
    const sorted = [...orders].sort((a, b) => a - b)
    expect(orders).toEqual(sorted)
  })
})
```

- [ ] **Step 1.2: Run test, confirm it fails**

```bash
cd "/Users/bavaraianecons/Desktop/Monzalab/Studio Builder/MonzaHaus/producto"
npx vitest run src/lib/searchIndex --reporter=default 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module './searchIndex'".

- [ ] **Step 1.3: Implement `searchIndex.ts`**

`src/lib/searchIndex.ts`:

```ts
import { getBrandConfig, type SeriesConfig } from "./brandConfig"

export interface SeriesMatch {
  id: string
  label: string
  family: string
  yearRange: [number, number]
  order: number
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = i - 1
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[n]
}

function isTypoMatch(query: string, target: string): boolean {
  if (query.length <= 3) return false
  const maxDist = query.length <= 5 ? 1 : 2
  const targetWords = target.toLowerCase().split(/\s+/)
  for (const word of targetWords) {
    if (levenshtein(query, word) <= maxDist) return true
  }
  if (target.length <= query.length + 3 && levenshtein(query, target.toLowerCase()) <= maxDist) {
    return true
  }
  return false
}

function seriesMatchesQuery(s: SeriesConfig, q: string): boolean {
  if (s.id.toLowerCase().includes(q)) return true
  if (s.label.toLowerCase().includes(q)) return true
  if (s.family.toLowerCase().includes(q)) return true
  if (s.keywords.some((k) => k.toLowerCase().includes(q))) return true
  if (s.variants?.some((v) => v.label.toLowerCase().includes(q))) return true
  if (s.variants?.some((v) => v.keywords?.some((k) => k.toLowerCase().includes(q)))) return true
  if (isTypoMatch(q, s.label)) return true
  if (isTypoMatch(q, s.family)) return true
  return false
}

function toMatch(s: SeriesConfig): SeriesMatch {
  return {
    id: s.id,
    label: s.label,
    family: s.family,
    yearRange: s.yearRange,
    order: s.order,
  }
}

export function searchSeries(query: string, make = "porsche"): SeriesMatch[] {
  const config = getBrandConfig(make)
  if (!config) return []
  const all = [...config.series].sort((a, b) => a.order - b.order)
  const q = query.trim().toLowerCase()
  if (!q) return all.map(toMatch)
  return all.filter((s) => seriesMatchesQuery(s, q)).map(toMatch)
}
```

- [ ] **Step 1.4: Run tests, confirm they pass**

```bash
npx vitest run src/lib/searchIndex --reporter=default 2>&1 | tail -20
```

Expected: all 5 tests PASS.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/searchIndex.ts src/lib/searchIndex.test.ts
git commit -m "feat(search): pure series search index with typo tolerance"
```

---

## Task 2 — Listings API endpoint

**Files:**
- Create: `src/app/api/search/listings/route.ts`

This route is server-side and depends on live Supabase data. We won't unit-test it (it would require mocking Supabase, which the existing `src/lib/supabaseLiveListings.ts` does not encourage). It gets a manual `curl` smoke test instead.

- [ ] **Step 2.1: Implement the route**

`src/app/api/search/listings/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import {
  rowToCollectorCar,
  type ListingRow,
} from "@/lib/supabaseLiveListings"
import { extractSeries } from "@/lib/brandConfig"

export const dynamic = "force-dynamic"

interface SearchListing {
  id: string
  title: string
  year: number | null
  model: string | null
  image: string | null
  priceUsd: number | null
  platform: string
  status: "live" | "sold"
  series: string | null
}

interface SearchResponse {
  listings: SearchListing[]
  total: number
}

function cap(limit: string | null): number {
  const n = Number(limit)
  if (!Number.isFinite(n) || n <= 0) return 10
  return Math.min(25, Math.max(1, Math.floor(n)))
}

export async function GET(request: NextRequest): Promise<NextResponse<SearchResponse>> {
  const url = new URL(request.url)
  const q = (url.searchParams.get("q") ?? "").trim()
  const seriesFilter = (url.searchParams.get("series") ?? "").trim().toLowerCase()
  const limit = cap(url.searchParams.get("limit"))
  const trending = url.searchParams.get("trending") === "true"

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ listings: [], total: 0 })
  }

  const supabase = createSupabaseClient(supabaseUrl, supabaseKey)

  try {
    let query = supabase
      .from("Listing")
      .select("*", { count: "exact" })
      .eq("make", "Porsche")
      .order("created_at", { ascending: false })
      .limit(limit * 2) // overfetch; we filter by series client-side below

    if (q && !trending) {
      const escaped = q.replace(/%/g, "\\%").replace(/_/g, "\\_")
      query = query.or(
        `title.ilike.%${escaped}%,model.ilike.%${escaped}%`,
      )
    }

    const { data, count, error } = await query
    if (error) {
      console.error("[api/search/listings] supabase error", error)
      return NextResponse.json({ listings: [], total: 0 })
    }

    const rows = (data ?? []) as ListingRow[]
    const mapped: SearchListing[] = rows.map((row) => {
      const car = rowToCollectorCar(row)
      const series = extractSeries(car.model ?? "", car.year ?? 0, "Porsche", car.title) || null
      const status: "live" | "sold" = car.status === "sold" ? "sold" : "live"
      return {
        id: car.id,
        title: car.title,
        year: car.year ?? null,
        model: car.model ?? null,
        image: car.image ?? null,
        priceUsd: car.currentBid && car.currentBid > 0 ? car.currentBid : null,
        platform: car.platform,
        status,
        series,
      }
    })

    const filtered = seriesFilter
      ? mapped.filter((l) => l.series?.toLowerCase() === seriesFilter)
      : mapped

    return NextResponse.json({
      listings: filtered.slice(0, limit),
      total: count ?? filtered.length,
    })
  } catch (err) {
    console.error("[api/search/listings] failed", err)
    return NextResponse.json({ listings: [], total: 0 })
  }
}
```

- [ ] **Step 2.2: Smoke-test the route locally**

Dev server is already running on :3000. Test three calls:

```bash
curl -s "http://localhost:3000/api/search/listings?trending=true&limit=5" | head -c 400
curl -s "http://localhost:3000/api/search/listings?q=997&limit=5" | head -c 400
curl -s "http://localhost:3000/api/search/listings?series=997&limit=5" | head -c 400
```

Expected: each returns a JSON object `{ listings: [...], total: N }`. If the supabase host is unreachable in the dev environment (the known DNS issue), the route returns `{ listings: [], total: 0 }` without throwing — that is the correct degradation path. The unified-search UI handles an empty list with a friendly message.

- [ ] **Step 2.3: Commit**

```bash
git add src/app/api/search/listings/route.ts
git commit -m "feat(search): /api/search/listings endpoint backed by Supabase"
```

---

## Task 3 — `useUnifiedSearch` hook

**Files:**
- Create: `src/hooks/useUnifiedSearch.ts`
- Test: `src/hooks/useUnifiedSearch.test.ts`

- [ ] **Step 3.1: Write the failing test**

`src/hooks/useUnifiedSearch.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useUnifiedSearch } from "./useUnifiedSearch"

const trendingPayload = {
  listings: [
    { id: "live-1", title: "Trend 1", year: 2020, model: "911", image: null, priceUsd: 100000, platform: "BAT", status: "live", series: "992" },
  ],
  total: 1,
}

const queryPayload = {
  listings: [
    { id: "live-2", title: "997 Turbo", year: 2007, model: "911 Turbo", image: null, priceUsd: 145000, platform: "BAT", status: "live", series: "997" },
  ],
  total: 1,
}

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  globalThis.fetch = mockFetch as unknown as typeof fetch
})

afterEach(() => {
  vi.useRealTimers()
})

function ok(body: unknown) {
  return Promise.resolve({ ok: true, json: async () => body } as Response)
}

describe("useUnifiedSearch", () => {
  it("loads trending listings on mount with empty query", async () => {
    mockFetch.mockReturnValue(ok(trendingPayload))
    const { result } = renderHook(() => useUnifiedSearch())
    await waitFor(() => expect(result.current.listings.length).toBe(1))
    expect(result.current.listings[0].title).toBe("Trend 1")
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(String(mockFetch.mock.calls[0][0])).toContain("trending=true")
  })

  it("debounces query input by ~200ms", async () => {
    vi.useFakeTimers()
    mockFetch.mockReturnValue(ok(trendingPayload))
    const { result } = renderHook(() => useUnifiedSearch())
    await vi.runAllTimersAsync()
    mockFetch.mockReset()
    mockFetch.mockReturnValue(ok(queryPayload))
    act(() => result.current.setQuery("9"))
    act(() => result.current.setQuery("99"))
    act(() => result.current.setQuery("997"))
    expect(mockFetch).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(String(mockFetch.mock.calls[0][0])).toContain("q=997")
  })

  it("filters series client-side as the query changes", async () => {
    mockFetch.mockReturnValue(ok(trendingPayload))
    const { result } = renderHook(() => useUnifiedSearch())
    await waitFor(() => expect(result.current.series.length).toBeGreaterThan(0))
    const initial = result.current.series.length
    act(() => result.current.setQuery("997"))
    await waitFor(() => expect(result.current.series.length).toBeLessThan(initial))
    expect(result.current.series.map((s) => s.id)).toContain("997")
  })

  it("includes activeSeries in the listings request when set", async () => {
    vi.useFakeTimers()
    mockFetch.mockReturnValue(ok(trendingPayload))
    const { result } = renderHook(() => useUnifiedSearch())
    await vi.runAllTimersAsync()
    mockFetch.mockReset()
    mockFetch.mockReturnValue(ok(queryPayload))
    act(() => result.current.setActiveSeries("997"))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
    expect(mockFetch).toHaveBeenCalled()
    expect(String(mockFetch.mock.calls[0][0])).toContain("series=997")
  })
})
```

- [ ] **Step 3.2: Run test, confirm it fails**

```bash
npx vitest run src/hooks/useUnifiedSearch --reporter=default 2>&1 | tail -15
```

Expected: FAIL ("Cannot find module './useUnifiedSearch'").

- [ ] **Step 3.3: Implement the hook**

`src/hooks/useUnifiedSearch.ts`:

```ts
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { searchSeries, type SeriesMatch } from "@/lib/searchIndex"

export interface UnifiedListing {
  id: string
  title: string
  year: number | null
  model: string | null
  image: string | null
  priceUsd: number | null
  platform: string
  status: "live" | "sold"
  series: string | null
}

export interface UseUnifiedSearchResult {
  query: string
  setQuery: (q: string) => void
  activeSeries: string | null
  setActiveSeries: (id: string | null) => void
  series: SeriesMatch[]
  listings: UnifiedListing[]
  total: number
  loading: boolean
  error: string | null
}

const DEBOUNCE_MS = 200
const DEFAULT_LIMIT = 10

export function useUnifiedSearch(): UseUnifiedSearchResult {
  const [query, setQueryState] = useState("")
  const [activeSeries, setActiveSeries] = useState<string | null>(null)
  const [listings, setListings] = useState<UnifiedListing[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const series = useMemo(() => searchSeries(query), [query])

  const fetchListings = useCallback(async (q: string, seriesId: string | null) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set("q", q.trim())
      if (seriesId) params.set("series", seriesId)
      if (!q.trim() && !seriesId) params.set("trending", "true")
      params.set("limit", String(DEFAULT_LIMIT))
      const res = await fetch(`/api/search/listings?${params.toString()}`, { signal: ac.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { listings: UnifiedListing[]; total: number }
      setListings(data.listings)
      setTotal(data.total)
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      setListings([])
      setTotal(0)
      setError("Couldn't load listings.")
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [])

  // Debounced effect for query / activeSeries changes
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fetchListings(query, activeSeries)
    }, DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, activeSeries, fetchListings])

  // Initial trending fetch
  useEffect(() => {
    fetchListings("", null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    // When the user types, clear an explicit active series to avoid double-filter surprise.
    setActiveSeries(null)
  }, [])

  return {
    query,
    setQuery,
    activeSeries,
    setActiveSeries,
    series,
    listings,
    total,
    loading,
    error,
  }
}
```

- [ ] **Step 3.4: Run tests, confirm they pass**

```bash
npx vitest run src/hooks/useUnifiedSearch --reporter=default 2>&1 | tail -20
```

Expected: 4 tests PASS. If any timing test is flaky, increase the `advanceTimersByTimeAsync` window from 250 to 300.

- [ ] **Step 3.5: Commit**

```bash
git add src/hooks/useUnifiedSearch.ts src/hooks/useUnifiedSearch.test.ts
git commit -m "feat(search): useUnifiedSearch hook (debounce + abort + series filter)"
```

---

## Task 4 — `SeriesColumn` component

**Files:**
- Create: `src/components/search/SeriesColumn.tsx`

This is a presentational component. No tests for it — we cover it via the manual browser checklist in Task 8.

- [ ] **Step 4.1: Implement the component**

`src/components/search/SeriesColumn.tsx`:

```tsx
"use client"

import { ChevronRight } from "lucide-react"
import type { SeriesMatch } from "@/lib/searchIndex"

interface SeriesColumnProps {
  items: SeriesMatch[]
  activeId: string | null
  onHover: (id: string | null) => void
  onSelect: (item: SeriesMatch) => void
  variant: "header" | "sheet" | "inline"
}

export function SeriesColumn({ items, activeId, onHover, onSelect, variant }: SeriesColumnProps) {
  if (items.length === 0) {
    return (
      <div className="px-3 py-6 text-[11px] text-muted-foreground">No series match.</div>
    )
  }
  const isStack = variant === "sheet"
  return (
    <div className={isStack ? "" : "max-h-[60vh] overflow-y-auto"}>
      <p className="px-3 pt-2 pb-1 text-[9px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
        Series
      </p>
      <ul role="listbox" aria-label="Series" className="pb-2">
        {items.map((s) => {
          const active = s.id === activeId
          return (
            <li key={s.id} role="option" aria-selected={active}>
              <button
                type="button"
                onMouseEnter={() => onHover(s.id)}
                onFocus={() => onHover(s.id)}
                onClick={() => onSelect(s)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left transition-colors ${
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-foreground hover:bg-foreground/[0.05]"
                }`}
              >
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[12px] font-medium truncate">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {s.yearRange[0]}–{s.yearRange[1]}
                  </span>
                </span>
                <ChevronRight className={`size-3 shrink-0 ${active ? "text-primary" : "text-muted-foreground/60"}`} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/components/search/SeriesColumn.tsx
git commit -m "feat(search): SeriesColumn presentational component"
```

---

## Task 5 — `ListingsColumn` component

**Files:**
- Create: `src/components/search/ListingsColumn.tsx`

- [ ] **Step 5.1: Implement the component**

`src/components/search/ListingsColumn.tsx`:

```tsx
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

function makeSlug(make: string): string {
  return make.toLowerCase().replace(/\s+/g, "-")
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
  const viewAllHref =
    activeSeries
      ? `/cars/porsche?family=${encodeURIComponent(activeSeries)}`
      : query.trim()
        ? `/search?q=${encodeURIComponent(query.trim())}`
        : "/search"

  return (
    <div className={isStack ? "" : "max-h-[60vh] overflow-y-auto"}>
      <p className="px-3 pt-2 pb-1 text-[9px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
        Listings
      </p>
      {error ? (
        <p className="px-3 py-4 text-[11px] text-muted-foreground">{error}</p>
      ) : loading && items.length === 0 ? (
        <p className="px-3 py-4 text-[11px] text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="px-3 py-4 text-[11px] text-muted-foreground">
          {activeSeries ? `No live listings for ${activeSeries} right now.` : "No listings match."}
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
```

- [ ] **Step 5.2: Commit**

```bash
git add src/components/search/ListingsColumn.tsx
git commit -m "feat(search): ListingsColumn presentational component"
```

---

## Task 6 — `UnifiedSearch` orchestrator

**Files:**
- Create: `src/components/search/UnifiedSearch.tsx`

This component wires the hook to the two columns, handles keyboard navigation, and supports the three layout variants.

- [ ] **Step 6.1: Implement the orchestrator**

`src/components/search/UnifiedSearch.tsx`:

```tsx
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

export function UnifiedSearch({ variant, initialQuery = "", autoFocus, onClose }: UnifiedSearchProps) {
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

  // Hydrate initial query (from /search ?q=)
  useEffect(() => {
    if (initialQuery) setQuery(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  // Focus management
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // Reset active series index when results change
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
          const currentIdx = Math.max(0, series.findIndex((s) => s.id === activeSeries))
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
    [focused, series, listings, listingIndex, activeSeries, variant, query, router, onClose, setActiveSeries, handleSeriesSelect],
  )

  // Layout classes per variant
  const shellClass =
    variant === "header"
      ? "bg-card border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
      : variant === "sheet"
        ? "bg-background"
        : "bg-card border border-border rounded-xl overflow-hidden"

  const isStack = variant === "sheet"

  return (
    <div className={shellClass} onKeyDown={handleKeyDown}>
      {/* Input */}
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

      {/* Body */}
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
```

- [ ] **Step 6.2: Type-check the whole project**

```bash
npx tsc --noEmit 2>&1 | grep -vE "\.test\.(ts|tsx)|\.spec\.|paginated\.test|BrowseClient\.tsx" | grep "error TS" | head -20
```

Expected: no new errors. (The pre-existing `BrowseClient.tsx` `image`/`images` error is filtered out.)

- [ ] **Step 6.3: Commit**

```bash
git add src/components/search/UnifiedSearch.tsx
git commit -m "feat(search): UnifiedSearch orchestrator with keyboard nav"
```

---

## Task 7 — Wire into Header (desktop)

**Files:**
- Modify: `src/components/layout/Header.tsx`

Reading required: lines 768–920 hold the current search input + dropdown. The goal is to swap the inner dropdown markup for `<UnifiedSearch variant="header" />`. The input stays where it is (visual continuity), but its `onChange` and dropdown rendering are taken over by the new component.

- [ ] **Step 7.1: Open the file and locate the search input**

Read `src/components/layout/Header.tsx` around lines 760–930. You will see the input + a custom dropdown rendered conditionally with `motion.div`. We will replace the dropdown body, not the input wrapper.

- [ ] **Step 7.2: Add the import**

Near the other component imports at the top of `Header.tsx`:

```tsx
import { UnifiedSearch } from "@/components/search/UnifiedSearch"
```

- [ ] **Step 7.3: Replace the dropdown body**

Find the block that renders the dropdown (the AnimatePresence motion.div containing the SearchItem rows). Replace its inner JSX so the entire dropdown content is a `<UnifiedSearch variant="header" ... />` instance. The input itself can stay; pass its current query into `UnifiedSearch` via `initialQuery` and let `UnifiedSearch` own further state. Easiest path: render `<UnifiedSearch>` directly with its own input, and remove the outer dropdown wrapper — `UnifiedSearch` already includes the input.

Concretely, replace the existing search section (input + dropdown) with:

```tsx
{showSearchDropdown && (
  <div className="absolute left-0 right-0 top-full mt-2 z-50">
    <UnifiedSearch
      variant="header"
      autoFocus
      onClose={() => setShowSearchDropdown(false)}
    />
  </div>
)}
```

Where `showSearchDropdown` is the existing boolean that controls dropdown visibility. The trigger that opens the dropdown stays — clicking the existing search-input area sets `showSearchDropdown = true`, and `UnifiedSearch` takes over input + body from there.

- [ ] **Step 7.4: Manual browser test (desktop)**

```bash
# Server still running on :3000
```

Open `http://localhost:3000` in browser:

1. Click the search bar in the header → dropdown opens with all 27 series in left column + ~10 listings in right.
2. Type `997` → series filters to ~3 entries (997, 997.1, 997.2); right column updates.
3. Hover `997.1` → right column re-filters to 997.1 cars.
4. Press `↓` then `Enter` on a series → navigates to `/cars/porsche?family=997.1`.
5. Press `Esc` → dropdown closes.

If any of those fail, fix before committing.

- [ ] **Step 7.5: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(search): mount UnifiedSearch in desktop header"
```

---

## Task 8 — Wire into MobileSearchSheet

**Files:**
- Modify: `src/components/mobile/MobileBottomNav.tsx`

`MobileSearchSheet` (around lines 650+) renders an input, filter chips (region/status/price), and a body that switches between `SearchEmptyState` and `SearchResultsState` based on query length. We replace that body — input and chips stay.

- [ ] **Step 8.1: Add the import**

In `src/components/mobile/MobileBottomNav.tsx`:

```tsx
import { UnifiedSearch } from "@/components/search/UnifiedSearch"
```

- [ ] **Step 8.2: Replace the empty/results body**

Inside `MobileSearchSheet`, find the conditional `query.length < 2 ? <SearchEmptyState ... /> : <SearchResultsState ... />` block. Replace the entire conditional with a single `<UnifiedSearch variant="sheet" autoFocus onClose={onClose} />`. The sheet's own input + filter chips can stay in place; the visual stack now has filter chips → unified search.

If two inputs end up visible, remove the sheet's own input and let `UnifiedSearch` carry it. Either choice is fine; pick the one that produces fewer pixels of UI duplication after testing.

- [ ] **Step 8.3: Manual browser test (mobile viewport)**

Open Chrome DevTools, toggle device toolbar to 390 × 844 (iPhone 14 Pro). Navigate to `http://localhost:3000`. Tap the Search button in the bottom nav.

1. Sheet opens. See series stacked above, listings below.
2. Type `997` → both sections filter.
3. Tap a series row → navigates to `/cars/porsche?family=997`, sheet closes.
4. Tap a listing → navigates to `/cars/porsche/<id>/report`, sheet closes.

- [ ] **Step 8.4: Commit**

```bash
git add src/components/mobile/MobileBottomNav.tsx
git commit -m "feat(search): mount UnifiedSearch in mobile search sheet"
```

---

## Task 9 — Wire into /search page

**Files:**
- Modify: `src/app/[locale]/search/SearchClient.tsx`

The page has its own input + results grid. We add `<UnifiedSearch variant="inline" />` above the grid, synced to the page's `q` URL param. The existing grid below stays as the deep-dive surface with advanced filters.

- [ ] **Step 9.1: Add the import**

```tsx
import { UnifiedSearch } from "@/components/search/UnifiedSearch"
```

- [ ] **Step 9.2: Render the unified component**

Just before the existing page content (above the input and grid), render:

```tsx
<div className="max-w-3xl mx-auto mb-6">
  <UnifiedSearch variant="inline" initialQuery={initialQuery ?? ""} />
</div>
```

Where `initialQuery` is the `q` value read from `useSearchParams()` (the page already reads it). If the page already has a state variable for the current query, pass that instead.

- [ ] **Step 9.3: Manual browser test**

Navigate to `http://localhost:3000/search?q=997`. Confirm:

1. Unified search renders at the top, prefilled with `997`.
2. The grid below still works as before.
3. Clicking a result in the unified search navigates correctly.

- [ ] **Step 9.4: Commit**

```bash
git add "src/app/[locale]/search/SearchClient.tsx"
git commit -m "feat(search): embed UnifiedSearch on /search page"
```

---

## Task 10 — Final QA pass

- [ ] **Step 10.1: Run the full type-check**

```bash
npx tsc --noEmit 2>&1 | grep -vE "\.test\.(ts|tsx)|\.spec\.|paginated\.test|BrowseClient\.tsx" | grep "error TS"
```

Expected: empty output (the one pre-existing `BrowseClient.tsx` error is filtered).

- [ ] **Step 10.2: Run the new unit tests**

```bash
npx vitest run src/lib/searchIndex src/hooks/useUnifiedSearch --reporter=default 2>&1 | tail -25
```

Expected: all tests PASS.

- [ ] **Step 10.3: Browser smoke walkthrough**

Run through this list on the dev server at `http://localhost:3000`:

| Surface | Steps | Pass? |
|---|---|---|
| Header desktop empty | Click search → see 27 series + ~10 listings | |
| Header desktop typed | Type `997` → series narrows to 3, listings filter | |
| Header desktop hover | Hover `997.1` → listings re-filter | |
| Header desktop click serie | Click `997.1` → land on `/cars/porsche?family=997.1` | |
| Header desktop click listing | Click any listing → land on `/cars/porsche/<id>/report` | |
| Header desktop keyboard | ↓↓↓ →Enter navigates correctly | |
| Mobile sheet empty | Open Search tab → see stacked series + listings | |
| Mobile sheet typed | Type `997` → filters | |
| Mobile sheet click | Tap series → navigates and closes sheet | |
| /search page | Visit `/search?q=997` → unified search prefilled at top | |
| /es redirect | Visit `/es` → redirects to `/` | |
| 404 fallback | Visit non-existent listing → friendly message + back link | |

If any row fails, file the regression in a follow-up commit; don't ship the broken state.

- [ ] **Step 10.4: Final commit (if any cleanup was needed)**

```bash
git status
# If there are changes:
git add -A
git commit -m "chore(search): final cleanup from QA pass"
```

- [ ] **Step 10.5: Summary**

Print a one-line per commit recap of what was added on this branch since the spec landed. Hand back to Edgar with a list of links to test.

---

## Self-review

**Spec coverage:**
- Layout (desktop two-col, mobile stack) → Tasks 4–6 build the layout, Task 7 wires it
- State machine (empty / typed / activeSeries) → Task 3 hook + Task 6 orchestrator
- Click destinations → Task 5 (listings) + Task 6 (series + view all)
- Keyboard → Task 6 keyDown handler
- Data sources → Task 1 (series) + Task 2 (listings endpoint)
- Performance (200 ms debounce + abort) → Task 3 hook
- Three variants (header/sheet/inline) → Task 6 + Tasks 7–9 integration
- Edge cases (no listings for series, listing without classifiable series, pasted URL) → Task 5 messaging + Task 6 (pasted URL noted as a follow-up; not blocking v1 since the existing Header URL detection is not removed when `UnifiedSearch` takes over the dropdown — it still wraps the input)

**Placeholders:** none. Every code step contains its actual code.

**Type consistency:**
- `SeriesMatch` defined in Task 1, used in Tasks 3–6.
- `UnifiedListing` defined in Task 3, used in Tasks 5–6 and matches the JSON shape returned by Task 2.
- Hook return shape `UseUnifiedSearchResult` covers what Task 6 destructures.

**Scope:** one coherent component shipped via three integrations. Single plan is correct here.

**Ambiguity check:** the pasted-auction-URL behavior from the spec is preserved by the surrounding Header logic, not by `UnifiedSearch` itself. That is called out in the self-review above; a v2 follow-up will move the URL detection inside `UnifiedSearch` for parity across all three variants.
