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
  <div class="specifications">
    <span>Engine:</span> <span>4.0L, 510 HP</span>
    <span>Interior:</span> <span>Black leather</span>
    <span>Fuel:</span> <span>Gasoline</span>
  </div>
  <div class="seller-info">
    <span class="seller-name">Auto Muller GmbH</span>
    <span class="seller-type">Dealer</span>
    <span class="location">Munich, Germany</span>
  </div>
  <div class="gallery">
    <img src="https://cdn.elferspot.com/wp-content/uploads/2023/img1.jpeg?class=xl" />
    <img src="https://cdn.elferspot.com/wp-content/uploads/2023/img2.jpeg?class=xl" />
  </div>
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
  })

  it("handles missing price (Price on request)", () => {
    const html = FIXTURE_HTML.replace('"price": "224990",', '"price": "",')
    const detail = parseDetailPage(html)
    expect(detail.price).toBeNull()
  })
})
