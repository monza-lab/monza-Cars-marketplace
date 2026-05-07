"use client";

import { useMemo, useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { useCurrency } from "@/lib/CurrencyContext";
import { FilterPill } from "./FilterPill";
import { RangeFilter } from "./RangeFilter";
import { CheckboxFilter } from "./CheckboxFilter";
import { ModelFilter } from "./ModelFilter";
import { MoreFilters } from "./MoreFilters";
import { MobileFilterSheet } from "./MobileFilterSheet";
import {
  BODY_OPTIONS,
  REGION_OPTIONS,
  TRANSMISSION_OPTIONS,
  YEAR_BOUNDS,
  PRICE_BOUNDS,
  MILEAGE_BOUNDS,
  countActiveFilters,
  type ClassicFilters,
  type SortOption,
  type StatusFilter,
} from "./types";
import { getSeriesConfig } from "@/lib/brandConfig";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  filters: ClassicFilters;
  matchCount: number;
  totalTracked: number;
  seriesCounts: Record<string, number>;
  onChange: (updater: Partial<ClassicFilters>) => void;
  onReset: () => void;
};

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Featured",
  endingSoon: "Closing soon",
  priceDesc: "Price: High → Low",
  priceAsc: "Price: Low → High",
  yearDesc: "Year: Newest",
  yearAsc: "Year: Oldest",
  mileageAsc: "Lowest mileage",
};

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "sold", label: "Sold" },
];

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export function FilterBar({
  filters,
  matchCount,
  totalTracked,
  seriesCounts,
  onChange,
  onReset,
}: FilterBarProps) {
  const { formatPrice } = useCurrency();
  const [showSort, setShowSort] = useState(false);
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const activeCount = countActiveFilters(filters);

  const modelLabel = useMemo(() => {
    const picks: string[] = [];
    filters.series.forEach((id) => {
      const cfg = getSeriesConfig(id, "porsche");
      if (cfg) picks.push(cfg.label);
    });
    if (picks.length === 0 && filters.variants.length === 0) return null;
    if (picks.length === 1 && filters.variants.length === 0) return picks[0];
    if (picks.length === 0 && filters.variants.length > 0)
      return `${filters.variants.length} variants`;
    return `${filters.series.length} series · ${filters.variants.length} variants`;
  }, [filters.series, filters.variants]);

  const yearLabel = useMemo(() => {
    if (filters.yearMin === null && filters.yearMax === null) return null;
    const lo = filters.yearMin ?? YEAR_BOUNDS.min;
    const hi = filters.yearMax ?? YEAR_BOUNDS.max;
    return `${lo}–${hi}`;
  }, [filters.yearMin, filters.yearMax]);

  const priceLabel = useMemo(() => {
    if (filters.priceMin === null && filters.priceMax === null) return null;
    const lo = filters.priceMin ?? PRICE_BOUNDS.min;
    const hi = filters.priceMax ?? PRICE_BOUNDS.max;
    return `${formatPrice(lo)}–${formatPrice(hi)}`;
  }, [filters.priceMin, filters.priceMax, formatPrice]);

  const mileageLabel = useMemo(() => {
    if (filters.mileageMin === null && filters.mileageMax === null) return null;
    const lo = filters.mileageMin ?? MILEAGE_BOUNDS.min;
    const hi = filters.mileageMax ?? MILEAGE_BOUNDS.max;
    if (lo === MILEAGE_BOUNDS.min) return `< ${formatCompact(hi)}`;
    return `${formatCompact(lo)}–${formatCompact(hi)}`;
  }, [filters.mileageMin, filters.mileageMax]);

  const transLabel =
    filters.transmission.length === 0
      ? null
      : filters.transmission.length === 1
        ? TRANSMISSION_OPTIONS.find((o) => o.id === filters.transmission[0])?.label ?? null
        : `${filters.transmission.length} selected`;

  const bodyLabel =
    filters.body.length === 0
      ? null
      : filters.body.length === 1
        ? BODY_OPTIONS.find((o) => o.id === filters.body[0])?.label ?? null
        : `${filters.body.length} selected`;

  const regionLabel =
    filters.region.length === 0
      ? null
      : filters.region.length <= 2
        ? filters.region.join(" · ")
        : `${filters.region.length} regions`;

  const moreActive =
    filters.drive.length + filters.steering.length + filters.platform.length;
  const moreLabel = moreActive > 0 ? `More · ${moreActive}` : null;

  return (
    <div
      className="sticky top-14 md:top-20 z-30 bg-background/90 backdrop-blur-md border-b border-border"
    >
      <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-2 md:py-3 space-y-2">
        {/* Row 1: search + counter + sort */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative flex-1 md:max-w-2xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={filters.q}
              onChange={(e) => onChange({ q: e.target.value })}
              placeholder="Search — 992 GT3, 964 Turbo, Manual…"
              className="w-full h-11 md:h-9 pl-9 pr-9 rounded-full bg-foreground/[0.03] border border-border text-[16px] md:text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 focus:bg-foreground/[0.05] transition-colors"
            />
            {filters.q && (
              <button
                onClick={() => onChange({ q: "" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-8 md:size-6 flex items-center justify-center rounded-full hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="size-4 md:size-3.5" />
              </button>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3 text-[11px] whitespace-nowrap">
            {activeCount === 0 ? (
              <span className="text-muted-foreground/70">
                <span className="tabular-nums text-foreground font-semibold">
                  {(totalTracked || matchCount).toLocaleString()}
                </span>{" "}
                reports
              </span>
            ) : (
              <span className="text-muted-foreground/70">
                <span className="tabular-nums text-foreground font-semibold">
                  {matchCount.toLocaleString()}
                </span>{" "}
                match
                {totalTracked > 0 && (
                  <>
                    {" "}
                    · of {totalTracked.toLocaleString()} tracked
                  </>
                )}
              </span>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSort((v) => !v)}
              className="inline-flex items-center gap-1.5 h-11 md:h-9 px-3 rounded-full border border-border bg-foreground/[0.03] text-[11px] font-medium text-foreground hover:border-primary/30 transition-colors whitespace-nowrap"
            >
              <span className="hidden sm:inline">{SORT_LABELS[filters.sort]}</span>
              <span className="sm:hidden">Sort</span>
            </button>
            {showSort && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSort(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover shadow-xl z-50 p-1">
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        onChange({ sort: s });
                        setShowSort(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-[12px] transition-colors ${
                        filters.sort === s
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-foreground/[0.04]"
                      }`}
                    >
                      {SORT_LABELS[s]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Row 2 — mobile: single Filters CTA + Status + counter */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMobileSheet(true)}
            className={cn(
              "inline-flex items-center gap-2 h-11 px-4 rounded-full border text-[13px] font-medium transition-colors active:bg-foreground/5",
              activeCount > 0
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-foreground/[0.03] border-border text-foreground",
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                {activeCount}
              </span>
            )}
          </button>

          <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-foreground/[0.03] p-0.5 shrink-0">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => onChange({ status: s.id })}
                className={`px-2.5 h-9 rounded-full text-[11px] font-medium tracking-wide transition-colors ${
                  filters.status === s.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <span className="ml-auto text-[11px] whitespace-nowrap">
            <span className="tabular-nums text-foreground font-semibold">
              {activeCount === 0
                ? (totalTracked || matchCount).toLocaleString()
                : matchCount.toLocaleString()}
            </span>
            {activeCount > 0 && totalTracked > 0 && (
              <span className="text-muted-foreground/70">/{totalTracked.toLocaleString()}</span>
            )}
          </span>
        </div>

        {/* Row 2 — desktop: filter pills */}
        <div className="hidden md:flex items-center gap-1.5 flex-wrap">
          {/* Status quick-toggle */}
          <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-foreground/[0.03] p-0.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => onChange({ status: s.id })}
                className={`px-2.5 py-1 rounded-full text-[10.5px] font-medium tracking-wide transition-colors ${
                  filters.status === s.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <FilterPill
            label="Model"
            value={modelLabel}
            onClear={() => onChange({ series: [], variants: [] })}
            align="start"
          >
            <ModelFilter
              series={filters.series}
              variants={filters.variants}
              seriesCounts={seriesCounts}
              onChange={(series, variants) => onChange({ series, variants })}
              onClear={() => onChange({ series: [], variants: [] })}
            />
          </FilterPill>

          <FilterPill
            label="Year"
            value={yearLabel}
            onClear={() => onChange({ yearMin: null, yearMax: null })}
          >
            <RangeFilter
              label="Year of production"
              min={YEAR_BOUNDS.min}
              max={YEAR_BOUNDS.max}
              valueMin={filters.yearMin}
              valueMax={filters.yearMax}
              onChange={(lo, hi) => onChange({ yearMin: lo, yearMax: hi })}
              onClear={() => onChange({ yearMin: null, yearMax: null })}
            />
          </FilterPill>

          <FilterPill
            label="Price"
            value={priceLabel}
            onClear={() => onChange({ priceMin: null, priceMax: null })}
          >
            <RangeFilter
              label="Price range"
              min={PRICE_BOUNDS.min}
              max={PRICE_BOUNDS.max}
              step={1000}
              valueMin={filters.priceMin}
              valueMax={filters.priceMax}
              onChange={(lo, hi) => onChange({ priceMin: lo, priceMax: hi })}
              onClear={() => onChange({ priceMin: null, priceMax: null })}
              format={(n) => formatPrice(n)}
            />
          </FilterPill>

          <FilterPill
            label="Mileage"
            value={mileageLabel}
            onClear={() => onChange({ mileageMin: null, mileageMax: null })}
          >
            <RangeFilter
              label="Mileage (mi)"
              unit="mi"
              min={MILEAGE_BOUNDS.min}
              max={MILEAGE_BOUNDS.max}
              step={1000}
              valueMin={filters.mileageMin}
              valueMax={filters.mileageMax}
              onChange={(lo, hi) => onChange({ mileageMin: lo, mileageMax: hi })}
              onClear={() => onChange({ mileageMin: null, mileageMax: null })}
            />
          </FilterPill>

          <FilterPill
            label="Transmission"
            value={transLabel}
            onClear={() => onChange({ transmission: [] })}
          >
            <CheckboxFilter
              label="Transmission"
              options={TRANSMISSION_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
              value={filters.transmission}
              onChange={(v) => onChange({ transmission: v })}
              onClear={() => onChange({ transmission: [] })}
            />
          </FilterPill>

          <FilterPill
            label="Body"
            value={bodyLabel}
            onClear={() => onChange({ body: [] })}
          >
            <CheckboxFilter
              label="Body type"
              options={BODY_OPTIONS}
              value={filters.body}
              onChange={(v) => onChange({ body: v })}
              onClear={() => onChange({ body: [] })}
            />
          </FilterPill>

          <FilterPill
            label="Region"
            value={regionLabel}
            onClear={() => onChange({ region: [] })}
          >
            <CheckboxFilter
              label="Region"
              options={REGION_OPTIONS}
              value={filters.region}
              onChange={(v) => onChange({ region: v })}
              onClear={() => onChange({ region: [] })}
            />
          </FilterPill>

          <FilterPill
            label="More"
            value={moreLabel}
            onClear={() =>
              onChange({ drive: [], steering: [], platform: [] })
            }
            align="end"
          >
            <MoreFilters
              filters={filters}
              onChange={onChange}
              onClear={() =>
                onChange({ drive: [], steering: [], platform: [] })
              }
            />
          </FilterPill>

          {activeCount > 0 && (
            <button
              onClick={onReset}
              className="ml-1 inline-flex items-center gap-1 h-8 px-3 rounded-full border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            >
              <X className="size-3" />
              Reset · {activeCount}
            </button>
          )}
        </div>
      </div>

      <MobileFilterSheet
        open={showMobileSheet}
        onOpenChange={setShowMobileSheet}
        filters={filters}
        matchCount={matchCount}
        seriesCounts={seriesCounts}
        onChange={onChange}
        onReset={onReset}
      />
    </div>
  );
}
