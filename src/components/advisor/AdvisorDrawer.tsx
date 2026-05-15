"use client"

import { useState } from "react"
import { useLocale } from "next-intl"
import { ExternalLink } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth/AuthProvider"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useChatContext } from "@/lib/advisor/ChatContextProvider"
import { AdvisorConversation } from "./AdvisorConversation"

/**
 * Right-side drawer that surfaces the Advisor chat without leaving the current page.
 *
 * Mounted once in the root layout. Opens/closes via ChatContextProvider.isOpen.
 * Uses AdvisorConversation directly (same approach as AdvisorChat.tsx) since
 * AdvisorPageShell requires server-fetched conversations + tier data that are
 * not available in a client-side layout mount.
 *
 * The /advisor route remains alive as a deep link accessible from the drawer header.
 */
export function AdvisorDrawer() {
  const { isOpen, close, context } = useChatContext()
  const { profile } = useAuth()
  const locale = useLocale()

  const [conversationId, setConversationId] = useState<string | null>(null)

  const userTier: "FREE" | "PRO" = profile?.tier === "PRO" ? "PRO" : "FREE"

  function handleOpenChange(open: boolean) {
    if (!open) close()
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[420px] p-0 flex flex-col gap-0"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-border px-4 py-3 flex-row items-center justify-between gap-2 space-y-0">
          <SheetTitle className="font-serif text-[18px] tracking-tight">Advisor</SheetTitle>
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/advisor`}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              onClick={close}
            >
              <ExternalLink className="size-3" />
              <span className="hidden sm:inline">Open fullscreen</span>
            </Link>
            <button
              onClick={close}
              aria-label="Close advisor"
              className="size-8 rounded-lg flex items-center justify-center hover:bg-foreground/5 transition-colors text-muted-foreground hover:text-foreground"
            >
              <span className="sr-only">Close</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          <AdvisorConversation
            conversationId={conversationId}
            onConversationIdChanged={setConversationId}
            surface="chat"
            locale={context.locale as "en" | "de" | "es" | "ja"}
            userTier={userTier}
            initialContext={
              context.car ? { listingId: context.car.id } : context.seriesId ? { seriesId: context.seriesId } : undefined
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
