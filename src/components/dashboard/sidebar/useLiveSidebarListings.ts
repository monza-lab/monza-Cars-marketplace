"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { extractSeries, getBrandConfig } from "@/lib/brandConfig"

export type LiveSidebarAuction = {
  id: string
  title: string
  make: string
  model: string
  year: number
  trim: string | null
  price: number
  currentBid: number
  bidCount: number
  viewCount: number
  watchCount: number
  status: string
  endTime: string
  platform: string
  engine: string | null
  transmission: string | null
  exteriorColor: string | null
  mileage: number | null
  mileageUnit: string | null
  location: string | null
  region?: string | null
  description: string | null
  images: string[]
}

type UseLiveSidebarListingsOptions<T extends LiveSidebarAuction> = {
  seedAuctions: T[]
  seedKey: string
  make?: string
  activeFamilyName?: string
  region?: string | null
  pageSize?: number
  enabled?: boolean
}

type LiveSidebarFetchResponse<T extends LiveSidebarAuction> = {
  auctions?: T[]
  hasMore?: boolean
  nextCursor?: string | null
  totalCount?: number | null
  totalLiveCount?: number | null
}

const DEFAULT_PAGE_SIZE = 8

function isLiveStatus(status: string): boolean {
  return status === "ACTIVE" || status === "ENDING_SOON" || status === "LIVE"
}

function sortLiveAuctions<T extends LiveSidebarAuction>(auctions: T[]): T[] {
  return [...auctions].sort((a, b) => {
    const aTime = new Date(a.endTime).getTime()
    const bTime = new Date(b.endTime).getTime()
    if (aTime !== bTime) return aTime - bTime
    return a.id.localeCompare(b.id)
  })
}

function matchesFamily<T extends LiveSidebarAuction>(auction: T, activeFamilyName?: string): boolean {
  if (!activeFamilyName) return true
  return extractSeries(auction.model, auction.year, auction.make || "Porsche", auction.title).toLowerCase() ===
    activeFamilyName.toLowerCase()
}

function resolveFamilySeriesId(make: string | undefined, activeFamilyName?: string): string | null {
  if (!activeFamilyName) return null

  const target = activeFamilyName.trim().toLowerCase()
  const config = getBrandConfig(make ?? "Porsche")
  if (!config) return target

  const series = config.series.find((entry) => {
    const id = entry.id.toLowerCase()
    const label = entry.label.toLowerCase()
    return id === target || label === target
  })

  return series?.id ?? target
}

export function filterLiveSidebarAuctions<T extends LiveSidebarAuction>(
  auctions: T[],
  options?: { activeFamilyName?: string; activeFamilyKey?: string; pageSize?: number },
): T[] {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
  const familyKey = options?.activeFamilyKey ?? options?.activeFamilyName
  return sortLiveAuctions(
    auctions.filter(
      (auction) =>
        isLiveStatus(auction.status) &&
        new Date(auction.endTime).getTime() > Date.now() &&
        matchesFamily(auction, familyKey),
    ),
  ).slice(0, pageSize)
}

function dedupeById<T extends LiveSidebarAuction>(auctions: T[]): T[] {
  const seen = new Set<string>()
  const deduped: T[] = []
  for (const auction of auctions) {
    if (seen.has(auction.id)) continue
    seen.add(auction.id)
    deduped.push(auction)
  }
  return deduped
}

export function useLiveSidebarListings<T extends LiveSidebarAuction>({
  seedAuctions,
  seedKey,
  make,
  activeFamilyName,
  region,
  pageSize = DEFAULT_PAGE_SIZE,
  enabled = true,
}: UseLiveSidebarListingsOptions<T>) {
  const seedAuctionsRef = useRef(seedAuctions)
  seedAuctionsRef.current = seedAuctions
  const resolvedFamilyKey = resolveFamilySeriesId(make, activeFamilyName)

  const initialSeedRows = filterLiveSidebarAuctions(seedAuctions, {
    activeFamilyName,
    activeFamilyKey: resolvedFamilyKey ?? undefined,
    pageSize,
  })

  const [rows, setRows] = useState<T[]>(() =>
    initialSeedRows,
  )
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(initialSeedRows.length === 0)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [liveCount, setLiveCount] = useState<number>(initialSeedRows.length)
  const [error, setError] = useState<string | null>(null)
  const [scrollRootNode, setScrollRootNode] = useState<HTMLElement | null>(null)
  const [sentinelNode, setSentinelNode] = useState<HTMLElement | null>(null)

  const requestIdRef = useRef(0)
  const rowsCountRef = useRef(initialSeedRows.length)
  const cursorRef = useRef<string | null>(cursor)
  const hasMoreRef = useRef(hasMore)
  const isFetchingMoreRef = useRef(isFetchingMore)

  rowsCountRef.current = rows.length
  cursorRef.current = cursor
  hasMoreRef.current = hasMore
  isFetchingMoreRef.current = isFetchingMore

  const scrollRootCallbackRef = useCallback(
    (node: HTMLElement | null) => {
      setScrollRootNode(node)
    },
    [],
  )

  const sentinelRef = useCallback((node: HTMLElement | null) => {
    setSentinelNode(node)
  }, [])

  const loadNextPage = useCallback(async () => {
    if (!enabled || isFetchingMoreRef.current || !hasMoreRef.current) return

    const capturedRequestId = requestIdRef.current
    const pageCursor = cursorRef.current
    const page = pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE
    const params = new URLSearchParams()
    params.set("pageSize", String(page))
    if (make) params.set("make", make)
    if (pageCursor) params.set("cursor", pageCursor)
    if (region && region !== "all") params.set("region", region)
    if (resolvedFamilyKey) params.set("family", resolvedFamilyKey)

    setError(null)
    if (rowsCountRef.current === 0) setIsLoading(true)
    else setIsFetchingMore(true)

    try {
      const response = await fetch(`/api/mock-auctions?${params.toString()}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = (await response.json()) as LiveSidebarFetchResponse<T>

      if (capturedRequestId !== requestIdRef.current) return

      const incoming = (data.auctions ?? []).filter((auction) => isLiveStatus(auction.status))

      setRows((prev) => dedupeById(sortLiveAuctions([...prev, ...incoming])))
      setCursor(data.nextCursor ?? null)
      setHasMore(Boolean(data.hasMore))
      setLiveCount(
        typeof data.totalCount === "number"
          ? data.totalCount
          : typeof data.totalLiveCount === "number"
            ? data.totalLiveCount
            : rowsCountRef.current,
      )
    } catch (loadError) {
      if (capturedRequestId !== requestIdRef.current) return
      setError(loadError instanceof Error ? loadError.message : "Failed to load live listings")
      setHasMore(false)
    } finally {
      if (capturedRequestId === requestIdRef.current) {
        setIsLoading(false)
        setIsFetchingMore(false)
      }
    }
  }, [enabled, make, pageSize, region, resolvedFamilyKey])

  useEffect(() => {
    requestIdRef.current += 1

    const seedRows = filterLiveSidebarAuctions(seedAuctionsRef.current, {
      activeFamilyName,
      activeFamilyKey: resolvedFamilyKey ?? undefined,
      pageSize,
    })
    setRows(seedRows)
    setCursor(null)
    setHasMore(true)
    setLiveCount(seedRows.length)
    setError(null)
    setIsLoading(seedRows.length === 0)
    setIsFetchingMore(false)
  }, [pageSize, resolvedFamilyKey, seedKey, activeFamilyName])

  useEffect(() => {
    if (!enabled) return
    void loadNextPage()
  }, [enabled, loadNextPage, seedKey])

  useEffect(() => {
    if (!scrollRootNode || !sentinelNode) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && hasMoreRef.current && !isFetchingMoreRef.current) {
          void loadNextPage()
        }
      },
      {
        root: scrollRootNode,
        rootMargin: "200px",
      },
    )

    observer.observe(sentinelNode)

    return () => {
      observer.disconnect()
    }
  }, [loadNextPage, scrollRootNode, sentinelNode])

  const liveAuctions = useMemo(() => rows, [rows])

  return {
    liveAuctions,
    liveCount,
    scrollRootRef: scrollRootCallbackRef,
    sentinelRef,
    isLoading,
    isFetchingMore,
    hasMore,
    error,
  }
}
