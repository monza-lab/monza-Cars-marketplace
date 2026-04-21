// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { Piston } from "./Piston"

describe("Piston icon", () => {
  it("renders an SVG with a currentColor stroke or fill", () => {
    const { container } = render(<Piston className="size-4" />)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24")
  })

  it("accepts a className prop and passes it to the svg root", () => {
    const { container } = render(<Piston className="text-primary size-3" />)
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("size-3")
  })
})
