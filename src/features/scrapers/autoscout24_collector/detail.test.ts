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
