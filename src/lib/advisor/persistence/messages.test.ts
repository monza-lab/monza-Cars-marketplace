import { describe, it, expect, vi } from "vitest"
import { appendMessage, listMessages, supersedeLastAssistant } from "./messages"

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: () => ({
      insert: (row: unknown) => ({
        select: () => ({
          single: async () => ({ data: { ...(row as object), id: "msg-1", created_at: new Date().toISOString() }, error: null }),
        }),
      }),
      select: () => ({ eq: () => ({ order: () => ({ async then(res: (v: unknown) => void) { res({ data: [], error: null }) } }) }) }),
      update: () => ({ eq: () => ({ eq: () => ({ async then(res: (v: unknown) => void) { res({ data: null, error: null }) } }) }) }),
    }),
  }),
}))

describe("appendMessage", () => {
  it("persists a user message and returns an id", async () => {
    const msg = await appendMessage({
      conversationId: "conv-1",
      role: "user",
      content: "Is the 997.2 GT3 a good investment?",
    })
    expect(msg.id).toBe("msg-1")
    expect(msg.role).toBe("user")
  })
})
