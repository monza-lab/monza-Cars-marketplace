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
})
