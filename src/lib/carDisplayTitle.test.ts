import { describe, expect, it } from "vitest";
import { carDisplayTitle } from "./carDisplayTitle";

describe("carDisplayTitle", () => {
  it("builds an informative identity when a listing title is generic", () => {
    expect(carDisplayTitle({ year: 2009, make: "Porsche", model: "911", trim: "Carrera 4", title: "2009 Porsche" }))
      .toBe("2009 Porsche 911 Carrera 4");
  });

  it("keeps an already informative title", () => {
    expect(carDisplayTitle({ year: 2011, make: "Porsche", model: "911", trim: "GTS", title: "2011 Porsche 911 Carrera GTS" }))
      .toBe("2011 Porsche 911 Carrera GTS");
  });
});
