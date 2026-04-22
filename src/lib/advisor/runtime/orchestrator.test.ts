import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/ai/gemini", () => ({
  streamWithTools: vi.fn(async function* () {
    yield { type: "text", delta: "The 997.2 GT3 is " }
    yield { type: "text", delta: "a Mezger-engined GT car." }
  }),
  generateJson: vi.fn().mockResolvedValue({ ok: true, data: { tier: "instant", reason: "knowledge" }, raw: "" }),
}))

vi.mock("@/lib/ai/skills/loader", () => ({
  loadSkill: () => ({
    kind: "chat",
    systemPrompt: "You are an advisor. Locale: {{locale}}.",
    model: "gemini-2.5-flash",
    temperature: 0.3,
  }),
}))

vi.mock("@/lib/advisor/persistence/messages", () => ({
  appendMessage: vi.fn(async (input: { conversationId: string; role: string; content: string }) => ({
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    tool_calls: null,
    tier_classification: null,
    credits_used: 0,
    latency_ms: null,
    model: null,
    is_superseded: false,
    created_at: new Date().toISOString(),
  })),
  listMessages: vi.fn(async () => []),
}))

vi.mock("@/lib/advisor/persistence/conversations", () => ({
  touchLastMessage: vi.fn(async () => {}),
}))

vi.mock("@/lib/advisor/persistence/ledger", () => ({
  debitCredits: vi.fn(async () => ({ newBalance: 0 })),
}))

vi.mock("./grace", () => ({
  tryConsumeGrace: vi.fn(async () => true),
}))

vi.mock("@/lib/advisor/tools", () => ({
  buildDefaultToolRegistry: () => ({
    register: () => {},
    listForTier: () => [],
    invoke: async () => ({ ok: false, error: "noop" }),
  }),
}))

import { runAdvisorTurn } from "./orchestrator"

describe("runAdvisorTurn (happy path, no tools)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("streams text and ends with a done event", async () => {
    const events: string[] = []
    for await (const ev of runAdvisorTurn({
      userText: "what is a 997.2 GT3",
      conversationId: "conv-1",
      surface: "chat",
      userTier: "FREE",
      userId: "u1",
      anonymousSessionId: null,
      locale: "en",
      initialContext: null,
    })) {
      events.push(ev.type)
    }
    expect(events[0]).toBe("classified")
    expect(events).toContain("content_delta")
    expect(events[events.length - 1]).toBe("done")
  })
})
