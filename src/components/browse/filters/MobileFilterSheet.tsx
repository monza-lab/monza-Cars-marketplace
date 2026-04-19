"use client";

import { useState } from "react";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useCurrency } from "@/lib/CurrencyContext";
import { RangeFilter } from "./RangeFilter";
import { CheckboxFilter } from "./CheckboxFilter";
import { ModelFilter } from "./ModelFilter";
import { getSeriesConfig } from "@/lib/brandConfig";
import {
  BODY_OPTIONS,
  REGION_OPTIONS,
  TRANSMISSION_OPTIONS,
  DRIVE_OPTIONS,
  STEERING_OPTIONS,
  PLATFORM_OPTIONS,
  YEAR_BOUNDS,
  PRICE_BOUNDS,
  MILEAGE_BOUNDS,
  countActiveFilters,
  type ClassicFilters,
} from "./types";
import { cn } from "@/lib/utils";

type SectionId =
  | "root"
  | "model"
  | "year"
  | "price"
  | "mileage"
  | "transmission"
  | "body"
  | "region"
  | "drive"
  | "steering"
  | "platform";

type MobileFilterSheetProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filters: ClassicFilters;
  matchCount: number;
  seriesCounts: Record<string, number>;
  onChange: (updater: Partial<ClassicFilters>) => void;
  onReset: () => void;
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export function MobileFilterSheet({
  open,
  onOpenChange,
  filters,
  matchCount,
  seriesCounts,
  onChange,
  onReset,
}: MobileFilterSheetProps) {
  const { formatPrice } = useCurrency();
  const [section, setSection] = useState<SectionId>("root");
  const activeCount = countActiveFilters(filters);

  const modelSummary = (() => {
    const seriesLabels = filters.series
      .map((id) => getSeriesConfig(id, "porsche")?.label)
      .filter(Boolean) as string[];
    if (seriesLabels.length === 0 && filters.variants.length === 0) return null;
    if (seriesLabels.length <= 2 && filters.variants.length === 0) return seriesLabels.join(", ");
    if (seriesLabels.length > 0 && filters.variants.length > 0)
      return `${seriesLabels.length} series · ${filters.variants.length} variants`;
    if (filters.variants.length > 0) return `${filters.variants.length} variants`;
    return `${seriesLabels.length} series`;
  })();

  const yearSummary =
    filters.yearMin === null && filters.yearMax === null
      ? null
      : `${filters.yearMin ?? YEAR_BOUNDS.min}–${filters.yearMax ?? YEAR_BOUNDS.max}`;

  const priceSummary =
    filters.priceMin === null && filters.priceMax === null
      ? null
      : `${formatPrice(filters.priceMin ?? PRICE_BOUNDS.min)}–${formatPrice(
          filters.priceMax ?? PRICE_BOUNDS.max,
        )}`;

  const mileageSummary = (() => {
    if (filters.mileageMin === null && filters.mileageMax === null) return null;
    const lo = filters.mileageMin ?? MILEAGE_BOUNDS.min;
    const hi = filters.mileageMax ?? MILEAGE_BOUNDS.max;
    if (lo === MILEAGE_BOUNDS.min) return `< ${formatCompact(hi)} mi`;
    return `${formatCompact(lo)}–${formatCompact(hi)} mi`;
  })();

  const transSummary =
    filters.transmission.length === 0
      ? null
      : filters.transmission
          .map((id) => TRANSMISSION_OPTIONS.find((o) => o.id === id)?.label)
          .filter(Boolean)
          .join(", ");

  const bodySummary =
    filters.body.length === 0
      ? null
      : filters.body
          .map((id) => BODY_OPTIONS.find((o) => o.id === id)?.label)
          .filter(Boolean)
          .join(", ");

  const regionSummary =
    filters.region.length === 0 ? null : filters.region.join(" · ");

  const driveSummary =
    filters.drive.length === 0
      ? null
      : filters.drive
          .map((id) => DRIVE_OPTIONS.find((o) => o.id === id)?.label)
          .filter(Boolean)
          .join(", ");

  const steeringSummary =
    filters.steering.length === 0
      ? null
      : filters.steering
          .map((id) => STEERING_OPTIONS.find((o) => o.id === id)?.label)
          .filter(Boolean)
          .join(", ");

  const platformSummary =
    filters.platform.length === 0 ? null : `${filters.platform.length} selected`;

  const rows: { id: SectionId; label: string; value: string | null }[] = [
    { id: "model", label: "Model", value: modelSummary },
    { id: "year", label: "Year", value: yearSummary },
    { id: "price", label: "Price", value: priceSummary },
    { id: "mileage", label: "Mileage", value: mileageSummary },
    { id: "transmission", label: "Transmission", value: transSummary },
    { id: "body", label: "Body", value: bodySummary },
    { id: "region", label: "Region", value: regionSummary },
    { id: "drive", label: "Drive", value: driveSummary },
    { id: "steering", label: "Steering", value: steeringSummary },
    { id: "platform", label: "Platform", value: platformSummary },
  ];

  const closeSheet = () => {
    setSection("root");
    onOpenChange(false);
  };

  const sectionTitle = (() => {
    if (section === "root") return "Filters";
    const row = rows.find((r) => r.id === section);
    return row?.label ?? "Filters";
  })();

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setSection("root");
        onOpenChange(o);
      }}
      title={
        <div className="flex items-center gap-2">
          {section !== "root" && (
            <button
              type="button"
              onClick={() => setSection("root")}
              className="-ml-1 size-7 inline-flex items-center justify-center rounded-full hover:bg-foreground/5"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <span>{sectionTitle}</span>
        </div>
      }
      description={
        section === "root"
          ? activeCount === 0
            ? "Refine acquisitions"
            : `${activeCount} filter${activeCount === 1 ? "" : "s"} active`
          : undefined
      }
      footer={
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onReset();
              }}
              className="h-11 px-4 rounded-full border border-border text-[12px] font-medium text-foreground active:bg-foreground/5"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={closeSheet}
            className="flex-1 h-11 rounded-full bg-primary text-primary-foreground text-[13px] font-medium active:bg-primary/90 transition-colors"
          >
            {matchCount === 0
              ? "No matches — adjust filters"
              : `Show ${matchCount.toLocaleString()} result${matchCount === 1 ? "" : "s"}`}
          </button>
        </div>
      }
    >
      {section === "root" && (
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSection(r.id)}
              className="w-full flex items-center justify-between px-5 py-3.5 min-h-[52px] active:bg-foreground/[0.03] transition-colors"
            >
              <span className="text-[14px] font-medium text-foreground">{r.label}</span>
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "text-[12px] truncate max-w-[160px]",
                    r.value ? "text-primary font-medium" : "text-muted-foreground",
                  )}
                >
                  {r.value || "Any"}
                </span>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </span>
            </button>
          ))}
        </div>
      )}

      {section === "model" && (
        <div className="p-0">
          <ModelFilter
            series={filters.series}
            variants={filters.variants}
            seriesCounts={seriesCounts}
            onChange={(series, variants) => onChange({ series, variants })}
            onClear={() => onChange({ series: [], variants: [] })}
          />
        </div>
      )}

      {section === "year" && (
        <RangeFilter
          label="Year of production"
          min={YEAR_BOUNDS.min}
          max={YEAR_BOUNDS.max}
          valueMin={filters.yearMin}
          valueMax={filters.yearMax}
          onChange={(lo, hi) => onChange({ yearMin: lo, yearMax: hi })}
          onClear={() => onChange({ yearMin: null, yearMax: null })}
        />
      )}

      {section === "price" && (
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
      )}

      {section === "mileage" && (
        <RangeFilter
          label="Mileage"
          unit="mi"
          min={MILEAGE_BOUNDS.min}
          max={MILEAGE_BOUNDS.max}
          step={1000}
          valueMin={filters.mileageMin}
          valueMax={filters.mileageMax}
          onChange={(lo, hi) => onChange({ mileageMin: lo, mileageMax: hi })}
          onClear={() => onChange({ mileageMin: null, mileageMax: null })}
        />
      )}

      {section === "transmission" && (
        <CheckboxFilter
          label="Transmission"
          options={TRANSMISSION_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
          value={filters.transmission}
          onChange={(v) => onChange({ transmission: v })}
          onClear={() => onChange({ transmission: [] })}
        />
      )}

      {section === "body" && (
        <CheckboxFilter
          label="Body type"
          options={BODY_OPTIONS}
          value={filters.body}
          onChange={(v) => onChange({ body: v })}
          onClear={() => onChange({ body: [] })}
        />
      )}

      {section === "region" && (
        <CheckboxFilter
          label="Region"
          options={REGION_OPTIONS}
          value={filters.region}
          onChange={(v) => onChange({ region: v })}
          onClear={() => onChange({ region: [] })}
        />
      )}

      {section === "drive" && (
        <CheckboxFilter
          label="Drive"
          options={DRIVE_OPTIONS}
          value={filters.drive}
          onChange={(v) => onChange({ drive: v })}
          onClear={() => onChange({ drive: [] })}
        />
      )}

      {section === "steering" && (
        <CheckboxFilter
          label="Steering"
          options={STEERING_OPTIONS}
          value={filters.steering}
          onChange={(v) => onChange({ steering: v })}
          onClear={() => onChange({ steering: [] })}
        />
      )}

      {section === "platform" && (
        <CheckboxFilter
          label="Platform"
          options={PLATFORM_OPTIONS}
          value={filters.platform}
          onChange={(v) => onChange({ platform: v })}
          onClear={() => onChange({ platform: [] })}
        />
      )}
    </BottomSheet>
  );
}
