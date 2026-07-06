// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import enMessages from "../../../messages/en.json"
import { SubRecommendationCard } from "./SubRecommendationCard"

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe("SubRecommendationCard", () => {
  it("renders Genshpod as unlimited reports at $59/mo", () => {
    renderWithIntl(<SubRecommendationCard onSubscribe={vi.fn()} />)
    expect(screen.getByText("Genshpod")).toBeInTheDocument()
    expect(screen.getByText(/\$59/)).toBeInTheDocument()
    expect(screen.getByText(/Unlimited reports/i)).toBeInTheDocument()
    expect(screen.queryByText(/10,000 Pistons every month/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Most popular/i)).toBeInTheDocument()
  })

  it("invokes onSubscribe when CTA is clicked", () => {
    const onSubscribe = vi.fn()
    renderWithIntl(<SubRecommendationCard onSubscribe={onSubscribe} />)
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }))
    expect(onSubscribe).toHaveBeenCalledTimes(1)
  })
})
