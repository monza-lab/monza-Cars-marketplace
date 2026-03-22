import { describe, it, expect } from "vitest"
import { parseSearchPage, buildSearchUrl, extractSourceIdFromUrl } from "./discover"

describe("buildSearchUrl", () => {
  it("builds page 1 URL", () => {
    expect(buildSearchUrl(1, "en")).toBe("https://www.elferspot.com/en/search/")
  })
  it("builds page 3 URL", () => {
    expect(buildSearchUrl(3, "en")).toBe("https://www.elferspot.com/en/search/page/3/")
  })
  it("builds German URL", () => {
    expect(buildSearchUrl(2, "de")).toBe("https://www.elferspot.com/de/suchen/page/2/")
  })
})

describe("extractSourceIdFromUrl", () => {
  it("extracts numeric ID from URL slug", () => {
    expect(extractSourceIdFromUrl("https://www.elferspot.com/en/car/porsche-992-gt3-2023-5856995/"))
      .toBe("5856995")
  })
  it("returns null for invalid URL", () => {
    expect(extractSourceIdFromUrl("https://www.elferspot.com/en/search/")).toBeNull()
  })
})

describe("parseSearchPage", () => {
  const FIXTURE = `<html><body>
    <article>
      <a href="https://www.elferspot.com/en/car/porsche-992-gt3-2023-5856995/">
        <img src="https://cdn.elferspot.com/thumb.jpg" />
        <h2>Porsche 992 GT3</h2>
        <span class="year">2023</span>
      </a>
    </article>
  </body></html>`

  it("extracts listings from HTML", () => {
    const listings = parseSearchPage(FIXTURE)
    expect(listings.length).toBeGreaterThanOrEqual(1)
    expect(listings[0].sourceId).toBe("5856995")
    expect(listings[0].sourceUrl).toContain("5856995")
  })
})
