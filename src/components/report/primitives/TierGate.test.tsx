// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { TierGate } from "./TierGate"

describe("TierGate", () => {
  it("renders children when userTier meets requiredTier", () => {
    render(
      <TierGate userTier="tier_2" requiredTier="tier_2">
        <span>unlocked</span>
      </TierGate>
    )
    expect(screen.getByText("unlocked")).toBeInTheDocument()
  })

  it("renders fallback when userTier is below requiredTier", () => {
    render(
      <TierGate
        userTier="tier_1"
        requiredTier="tier_2"
        fallback={<span>locked</span>}
      >
        <span>unlocked</span>
      </TierGate>
    )
    expect(screen.getByText("locked")).toBeInTheDocument()
    expect(screen.queryByText("unlocked")).not.toBeInTheDocument()
  })

  it("tier_3 user can see tier_2 content", () => {
    render(
      <TierGate userTier="tier_3" requiredTier="tier_2">
        <span>unlocked</span>
      </TierGate>
    )
    expect(screen.getByText("unlocked")).toBeInTheDocument()
  })
})
