"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Share2, Archive } from "lucide-react"
import { AdvisorConversation } from "./AdvisorConversation"
import { AdvisorSidebar } from "./AdvisorSidebar"
import type { StreamedMessage } from "./useAdvisorStream"
import type { AdvisorConversation as ConversationRow } from "@/lib/advisor/persistence/conversations"

export interface AdvisorPageShellProps {
  conversationId: string | null
  initialMessages?: StreamedMessage[]
  readOnly?: boolean
  locale: "en" | "de" | "es" | "ja"
  userTier: "FREE" | "PRO"
  sharedWatermark?: string
  conversations: ConversationRow[]
}

export function AdvisorPageShell(props: AdvisorPageShellProps) {
  const t = useTranslations()
  const router = useRouter()
  const [conversationId, setConversationId] = useState<string | null>(props.conversationId)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  async function handleShare() {
    if (!conversationId) return
    setIsBusy(true)
    setShareError(null)
    try {
      const res = await fetch(`/api/advisor/conversations/${conversationId}/share`, { method: "POST" })
      if (!res.ok) throw new Error(`http_${res.status}`)
      const json = (await res.json()) as { url?: string; token?: string }
      const origin = typeof window !== "undefined" ? window.location.origin : ""
      const pathUrl = json.url ?? (json.token ? `/advisor/s/${json.token}` : null)
      if (!pathUrl) throw new Error("no_url")
      const absUrl = `${origin}/${props.locale}${pathUrl}`
      setShareUrl(absUrl)
      if (navigator?.clipboard) {
        void navigator.clipboard.writeText(absUrl).catch(() => {})
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleArchive() {
    if (!conversationId) return
    if (typeof window !== "undefined" && !window.confirm("Archive this conversation?")) return
    setIsBusy(true)
    try {
      await fetch(`/api/advisor/conversations/${conversationId}/archive`, { method: "POST" })
      router.push("/advisor")
      router.refresh()
    } finally {
      setIsBusy(false)
    }
  }

  function handleConversationIdChanged(id: string) {
    setConversationId(id)
    // When a brand-new conversation is created from the empty state, deep-link to it.
    if (!props.conversationId && typeof window !== "undefined") {
      window.history.replaceState({}, "", `/${props.locale}/advisor/c/${id}`)
    }
  }

  return (
    <div className="grid grid-cols-[260px_1fr] min-h-[calc(100vh-64px)]">
      {!props.readOnly && (
        <AdvisorSidebar
          activeId={conversationId ?? undefined}
          conversations={props.conversations}
        />
      )}
      <div className={`flex flex-col min-h-0 ${props.readOnly ? "col-span-2" : ""}`}>
        {props.sharedWatermark && (
          <div className="px-4 py-2 bg-foreground/4 border-b border-border text-[11px] text-muted-foreground">
            {props.sharedWatermark}
          </div>
        )}

        {!props.readOnly && conversationId && (
          <div className="px-4 py-2 border-b border-border flex items-center justify-end gap-2 shrink-0">
            <button
              onClick={handleShare}
              disabled={isBusy}
              className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-[11px] text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors"
            >
              <Share2 className="size-3" />
              {t("advisor.share")}
            </button>
            <button
              onClick={handleArchive}
              disabled={isBusy}
              className="flex items-center gap-1.5 rounded-lg bg-foreground/5 border border-border px-3 py-1.5 text-[11px] text-foreground/80 hover:bg-foreground/10 disabled:opacity-40 transition-colors"
            >
              <Archive className="size-3" />
              {t("advisor.archive")}
            </button>
          </div>
        )}

        {shareUrl && (
          <div className="mx-4 my-2 rounded-lg bg-primary/8 border border-primary/15 px-3 py-2 text-[11px] text-primary shrink-0">
            <div className="font-medium mb-1">Share URL copied:</div>
            <div className="font-mono truncate">{shareUrl}</div>
          </div>
        )}
        {shareError && (
          <div className="mx-4 my-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-[11px] text-destructive shrink-0">
            Share failed: {shareError}
          </div>
        )}

        <div className="flex-1 min-h-0">
          <AdvisorConversation
            conversationId={conversationId}
            onConversationIdChanged={handleConversationIdChanged}
            surface="page"
            locale={props.locale}
            userTier={props.userTier}
            initialMessages={props.initialMessages}
            readOnly={props.readOnly}
            suggestionChips={conversationId ? undefined : buildSuggestions(t)}
          />
        </div>
      </div>
    </div>
  )
}

function buildSuggestions(t: ReturnType<typeof useTranslations>) {
  return [
    { label: t("advisor.suggestions.compareGt3s"), prompt: "Compare the top 3 997.2 GT3s on sale today." },
    { label: t("advisor.suggestions.inspection993"), prompt: "What's the inspection checklist for a 993 Carrera?" },
    { label: t("advisor.suggestions.best992"), prompt: "What are the biggest 992 price movers this quarter?" },
    { label: t("advisor.suggestions.imsRisk"), prompt: "Explain IMS bearing risk across 996/997 generations." },
  ]
}
