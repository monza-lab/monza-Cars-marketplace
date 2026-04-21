import { describe, it, expect, beforeEach, vi } from "vitest"

import richFixture from "./__fixtures__/listing-rewriter-rich.json"

// Mock skill loader
const mockLoadSkill = vi.fn()
vi.mock("./skills/loader", () => ({
  loadSkill: (...args: unknown[]) => mockLoadSkill(...args),
}))

// Mock generateJson
const mockGenerateJson = vi.fn()
vi.mock("./gemini", () => ({
  generateJson: (...args: unknown[]) => mockGenerateJson(...args),
}))

// Mock supabase service client
const mockSelect = vi.fn()
const mockUpsert = vi.fn()
vi.mock("./listingRewriterDb", () => ({
  readCachedRewrite: (...args: unknown[]) => mockSelect(...args),
  writeCachedRewrite: (...args: unknown[]) => mockUpsert(...args),
}))

import { rewriteListing } from "./listingRewriter"
import type { RewriterSource } from "./sourceHash"

const baseSource: RewriterSource = {
  description_text: "Two owners. Service history complete.",
  year: 2011, make: "Porsche", model: "911 GT3", trim: null,
  mileage: 9321, mileage_unit: "mi", vin: "WP0AC29911S693111",
  color_exterior: "Carrara White", color_interior: "Black",
  engine: "3.8L flat-six", transmission: "6-speed manual",
  body_style: "Coupe", location: "Japan", platform: "BEFORWARD",
}

function mockSkill() {
  mockLoadSkill.mockReturnValue({
    name: "listing-rewriter",
    version: "1.2.0",
    model: "gemini-2.5-flash-lite",
    temperature: 0.3,
    systemPrompt: "SYSTEM",
    userPromptTemplate: "Locale: {{locale}} Year: {{year}} Desc: {{description_text}}",
  })
}

describe("rewriteListing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSkill()
  })

  it("returns cached row when source_hash + prompt_version + model all match", async () => {
    const { computeSourceHash } = await import("./sourceHash")
    const expectedHash = computeSourceHash(baseSource)

    mockSelect.mockResolvedValue({
      headline: "cached",
      highlights: ["a", "b"],
      source_hash: expectedHash,
      prompt_version: "1.2.0",
      model: "gemini-2.5-flash-lite",
      generated_at: "2026-04-21T00:00:00Z",
    })

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })
    expect(res?.headline).toBe("cached")
    expect(mockGenerateJson).not.toHaveBeenCalled()
  })

  it("generates, validates, and upserts on cache miss", async () => {
    mockSelect.mockResolvedValue(null)
    mockGenerateJson.mockResolvedValue({ ok: true, data: richFixture, raw: "" })
    mockUpsert.mockResolvedValue(undefined)

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })

    expect(res).not.toBeNull()
    expect(res!.headline).toBe(richFixture.headline)
    expect(res!.highlights).toEqual(richFixture.highlights)
    expect(res!.promptVersion).toBe("1.2.0")
    expect(res!.model).toBe("gemini-2.5-flash-lite")
    expect(mockGenerateJson).toHaveBeenCalledOnce()
    expect(mockGenerateJson).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemini-2.5-flash-lite",
    }))
    expect(mockUpsert).toHaveBeenCalledOnce()
  })

  it("regenerates when prompt_version differs from cached row", async () => {
    mockSelect.mockResolvedValue({
      headline: "old",
      highlights: ["a", "b"],
      source_hash: "__ANY__",
      prompt_version: "0.9.0",   // mismatch
      model: "gemini-2.5-flash",
      generated_at: "2026-04-20T00:00:00Z",
    })
    mockGenerateJson.mockResolvedValue({ ok: true, data: richFixture, raw: "" })
    mockUpsert.mockResolvedValue(undefined)

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })
    expect(res!.headline).toBe(richFixture.headline)
    expect(mockGenerateJson).toHaveBeenCalledOnce()
  })

  it("substitutes placeholders in the user prompt", async () => {
    mockSelect.mockResolvedValue(null)
    mockGenerateJson.mockResolvedValue({ ok: true, data: richFixture, raw: "" })

    await rewriteListing({ listingId: "L1", locale: "es", source: baseSource })

    const call = mockGenerateJson.mock.calls[0]?.[0] as { userPrompt: string }
    expect(call.userPrompt).toContain("Locale: es")
    expect(call.userPrompt).toContain("Year: 2011")
    expect(call.userPrompt).toContain("Two owners. Service history complete.")
    expect(call.userPrompt).not.toContain("{{locale}}")
  })

  it("returns null when Gemini call errors", async () => {
    mockSelect.mockResolvedValue(null)
    mockGenerateJson.mockResolvedValue({ ok: false, error: "boom", raw: null })

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })
    expect(res).toBeNull()
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it("returns null when response fails schema validation", async () => {
    mockSelect.mockResolvedValue(null)
    mockGenerateJson.mockResolvedValue({
      ok: true,
      data: { headline: "", highlights: ["only one"] },
      raw: "",
    })

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })
    expect(res).toBeNull()
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it("returns null when DB read throws", async () => {
    mockSelect.mockRejectedValue(new Error("db down"))

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })
    expect(res).toBeNull()
  })

  it("returns the generated payload even if the DB write fails", async () => {
    mockSelect.mockResolvedValue(null)
    mockGenerateJson.mockResolvedValue({ ok: true, data: richFixture, raw: "" })
    mockUpsert.mockRejectedValue(new Error("write failed"))

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })
    expect(res).not.toBeNull()
    expect(res!.headline).toBe(richFixture.headline)
  })
})
