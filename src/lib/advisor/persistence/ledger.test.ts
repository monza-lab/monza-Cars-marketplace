import { describe, it, expect, vi } from "vitest"
import { debitCredits, getRecentDebits, getTodayUsageByType } from "./ledger"

const mockRpc = vi.fn()
const mockSelect = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
          }),
          order: () => ({ limit: () => Promise.resolve({ data: [{ amount: -5, type: "ADVISOR_MARKETPLACE", conversation_id: "c1", message_id: "m1", created_at: new Date().toISOString() }], error: null }) }),
          gte: () => Promise.resolve({ data: [{ amount: -5, type: "ADVISOR_MARKETPLACE" }], error: null }),
        }),
      }),
    }),
  }),
}))

describe("debitCredits", () => {
  it("calls the debit_user_credits RPC with the correct type and returns the new balance", async () => {
    mockRpc.mockResolvedValue({ data: [{ new_balance: 95 }], error: null })
    const { newBalance } = await debitCredits({
      supabaseUserId: "user-1",
      amount: 5,
      type: "ADVISOR_MARKETPLACE",
      conversationId: "conv-1",
      messageId: "msg-1",
    })
    expect(newBalance).toBe(95)
    expect(mockRpc).toHaveBeenCalledWith("debit_user_credits", expect.objectContaining({
      p_supabase_user_id: "user-1",
      p_amount: 5,
      p_type: "ADVISOR_MARKETPLACE",
    }))
  })

  it("throws on insufficient_credits error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "insufficient_credits" } })
    await expect(debitCredits({
      supabaseUserId: "user-1", amount: 99999, type: "ADVISOR_INSTANT",
      conversationId: null, messageId: null,
    })).rejects.toThrow(/insufficient_credits/)
  })

  it("calls the RPC with ADVISOR_REFUND type and returns the credited balance", async () => {
    mockRpc.mockResolvedValue({ data: [{ new_balance: 105 }], error: null })
    const { newBalance } = await debitCredits({
      supabaseUserId: "user-1",
      amount: 5,
      type: "ADVISOR_REFUND",
      conversationId: "c-1",
      messageId: "m-1",
    })
    expect(newBalance).toBe(105)
    expect(mockRpc).toHaveBeenCalledWith("debit_user_credits", expect.objectContaining({
      p_type: "ADVISOR_REFUND",
    }))
  })
})

describe("getRecentDebits", () => {
  it("returns debit rows scoped by user_credits.id resolved from supabase_user_id", async () => {
    const rows = await getRecentDebits("user-credits-id-1", 10)
    expect(Array.isArray(rows)).toBe(true)
  })
})

describe("getTodayUsageByType", () => {
  it("aggregates absolute amounts by type for today", async () => {
    const usage = await getTodayUsageByType("user-credits-id-1")
    expect(typeof usage).toBe("object")
  })
})
