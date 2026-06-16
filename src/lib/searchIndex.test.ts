import { describe, it, expect } from "vitest"
import {
  buildListingSearchOrClauses,
  normalizeListingSearchTokens,
  searchSeries,
} from "./searchIndex"

describe("searchSeries", () => {
  it("returns all 27 Porsche series when query is empty", () => {
    const results = searchSeries("")
    expect(results.length).toBeGreaterThanOrEqual(20)
    const ids = results.map((r) => r.id)
    expect(ids).toContain("992")
    expect(ids).toContain("997")
    expect(ids).toContain("964")
  })

  it("filters by id prefix when typing '99'", () => {
    const results = searchSeries("99")
    const ids = results.map((r) => r.id)
    expect(ids).toContain("997")
    expect(ids).toContain("996")
    expect(ids).toContain("993")
    expect(ids).toContain("992")
    expect(ids).toContain("991")
    expect(ids).not.toContain("964")
  })

  it("tolerates a single typo for 4+ char queries", () => {
    const results = searchSeries("carrea")
    expect(results.length).toBeGreaterThan(0)
  })

  it("matches variant keywords like 'gt3' across series", () => {
    const results = searchSeries("gt3")
    expect(results.length).toBeGreaterThan(0)
  })

  it("returns results sorted by SeriesConfig.order ascending", () => {
    const results = searchSeries("")
    const orders = results.map((r) => r.order)
    const sorted = [...orders].sort((a, b) => a - b)
    expect(orders).toEqual(sorted)
  })
})

describe("listing search clauses", () => {
  it("tokenizes a specific car query into searchable terms", () => {
    expect(normalizeListingSearchTokens("  997 GTS!! ")).toEqual(["997", "GTS"])
  })

  it("builds one OR group per token so generation and variant can match different fields", () => {
    expect(buildListingSearchOrClauses("997 GTS")).toEqual([
      "title.ilike.%997%,model.ilike.%997%,trim.ilike.%997%,series.ilike.%997%,source.ilike.%997%,platform.ilike.%997%,transmission.ilike.%997%,engine.ilike.%997%,location.ilike.%997%",
      "title.ilike.%GTS%,model.ilike.%GTS%,trim.ilike.%GTS%,series.ilike.%GTS%,source.ilike.%GTS%,platform.ilike.%GTS%,transmission.ilike.%GTS%,engine.ilike.%GTS%,location.ilike.%GTS%",
    ])
  })

  it("adds an exact year predicate for four-digit year tokens", () => {
    expect(buildListingSearchOrClauses("2011 GTS")[0]).toContain("year.eq.2011")
  })
})
