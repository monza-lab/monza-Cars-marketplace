// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ReportHeader } from "./ReportHeader"

describe("ReportHeader", () => {
  it("renders title and formatted date with tier label", () => {
    render(
      <ReportHeader
        carTitle="2023 Porsche 992 GT3 Touring"
        carThumbUrl={null}
        generatedAt="2026-04-21T00:00:00Z"
        reportVersion={1}
        tier="tier_2"
        onDownloadClick={() => {}}
      />
    )
    expect(screen.getByText(/2023 Porsche 992 GT3 Touring/)).toBeInTheDocument()
    expect(screen.getByText(/Tier 2/)).toBeInTheDocument()
    expect(screen.getByText(/v1/)).toBeInTheDocument()
  })

  it("hides regenerate button when prop not passed", () => {
    render(
      <ReportHeader
        carTitle="Test"
        carThumbUrl={null}
        generatedAt="2026-04-21T00:00:00Z"
        reportVersion={1}
        tier="tier_1"
        onDownloadClick={() => {}}
      />
    )
    expect(screen.queryByLabelText(/Regenerate report/)).not.toBeInTheDocument()
  })

  it("fires download callback on click", () => {
    const onDownload = vi.fn()
    render(
      <ReportHeader
        carTitle="Test"
        carThumbUrl={null}
        generatedAt="2026-04-21T00:00:00Z"
        reportVersion={1}
        tier="tier_1"
        onDownloadClick={onDownload}
      />
    )
    fireEvent.click(screen.getByText(/Download/))
    expect(onDownload).toHaveBeenCalledTimes(1)
  })

  it("fires regenerate callback when provided", () => {
    const onRegen = vi.fn()
    render(
      <ReportHeader
        carTitle="Test"
        carThumbUrl={null}
        generatedAt="2026-04-21T00:00:00Z"
        reportVersion={2}
        tier="tier_2"
        onDownloadClick={() => {}}
        onRegenerateClick={onRegen}
      />
    )
    fireEvent.click(screen.getByLabelText(/Regenerate report/))
    expect(onRegen).toHaveBeenCalledTimes(1)
  })
})
