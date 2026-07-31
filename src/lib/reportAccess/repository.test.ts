import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  sendServerCapiEvent: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}))
vi.mock("@/lib/marketing/metaCapiServer", () => ({ sendServerCapiEvent: mocks.sendServerCapiEvent }))

import { requestLeadAccess, resolveReportToken } from "./repository"

describe("requestLeadAccess atomic reservation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("REPORT_ACCESS_SECRET", "test-secret")
    mocks.from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) })
  })

  it("uses the atomic RPC and never persists the raw access token", async () => {
    mocks.rpc.mockResolvedValue({ data: { code: "OK", lead_id: "lead-1" }, error: null })
    const result = await requestLeadAccess({
      email: "Buyer@Example.com",
      listingId: "live-1",
      deviceId: "device-123",
      ip: "1.2.3.4",
      attribution: { utm_source: "instagram", gclid: "click-1" },
    })
    expect(result).toEqual({ ok: true, token: expect.any(String), leadId: "lead-1" })
    expect(mocks.rpc).toHaveBeenCalledOnce()
    const [, args] = mocks.rpc.mock.calls[0]
    expect(args.p_token_hash).not.toBe(result.ok ? result.token : "")
    expect(args).toEqual(expect.objectContaining({
      p_email_normalized: "buyer@example.com",
      p_listing_id: "live-1",
      p_utm_source: "instagram",
      p_gclid: "click-1",
    }))
  })

  it.each(["AUTH_REQUIRED", "CLAIM_REQUIRED", "RATE_LIMITED"] as const)(
    "preserves the stable %s decision from the atomic RPC",
    async (code) => {
      mocks.rpc.mockResolvedValue({ data: { code }, error: null })
      await expect(requestLeadAccess({
        email: "buyer@example.com", listingId: "live-1", deviceId: "device-123", ip: "1.2.3.4",
      })).resolves.toEqual({ ok: false, code })
    },
  )
})

describe("resolveReportToken pending expiry", () => {
  function tokenRow(data: Record<string, unknown>) {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data }),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    mocks.from.mockReturnValue(query)
  }

  it("rejects an expired pending token even when pending access is allowed", async () => {
    tokenRow({ id: "a", lead_id: "l", listing_id: "live-1", status: "pending", revoked_at: null, pending_expires_at: "2020-01-01T00:00:00Z" })
    await expect(resolveReportToken("token", "live-1", true)).resolves.toBeNull()
  })

  it("keeps ready tokens durable regardless of the pending deadline", async () => {
    tokenRow({ id: "a", lead_id: "l", listing_id: "live-1", status: "ready", revoked_at: null, pending_expires_at: "2020-01-01T00:00:00Z" })
    await expect(resolveReportToken("token", "live-1", false)).resolves.toMatchObject({ status: "ready" })
  })
})
