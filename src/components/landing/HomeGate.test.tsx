// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { HomeGate } from "./HomeGate"

const AuthModalMock = vi.fn(() => null)
const LandingPageMock = vi.fn(() => <div data-testid="landing-page" />)
const ViewPreferenceRedirectMock = vi.fn(() => null)

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ user: null, loading: false }),
}))

vi.mock("./LandingPage", () => ({
  LandingPage: (props: Record<string, unknown>) => LandingPageMock(props),
}))

vi.mock("@/components/dashboard/DashboardClient", () => ({
  DashboardClient: () => <div data-testid="dashboard" />,
}))

vi.mock("@/components/layout/ViewPreferenceRedirect", () => ({
  ViewPreferenceRedirect: (props: Record<string, unknown>) => ViewPreferenceRedirectMock(props),
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

  it("derives landing counters from the server-fetched dashboard payload", () => {
    const data = {
      ...emptyData,
      auctions: [
        { id: "1", platform: "Bring a Trailer" },
        { id: "2", platform: "CollectingCars" },
        { id: "3", platform: "Bring a Trailer" },
      ],
      valuationListings: [{ id: "v1" }, { id: "v2" }],
      regionTotals: { all: 137, US: 70, UK: 0, EU: 60, JP: 7 },
      seriesCounts: { "911": 80, "964": 30, "997": 27, empty: 0 },
    }

    render(<HomeGate data={data as typeof emptyData} />)

    expect(LandingPageMock).toHaveBeenCalledWith({
      stats: { listings: 137, regions: 3, sources: 2, seriesTracked: 3 },
    })
  })

  it("applies the marketplace preference redirect to first-time landing visitors", () => {
    render(<HomeGate data={emptyData} />)

    expect(screen.getByTestId("landing-page")).toBeInTheDocument()
    expect(ViewPreferenceRedirectMock).toHaveBeenCalledWith({ current: "monza" })
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
