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
    expect(screen.getByText("1,000")).toBeInTheDocument()
    expect(screen.getByText("2,500")).toBeInTheDocument()
    expect(screen.getByText("10,000")).toBeInTheDocument()
    expect(screen.getByText("$13")).toBeInTheDocument()
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
    // Then click the Recargar CTA which uses onSelect
    fireEvent.click(screen.getByRole("button", { name: /recargar/i }))
    expect(onSelect).toHaveBeenCalledWith("topup_heavy")
  })

  it("shows the equivalence summary for the default preset (1,000 Pistons)", () => {
    renderWithIntl(<TopUpPresets onSelect={vi.fn()} />)
    // 1,000 Pistons → 1 report / 20 marketplace / 4 deep research
    // (calibrated so Heavy preset caps at 10 reports — see TopUpPresets.tsx)
    expect(screen.getByText(/1 reports/)).toBeInTheDocument()
    expect(screen.getByText(/20 marketplace/)).toBeInTheDocument()
    expect(screen.getByText(/4 deep research/)).toBeInTheDocument()
  })
})
