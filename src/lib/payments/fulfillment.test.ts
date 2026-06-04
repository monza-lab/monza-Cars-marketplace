import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  activateStripeSubscription: vi.fn(),
  getUserCredits: vi.fn(),
  grantStripePurchase: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
}))

vi.mock("@/lib/reports/queries", () => ({
  activateStripeSubscription: mocks.activateStripeSubscription,
  getUserCredits: mocks.getUserCredits,
  grantStripePurchase: mocks.grantStripePurchase,
}))

vi.mock("@/lib/payments/stripe", () => ({
  getStripeClient: () => ({
    subscriptions: {
      retrieve: mocks.subscriptionsRetrieve,
    },
  }),
}))

import { fulfillCheckoutSession } from "./fulfillment"

describe("fulfillCheckoutSession", () => {
  beforeEach(() => {
    mocks.activateStripeSubscription.mockReset()
    mocks.getUserCredits.mockReset()
    mocks.grantStripePurchase.mockReset()
    mocks.subscriptionsRetrieve.mockReset()
  })

  it("grants a paid top-up session to the metadata app user", async () => {
    mocks.getUserCredits.mockResolvedValue({ id: "credits-1" })
    mocks.grantStripePurchase.mockResolvedValue({ id: "credits-1", pack_credits_balance: 10000 })

    await fulfillCheckoutSession({
      id: "cs_paid",
      mode: "payment",
      payment_status: "paid",
      status: "complete",
      customer: "cus_123",
      metadata: {
        appUserId: "supabase-user-1",
        planId: "topup_heavy",
      },
    } as any)

    expect(mocks.getUserCredits).toHaveBeenCalledWith("supabase-user-1")
    expect(mocks.grantStripePurchase).toHaveBeenCalledWith(
      "credits-1",
      10000,
      "cs_paid",
      "topup_heavy",
      "cus_123",
    )
    expect(mocks.activateStripeSubscription).not.toHaveBeenCalled()
  })

  it("does not grant unpaid checkout sessions", async () => {
    await fulfillCheckoutSession({
      id: "cs_open",
      mode: "payment",
      payment_status: "unpaid",
      status: "open",
      customer: "cus_123",
      metadata: {
        appUserId: "supabase-user-1",
        planId: "topup_heavy",
      },
    } as any)

    expect(mocks.getUserCredits).not.toHaveBeenCalled()
    expect(mocks.grantStripePurchase).not.toHaveBeenCalled()
  })
})
