// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { SourceBadge } from "./SourceBadge"

describe("SourceBadge", () => {
  it("renders source name", () => {
    render(<SourceBadge name="BaT" count={14} captureDate="Apr 15–21, 2026" />)
    expect(screen.getByText(/BaT/)).toBeInTheDocument()
    expect(screen.getByText(/14/)).toBeInTheDocument()
    expect(screen.getByText(/Apr 15–21, 2026/)).toBeInTheDocument()
  })

  it("exposes onClick handler", () => {
    let clicked = false
    render(<SourceBadge name="BaT" onClick={() => (clicked = true)} />)
    screen.getByRole("button").click()
    expect(clicked).toBe(true)
  })

  it("renders as span (non-interactive) when no onClick", () => {
    render(<SourceBadge name="BaT" />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
