import { buildNarrativePrompt } from "@/lib/ai/prompts"

describe("buildNarrativePrompt", () => {
  it("includes car details in prompt", () => {
    const prompt = buildNarrativePrompt({
      title: "2007 Porsche 997 Carrera 4S",
      year: 2007,
      make: "Porsche",
      model: "911 Carrera 4S",
      seriesId: "997",
      mileage: 45000,
      transmission: "Manual",
      exteriorColor: "Riviera Blue",
      interiorColor: "Black",
      price: 85000,
      fairValueMid: 78000,
      signals: ["service_records", "original_paint", "single_owner"],
      redFlags: [],
      colorRarity: "rare",
      colorPremium: 35,
    })
    expect(prompt).toContain("997")
    expect(prompt).toContain("Riviera Blue")
    expect(prompt).toContain("rare")
    expect(prompt).toContain("Manual")
    expect(prompt).toContain("78")
  })

  it("prohibits invented valuation when comparable evidence is insufficient", () => {
    const prompt = buildNarrativePrompt({
      title: "2005 Porsche Carrera GT",
      year: 2005,
      make: "Porsche",
      model: "Carrera GT",
      seriesId: "980",
      mileage: 8000,
      transmission: "Manual",
      exteriorColor: "Silver",
      interiorColor: "Black",
      price: 1_500_000,
      fairValueMid: null,
      signals: [],
      redFlags: [],
      colorRarity: "common",
      colorPremium: 0,
    })

    expect(prompt).toContain("Fair Value: unavailable")
    expect(prompt).toContain("Do not use the asking price as fair value")
    expect(prompt).not.toContain("Fair Value (specific-car): $1,500,000")
  })
})
