import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { AdvisorPageShell } from "@/components/advisor/AdvisorPageShell"
import { createAdminClient } from "@/lib/supabase/server"
import type { StreamedMessage } from "@/components/advisor/useAdvisorStream"

export const dynamic = "force-dynamic"

type Locale = "en" | "de" | "es" | "ja"

interface SharedMessageRow {
  id: string
  role: string
  content: string
  tier_classification?: string | null
  credits_used?: number | null
  tool_calls?: Array<{ name: string; args: Record<string, unknown>; result_summary?: string }> | null
}

export default async function SharedConversationPage({
  params,
}: {
  params: Promise<{ locale: Locale; token: string }>
}) {
  const { locale, token } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc("get_shared_conversation", { p_token: token })
  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    notFound()
  }

  const row = Array.isArray(data) ? data[0] : data
  const conv = row.conversation ?? row
  const messages: SharedMessageRow[] = Array.isArray(row.messages)
    ? row.messages
    : Array.isArray(row)
      ? row
      : []

  if (!conv || conv.is_archived) notFound()

  const initialMessages: StreamedMessage[] = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      tier: (m.tier_classification ?? undefined) as StreamedMessage["tier"],
      pistonsDebited: m.credits_used || undefined,
      toolCalls: (m.tool_calls ?? []).map(tc => ({
        name: tc.name,
        args: tc.args,
        summary: tc.result_summary,
        ok: true,
      })),
    }))

  return (
    <div className="min-h-screen bg-background pt-16">
      <AdvisorPageShell
        conversationId={conv.id}
        initialMessages={initialMessages}
        locale={locale}
        userTier="FREE"
        readOnly
        sharedWatermark={t("advisor.sharedWatermark")}
        conversations={[]}
      />
    </div>
  )
}
