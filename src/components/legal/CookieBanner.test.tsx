// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CookieBanner } from "./CookieBanner"

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}))
vi.mock("./ConsentProvider", () => ({
  useConsent: () => ({ consent: "pending", accept: vi.fn(), reject: vi.fn() }),
}))
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: { div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div> },
}))

describe("CookieBanner interruption timing", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("keeps the first fold clear and appears after eight seconds", () => {
    render(<CookieBanner />)
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull()

    act(() => vi.advanceTimersByTime(8_000))

    expect(screen.getByRole("region", { name: "Cookie consent" })).toBeVisible()
  })

  it("appears after the visitor finishes their first scroll", () => {
    render(<CookieBanner />)
    act(() => window.dispatchEvent(new Event("scroll")))
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull()

    act(() => vi.advanceTimersByTime(600))

    expect(screen.getByRole("region", { name: "Cookie consent" })).toBeVisible()
  })
})
