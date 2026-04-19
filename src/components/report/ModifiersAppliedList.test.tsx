// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { ModifiersAppliedList } from "./ModifiersAppliedList"
import mock from "@/lib/fairValue/__fixtures__/992-gt3-pts-mock.json"
import enMessages from "@/../messages/en.json"
import type { HausReport } from "@/lib/fairValue/types"

function renderWithIntl(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>{node}</NextIntlClientProvider>
  )
}

describe("ModifiersAppliedList", () => {
  it("renders every applied modifier with its delta percentage", () => {
    const r = mock as HausReport
    renderWithIntl(<ModifiersAppliedList modifiers={r.modifiers_applied} />)
    for (const m of r.modifiers_applied) {
      const sign = m.delta_percent > 0 ? "+" : ""
      const expected = `${sign}${m.delta_percent}%`
      const matches = screen.getAllByText((_content, node) => {
        if (!node) return false
        return node.textContent?.trim() === expected
      })
      expect(matches.length).toBeGreaterThan(0)
    }
  })

  it("renders the 'no modifiers' state when list is empty", () => {
    renderWithIntl(<ModifiersAppliedList modifiers={[]} />)
    expect(screen.getByText(/no adjustments applied/i)).toBeInTheDocument()
  })
})
