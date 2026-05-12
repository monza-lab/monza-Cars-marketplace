// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import enMessages from "../../../messages/en.json"
import { TopUpPresets } from "./TopUpPresets"
import type { PlanId } from "@/lib/payments/plans"

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe("TopUpPresets", () => {
  it("renders the 3 visible top-ups with correct Pistons and prices", () => {
    renderWithIntl(<TopUpPresets onSelect={vi.fn()} />)
    // After UI rework: price is the dominant element, Pistons amount
    // is the descriptor below ("1,000 Pistons" lives in one node).
    expect(screen.getAllByText(/1,000 Pistons/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/2,500 Pistons/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/10,000 Pistons/i).length).toBeGreaterThan(0)
    // $13 appears both in its preset card and in the "Selected" summary
    // when it's the default — use getAllByText.
    expect(screen.getAllByText("$13").length).toBeGreaterThan(0)
    expect(screen.getByText("$30")).toBeInTheDocument()
    expect(screen.getByText("$99")).toBeInTheDocument()
  })

  it("defaults to the first preset selected", () => {
    renderWithIntl(<TopUpPresets onSelect={vi.fn()} />)
    const firstButton = screen.getByRole("button", { name: /1,000 Pistons/i })
    expect(firstButton.getAttribute("aria-pressed")).toBe("true")
  })

  it("invokes onSelect when the primary CTA is clicked after selecting Heavy", () => {
    const onSelect = vi.fn<(id: PlanId) => void>()
    renderWithIntl(<TopUpPresets onSelect={onSelect} />)
    // Click the Heavy preset card first (to set selection)
    fireEvent.click(screen.getByRole("button", { name: /10,000 Pistons/i }))
    // Then click the Top up CTA which uses onSelect
    fireEvent.click(screen.getByRole("button", { name: /top up/i }))
    expect(onSelect).toHaveBeenCalledWith("topup_heavy")
  })

  it("shows the equivalence summary for the default preset (1,000 Pistons)", () => {
    renderWithIntl(<TopUpPresets onSelect={vi.fn()} />)
    // 1,000 Pistons → 1 report (singular) / 4 comparisons / 100 chats.
    // Marketplace search is free, so it doesn't appear in the equivalence.
    expect(screen.getByText(/1 report\b/)).toBeInTheDocument()
    expect(screen.getByText(/4 comparisons/)).toBeInTheDocument()
    expect(screen.getByText(/100 chats/)).toBeInTheDocument()
  })
})
