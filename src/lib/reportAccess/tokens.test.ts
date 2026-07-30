import { describe, expect, it } from "vitest"
import { createAccessToken, hashAccessToken, hashIdentifier } from "./tokens"

describe("report access tokens", () => {
  it("creates an opaque token and a stable one-way hash", () => {
    const token = createAccessToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/)
    expect(hashAccessToken(token)).toHaveLength(64)
    expect(hashAccessToken(token)).toBe(hashAccessToken(token))
    expect(hashAccessToken(token)).not.toContain(token)
  })

  it("hashes abuse identifiers with the configured secret", () => {
    expect(hashIdentifier("1.2.3.4", "secret-a")).toBe(hashIdentifier("1.2.3.4", "secret-a"))
    expect(hashIdentifier("1.2.3.4", "secret-a")).not.toBe(hashIdentifier("1.2.3.4", "secret-b"))
  })
})
