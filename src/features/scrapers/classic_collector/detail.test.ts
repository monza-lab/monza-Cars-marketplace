import { describe, expect, it } from "vitest";

import { parseClassicDetailContent } from "./detail";

describe("parseClassicDetailContent", () => {
  it("extracts active for-sale prices from Classic.com detail text", () => {
    const parsed = parseClassicDetailContent({
      title: "1974 Porsche 911 Carrera",
      images: [],
      bodyText: [
        "FOR SALE",
        "$76,711",
        "Specs",
        "Year",
        "1974",
        "Make",
        "Porsche",
        "Model Family",
        "911",
      ].join("\n"),
    }, "https://www.classic.com/veh/1974-porsche-911/");

    expect(parsed.raw.status).toBe("forsale");
    expect(parsed.raw.price).toBe(76711);
  });
});
