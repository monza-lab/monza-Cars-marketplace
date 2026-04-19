import { describe, it, expect, vi, beforeEach } from "vitest"
import { extractTextSignals } from "./text"

vi.mock("@/lib/ai/gemini", () => ({
  generateJson: vi.fn(),
}))

import { generateJson } from "@/lib/ai/gemini"
const generateJsonMock = generateJson as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  generateJsonMock.mockReset()
})

describe("extractTextSignals", () => {
  it("emits detected signals when Gemini returns rich extraction", async () => {
    generateJsonMock.mockResolvedValue({
      ok: true,
      data: {
        options: {
          sport_chrono: true,
          pccb: true,
          burmester: false,
          lwb_seats: false,
          carbon_roof: false,
          paint_to_sample: { present: true, color_name: "Gulf Blue", pts_code: "Y5C" },
          factory_rear_spoiler_delete: false,
        },
        service: { records_mentioned: true, stamps_count: 14, last_major_service_year: 2025, intervals_respected: true, dealer_serviced: true },
        ownership: { previous_owners_count: 1, one_owner_claim: false, years_current_owner: 5, collector_owned_claim: false, garage_kept_claim: true },
        originality: { matching_numbers_claim: true, original_paint_claim: true, repaint_disclosed: null, accident_disclosure: "no_accidents_claim", modifications_disclosed: [] },
        documentation: { ppi_available: true, carfax_linked: false, window_sticker_shown: true, build_sheet_shown: false },
        warranty: { remaining_factory_warranty: false, cpo_status: false },
        listing_completeness: "high",
        extraction_confidence: "high",
      },
      raw: "...",
    })

    const result = await extractTextSignals({
      description: "2022 Porsche 992 GT3 in Paint-to-Sample Gulf Blue (code Y5C). 14 service stamps...",
    })

    expect(result.ok).toBe(true)
    expect(result.signals.find(s => s.key === "paint_to_sample")?.value_display).toContain("Gulf Blue")
    expect(result.signals.find(s => s.key === "service_records")).toBeTruthy()
    expect(result.signals.find(s => s.key === "previous_owners")).toBeTruthy()
    expect(result.signals.find(s => s.key === "original_paint")).toBeTruthy()
    expect(result.signals.find(s => s.key === "documentation")).toBeTruthy()
  })

  it("emits no signals when Gemini returns all null/false (sparse description)", async () => {
    generateJsonMock.mockResolvedValue({
      ok: true,
      data: {
        options: { sport_chrono: false, pccb: false, burmester: false, lwb_seats: false, carbon_roof: false, paint_to_sample: { present: false, color_name: null, pts_code: null }, factory_rear_spoiler_delete: false },
        service: { records_mentioned: false, stamps_count: null, last_major_service_year: null, intervals_respected: null, dealer_serviced: null },
        ownership: { previous_owners_count: null, one_owner_claim: false, years_current_owner: null, collector_owned_claim: false, garage_kept_claim: false },
        originality: { matching_numbers_claim: false, original_paint_claim: false, repaint_disclosed: null, accident_disclosure: "none_mentioned", modifications_disclosed: [] },
        documentation: { ppi_available: false, carfax_linked: false, window_sticker_shown: false, build_sheet_shown: false },
        warranty: { remaining_factory_warranty: false, cpo_status: false },
        listing_completeness: "low",
        extraction_confidence: "high",
      },
      raw: "...",
    })

    const result = await extractTextSignals({ description: "2019 Porsche 911. White. Runs great." })
    expect(result.ok).toBe(true)
    expect(result.signals).toHaveLength(0)
  })

  it("returns ok=false on Gemini error", async () => {
    generateJsonMock.mockResolvedValue({ ok: false, error: "API error", raw: null })
    const result = await extractTextSignals({ description: "anything" })
    expect(result.ok).toBe(false)
  })
})
