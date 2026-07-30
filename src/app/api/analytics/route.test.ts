import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ insert: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ from: () => ({ insert: mocks.insert }) }),
}))

import { POST } from "./route"

function analyticsRequest(body: unknown) {
  return new NextRequest("https://www.monzahaus.com/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("/api/analytics", () => {
  beforeEach(() => mocks.insert.mockResolvedValue({ error: null }))
  it("accepts report_viewed events from the report screen", async () => {
    const res = await POST(analyticsRequest({
      event: "report_viewed",
      payload: { listingId: "live-1", source: "report_page" },
    }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      event_name: "report_viewed",
      listing_id: "live-1",
    }))
  })
})
