// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { HausReportTeaser } from "./HausReportTeaser"
import enMessages from "@/../messages/en.json"

function renderWithIntl(node: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={enMessages}>{node}</NextIntlClientProvider>)
}

describe("HausReportTeaser", () => {
  it("shows 'Generate' CTA when no report exists", () => {
    const onClick = vi.fn()
    renderWithIntl(<HausReportTeaser reportExists={false} userAlreadyPaid={false} onClick={onClick} />)
    expect(screen.getByRole("button", { name: /generate haus report/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("shows 'View' CTA when report exists (user has not paid)", () => {
    renderWithIntl(<HausReportTeaser reportExists={true} userAlreadyPaid={false} onClick={() => {}} />)
    expect(screen.getByRole("button", { name: /view haus report/i })).toBeInTheDocument()
    expect(screen.getByText(/already generated/i)).toBeInTheDocument()
  })

  it("shows 'View' CTA and no cached copy when user already paid", () => {
    renderWithIntl(<HausReportTeaser reportExists={true} userAlreadyPaid={true} onClick={() => {}} />)
    expect(screen.getByRole("button", { name: /view haus report/i })).toBeInTheDocument()
  })
})
