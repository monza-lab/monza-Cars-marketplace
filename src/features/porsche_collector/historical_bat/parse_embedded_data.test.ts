import { describe, expect, it } from "vitest";

import { parseCompletedPayload } from "./parse_embedded_data";

describe("parse completed embedded payload", () => {
  it("extracts items and pagination from script tag", () => {
    const html = `
      <html><body>
      <script id="bat-theme-auctions-completed-initial-data" type="application/json">
      {"items":[{"id":1,"title":"1998 Porsche 911","url":"https://bringatrailer.com/listing/test","sold_text":"Sold for USD $200,000 on 2/20/26"}],"items_total":10,"page_current":1,"pages_total":5}
      </script>
      </body></html>
    `;
    const payload = parseCompletedPayload(html);
    expect(payload.items).toHaveLength(1);
    expect(payload.items_total).toBe(10);
    expect(payload.pages_total).toBe(5);
  });
});
