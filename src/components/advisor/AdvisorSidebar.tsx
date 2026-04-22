"use client"

import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Plus, MessageSquare } from "lucide-react"
import type { AdvisorConversation } from "@/lib/advisor/persistence/conversations"

export interface AdvisorSidebarProps {
  activeId?: string
  conversations: AdvisorConversation[]
}

export function AdvisorSidebar({ activeId, conversations }: AdvisorSidebarProps) {
  const t = useTranslations()

  return (
    <aside className="border-r border-border bg-foreground/2 flex flex-col min-h-0">
      <div className="px-4 py-3 shrink-0 border-b border-border">
        <Link
          href="/advisor"
          className="flex items-center gap-2 w-full rounded-lg bg-primary/15 border border-primary/25 px-3 py-2 text-[12px] font-medium text-primary hover:bg-primary/25 transition-colors"
        >
          <Plus className="size-3.5" />
          {t("advisor.newChat")}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-2 py-2 space-y-1">
        {conversations.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-6 px-2">
            No conversations yet.
          </p>
        )}
        {conversations.map(conv => {
          const isActive = conv.id === activeId
          return (
            <Link
              key={conv.id}
              href={`/advisor/c/${conv.id}`}
              className={[
                "block rounded-lg px-3 py-2 text-[12px] transition-colors",
                isActive
                  ? "bg-primary/10 border border-primary/20 text-foreground"
                  : "hover:bg-foreground/5 text-foreground/80",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{conv.title || "Untitled"}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground pl-5">
                {new Date(conv.last_message_at).toLocaleDateString()}
              </div>
            </Link>
          )
        })}
      </div>
    </aside>
  )
}
