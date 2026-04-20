"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { usePathname } from "@/i18n/navigation";
import { EMPTY_FILTERS, type ClassicFilters, type SortOption, type StatusFilter } from "./types";

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseInt10(value: string | null): number | null {
  if (value === null || value === "") return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function parseStatus(value: string | null): StatusFilter {
  if (value === "live" || value === "sold") return value;
  return "all";
}

function parseSort(value: string | null): SortOption {
  const valid: SortOption[] = [
    "newest", "priceDesc", "priceAsc", "endingSoon", "yearDesc", "yearAsc", "mileageAsc",
  ];
  return (valid as string[]).includes(value || "") ? (value as SortOption) : "newest";
}

function parseFiltersFromSearchParams(params: URLSearchParams): ClassicFilters {
  return {
    q: params.get("q") || "",
    series: parseList(params.get("series")),
    variants: parseList(params.get("variants")),
    yearMin: parseInt10(params.get("yearMin")),
    yearMax: parseInt10(params.get("yearMax")),
    priceMin: parseInt10(params.get("priceMin")),
    priceMax: parseInt10(params.get("priceMax")),
    mileageMin: parseInt10(params.get("mileageMin")),
    mileageMax: parseInt10(params.get("mileageMax")),
    transmission: parseList(params.get("trans")),
    body: parseList(params.get("body")),
    region: parseList(params.get("region")),
    drive: parseList(params.get("drive")),
    steering: parseList(params.get("steering")),
    platform: parseList(params.get("platform")),
    status: parseStatus(params.get("status")),
    sort: parseSort(params.get("sort")),
  };
}

function serializeFiltersToSearchParams(f: ClassicFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.series.length) p.set("series", f.series.join(","));
  if (f.variants.length) p.set("variants", f.variants.join(","));
  if (f.yearMin !== null) p.set("yearMin", String(f.yearMin));
  if (f.yearMax !== null) p.set("yearMax", String(f.yearMax));
  if (f.priceMin !== null) p.set("priceMin", String(f.priceMin));
  if (f.priceMax !== null) p.set("priceMax", String(f.priceMax));
  if (f.mileageMin !== null) p.set("mileageMin", String(f.mileageMin));
  if (f.mileageMax !== null) p.set("mileageMax", String(f.mileageMax));
  if (f.transmission.length) p.set("trans", f.transmission.join(","));
  if (f.body.length) p.set("body", f.body.join(","));
  if (f.region.length) p.set("region", f.region.join(","));
  if (f.drive.length) p.set("drive", f.drive.join(","));
  if (f.steering.length) p.set("steering", f.steering.join(","));
  if (f.platform.length) p.set("platform", f.platform.join(","));
  if (f.status !== "all") p.set("status", f.status);
  if (f.sort !== "newest") p.set("sort", f.sort);
  return p;
}

export function useClassicFilters(): {
  filters: ClassicFilters;
  setFilters: (updater: Partial<ClassicFilters> | ((prev: ClassicFilters) => ClassicFilters)) => void;
  resetFilters: () => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseFiltersFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const commit = useCallback(
    (next: ClassicFilters) => {
      const p = serializeFiltersToSearchParams(next);
      const qs = p.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      router.replace(target, { scroll: false });
    },
    [pathname, router],
  );

  const setFilters = useCallback(
    (updater: Partial<ClassicFilters> | ((prev: ClassicFilters) => ClassicFilters)) => {
      const prev = parseFiltersFromSearchParams(new URLSearchParams(searchParams.toString()));
      const next =
        typeof updater === "function"
          ? updater(prev)
          : { ...prev, ...updater };
      commit(next);
    },
    [commit, searchParams],
  );

  const resetFilters = useCallback(() => commit(EMPTY_FILTERS), [commit]);

  return { filters, setFilters, resetFilters };
}
