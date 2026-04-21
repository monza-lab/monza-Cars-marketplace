interface ConfidenceDotProps {
  level: "high" | "medium" | "low" | "insufficient"
  className?: string
}

const CLASS_BY_LEVEL = {
  high: "bg-positive",
  medium: "bg-amber-500",
  low: "bg-orange-500",
  insufficient: "bg-muted-foreground",
} as const

export function ConfidenceDot({ level, className = "" }: ConfidenceDotProps) {
  return (
    <span
      aria-label={`${level} confidence`}
      title={`${level} confidence`}
      className={`inline-block size-2 rounded-full ${CLASS_BY_LEVEL[level]} ${className}`}
    />
  )
}
