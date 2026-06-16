import { createClient } from "@/lib/supabase/server"
import {
  getUserCredits,
  hasAlreadyGenerated,
  hasUnlimitedReportAccess,
} from "@/lib/reports/queries"

export type ReportAccessResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" }

/**
 * Authorization gate for paid Haus Report content (PDF/Excel exports).
 *
 * Mirrors the entitlement check enforced by the HTML report page
 * (`src/app/[locale]/cars/[make]/[id]/report/page.tsx`): a user may access a
 * report only if they are authenticated AND either (a) already generated/paid
 * for this listing's report, or (b) hold explicit unlimited report access.
 *
 * The export routes load reports through the service-role client (which
 * bypasses RLS), so this check is the sole access boundary — without it any
 * unauthenticated visitor could download paid reports by guessing public
 * listing ids.
 */
export async function checkReportAccess(
  listingId: string,
): Promise<ReportAccessResult> {
  let authUserId: string | null = null
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    authUserId = user?.id ?? null
  } catch {
    authUserId = null
  }

  if (!authUserId) return { ok: false, reason: "unauthenticated" }

  // getUserCredits looks up by supabase_user_id (Auth UUID). hasAlreadyGenerated
  // must use the internal DB user id (user_credits.id), because deductCredit
  // writes user_reports.user_id with the internal id — not the Auth UUID.
  const credits = await getUserCredits(authUserId)
  const internalUserId = credits?.id
  const alreadyPaid = internalUserId
    ? await hasAlreadyGenerated(internalUserId, listingId)
    : false

  if (alreadyPaid || hasUnlimitedReportAccess(credits)) {
    return { ok: true, userId: authUserId }
  }

  return { ok: false, reason: "forbidden" }
}
