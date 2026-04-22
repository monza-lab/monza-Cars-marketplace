import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ToolInvocationContext } from "./registry"

vi.mock("@/lib/supabaseLiveListings", () => ({
  fetchLiveListingById: vi.fn(),
}))

import { actionTools } from "./action"
import { fetchLiveListingById } from "@/lib/supabaseLiveListings"

const ctx: ToolInvocationContext = {
  userId: "u1",
  anonymousSessionId: null,
  userTier: "FREE",
  locale: "en",
  conversationId: "c1",
}

function findTool(name: string) {
  const t = actionTools.find((t) => t.name === name)
  if (!t) throw new Error(`tool ${name} not registered`)
  return t
}

describe("action tools", () => {
  beforeEach(() => vi.clearAllMocks())

  describe("trigger_report", () => {
    it("returns a report CTA payload", async () => {
      vi.mocked(fetchLiveListingById).mockResolvedValue({
        id: "live-1",
        title: "2011 Porsche 911 GT3",
        year: 2011,
        make: "Porsche",
        model: "911 GT3",
        trim: null,
        price: 185000,
        trend: "",
        trendValue: 0,
        thesis: "",
        image: "",
        images: [],
        engine: "",
        transmission: "",
        mileage: 25000,
        mileageUnit: "mi",
        location: "CA, USA",
        region: "US",
        fairValueByRegion: {} as never,
        history: "",
        platform: "BRING_A_TRAILER",
        status: "ACTIVE",
        currentBid: 185000,
        bidCount: 12,
        endTime: new Date(),
        category: "GT3",
      })
      const tool = findTool("trigger_report")
      const res = await tool.handler({ listingId: "live-1" }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) {
        const data = res.data as { kind: string; cost: number }
        expect(data.kind).toBe("report_cta")
        expect(data.cost).toBe(25)
      }
    })

    it("fails when listing missing", async () => {
      vi.mocked(fetchLiveListingById).mockResolvedValue(null)
      const tool = findTool("trigger_report")
      const res = await tool.handler({ listingId: "live-x" }, ctx)
      expect(res.ok).toBe(false)
    })
  })

  describe("navigate_to", () => {
    it("produces a navigation intent", async () => {
      const tool = findTool("navigate_to")
      const res = await tool.handler({ route: "/cars/porsche/997", params: { variant: "gt3" } }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) {
        const data = res.data as { kind: string; route: string; params: Record<string, string> }
        expect(data.kind).toBe("navigate")
        expect(data.params.variant).toBe("gt3")
      }
    })
  })
})
