import "server-only"
import { createAdminClient } from "@/lib/supabase/server"
import { buildClaimReminderEmail } from "@/lib/email/reportEmails"
import { sendTransactionalEmail } from "@/lib/email/resend"

export async function sendClaimReminders() {
  const db = createAdminClient()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: leads, error } = await db.from("report_leads")
    .select("id,email")
    .lte("first_report_at", cutoff)
    .is("claim_reminder_sent_at", null)
    .is("claimed_at", null)
    .limit(100)
  if (error) throw new Error(`Could not load claim reminders: ${error.message}`)
  let sent = 0
  let failed = 0
  for (const lead of leads ?? []) {
    try {
      const message = buildClaimReminderEmail({
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        email: lead.email,
      })
      await sendTransactionalEmail({ to: lead.email, ...message })
      await db.from("report_leads").update({ claim_reminder_sent_at: new Date().toISOString() }).eq("id", lead.id)
      sent++
    } catch (error) {
      failed++
      console.error("[report-claim-reminder] failed", lead.id, error)
    }
  }
  return { sent, failed }
}
