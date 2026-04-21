import type { RemarkableClaim } from "@/lib/fairValue/types"
import { SourceBadge } from "./SourceBadge"
import { ConfidenceDot } from "./ConfidenceDot"

interface ClaimCardProps {
  claim: RemarkableClaim
  onSourceClick?: (claim: RemarkableClaim) => void
}

export function ClaimCard({ claim, onSourceClick }: ClaimCardProps) {
  const sourceLabel = claim.source_url
    ? safeHostname(claim.source_url)
    : claim.source_type.replace(/_/g, " ")

  return (
    <article className="rounded-xl border border-border bg-card/40 p-4">
      <p className="text-[15px] leading-relaxed text-foreground">{claim.claim_text}</p>
      <div className="mt-3 flex items-center gap-2">
        <SourceBadge
          name={sourceLabel}
          captureDate={claim.capture_date ?? undefined}
          onClick={onSourceClick ? () => onSourceClick(claim) : undefined}
        />
        <ConfidenceDot level={claim.confidence} />
      </div>
    </article>
  )
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "source"
  }
}
