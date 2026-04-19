"use client";

import { useState, useCallback } from "react";
import {
  SlidersHorizontal,
  ChevronDown,
  RotateCcw,
  Check,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --- Types ---

export interface FilterValues {
  platforms: string[];
  priceMin: string;
  priceMax: string;
  yearMin: string;
  yearMax: string;
  status: string;
  make: string;
  transmission: string;
}

export const defaultFilters: FilterValues = {
  platforms: [],
  priceMin: "",
  priceMax: "",
  yearMin: "",
  yearMax: "",
  status: "",
  make: "",
  transmission: "",
};

interface FiltersProps {
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
  className?: string;
}

// --- Constants ---

const PLATFORMS = [
  "Bring a Trailer",
  "Cars & Bids",
  "Hemmings",
  "RM Sotheby's",
  "Bonhams",
  "Mecum",
  "Barrett-Jackson",
];

const STATUSES = [
  { value: "live", label: "Live" },
  { value: "ended", label: "Sold / Ended" },
  { value: "upcoming", label: "Upcoming" },
  { value: "sold", label: "Sold" },
  { value: "no-sale", label: "No Sale" },
];

const POPULAR_MAKES = [
  "Porsche",
  "BMW",
  "Mercedes-Benz",
  "Ferrari",
  "Lamborghini",
  "Aston Martin",
  "Jaguar",
  "Chevrolet",
  "Ford",
  "Toyota",
  "Nissan",
  "Audi",
  "Land Rover",
  "Alfa Romeo",
  "Maserati",
  "McLaren",
  "Lotus",
  "Bentley",
  "Rolls-Royce",
];

const TRANSMISSIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
  { value: "semi-automatic", label: "Semi-Automatic" },
  { value: "cvt", label: "CVT" },
  { value: "dct", label: "Dual-Clutch (DCT)" },
];

// --- Component ---

export function Filters({ filters, onChange, className }: FiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterValues>(filters);

  const activeFilterCount = countActiveFilters(filters);

  const updateLocal = useCallback(
    (key: keyof FilterValues, value: string | string[]) => {
      setLocalFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const togglePlatform = useCallback((platform: string) => {
    setLocalFilters((prev) => {
      const platforms = prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform];
      return { ...prev, platforms };
    });
  }, []);

  const handleApply = () => {
    onChange(localFilters);
  };

  const handleReset = () => {
    setLocalFilters(defaultFilters);
    onChange(defaultFilters);
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Toggle bar for mobile / collapsed state */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border px-4 py-3 transition-all duration-300 lg:hidden",
          isExpanded
            ? "border-amber-500/30 bg-zinc-950/90"
            : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
        )}
      >
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal
            className={cn(
              "size-4",
              isExpanded ? "text-destructive" : "text-zinc-400"
            )}
          />
          <span className="text-sm font-medium text-zinc-200">Filters</span>
          {activeFilterCount > 0 && (
            <Badge className="border-amber-500/30 bg-amber-500/10 text-destructive">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-zinc-400 transition-transform duration-300",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Filter content - always visible on desktop, collapsible on mobile */}
      <AnimatePresence initial={false}>
        {(isExpanded || true) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              "overflow-hidden",
              !isExpanded && "hidden lg:block"
            )}
          >
            <div className="space-y-5 pt-4 lg:pt-0">
              {/* Platform multi-select */}
              <FilterSection title="Platform">
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((platform) => {
                    const isSelected =
                      localFilters.platforms.includes(platform);
                    return (
                      <button
                        key={platform}
                        onClick={() => togglePlatform(platform)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                          isSelected
                            ? "border-amber-500/40 bg-amber-500/10 text-destructive shadow-sm shadow-amber-500/5"
                            : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                        )}
                      >
                        {isSelected && <Check className="size-3" />}
                        {platform}
                        {isSelected && (
                          <X className="size-3 opacity-60 hover:opacity-100" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </FilterSection>

              {/* Price range */}
              <FilterSection title="Price Range">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                      $
                    </span>
                    <Input
                      type="number"
                      placeholder="Min"
                      value={localFilters.priceMin}
                      onChange={(e) => updateLocal("priceMin", e.target.value)}
                      className="border-zinc-800 bg-zinc-900/50 pl-7 text-sm text-zinc-200 placeholder:text-zinc-600 focus-visible:border-amber-500/40 focus-visible:ring-amber-500/10"
                    />
                  </div>
                  <span className="text-xs text-zinc-600">to</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                      $
                    </span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={localFilters.priceMax}
                      onChange={(e) => updateLocal("priceMax", e.target.value)}
                      className="border-zinc-800 bg-zinc-900/50 pl-7 text-sm text-zinc-200 placeholder:text-zinc-600 focus-visible:border-amber-500/40 focus-visible:ring-amber-500/10"
                    />
                  </div>
                </div>
              </FilterSection>

              {/* Year range */}
              <FilterSection title="Year Range">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    placeholder="From"
                    min={1900}
                    max={2026}
                    value={localFilters.yearMin}
                    onChange={(e) => updateLocal("yearMin", e.target.value)}
                    className="flex-1 border-zinc-800 bg-zinc-900/50 text-sm text-zinc-200 placeholder:text-zinc-600 focus-visible:border-amber-500/40 focus-visible:ring-amber-500/10"
                  />
                  <span className="text-xs text-zinc-600">to</span>
                  <Input
                    type="number"
                    placeholder="To"
                    min={1900}
                    max={2026}
                    value={localFilters.yearMax}
                    onChange={(e) => updateLocal("yearMax", e.target.value)}
                    className="flex-1 border-zinc-800 bg-zinc-900/50 text-sm text-zinc-200 placeholder:text-zinc-600 focus-visible:border-amber-500/40 focus-visible:ring-amber-500/10"
                  />
                </div>
              </FilterSection>

              {/* Status */}
              <FilterSection title="Status">
                <Select
                  value={localFilters.status}
                  onValueChange={(v) => updateLocal("status", v)}
                >
                  <SelectTrigger className="w-full border-zinc-800 bg-zinc-900/50 text-sm text-zinc-200 focus:border-amber-500/40 focus:ring-amber-500/10">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-zinc-950 shadow-xl shadow-black/40">
                    {STATUSES.map((status) => (
                      <SelectItem
                        key={status.value}
                        value={status.value}
                        className="cursor-pointer text-sm text-zinc-300 focus:bg-amber-500/10 focus:text-destructive"
                      >
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterSection>

              {/* Make */}
              <FilterSection title="Make">
                <Select
                  value={localFilters.make}
                  onValueChange={(v) => updateLocal("make", v)}
                >
                  <SelectTrigger className="w-full border-zinc-800 bg-zinc-900/50 text-sm text-zinc-200 focus:border-amber-500/40 focus:ring-amber-500/10">
                    <SelectValue placeholder="All makes" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px] border-zinc-800 bg-zinc-950 shadow-xl shadow-black/40">
                    {POPULAR_MAKES.map((make) => (
                      <SelectItem
                        key={make}
                        value={make.toLowerCase()}
                        className="cursor-pointer text-sm text-zinc-300 focus:bg-amber-500/10 focus:text-destructive"
                      >
                        {make}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterSection>

              {/* Transmission */}
              <FilterSection title="Transmission">
                <Select
                  value={localFilters.transmission}
                  onValueChange={(v) => updateLocal("transmission", v)}
                >
                  <SelectTrigger className="w-full border-zinc-800 bg-zinc-900/50 text-sm text-zinc-200 focus:border-amber-500/40 focus:ring-amber-500/10">
                    <SelectValue placeholder="All transmissions" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-zinc-950 shadow-xl shadow-black/40">
                    {TRANSMISSIONS.map((t) => (
                      <SelectItem
                        key={t.value}
                        value={t.value}
                        className="cursor-pointer text-sm text-zinc-300 focus:bg-amber-500/10 focus:text-destructive"
                      >
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterSection>

              {/* Action buttons */}
              <div className="flex items-center gap-3 border-t border-zinc-800/60 pt-5">
                <Button
                  onClick={handleApply}
                  className="flex-1 border border-amber-500/20 bg-gradient-to-r from-amber-600 to-amber-500 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-500/10 transition-all hover:from-amber-500 hover:to-amber-400 hover:shadow-amber-500/20"
                >
                  <Check className="mr-1.5 size-4" />
                  Apply Filters
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="border-zinc-800 bg-zinc-900/50 text-sm text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/80 hover:text-zinc-200"
                >
                  <RotateCcw className="mr-1.5 size-3.5" />
                  Reset
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </label>
      {children}
    </div>
  );
}

// --- Helpers ---

function countActiveFilters(filters: FilterValues): number {
  let count = 0;
  if (filters.platforms.length > 0) count++;
  if (filters.priceMin || filters.priceMax) count++;
  if (filters.yearMin || filters.yearMax) count++;
  if (filters.status) count++;
  if (filters.make) count++;
  if (filters.transmission) count++;
  return count;
}
