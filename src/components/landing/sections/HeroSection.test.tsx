// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { HeroSection } from "./HeroSection"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const copy: Record<string, string> = {
      eyebrow: "Collector intelligence",
      headline: "Know the market",
      subline: "Three reports to start",
      cta: "Explore the Market",
      ctaSecondary: "Start with 3 Free Reports",
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

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}))

describe("HeroSection", () => {
  it("makes the free reports signup path the primary hero CTA", () => {
    render(<HeroSection />)

    const links = screen.getAllByRole("link")
    expect(links[0]).toHaveAccessibleName("Start with 3 Free Reports")
    expect(links[0]).toHaveAttribute("href", "/get-started")
    expect(links[1]).toHaveAccessibleName("Explore the Market")
    expect(links[1]).toHaveAttribute("href", "/browse")
  })

  it("scrolls to the next landing section from the chevron control", () => {
    render(<HeroSection />)

    expect(screen.getByRole("button", { name: /scroll to next section/i })).toBeInTheDocument()
  })
})
