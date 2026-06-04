// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ReportSummaryRail } from "./ReportSummaryRail"
import type { CollectorCar } from "@/lib/curatedCars"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("@/components/dashboard/cards/SafeImage", () => ({
  SafeImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

const car = {
  id: "target",
  make: "Porsche",
  model: "911 GT3",
  title: "2022 Porsche 911 GT3",
  year: 2022,
  currentBid: 200000,
  price: 200000,
  fairValueByRegion: { US: { low: 190000, high: 210000 } },
} as CollectorCar

describe("ReportSummaryRail", () => {
  it("keeps valuation summary but hides peer list copy when no strict peers exist", () => {
    render(
      <ReportSummaryRail
        car={car}
        verdict="buy"
        fairValueLow={190000}
        fairValueHigh={210000}
        fairValueMid={200000}
        askingPrice={200000}
        formatPrice={(n) => `$${n.toLocaleString()}`}
        similarCars={[]}
        makeSlug="porsche"
      />,
    )

    expect(screen.getAllByText("Verdict").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Fair Value").length).toBeGreaterThan(0)
    expect(screen.queryByText("Peer comparables surface during the full analysis.")).toBeNull()
    expect(screen.queryByText("Similar at this price")).toBeNull()
    expect(screen.queryByText("Live same-model listings")).toBeNull()
  })

  it("labels populated peers as live same-model listings", () => {
    render(
      <ReportSummaryRail
        car={car}
        verdict="buy"
        fairValueLow={190000}
        fairValueHigh={210000}
        fairValueMid={200000}
        askingPrice={200000}
        formatPrice={(n) => `$${n.toLocaleString()}`}
        similarCars={Array.from({ length: 5 }, (_, index) => ({
          car: {
            ...car,
            id: `peer-${index}`,
            year: 2021 + index,
            title: `202${index} Porsche 911 GT3`,
          },
          score: 100,
          matchReasons: ["Same model variant"],
        }))}
        makeSlug="porsche"
      />,
    )

    expect(screen.getByText("Live same-model listings")).toBeTruthy()
    expect(screen.getByText("2021 911 GT3")).toBeTruthy()

    const viewAllLink = screen.getByText("View all same-model listings").closest("a")
    expect(viewAllLink?.getAttribute("href")).toBe("/browse?query=Porsche+911+GT3")
    expect(viewAllLink?.getAttribute("href")).not.toContain("series=")
    expect(viewAllLink?.getAttribute("href")).not.toContain("priceMin=")
    expect(viewAllLink?.getAttribute("href")).not.toContain("priceMax=")
  })
})
