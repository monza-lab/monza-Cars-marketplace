import type { DataTrustLevel } from "@/lib/reports/types-v3"

const BADGE_CONFIG: Record<DataTrustLevel, { label: string; color: string; bg: string }> = {
  verified_from_data: {
    label: "Verified from Data",
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/30",
  },
  ai_analysis: {
    label: "AI Analysis",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  ai_estimated: {
    label: "AI Estimated",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
  },
  from_listing: {
    label: "From Listing",
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-800/50",
  },
}

interface DataTrustBadgeProps {
  level: DataTrustLevel
  dataPoints?: number
  className?: string
}

export function DataTrustBadge({ level, dataPoints, className = "" }: DataTrustBadgeProps) {
  const config = BADGE_CONFIG[level]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color} ${className}`}>
      {config.label}
      {dataPoints != null && dataPoints > 0 && (
        <span className="opacity-70">({dataPoints} data points)</span>
      )}
    </span>
  )
}
