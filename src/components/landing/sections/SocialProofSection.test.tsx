// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SocialProofSection } from "./SocialProofSection"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("@/hooks/useScrollReveal", () => ({
  useScrollReveal: () => ({ ref: { current: null }, isVisible: false }),
}))

describe("SocialProofSection", () => {
  it("renders server-derived dashboard counters immediately instead of initial zeroes", () => {
    render(
      <SocialProofSection
        stats={{ listings: 137, regions: 3, sources: 6, seriesTracked: 42 }}
      />,
    )

    expect(screen.getByText(/^137/)).toBeInTheDocument()
    expect(screen.getByText(/^3regions/)).toBeInTheDocument()
    expect(screen.getByText(/^6sources/)).toBeInTheDocument()
    expect(screen.getByText(/^42seriesTracked/)).toBeInTheDocument()
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })
})
