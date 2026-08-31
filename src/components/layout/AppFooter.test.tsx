// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AppFooter } from "./AppFooter"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}))

describe("AppFooter", () => {
  it("clears the fixed mobile navigation so legal links remain readable", () => {
    render(<AppFooter />)

    expect(screen.getByRole("contentinfo")).toHaveClass("pb-24", "md:pb-3")
    expect(screen.getByRole("link", { name: "privacy" })).toBeVisible()
    expect(screen.getByRole("link", { name: "terms" })).toBeVisible()
  })
})
