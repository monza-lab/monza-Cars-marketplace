"use client"

import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"

export function MobileRegionPills() {
  const { selectedRegion, setSelectedRegion } = useRegion()
  const t = useTranslations("dashboard")
  const REGIONS = [
    { id: "all", label: t("sidebar.allRegions"), flag: "\u{1F30D}" },
    { id: "US", label: "US", flag: "\u{1F1FA}\u{1F1F8}" },
    { id: "UK", label: "UK", flag: "\u{1F1EC}\u{1F1E7}" },
    { id: "EU", label: "EU", flag: "\u{1F1EA}\u{1F1FA}" },
    { id: "JP", label: "JP", flag: "\u{1F1EF}\u{1F1F5}" },
  ]
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-1">
        {REGIONS.map((region) => {
          const isActive = (region.id === "all" && !selectedRegion) || selectedRegion === region.id
          return (
            <button
              key={region.id}
              onClick={() => setSelectedRegion(region.id === "all" ? null : region.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                isActive
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-muted-foreground bg-foreground/3 border border-transparent"
              }`}
            >
              <span className="text-[12px]">{region.flag}</span>
              <span>{region.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
