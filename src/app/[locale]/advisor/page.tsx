import { setRequestLocale } from "next-intl/server"
import { AdvisorPageShell } from "@/components/advisor/AdvisorPageShell"
import { createClient } from "@/lib/supabase/server"
import { listConversationsForUser } from "@/lib/advisor/persistence/conversations"

export const dynamic = "force-dynamic"

type Locale = "en" | "de" | "es" | "ja"

export default async function AdvisorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{ prompt?: string | string[] }>
}) {
  const { locale } = await params
  const { prompt: promptParam } = await searchParams
  setRequestLocale(locale)

  // Allow contextual deep-links from AdvisorBand: /advisor?prompt=…
  // Auto-sends on mount so the user lands directly in a conversation.
  const promptValue = Array.isArray(promptParam) ? promptParam[0] : promptParam
  const autoSendPrompt = typeof promptValue === "string" && promptValue.trim()
    ? promptValue.trim().slice(0, 300)
    : undefined

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let tier: "FREE" | "PRO" = "FREE"
  let conversations: Awaited<ReturnType<typeof listConversationsForUser>> = []

  if (user) {
    const { data: creditsRow } = await supabase
      .from("user_credits")
      .select("tier")
      .eq("supabase_user_id", user.id)
      .single()
    tier = creditsRow?.tier === "PRO" ? "PRO" : "FREE"
    conversations = await listConversationsForUser(user.id)
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <AdvisorPageShell
        conversationId={null}
        locale={locale}
        userTier={tier}
        conversations={conversations}
        autoSendOnMount={autoSendPrompt}
      />
    </div>
  )
}
