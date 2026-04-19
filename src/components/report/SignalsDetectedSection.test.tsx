// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { SignalsDetectedSection } from "./SignalsDetectedSection"
import mock from "@/lib/fairValue/__fixtures__/992-gt3-pts-mock.json"
import enMessages from "@/../messages/en.json"
import type { HausReport } from "@/lib/fairValue/types"

function renderWithIntl(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {node}
    </NextIntlClientProvider>
  )
}

describe("SignalsDetectedSection", () => {
  it("renders every detected signal from the fixture", () => {
    const report = mock as HausReport
    renderWithIntl(<SignalsDetectedSection signals={report.signals_detected} />)
    for (const signal of report.signals_detected) {
      expect(screen.getByText(signal.value_display)).toBeInTheDocument()
    }
  })

  it("shows empty state when no signals detected", () => {
    renderWithIntl(<SignalsDetectedSection signals={[]} />)
    expect(screen.getByText(/no signals extracted/i)).toBeInTheDocument()
  })
})
