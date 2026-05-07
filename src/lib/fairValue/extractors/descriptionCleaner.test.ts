import { cleanDescription } from "./descriptionCleaner"

describe("cleanDescription", () => {
  it("strips Classic.com navigation boilerplate", () => {
    const raw = `Find\nSearch Listings\n995,016\nBrowse Auctions\n1,352\nBrowse Dealers\n1,326\nPrice\nFollow Markets\n10,171\nSaved Vehicles\nWhat's a Car Worth?\nSell\nPrivate Sellers\nDealers\nFAQs\nsearch\nperson\nclose\nAbout this 2006 Porsche Cayman\nVIN: WP0AB298X6U782487\n2006 Porsche Cayman S, located at Porsche Wichita. Original MSRP: $66,435. Arctic Silver Metallic with Black Leather interior. This Cayman comes equipped with Brake assist, Cruise Control, Electronic Traction Control, and Heated front seats.\nSpecs\nYear\n2006\nMake\nPorsche\nModel Family\nCayman\nEngine\n3.4L H6\nMileage\n31,647 mi\nVIN\nWP0AB298X6U782487\nBody Style\nCoupe\nAll rights reserved`
    const cleaned = cleanDescription(raw)
    expect(cleaned).toContain("2006 Porsche Cayman S")
    expect(cleaned).toContain("Arctic Silver Metallic")
    expect(cleaned).toContain("Brake assist")
    expect(cleaned).not.toContain("Search Listings")
    expect(cleaned).not.toContain("Browse Auctions")
    expect(cleaned).not.toContain("All rights reserved")
    expect(cleaned).not.toContain("Follow Markets")
  })

  it("passes through clean Elferspot descriptions", () => {
    const raw = "Paintwork has been fully restored + Frontal XPEL film protection\nAurum Gold details.\nSport Chrono Package Plus"
    const cleaned = cleanDescription(raw)
    expect(cleaned).toBe(raw)
  })

  it("passes through clean AutoTrader descriptions", () => {
    const raw = "We are delighted to offer this 2020 70 Porsche 911 3.0T 992 Carrera S PDK Euro 6 finished in Python Green."
    const cleaned = cleanDescription(raw)
    expect(cleaned).toContain("Python Green")
  })

  it("returns empty string for null/undefined", () => {
    expect(cleanDescription(null as unknown as string)).toBe("")
    expect(cleanDescription(undefined as unknown as string)).toBe("")
    expect(cleanDescription("")).toBe("")
  })

  it("strips HTML tags if present", () => {
    const raw = "<p>This <b>2022 Porsche 911</b> GT3 is in <i>excellent</i> condition.</p>"
    const cleaned = cleanDescription(raw)
    expect(cleaned).toContain("2022 Porsche 911")
    expect(cleaned).toContain("GT3")
    expect(cleaned).not.toContain("<p>")
    expect(cleaned).not.toContain("<b>")
  })

  it("collapses excessive whitespace", () => {
    const raw = "Service records   available.\n\n\n\nOne owner.\n\n\n\n\nGarage kept."
    const cleaned = cleanDescription(raw)
    expect(cleaned).not.toMatch(/\n{3,}/)
  })
})
