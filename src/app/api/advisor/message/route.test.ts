import { describe, it, expect, vi } from "vitest"

vi.mock("next/headers", () => ({
  cookies: async () => {
    const store = new Map<string, string>()
    return {
      get: (name: string) => (store.has(name) ? { name, value: store.get(name)! } : undefined),
      set: (name: string, value: string) => { store.set(name, value) },
    }
  },
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }),
  }),
}))
vi.mock("@/lib/advisor/runtime/orchestrator", () => ({
  runAdvisorTurn: async function* () {
    yield { type: "classified", tier: "instant", estimatedPistons: 1, downgraded: false }
    yield { type: "content_delta", delta: "hello" }
    yield { type: "done", pistonsDebited: 0, messageId: "m1" }
  },
}))
vi.mock("@/lib/advisor/persistence/conversations", () => ({
  createConversation: async () => ({ id: "conv-1", user_id: null, anonymous_session_id: "anon-x" }),
  getConversation: async () => null,
}))

import { POST } from "./route"
import { NextRequest } from "next/server"

describe("POST /api/advisor/message", () => {
  it("streams the orchestrator events as SSE", async () => {
    vi.stubEnv("ADVISOR_ANON_SECRET", "x".repeat(32))
    const req = new NextRequest("http://localhost/api/advisor/message", {
      method: "POST",
      body: JSON.stringify({ content: "hi", surface: "chat" }),
    })
    const res = await POST(req)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
    const text = await res.text()
    expect(text).toContain("classified")
    expect(text).toContain("content_delta")
    expect(text).toContain("done")
  })

  it("still streams for anonymous users when the anon secret is missing", async () => {
    vi.stubEnv("ADVISOR_ANON_SECRET", "")
    const req = new NextRequest("http://localhost/api/advisor/message", {
      method: "POST",
      body: JSON.stringify({ content: "hi", surface: "chat" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain("classified")
  })
})
