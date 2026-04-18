"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, MessageSquare } from "lucide-react";
import type { DashboardAuction } from "@/lib/dashboardCache";
import { BrowseCard } from "./BrowseCard";
import { FilterBar } from "./filters/FilterBar";
import { useClassicFilters } from "./filters/useClassicFilters";
import { applyFilters } from "./filters/applyFilters";
import { countActiveFilters } from "./filters/types";

const INITIAL_VISIBLE = 24;
const PAGE_SIZE = 24;

export function BrowseClient({
  auctions,
  seriesCounts,
  totalTracked,
}: {
  auctions: DashboardAuction[];
  seriesCounts: Record<string, number>;
  totalTracked: number;
  liveNow?: number;
}) {
  const { filters, setFilters, resetFilters } = useClassicFilters();
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const filtered = useMemo(() => applyFilters(auctions, filters), [auctions, filters]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;
  const activeCount = countActiveFilters(filters);

  // Reset pagination when filters change.
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [filtersKey]);

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

      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="size-14 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
              <SlidersHorizontal className="size-5 text-muted-foreground" />
            </div>
            {auctions.length === 0 ? (
              <>
                <p className="text-[15px] font-display font-medium text-foreground">
                  Our data pipeline is updating
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground max-w-sm">
                  Check back shortly for new acquisitions.
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-display font-medium text-foreground">
                  No acquisitions match this specification
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground max-w-md">
                  Looking for something specific? Broaden your filters or speak with a
                  dedicated sourcing advisor — we find acquisitions off-market.
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
                <BrowseCard key={car.id} car={car} index={i} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="px-6 py-2.5 rounded-full border border-border text-[12px] font-medium text-foreground hover:border-primary/40 hover:bg-foreground/[0.03] transition-colors"
                >
                  Load more ({(filtered.length - visibleCount).toLocaleString()} remaining)
                </button>
              </div>
            )}

            {activeCount >= 2 && filtered.length > 0 && filtered.length < 20 && (
              <div className="mt-12 rounded-xl border border-border bg-foreground/[0.02] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-display font-medium text-foreground">
                    Narrow specification?
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground max-w-xl">
                    Save this search and we&apos;ll notify you when new matches appear, or
                    hand it to our sourcing team to search off-market inventory.
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
