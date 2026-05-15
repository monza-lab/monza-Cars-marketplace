"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Share2, Archive, Menu, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { AdvisorConversation } from "./AdvisorConversation"
import { AdvisorSidebar } from "./AdvisorSidebar"
import { useChatContext } from "@/lib/advisor/ChatContextProvider"
import { buildSuggestions as buildContextualSuggestions } from "@/lib/advisor/buildSuggestions"
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
  /** When provided, the conversation auto-sends this prompt on mount.
   *  Used by the AdvisorBand contextual deep-links (?prompt=…). */
  autoSendOnMount?: string
}

export function AdvisorPageShell(props: AdvisorPageShellProps) {
  const t = useTranslations()
  const router = useRouter()
  const [conversationId, setConversationId] = useState<string | null>(props.conversationId)
  const { context } = useChatContext()
  const suggestionChips = buildContextualSuggestions(context)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  const conversationCount = props.conversations.length

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
    if (!props.conversationId && typeof window !== "undefined") {
      window.history.replaceState({}, "", `/${props.locale}/advisor/c/${id}`)
    }
  }

  return (
    <div className="flex flex-col md:grid md:grid-cols-[260px_1fr] min-h-[calc(100vh-64px)]">
      {/* Desktop sidebar */}
      {!props.readOnly && (
        <div className="hidden md:flex md:flex-col">
          <AdvisorSidebar
            activeId={conversationId ?? undefined}
            conversations={props.conversations}
          />
        </div>
      )}

      {/* Mobile sidebar drawer */}
      {!props.readOnly && (
        <AnimatePresence>
          {showMobileSidebar && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMobileSidebar(false)}
                className="md:hidden fixed inset-0 z-[59] bg-black/60 backdrop-blur-sm"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="md:hidden fixed inset-y-0 left-0 z-[60] w-[82%] max-w-[320px] bg-background border-r border-border flex flex-col"
              >
                <div className="px-4 py-4 border-b border-border flex items-center justify-between shrink-0">
                  <span className="text-[14px] font-semibold text-foreground">
                    {t("advisor.conversations")}
                  </span>
                  <button
                    onClick={() => setShowMobileSidebar(false)}
                    aria-label="Close conversations"
                    className="size-9 flex items-center justify-center rounded-full bg-foreground/5 text-muted-foreground active:bg-foreground/10"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div
                  onClick={() => setShowMobileSidebar(false)}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <AdvisorSidebar
                    activeId={conversationId ?? undefined}
                    conversations={props.conversations}
                  />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      )}

      {/* Main column: chat */}
      <div className={`flex flex-col min-h-0 ${props.readOnly ? "md:col-span-2" : ""}`}>
        {/* Mobile chat header (sidebar trigger + actions) */}
        {!props.readOnly && (
          <div className="md:hidden flex items-center justify-between gap-2 px-4 py-3 border-b border-border shrink-0">
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="flex items-center gap-2 rounded-full bg-foreground/5 border border-border px-3 py-2 text-[12px] text-foreground/80 active:bg-foreground/10"
              aria-label="Open conversations"
            >
              <Menu className="size-4" />
              <span>
                {conversationCount > 0
                  ? `${t("advisor.conversations")} · ${conversationCount}`
                  : t("advisor.newChat")}
              </span>
            </button>
            {conversationId && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  disabled={isBusy}
                  className="size-9 flex items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary active:bg-primary/20 disabled:opacity-40"
                  aria-label={t("advisor.share")}
                >
                  <Share2 className="size-3.5" />
                </button>
                <button
                  onClick={handleArchive}
                  disabled={isBusy}
                  className="size-9 flex items-center justify-center rounded-full bg-foreground/5 border border-border text-foreground/80 active:bg-foreground/10 disabled:opacity-40"
                  aria-label={t("advisor.archive")}
                >
                  <Archive className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {props.sharedWatermark && (
          <div className="px-4 py-2 bg-foreground/4 border-b border-border text-[11px] text-muted-foreground">
            {props.sharedWatermark}
          </div>
        )}

        {/* Desktop chat header (share/archive only) */}
        {!props.readOnly && conversationId && (
          <div className="hidden md:flex px-4 py-2 border-b border-border items-center justify-end gap-2 shrink-0">
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
            suggestionChips={conversationId ? undefined : suggestionChips}
            autoSendOnMount={props.autoSendOnMount}
          />
        </div>
      </div>
    </div>
  )
}

