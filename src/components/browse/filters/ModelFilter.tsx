"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { getFamilyGroupsWithSeries, getSeriesVariants } from "@/lib/brandConfig";
import { cn } from "@/lib/utils";

type ModelFilterProps = {
  series: string[];
  variants: string[];
  seriesCounts: Record<string, number>;
  onChange: (series: string[], variants: string[]) => void;
  onClear: () => void;
};

export function ModelFilter({
  series,
  variants,
  seriesCounts,
  onChange,
  onClear,
}: ModelFilterProps) {
  const [search, setSearch] = useState("");
  const familyGroups = useMemo(() => getFamilyGroupsWithSeries("porsche"), []);

  const toggleSeries = (id: string) => {
    const next = series.includes(id)
      ? series.filter((s) => s !== id)
      : [...series, id];
    // When removing a series, drop its variants too
    const variantsForRemoved = series.includes(id) ? getSeriesVariants(id, "porsche").map((v) => v.id) : [];
    const nextVariants = variants.filter((v) => !variantsForRemoved.includes(v));
    onChange(next, nextVariants);
  };

  const toggleVariant = (variantId: string) => {
    const next = variants.includes(variantId)
      ? variants.filter((v) => v !== variantId)
      : [...variants, variantId];
    onChange(series, next);
  };

  const q = search.trim().toLowerCase();

  return (
    <div className="w-[360px] max-h-[70vh] flex flex-col">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search series or variant..."
            className="w-full h-8 pl-8 pr-3 rounded-md bg-foreground/[0.03] border border-border text-[12px] focus:outline-none focus:border-primary/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {familyGroups.map((group) => {
          const seriesInGroup = group.series.filter((s) => {
            if (!q) return true;
            const matchSeries = s.label.toLowerCase().includes(q);
            const matchVariant = getSeriesVariants(s.id, "porsche").some((v) =>
              v.label.toLowerCase().includes(q),
            );
            return matchSeries || matchVariant;
          });
          if (seriesInGroup.length === 0) return null;

          return (
            <div key={group.id} className="mb-2 last:mb-0">
              <p className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
                {group.label}
              </p>
              {seriesInGroup.map((s) => {
                const count = seriesCounts[s.id] || 0;
                const checked = series.includes(s.id);
                const seriesVariants = getSeriesVariants(s.id, "porsche");
                const expanded = checked || (q && seriesVariants.some((v) => v.label.toLowerCase().includes(q)));

                return (
                  <div key={s.id}>
                    <button
                      type="button"
                      onClick={() => toggleSeries(s.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                        checked
                          ? "bg-primary/8 text-foreground"
                          : "text-foreground hover:bg-foreground/[0.04]",
                      )}
                    >
                      <span
                        className={cn(
                          "size-4 rounded border flex items-center justify-center shrink-0",
                          checked ? "bg-primary border-primary" : "border-border bg-foreground/[0.02]",
                        )}
                      >
                        {checked && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
                      </span>
                      <span className="text-[13px] flex-1">{s.label}</span>
                      {count > 0 && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
                      )}
                    </button>

                    {expanded && seriesVariants.length > 0 && (
                      <div className="ml-6 mb-1 flex flex-wrap gap-1">
                        {seriesVariants
                          .filter((v) => !q || v.label.toLowerCase().includes(q) || s.label.toLowerCase().includes(q))
                          .map((v) => {
                            const vChecked = variants.includes(v.id);
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => toggleVariant(v.id)}
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                                  vChecked
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                                )}
                              >
                                {v.label}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {(series.length > 0 || variants.length > 0) && (
        <div className="border-t border-border p-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {series.length} series · {variants.length} variants
          </span>
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-3" />
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
