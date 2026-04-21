// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { CollapsibleList } from "./CollapsibleList"

describe("CollapsibleList", () => {
  const items = ["one", "two", "three", "four", "five"]

  it("renders initialCount items by default", () => {
    render(
      <CollapsibleList
        items={items}
        initialCount={2}
        render={(item) => <div key={item}>{item}</div>}
        moreLabel={(hidden) => `Show all ${hidden} more`}
      />
    )
    expect(screen.getByText("one")).toBeInTheDocument()
    expect(screen.getByText("two")).toBeInTheDocument()
    expect(screen.queryByText("three")).not.toBeInTheDocument()
    expect(screen.getByText(/Show all 3 more/)).toBeInTheDocument()
  })

  it("expands on click to show all items", () => {
    render(
      <CollapsibleList
        items={items}
        initialCount={2}
        render={(item) => <div key={item}>{item}</div>}
        moreLabel={(hidden) => `Show all ${hidden} more`}
      />
    )
    fireEvent.click(screen.getByText(/Show all/))
    expect(screen.getByText("three")).toBeInTheDocument()
    expect(screen.getByText("Show less")).toBeInTheDocument()
  })

  it("hides the toggle when all items already visible and initialCount covers everything", () => {
    render(
      <CollapsibleList
        items={items.slice(0, 2)}
        initialCount={2}
        render={(item) => <div key={item}>{item}</div>}
        moreLabel={(hidden) => `Show all ${hidden} more`}
      />
    )
    expect(screen.queryByText(/Show all/)).not.toBeInTheDocument()
    expect(screen.queryByText("Show less")).not.toBeInTheDocument()
  })
})
