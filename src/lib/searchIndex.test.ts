import { describe, it, expect } from "vitest"
import {
  buildListingSearchOrClauses,
  normalizeListingSearchTokens,
  rankListingSearchRows,
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

  it("strips Porsche prefixes and matches high-intent generation queries", () => {
    expect(searchSeries("Porsche 992").map((r) => r.id)).toContain("992")
    expect(searchSeries("Porsche Panamera").map((r) => r.id)).toContain("panamera")
    expect(searchSeries("Porsche Carrera GT").map((r) => r.id)[0]).toBe("carrera-gt")
  })

  it("matches compound generation plus variant queries by token", () => {
    expect(searchSeries("992 GT3").map((r) => r.id)[0]).toBe("992")
    expect(searchSeries("997 GTS").map((r) => r.id)[0]).toBe("997")
    expect(searchSeries("718 Cayman GT4 RS").map((r) => r.id)[0]).toBe("718-cayman")
    expect(searchSeries("911 Turbo S").map((r) => r.id)).toEqual(
      expect.arrayContaining(["992", "991", "997", "996", "993"]),
    )
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

  it("removes PostgREST OR grammar and wildcard characters from query clauses", () => {
    const clauses = buildListingSearchOrClauses('GT3,vin.ilike.*WP0* (turbo)%_:"bad"')
    const joined = clauses.join("|")

    expect(joined).toContain("title.ilike.%GT3%")
    expect(joined).not.toContain(",vin.ilike")
    expect(joined).not.toContain("*")
    expect(joined).not.toContain("%_%")
    expect(joined).not.toContain(":")
    expect(joined).not.toContain('"')
  })

  it("ranks exact model and title phrase matches before broad token matches", () => {
    const rows = [
      {
        id: "356-carrera-gt",
        title: "1961 Porsche 356 B 1600 GS/GT Carrera Coupe",
        model: "356 B",
        trim: null,
        series: "356",
        year: 1961,
      },
      {
        id: "carrera-gt",
        title: "2005 Porsche Carrera GT",
        model: "Carrera GT",
        trim: null,
        series: "carrera-gt",
        year: 2005,
      },
      {
        id: "911-gts",
        title: "2025 Porsche 911 Carrera GTS",
        model: "911 Carrera GTS",
        trim: null,
        series: "992",
        year: 2025,
      },
    ]

    expect(rankListingSearchRows(rows, "Carrera GT").map((row) => row.id)).toEqual([
      "carrera-gt",
      "356-carrera-gt",
      "911-gts",
    ])
  })

  it("ranks Turbo S listings before broader Turbo-only listings", () => {
    const rows = [
      {
        id: "turbo",
        title: "2001 Porsche 911 Turbo Coupe 6-Speed",
        model: "911 Turbo",
        trim: null,
        series: "996",
        year: 2001,
      },
      {
        id: "turbo-s",
        title: "2023 Porsche 911 Turbo S",
        model: "911 Turbo S",
        trim: null,
        series: "992",
        year: 2023,
      },
    ]

    expect(rankListingSearchRows(rows, "911 Turbo S").map((row) => row.id)).toEqual([
      "turbo-s",
      "turbo",
    ])
  })
})
