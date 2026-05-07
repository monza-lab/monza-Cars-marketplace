"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import type { MissingSignal } from "@/lib/fairValue/types"

interface QuestionsToAskBlockProps {
  missingSignals: MissingSignal[]
}

// Default fallback questions per signal key (used when translation is missing).
// Kept short + imperative; match i18n keys `report.questions.{key}_question` shape.
// [HARDCODED] all fallback questions below
const FALLBACK_QUESTION: Record<string, string> = {
  service_records: "Ask the seller for documented service history",
  paint_to_sample: "Confirm whether this car has a Paint-to-Sample color",
  accident_history: "Ask seller to confirm no accident history in writing",
  original_paint: "Ask whether the paint is original and request paint meter readings",
  previous_owners: "Confirm the number of previous owners",
  documentation: "Request original documentation (build sheet, window sticker, service book)",
  warranty: "Check what factory or CPO warranty remains",
  mileage: "Verify mileage against service records or MOT history",
  transmission: "Confirm the transmission type (manual vs PDK)",
  seller_tier: "Ask where the seller sourced this car and any specialist history",
  modifications: "Request a list of all modifications performed on the car",
}

// [HARDCODED] all impact copy below
const IMPACT_COPY: Record<string, string> = {
  service_records: "Documented service history typically adds 4–6% to specific-car value",
  paint_to_sample: "PTS adds 8–12% depending on color rarity",
  accident_history: "Undisclosed accident history can reduce value by 10–15%",
  original_paint: "Original paint adds 3–5% vs respray",
  previous_owners: "Single-owner cars trade at 2–4% premium",
  documentation: "Complete documentation adds 1–3%",
  warranty: "Remaining factory warranty adds 2–4%",
  mileage: "Low mileage vs comparables adjusts value via modifier",
  transmission: "Manual vs PDK premium varies by variant",
  seller_tier: "Specialist seller typically commands 2–4% premium",
}

function questionFor(key: string): string {
  return FALLBACK_QUESTION[key] ?? `Ask the seller about ${key.replace(/_/g, " ")}` // [HARDCODED]
}

export function QuestionsToAskBlock({ missingSignals }: QuestionsToAskBlockProps) {
  const [copied, setCopied] = useState(false)

  if (missingSignals.length === 0) {
    return null
  }

  function handleCopy() {
    const text = missingSignals
      .map((s, i) => `${i + 1}. ${questionFor(s.key)}`)
      .join("\n")
    if (typeof navigator === "undefined" || !navigator.clipboard) return
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <section className="px-4 py-6" aria-labelledby="questions-heading">
      <h2
        id="questions-heading"
        className="font-serif text-[20px] font-semibold md:text-[24px]"
      >
        {/* [HARDCODED] */}Questions Before You Commit
      </h2>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {/* [HARDCODED] */}Based on what&apos;s missing from the listing — converted to actionable asks
      </p>

      <div className="mt-4 space-y-3">
        {missingSignals.map((s) => (
          <div key={s.key} className="rounded-xl border border-border bg-card/30 p-4">
            <p className="text-[14px] font-medium">{questionFor(s.key)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{/* [HARDCODED] */}Not mentioned in listing</p>
            {IMPACT_COPY[s.key] && (
              <p className="mt-2 inline-flex items-center rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                {IMPACT_COPY[s.key]}
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-[12px] font-semibold hover:bg-accent"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {/* [HARDCODED] */}{copied ? "Copied" : "Copy all questions"}
      </button>
    </section>
  )
}
