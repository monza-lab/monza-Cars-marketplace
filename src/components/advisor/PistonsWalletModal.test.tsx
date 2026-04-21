// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { PistonsWalletModal } from "./PistonsWalletModal"
import enMessages from "../../../messages/en.json"

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages as any}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe("PistonsWalletModal", () => {
  it("renders the balance and tier", () => {
    renderWithIntl(
      <PistonsWalletModal
        open
        onOpenChange={() => {}}
        balance={847}
        tier="PRO"
        nextResetDate={new Date("2026-05-21")}
        todayUsage={{ chat: 22, oracle: 5, report: 25 }}
        graceUsage={null}
        recentDebits={[]}
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/847/)).toBeInTheDocument()
    expect(screen.getByText(/PRO/)).toBeInTheDocument()
  })

  it("shows grace usage and upgrade CTA for FREE tier", () => {
    renderWithIntl(
      <PistonsWalletModal
        open
        onOpenChange={() => {}}
        balance={42}
        tier="FREE"
        nextResetDate={new Date("2026-05-21")}
        todayUsage={{ chat: 3, oracle: 1, report: 0 }}
        graceUsage={{ instantUsed: 8, instantTotal: 10, marketplaceUsed: 1, marketplaceTotal: 2 }}
        recentDebits={[]}
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/8\/10/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Upgrade/i })).toBeInTheDocument()
  })
})
