import { describe, it, expect } from "vitest"
import { parseDetailPage, extractJsonLd } from "./detail"

const FIXTURE_JSON_LD = `<script type="application/ld+json">{
  "@type": "Vehicle",
  "model": "992 GT3 Touring",
  "bodyType": "Coupe\u0301",
  "dateVehicleFirstRegistered": "2023-06-15",
  "mileageFromOdometer": { "value": "12500", "unitCode": "KMT" },
  "vehicleTransmission": "PDK",
  "driveWheelConfiguration": "Rear drive",
  "color": "Oak Green Metallic",
  "offers": { "@type": "Offer", "price": "224990", "priceCurrency": "EUR" }
}</script>`

const FIXTURE_HTML = `<html><head>${FIXTURE_JSON_LD}</head><body>
  <h1>Porsche 992 GT3 Touring</h1>
  <table class="fahrzeugdaten">
    <tr><td class="label">Cylinder capacity:</td><td class="content">4.0 Liter</td></tr>
    <tr><td class="label">Power:</td><td class="content">510 HP</td></tr>
    <tr><td class="label">Interior color:</td><td class="content">Black</td></tr>
    <tr><td class="label">Fuel:</td><td class="content">Gasoline</td></tr>
    <tr><td class="label">Condition:</td><td class="content">Accident-free</td></tr>
    <tr><td class="label">Car location:</td><td class="content">Germany</td></tr>
  </table>
  <div class="sidebar-section-heading sidebar-toggle">
    <strong>Auto Muller GmbH</strong>
  </div>
  <div class="highlights-float">
    <p>Rare GT3 Touring in Oak Green</p>
    <p>First owner, full service history</p>
    <p class="translation-notice">Translated by DeepL</p>
  </div>
  <figure class="block-image-grid">
    <a class="photoswipe-image" href="https://cdn.elferspot.com/wp-content/uploads/2023/img1.jpeg?class=xl">
      <img data-src="https://cdn.elferspot.com/wp-content/uploads/2023/img1.jpeg?class=l" />
    </a>
    <a class="photoswipe-image" href="https://cdn.elferspot.com/wp-content/uploads/2023/img2.jpeg?class=xl">
      <img data-src="https://cdn.elferspot.com/wp-content/uploads/2023/img2.jpeg?class=l" />
    </a>
  </figure>
</body></html>`

describe("extractJsonLd", () => {
  it("parses Vehicle JSON-LD", () => {
    const data = extractJsonLd(FIXTURE_HTML)
    expect(data).not.toBeNull()
    expect(data!.price).toBe(224990)
    expect(data!.currency).toBe("EUR")
    expect(data!.model).toBe("992 GT3 Touring")
    expect(data!.mileageKm).toBe(12500)
    expect(data!.transmission).toBe("PDK")
    expect(data!.bodyType).toBe("Coupe\u0301")
    expect(data!.colorExterior).toBe("Oak Green Metallic")
  })
})

describe("parseDetailPage", () => {
  it("combines JSON-LD and Cheerio data", () => {
    const detail = parseDetailPage(FIXTURE_HTML)
    expect(detail.price).toBe(224990)
    expect(detail.images.length).toBe(2)
    expect(detail.images[0]).toContain("cdn.elferspot.com")
    expect(detail.images[0]).toContain("?class=xl")
    expect(detail.colorInterior).toBe("Black")
    expect(detail.fuel).toBe("Gasoline")
    expect(detail.condition).toBe("Accident-free")
    expect(detail.sellerName).toBe("Auto Muller GmbH")
    expect(detail.sellerType).toBe("dealer")
    expect(detail.locationCountry).toBe("Germany")
    expect(detail.descriptionText).toContain("Rare GT3 Touring")
    expect(detail.descriptionText).not.toContain("Translated by DeepL")
    expect(detail.engine).toContain("4.0L")
  })

  it("handles missing price (Price on request)", () => {
    const html = FIXTURE_HTML.replace('"price": "224990",', '"price": "",')
    const detail = parseDetailPage(html)
    expect(detail.price).toBeNull()
  })

  it("extracts price from sidebar when JSON-LD has no price", () => {
    const html = `<html><head><script type="application/ld+json">{
      "@type": "Vehicle", "model": "993 Turbo"
    }</script></head><body>
      <div class="price"><span class="p">EUR 189,900</span></div>
    </body></html>`
    const detail = parseDetailPage(html)
    expect(detail.price).toBe(189900)
    expect(detail.currency).toBe("EUR")
  })
})
