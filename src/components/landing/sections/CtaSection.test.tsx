// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { CtaSection } from "./CtaSection"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const copy: Record<string, string> = {
      headline: "Your first report is waiting",
      subline: "Start with three reports",
      primary: "Explore the Market",
      secondary: "Start with 3 Free Reports",
      reassurance: "No card required",
    }
    return copy[key] ?? key
  },
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string
    children: React.ReactNode
    className?: string
    onClick?: () => void
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}))

vi.mock("@/hooks/useScrollReveal", () => ({
  useScrollReveal: () => ({ ref: { current: null }, isVisible: true }),
}))

describe("CtaSection", () => {
  it("makes the free reports signup path the primary final CTA", () => {
    render(<CtaSection />)

    const links = screen.getAllByRole("link")
    expect(links[0]).toHaveAccessibleName("Start with 3 Free Reports")
    expect(links[0]).toHaveAttribute("href", "/get-started")
    expect(links[1]).toHaveAccessibleName("Explore the Market")
    expect(links[1]).toHaveAttribute("href", "/browse")
  })
})
