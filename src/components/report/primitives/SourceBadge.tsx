"use client"

interface SourceBadgeProps {
  name: string
  count?: number
  captureDate?: string
  onClick?: () => void
  className?: string
}

export function SourceBadge({
  name,
  count,
  captureDate,
  onClick,
  className = "",
}: SourceBadgeProps) {
  const content = (
    <>
      <span className="font-medium">{name}</span>
      {count !== undefined && <span className="text-muted-foreground">· {count}</span>}
      {captureDate && <span className="text-muted-foreground">· {captureDate}</span>}
    </>
  )

  const base =
    "inline-flex items-center gap-1 rounded-full bg-foreground/5 hover:bg-foreground/10 px-2 py-0.5 text-[11px] transition-colors"

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} cursor-pointer ${className}`}
      >
        {content}
      </button>
    )
  }

  return <span className={`${base} ${className}`}>{content}</span>
}
