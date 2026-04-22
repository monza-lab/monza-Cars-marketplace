import { describe, it, expect } from "vitest"
import type { ToolInvocationContext } from "./registry"
import { knowledgeTools } from "./knowledge"

const ctx: ToolInvocationContext = {
  userId: "u1",
  anonymousSessionId: null,
  userTier: "FREE",
  locale: "en",
  conversationId: "c1",
}

function findTool(name: string) {
  const t = knowledgeTools.find((t) => t.name === name)
  if (!t) throw new Error(`tool ${name} not registered`)
  return t
}

describe("knowledge tools", () => {
  describe("get_series_profile", () => {
    it("returns a real Porsche series profile", async () => {
      const tool = findTool("get_series_profile")
      const res = await tool.handler({ seriesId: "997" }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.summary.length).toBeGreaterThan(0)
    })
    it("fails on unknown series", async () => {
      const tool = findTool("get_series_profile")
      const res = await tool.handler({ seriesId: "not-a-series" }, ctx)
      expect(res.ok).toBe(false)
    })
  })

  describe("list_knowledge_topics", () => {
    it("lists articles", async () => {
      const tool = findTool("list_knowledge_topics")
      const res = await tool.handler({}, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.summary).toMatch(/article/)
    })
  })

  describe("get_knowledge_article", () => {
    it("returns full article when slug exists", async () => {
      const tool = findTool("get_knowledge_article")
      const res = await tool.handler({ slug: "ims-bearing" }, ctx)
      expect(res.ok).toBe(true)
    })
    it("returns not_found for unknown slug", async () => {
      const tool = findTool("get_knowledge_article")
      const res = await tool.handler({ slug: "nope" }, ctx)
      expect(res.ok).toBe(false)
    })
  })

  describe("get_variant_details", () => {
    it("returns variant_not_in_corpus for missing entries", async () => {
      const tool = findTool("get_variant_details")
      const res = await tool.handler({ seriesId: "997", variantId: "gt3" }, ctx)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toMatch(/variant_not_in_corpus/)
    })
  })

  describe("get_inspection_checklist", () => {
    it("returns inspection checklist", async () => {
      const tool = findTool("get_inspection_checklist")
      const res = await tool.handler({ seriesId: "996" }, ctx)
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.summary).toMatch(/inspection points/)
    })
  })
})
