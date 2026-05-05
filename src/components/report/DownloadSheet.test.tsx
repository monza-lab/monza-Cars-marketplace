// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DownloadSheet } from "./DownloadSheet"

describe("DownloadSheet", () => {
  const baseProps = {
    listingId: "live-abc123",
    reportHash: "a7f3c29b12e4f5d6c7b8a9f0",
  }

  it("renders nothing when closed", () => {
    render(
      <DownloadSheet open={false} onClose={() => {}} {...baseProps} />
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("renders PDF and Excel download links pointing at API routes", () => {
    render(<DownloadSheet open={true} onClose={() => {}} {...baseProps} />)

    const pdfLink = screen.getByRole("link", { name: /PDF/i })
    const excelLink = screen.getByRole("link", { name: /Excel/i })

    expect(pdfLink).toHaveAttribute("href", "/api/reports/live-abc123/pdf")
    expect(excelLink).toHaveAttribute("href", "/api/reports/live-abc123/excel")
  })

  it("does not surface a Piston/token cost until billing is wired", () => {
    render(<DownloadSheet open={true} onClose={() => {}} {...baseProps} />)
    // Download endpoints currently don't deduct credits — don't promise a cost
    // we're not going to enforce.
    expect(screen.queryByText(/Piston/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Pistons/i)).not.toBeInTheDocument()
  })

  it("shows short hash and verify link when both provided", () => {
    render(
      <DownloadSheet
        open={true}
        onClose={() => {}}
        listingId="live-abc123"
        reportHash="a7f3c29b12e4f5d6c7b8a9f0"
        verifyHref="/verify/a7f3c29b12e4f5d6c7b8a9f0"
      />
    )
    expect(screen.getByText("a7f3c29b12e4")).toBeInTheDocument()
    const verifyLink = screen.getByRole("link", { name: "Verify" })
    expect(verifyLink).toHaveAttribute("href", "/verify/a7f3c29b12e4f5d6c7b8a9f0")
  })

  it("hides hash block when reportHash is null", () => {
    render(
      <DownloadSheet
        open={true}
        onClose={() => {}}
        listingId="live-abc123"
        reportHash={null}
      />
    )
    expect(screen.queryByText(/Hash ·/i)).not.toBeInTheDocument()
  })

  it("fires onClose when close button clicked", () => {
    const onClose = vi.fn()
    render(<DownloadSheet open={true} onClose={onClose} {...baseProps} />)
    fireEvent.click(screen.getByLabelText(/Close download sheet/i))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("fires onClose on Escape key", () => {
    const onClose = vi.fn()
    render(<DownloadSheet open={true} onClose={onClose} {...baseProps} />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("PDF link has download attribute with hash-based filename", () => {
    render(<DownloadSheet open={true} onClose={() => {}} {...baseProps} />)
    const pdfLink = screen.getByRole("link", { name: /PDF/i })
    expect(pdfLink).toHaveAttribute("download", "haus-report-a7f3c29b12e4.pdf")
  })

  it("falls back to listingId for filename when hash is null", () => {
    render(
      <DownloadSheet
        open={true}
        onClose={() => {}}
        listingId="live-abc123"
        reportHash={null}
      />
    )
    const pdfLink = screen.getByRole("link", { name: /PDF/i })
    expect(pdfLink).toHaveAttribute("download", "haus-report-live-abc123.pdf")
  })
})
