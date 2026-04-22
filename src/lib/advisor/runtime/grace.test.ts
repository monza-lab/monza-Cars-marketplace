import { describe, it, expect, vi } from "vitest"
import { tryConsumeGrace, getGraceUsage } from "./grace"

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { instant_used: 3, marketplace_used: 0 }, error: null }) }) }) }) }),
  }),
}))

describe("grace", () => {
  it("returns true when RPC says capacity available", async () => {
    const ok = await tryConsumeGrace({ supabaseUserId: "u1", anonymousSessionId: null, tier: "instant" })
    expect(ok).toBe(true)
  })

  it("reads today's usage", async () => {
    const u = await getGraceUsage({ supabaseUserId: "u1", anonymousSessionId: null })
    expect(u.instantUsed).toBe(3)
  })
})
