"use client"

import type { InvestmentNarrative } from "@/lib/fairValue/types"

interface InvestmentStoryBlockProps {
  narrative: InvestmentNarrative | null | undefined
}

/**
 * Fixed date format: the reader gets the day the analysis was prepared, not the
 * name of the engine that wrote it. `generatedBy` stays in the payload for
 * internal traceability and never reaches the page.
 */
function preparedOn(generatedAt: string | null | undefined): string | null {
  if (!generatedAt) return null
  const date = new Date(generatedAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

export function InvestmentStoryBlock({ narrative }: InvestmentStoryBlockProps) {
  if (!narrative?.story) return null
  const prepared = preparedOn(narrative.generatedAt)

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-serif text-[15px] font-semibold">{/* [HARDCODED] */}Market Story</h3>

      <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed">
        {narrative.story.split("\n\n").map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      {prepared && (
        <p className="text-[11px] text-muted-foreground">
          {/* [HARDCODED] */}Prepared {prepared}
        </p>
      )}
    </section>
  )
}
