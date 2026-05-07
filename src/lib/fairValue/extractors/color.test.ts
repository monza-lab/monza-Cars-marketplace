import { extractColorIntelligence } from "./color"

describe("extractColorIntelligence", () => {
  it("identifies a rare color with premium", () => {
    const result = extractColorIntelligence({
      exteriorColor: "Riviera Blue",
      interiorColor: "Black",
      seriesId: "993",
      description: null,
    })
    expect(result.exterior.matchedColor?.name).toBe("Riviera Blue")
    expect(result.exterior.rarity).toBe("rare")
    expect(result.exterior.valuePremiumPercent).toBeGreaterThan(20)
    expect(result.signals.length).toBeGreaterThan(0)
    expect(result.signals.some(s => s.key === "color_rarity")).toBe(true)
  })

  it("identifies a common color with no premium", () => {
    const result = extractColorIntelligence({
      exteriorColor: "Black",
      interiorColor: "Black",
      seriesId: "992",
      description: null,
    })
    expect(result.exterior.rarity).toBe("common")
    expect(result.exterior.valuePremiumPercent).toBe(0)
    expect(result.signals.some(s => s.key === "color_rarity")).toBe(false)
  })

  it("returns neutral result for unknown color", () => {
    const result = extractColorIntelligence({
      exteriorColor: null,
      interiorColor: null,
      seriesId: "992",
      description: null,
    })
    expect(result.exterior.matchedColor).toBeNull()
    expect(result.signals).toHaveLength(0)
  })

  it("detects PTS from description when exterior is generic", () => {
    const result = extractColorIntelligence({
      exteriorColor: "Blue",
      interiorColor: "Black",
      seriesId: "992",
      description: "Finished in Paint-to-Sample Gulf Blue",
    })
    expect(result.exterior.isPTS).toBe(true)
    expect(result.signals.some(s => s.key === "color_rarity")).toBe(true)
  })
})
