"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { extractSeries, resolveSeriesIdForFamily } from "@/lib/brandConfig";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UseInfiniteAuctionsParams {
  make: string;
  family?: string;       // client-side filter via extractSeries() — NOT sent to API
  region?: string;       // sent to API
  platform?: string;     // sent to API
  query?: string;        // sent to API
  sortBy?: string;       // sent to API
  sortOrder?: string;    // sent to API
  enabled?: boolean;     // default true, set false to disable fetching
}

interface Aggregates {
  liveNow: number;
  regionTotals: { all: number; US: number; EU: number; UK: number; JP: number };
}

interface UseInfiniteAuctionsResult {
  cars: any[];                    // accumulated auction objects across pages
  total: number;                  // aggregates.liveNow (DB count)
  totalCount: number | null;      // planned DB count for current filters (all statuses the query returns)
  totalLiveCount: number | null;  // planned DB count restricted to status='active'
  aggregates: Aggregates | null;
  isLoading: boolean;             // first page loading
  isFetchingMore: boolean;        // subsequent page loading
  hasMore: boolean;
  error: string | null;
  sentinelRef: (node: HTMLElement | null) => void;  // ref callback for sentinel div
  reset: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const MIN_FILTERED_RESULTS = 10;
const MAX_AUTO_FETCHES = 3;

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useInfiniteAuctions(
  params: UseInfiniteAuctionsParams,
): UseInfiniteAuctionsResult {
  const {
    make,
    family,
    region,
    platform,
    query,
    sortBy,
    sortOrder,
    enabled = true,
  } = params;
  const resolvedFamily = resolveSeriesIdForFamily(make, family) ?? family;

  // ── State ──
  const [cars, setCars] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [totalLiveCount, setTotalLiveCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Refs ──
  const requestIdRef = useRef(0);
  const sentinelNodeRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const autoFetchCountRef = useRef(0);

  // Keep a ref to the latest cursor so fetchPage always reads the current value
  const cursorRef = useRef<string | null>(null);
  cursorRef.current = cursor;

  // Keep a ref to hasMore for the observer callback
  const hasMoreRef = useRef(true);
  hasMoreRef.current = hasMore;

  // Keep a ref to isFetchingMore for the observer callback
  const isFetchingMoreRef = useRef(false);
  isFetchingMoreRef.current = isFetchingMore;

  // ── Build URL ──
  const buildUrl = useCallback(
    (pageCursor: string | null): string => {
      const url = new URL("/api/mock-auctions", window.location.origin);
      url.searchParams.set("pageSize", String(PAGE_SIZE));
      url.searchParams.set("make", make);

      if (pageCursor) url.searchParams.set("cursor", pageCursor);
      if (resolvedFamily) url.searchParams.set("family", resolvedFamily);
      if (region && region !== "all") url.searchParams.set("region", region);
      if (platform && platform !== "All Platforms")
        url.searchParams.set("platform", platform);
      if (query) url.searchParams.set("query", query);
      if (sortBy) url.searchParams.set("sortBy", sortBy);
      if (sortOrder) url.searchParams.set("sortOrder", sortOrder);

      return url.toString();
    },
    [make, resolvedFamily, region, platform, query, sortBy, sortOrder],
  );

  // ── Fetch a single page ──
  const fetchPage = useCallback(
    async (
      pageCursor: string | null,
      isFirstPage: boolean,
      capturedRequestId: number,
    ): Promise<{ filteredNew: any[]; nextCursor: string | null; pageHasMore: boolean }> => {
      const url = buildUrl(pageCursor);

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      // Discard stale response
      if (capturedRequestId !== requestIdRef.current) {
        return { filteredNew: [], nextCursor: null, pageHasMore: false };
      }

      // Cache aggregates and total count from the first page
      if (data.aggregates) {
        setAggregates(data.aggregates);
      }
      if (data.totalCount !== undefined) {
        setTotalCount(data.totalCount);
      }
      if (data.totalLiveCount !== undefined) {
        setTotalLiveCount(data.totalLiveCount);
      }

      const rawAuctions: any[] = data.auctions ?? [];
      const nextCursor: string | null = data.nextCursor ?? null;
      const pageHasMore: boolean = data.hasMore ?? false;

      // Client-side safety net: only active listings reach the UI
      const activeAuctions = rawAuctions.filter(
        (c: any) => c.status === "ACTIVE" || c.status === "ENDING_SOON"
      );

      // Client-side family filter
      let filtered = activeAuctions;
      if (resolvedFamily) {
        filtered = activeAuctions.filter(
          (car: any) =>
            extractSeries(car.model ?? "", car.year ?? 0, car.make ?? make, car.title ?? "") === resolvedFamily,
        );
      }

      return { filteredNew: filtered, nextCursor, pageHasMore };
    },
    [buildUrl, resolvedFamily, make],
  );

  // ── Load next page (orchestrator) ──
  const loadNextPage = useCallback(async () => {
    if (!enabled) return;

    const isFirstPage = cursorRef.current === null && cars.length === 0;

    if (isFirstPage) {
      setIsLoading(true);
    } else {
      setIsFetchingMore(true);
    }
    setError(null);

    const capturedRequestId = requestIdRef.current;
    autoFetchCountRef.current = 0;

    try {
      let currentCursor = cursorRef.current;
      let accumulatedNew: any[] = [];
      let currentHasMore = true;

      // Fetch pages, auto-fetching more if family filter yields too few results
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { filteredNew, nextCursor, pageHasMore } = await fetchPage(
          currentCursor,
          isFirstPage && accumulatedNew.length === 0,
          capturedRequestId,
        );

        // Stale check
        if (capturedRequestId !== requestIdRef.current) return;

        accumulatedNew = [...accumulatedNew, ...filteredNew];
        currentCursor = nextCursor;
        currentHasMore = pageHasMore;

        // Decide whether to auto-fetch another page
        const needsMore =
          resolvedFamily &&
          accumulatedNew.length < MIN_FILTERED_RESULTS &&
          currentHasMore &&
          autoFetchCountRef.current < MAX_AUTO_FETCHES;

        if (needsMore) {
          autoFetchCountRef.current++;
          continue;
        }
        break;
      }

      // Stale check
      if (capturedRequestId !== requestIdRef.current) return;

      // Deduplicate by id when appending
      setCars((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const uniqueNew = accumulatedNew.filter((c) => !existingIds.has(c.id));
        return [...prev, ...uniqueNew];
      });

      setCursor(currentCursor);
      cursorRef.current = currentCursor;
      setHasMore(currentHasMore);
    } catch (err: any) {
      if (capturedRequestId !== requestIdRef.current) return;
      setError(err?.message ?? "Failed to fetch auctions");
    } finally {
      if (capturedRequestId === requestIdRef.current) {
        setIsLoading(false);
        setIsFetchingMore(false);
      }
    }
  }, [enabled, cars.length, fetchPage, resolvedFamily]);

  // ── Reset ──
  const reset = useCallback(() => {
    requestIdRef.current++;
    setCars([]);
    setCursor(null);
    cursorRef.current = null;
    setHasMore(true);
    setAggregates(null);
    setTotalCount(null);
    setTotalLiveCount(null);
    setError(null);
    // Keep isLoading=true during reset→refetch transition to prevent
    // a flash of the "no listings" empty state before new data loads.
    setIsLoading(true);
    setIsFetchingMore(false);
    autoFetchCountRef.current = 0;

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, []);

  // ── Sentinel ref callback (IntersectionObserver) ──
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      // Disconnect previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      sentinelNodeRef.current = node;

      if (!node) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (
            entry?.isIntersecting &&
            hasMoreRef.current &&
            !isFetchingMoreRef.current
          ) {
            // Trigger next page load
            loadNextPage();
          }
        },
        { rootMargin: "200px" },
      );

      observer.observe(node);
      observerRef.current = observer;
    },
    [loadNextPage],
  );

  // ── Clean up observer on unmount ──
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  // ── Effect: reset + fetch page 1 when API-level filters change ──
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Fetch the initial page
      if (enabled) {
        loadNextPage();
      }
      return;
    }

    // API-level filter changed — full reset
    reset();
    // We need to fetch after reset, but state updates are batched,
    // so we schedule the fetch in a microtask after state flushes.
    // The requestIdRef increment in reset() protects against stale responses.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    const id = requestIdRef.current;
    // Use a timeout to let the state settle after reset
    const timer = setTimeout(() => {
      if (requestIdRef.current === id && enabled) {
        loadNextPage();
      }
    }, 0);
    return () => clearTimeout(timer);
    // family is now sent to the API for server-side filtering
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [make, family, region, platform, query, sortBy, sortOrder, enabled]);

  // ── Derived: filtered cars (when family is set) ──
  // Note: cars are already filtered by family in fetchPage (with title),
  // so this is just a safety net — must also pass title for consistency.
  const visibleCars = resolvedFamily
    ? cars.filter(
        (car) =>
          extractSeries(car.model ?? "", car.year ?? 0, car.make ?? make, car.title ?? "") === resolvedFamily,
      )
    : cars;

  // ── Return ──
  return {
    cars: visibleCars,
    total: aggregates?.liveNow ?? 0,
    totalCount,
    totalLiveCount,
    aggregates,
    isLoading,
    isFetchingMore,
    hasMore,
    error,
    sentinelRef,
    reset,
  };
}

export default useInfiniteAuctions;
