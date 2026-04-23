import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ToolInvocationContext } from "./registry"

vi.mock("@/lib/reports/queries", () => ({
  getUserCredits: vi.fn(async () => ({ credits_balance: 42, pack_credits_balance: 8 })),
}))

import { userTools } from "./user"
import { getUserCredits } from "@/lib/reports/queries"

const ctx: ToolInvocationContext = {
  userId: "user-1",
  anonymousSessionId: null,
  userTier: "PRO",
  locale: "en",
  conversationId: "c1",
  region: "US",
  currency: "USD",
}

function findTool(name: string) {
  const t = userTools.find((t) => t.name === name)
  if (!t) throw new Error(`tool ${name} not registered`)
  return t
}

describe("user tools", () => {
  beforeEach(() => vi.clearAllMocks())

  describe("get_user_context", () => {
    it("returns tier, locale, region, and pistons balance", async () => {
      const tool = findTool("get_user_context")
      const res = await tool.handler({ viewedCars: ["live-1"] }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) {
        const data = res.data as {
          tier: string
          locale: string
          region: string
          pistonsBalance: number | null
          viewedCars: string[]
        }
        expect(data.tier).toBe("PRO")
        expect(data.locale).toBe("en")
        expect(data.pistonsBalance).toBe(50)
        expect(data.viewedCars).toEqual(["live-1"])
      }
    })

    it("handles anonymous users gracefully", async () => {
      const anonCtx: ToolInvocationContext = {
        ...ctx,
        userId: null,
      }
      const tool = findTool("get_user_context")
      const res = await tool.handler({}, anonCtx)
      expect(res.ok).toBe(true)
      if (res.ok) {
        const data = res.data as { pistonsBalance: number | null }
        expect(data.pistonsBalance).toBeNull()
      }
    expect(vi.mocked(getUserCredits)).not.toHaveBeenCalled()
  })
  })

  describe("get_user_watchlist", () => {
    it("returns phase-2 placeholder", async () => {
      const tool = findTool("get_user_watchlist")
      const res = await tool.handler({}, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) {
        const data = res.data as { watchedCarIds: string[]; note: string }
        expect(data.watchedCarIds).toEqual([])
        expect(data.note).toMatch(/coming soon/i)
      }
    })
  })
})
