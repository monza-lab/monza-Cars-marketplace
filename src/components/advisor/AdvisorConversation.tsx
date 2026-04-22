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
              <span className="text-foreground/80">{t("auth.pistons.tierPillDeepResearch")}</span>
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
            >
              <Send className="size-4 text-primary" />
            </button>
          </div>
        </div>
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
          <div key={i} className="text-[10px] text-muted-foreground px-2">
            {tc.summary ? `✓ ${tc.name}: ${tc.summary.slice(0, 80)}` : `◌ ${tc.name}…`}
          </div>
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
