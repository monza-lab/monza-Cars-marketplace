import { describe, it, expect } from "vitest"
import { createToolRegistry, type ToolHandler } from "./registry"

const handler: ToolHandler = async () => ({ ok: true, summary: "noop", data: {} })

describe("toolRegistry", () => {
  it("filters tools by user tier", () => {
    const reg = createToolRegistry()
    reg.register({ name: "freeTool", description: "", minTier: "FREE", parameters: { type: "object", properties: {} }, handler })
    reg.register({ name: "proTool",  description: "", minTier: "PRO",  parameters: { type: "object", properties: {} }, handler })
    expect(reg.listForTier("FREE").map(t => t.name)).toEqual(["freeTool"])
    expect(reg.listForTier("PRO").map(t => t.name).sort()).toEqual(["freeTool","proTool"])
  })

  it("refuses to invoke a tool above the caller's tier", async () => {
    const reg = createToolRegistry()
    reg.register({ name: "proTool", description: "", minTier: "PRO", parameters: { type: "object", properties: {} }, handler })
    const res = await reg.invoke("proTool", {}, "FREE", {} as any)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/upgrade/i)
  })
})
