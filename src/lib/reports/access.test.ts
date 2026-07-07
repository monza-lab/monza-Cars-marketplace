import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserCredits: vi.fn(),
  hasAlreadyGenerated: vi.fn(),
  hasUnlimitedReportAccess: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
  })),
}))

vi.mock("@/lib/reports/queries", () => ({
  getUserCredits: mocks.getUserCredits,
  hasAlreadyGenerated: mocks.hasAlreadyGenerated,
  hasUnlimitedReportAccess: mocks.hasUnlimitedReportAccess,
}))

import { checkReportAccess } from "./access"

describe("checkReportAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } } })
    mocks.getUserCredits.mockResolvedValue({
      id: "internal-user-1",
      supabase_user_id: "auth-user-1",
      tier: "FREE",
    })
    mocks.hasAlreadyGenerated.mockResolvedValue(false)
    mocks.hasUnlimitedReportAccess.mockReturnValue(false)
  })

  it("requires an authenticated user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })

    await expect(checkReportAccess("live-1")).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    })
  })

  it("allows a user who already generated the report", async () => {
    mocks.hasAlreadyGenerated.mockResolvedValue(true)

    await expect(checkReportAccess("live-1")).resolves.toEqual({
      ok: true,
      userId: "auth-user-1",
    })
    expect(mocks.hasAlreadyGenerated).toHaveBeenCalledWith("internal-user-1", "live-1")
  })

  it("allows a user with unlimited report access", async () => {
    mocks.hasUnlimitedReportAccess.mockReturnValue(true)

    await expect(checkReportAccess("live-1")).resolves.toEqual({
      ok: true,
      userId: "auth-user-1",
    })
  })

  it("forbids authenticated users without report entitlement", async () => {
    await expect(checkReportAccess("live-1")).resolves.toEqual({
      ok: false,
      reason: "forbidden",
    })
  })
})
