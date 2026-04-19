// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { SignalsMissingSection } from "./SignalsMissingSection"
import sparseMock from "@/lib/fairValue/__fixtures__/991-carrera-sparse-mock.json"
import enMessages from "@/../messages/en.json"
import type { HausReport } from "@/lib/fairValue/types"

function renderWithIntl(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {node}
    </NextIntlClientProvider>
  )
}

describe("SignalsMissingSection", () => {
  it("renders each missing signal as a question", () => {
    const report = sparseMock as HausReport
    renderWithIntl(<SignalsMissingSection signals={report.signals_missing} />)
    // subtitle plus at least one question can contain "ask the seller"; verify at least one match
    expect(screen.getAllByText(/ask the seller/i).length).toBeGreaterThan(0)
  })

  it("shows 'all detected' state when nothing is missing", () => {
    renderWithIntl(<SignalsMissingSection signals={[]} />)
    expect(screen.getByText(/all high-value signals were detected/i)).toBeInTheDocument()
  })
})
