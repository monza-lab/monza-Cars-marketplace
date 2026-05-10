"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Send, Sparkles } from "lucide-react"
import { Piston } from "@/components/icons/Piston"
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

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
        {stream.messages.length === 0 && props.suggestionChips && (
          <div className="flex flex-wrap gap-2">
            {props.suggestionChips.map((c, i) => (
              <button
                key={i}
                onClick={() => handleSend(c.prompt)}
                className="rounded-full bg-primary/8 border border-primary/15 px-3 py-1.5 text-[11px] text-primary hover:bg-primary/15"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {stream.messages.map(m => (
          <MessageBubble key={m.id} m={m} />
        ))}
        <div ref={endRef} />
      </div>

      {!props.readOnly && (
        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex items-center gap-2 mb-2 text-[11px]">
            <label className={`flex items-center gap-1.5 cursor-pointer ${!canDeepResearch ? "opacity-60" : ""}`}>
              <input
                type="checkbox"
                checked={deepResearch}
                disabled={!canDeepResearch}
                onChange={e => setDeepResearch(e.target.checked)}
                className="accent-primary"
              />
              <Sparkles className="size-3 text-primary" />
              <span className="text-foreground/80">
                {canDeepResearch
                  ? `${t("auth.pistons.tierPillDeepResearch")} · 500 Pistons`
                  : t("auth.pistons.tierPillDeepResearch")}
              </span>
            </label>
            {!canDeepResearch && <span className="text-[10px] text-muted-foreground">PRO only</span>}
          </div>
          <div className="flex items-center gap-2">
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
              className="flex-1 bg-foreground/4 border border-border rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:border-primary/30"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || stream.isStreaming}
              className="size-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center disabled:opacity-30 hover:bg-primary/25"
              aria-label={deepResearch ? `Send · ${deepResearchCost} Pistons` : "Send"}
            >
              {deepResearch ? <span className="text-[10px] font-semibold text-primary">500</span> : <Send className="size-4 text-primary" />}
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
