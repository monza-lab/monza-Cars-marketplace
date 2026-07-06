// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { HomeGate } from "./HomeGate"

const AuthModalMock = vi.fn((_props: Record<string, unknown>) => null)

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ user: null, loading: false }),
}))

vi.mock("./LandingPage", () => ({
  LandingPage: () => <div data-testid="landing-page" />,
}))

vi.mock("@/components/dashboard/DashboardClient", () => ({
  DashboardClient: () => <div data-testid="dashboard" />,
}))

vi.mock("@/components/layout/ViewPreferenceRedirect", () => ({
  ViewPreferenceRedirect: () => null,
}))

vi.mock("@/components/shared/MonzaInfinityLoader", () => ({
  MonzaInfinityLoader: () => <div data-testid="loader" />,
}))

vi.mock("@/components/auth/AuthModal", () => ({
  AuthModal: (props: Record<string, unknown>) => AuthModalMock(props),
}))

const emptyData = {
  auctions: [],
  valuationListings: [],
  regionalValByFamily: {},
  liveNow: 0,
  regionTotals: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 },
  seriesCounts: {},
  seriesCountsByRegion: { all: {}, US: {}, UK: {}, EU: {}, JP: {} },
}

describe("HomeGate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it("shows a visible recovery path for failed email confirmation", () => {
    render(<HomeGate data={emptyData} authError="confirmation_failed" />)

    expect(screen.getByText(/email link expired or could not be confirmed/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /resend or try again/i }))

    expect(AuthModalMock).toHaveBeenLastCalledWith(expect.objectContaining({
      open: true,
      defaultMode: "signup",
    }))
  })
})
