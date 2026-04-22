import { classifyRequest, type Tier } from "./classifier"
import { buildDefaultToolRegistry } from "@/lib/advisor/tools"
import { streamWithTools, type ToolDefinition, type StreamMessage } from "@/lib/ai/gemini"
import { loadSkill } from "@/lib/ai/skills/loader"
import { tryConsumeGrace } from "./grace"
import { advisorQueryCache, queryHash } from "./cache"
import { appendMessage, listMessages, type ToolCallSummary } from "@/lib/advisor/persistence/messages"
import { touchLastMessage } from "@/lib/advisor/persistence/conversations"
import { debitCredits, type AdvisorDebitType } from "@/lib/advisor/persistence/ledger"
import type { AdvisorSseEvent } from "./streaming"
import { generateTitle } from "./titleGen"
import { logAdvisorEvent } from "./observability"
import type { Schema } from "@google/generative-ai"

const MAX_TOOL_CALLS = 8
const TOTAL_TIMEOUT_MS = 60_000
const TOOL_TIMEOUT_MS = 10_000

const TYPE_BY_TIER: Record<Tier, AdvisorDebitType> = {
  instant: "ADVISOR_INSTANT",
  marketplace: "ADVISOR_MARKETPLACE",
  deep_research: "ADVISOR_DEEP_RESEARCH",
}

const MODEL_BY_TIER = (tier: Tier) => tier === "deep_research"
  ? (process.env.GEMINI_MODEL_PRO ?? "gemini-2.5-pro")
  : (process.env.GEMINI_MODEL_FLASH ?? "gemini-2.5-flash")

// Budget is 2 for Instant/Marketplace so the model can (1) call a tool and
// (2) synthesize an answer from the tool result in a follow-up round. Deep
// research users get 3 rounds for multi-step investigations. Without a second
// round, any tool-calling response would produce a tool_call_* event and no
// content_delta — a silent, broken-looking reply for the user.
const LOOP_BUDGET = (tier: Tier, userTier: "FREE" | "PRO") =>
  tier === "deep_research" && userTier === "PRO" ? 3 : 2

/**
 * Feature-flag gate. `ADVISOR_ENABLED` supports:
 * - "full"       → everyone
 * - "free_beta"  → FREE + PRO (anonymous excluded)
 * - "internal"   → only userIds listed in ADVISOR_INTERNAL_USER_IDS (csv)
 */
function advisorEnabledFor(userTier: "FREE" | "PRO", userId: string): boolean {
  const flag = process.env.ADVISOR_ENABLED ?? "internal"
  if (flag === "full") return true
  if (flag === "free_beta") return userTier === "FREE" || userTier === "PRO"
  if (flag === "internal") {
    const allowed = process.env.ADVISOR_INTERNAL_USER_IDS?.split(",").map(s => s.trim()).filter(Boolean) ?? []
    return userId !== "" && allowed.includes(userId)
  }
  return false
}

export interface RunAdvisorTurnInput {
  userText: string
  conversationId: string
  surface: "oracle" | "chat" | "page"
  userTier: "FREE" | "PRO"
  userId: string | null
  anonymousSessionId: string | null
  locale: "en" | "de" | "es" | "ja"
  initialContext: { listingId?: string; seriesId?: string } | null
}

export async function* runAdvisorTurn(input: RunAdvisorTurnInput): AsyncGenerator<AdvisorSseEvent> {
  const startedAt = Date.now()

  // 0. Feature-flag gate
  if (!advisorEnabledFor(input.userTier, input.userId ?? "")) {
    logAdvisorEvent({
      kind: "error",
      conversationId: input.conversationId,
      userId: input.userId,
      anonymousSessionId: input.anonymousSessionId,
      userTier: input.userTier,
      errorCode: "feature_disabled",
      message: "advisor is in limited rollout",
    })
    yield { type: "error", code: "feature_disabled", message: "Advisor is in limited rollout" }
    return
  }

  // 1. Classify
  const classification = await classifyRequest({
    userText: input.userText,
    hasCarContext: Boolean(input.initialContext?.listingId),
    userTier: input.userTier,
  })
  logAdvisorEvent({
    kind: "classify",
    conversationId: input.conversationId,
    userId: input.userId,
    anonymousSessionId: input.anonymousSessionId,
    userTier: input.userTier,
    tier: classification.tier,
    pistons: classification.estimatedPistons,
    model: MODEL_BY_TIER(classification.tier),
  })
  yield {
    type: "classified",
    tier: classification.tier,
    estimatedPistons: classification.estimatedPistons,
    downgraded: classification.downgradedFromDeepResearch,
  }

  // 2. Cache
  const userKey = input.userId ?? input.anonymousSessionId ?? "anon"
  const contextFp = input.initialContext?.listingId ?? input.initialContext?.seriesId ?? "none"
  const hash = queryHash({ text: input.userText, tier: classification.tier, contextFingerprint: contextFp })
  const cached = advisorQueryCache.get(userKey, hash)
  if (cached) {
    yield { type: "content_delta", delta: cached.content }
    await appendMessage({ conversationId: input.conversationId, role: "user", content: input.userText })
    const asstMsg = await appendMessage({
      conversationId: input.conversationId, role: "assistant", content: cached.content,
      toolCalls: cached.toolCalls, tierClassification: classification.tier,
      creditsUsed: 0, latencyMs: Date.now() - startedAt, model: "cache",
    })
    await touchLastMessage(input.conversationId)
    logAdvisorEvent({
      kind: "response",
      conversationId: input.conversationId,
      userId: input.userId,
      anonymousSessionId: input.anonymousSessionId,
      userTier: input.userTier,
      tier: classification.tier,
      model: "cache",
      pistons: 0,
      latencyMs: Date.now() - startedAt,
    })
    yield { type: "done", pistonsDebited: 0, messageId: asstMsg.id }
    return
  }

  // 3. Grace / debit pre-check for Instant + Marketplace
  let graceConsumed = false
  if (classification.tier === "instant" || classification.tier === "marketplace") {
    graceConsumed = await tryConsumeGrace({
      supabaseUserId: input.userId,
      anonymousSessionId: input.anonymousSessionId,
      tier: classification.tier,
    })
  }

  // 4. Load skill + tools + build Gemini inputs
  const skill = loadSkill("advisor")
  const registry = buildDefaultToolRegistry()
  const toolDefs: ToolDefinition[] = registry.listForTier(input.userTier).map(t => ({
    name: t.name, description: t.description, parameters: t.parameters as Schema,
  }))

  // Compact history: last 10 messages
  const history = (await listMessages(input.conversationId)).slice(-10)
  const streamMessages: StreamMessage[] = history.map(m => ({
    role: m.role === "tool" ? "tool" : m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    toolName: m.tool_calls?.[0]?.name,
  }))
  streamMessages.push({ role: "user", content: input.userText })

  // 5. Append user message
  await appendMessage({ conversationId: input.conversationId, role: "user", content: input.userText })

  // 6. Bounded tool-call loop
  const budget = LOOP_BUDGET(classification.tier, input.userTier)
  const toolCallSummaries: ToolCallSummary[] = []
  let accumulatedText = ""
  let runningCost = classification.estimatedPistons
  const toolsUsed: string[] = []

  for (let round = 0; round < budget; round++) {
    if (Date.now() - startedAt > TOTAL_TIMEOUT_MS) {
      logAdvisorEvent({
        kind: "error",
        conversationId: input.conversationId,
        userId: input.userId,
        anonymousSessionId: input.anonymousSessionId,
        userTier: input.userTier,
        tier: classification.tier,
        latencyMs: Date.now() - startedAt,
        errorCode: "timeout",
        message: "request exceeded 60s budget",
      })
      yield { type: "error", code: "timeout", message: "request exceeded 60s budget" }
      return
    }

    const model = MODEL_BY_TIER(classification.tier)
    const calls: Array<{ name: string; args: Record<string, unknown> }> = []
    let roundTextAccumulator = ""

    const stream = streamWithTools({
      model,
      systemPrompt: skill.systemPrompt.replace("{{locale}}", input.locale),
      messages: streamMessages,
      tools: toolDefs,
      temperature: skill.temperature,
    })

    for await (const ev of stream) {
      if (ev.type === "text") {
        roundTextAccumulator += ev.delta
        yield { type: "content_delta", delta: ev.delta }
      } else if (ev.type === "tool_call") {
        calls.push({ name: ev.name, args: ev.args })
      } else if (ev.type === "error") {
        logAdvisorEvent({
          kind: "error",
          conversationId: input.conversationId,
          userId: input.userId,
          anonymousSessionId: input.anonymousSessionId,
          userTier: input.userTier,
          tier: classification.tier,
          model,
          latencyMs: Date.now() - startedAt,
          errorCode: "llm_error",
          message: ev.message,
        })
        yield { type: "error", code: "llm_error", message: ev.message }
        return
      }
    }

    accumulatedText += roundTextAccumulator

    if (calls.length === 0) break // model finished without calling a tool

    for (const call of calls) {
      if (toolCallSummaries.length >= MAX_TOOL_CALLS) break
      yield { type: "tool_call_start", name: call.name, args: call.args }
      const toolStartedAt = Date.now()
      const result = await Promise.race([
        registry.invoke(call.name, call.args, input.userTier, {
          userId: input.userId, anonymousSessionId: input.anonymousSessionId, userTier: input.userTier,
          locale: input.locale, conversationId: input.conversationId,
        }),
        new Promise<{ ok: false; error: string }>(res => setTimeout(() => res({ ok: false, error: "tool_timeout" }), TOOL_TIMEOUT_MS)),
      ])
      const toolLatency = Date.now() - toolStartedAt
      const summary = result.ok ? (result as { summary: string }).summary : `error: ${(result as { error: string }).error}`
      toolCallSummaries.push({ name: call.name, args: call.args, result_summary: summary.slice(0, 500) })
      toolsUsed.push(call.name)
      logAdvisorEvent({
        kind: "tool_call",
        conversationId: input.conversationId,
        userId: input.userId,
        anonymousSessionId: input.anonymousSessionId,
        userTier: input.userTier,
        tier: classification.tier,
        toolName: call.name,
        toolOk: result.ok,
        latencyMs: toolLatency,
        errorCode: result.ok ? undefined : (result as { error: string }).error,
      })
      yield { type: "tool_call_end", name: call.name, summary: summary.slice(0, 500), ok: result.ok }
      streamMessages.push({
        role: "assistant", content: roundTextAccumulator,
      }, {
        role: "tool", toolName: call.name, content: summary,
      })
    }

    if (classification.tier === "deep_research") {
      runningCost += 10 // crude per-round accumulator; retune later with real usage metrics
      yield { type: "deep_research_cost", runningPistons: runningCost, toolsUsed: [...toolsUsed] }
    }
  }

  // 7. Persist assistant message, debit, touch conversation
  const pistonsToDebit = graceConsumed ? 0 : classification.estimatedPistons
  const asstMsg = await appendMessage({
    conversationId: input.conversationId,
    role: "assistant",
    content: accumulatedText,
    toolCalls: toolCallSummaries,
    tierClassification: classification.tier,
    creditsUsed: pistonsToDebit,
    latencyMs: Date.now() - startedAt,
    model: MODEL_BY_TIER(classification.tier),
  })
  if (pistonsToDebit > 0 && input.userId) {
    await debitCredits({
      supabaseUserId: input.userId,
      amount: pistonsToDebit,
      type: TYPE_BY_TIER[classification.tier],
      conversationId: input.conversationId,
      messageId: asstMsg.id,
    })
  }
  logAdvisorEvent({
    kind: "debit",
    conversationId: input.conversationId,
    userId: input.userId,
    anonymousSessionId: input.anonymousSessionId,
    userTier: input.userTier,
    tier: classification.tier,
    pistons: pistonsToDebit,
  })
  await touchLastMessage(input.conversationId)

  // 8. Cache
  advisorQueryCache.set(userKey, hash, { content: accumulatedText, toolCalls: toolCallSummaries })

  const totalLatency = Date.now() - startedAt
  logAdvisorEvent({
    kind: "response",
    conversationId: input.conversationId,
    userId: input.userId,
    anonymousSessionId: input.anonymousSessionId,
    userTier: input.userTier,
    tier: classification.tier,
    model: MODEL_BY_TIER(classification.tier),
    pistons: pistonsToDebit,
    latencyMs: totalLatency,
  })

  yield { type: "done", pistonsDebited: pistonsToDebit, messageId: asstMsg.id }

  // 9. Fire-and-forget title generation on first turn
  try {
    const allMsgs = await listMessages(input.conversationId)
    if (allMsgs.filter(m => m.role === "assistant").length === 1) {
      generateTitle(input.userText, accumulatedText, input.locale)
        .then(async title => {
          const mod = await import("@/lib/supabase/server")
          const client = await mod.createClient()
          await client.from("advisor_conversations").update({ title }).eq("id", input.conversationId)
        })
        .catch(() => { /* swallow — title failure non-fatal */ })
    }
  } catch {
    // swallow — title generation is non-fatal
  }
}
