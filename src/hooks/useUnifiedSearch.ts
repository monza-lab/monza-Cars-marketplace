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

  // Debounced effect for query / activeSeries changes (skips initial mount; that's handled below).
  const hasMountedRef = useRef(false)
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fetchListings(query, activeSeries)
    }, DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, activeSeries, fetchListings])

  // Initial trending fetch (immediate, no debounce)
  useEffect(() => {
    fetchListings("", null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
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
