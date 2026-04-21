// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SignalsDetectedBlock } from "./SignalsDetectedBlock"
import type { DetectedSignal } from "@/lib/fairValue/types"

function sig(key: string, value: string): DetectedSignal {
  return {
    key,
    name_i18n_key: `report.signals.${key}`,
    value_display: value,
    evidence: {
      source_type: "listing_text",
      source_ref: "description_text",
      raw_excerpt: null,
      confidence: "high",
    },
  }
}

describe("SignalsDetectedBlock", () => {
  it("renders risk signals above positive signals", () => {
    render(
      <SignalsDetectedBlock
        signals={[
          sig("paint_to_sample", "Gulf Blue"),
          sig("accident_history", "Front impact 2022, repaired"),
        ]}
      />
    )
    expect(screen.getByText("Accident History")).toBeInTheDocument()
    expect(screen.getByText("Paint To Sample")).toBeInTheDocument()
  })

  it("collapses positive signals past 5", () => {
    const many = [
      sig("s1", "a"),
      sig("s2", "b"),
      sig("s3", "c"),
      sig("s4", "d"),
      sig("s5", "e"),
      sig("s6", "f"),
      sig("s7", "g"),
    ]
    render(<SignalsDetectedBlock signals={many} />)
    expect(screen.queryByText("S6")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/Show all 7/))
    expect(screen.getByText("S6")).toBeInTheDocument()
  })

  it("fires evidence callback on click", () => {
    const onEvidence = vi.fn()
    const s = sig("paint_to_sample", "Gulf Blue")
    render(<SignalsDetectedBlock signals={[s]} onEvidenceClick={onEvidence} />)
    fireEvent.click(screen.getByText("Paint To Sample"))
    expect(onEvidence).toHaveBeenCalledWith(s)
  })

  it("renders empty state when no signals", () => {
    render(<SignalsDetectedBlock signals={[]} />)
    expect(screen.getByText(/No objective signals were extracted/)).toBeInTheDocument()
  })
})
