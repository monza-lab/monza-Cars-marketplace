/**
 * Structured observability logging for the advisor runtime.
 *
 * Every event is emitted as a single-line JSON record prefixed with
 * `{"advisor":...}` so log drains (Vercel, Datadog, etc.) can filter on the
 * top-level key. Keep the shape stable — downstream dashboards and SQL views
 * index these fields by name.
 */

export interface AdvisorLogEvent {
  kind: "classify" | "tool_call" | "debit" | "response" | "error"
  conversationId: string
  userId: string | null
  anonymousSessionId: string | null
  userTier: "FREE" | "PRO"
  tier?: "instant" | "marketplace" | "deep_research"
  toolName?: string
  toolOk?: boolean
  latencyMs?: number
  model?: string
  pistons?: number
  errorCode?: string
  message?: string
  ts: string
}

export function logAdvisorEvent(ev: Omit<AdvisorLogEvent, "ts">): void {
  const record: AdvisorLogEvent = { ...ev, ts: new Date().toISOString() }
  // Structured JSON log; ingestion via existing Vercel/Datadog log drain.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ advisor: record }))
}
