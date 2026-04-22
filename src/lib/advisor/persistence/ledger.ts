import { createAdminClient } from "@/lib/supabase/server"

/**
 * Advisor Piston ledger — thin wrapper around credit_transactions + debit_user_credits RPC.
 *
 * Design notes:
 * - We never insert directly into credit_transactions for advisor debits; the RPC enforces
 *   the balance check atomically and writes the ledger row.
 * - `supabaseUserId` is the `auth.users.id` UUID. The RPC resolves it to `user_credits.id`.
 * - `anonymousSessionId` users have no balance; the RPC writes an audit row with new_balance=0.
 */

export type AdvisorDebitType =
  | "ADVISOR_INSTANT"
  | "ADVISOR_MARKETPLACE"
  | "ADVISOR_DEEP_RESEARCH"
  | "REPORT_USED"
  | "ADVISOR_REFUND"

export interface DebitInput {
  supabaseUserId?: string | null
  anonymousSessionId?: string | null
  amount: number // positive; stored as negative in credit_transactions
  type: AdvisorDebitType
  conversationId?: string | null
  messageId?: string | null
  description?: string | null
}

export interface DebitResult { newBalance: number }

export async function debitCredits(input: DebitInput): Promise<DebitResult> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("debit_user_credits", {
    p_supabase_user_id: input.supabaseUserId ?? null,
    p_anon: input.anonymousSessionId ?? null,
    p_amount: input.amount,
    p_type: input.type,
    p_conversation_id: input.conversationId ?? null,
    p_message_id: input.messageId ?? null,
    p_description: input.description ?? null,
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return { newBalance: (row as { new_balance: number }).new_balance }
}

export interface RecentDebit {
  amount: number                // negative
  type: AdvisorDebitType | string
  conversationId: string | null
  messageId: string | null
  createdAt: string
}

/**
 * Recent debit rows for a given `user_credits.id`. Caller must have resolved the id
 * via supabase_user_id before calling.
 */
export async function getRecentDebits(userCreditsId: string, limit = 10): Promise<RecentDebit[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("credit_transactions")
    .select("amount, type, conversation_id, message_id, created_at")
    .eq("user_id", userCreditsId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []).map(r => ({
    amount: r.amount,
    type: r.type,
    conversationId: r.conversation_id,
    messageId: r.message_id,
    createdAt: r.created_at,
  }))
}

/**
 * Today's absolute usage per debit type for a given `user_credits.id`.
 * Used to populate the Pistons Wallet modal's "Today's usage" section.
 */
export async function getTodayUsageByType(userCreditsId: string): Promise<Record<string, number>> {
  const supabase = createAdminClient()
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const { data } = await supabase
    .from("credit_transactions")
    .select("amount, type")
    .eq("user_id", userCreditsId)
    .gte("created_at", startOfDay.toISOString())
  const out: Record<string, number> = {}
  for (const row of (data ?? []) as Array<{ amount: number; type: string }>) {
    if (row.amount >= 0) continue // grants/refunds aren't "usage"
    out[row.type] = (out[row.type] ?? 0) + Math.abs(row.amount)
  }
  return out
}

/**
 * Resolve a Supabase auth user id to the matching `user_credits.id`.
 * Helper used by UI surfaces that need to call `getRecentDebits` / `getTodayUsageByType`.
 */
export async function resolveUserCreditsId(supabaseUserId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("user_credits")
    .select("id")
    .eq("supabase_user_id", supabaseUserId)
    .single()
  return data?.id ?? null
}
