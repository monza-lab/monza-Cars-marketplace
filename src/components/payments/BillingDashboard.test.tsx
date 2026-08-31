// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { BillingDashboard } from "./BillingDashboard"

const refreshProfile = vi.fn()
let profile: {
  creditsBalance: number
  packCreditsBalance: number
  tier: string
  unlimitedReports: boolean
  subscriptionPlanKey: string | null
  subscriptionPeriodEnd: string | null
} = {
  creditsBalance: 10000,
  packCreditsBalance: 0,
  tier: "PRO",
  unlimitedReports: true,
  subscriptionPlanKey: "rennsport",
  subscriptionPeriodEnd: "2026-07-04T00:00:00.000Z",
}

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({
    refreshProfile,
    profile,
  }),
}))

vi.mock("./TransactionHistory", () => ({
  TransactionHistory: () => <div>Transaction history</div>,
}))

describe("BillingDashboard", () => {
  it("shows PRO subscriptions as Monthly unlimited reports", () => {
    render(<BillingDashboard />)

    expect(screen.getByText("Unlimited")).toBeInTheDocument()
    expect(screen.getByText("Monthly")).toBeInTheDocument()
    expect(screen.getByText(/Unlimited reports/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Cancel Subscription/i })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Upgrade/i })).not.toBeInTheDocument()
  })

  it("describes free Pistons as a one-time introductory allowance", () => {
    profile = {
      creditsBalance: 3000,
      packCreditsBalance: 0,
      tier: "FREE",
      unlimitedReports: false,
      subscriptionPlanKey: null,
      subscriptionPeriodEnd: null,
    }
    render(<BillingDashboard />)

    expect(screen.getByText("Introductory allowance")).toBeInTheDocument()
    expect(screen.queryByText(/Free monthly/i)).not.toBeInTheDocument()
  })
})
