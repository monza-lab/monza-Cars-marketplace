"use client"

import { useState, useSyncExternalStore } from "react"
import { useSearchParams } from "next/navigation"
import { X } from "lucide-react"

const DISMISSED_KEY = "monzahaus_campaign_context_dismissed"
const SIGNALS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"]

export function shouldShowCampaignContext(params: URLSearchParams): boolean {
  return SIGNALS.some((key) => params.has(key))
}

export function CampaignContextStrip() {
  const searchParams = useSearchParams()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const [dismissedHere, setDismissedHere] = useState(false)
  const dismissed = dismissedHere || (mounted && window.localStorage.getItem(DISMISSED_KEY) === "true")
  if (dismissed || !shouldShowCampaignContext(searchParams)) return null
  return (
    <div className="border-b border-border bg-primary/8 px-4 py-2 text-foreground">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => document.getElementById("haus-report-hero")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          className="text-left text-xs font-medium leading-5 hover:text-primary sm:text-sm"
        >
          Porsche market intelligence — your first Haus Report is free →
        </button>
        <button type="button" aria-label="Dismiss" onClick={() => { window.localStorage.setItem(DISMISSED_KEY, "true"); setDismissedHere(true) }} className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
