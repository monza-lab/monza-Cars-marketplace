import { createClient } from "@/lib/supabase/server"
import {
  getUserCredits,
  hasAlreadyGenerated,
  hasUnlimitedReportAccess,
} from "@/lib/reports/queries"

export type ReportAccessResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" }

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
