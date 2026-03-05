"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
  Clock,
  Gavel,
  CheckCircle2,
  Cog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface Platform {
  id: string;
  label: string;
  shortLabel: string;
}

interface StatusOption {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface TransmissionOption {
  id: string;
  label: string;
}

export interface SidebarFilters {
  platforms: string[];
  priceMin: string;
  priceMax: string;
  yearMin: string;
  yearMax: string;
  make: string;
  statuses: string[];
  transmissions: string[];
}

interface SidebarProps {
  className?: string;
  onApplyFilters?: (filters: SidebarFilters) => void;
  onClearFilters?: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const platforms: Platform[] = [
  { id: "bat", label: "Bring a Trailer", shortLabel: "BaT" },
  { id: "candb", label: "Cars & Bids", shortLabel: "C&B" },
  { id: "cc", label: "Collecting Cars", shortLabel: "CC" },
];

const statusOptions: StatusOption[] = [
  { id: "active", label: "Active", icon: Gavel },
  { id: "ending-soon", label: "Ending Soon", icon: Clock },
  { id: "sold", label: "Sold", icon: CheckCircle2 },
];

const transmissionOptions: TransmissionOption[] = [
  { id: "manual", label: "Manual" },
  { id: "automatic", label: "Automatic" },
];

const popularMakes = [
  "Any",
  "Porsche",
  "BMW",
  "Mercedes-Benz",
  "Ferrari",
  "Lamborghini",
  "Aston Martin",
  "Jaguar",
  "Alfa Romeo",
  "Toyota",
  "Nissan",
  "Chevrolet",
  "Ford",
  "Dodge",
];

const defaultFilters: SidebarFilters = {
  platforms: [],
  priceMin: "",
  priceMax: "",
  yearMin: "",
  yearMax: "",
  make: "",
  statuses: [],
  transmissions: [],
};

/* -------------------------------------------------------------------------- */
/*  Checkbox                                                                  */
/* -------------------------------------------------------------------------- */

function Checkbox({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-600"
      )}
    >
      {checked && (
        <svg
          viewBox="0 0 12 12"
          fill="none"
          className="size-3"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M2.5 6l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section wrapper                                                           */
/* -------------------------------------------------------------------------- */

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-2 text-xs font-semibold tracking-wider text-zinc-300 uppercase transition-colors hover:text-foreground"
      >
        {title}
        <ChevronDown
          className={cn(
            "size-3.5 text-zinc-500 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="pb-3 pt-1">{children}</div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sidebar                                                                   */
/* -------------------------------------------------------------------------- */

export function Sidebar({ className, onApplyFilters, onClearFilters }: SidebarProps) {
  const [filters, setFilters] = useState<SidebarFilters>(defaultFilters);

  const toggleArrayValue = useCallback(
    (key: "platforms" | "statuses" | "transmissions", value: string) => {
      setFilters((prev) => {
        const arr = prev[key];
        return {
          ...prev,
          [key]: arr.includes(value)
            ? arr.filter((v) => v !== value)
            : [...arr, value],
        };
      });
    },
    []
  );

  const updateFilter = useCallback(
    <K extends keyof SidebarFilters>(key: K, value: SidebarFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const hasActiveFilters =
    filters.platforms.length > 0 ||
    filters.priceMin !== "" ||
    filters.priceMax !== "" ||
    filters.yearMin !== "" ||
    filters.yearMax !== "" ||
    filters.make !== "" ||
    filters.statuses.length > 0 ||
    filters.transmissions.length > 0;

  const activeCount = [
    filters.platforms.length > 0,
    filters.priceMin !== "" || filters.priceMax !== "",
    filters.yearMin !== "" || filters.yearMax !== "",
    filters.make !== "",
    filters.statuses.length > 0,
    filters.transmissions.length > 0,
  ].filter(Boolean).length;

  const handleClear = () => {
    setFilters(defaultFilters);
    onClearFilters?.();
  };

  const handleApply = () => {
    onApplyFilters?.(filters);
  };

  return (
    <aside
      className={cn(
        "flex w-[280px] shrink-0 flex-col border-r border-zinc-800/50 bg-zinc-950/50",
        className
      )}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" />
          <span className="text-sm font-semibold text-white">Filters</span>
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              className="h-5 min-w-5 justify-center bg-primary/15 px-1.5 text-[10px] font-bold text-primary"
            >
              {activeCount}
            </Badge>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            Clear All
          </button>
        )}
      </div>

      {/* Scrollable Filter Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {/* Platform Filter */}
        <FilterSection title="Platform">
          <div className="space-y-2">
            {platforms.map((platform) => (
              <label
                key={platform.id}
                htmlFor={`platform-${platform.id}`}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-foreground/3"
              >
                <Checkbox
                  id={`platform-${platform.id}`}
                  checked={filters.platforms.includes(platform.id)}
                  onChange={() => toggleArrayValue("platforms", platform.id)}
                />
                <span className="text-sm text-zinc-400">{platform.label}</span>
                <Badge
                  variant="outline"
                  className="ml-auto border-zinc-800 text-[10px] text-zinc-600"
                >
                  {platform.shortLabel}
                </Badge>
              </label>
            ))}
          </div>
        </FilterSection>

        <Separator className="my-1 bg-zinc-800/40" />

        {/* Price Range */}
        <FilterSection title="Price Range">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-600">
                $
              </span>
              <Input
                type="number"
                placeholder="Min"
                value={filters.priceMin}
                onChange={(e) => updateFilter("priceMin", e.target.value)}
                className="h-8 border-zinc-800 bg-zinc-900/50 pl-6 text-xs text-white placeholder:text-zinc-600"
              />
            </div>
            <span className="text-xs text-zinc-600">&ndash;</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-600">
                $
              </span>
              <Input
                type="number"
                placeholder="Max"
                value={filters.priceMax}
                onChange={(e) => updateFilter("priceMax", e.target.value)}
                className="h-8 border-zinc-800 bg-zinc-900/50 pl-6 text-xs text-white placeholder:text-zinc-600"
              />
            </div>
          </div>
          {/* Quick price presets */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["Under $25k", "$25k-$50k", "$50k-$100k", "$100k+"].map(
              (preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    if (preset === "Under $25k") {
                      updateFilter("priceMin", "");
                      updateFilter("priceMax", "25000");
                    } else if (preset === "$25k-$50k") {
                      updateFilter("priceMin", "25000");
                      updateFilter("priceMax", "50000");
                    } else if (preset === "$50k-$100k") {
                      updateFilter("priceMin", "50000");
                      updateFilter("priceMax", "100000");
                    } else {
                      updateFilter("priceMin", "100000");
                      updateFilter("priceMax", "");
                    }
                  }}
                  className="rounded-md border border-zinc-800/60 bg-zinc-900/30 px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
                >
                  {preset}
                </button>
              )
            )}
          </div>
        </FilterSection>

        <Separator className="my-1 bg-zinc-800/40" />

        {/* Year Range */}
        <FilterSection title="Year Range">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="From"
              value={filters.yearMin}
              onChange={(e) => updateFilter("yearMin", e.target.value)}
              className="h-8 border-zinc-800 bg-zinc-900/50 text-xs text-white placeholder:text-zinc-600"
              min={1900}
              max={2026}
            />
            <span className="text-xs text-zinc-600">&ndash;</span>
            <Input
              type="number"
              placeholder="To"
              value={filters.yearMax}
              onChange={(e) => updateFilter("yearMax", e.target.value)}
              className="h-8 border-zinc-800 bg-zinc-900/50 text-xs text-white placeholder:text-zinc-600"
              min={1900}
              max={2026}
            />
          </div>
          {/* Quick decade presets */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["Pre-1970", "1970s", "1980s", "1990s", "2000+"].map((decade) => (
              <button
                key={decade}
                type="button"
                onClick={() => {
                  if (decade === "Pre-1970") {
                    updateFilter("yearMin", "");
                    updateFilter("yearMax", "1969");
                  } else if (decade === "1970s") {
                    updateFilter("yearMin", "1970");
                    updateFilter("yearMax", "1979");
                  } else if (decade === "1980s") {
                    updateFilter("yearMin", "1980");
                    updateFilter("yearMax", "1989");
                  } else if (decade === "1990s") {
                    updateFilter("yearMin", "1990");
                    updateFilter("yearMax", "1999");
                  } else {
                    updateFilter("yearMin", "2000");
                    updateFilter("yearMax", "");
                  }
                }}
                className="rounded-md border border-zinc-800/60 bg-zinc-900/30 px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
              >
                {decade}
              </button>
            ))}
          </div>
        </FilterSection>

        <Separator className="my-1 bg-zinc-800/40" />

        {/* Make */}
        <FilterSection title="Make">
          <Select
            value={filters.make}
            onValueChange={(val) => updateFilter("make", val === "Any" ? "" : val)}
          >
            <SelectTrigger className="h-8 w-full border-zinc-800 bg-zinc-900/50 text-xs text-zinc-300">
              <SelectValue placeholder="All Makes" />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-zinc-900">
              {popularMakes.map((make) => (
                <SelectItem
                  key={make}
                  value={make}
                  className="text-xs text-zinc-300 focus:bg-foreground/6 focus:text-white"
                >
                  {make}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterSection>

        <Separator className="my-1 bg-zinc-800/40" />

        {/* Status */}
        <FilterSection title="Status">
          <div className="space-y-2">
            {statusOptions.map((status) => {
              const Icon = status.icon;
              const checked = filters.statuses.includes(status.id);
              return (
                <label
                  key={status.id}
                  htmlFor={`status-${status.id}`}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-foreground/3"
                >
                  <Checkbox
                    id={`status-${status.id}`}
                    checked={checked}
                    onChange={() => toggleArrayValue("statuses", status.id)}
                  />
                  <Icon
                    className={cn(
                      "size-3.5",
                      status.id === "active" && "text-emerald-500",
                      status.id === "ending-soon" && "text-amber-500",
                      status.id === "sold" && "text-zinc-500"
                    )}
                  />
                  <span className="text-sm text-zinc-400">{status.label}</span>
                </label>
              );
            })}
          </div>
        </FilterSection>

        <Separator className="my-1 bg-zinc-800/40" />

        {/* Transmission */}
        <FilterSection title="Transmission">
          <div className="space-y-2">
            {transmissionOptions.map((option) => (
              <label
                key={option.id}
                htmlFor={`trans-${option.id}`}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-foreground/3"
              >
                <Checkbox
                  id={`trans-${option.id}`}
                  checked={filters.transmissions.includes(option.id)}
                  onChange={() => toggleArrayValue("transmissions", option.id)}
                />
                <Cog className="size-3.5 text-zinc-600" />
                <span className="text-sm text-zinc-400">{option.label}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      </div>

      {/* Apply Button (sticky at bottom) */}
      <div className="border-t border-zinc-800/50 p-4">
        <Button
          onClick={handleApply}
          className="w-full bg-primary font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-md hover:shadow-primary/10"
        >
          <SlidersHorizontal className="size-4" />
          Apply Filters
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-5 min-w-5 justify-center bg-primary-foreground/20 px-1.5 text-[10px] text-primary-foreground"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </div>
    </aside>
  );
}
