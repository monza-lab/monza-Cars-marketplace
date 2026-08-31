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
    expect(screen.getByRole("button", { name: /get the haus report — free/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("shows the free generation CTA when a cached report exists but the user has not unlocked it", () => {
    renderWithIntl(<HausReportTeaser
      reportExists={true}
      userAlreadyPaid={false}
      fairValueLowUsd={244_079}
      fairValueHighUsd={280_822}
      comparablesCount={10}
      onClick={() => {}}
    />)
    expect(screen.getByRole("button", { name: /get the haus report — free/i })).toBeInTheDocument()
    expect(screen.getByText(/ready now/i)).toBeInTheDocument()
    expect(screen.getByText("$244,079–$280,822")).toBeInTheDocument()
    expect(screen.getByText("10 verified comparables")).toBeInTheDocument()
  })

  it("shows 'View' CTA and no cached copy when user already paid", () => {
    renderWithIntl(<HausReportTeaser reportExists={true} userAlreadyPaid={true} onClick={() => {}} />)
    expect(screen.getByRole("button", { name: /view haus report/i })).toBeInTheDocument()
  })
})
