import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/ai/gemini", () => ({
  generateJson: vi.fn(),
}))

import { generateTitle } from "./titleGen"
import { generateJson } from "@/lib/ai/gemini"

describe("generateTitle", () => {
  it("returns the model-produced title trimmed to 80 chars", async () => {
    vi.mocked(generateJson).mockResolvedValueOnce({ ok: true, data: { title: "997.2 GT3 overview" }, raw: "" })
    const title = await generateTitle("what is a 997.2 GT3", "The 997.2 GT3 is a Mezger-engined GT car.", "en")
    expect(title).toBe("997.2 GT3 overview")
  })

  it("falls back to a truncated user message when the model errors", async () => {
    vi.mocked(generateJson).mockResolvedValueOnce({ ok: false, error: "boom", raw: "" })
    const title = await generateTitle("tell me about the 996 GT3 market over the last 5 years please", "assistant text", "en")
    expect(title.length).toBeLessThanOrEqual(40)
    expect(title.startsWith("tell me about the 996")).toBe(true)
  })
})
