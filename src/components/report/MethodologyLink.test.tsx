// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MethodologyLink } from "./MethodologyLink"

// Mock next/link because it requires the Next.js runtime context
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

describe("MethodologyLink", () => {
  it("renders link to /methodology by default", () => {
    render(<MethodologyLink />)
    const link = screen.getByRole("link")
    expect(link.getAttribute("href")).toBe("/methodology")
    expect(screen.getByText(/How we compute/)).toBeInTheDocument()
  })

  it("supports custom href", () => {
    render(<MethodologyLink href="/en/methodology" />)
    expect(screen.getByRole("link").getAttribute("href")).toBe("/en/methodology")
  })
})
