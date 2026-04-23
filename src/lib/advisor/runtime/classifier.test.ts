import { describe, it, expect, vi } from "vitest"
import { classifyRequest } from "./classifier"

vi.mock("@/lib/ai/gemini", () => ({
  generateJson: vi.fn(),
}))
const { generateJson } = await import("@/lib/ai/gemini")

describe("classifyRequest", () => {
  it("returns instant for a pure knowledge question", async () => {
    ;(generateJson as any).mockResolvedValue({ ok: true, data: { tier: "instant", reason: "pure knowledge lookup" }, raw: "" })
    const r = await classifyRequest({ userText: "What's an IMS bearing?", hasCarContext: false, userTier: "FREE" })
    expect(r.tier).toBe("instant")
    expect(r.estimatedPistons).toBe(1)
  })

  it("returns marketplace for a per-car valuation question", async () => {
    ;(generateJson as any).mockResolvedValue({ ok: true, data: { tier: "marketplace", reason: "needs listing + valuation tools" }, raw: "" })
    const r = await classifyRequest({ userText: "Is this car fairly priced?", hasCarContext: true, userTier: "FREE" })
    expect(r.tier).toBe("marketplace")
    expect(r.estimatedPistons).toBe(5)
  })

  it("downgrades deep_research to marketplace for FREE users", async () => {
    ;(generateJson as any).mockResolvedValue({ ok: true, data: { tier: "deep_research", reason: "multi-car shortlist" }, raw: "" })
    const r = await classifyRequest({ userText: "Build me a shortlist of clean 997.2 GT3s", hasCarContext: false, userTier: "FREE" })
    expect(r.tier).toBe("marketplace")
    expect(r.downgradedFromDeepResearch).toBe(true)
  })

  it("falls back to marketplace (not instant) on classifier failure", async () => {
    ;(generateJson as any).mockResolvedValue({ ok: false, error: "gemini_503" })
    const r = await classifyRequest({ userText: "Is this fairly priced at 95k?", hasCarContext: true, userTier: "FREE" })
    expect(r.tier).toBe("marketplace")
    expect(r.estimatedPistons).toBe(5)
  })

  it("falls back to deep_research on classifier failure when the request clearly asks for a shortlist", async () => {
    ;(generateJson as any).mockResolvedValue({ ok: false, error: "GEMINI_API_KEY is not configured" })
    const r = await classifyRequest({ userText: "Build me a shortlist of clean 997.2 GT3s in Europe under 180k", hasCarContext: false, userTier: "PRO" })
    expect(r.tier).toBe("deep_research")
    expect(r.estimatedPistons).toBe(25)
  })
})
