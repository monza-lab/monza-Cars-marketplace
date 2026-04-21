// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ConfidenceDot } from "./ConfidenceDot"

describe("ConfidenceDot", () => {
  it("renders with aria-label matching level", () => {
    render(<ConfidenceDot level="high" />)
    expect(screen.getByLabelText("high confidence")).toBeInTheDocument()
  })

  it("applies distinct class per level", () => {
    const { rerender, container } = render(<ConfidenceDot level="high" />)
    const first = container.querySelector("span")!.className
    rerender(<ConfidenceDot level="low" />)
    const second = container.querySelector("span")!.className
    expect(first).not.toBe(second)
  })
})
