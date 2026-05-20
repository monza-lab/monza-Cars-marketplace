"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, MessageSquare } from "lucide-react";
import type { DashboardAuction } from "@/lib/dashboardCache";
import { BrowseCard } from "./BrowseCard";
import { NoMarketplaceBanner } from "./NoMarketplaceBanner";
import { FilterBar } from "./filters/FilterBar";
import { useClassicFilters } from "./filters/useClassicFilters";
import { applyFilters } from "./filters/applyFilters";
import { countActiveFilters } from "./filters/types";
import { partitionByPhoto } from "@/lib/photoSort";
import { isImageUrlFailed, useImageFailureVersion } from "@/lib/imageFailureStore";

const REMOTE_PAGE_SIZE = 30;

type ApiCar = {
  id: string;
  title: string;
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  engine?: string | null;
  transmission?: string | null;
  mileage?: number | null;
  mileageUnit?: string | null;
  location?: string | null;
  platform: string;
  status: string;
  price?: number;
  currentBid: number;
  bidCount: number;
  endTime: string;
  image?: string;
  images?: string[];
  sourceUrl?: string | null;
  category?: string;
  region?: string | null;
  originalCurrency?: string | null;
  soldPriceUsd?: number | null;
  askingPriceUsd?: number | null;
  valuationBasis?: "sold" | "asking" | "unknown";
  canonicalMarket?: "US" | "EU" | "UK" | "JP" | null;
  family?: string | null;
  fairValueByRegion?: DashboardAuction["fairValueByRegion"] | null;
};

// Bring an /api/mock-auctions car into the DashboardAuction shape BrowseCard expects.
// Only the fields the card actually reads need to match; everything else is filled with
// neutral defaults so the type checker is happy.
function toDashboardAuction(c: ApiCar): DashboardAuction {
  return {
    id: c.id,
    title: c.title,
    make: c.make,
    model: c.model,
    year: c.year,
    trim: c.trim ?? null,
    price: c.price ?? 0,
    currentBid: c.currentBid,
    bidCount: c.bidCount,
    viewCount: 0,
    watchCount: 0,
    status: c.status,
    endTime: c.endTime,
    platform: c.platform,
    engine: c.engine ?? null,
    transmission: c.transmission ?? null,
    exteriorColor: null,
    mileage: c.mileage ?? null,
    mileageUnit: c.mileageUnit ?? null,
    location: c.location ?? null,
    region: c.region ?? null,
    description: null,
    images: c.images && c.images.length > 0 ? c.images : c.image ? [c.image] : [],
    analysis: null,
    priceHistory: [],
    fairValueByRegion: c.fairValueByRegion ?? undefined,
    category: c.category,
    originalCurrency: c.originalCurrency ?? null,
    soldPriceUsd: c.soldPriceUsd ?? null,
    askingPriceUsd: c.askingPriceUsd ?? null,
    valuationBasis: c.valuationBasis ?? "unknown",
    canonicalMarket: c.canonicalMarket ?? null,
    family: c.family ?? null,
  };
}

export function BrowseClient({
  auctions,
  seriesCounts,
  totalTracked,
}: {
  auctions: DashboardAuction[];
  seriesCounts: Record<string, number>;
  totalTracked: number;
}) {
  const { filters, setFilters, resetFilters } = useClassicFilters();

  // Build the subset of filters that the server API can apply on its side.
  // The others (year, price, mileage, transmission, body, drive, variants…)
  // continue to run client-side on the streamed pool.
  const serverFilters = useMemo(() => {
    const params: Record<string, string> = {};
    const q = filters.q.trim();
    if (q) params.query = q;
    // API takes a single family at a time. Multi-series selection falls back
    // to pure client-side filtering on whatever is already loaded.
    if (filters.series.length === 1) params.family = filters.series[0];
    if (filters.region.length >= 1) params.region = filters.region.join(",");
    if (filters.platform.length === 1) params.platform = filters.platform[0];
    return params;
  }, [filters.q, filters.series, filters.region, filters.platform]);

  const hasServerFilters = Object.keys(serverFilters).length > 0;
  const serverFilterKey = useMemo(
    () => JSON.stringify({ ...serverFilters, _status: filters.status }),
    [serverFilters, filters.status],
  );
  // Debounce so typing in the search box doesn't fire a request per keystroke.
  const [activeServerKey, setActiveServerKey] = useState(serverFilterKey);
  useEffect(() => {
    const t = setTimeout(() => setActiveServerKey(serverFilterKey), 300);
    return () => clearTimeout(t);
  }, [serverFilterKey]);
  // True while the user has changed a server filter but the debounce
  // hasn't fired yet (300ms window). Used to keep the loading state up
  // so the empty-state copy ("No reports match") never flashes before
  // the new fetch actually starts.
  const isFilterPending = serverFilterKey !== activeServerKey;

  // Extra cars streamed in from /api/mock-auctions as the user scrolls or changes filters.
  const [remoteCars, setRemoteCars] = useState<DashboardAuction[]>([]);
  const [remoteCursor, setRemoteCursor] = useState<string | null>(null);
  const [remoteHasMore, setRemoteHasMore] = useState(true);
  const [remoteLoading, setRemoteLoading] = useState(false);
  // Lookup: listing id → URL of the original listing on its source platform
  // (BaT, Cars and Bids, Collecting Cars, Elferspot, etc.). Populated as
  // listings stream in from /api/mock-auctions; SSR-initial cars do not
  // carry sourceUrl through the cache so they will not appear here.
  const [sourceUrlById, setSourceUrlById] = useState<Map<string, string>>(() => new Map());

  // When a server-backed filter is active we ignore the SSR pool (it was a
  // mixed sample) and show only what the server returned for this specific
  // filter. Otherwise merge SSR + streamed and deduplicate by id.
  const allAuctions = useMemo(() => {
    const pool = hasServerFilters ? remoteCars : [...auctions, ...remoteCars];
    const seen = new Set<string>();
    return pool.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [hasServerFilters, auctions, remoteCars]);
  // When the server has already filtered on a field, we must NOT re-filter
  // it on the client. The server uses SQL patterns (getModelPatternsForSeries,
  // title/model ILIKE) while applyFilters uses extractSeries — they disagree
  // on edge cases like "1991 Porsche 911 Carrera 2" which is a 964 per the
  // year but whose title doesn't contain "964".
  //
  // EXCEPTION: `region` is re-applied on the client even when the server
  // also filtered it. The server's filter uses `country` + `source` columns,
  // but the UI surfaces (badge on card, applyFilters helper) read
  // `canonicalMarket`. The two can disagree — e.g. an Elferspot listing
  // with country="United Kingdom" passes the server filter for `region=UK`
  // but its canonicalMarket is "EU". Re-filtering on the client by
  // canonicalMarket guarantees what the user filters matches what they see.
  const clientFilters = useMemo(() => {
    if (!hasServerFilters) return filters;
    return {
      ...filters,
      q: serverFilters.query ? "" : filters.q,
      series: serverFilters.family ? [] : filters.series,
      // region intentionally NOT cleared — see comment above.
      platform: serverFilters.platform ? [] : filters.platform,
    };
  }, [filters, hasServerFilters, serverFilters]);
  const filtered = useMemo(
    () => applyFilters(allAuctions, clientFilters),
    [allAuctions, clientFilters],
  );

  // Re-render whenever a new image failure is reported so the memo below
  // sheds cars whose primary image just broke at runtime.
  const failureVersion = useImageFailureVersion();
  const visible = useMemo(() => {
    // Classic view also hides cars without photos. Same reason as the Monza
    // feed in useInfiniteAuctions — keep the marketplace looking curated.
    const { withPhoto } = partitionByPhoto(filtered);
    return withPhoto.filter((car) => {
      const url = car.images?.[0] ?? car.image ?? "";
      return !isImageUrlFailed(url);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, failureVersion]);
  const activeCount = countActiveFilters(filters);

  const fetchPage = useCallback(
    async (cursor: string | null, signal?: AbortSignal) => {
      const params = new URLSearchParams({
        make: "Porsche",
        pageSize: String(REMOTE_PAGE_SIZE),
      });
      // Always show only active listings — sold data is kept for analysis only.
      params.set("status", "ACTIVE");
      for (const [k, v] of Object.entries(serverFilters)) params.set(k, v);
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/mock-auctions?${params.toString()}`, {
        cache: "no-store",
        signal,
      });
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      return (await res.json()) as {
        auctions: ApiCar[];
        nextCursor: string | null;
        hasMore: boolean;
      };
    },
    [serverFilters, filters.status],
  );

  // Use refs to avoid recreating the callback (and the observer) on every state change.
  const remoteCursorRef = useRef(remoteCursor);
  remoteCursorRef.current = remoteCursor;
  const remoteHasMoreRef = useRef(remoteHasMore);
  remoteHasMoreRef.current = remoteHasMore;
  const remoteLoadingRef = useRef(remoteLoading);
  remoteLoadingRef.current = remoteLoading;

  const fetchMoreRemote = useCallback(async () => {
    if (remoteLoadingRef.current || !remoteHasMoreRef.current) return;
    remoteLoadingRef.current = true;
    setRemoteLoading(true);
    try {
      const data = await fetchPage(remoteCursorRef.current);
      const fresh = data.auctions.map(toDashboardAuction);
      // Append all results — deduplication against SSR pool happens in allAuctions memo
      if (fresh.length > 0) {
        setRemoteCars((prev) => [...prev, ...fresh]);
        setSourceUrlById((prev) => {
          const next = new Map(prev);
          for (const c of data.auctions) {
            if (c.sourceUrl) next.set(c.id, c.sourceUrl);
          }
          return next;
        });
      }
      // Update refs immediately so the next observer trigger reads fresh values
      remoteCursorRef.current = data.nextCursor;
      remoteHasMoreRef.current = Boolean(data.hasMore && data.nextCursor);
      setRemoteCursor(data.nextCursor);
      setRemoteHasMore(Boolean(data.hasMore && data.nextCursor));
    } catch (err) {
      // Don't permanently give up — log and let the user retry by scrolling again.
      console.warn("[BrowseClient] fetchMoreRemote failed, will retry on next scroll:", err);
    } finally {
      remoteLoadingRef.current = false;
      setRemoteLoading(false);
    }
  }, [fetchPage]);

  // Reset and refetch whenever the (debounced) server filter set changes.
  useEffect(() => {
    const ac = new AbortController();
    setRemoteCars([]);
    setRemoteCursor(null);
    setRemoteHasMore(true);
    if (!hasServerFilters) return () => ac.abort();
    setRemoteLoading(true);
    (async () => {
      try {
        const data = await fetchPage(null, ac.signal);
        if (ac.signal.aborted) return;
        // When server filters are active we replace the pool — ignore SSR ids
        // so a streamed car matching the filter isn't deduped against them.
        const fresh = data.auctions.map(toDashboardAuction);
        setRemoteCars(fresh);
        setSourceUrlById((prev) => {
          const next = new Map(prev);
          for (const c of data.auctions) {
            if (c.sourceUrl) next.set(c.id, c.sourceUrl);
          }
          return next;
        });
        setRemoteCursor(data.nextCursor);
        setRemoteHasMore(Boolean(data.hasMore && data.nextCursor));
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
        console.warn("[BrowseClient] initial fetch failed, will retry on scroll:", e);
      } finally {
        if (!ac.signal.aborted) setRemoteLoading(false);
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerKey]);

  // Infinite scroll via scroll listener — reads refs directly to avoid
  // recreating the handler on every state change.
  const fetchMoreRef = useRef(fetchMoreRemote);
  fetchMoreRef.current = fetchMoreRemote;

  useEffect(() => {
    const handle = () => {
      if (!remoteHasMoreRef.current || remoteLoadingRef.current) return;
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 600;
      if (nearBottom) void fetchMoreRef.current();
    };
    // Fire once in case the page is already short enough.
    handle();
    window.addEventListener("scroll", handle, { passive: true });
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle);
      window.removeEventListener("resize", handle);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background pt-14 md:pt-20">
      <FilterBar
        filters={filters}
        matchCount={filtered.length}
        totalTracked={totalTracked}
        seriesCounts={seriesCounts}
        onChange={(patch) => setFilters(patch)}
        onReset={resetFilters}
      />
      <NoMarketplaceBanner />

      <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-4 md:py-8 pb-24 md:pb-8">
        {filtered.length === 0 && (remoteLoading || isFilterPending) ? (
          /* Region/filter change in progress — show a spinner instead of the
             empty state, which used to flash for ~1s and look like an error
             while the new query was still in flight. isFilterPending covers
             the 300ms debounce window before the fetch actually begins. */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="size-10 rounded-full border-2 border-border border-t-primary animate-spin mb-4" />
            <p className="text-[13px] text-muted-foreground">Loading cars…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="size-14 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
              <SlidersHorizontal className="size-5 text-muted-foreground" />
            </div>
            {auctions.length === 0 ? (
              <>
                <p className="text-[15px] font-display font-medium text-foreground">
                  Our intelligence is updating
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground max-w-sm">
                  Check back shortly — new reports are published as listings come live.
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-display font-medium text-foreground">
                  No reports match this specification
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground max-w-md">
                  Try broadening your filters, or talk to an advisor about a custom report.
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 rounded-full border border-border text-[12px] font-medium text-foreground hover:border-primary/40 transition-colors"
                  >
                    Reset filters
                  </button>
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors">
                    <MessageSquare className="size-3.5" />
                    Talk to an advisor
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visible.map((car, i) => (
                <div
                  key={car.id}
                  style={{ contentVisibility: "auto", containIntrinsicSize: "auto 420px" }}
                >
                  <BrowseCard
                    car={car}
                    index={i}
                    sourceUrl={sourceUrlById.get(car.id) ?? null}
                  />
                </div>
              ))}
            </div>

            {/* Loading indicator */}
            {remoteHasMore && (
              <div className="mt-8 md:mt-10 flex justify-center items-center min-h-[4rem]">
                {remoteLoading && (
                  <div className="size-6 rounded-full border-2 border-border border-t-primary animate-spin" />
                )}
              </div>
            )}

            {!remoteHasMore && visible.length > 0 && (
              <div className="mt-10 text-center">
                <p className="text-[11px] text-muted-foreground tracking-wider">
                  You&apos;ve reached the end · {visible.length.toLocaleString()} reports shown
                </p>
              </div>
            )}

            {activeCount >= 2 && filtered.length > 0 && filtered.length < 20 && (
              <div className="mt-12 rounded-xl border border-border bg-foreground/[0.02] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-display font-medium text-foreground">
                    Narrow specification?
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground max-w-xl">
                    Save this search and we&apos;ll notify you when new reports match, or
                    commission a custom one with our team.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button className="px-3 py-1.5 rounded-full border border-border text-[11px] font-medium text-foreground hover:border-primary/40 transition-colors">
                    Save search
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors">
                    <MessageSquare className="size-3" />
                    Talk to advisor
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
