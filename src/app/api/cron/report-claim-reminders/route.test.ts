import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ sendClaimReminders: vi.fn() }))
vi.mock("@/lib/reportAccess/reminders", () => ({ sendClaimReminders: mocks.sendClaimReminders }))
import { GET } from "./route"

describe("report claim reminder cron", () => {
  beforeEach(() => { process.env.CRON_SECRET = "secret"; mocks.sendClaimReminders.mockResolvedValue({ sent: 2, failed: 0 }) })
  it("rejects unauthorized calls", async () => {
    expect((await GET(new NextRequest("https://x/api/cron/report-claim-reminders"))).status).toBe(401)
  })
  it("sends due reminders once", async () => {
    const response = await GET(new NextRequest("https://x/api/cron/report-claim-reminders", { headers: { authorization: "Bearer secret" } }))
    await expect(response.json()).resolves.toEqual({ ok: true, sent: 2, failed: 0 })
  })
})
