import { describe, it, expect, beforeEach, vi } from "vitest"

const mockRewrite = vi.fn()
vi.mock("@/lib/ai/listingRewriter", () => ({
  rewriteListing: (...args: unknown[]) => mockRewrite(...args),
}))

const mockLoadSource = vi.fn()
vi.mock("@/lib/ai/listingSource", () => ({
  loadListingSource: (...args: unknown[]) => mockLoadSource(...args),
}))

vi.stubEnv("LISTING_REWRITER_ENABLED", "true")

import { GET } from "./route"

function req(url: string, ip = "1.1.1.1") {
  return new Request(url, { headers: { "x-forwarded-for": ip } })
}

describe("GET /api/listings/[id]/rewrite", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 for invalid locale", async () => {
    const res = await GET(
      req("https://x/api/listings/live-abc/rewrite?locale=xx"),
      { params: Promise.resolve({ id: "live-abc" }) },
    )
    expect(res.status).toBe(400)
  })

  it("returns 404 when listing source cannot be loaded", async () => {
    mockLoadSource.mockResolvedValue(null)
    const res = await GET(
      req("https://x/api/listings/live-abc/rewrite?locale=en"),
      { params: Promise.resolve({ id: "live-abc" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns 204 for curated (non-live) listings", async () => {
    const res = await GET(
      req("https://x/api/listings/curated-abc/rewrite?locale=en"),
      { params: Promise.resolve({ id: "curated-abc" }) },
    )
    expect(res.status).toBe(204)
    expect(mockLoadSource).not.toHaveBeenCalled()
  })

  it("returns 200 with payload on success", async () => {
    mockLoadSource.mockResolvedValue({
      description_text: "desc", year: 2011, make: "Porsche", model: "911", trim: null,
      mileage: 1, mileage_unit: "mi", vin: null, color_exterior: null, color_interior: null,
      engine: null, transmission: null, body_style: null, location: null, platform: null,
    })
    mockRewrite.mockResolvedValue({
      headline: "h",
      highlights: ["a", "b"],
      promptVersion: "1.0.0",
      model: "gemini-2.5-flash",
      sourceHash: "deadbeef",
      generatedAt: "2026-04-21T00:00:00Z",
    })
    const res = await GET(
      req("https://x/api/listings/live-abc/rewrite?locale=en"),
      { params: Promise.resolve({ id: "live-abc" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ headline: "h", highlights: ["a", "b"] })
  })

  it("returns 204 when rewriter returns null", async () => {
    mockLoadSource.mockResolvedValue({
      description_text: null, year: 2011, make: "Porsche", model: "911", trim: null,
      mileage: null, mileage_unit: null, vin: null, color_exterior: null, color_interior: null,
      engine: null, transmission: null, body_style: null, location: null, platform: null,
    })
    mockRewrite.mockResolvedValue(null)
    const res = await GET(
      req("https://x/api/listings/live-abc/rewrite?locale=en"),
      { params: Promise.resolve({ id: "live-abc" }) },
    )
    expect(res.status).toBe(204)
  })

  it("returns 429 once the limit is exceeded for one IP", async () => {
    mockLoadSource.mockResolvedValue({
      description_text: "d", year: 2011, make: "Porsche", model: "911", trim: null,
      mileage: null, mileage_unit: null, vin: null, color_exterior: null, color_interior: null,
      engine: null, transmission: null, body_style: null, location: null, platform: null,
    })
    mockRewrite.mockResolvedValue({
      headline: "h", highlights: ["a", "b"],
      promptVersion: "1.0.0", model: "gemini-2.5-flash",
      sourceHash: "x", generatedAt: "t",
    })

    // Burn the bucket
    for (let i = 0; i < 10; i++) {
      await GET(
        req("https://x/api/listings/live-abc/rewrite?locale=en", "9.9.9.9"),
        { params: Promise.resolve({ id: "live-abc" }) },
      )
    }
    const res = await GET(
      req("https://x/api/listings/live-abc/rewrite?locale=en", "9.9.9.9"),
      { params: Promise.resolve({ id: "live-abc" }) },
    )
    expect(res.status).toBe(429)
  })

  it("returns 204 when LISTING_REWRITER_ENABLED is falsey", async () => {
    vi.stubEnv("LISTING_REWRITER_ENABLED", "false")
    const res = await GET(
      req("https://x/api/listings/live-abc/rewrite?locale=en"),
      { params: Promise.resolve({ id: "live-abc" }) },
    )
    expect(res.status).toBe(204)
    vi.stubEnv("LISTING_REWRITER_ENABLED", "true")
  })

  it("defaults to enabled in development when LISTING_REWRITER_ENABLED is unset", async () => {
    vi.stubEnv("LISTING_REWRITER_ENABLED", "")
    vi.stubEnv("NODE_ENV", "development")
    mockLoadSource.mockResolvedValue({
      description_text: "desc", year: 2011, make: "Porsche", model: "911", trim: null,
      mileage: 1, mileage_unit: "mi", vin: null, color_exterior: null, color_interior: null,
      engine: null, transmission: null, body_style: null, location: null, platform: null,
    })
    mockRewrite.mockResolvedValue({
      headline: "h",
      highlights: ["a", "b"],
      promptVersion: "1.0.0",
      model: "gemini-2.5-flash",
      sourceHash: "deadbeef",
      generatedAt: "2026-04-21T00:00:00Z",
    })

    const res = await GET(
      req("https://x/api/listings/live-abc/rewrite?locale=en"),
      { params: Promise.resolve({ id: "live-abc" }) },
    )
    expect(res.status).toBe(200)
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("LISTING_REWRITER_ENABLED", "true")
  })
})
