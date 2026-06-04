import { describe, expect, it } from "vitest";

import { parseDetailHtml } from "./detail";

const SAMPLE_HTML = `
<html>
<head>
  <meta name="ga_sale_status" content="In-Stock" />
  <script type="application/ld+json">{"sku":"CC227877","offers":{"price":"61160","availability":"https://schema.org/InStock"}}</script>
</head>
<body>
  <h1>2016 PORSCHE 911 991H1 CC227877</h1>
  <table class="specification">
    <tr><th class="gray">Ref. No.</th><td>CC227877</td><th class="gray">Mileage</th><td>51,793 km</td></tr>
    <tr><th class="gray">Model Code</th><td>991H1</td><th class="gray">Transmission</th><td>Automatic</td></tr>
    <tr><th class="gray">Location</th><td>OSAKA</td><th class="gray">Fuel</th><td>Petrol</td></tr>
  </table>
  <div class="remarks">
    <p class="list-title">FEATURES</p>
    <ul><li class="attached_on">ABS</li><li class="attached_on">Leather Seat</li></ul>
  </div>
  <div class="remarks">
    <p class="list-title">SELLING POINTS</p>
    <ul><li class="attached_on">Non Smoker</li></ul>
  </div>
  <script type="text/javascript">var gallery_images = JSON.parse('["https:\/\/image-cdn.beforward.jp\/large\/202602\/14244419\/CC227877_1ce601b3.jpg"]');</script>
</body>
</html>
`;

describe("beforward_porsche_collector detail parser", () => {
  it("parses detail html and extracts key fields", () => {
    const parsed = parseDetailHtml(SAMPLE_HTML);
    expect(parsed.refNo).toBe("CC227877");
    expect(parsed.sourceStatus).toBe("In-Stock");
    expect(parsed.schemaPriceUsd).toBe(61160);
    expect(parsed.model).toBe("911");
    expect(parsed.modelCode).toBe("991H1");
    expect(parsed.features).toContain("ABS");
    expect(parsed.sellingPoints).toContain("Non Smoker");
    expect(parsed.images.length).toBe(1);
  });

  it("classifies a 17-character chassis number as a VIN while retaining chassisNo", () => {
    const html = SAMPLE_HTML.replace(
      "</table>",
      '<tr><th class="gray">Chassis No.</th><td>wp0aa299xys123456</td></tr></table>',
    );

    const parsed = parseDetailHtml(html);

    expect(parsed.vin).toBe("WP0AA299XYS123456");
    expect(parsed.chassisNo).toBe("WP0AA299XYS123456");
  });

  it("keeps shorter source-native chassis values out of vin", () => {
    const html = SAMPLE_HTML.replace(
      "</table>",
      '<tr><th class="gray">Chassis No.</th><td>WP0ZZZ99Z</td></tr></table>',
    );

    const parsed = parseDetailHtml(html);

    expect(parsed.vin).toBeNull();
    expect(parsed.chassisNo).toBe("WP0ZZZ99Z");
  });
});
