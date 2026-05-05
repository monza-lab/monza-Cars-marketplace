"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import type { RemarkableClaim } from "@/lib/fairValue/types"
import { ClaimCard } from "./primitives/ClaimCard"

interface SeeSampleModalProps {
  open: boolean
  onClose: () => void
  onUpgradeClick?: () => void
}

const SAMPLE_CAR_TITLE = "2023 Porsche 992 GT3 Touring · Paint-to-Sample Gulf Blue"

const SAMPLE_CLAIMS: RemarkableClaim[] = [
  {
    id: "sample-1",
    claim_text:
      "Paint-to-Sample Gulf Blue (code Y5C) is documented on roughly 11% of 992 GT3 order books through 2024 — not vanishingly rare, but durable collector demand keeps premium steady.",
    source_type: "reference_pack",
    source_ref: "hagerty.pts.tracker.2024",
    source_url:
      "https://www.hagerty.com/media/market-trends/porsche-paint-to-sample-values/",
    capture_date: "2026-03-02",
    confidence: "high",
    tier_required: "tier_2",
  },
  {
    id: "sample-2",
    claim_text:
      "Lightweight bucket seats on the Touring trim (not standard from factory) have added a 3.4% average premium at auction across comparable-mileage examples in the last 18 months.",
    source_type: "kb_entry",
    source_ref: "monza_kb.992_gt3_touring.lwb_premium.v1",
    source_url: "https://www.pca.org/panorama",
    capture_date: "2026-02-18",
    confidence: "medium",
    tier_required: "tier_2",
  },
  {
    id: "sample-3",
    claim_text:
      "992 GT3 Tourings with factory rear-spoiler-delete have traded within 2% of wing-equipped peers in 2025 — confirming this is aesthetic preference, not a valuation signal.",
    source_type: "kb_entry",
    source_ref: "monza_kb.992_gt3_touring.spoiler_delete.v1",
    source_url: "https://bringatrailer.com/porsche/992-gt3/",
    capture_date: "2026-04-01",
    confidence: "high",
    tier_required: "tier_2",
  },
]

export function SeeSampleModal({ open, onClose, onUpgradeClick }: SeeSampleModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sample-modal-heading"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-6 shadow-2xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Tier 2 sample · different listing
            </p>
            <h3
              id="sample-modal-heading"
              className="mt-1 font-serif text-[22px] font-semibold leading-tight md:text-[26px]"
            >
              What&apos;s Remarkable
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">{SAMPLE_CAR_TITLE}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sample"
            className="shrink-0 rounded-full p-1 transition-colors hover:bg-foreground/10"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {SAMPLE_CLAIMS.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}
        </div>

        <p className="mt-5 text-[11px] italic leading-relaxed text-muted-foreground">
          This sample is from a different listing to illustrate Tier 2 depth without revealing the
          full analysis of the car you&apos;re currently viewing.
        </p>

        {onUpgradeClick && (
          <button
            type="button"
            onClick={onUpgradeClick}
            className="mt-4 block w-full rounded-xl bg-primary px-4 py-3 text-center text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Unlock this depth for every report
          </button>
        )}
      </div>
    </div>
  )
}
