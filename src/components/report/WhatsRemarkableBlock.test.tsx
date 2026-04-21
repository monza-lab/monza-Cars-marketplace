// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { WhatsRemarkableBlock } from "./WhatsRemarkableBlock"
import type { RemarkableClaim } from "@/lib/fairValue/types"

function mkClaim(id: string, text: string): RemarkableClaim {
  return {
    id,
    claim_text: text,
    source_type: "signal",
    source_ref: "sig_x",
    source_url: null,
    capture_date: null,
    confidence: "high",
    tier_required: "tier_1",
  }
}

describe("WhatsRemarkableBlock", () => {
  it("renders claim cards and tier-1 subtitle", () => {
    render(
      <WhatsRemarkableBlock
        claims={[mkClaim("c1", "PTS Gulf Blue"), mkClaim("c2", "Single owner")]}
        tier="tier_1"
      />
    )
    expect(screen.getByText(/PTS Gulf Blue/)).toBeInTheDocument()
    expect(screen.getByText(/Single owner/)).toBeInTheDocument()
    expect(screen.getByText(/2 findings about this specific VIN/)).toBeInTheDocument()
  })

  it("shows upgrade CTA for tier_1 only", () => {
    const onUpgrade = vi.fn()
    const onSeeSample = vi.fn()
    render(
      <WhatsRemarkableBlock
        claims={[mkClaim("c1", "test")]}
        tier="tier_1"
        onUpgradeClick={onUpgrade}
        onSeeSampleClick={onSeeSample}
      />
    )
    expect(screen.getByText(/Monthly subscribers unlock/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/See sample/))
    expect(onSeeSample).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText("Upgrade"))
    expect(onUpgrade).toHaveBeenCalledTimes(1)
  })

  it("hides upgrade CTA for tier_2", () => {
    render(
      <WhatsRemarkableBlock claims={[mkClaim("c1", "test")]} tier="tier_2" />
    )
    expect(screen.queryByText(/Monthly subscribers unlock/)).not.toBeInTheDocument()
    expect(screen.getByText(/1 findings with specialist context/)).toBeInTheDocument()
  })

  it("hides upgrade CTA for tier_3 and shows specialist subtitle", () => {
    render(
      <WhatsRemarkableBlock claims={[mkClaim("c1", "test")]} tier="tier_3" />
    )
    expect(screen.queryByText(/Monthly subscribers unlock/)).not.toBeInTheDocument()
    expect(screen.getByText(/specialist variant analysis/)).toBeInTheDocument()
  })

  it("shows empty state when no claims", () => {
    render(<WhatsRemarkableBlock claims={[]} tier="tier_1" />)
    expect(screen.getByText(/No remarkable findings were extracted/)).toBeInTheDocument()
  })
})
