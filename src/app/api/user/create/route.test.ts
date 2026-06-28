import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getOrCreateUser: vi.fn(),
  getOrCreateUserWithStatus: vi.fn(),
  sendServerCapiEvent: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
  })),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}))

vi.mock("@/lib/reports/queries", () => ({
  DEFAULT_MONTHLY_PISTONS: 3000,
  getOrCreateUser: mocks.getOrCreateUser,
  getOrCreateUserWithStatus: mocks.getOrCreateUserWithStatus,
}))

vi.mock("@/lib/advisor/persistence/anon-session", () => ({
  AnonSessionCookie: { name: "monza_advisor_anon" },
  verifyAnonymousSession: vi.fn(() => null),
}))

vi.mock("@/lib/advisor/persistence/conversations", () => ({
  mergeAnonymousToUser: vi.fn(),
}))

vi.mock("@/lib/marketing/metaCapiServer", () => ({
  sendServerCapiEvent: mocks.sendServerCapiEvent,
}))

const profile = {
  id: "credits-1",
  supabase_user_id: "user-1",
  email: "buyer@example.com",
  display_name: "Buyer",
  credits_balance: 3000,
  pack_credits_balance: 0,
  free_credits_used: 0,
  tier: "FREE",
  credit_reset_date: "2026-06-29T00:00:00.000Z",
  subscription_period_end: null,
  subscription_plan_key: null,
  monthly_allowance_pistons: 3000,
  unlimited_reports: false,
}

function request() {
  return new NextRequest("https://www.monzahaus.com/api/user/create", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer token-1",
    },
    body: JSON.stringify({ name: "Buyer" }),
  })
}

describe("/api/user/create", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "buyer@example.com",
          user_metadata: { full_name: "Buyer" },
        },
      },
      error: null,
    })
    mocks.getOrCreateUser.mockResolvedValue(profile)
    mocks.getOrCreateUserWithStatus.mockResolvedValue({ profile, created: true })
    mocks.sendServerCapiEvent.mockResolvedValue(undefined)
  })

  it("sends CompleteRegistration to Meta CAPI after creating a profile", async () => {
    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(mocks.sendServerCapiEvent).toHaveBeenCalledWith({
      eventName: "CompleteRegistration",
      eventId: "complete_registration_user-1",
      eventSourceUrl: "https://www.monzahaus.com/api/user/create",
      email: "buyer@example.com",
      externalId: "user-1",
      customData: {
        content_name: "free_signup",
        status: "completed",
      },
    })
  })
})
