import { describe, expect, it } from "vitest"
import {
  buildReportPeerIdentity,
  matchesReportPeerIdentity,
  normalizeReportPeerText,
} from "./reportPeerIdentity"

describe("report peer identity", () => {
  it("normalizes case, whitespace, and harmless punctuation", () => {
    expect(normalizeReportPeerText("  911   GT3. ")).toBe("911 gt3")
    expect(normalizeReportPeerText("Carrera-S")).toBe("carrera s")
    expect(normalizeReportPeerText("  Porsche  ")).toBe("porsche")
  })

  it("builds no identity when make or model identity is missing", () => {
    expect(buildReportPeerIdentity({ make: "Porsche", model: "" })).toBeNull()
    expect(buildReportPeerIdentity({ make: "", model: "911 GT3" })).toBeNull()
  })

  it("matches exact same make and model variant identity", () => {
    const target = buildReportPeerIdentity({ make: "Porsche", model: "911 GT3" })
    expect(target).not.toBeNull()
    expect(matchesReportPeerIdentity(target, { make: " porsche ", model: "911 gt3" })).toBe(true)
  })

  it("does not match base model to variant", () => {
    const target = buildReportPeerIdentity({ make: "Porsche", model: "911 GT3" })
    expect(matchesReportPeerIdentity(target, { make: "Porsche", model: "911" })).toBe(false)
  })

  it("does not match adjacent variants", () => {
    const target = buildReportPeerIdentity({ make: "Porsche", model: "911 GT3" })
    expect(matchesReportPeerIdentity(target, { make: "Porsche", model: "911 GT3 RS" })).toBe(false)
    expect(matchesReportPeerIdentity(target, { make: "Porsche", model: "911 Turbo" })).toBe(false)
  })
})
