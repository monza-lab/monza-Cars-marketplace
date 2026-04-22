import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ToolInvocationContext } from "./registry"

const generateContent = vi.fn()

vi.mock("@google/generative-ai", () => {
  class GoogleGenerativeAI {
    constructor(_apiKey: string) {}
    getGenerativeModel(_opts: unknown) {
      return { generateContent }
    }
  }
  return { GoogleGenerativeAI }
})

import { premiumTools } from "./premium"

const ctx: ToolInvocationContext = {
  userId: "u1",
  anonymousSessionId: null,
  userTier: "PRO",
  locale: "en",
  conversationId: "c1",
}

function findTool(name: string) {
  const t = premiumTools.find((t) => t.name === name)
  if (!t) throw new Error(`tool ${name} not registered`)
  return t
}

describe("premium tools", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = "test-key"
  })

  describe("web_search", () => {
    it("returns grounded answer with sources", async () => {
      generateContent.mockResolvedValue({
        response: {
          text: () =>
            "The 997.2 GT3 uses the Mezger 3.8L. [source](https://porsche.com/gt3)\n\n## Sources\nhttps://porsche.com/gt3",
        },
      })
      const tool = findTool("web_search")
      const res = await tool.handler({ query: "what engine is in a 997.2 GT3" }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) {
        const data = res.data as { sources: string[] }
        expect(data.sources.length).toBeGreaterThan(0)
      }
    })

    it("surfaces gemini_tool_unavailable on unsupported tool error", async () => {
      generateContent.mockRejectedValue(new Error("googleSearchRetrieval is not a supported tool"))
      const tool = findTool("web_search")
      const res = await tool.handler({ query: "x" }, ctx)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toBe("gemini_tool_unavailable")
    })

    it("fails without API key", async () => {
      delete process.env.GEMINI_API_KEY
      const tool = findTool("web_search")
      const res = await tool.handler({ query: "x" }, ctx)
      expect(res.ok).toBe(false)
    })
  })

  describe("fetch_url", () => {
    it("summarizes a pasted URL", async () => {
      generateContent.mockResolvedValue({
        response: {
          text: () => "This listing is a 2011 997.2 GT3 with 25k miles in Aqua Blue Metallic.",
        },
      })
      const tool = findTool("fetch_url")
      const res = await tool.handler({ url: "https://bringatrailer.com/listing/x" }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) {
        const data = res.data as { url: string; sources: string[] }
        expect(data.url).toMatch(/bringatrailer/)
        expect(data.sources[0]).toMatch(/bringatrailer/)
      }
    })

    it("rejects non-http urls", async () => {
      const tool = findTool("fetch_url")
      const res = await tool.handler({ url: "ftp://example.com" }, ctx)
      expect(res.ok).toBe(false)
    })

    it("surfaces gemini_tool_unavailable when urlContext not supported", async () => {
      generateContent.mockRejectedValue(new Error("urlContext tool not supported"))
      const tool = findTool("fetch_url")
      const res = await tool.handler({ url: "https://example.com" }, ctx)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toBe("gemini_tool_unavailable")
    })
  })
})
