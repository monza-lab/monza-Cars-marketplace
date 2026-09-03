// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"

import { hasOpenDialog } from "./useOpenDialog"

afterEach(() => {
  document.body.innerHTML = ""
})

function mount(attributes: Record<string, string>): HTMLElement {
  const node = document.createElement("div")
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
  document.body.appendChild(node)
  return node
}

describe("hasOpenDialog", () => {
  it("detects an open Radix dialog or bottom sheet", () => {
    mount({ role: "dialog", "data-state": "open" })
    expect(hasOpenDialog(document.body)).toBe(true)
  })

  it("detects an open alert dialog", () => {
    mount({ role: "alertdialog", "data-state": "open" })
    expect(hasOpenDialog(document.body)).toBe(true)
  })

  it("ignores a closed dialog left in the DOM by the exit animation", () => {
    mount({ role: "dialog", "data-state": "closed" })
    expect(hasOpenDialog(document.body)).toBe(false)
  })

  it("is false on an empty document and tolerates a missing scope", () => {
    expect(hasOpenDialog(document.body)).toBe(false)
    expect(hasOpenDialog(null)).toBe(false)
  })
})
