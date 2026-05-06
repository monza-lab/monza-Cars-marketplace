"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, MessageSquare } from "lucide-react";
import type { DashboardAuction } from "@/lib/dashboardCache";
import { BrowseCard } from "./BrowseCard";
import { FilterBar } from "./filters/FilterBar";
import { useClassicFilters } from "./filters/useClassicFilters";
import { applyFilters } from "./filters/applyFilters";
import { countActiveFilters } from "./filters/types";

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
  const serverFilterKey = useMemo(() => JSON.stringify(serverFilters), [serverFilters]);
  // Debounce so typing in the search box doesn't fire a request per keystroke.
  const [activeServerKey, setActiveServerKey] = useState(serverFilterKey);
  useEffect(() => {
    const t = setTimeout(() => setActiveServerKey(serverFilterKey), 300);
    return () => clearTimeout(t);
  }, [serverFilterKey]);

  // Extra cars streamed in from /api/mock-auctions as the user scrolls or changes filters.
  const [remoteCars, setRemoteCars] = useState<DashboardAuction[]>([]);
  const [remoteCursor, setRemoteCursor] = useState<string | null>(null);
  const [remoteHasMore, setRemoteHasMore] = useState(true);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set(auctions.map((a) => a.id)));
  // Lookup: listing id → URL of the original listing on its source platform
  // (BaT, Cars and Bids, Collecting Cars, Elferspot, etc.). Populated as
  // listings stream in from /api/mock-auctions; SSR-initial cars do not
  // carry sourceUrl through the cache so they will not appear here.
  const [sourceUrlById, setSourceUrlById] = useState<Map<string, string>>(() => new Map());

  // When a server-backed filter is active we ignore the SSR pool (it was a
  // mixed sample) and show only what the server returned for this specific
  // filter. Otherwise keep the SSR cars so the landing view feels full.
  const allAuctions = useMemo(
    () => (hasServerFilters ? remoteCars : [...auctions, ...remoteCars]),
    [hasServerFilters, auctions, remoteCars],
  );
  // When the server has already filtered on a field, we must NOT re-filter
  // it on the client. The server uses SQL patterns (getModelPatternsForSeries,
  // title/model ILIKE) while applyFilters uses extractSeries — they disagree
  // on edge cases like "1991 Porsche 911 Carrera 2" which is a 964 per the
  // year but whose title doesn't contain "964".
  const clientFilters = useMemo(() => {
    if (!hasServerFilters) return filters;
    return {
      ...filters,
      q: serverFilters.query ? "" : filters.q,
      series: serverFilters.family ? [] : filters.series,
      region: serverFilters.region ? [] : filters.region,
      platform: serverFilters.platform ? [] : filters.platform,
    };
  }, [filters, hasServerFilters, serverFilters]);
  const filtered = useMemo(
    () => applyFilters(allAuctions, clientFilters),
    [allAuctions, clientFilters],
  );

  const visible = filtered;
  const hasMore = remoteHasMore && !remoteLoading;
  const activeCount = countActiveFilters(filters);

  const fetchPage = useCallback(
    async (cursor: string | null, signal?: AbortSignal) => {
      const params = new URLSearchParams({
        make: "Porsche",
        pageSize: String(REMOTE_PAGE_SIZE),
        status: "ACTIVE",
      });
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
    [serverFilters],
  );

  const fetchMoreRemote = useCallback(async () => {
    if (remoteLoading || !remoteHasMore) return;
    setRemoteLoading(true);
    try {
      const data = await fetchPage(remoteCursor);
      const freshApi = data.auctions.filter((c) => !seenIdsRef.current.has(c.id));
      const fresh = freshApi.map(toDashboardAuction);
      fresh.forEach((c) => seenIdsRef.current.add(c.id));
      setRemoteCars((prev) => [...prev, ...fresh]);
      setSourceUrlById((prev) => {
        const next = new Map(prev);
        for (const c of freshApi) {
          if (c.sourceUrl) next.set(c.id, c.sourceUrl);
        }
        return next;
      });
      setRemoteCursor(data.nextCursor);
      setRemoteHasMore(Boolean(data.hasMore && data.nextCursor));
    } catch {
      setRemoteHasMore(false);
    } finally {
      setRemoteLoading(false);
    }
  }, [remoteCursor, remoteHasMore, remoteLoading, fetchPage]);

  // Reset and refetch whenever the (debounced) server filter set changes.
  useEffect(() => {
    const ac = new AbortController();
    seenIdsRef.current = new Set(auctions.map((a) => a.id));
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
        const ids = new Set(fresh.map((c) => c.id));
        seenIdsRef.current = ids;
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
        setRemoteHasMore(false);
      } finally {
        if (!ac.signal.aborted) setRemoteLoading(false);
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerKey]);

  // Infinite scroll: when the user nears the bottom, stream the next page from
  // the API with whatever filters are currently active.
  useEffect(() => {
    if (!hasMore) return;
    const handle = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 600;
      if (nearBottom) void fetchMoreRemote();
    };
    // Fire once in case the first render already leaves the user near the bottom.
    handle();
    window.addEventListener("scroll", handle, { passive: true });
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle);
      window.removeEventListener("resize", handle);
    };
  }, [hasMore, fetchMoreRemote]);

  return (
    <div className="min-h-screen bg-background pt-14 md:pt-16">
      <FilterBar
        filters={filters}
        matchCount={filtered.length}
        totalTracked={totalTracked}
        seriesCounts={seriesCounts}
        onChange={(patch) => setFilters(patch)}
        onReset={resetFilters}
      />

      <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-4 md:py-8 pb-24 md:pb-8">
        {filtered.length === 0 ? (
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
                <BrowseCard
                  key={car.id}
                  car={car}
                  index={i}
                  sourceUrl={sourceUrlById.get(car.id) ?? null}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 md:mt-10 flex justify-center items-center min-h-[4rem]">
                {remoteLoading ? (
                  <div className="size-6 rounded-full border-2 border-border border-t-primary animate-spin" />
                ) : (
                  <button
                    onClick={() => void fetchMoreRemote()}
                    className="px-6 py-2.5 rounded-full border border-border text-[12px] font-medium text-foreground hover:border-primary/40 hover:bg-foreground/[0.03] transition-colors"
                  >
                    Load more reports
                  </button>
                )}
              </div>
            )}

            {!hasMore && visible.length > 0 && (
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
