import { describe, it, expect, vi, beforeEach } from "vitest"

// Build a fully chainable mock — every method returns the same builder
const mockBuilder: Record<string, ReturnType<typeof vi.fn>> = {}
const methods = ["select", "ilike", "eq", "or", "gte", "lte", "gt", "order", "limit"] as const

for (const m of methods) {
  mockBuilder[m] = vi.fn()
}
// Each method returns the builder itself for chaining
for (const m of methods) {
  mockBuilder[m].mockImplementation(() => {
    // limit is the terminal — returns the data promise
    if (m === "limit") return Promise.resolve({ data: [], error: null })
    return Object.fromEntries(methods.map((n) => [n, mockBuilder[n]]))
  })
}

const mockFrom = vi.fn(() =>
  Object.fromEntries(methods.map((n) => [n, mockBuilder[n]]))
)

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock("@/lib/supabaseLiveListings", () => ({
  isJunkListing: vi.fn(() => false),
  // Mirror the real sanitizer so the .or() clause assertions stay meaningful.
  sanitizeOrIlikeTerm: (term: string) =>
    term.replace(/[%_,():*\\"]/g, " ").replace(/\s+/g, " ").trim(),
}))

vi.mock("@/lib/makeProfiles", () => ({
  normalizeSupportedMake: vi.fn((v: string) => {
    if (v.toLowerCase() === "porsche") return "Porsche"
    return null
  }),
}))

// Must import after mocking
import { countAdvisorListings, fetchAdvisorListings } from "../advisorListings"

describe("fetchAdvisorListings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-apply the chainable return values after clearAllMocks
    for (const m of methods) {
      mockBuilder[m].mockImplementation(() => {
        if (m === "limit") return Promise.resolve({ data: [], error: null })
        return Object.fromEntries(methods.map((n) => [n, mockBuilder[n]]))
      })
    }
    mockFrom.mockImplementation(() =>
      Object.fromEntries(methods.map((n) => [n, mockBuilder[n]]))
    )
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key"
  })

  it("applies series filter server-side when seriesId provided", async () => {
    await fetchAdvisorListings({ make: "Porsche", seriesId: "993" })
    expect(mockBuilder.eq).toHaveBeenCalledWith("series", "993")
  })

  it("applies trim+model OR filter when variantId provided", async () => {
    await fetchAdvisorListings({ make: "Porsche", variantId: "targa" })
    expect(mockBuilder.or).toHaveBeenCalledWith(
      expect.stringContaining("model.ilike.%targa%")
    )
    expect(mockBuilder.or).toHaveBeenCalledWith(
      expect.stringContaining("trim.ilike.%targa%")
    )
  })

  it("applies price ceiling when priceToUsd provided", async () => {
    await fetchAdvisorListings({ make: "Porsche", priceToUsd: 100000 })
    expect(mockBuilder.lte).toHaveBeenCalledWith("listing_price", 100000)
  })

  it("applies price floor when priceFromUsd provided", async () => {
    await fetchAdvisorListings({ make: "Porsche", priceFromUsd: 50000 })
    expect(mockBuilder.gte).toHaveBeenCalledWith("listing_price", 50000)
  })

  it("applies year range filters", async () => {
    await fetchAdvisorListings({ make: "Porsche", yearFrom: 2000, yearTo: 2010 })
    expect(mockBuilder.gte).toHaveBeenCalledWith("year", 2000)
    expect(mockBuilder.lte).toHaveBeenCalledWith("year", 2010)
  })

  it("applies status=active filter when status is 'live'", async () => {
    await fetchAdvisorListings({ make: "Porsche", status: "live" })
    expect(mockBuilder.eq).toHaveBeenCalledWith("status", "active")
  })

  it("applies free-text query on model+trim+title", async () => {
    await fetchAdvisorListings({ make: "Porsche", query: "GT3 RS" })
    expect(mockBuilder.or).toHaveBeenCalledWith(
      expect.stringContaining("model.ilike.%GT3 RS%")
    )
  })

  it("sanitizes free-text query before embedding it in PostgREST OR filters", async () => {
    await fetchAdvisorListings({ make: "Porsche", query: "GT3,vin.ilike.*WP0*" })

    const searchOr = mockBuilder.or.mock.calls
      .map(([clause]) => clause)
      .find((clause) => typeof clause === "string" && clause.includes("model.ilike"))

    expect(searchOr).toBe("model.ilike.%GT3 vin.ilike. WP0%,trim.ilike.%GT3 vin.ilike. WP0%,title.ilike.%GT3 vin.ilike. WP0%")
  })

  it("sanitizes variant query before embedding it in PostgREST OR filters", async () => {
    await fetchAdvisorListings({ make: "Porsche", variantId: "targa,vin.ilike.*WP0*" })

    const variantOr = mockBuilder.or.mock.calls
      .map(([clause]) => clause)
      .find((clause) => typeof clause === "string" && clause.includes("model.ilike"))

    expect(variantOr).toBe("model.ilike.%targa vin.ilike. WP0%,trim.ilike.%targa vin.ilike. WP0%")
  })

  it("defaults to 200 row limit", async () => {
    await fetchAdvisorListings({ make: "Porsche" })
    expect(mockBuilder.limit).toHaveBeenCalledWith(200)
  })

  it("orders by listing_price ASC when sortBy is 'price_asc'", async () => {
    await fetchAdvisorListings({ make: "Porsche", sortBy: "price_asc" })
    expect(mockBuilder.order).toHaveBeenCalledWith("listing_price", { ascending: true })
  })

  it("returns empty array when env vars missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const result = await fetchAdvisorListings({ make: "Porsche" })
    expect(result).toEqual([])
  })

  it("excludes active auctions by default", async () => {
    await fetchAdvisorListings({ make: "Porsche" })
    // Should add an OR filter for auction exclusion
    expect(mockBuilder.or).toHaveBeenCalledWith(
      expect.stringContaining("source.not.in.")
    )
    expect(mockBuilder.or).toHaveBeenCalledWith(
      expect.stringContaining("status.neq.active")
    )
  })

  it("does not exclude auctions when excludeActiveAuctions is false", async () => {
    await fetchAdvisorListings({ make: "Porsche", excludeActiveAuctions: false })
    // No auction exclusion filter should be applied (only other .or calls if any)
    const orCalls = mockBuilder.or.mock.calls
    const hasAuctionFilter = orCalls.some(
      (call: string[]) => call[0]?.includes("source.not.in.")
    )
    expect(hasAuctionFilter).toBe(false)
  })

  it("skips auction exclusion when status is 'ended'", async () => {
    await fetchAdvisorListings({ make: "Porsche", status: "ended" })
    const orCalls = mockBuilder.or.mock.calls
    const hasAuctionFilter = orCalls.some(
      (call: string[]) => call[0]?.includes("source.not.in.")
    )
    expect(hasAuctionFilter).toBe(false)
  })

  it("orders by year ASC when sortBy is 'year_asc'", async () => {
    await fetchAdvisorListings({ make: "Porsche", sortBy: "year_asc" })
    expect(mockBuilder.order).toHaveBeenCalledWith("year", { ascending: true })
  })

  it("orders by sale_date DESC when sortBy is 'date_desc'", async () => {
    await fetchAdvisorListings({ make: "Porsche", sortBy: "date_desc" })
    expect(mockBuilder.order).toHaveBeenCalledWith("sale_date", { ascending: false, nullsFirst: false })
  })

  it("sanitizes count query before embedding it in PostgREST OR filters", async () => {
    await countAdvisorListings({ make: "Porsche", query: "GT3,vin.ilike.*WP0*" })

    const searchOr = mockBuilder.or.mock.calls
      .map(([clause]) => clause)
      .find((clause) => typeof clause === "string" && clause.includes("model.ilike"))

    expect(searchOr).toBe("model.ilike.%GT3 vin.ilike. WP0%,trim.ilike.%GT3 vin.ilike. WP0%,title.ilike.%GT3 vin.ilike. WP0%")
  })
})
