import { describe, expect, it } from "vitest";

import { parseDetailHtml } from "./detail";

describe("parseDetailHtml vehicle identifiers", () => {
  it("extracts JSON-LD vehicleIdentificationNumber", () => {
    const parsed = parseDetailHtml(`
      <html>
        <body>
          <h1>Porsche 911 Carrera</h1>
          <script type="application/ld+json">
            {
              "@type": "Car",
              "name": "Porsche 911 Carrera",
              "brand": { "name": "Porsche" },
              "vehicleIdentificationNumber": "WP0AA299XYS123456"
            }
          </script>
        </body>
      </html>
    `);

    expect(parsed.vin).toBe("WP0AA299XYS123456");
  });

  it("extracts labeled chassis values from detail specs", () => {
    const parsed = parseDetailHtml(`
      <html>
        <body>
          <h1>Porsche 356</h1>
          <dl data-testid="listing-details">
            <dt>Chassis number</dt>
            <dd>356A-12345</dd>
          </dl>
        </body>
      </html>
    `);

    expect(parsed.vin).toBe("356A12345");
  });
});

describe("parseDetailHtml target detail fields", () => {
  it("extracts transmission plus spec-table engine and European exterior colour", () => {
    const parsed = parseDetailHtml(`
      <html>
        <body>
          <h1>Porsche Taycan 4S</h1>
          <dl data-testid="listing-details">
            <dt>Transmission</dt>
            <dd>Automatic</dd>
            <dt>Engine size</dt>
            <dd>Electric</dd>
            <dt>Exterior colour</dt>
            <dd>Gentian Blue Metallic</dd>
          </dl>
        </body>
      </html>
    `);

    expect(parsed.transmission).toBe("Automatic");
    expect(parsed.engine).toBe("Electric");
    expect(parsed.exteriorColor).toBe("Gentian Blue Metallic");
  });

  it("extracts US spelling exterior color from detail specs", () => {
    const parsed = parseDetailHtml(`
      <html>
        <body>
          <h1>Porsche Macan GTS</h1>
          <dl data-testid="listing-details">
            <dt>Color</dt>
            <dd>Volcano Grey Metallic</dd>
            <dt>Displacement</dt>
            <dd>2,894 cc</dd>
            <dt>Gearbox</dt>
            <dd>Automatic</dd>
          </dl>
        </body>
      </html>
    `);

    expect(parsed.exteriorColor).toBe("Volcano Grey Metallic");
    expect(parsed.engine).toBe("2,894 cc");
    expect(parsed.transmission).toBe("Automatic");
  });
});
