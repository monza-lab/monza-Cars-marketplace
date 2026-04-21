"use client"

import { Sparkles } from "lucide-react"
import type { RemarkableClaim, ReportTier } from "@/lib/fairValue/types"
import { ClaimCard } from "./primitives/ClaimCard"

interface WhatsRemarkableBlockProps {
  claims: RemarkableClaim[]
  tier: ReportTier
  onUpgradeClick?: () => void
  onSeeSampleClick?: () => void
  onSourceClick?: (claim: RemarkableClaim) => void
}

export function WhatsRemarkableBlock({
  claims,
  tier,
  onUpgradeClick,
  onSeeSampleClick,
  onSourceClick,
}: WhatsRemarkableBlockProps) {
  const subtitle =
    tier === "tier_1"
      ? `${claims.length} ${claims.length === 1 ? "finding" : "findings"} about this specific VIN`
      : tier === "tier_2"
        ? `${claims.length} findings with specialist context`
        : `${claims.length} findings with specialist variant analysis`

  return (
    <section className="px-4 py-6" aria-labelledby="remarkable-heading">
      <h2
        id="remarkable-heading"
        className="font-serif text-[20px] font-semibold md:text-[24px]"
      >
        What&apos;s Remarkable
      </h2>
      <p className="mt-1 text-[12px] text-muted-foreground">{subtitle}</p>

      {claims.length > 0 ? (
        <div className="mt-4 space-y-3">
          {claims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} onSourceClick={onSourceClick} />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-card/30 p-4 text-[13px] text-muted-foreground">
          No remarkable findings were extracted for this listing.
        </p>
      )}

      {tier === "tier_1" && (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-card/30 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-[13px] font-medium">
                Monthly subscribers unlock production context + specialist variant analysis
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                {onSeeSampleClick && (
                  <button
                    type="button"
                    onClick={onSeeSampleClick}
                    className="text-primary hover:underline"
                  >
                    See sample →
                  </button>
                )}
                {onUpgradeClick && (
                  <button
                    type="button"
                    onClick={onUpgradeClick}
                    className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Upgrade
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
