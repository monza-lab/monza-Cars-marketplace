// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ReportMetadataFooter } from "./ReportMetadataFooter"

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

describe("ReportMetadataFooter", () => {
  it("renders hash truncated + verify link when hash present", () => {
    render(
      <ReportMetadataFooter
        generatedAt="2026-04-21T00:00:00Z"
        reportHash="a7f3c29b1234567890abcdef"
        modifierVersion="v1.0"
        extractionVersion="v1.2"
      />
    )
    expect(screen.getByText(/a7f3c29b1234/)).toBeInTheDocument()
    expect(screen.getByText(/Apr.*2026/)).toBeInTheDocument()
    expect(screen.getByText(/v1.0/)).toBeInTheDocument()
    expect(screen.getByText(/v1.2/)).toBeInTheDocument()
    const verify = screen.getByText(/Verify this report/)
    expect(verify).toBeInTheDocument()
    expect(verify.closest("a")?.getAttribute("href")).toBe("/verify/a7f3c29b1234567890abcdef")
  })

  it("renders em dash and hides verify link when hash is null", () => {
    render(
      <ReportMetadataFooter
        generatedAt="2026-04-21T00:00:00Z"
        reportHash={null}
        modifierVersion="v1.0"
        extractionVersion="v1.2"
      />
    )
    // text is split across <p> and <span> — check for the em dash in the mono span
    expect(screen.getByText("—")).toBeInTheDocument()
    expect(screen.queryByText(/Verify this report/)).not.toBeInTheDocument()
  })

  it("always renders the financial-advice disclaimer per Legal Checklist", () => {
    render(
      <ReportMetadataFooter
        generatedAt="2026-04-21T00:00:00Z"
        reportHash={null}
        modifierVersion="v1.0"
        extractionVersion="v1.2"
      />
    )
    expect(screen.getByText(/informational and educational purposes/)).toBeInTheDocument()
    expect(screen.getByText(/do not constitute financial/)).toBeInTheDocument()
  })
})
