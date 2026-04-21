"use client"

import Image from "next/image"
import { Download, RefreshCw } from "lucide-react"
import type { ReportTier } from "@/lib/fairValue/types"

interface ReportHeaderProps {
  carTitle: string
  carThumbUrl: string | null
  generatedAt: string
  reportVersion: number
  tier: ReportTier
  onDownloadClick: () => void
  onRegenerateClick?: () => void
}

const TIER_LABEL: Record<ReportTier, string> = {
  tier_1: "Tier 1",
  tier_2: "Tier 2",
  tier_3: "Tier 3",
}

export function ReportHeader({
  carTitle,
  carThumbUrl,
  generatedAt,
  reportVersion,
  tier,
  onDownloadClick,
  onRegenerateClick,
}: ReportHeaderProps) {
  const dateStr = new Date(generatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md">
      {carThumbUrl && (
        <Image
          src={carThumbUrl}
          alt={carTitle}
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-lg object-cover"
          unoptimized
        />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[14px] font-semibold text-foreground md:text-[16px]">
          {carTitle}
        </h1>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground md:text-[11px]">
          Generated {dateStr} · v{reportVersion} · {TIER_LABEL[tier]}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onRegenerateClick && (
          <button
            type="button"
            onClick={onRegenerateClick}
            aria-label="Regenerate report"
            className="rounded-lg p-2 hover:bg-foreground/5 active:scale-95"
          >
            <RefreshCw className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onDownloadClick}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 active:scale-95"
        >
          <Download className="size-4" />
          <span className="hidden sm:inline">Download</span>
        </button>
      </div>
    </header>
  )
}
