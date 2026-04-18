"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { Search, Clock, Gavel, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import type { DashboardAuction } from "@/lib/dashboardCache";
import { useCurrency } from "@/lib/CurrencyContext";
import { useLocale } from "next-intl";
import { timeLeft } from "@/lib/makePageHelpers";
import { extractSeries, getSeriesConfig, getFamilyGroupsWithSeries } from "@/lib/brandConfig";

type StatusFilter = "all" | "live" | "sold";
type SortOption = "newest" | "priceDesc" | "priceAsc" | "endingSoon" | "yearDesc";

const PLATFORM_SHORT: Record<string, string> = {
  BRING_A_TRAILER: "BaT",
  CARS_AND_BIDS: "C&B",
  COLLECTING_CARS: "CC",
  AUTO_SCOUT_24: "AS24",
  AUTO_TRADER: "AT",
  BE_FORWARD: "BF",
  CLASSIC_COM: "Cls",
  ELFERSPOT: "ES",
  RM_SOTHEBYS: "RM",
  BONHAMS: "BON",
  GOODING: "G&C",
};

function isLiveStatus(status: string): boolean {
  return status === "ACTIVE" || status === "ENDING_SOON";
}

export function parseEndTimeMs(value: string): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function BrowseCard({ car, index }: { car: DashboardAuction; index: number }) {
  const locale = useLocale();
  const { formatPrice } = useCurrency();
  const live = isLiveStatus(car.status);
  const platformLabel = PLATFORM_SHORT[car.platform] || car.platform;
  const image = car.images?.[0] || "/cars/placeholder.svg";
  const makeSlug = car.make.toLowerCase().replace(/\s+/g, "-");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.25) }}
      layout
    >
      <Link
        href={`/cars/${makeSlug}/${car.id}`}
        className="group block rounded-2xl bg-card border border-border overflow-hidden hover:border-primary/30 transition-all duration-300"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <Image
            src={image}
            alt={car.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

          {live && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-background/85 backdrop-blur-md px-2.5 py-1">
              <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-400">LIVE</span>
            </div>
          )}

          <div className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-medium bg-background/85 text-foreground/80 border border-border backdrop-blur-md">
            {platformLabel}
          </div>
        </div>

        <div className="p-4">
          <h3 className="text-[15px] font-display font-normal text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {car.title}
          </h3>

          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
                {live ? "Current Bid" : "Sold For"}
              </p>
              <p className="text-[18px] font-display font-medium text-primary tabular-nums">
                {formatPrice(car.currentBid)}
              </p>
            </div>
            {car.mileage !== null && (
              <div className="text-right">
                <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
                  Mileage
                </p>
                <p className="text-[13px] font-medium text-muted-foreground tabular-nums">
                  {car.mileage.toLocaleString(locale)} {car.mileageUnit || "mi"}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              {live && parseEndTimeMs(car.endTime) !== null && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {timeLeft(new Date(car.endTime), {
                    ended: "Ended",
                    day: "d",
                    hour: "h",
                    minute: "m",
                  })}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Gavel className="size-3" />
                {car.bidCount} bids
              </span>
            </div>
            <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function BrowseClient({
  auctions,
  seriesCounts,
}: {
  auctions: DashboardAuction[];
  seriesCounts: Record<string, number>;
}) {
  const [query, setQuery] = useState("");
  const [seriesFilter, setSeriesFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [visibleCount, setVisibleCount] = useState(24);

  const familyGroups = useMemo(() => getFamilyGroupsWithSeries("porsche"), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = auctions.filter((car) => {
      if (statusFilter === "live" && !isLiveStatus(car.status)) return false;
      if (statusFilter === "sold" && isLiveStatus(car.status)) return false;

      if (seriesFilter !== "all") {
        const carSeries = extractSeries(car.model, car.year, car.make, car.title);
        if (carSeries !== seriesFilter) return false;
      }

      if (q) {
        const haystack = `${car.title} ${car.make} ${car.model} ${car.year} ${car.trim || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    switch (sortBy) {
      case "priceDesc":
        result = [...result].sort((a, b) => b.currentBid - a.currentBid);
        break;
      case "priceAsc":
        result = [...result].sort((a, b) => a.currentBid - b.currentBid);
        break;
      case "yearDesc":
        result = [...result].sort((a, b) => b.year - a.year);
        break;
      case "endingSoon":
        result = [...result].sort((a, b) => {
          const aLive = isLiveStatus(a.status);
          const bLive = isLiveStatus(b.status);
          if (aLive !== bLive) return aLive ? -1 : 1;
          const aEnd = parseEndTimeMs(a.endTime);
          const bEnd = parseEndTimeMs(b.endTime);
          if (aEnd === null && bEnd === null) return 0;
          if (aEnd === null) return 1;
          if (bEnd === null) return -1;
          return aEnd - bEnd;
        });
        break;
      case "newest":
      default:
        result = [...result].sort((a, b) => {
          const aLive = isLiveStatus(a.status);
          const bLive = isLiveStatus(b.status);
          if (aLive !== bLive) return aLive ? -1 : 1;
          return 0;
        });
    }

    return result;
  }, [auctions, query, seriesFilter, statusFilter, sortBy]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const activeFilterCount =
    (query ? 1 : 0) + (seriesFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  const clearAll = () => {
    setQuery("");
    setSeriesFilter("all");
    setStatusFilter("all");
    setSortBy("newest");
  };

  return (
    <div className="min-h-screen bg-background pt-14 md:pt-20">
      {/* Page Header */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-primary">
                Classic View
              </p>
              <h1 className="mt-2 text-[28px] md:text-[40px] font-display font-light tracking-tight text-foreground">
                Browse Collection
              </h1>
              <p className="mt-2 text-[13px] md:text-[14px] text-muted-foreground max-w-2xl">
                Every Porsche we&apos;re tracking — live auctions, recent sales, and dealer listings in one grid.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="tabular-nums text-foreground font-medium">{filtered.length}</span>
              <span>of</span>
              <span className="tabular-nums">{auctions.length}</span>
              <span>vehicles</span>
            </div>
          </div>

          {/* Search */}
          <div className="mt-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(24);
              }}
              placeholder="Search by model, year, trim… (e.g. 992 GT3, 964 Carrera, Turbo S)"
              className="w-full h-12 pl-11 pr-10 rounded-full bg-foreground/[0.03] border border-border text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 focus:bg-foreground/[0.05] transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded-full hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Filters row */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {/* Status */}
            <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-foreground/[0.03] p-0.5">
              {(["all", "live", "sold"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setVisibleCount(24);
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium tracking-wide transition-colors ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "all" ? "All" : s === "live" ? "Live" : "Sold"}
                </button>
              ))}
            </div>

            {/* Series */}
            <select
              value={seriesFilter}
              onChange={(e) => {
                setSeriesFilter(e.target.value);
                setVisibleCount(24);
              }}
              className="h-8 px-3 pr-8 rounded-full border border-border bg-foreground/[0.03] text-[11px] font-medium text-foreground hover:bg-foreground/[0.05] focus:outline-none focus:border-primary/40 transition-colors cursor-pointer appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:0.7em] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22currentColor%22%3E%3Cpath%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.06l3.71-3.83a.75.75%200%20011.08%201.04l-4.25%204.4a.75.75%200%2001-1.08%200L5.21%208.27a.75.75%200%2001.02-1.06z%22%2F%3E%3C%2Fsvg%3E')]"
            >
              <option value="all">All series</option>
              {familyGroups.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.series.map((s) => {
                    const count = seriesCounts[s.id] || 0;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.label} ({count})
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-8 px-3 pr-8 rounded-full border border-border bg-foreground/[0.03] text-[11px] font-medium text-foreground hover:bg-foreground/[0.05] focus:outline-none focus:border-primary/40 transition-colors cursor-pointer appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:0.7em] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22currentColor%22%3E%3Cpath%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.06l3.71-3.83a.75.75%200%20011.08%201.04l-4.25%204.4a.75.75%200%2001-1.08%200L5.21%208.27a.75.75%200%2001.02-1.06z%22%2F%3E%3C%2Fsvg%3E')]"
            >
              <option value="newest">Featured</option>
              <option value="endingSoon">Ending Soon</option>
              <option value="priceDesc">Price: High → Low</option>
              <option value="priceAsc">Price: Low → High</option>
              <option value="yearDesc">Year: Newest first</option>
            </select>

            {activeFilterCount > 0 && (
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
              >
                <X className="size-3" />
                Clear ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Active chip for selected series */}
          {seriesFilter !== "all" && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
                Showing
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-[11px] font-medium text-primary">
                {getSeriesConfig(seriesFilter, "porsche")?.label || seriesFilter}
                <button
                  onClick={() => setSeriesFilter("all")}
                  className="hover:text-primary/60 transition-colors"
                >
                  <X className="size-3" />
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="size-14 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
              <SlidersHorizontal className="size-5 text-muted-foreground" />
            </div>
            {auctions.length === 0 ? (
              <>
                <p className="text-[15px] font-medium text-foreground">No listings available yet</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Our data pipeline is currently empty. Check back shortly.
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-medium text-foreground">No vehicles match your filters</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Try clearing filters or searching with a broader term.
                </p>
                <button
                  onClick={clearAll}
                  className="mt-5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/80 transition-colors"
                >
                  Clear all filters
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((car, i) => (
                <BrowseCard key={car.id} car={car} index={i} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={() => setVisibleCount((c) => c + 24)}
                  className="px-6 py-2.5 rounded-full border border-border text-[12px] font-medium text-foreground hover:border-primary/40 hover:bg-foreground/[0.03] transition-colors"
                >
                  Load more ({filtered.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
