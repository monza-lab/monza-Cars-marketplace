import { describe, expect, it } from "vitest"

import { shouldMountWelcomeModal } from "./WelcomeModal"

describe("shouldMountWelcomeModal", () => {
  it.each([
    ["/", false],
    ["/en", false],
    ["/es", false],
    ["/en/get-started", false],
    ["/de/get-started", false],
    ["/en/cars/porsche", true],
    ["/cars/porsche/live-123", false],
    ["/en/cars/porsche/live-123", false],
    ["/en/cars/porsche/live-123/report", false],
    ["/en/account", true],
  ])("returns %s -> %s", (pathname, expected) => {
    expect(shouldMountWelcomeModal(pathname)).toBe(expected)
  })
})
