"use client"

// ─── FILTER CHIP ───
export function FilterChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string
  active: boolean
  onClick: () => void
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium transition-all
        ${active
          ? "bg-primary text-primary-foreground"
          : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 border border-border"
        }
      `}
    >
      {label}
      {count !== undefined && (
        <span className={`text-[10px] ${active ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
          ({count})
        </span>
      )}
    </button>
  )
}

// ─── SIDEBAR FILTER PILL ───
export function SidebarPill({
  label,
  active,
  onClick,
  count,
}: {
  label: string
  active: boolean
  onClick: () => void
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap ${active
          ? "bg-primary text-primary-foreground"
          : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 border border-border"
        }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`ml-1 text-[9px] ${active ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
          {count}
        </span>
      )}
    </button>
  )
}
