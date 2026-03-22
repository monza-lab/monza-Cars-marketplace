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
    <a class="content-teaser" href="https://www.elferspot.com/en/car/porsche-992-gt3-2023-5856995/">
      <div class="content-teaser-content">
        <img src="data:image/svg+xml;..." data-src="https://cdn.elferspot.com/thumb.jpg" class="content-teaser-image lazy" alt="Porsche 992 GT3" />
        <div class="content-teaser-inner">
          <div class="content-teaser-text">
            <div class="content-teaser-atts">
              <div class="teaser-atts">
                <img src="/flags/flag-de.svg" alt="DE" class="flag no-lazy" />
                2023
              </div>
              <h3>Porsche 992 GT3</h3>
            </div>
          </div>
        </div>
      </div>
    </a>
  </body></html>`

  it("extracts listings from HTML", () => {
    const listings = parseSearchPage(FIXTURE)
    expect(listings.length).toBeGreaterThanOrEqual(1)
    expect(listings[0].sourceId).toBe("5856995")
    expect(listings[0].sourceUrl).toContain("5856995")
    expect(listings[0].title).toBe("Porsche 992 GT3")
    expect(listings[0].year).toBe(2023)
    expect(listings[0].country).toBe("DE")
    expect(listings[0].thumbnailUrl).toBe("https://cdn.elferspot.com/thumb.jpg")
  })

  it("extracts year from URL slug as fallback", () => {
    const html = `<html><body>
      <a class="content-teaser" href="https://www.elferspot.com/en/car/porsche-993-turbo-1996-5800000/">
        <div class="content-teaser-content">
          <img class="content-teaser-image" data-src="https://cdn.elferspot.com/thumb2.jpg" />
          <div class="content-teaser-inner">
            <div class="content-teaser-text">
              <div class="content-teaser-atts">
                <div class="teaser-atts"></div>
                <h3>Porsche 993 Turbo</h3>
              </div>
            </div>
          </div>
        </div>
      </a>
    </body></html>`
    const listings = parseSearchPage(html)
    expect(listings[0].year).toBe(1996)
  })
})
