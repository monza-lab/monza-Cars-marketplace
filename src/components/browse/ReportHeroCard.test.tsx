// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ReportHeroCard } from "./ReportHeroCard"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}))

describe("ReportHeroCard", () => {
  it("keeps the ad promise and real market proof above the grid", () => {
    render(<ReportHeroCard totalTracked={27_213} sampleReportUrl="https://example.com/team-report" />)

    expect(screen.getByRole("heading", { name: "Know what any Porsche is actually worth." })).toBeVisible()
    expect(screen.getByText("6 platforms · 4 markets · 27,213 cars tracked")).toBeVisible()
    expect(screen.getByRole("link", { name: "See a sample report" })).toHaveAttribute("href", "https://example.com/team-report")
  })

  it("uses the durable real sample route when no external sample URL is configured", () => {
    render(<ReportHeroCard totalTracked={1200} sampleReportUrl={null} />)

    expect(screen.getByRole("link", { name: "See a sample report" })).toHaveAttribute("href", "/sample-report")
  })
})
