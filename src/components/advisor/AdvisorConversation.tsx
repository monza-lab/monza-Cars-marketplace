"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Send, ArrowRight } from "lucide-react"
import { Piston } from "@/components/icons/Piston"
import { MonzaHausHelmet } from "@/components/brand/MonzaHausHelmet"
import { useAdvisorStream, type StreamedMessage } from "./useAdvisorStream"

export interface AdvisorConversationProps {
  conversationId: string | null
  onConversationIdChanged?: (id: string) => void
  surface: "oracle" | "chat" | "page"
  initialContext?: { listingId?: string; seriesId?: string }
  locale: "en" | "de" | "es" | "ja"
  userTier: "FREE" | "PRO"
  initialMessages?: StreamedMessage[]
  suggestionChips?: Array<{ label: string; prompt: string }>
  compact?: boolean
  /** When provided, auto-sends this text on mount (useful for the Oracle overlay). */
  autoSendOnMount?: string
  /** When true, hides the input footer. Used for read-only shared conversations. */
  readOnly?: boolean
}

export function AdvisorConversation(props: AdvisorConversationProps) {
  const t = useTranslations()
  const [input, setInput] = useState("")
  const [deepResearch, setDeepResearch] = useState(false)
  const deepResearchCost = 500
  const endRef = useRef<HTMLDivElement>(null)
  const stream = useAdvisorStream({
    conversationId: props.conversationId,
    onConversationIdChanged: props.onConversationIdChanged,
  })

  useEffect(() => {
    if (props.initialMessages && props.initialMessages.length > 0) {
      stream.seed(props.initialMessages)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-send on mount once (for Oracle surface)
  const autoSentRef = useRef(false)
  useEffect(() => {
    if (autoSentRef.current) return
    const text = props.autoSendOnMount?.trim()
    if (!text) return
    autoSentRef.current = true
    void stream.send(text, {
      surface: props.surface,
      initialContext: props.initialContext,
      locale: props.locale,
      deepResearch: false,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoSendOnMount])

  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === "function") {
      endRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [stream.messages])

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || stream.isStreaming) return
    setInput("")
    await stream.send(msg, {
      surface: props.surface,
      initialContext: props.initialContext,
      locale: props.locale,
      deepResearch,
    })
  }

  const canDeepResearch = props.userTier === "PRO"

  const isEmpty = stream.messages.length === 0
  const hasSuggestions = Boolean(props.suggestionChips && props.suggestionChips.length > 0)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
        {/* Editorial empty state — replaces the bare suggestion chips. */}
        {isEmpty && hasSuggestions && (
          <div className="flex flex-col items-center text-center pt-6 pb-2">
            {/* Brand mark — quiet, not loud */}
            <div className="size-12 rounded-full border border-primary/20 bg-primary/[0.06] flex items-center justify-center mb-4">
              <MonzaHausHelmet size={24} tone="lavender-deep" />
            </div>
            <h3 className="font-display text-[22px] leading-tight text-foreground">
              {/* [HARDCODED] */}Ask the Advisor
            </h3>
            <p className="mt-1.5 max-w-xs text-[12px] text-muted-foreground leading-relaxed">
              {/* [HARDCODED] */}Real-time Porsche intelligence — inspections,
              fair value, comps, regional arbitrage.
            </p>

            {/* Eyebrow */}
            <div className="flex items-center gap-2.5 mt-7 mb-3 w-full max-w-sm">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[9px] font-semibold tracking-[0.25em] uppercase text-muted-foreground">
                {/* [HARDCODED] */}Try asking
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Suggestion list — editorial rows, not pills */}
            <div className="w-full max-w-sm space-y-1.5">
              {props.suggestionChips!.map((c, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(c.prompt)}
                  className="group flex items-center justify-between gap-3 w-full rounded-xl border border-border bg-card px-4 py-3 active:bg-foreground/[0.04] active:border-primary/25 transition-colors"
                >
                  <span className="text-[13px] text-foreground/90 text-left">{c.label}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground group-active:text-primary group-active:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>

            <p className="mt-5 text-[11px] text-muted-foreground/80">
              {/* [HARDCODED] */}Or type your own question below
            </p>
          </div>
        )}

        {stream.messages.map(m => (
          <MessageBubble key={m.id} m={m} />
        ))}
        <div ref={endRef} />
      </div>

      {!props.readOnly && (
        <div className="px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] border-t border-border shrink-0 bg-background/95 backdrop-blur-md">
          {/* Deep Research toggle — Piston (on-brand) en vez de Sparkles (AI-tool) */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <label className={`flex items-center gap-2 cursor-pointer select-none ${!canDeepResearch ? "opacity-60" : ""}`}>
              <input
                type="checkbox"
                checked={deepResearch}
                disabled={!canDeepResearch}
                onChange={e => setDeepResearch(e.target.checked)}
                className="accent-primary size-3.5"
              />
              <Piston
                className={`size-3.5 ${deepResearch ? "text-primary" : "text-muted-foreground"}`}
              />
              <span className={`text-[12px] font-medium ${deepResearch ? "text-foreground" : "text-muted-foreground"}`}>
                {t("auth.pistons.tierPillDeepResearch")}
              </span>
              {canDeepResearch && (
                <span className={`text-[10px] tabular-nums ${deepResearch ? "text-primary" : "text-muted-foreground/80"}`}>
                  · 500 {/* [HARDCODED] */}Pistons
                </span>
              )}
            </label>
            {!canDeepResearch && (
              <span className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground/80">
                {/* [HARDCODED] */}Pro only
              </span>
            )}
          </div>

          <div className="flex items-end gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleSend()
                }
              }}
              disabled={stream.isStreaming}
              placeholder={t("advisor.inputPlaceholder")}
              className="flex-1 bg-foreground/[0.04] border border-border rounded-2xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary/30 focus:bg-foreground/[0.06] transition-colors disabled:opacity-60"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || stream.isStreaming}
              className="size-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 disabled:bg-foreground/[0.08] disabled:text-muted-foreground active:bg-primary/85 transition-colors shrink-0"
              aria-label={deepResearch ? `Send · ${deepResearchCost} Pistons` : "Send"}
            >
              {deepResearch ? (
                <div className="flex items-center gap-0.5">
                  <Piston className="size-3.5" />
                  <span className="text-[10px] font-bold tabular-nums">500</span>
                </div>
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Editorial labels for advisor tool calls. Tool names like `search_listings`
// surfaced raw (with their result summaries like "Found 0 matches; top 3: none")
// looked like error logs. The advisor itself narrates the outcome in its
// natural answer — these lines only need to say *what it's doing*, not what
// it found.
const TOOL_LABELS: Record<string, { loading: string; done: string }> = {
  // Marketplace
  search_listings: { loading: "Browsing listings", done: "Browsed listings" },
  get_listing: { loading: "Pulling listing details", done: "Read listing" },
  get_comparable_sales: { loading: "Finding comparable sales", done: "Compared sales" },
  get_price_history: { loading: "Reviewing price history", done: "Reviewed history" },
  get_regional_valuation: { loading: "Comparing US/EU/UK/JP", done: "Compared regions" },
  compute_price_position: { loading: "Locating fair-value position", done: "Located in range" },
  // Knowledge
  get_series_profile: { loading: "Reading the series profile", done: "Read series" },
  list_knowledge_topics: { loading: "Looking through guides", done: "Searched guides" },
  get_knowledge_article: { loading: "Opening the guide", done: "Read guide" },
  get_variant_details: { loading: "Pulling variant details", done: "Read variant" },
  get_inspection_checklist: { loading: "Reviewing inspection checklist", done: "Read checklist" },
  // Analysis
  assess_red_flags: { loading: "Checking red flags", done: "Checked red flags" },
  compare_listings: { loading: "Comparing listings", done: "Compared listings" },
  // Premium
  web_search: { loading: "Searching the web", done: "Searched the web" },
  fetch_url: { loading: "Fetching reference", done: "Read reference" },
  // Action
  trigger_report: { loading: "Triggering full report", done: "Report triggered" },
  navigate_to: { loading: "Navigating", done: "Navigated" },
}

function formatToolCallLabel(name: string, isDone: boolean): string {
  const label = TOOL_LABELS[name]
  if (label) return isDone ? label.done : label.loading
  // Fallback for any unmapped tool: humanize the name
  // (snake_case → Sentence case) and pick tense by state.
  const humanized = name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
  return isDone ? humanized : `${humanized}…`
}

const SHOW_TOOL_DEBUG =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production"

function ToolCallRow({ name, summary, isDone }: { name: string; summary: string | null; isDone: boolean }) {
  const label = formatToolCallLabel(name, isDone)
  return (
    <div className="flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
      {isDone ? (
        <span aria-hidden className="text-muted-foreground/60">—</span>
      ) : (
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-primary animate-pulse shrink-0"
        />
      )}
      <span className={isDone ? "" : "text-foreground/70"}>
        {label}
        {!isDone && (
          <span className="inline-block w-3 text-left">
            <span className="animate-pulse">…</span>
          </span>
        )}
      </span>
      {/* Debug-only: surface the raw summary string in development so engineers
          can still verify what the tool returned. Hidden in production. */}
      {SHOW_TOOL_DEBUG && summary && (
        <span className="text-muted-foreground/50 truncate" title={summary}>
          · {summary.slice(0, 60)}
        </span>
      )}
    </div>
  )
}

function MessageBubble({ m }: { m: StreamedMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-primary/10 border border-primary/15 px-3.5 py-2 text-[13px] text-foreground">
          {m.content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        {m.tier && (
          <span className="inline-block text-[9px] tracking-widest uppercase text-muted-foreground">
            {m.tier === "instant"
              ? "Instant · 1 Piston"
              : m.tier === "marketplace"
                ? "Marketplace · ~5 Pistons"
                : "Deep Research"}
          </span>
        )}
        {(m.toolCalls ?? []).map((tc, i) => (
          <ToolCallRow
            key={i}
            name={tc.name}
            summary={tc.summary ?? null}
            isDone={Boolean(tc.summary)}
          />
        ))}
        <div className="rounded-2xl bg-foreground/4 border border-border px-3.5 py-2 text-[13px] whitespace-pre-wrap">
          {m.content || (m.isStreaming ? "…" : "")}
        </div>
        {m.pistonsDebited !== undefined && m.pistonsDebited > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-2">
            <Piston className="size-2.5" />
            <span>-{m.pistonsDebited}</span>
          </div>
        )}
      </div>
    </div>
  )
}
