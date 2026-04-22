"use client"

import { useCallback, useRef, useState } from "react"
import type { AdvisorSseEvent } from "@/lib/advisor/runtime/streaming"
import { parseSseLine } from "@/lib/advisor/runtime/streaming"

export interface StreamedMessage {
  id: string
  role: "user" | "assistant"
  content: string
  tier?: "instant" | "marketplace" | "deep_research"
  pistonsDebited?: number
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; summary?: string; ok?: boolean }>
  isStreaming?: boolean
}

export interface UseAdvisorStreamOptions {
  conversationId: string | null
  onConversationIdChanged?: (id: string) => void
}

export function useAdvisorStream(opts: UseAdvisorStreamOptions) {
  const [messages, setMessages] = useState<StreamedMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(async (
    content: string,
    meta: { surface: "oracle" | "chat" | "page"; initialContext?: { listingId?: string; seriesId?: string }; locale: "en" | "de" | "es" | "ja"; deepResearch?: boolean },
  ) => {
    if (isStreaming) return
    setIsStreaming(true)

    const userMsg: StreamedMessage = { id: `tmp-u-${Date.now()}`, role: "user", content }
    const asstMsg: StreamedMessage = { id: `tmp-a-${Date.now()}`, role: "assistant", content: "", toolCalls: [], isStreaming: true }
    setMessages(prev => [...prev, userMsg, asstMsg])

    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch("/api/advisor/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: opts.conversationId,
          content,
          surface: meta.surface,
          initialContext: meta.initialContext,
          locale: meta.locale,
          deepResearch: meta.deepResearch ?? false,
        }),
        signal: controller.signal,
      })
      const newConvId = res.headers.get("X-Conversation-Id")
      if (newConvId && newConvId !== opts.conversationId) opts.onConversationIdChanged?.(newConvId)
      if (!res.body) throw new Error("no_body")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const frames = buf.split("\n\n")
        buf = frames.pop() ?? ""
        for (const frame of frames) {
          for (const line of frame.split("\n")) {
            const ev = parseSseLine(line)
            if (!ev) continue
            applyEvent(ev)
          }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === asstMsg.id ? { ...m, content: `[error] ${err instanceof Error ? err.message : String(err)}`, isStreaming: false } : m))
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }

    function applyEvent(ev: AdvisorSseEvent) {
      setMessages(prev => prev.map(m => {
        if (m.id !== asstMsg.id) return m
        switch (ev.type) {
          case "classified":      return { ...m, tier: ev.tier }
          case "content_delta":   return { ...m, content: m.content + ev.delta }
          case "tool_call_start": return { ...m, toolCalls: [...(m.toolCalls ?? []), { name: ev.name, args: ev.args }] }
          case "tool_call_end":   return { ...m, toolCalls: (m.toolCalls ?? []).map(tc => tc.name === ev.name && !tc.summary ? { ...tc, summary: ev.summary, ok: ev.ok } : tc) }
          case "done":            return { ...m, pistonsDebited: ev.pistonsDebited, id: ev.messageId, isStreaming: false }
          default:                return m
        }
      }))
    }
  }, [isStreaming, opts])

  const cancel = useCallback(() => abortRef.current?.abort(), [])
  const reset = useCallback(() => setMessages([]), [])
  const seed = useCallback((initial: StreamedMessage[]) => setMessages(initial), [])

  return { messages, isStreaming, send, cancel, reset, seed }
}
