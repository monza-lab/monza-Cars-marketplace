import { setRequestLocale } from "next-intl/server"
import { AdvisorPageShell } from "@/components/advisor/AdvisorPageShell"
import { createClient } from "@/lib/supabase/server"
import { listConversationsForUser } from "@/lib/advisor/persistence/conversations"

export const dynamic = "force-dynamic"

type Locale = "en" | "de" | "es" | "ja"

export default async function AdvisorPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

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
      />
    </div>
  )
}
