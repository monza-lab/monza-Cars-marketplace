import { describe, it, expect, beforeEach, vi } from "vitest"
import { mintAnonymousSession, verifyAnonymousSession } from "./anon-session"

beforeEach(() => { vi.stubEnv("ADVISOR_ANON_SECRET", "test-secret-min-32-chars-xxxxxxxxxxxx") })

describe("anonymous session cookie", () => {
  it("mints a value that verifyAnonymousSession accepts", () => {
    const value = mintAnonymousSession()
    const verified = verifyAnonymousSession(value)
    expect(verified).not.toBeNull()
    expect(typeof verified).toBe("string")
    expect(verified!.length).toBeGreaterThan(10)
  })

  it("rejects tampered cookies", () => {
    const v = mintAnonymousSession()
    expect(verifyAnonymousSession(v.slice(0, -2) + "xx")).toBeNull()
  })

  it("falls back to unsigned ids when the secret is missing", () => {
    vi.stubEnv("ADVISOR_ANON_SECRET", "")
    const value = mintAnonymousSession()
    expect(value).not.toContain(".")
    expect(verifyAnonymousSession(value)).toBe(value)
    expect(verifyAnonymousSession(`${value}.legacy.sig`)).toBe(value)
  })
})
