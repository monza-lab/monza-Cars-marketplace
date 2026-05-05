// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SeeSampleModal } from "./SeeSampleModal"

describe("SeeSampleModal", () => {
  it("renders nothing when closed", () => {
    render(<SeeSampleModal open={false} onClose={() => {}} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("renders 3 sample claims when open", () => {
    render(<SeeSampleModal open={true} onClose={() => {}} />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText(/Paint-to-Sample Gulf Blue.*order books/)).toBeInTheDocument()
    expect(screen.getByText(/Lightweight bucket seats on the Touring trim/)).toBeInTheDocument()
    expect(screen.getByText(/factory rear-spoiler-delete/)).toBeInTheDocument()
  })

  it("labels the dialog as Tier 2 sample from different listing", () => {
    render(<SeeSampleModal open={true} onClose={() => {}} />)
    expect(screen.getByText(/Tier 2 sample · different listing/i)).toBeInTheDocument()
  })

  it("fires onClose when close button clicked", () => {
    const onClose = vi.fn()
    render(<SeeSampleModal open={true} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText(/Close sample/i))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("fires onClose when backdrop clicked", () => {
    const onClose = vi.fn()
    render(<SeeSampleModal open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole("dialog"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("fires onUpgradeClick when unlock CTA clicked", () => {
    const onUpgrade = vi.fn()
    render(<SeeSampleModal open={true} onClose={() => {}} onUpgradeClick={onUpgrade} />)
    fireEvent.click(screen.getByText(/Unlock this depth/i))
    expect(onUpgrade).toHaveBeenCalledTimes(1)
  })

  it("hides upgrade CTA when onUpgradeClick not provided", () => {
    render(<SeeSampleModal open={true} onClose={() => {}} />)
    expect(screen.queryByText(/Unlock this depth/i)).not.toBeInTheDocument()
  })

  it("closes on Escape key", () => {
    const onClose = vi.fn()
    render(<SeeSampleModal open={true} onClose={onClose} />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
