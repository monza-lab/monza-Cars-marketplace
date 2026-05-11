"use client"

import { Link } from "@/i18n/navigation"
import { ChevronRight } from "lucide-react"

/**
 * Advisor CTA band — editorial, cross-breakpoint, optionally contextual.
 *
 * Used in three places today:
 *   - Home feed (every 6 cards) → no prompt, generic "Need an opinion?"
 *   - Car detail page          → prompt = "Tell me about this {year} {model}"
 *   - Report page              → prompt = "Walk me through this report"
 *
 * When `prompt` is provided it gets URL-encoded into `/advisor?prompt=…` so
 * the AdvisorConversation auto-sends it on mount (uses the existing
 * `autoSendOnMount` prop). The user lands directly in a conversation about
 * the thing they were looking at — zero typing.
 *
 * Style is typography-led (eyebrow + Cormorant + subtle subhead). No
 * Sparkles or AI iconography (memoria `feedback-no-ai-iconography`).
 */
export function AdvisorBand({
  eyebrow = "Advisor",
  title = "Need an opinion?",
  subtitle = "Ask anything — from inspection to fair value",
  prompt,
  className = "",
}: {
  eyebrow?: string
  title?: string
  subtitle?: string
  prompt?: string
  className?: string
}) {
  const href = prompt
    ? `/advisor?prompt=${encodeURIComponent(prompt)}`
    : "/advisor"

  return (
    <Link
      href={href}
      className={`group block rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] via-primary/[0.04] to-transparent px-5 py-4 hover:from-primary/[0.12] active:from-primary/[0.14] transition-colors ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold tracking-[0.22em] uppercase text-primary/80">
            {eyebrow}
          </p>
          <p className="font-display text-[18px] leading-tight text-foreground mt-1">
            {title}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {subtitle}
          </p>
        </div>
        <ChevronRight className="size-4 text-primary group-hover:translate-x-0.5 group-active:translate-x-0.5 transition-transform shrink-0" />
      </div>
    </Link>
  )
}
