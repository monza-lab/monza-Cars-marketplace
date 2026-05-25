"use client"

import { ChevronRight } from "lucide-react"
import type { SeriesMatch } from "@/lib/searchIndex"

interface SeriesColumnProps {
  items: SeriesMatch[]
  activeId: string | null
  onHover: (id: string | null) => void
  onSelect: (item: SeriesMatch) => void
  variant: "header" | "sheet" | "inline"
}

export function SeriesColumn({ items, activeId, onHover, onSelect, variant }: SeriesColumnProps) {
  const isStack = variant === "sheet"

  if (items.length === 0) {
    return (
      <div className={isStack ? "" : "max-h-[60vh] overflow-y-auto"}>
        <p className="px-3 pt-2 pb-1 text-[9px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
          Series
        </p>
        <p className="px-3 py-4 text-[11px] text-muted-foreground">No series match.</p>
      </div>
    )
  }

  return (
    <div className={isStack ? "" : "max-h-[60vh] overflow-y-auto"}>
      <p className="px-3 pt-2 pb-1 text-[9px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
        Series
      </p>
      <ul role="listbox" aria-label="Series" className="pb-2">
        {items.map((s) => {
          const active = s.id === activeId
          return (
            <li key={s.id} role="option" aria-selected={active}>
              <button
                type="button"
                onMouseEnter={() => onHover(s.id)}
                onFocus={() => onHover(s.id)}
                onClick={() => onSelect(s)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left transition-colors ${
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-foreground hover:bg-foreground/[0.05]"
                }`}
              >
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[12px] font-medium truncate">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {s.yearRange[0]}–{s.yearRange[1]}
                  </span>
                </span>
                <ChevronRight
                  className={`size-3 shrink-0 ${active ? "text-primary" : "text-muted-foreground/60"}`}
                />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
