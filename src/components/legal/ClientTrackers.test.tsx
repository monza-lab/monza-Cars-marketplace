// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  consent: "pending" as "pending" | "accepted" | "rejected",
  pathname: "/browse",
  captureAttributionFromBrowser: vi.fn(),
  track: vi.fn(),
}))

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }))
vi.mock("next/script", () => ({ default: () => null }))
vi.mock("@vercel/analytics/react", () => ({ Analytics: () => null }))
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => null }))
vi.mock("./ConsentProvider", () => ({ useConsent: () => ({ consent: mocks.consent }) }))
vi.mock("@/lib/marketing/attribution", () => ({
  captureAttributionFromBrowser: mocks.captureAttributionFromBrowser,
  readStoredAttribution: () => null,
}))
vi.mock("@/lib/analytics/events", () => ({ track: mocks.track }))

import { ClientTrackers } from "./ClientTrackers"

beforeEach(() => {
  mocks.consent = "pending"
  mocks.pathname = "/browse"
  mocks.captureAttributionFromBrowser.mockReset()
  mocks.track.mockReset()
})

it.each(["pending", "rejected"] as const)(
  "captures first-touch attribution while analytics consent is %s",
  async (consent) => {
    mocks.consent = consent
    render(<ClientTrackers />)
    await waitFor(() => expect(mocks.captureAttributionFromBrowser).toHaveBeenCalledOnce())
  },
)

it("tracks browse entry when the pathname contains a locale prefix", async () => {
  mocks.consent = "accepted"
  mocks.pathname = "/en/browse"
  render(<ClientTrackers />)
  await waitFor(() => expect(mocks.track).toHaveBeenCalledWith({
    event: "visit_landed",
    payload: expect.objectContaining({ source: "direct" }),
  }))
})

it("tracks browse entry with a trailing slash", async () => {
  mocks.consent = "accepted"
  mocks.pathname = "/browse/"
  render(<ClientTrackers />)
  await waitFor(() => expect(mocks.track).toHaveBeenCalledWith(expect.objectContaining({ event: "visit_landed" })))
})
