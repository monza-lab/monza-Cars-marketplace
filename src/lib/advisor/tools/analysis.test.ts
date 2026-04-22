import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ToolInvocationContext } from "./registry"

vi.mock("@/lib/supabaseLiveListings", () => ({
  fetchLiveListingById: vi.fn(),
  fetchPricedListingsForModel: vi.fn(async () => []),
}))

vi.mock("./marketplace", async () => {
  const actual = await vi.importActual<typeof import("./marketplace")>("./marketplace")
  return {
    ...actual,
    // Override the three fan-out tools so compare_listings/build_shortlist can
    // assemble deterministic rows without touching DB helpers.
    getListing: {
      ...actual.getListing,
      handler: vi.fn(async (args: Record<string, unknown>) => ({
        ok: true,
        summary: `Listing ${String(args.id)}`,
        data: {
          id: String(args.id),
          year: 2011,
          make: "Porsche",
          model: "911 GT3",
          trim: null,
          currentBid: 185000,
          description: "",
        },
      })),
    },
    computePricePosition: {
      ...actual.computePricePosition,
      handler: vi.fn(async () => ({
        ok: true,
        summary: "percentile",
        data: { percentile: 42 },
      })),
    },
    searchListings: {
      ...actual.searchListings,
      handler: vi.fn(async () => ({
        ok: true,
        summary: "Found 2 matches",
        data: {
          results: [
            { id: "live-1", year: 2011, make: "Porsche", model: "911 GT3", trim: null, currentBid: 180000 },
            { id: "live-2", year: 2012, make: "Porsche", model: "911 GT3 RS", trim: null, currentBid: 220000 },
          ],
          total: 2,
        },
      })),
    },
  }
})

import { analysisTools } from "./analysis"
import { fetchLiveListingById } from "@/lib/supabaseLiveListings"

const ctx: ToolInvocationContext = {
  userId: "u1",
  anonymousSessionId: null,
  userTier: "FREE",
  locale: "en",
  conversationId: "c1",
}

function findTool(name: string) {
  const t = analysisTools.find((t) => t.name === name)
  if (!t) throw new Error(`tool ${name} not registered`)
  return t
}

describe("analysis tools", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("assess_red_flags", () => {
    it("flags IMS risk on a 997.1 with no retrofit mentioned", async () => {
      vi.mocked(fetchLiveListingById).mockResolvedValue({
        id: "live-1",
        title: "2007 Porsche 911 Carrera",
        year: 2007,
        make: "Porsche",
        model: "911 Carrera",
        trim: null,
        price: 50000,
        trend: "",
        trendValue: 0,
        thesis: "",
        image: "",
        images: [],
        engine: "",
        transmission: "",
        mileage: 75000,
        mileageUnit: "mi",
        location: "CA, USA",
        region: "US",
        fairValueByRegion: {} as never,
        history: "",
        platform: "BRING_A_TRAILER",
        status: "ACTIVE",
        currentBid: 52000,
        bidCount: 5,
        endTime: new Date(),
        category: "Carrera",
        description: "Clean car, regular oil changes.",
      })
      const tool = findTool("assess_red_flags")
      const res = await tool.handler({ listingId: "live-1" }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.summary).toMatch(/red flag/)
        const data = res.data as { flags: Array<{ severity: string; issue: string }> }
        expect(data.flags.some((f) => f.issue.startsWith("ims-bearing"))).toBe(true)
      }
    })
  })

  describe("compare_listings", () => {
    it("assembles a table via fan-out tool calls", async () => {
      const tool = findTool("compare_listings")
      const res = await tool.handler({ listingIds: ["live-1", "live-2"] }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.summary).toMatch(/Compared/)
        const data = res.data as { rows: Array<{ id: string }> }
        expect(data.rows.length).toBe(2)
      }
    })

    it("rejects >5 ids", async () => {
      const tool = findTool("compare_listings")
      const res = await tool.handler({ listingIds: ["1", "2", "3", "4", "5", "6"] }, ctx)
      expect(res.ok).toBe(false)
    })
  })

  describe("build_shortlist", () => {
    it("sorts by percentile and returns a top pick", async () => {
      const tool = findTool("build_shortlist")
      const res = await tool.handler({ seriesId: "997", maxResults: 5 }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.summary).toMatch(/Shortlist/)
        const data = res.data as { shortlist: Array<unknown> }
        expect(data.shortlist.length).toBeGreaterThan(0)
      }
    })
  })
})
