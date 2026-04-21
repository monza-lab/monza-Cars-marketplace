// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QuestionsToAskBlock } from "./QuestionsToAskBlock"
import type { MissingSignal } from "@/lib/fairValue/types"

function missing(key: string): MissingSignal {
  return {
    key,
    name_i18n_key: `report.signals.${key}`,
    question_for_seller_i18n_key: `report.questions.${key}_question`,
  }
}

describe("QuestionsToAskBlock", () => {
  it("renders one card per missing signal with known-key question text", () => {
    render(
      <QuestionsToAskBlock missingSignals={[missing("service_records"), missing("warranty")]} />
    )
    expect(
      screen.getByText(/Ask the seller for documented service history/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/factory or CPO warranty/i)).toBeInTheDocument()
  })

  it("shows impact copy badge for known keys", () => {
    render(<QuestionsToAskBlock missingSignals={[missing("service_records")]} />)
    expect(screen.getByText(/typically adds 4–6%/)).toBeInTheDocument()
  })

  it("falls back to generic question for unknown key", () => {
    render(<QuestionsToAskBlock missingSignals={[missing("something_exotic")]} />)
    expect(screen.getByText(/Ask the seller about something exotic/)).toBeInTheDocument()
  })

  it("copies all questions on click and shows confirmation", async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText: write } })
    render(
      <QuestionsToAskBlock missingSignals={[missing("service_records"), missing("warranty")]} />
    )
    fireEvent.click(screen.getByText(/Copy all questions/))
    await waitFor(() => expect(write).toHaveBeenCalled())
    const text = write.mock.calls[0][0] as string
    expect(text).toContain("1. ")
    expect(text).toContain("2. ")
    await waitFor(() => expect(screen.getByText(/Copied/)).toBeInTheDocument())
  })

  it("renders nothing when no missing signals", () => {
    const { container } = render(<QuestionsToAskBlock missingSignals={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
