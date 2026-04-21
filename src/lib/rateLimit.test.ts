import { describe, it, expect, beforeEach, vi } from "vitest"
import { createRateLimiter } from "./rateLimit"

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-21T00:00:00Z"))
  })

  it("allows up to N requests within the window", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 })
    expect(limiter.check("1.1.1.1")).toEqual({ allowed: true, remaining: 2 })
    expect(limiter.check("1.1.1.1")).toEqual({ allowed: true, remaining: 1 })
    expect(limiter.check("1.1.1.1")).toEqual({ allowed: true, remaining: 0 })
  })

  it("rejects the (N+1)th request within the window", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 })
    limiter.check("1.1.1.1")
    limiter.check("1.1.1.1")
    const res = limiter.check("1.1.1.1")
    expect(res.allowed).toBe(false)
    expect(res.remaining).toBe(0)
  })

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })
    expect(limiter.check("1.1.1.1").allowed).toBe(true)
    expect(limiter.check("2.2.2.2").allowed).toBe(true)
    expect(limiter.check("1.1.1.1").allowed).toBe(false)
  })

  it("forgets requests older than the window", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })
    expect(limiter.check("1.1.1.1").allowed).toBe(true)
    vi.advanceTimersByTime(61_000)
    expect(limiter.check("1.1.1.1").allowed).toBe(true)
  })
})
