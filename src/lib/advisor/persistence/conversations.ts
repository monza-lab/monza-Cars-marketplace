import { randomBytes } from "node:crypto"
import { createClient } from "@/lib/supabase/server"

export type AdvisorSurface = "oracle" | "chat" | "page"
export type AdvisorLocale = "en" | "de" | "es" | "ja"

export interface AdvisorConversation {
  id: string
  user_id: string | null
  anonymous_session_id: string | null
  title: string
  surface: AdvisorSurface
  initial_context_listing_id: string | null
  initial_context_series_id: string | null
  locale: AdvisorLocale
  share_token: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
  last_message_at: string
}

export interface CreateConversationInput {
  userId?: string | null
  anonymousSessionId?: string | null
  surface: AdvisorSurface
  locale: AdvisorLocale
  initialContextListingId?: string | null
  initialContextSeriesId?: string | null
  title?: string
}

export async function createConversation(input: CreateConversationInput): Promise<AdvisorConversation> {
  const supabase = await createClient()
  const row = {
    user_id: input.userId ?? null,
    anonymous_session_id: input.anonymousSessionId ?? null,
    surface: input.surface,
    locale: input.locale,
    initial_context_listing_id: input.initialContextListingId ?? null,
    initial_context_series_id: input.initialContextSeriesId ?? null,
    title: input.title ?? "New conversation",
  }
  const { data, error } = await supabase
    .from("advisor_conversations")
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data as AdvisorConversation
}

export async function getConversation(id: string): Promise<AdvisorConversation | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("advisor_conversations")
    .select("*")
    .eq("id", id)
    .single()
  if (error) return null
  return data as AdvisorConversation
}

export async function getConversationByShareToken(token: string): Promise<AdvisorConversation | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("advisor_conversations")
    .select("*")
    .eq("share_token", token)
    .eq("is_archived", false)
    .single()
  if (error) return null
  return data as AdvisorConversation
}

export async function listConversationsForUser(userId: string, limit = 50): Promise<AdvisorConversation[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("advisor_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []) as AdvisorConversation[]
}

export async function touchLastMessage(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from("advisor_conversations")
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
}

export async function archiveConversation(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from("advisor_conversations")
    .update({ is_archived: true })
    .eq("id", id)
}

export async function rotateShareToken(id: string): Promise<string> {
  const supabase = await createClient()
  const token = randomBytes(10).toString("base64url")
  await supabase.from("advisor_conversations").update({ share_token: token }).eq("id", id)
  return token
}

export async function revokeShareToken(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from("advisor_conversations").update({ share_token: null }).eq("id", id)
}

export async function mergeAnonymousToUser(anonymousSessionId: string, userId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from("advisor_conversations")
    .update({ user_id: userId, anonymous_session_id: null })
    .eq("anonymous_session_id", anonymousSessionId)
}
