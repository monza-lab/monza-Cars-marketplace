// src/hooks/useListingRewrite.ts
"use client"

import { useEffect, useState } from "react"

export interface ListingRewritePayload {
  headline: string
  highlights: string[]
}

interface State {
  data: ListingRewritePayload | null
  isLoading: boolean
}

const memoryCache = new Map<string, ListingRewritePayload | null>()

export function useListingRewrite(listingId: string, locale: string): State {
  const cacheKey = `${listingId}|${locale}`
  const seeded = memoryCache.has(cacheKey) ? memoryCache.get(cacheKey)! : null
  const [state, setState] = useState<State>({
    data: seeded,
    isLoading: !memoryCache.has(cacheKey),
  })

  useEffect(() => {
    if (memoryCache.has(cacheKey)) {
      setState({ data: memoryCache.get(cacheKey) ?? null, isLoading: false })
      return
    }
    let cancelled = false
    setState({ data: null, isLoading: true })

    fetch(`/api/listings/${encodeURIComponent(listingId)}/rewrite?locale=${encodeURIComponent(locale)}`, {
      headers: { accept: "application/json" },
    })
      .then(async res => {
        if (cancelled) return
        if (res.status === 200) {
          const json = (await res.json()) as ListingRewritePayload
          memoryCache.set(cacheKey, json)
          setState({ data: json, isLoading: false })
          return
        }
        // 204 / 4xx / 5xx — all treated as "no data; show placeholder"
        memoryCache.set(cacheKey, null)
        setState({ data: null, isLoading: false })
      })
      .catch(() => {
        if (cancelled) return
        memoryCache.set(cacheKey, null)
        setState({ data: null, isLoading: false })
      })

    return () => {
      cancelled = true
    }
  }, [cacheKey, listingId, locale])

  return state
}
