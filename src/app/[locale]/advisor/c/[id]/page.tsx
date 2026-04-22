import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { AdvisorPageShell } from "@/components/advisor/AdvisorPageShell"
import { createClient } from "@/lib/supabase/server"
import {
  getConversation,
  listConversationsForUser,
} from "@/lib/advisor/persistence/conversations"
import { listMessages } from "@/lib/advisor/persistence/messages"
import type { StreamedMessage } from "@/components/advisor/useAdvisorStream"

export const dynamic = "force-dynamic"

type Locale = "en" | "de" | "es" | "ja"

export default async function OwnedConversationPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const conv = await getConversation(id)
  if (!conv || conv.is_archived) notFound()
  if (conv.user_id !== user.id) notFound()

  const { data: creditsRow } = await supabase
    .from("user_credits")
    .select("tier")
    .eq("supabase_user_id", user.id)
    .single()
  const tier: "FREE" | "PRO" = creditsRow?.tier === "PRO" ? "PRO" : "FREE"

  const messageRows = await listMessages(id)
  const initialMessages: StreamedMessage[] = messageRows
    .filter(r => r.role === "user" || r.role === "assistant")
    .map(r => ({
      id: r.id,
      role: r.role as "user" | "assistant",
      content: r.content,
      tier: r.tier_classification ?? undefined,
      pistonsDebited: r.credits_used || undefined,
      toolCalls: (r.tool_calls ?? []).map(tc => ({
        name: tc.name,
        args: tc.args,
        summary: tc.result_summary,
        ok: true,
      })),
    }))

  const conversations = await listConversationsForUser(user.id)

  return (
    <div className="min-h-screen bg-background pt-16">
      <AdvisorPageShell
        conversationId={id}
        initialMessages={initialMessages}
        locale={locale}
        userTier={tier}
        conversations={conversations}
      />
    </div>
  )
}
