import { describe, it, expect } from "vitest"
import { searchKnowledgeArticles, getKnowledgeArticle } from "./registry"

describe("searchKnowledgeArticles", () => {
  it("returns IMS article when searching for 'IMS'", () => {
    const results = searchKnowledgeArticles("IMS")
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].slug).toBe("ims-bearing")
  })

  it("returns IMS article when searching for 'IMS bearing'", () => {
    const results = searchKnowledgeArticles("IMS bearing")
    expect(results[0].slug).toBe("ims-bearing")
  })

  it("returns Mezger article when searching for 'Mezger'", () => {
    const results = searchKnowledgeArticles("Mezger")
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].slug).toBe("mezger-engine")
  })

  it("returns rust article when searching for 'rust'", () => {
    const results = searchKnowledgeArticles("rust")
    expect(results[0].slug).toBe("porsche-rust-inspection")
  })

  it("returns paint codes article when searching for 'paint'", () => {
    const results = searchKnowledgeArticles("paint")
    expect(results[0].slug).toBe("porsche-paint-codes")
  })

  it("returns PPI article when searching for 'PPI'", () => {
    const results = searchKnowledgeArticles("PPI")
    expect(results[0].slug).toBe("porsche-pre-purchase-inspection")
  })

  it("returns service intervals when searching for 'oil change'", () => {
    const results = searchKnowledgeArticles("oil change")
    expect(results[0].slug).toBe("porsche-service-intervals")
  })

  it("returns COA article when searching for 'certificate'", () => {
    const results = searchKnowledgeArticles("certificate")
    expect(results[0].slug).toBe("porsche-certificate-of-authenticity")
  })

  it("returns air-cooled article when searching for 'air-cooled'", () => {
    const results = searchKnowledgeArticles("air-cooled")
    expect(results[0].slug).toBe("porsche-air-cooled-vs-water-cooled")
  })

  it("returns all articles when query is empty", () => {
    const results = searchKnowledgeArticles("")
    expect(results.length).toBe(8)
  })

  it("returns empty array for completely unrelated query", () => {
    const results = searchKnowledgeArticles("xyznotarealword123")
    expect(results.length).toBe(0)
  })

  it("finds IMS via M96 keyword (cross-category)", () => {
    const results = searchKnowledgeArticles("M96")
    expect(results.some((a) => a.slug === "ims-bearing")).toBe(true)
  })
})
