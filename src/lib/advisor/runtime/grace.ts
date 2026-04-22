import { createAdminClient } from "@/lib/supabase/server"

export interface GraceKey {
  supabaseUserId: string | null
  anonymousSessionId: string | null
}

export interface ConsumeGraceInput extends GraceKey {
  tier: "instant" | "marketplace"
  instantCap?: number       // default 10
  marketplaceCap?: number   // default 2
}

export async function tryConsumeGrace(input: ConsumeGraceInput): Promise<boolean> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("advisor_try_consume_grace", {
    p_supabase_user_id: input.supabaseUserId,
    p_anon: input.anonymousSessionId,
    p_tier: input.tier,
    p_instant_cap: input.instantCap ?? 10,
    p_marketplace_cap: input.marketplaceCap ?? 2,
  })
  if (error) return false
  return Boolean(data)
}

export interface GraceUsage {
  instantUsed: number
  marketplaceUsed: number
  instantTotal: number
  marketplaceTotal: number
}

export async function getGraceUsage(key: GraceKey): Promise<GraceUsage> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const filterColumn = key.supabaseUserId ? "supabase_user_id" : "anonymous_session_id"
  const filterValue = key.supabaseUserId ?? key.anonymousSessionId
  const { data } = await supabase
    .from("advisor_grace_counters")
    .select("instant_used, marketplace_used")
    .eq("day", today)
    .eq(filterColumn, filterValue as string)
    .maybeSingle()
  return {
    instantUsed: data?.instant_used ?? 0,
    marketplaceUsed: data?.marketplace_used ?? 0,
    instantTotal: 10,
    marketplaceTotal: 2,
  }
}
