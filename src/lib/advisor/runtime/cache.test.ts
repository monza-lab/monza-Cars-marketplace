import { describe, it, expect } from "vitest"
import { makeQueryCache } from "./cache"

describe("query cache", () => {
  it("returns the cached answer within TTL", () => {
    const c = makeQueryCache({ ttlMs: 60_000, max: 100 })
    c.set("u1", "key1", { content: "hello", toolCalls: [] })
    expect(c.get("u1", "key1")?.content).toBe("hello")
  })

  it("is scoped per user", () => {
    const c = makeQueryCache({ ttlMs: 60_000, max: 100 })
    c.set("u1", "key1", { content: "a", toolCalls: [] })
    expect(c.get("u2", "key1")).toBeUndefined()
  })

  it("evicts beyond max", () => {
    const c = makeQueryCache({ ttlMs: 60_000, max: 2 })
    c.set("u1", "a", { content: "A", toolCalls: [] })
    c.set("u1", "b", { content: "B", toolCalls: [] })
    c.set("u1", "c", { content: "C", toolCalls: [] })
    expect(c.get("u1", "a")).toBeUndefined()
  })

  it("expires after TTL", async () => {
    const c = makeQueryCache({ ttlMs: 5, max: 10 })
    c.set("u1", "x", { content: "X", toolCalls: [] })
    await new Promise(r => setTimeout(r, 20))
    expect(c.get("u1", "x")).toBeUndefined()
  })
})
