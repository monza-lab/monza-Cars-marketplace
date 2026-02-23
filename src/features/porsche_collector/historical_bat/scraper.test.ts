import { describe, expect, it } from "vitest";

import { mapCompletedItem } from "./scraper";

describe("historical bat sold date extraction", () => {
  it("extracts sold date from sold_text", () => {
    const mapped = mapCompletedItem({
      id: 108904112,
      url: "https://bringatrailer.com/listing/1998-porsche-911-carrera-4s-40/",
      title: "34k-Mile 1998 Porsche 911 Carrera 4S Coupe 6-Speed",
      sold_text: "Sold for USD $205,000 on 2/20/26",
      current_bid: 205000,
      currency: "USD",
    });
    expect(mapped.sale_date).toBe("2026-02-20");
    expect(mapped.sale_date_confidence).toBe("sold_text");
    expect(mapped.status).toBe("sold");
  });

  it("marks unsold when sold_text is bid to", () => {
    const mapped = mapCompletedItem({
      id: 9,
      url: "https://bringatrailer.com/listing/test-9/",
      title: "1999 Porsche 911",
      sold_text: "Bid to USD $40,000 on 2/20/26",
    });
    expect(mapped.status).toBe("unsold");
  });
});
