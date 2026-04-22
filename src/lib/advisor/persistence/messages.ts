import { createClient, createAdminClient } from "@/lib/supabase/server"

export type MessageRole = "user" | "assistant" | "tool"
export type TierClassification = "instant" | "marketplace" | "deep_research"

export interface AdvisorMessageRow {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  tool_calls: ToolCallSummary[] | null
  tier_classification: TierClassification | null
  credits_used: number
  latency_ms: number | null
  model: string | null
  is_superseded: boolean
  created_at: string
}

export interface ToolCallSummary {
  name: string
  args: Record<string, unknown>
  result_summary: string // ≤500 chars
}

export interface AppendMessageInput {
  conversationId: string
  role: MessageRole
  content: string
  toolCalls?: ToolCallSummary[]
  tierClassification?: TierClassification
  creditsUsed?: number
  latencyMs?: number
  model?: string
}

export async function appendMessage(input: AppendMessageInput): Promise<AdvisorMessageRow> {
  const supabase = createAdminClient()
  const row = {
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    tool_calls: input.toolCalls ?? null,
    tier_classification: input.tierClassification ?? null,
    credits_used: input.creditsUsed ?? 0,
    latency_ms: input.latencyMs ?? null,
    model: input.model ?? null,
  }
  const { data, error } = await supabase
    .from("advisor_messages")
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data as AdvisorMessageRow
}

export async function listMessages(conversationId: string): Promise<AdvisorMessageRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("advisor_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
  if (error) return []
  return (data ?? []) as AdvisorMessageRow[]
}

export async function supersedeLastAssistant(conversationId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from("advisor_messages")
    .update({ is_superseded: true })
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
}
