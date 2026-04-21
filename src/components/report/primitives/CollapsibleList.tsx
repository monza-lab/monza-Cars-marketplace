"use client"

import { useState } from "react"

interface CollapsibleListProps<T> {
  items: T[]
  initialCount: number
  render: (item: T, index: number) => React.ReactNode
  moreLabel: (hidden: number) => string
  lessLabel?: string
  className?: string
}

export function CollapsibleList<T>({
  items,
  initialCount,
  render,
  moreLabel,
  lessLabel = "Show less",
  className = "",
}: CollapsibleListProps<T>) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, initialCount)
  const hidden = items.length - visible.length

  return (
    <div className={className}>
      <div className="space-y-2">{visible.map((item, i) => render(item, i))}</div>
      {(hidden > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-[12px] text-primary hover:underline"
        >
          {expanded ? lessLabel : moreLabel(hidden)}
        </button>
      )}
    </div>
  )
}
