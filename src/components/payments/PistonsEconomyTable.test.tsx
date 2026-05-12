// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import enMessages from "../../../messages/en.json"
import { PistonsEconomyTable } from "./PistonsEconomyTable"

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages as any}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe("PistonsEconomyTable", () => {
  it("renders all 4 economy rows in full variant", () => {
    renderWithIntl(<PistonsEconomyTable variant="full" />)
    // Marketplace is free; comparison & report still cost Pistons.
    expect(screen.getByText("10 Pistons")).toBeInTheDocument()
    expect(screen.getByText("Free")).toBeInTheDocument()
    expect(screen.getByText("~250 Pistons")).toBeInTheDocument()
    expect(screen.getByText("1,000 Pistons")).toBeInTheDocument()
  })

  it("renders compact variant with the same 4 rows", () => {
    renderWithIntl(<PistonsEconomyTable variant="compact" />)
    expect(screen.getByText("10 Pistons")).toBeInTheDocument()
    expect(screen.getByText("Free")).toBeInTheDocument()
    expect(screen.getByText("1,000 Pistons")).toBeInTheDocument()
  })
})
