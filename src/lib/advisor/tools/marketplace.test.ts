import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ToolInvocationContext } from "./registry"

vi.mock("@/lib/supabaseLiveListings", () => ({
  fetchPricedListingsForModel: vi.fn(),
  fetchLiveListingById: vi.fn(),
}))

vi.mock("@/lib/pricing/priceHistory", () => ({
  getPriceHistory: vi.fn(),
}))

// Avoid hitting brandConfig's full static table for unknown series strings.
import {
  fetchPricedListingsForModel,
  fetchLiveListingById,
} from "@/lib/supabaseLiveListings"
import { getPriceHistory } from "@/lib/pricing/priceHistory"
import { marketplaceTools } from "./marketplace"

const ctx: ToolInvocationContext = {
  userId: "u1",
  anonymousSessionId: null,
  userTier: "FREE",
  locale: "en",
  conversationId: "c1",
}

function findTool(name: string) {
  const t = marketplaceTools.find((t) => t.name === name)
  if (!t) throw new Error(`tool ${name} not registered`)
  return t
}

// A small priced-row set spanning US + EU tiers so marketStats can compute bands.
function mockPricedRows() {
  const base = (overrides: Partial<Record<string, unknown>>) => ({
    id: "x",
    year: 2011,
    make: "Porsche",
    model: "911 GT3",
    trim: null,
    hammer_price: 200000,
    original_currency: "USD",
    sale_date: "2025-06-01",
    status: "sold",
    mileage: 25000,
    source: "Bring a Trailer",
    country: "US",
    ...overrides,
  })
  return [
    base({ id: "a", hammer_price: 180000 }),
    base({ id: "b", hammer_price: 200000 }),
    base({ id: "c", hammer_price: 220000 }),
    base({ id: "d", hammer_price: 195000 }),
    base({ id: "e", hammer_price: 210000 }),
    base({
      id: "f",
      hammer_price: 170000,
      source: "AutoScout24",
      original_currency: "EUR",
      country: "DE",
    }),
    base({
      id: "g",
      hammer_price: 190000,
      source: "AutoScout24",
      original_currency: "EUR",
      country: "DE",
    }),
    base({
      id: "h",
      hammer_price: 200000,
      source: "AutoScout24",
      original_currency: "EUR",
      country: "DE",
    }),
  ]
}

describe("marketplace tools", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("search_listings", () => {
    it("returns a ranked list of matches", async () => {
      vi.mocked(fetchPricedListingsForModel).mockResolvedValue([
        {
          id: "1",
          year: 2011,
          make: "Porsche",
          model: "911 GT3",
          trim: null,
          hammer_price: 185000,
          original_currency: "USD",
          sale_date: null,
          status: "active",
          mileage: 20000,
          source: "Bring a Trailer",
          country: "US",
        },
      ])
      const tool = findTool("search_listings")
      const res = await tool.handler({ query: "911 GT3" }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.summary).toMatch(/match/i)
        expect(res.summary.length).toBeGreaterThan(0)
      }
    })
  })

  describe("get_listing", () => {
    it("returns listing detail + summary", async () => {
      vi.mocked(fetchLiveListingById).mockResolvedValue({
        id: "live-1",
        title: "2011 Porsche 911 GT3",
        year: 2011,
        make: "Porsche",
        model: "911 GT3",
        trim: null,
        price: 185000,
        trend: "up",
        trendValue: 3,
        thesis: "",
        image: "",
        images: [],
        engine: "",
        transmission: "",
        mileage: 25000,
        mileageUnit: "mi",
        location: "California, USA",
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
      const tool = findTool("get_listing")
      const res = await tool.handler({ id: "live-1" }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.summary).toMatch(/GT3/)
    })

    it("returns not_found on missing", async () => {
      vi.mocked(fetchLiveListingById).mockResolvedValue(null)
      const tool = findTool("get_listing")
      const res = await tool.handler({ id: "live-x" }, ctx)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toBe("not_found")
    })
  })

  describe("get_comparable_sales", () => {
    it("returns comp digest when matches exist", async () => {
      vi.mocked(fetchPricedListingsForModel).mockResolvedValue(mockPricedRows() as never)
      const tool = findTool("get_comparable_sales")
      const res = await tool.handler({ seriesId: "997", monthsBack: 24 }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.summary).toMatch(/comps/)
    })
  })

  describe("get_price_history", () => {
    it("summarizes time series", async () => {
      vi.mocked(getPriceHistory).mockResolvedValue([
        { id: "ph-0", bid: 100000, timestamp: "2026-01-01T00:00:00Z", status: "active" },
        { id: "ph-1", bid: 150000, timestamp: "2026-02-01T00:00:00Z", status: "active" },
      ])
      const tool = findTool("get_price_history")
      const res = await tool.handler({ listingId: "live-1" }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.summary).toMatch(/2 price points/)
    })
  })

  describe("get_regional_valuation", () => {
    it("returns bands across regions", async () => {
      vi.mocked(fetchPricedListingsForModel).mockResolvedValue(mockPricedRows() as never)
      const tool = findTool("get_regional_valuation")
      const res = await tool.handler({ seriesId: "997" }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.summary).toMatch(/US/)
    })
  })

  describe("compute_price_position", () => {
    it("returns a percentile", async () => {
      vi.mocked(fetchLiveListingById).mockResolvedValue({
        id: "live-1",
        title: "2011 Porsche 911 GT3",
        year: 2011,
        make: "Porsche",
        model: "911 GT3",
        trim: null,
        price: 200000,
        trend: "up",
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
        currentBid: 200000,
        bidCount: 10,
        endTime: new Date(),
        category: "GT3",
      })
      vi.mocked(fetchPricedListingsForModel).mockResolvedValue(mockPricedRows() as never)
      const tool = findTool("compute_price_position")
      const res = await tool.handler({ listingId: "live-1" }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.summary).toMatch(/percentile/)
    })
  })
})
