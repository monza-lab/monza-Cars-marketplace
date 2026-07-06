// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { BillingDashboard } from "./BillingDashboard"

const refreshProfile = vi.fn()

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({
    refreshProfile,
    profile: {
      creditsBalance: 10000,
      packCreditsBalance: 0,
      tier: "PRO",
      unlimitedReports: true,
      subscriptionPlanKey: "rennsport",
      subscriptionPeriodEnd: "2026-07-04T00:00:00.000Z",
    },
  }),
}))

vi.mock("./TransactionHistory", () => ({
  TransactionHistory: () => <div>Transaction history</div>,
}))

describe("BillingDashboard", () => {
  it("shows PRO subscriptions as Genshpod unlimited reports", () => {
    render(<BillingDashboard />)

    expect(screen.getByText("Unlimited")).toBeInTheDocument()
    expect(screen.getByText("Genshpod")).toBeInTheDocument()
    expect(screen.getByText(/Unlimited reports/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Cancel Subscription/i })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Upgrade/i })).not.toBeInTheDocument()
  })
})
