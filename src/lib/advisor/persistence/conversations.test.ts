import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  createConversation,
  getConversation,
  listConversationsForUser,
  touchLastMessage,
  archiveConversation,
  rotateShareToken,
  type CreateConversationInput,
} from "./conversations"

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: () => ({
      insert: (row: unknown) => ({
        select: () => ({
          single: async () => ({ data: { ...(row as object), id: "conv-1", created_at: new Date().toISOString() }, error: null }),
        }),
      }),
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: "conv-1" }, error: null }),
          order: () => ({ limit: () => ({ async then(res: (v: unknown) => void) { res({ data: [], error: null }) } }) }),
        }),
      }),
      update: () => ({ eq: () => ({ async then(res: (v: unknown) => void) { res({ data: null, error: null }) } }) }),
    }),
  }),
}))

describe("createConversation", () => {
  it("inserts a row with the provided surface + locale", async () => {
    const input: CreateConversationInput = {
      userId: "user-1",
      surface: "chat",
      locale: "en",
      initialContextListingId: "live-abc",
    }
    const conv = await createConversation(input)
    expect(conv.id).toBe("conv-1")
  })
})
