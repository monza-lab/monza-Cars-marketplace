"use client"

import { useRegion } from "@/lib/RegionContext"

// ─── MOBILE: REGION PILLS FOR MAKE PAGE ───
export function MakePageRegionPills({ regionCounts }: { regionCounts: Record<string, number> }) {
  const { selectedRegion, setSelectedRegion } = useRegion()
  const REGIONS = [
    { id: "all", label: "All", flag: "\u{1F30D}", countKey: "All" },
    { id: "US", label: "US", flag: "\u{1F1FA}\u{1F1F8}", countKey: "US" },
    { id: "UK", label: "UK", flag: "\u{1F1EC}\u{1F1E7}", countKey: "UK" },
    { id: "EU", label: "EU", flag: "\u{1F1EA}\u{1F1FA}", countKey: "EU" },
    { id: "JP", label: "JP", flag: "\u{1F1EF}\u{1F1F5}", countKey: "JP" },
  ]
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {REGIONS.map((region) => {
          const isActive = (region.id === "all" && !selectedRegion) || selectedRegion === region.id
          const count = regionCounts[region.countKey] || 0
          return (
            <button
              key={region.id}
              onClick={() => setSelectedRegion(region.id === "all" ? null : region.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all shrink-0 ${isActive
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-muted-foreground bg-foreground/3 border border-transparent"
                }`}
            >
              <span className="text-[12px]">{region.flag}</span>
              <span>{region.label}</span>
              <span className={`text-[9px] ${isActive ? "text-primary/60" : "text-muted-foreground"}`}>{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
