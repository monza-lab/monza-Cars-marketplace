import { describe, it, expect } from "vitest";
import { buildCaptionPrompt, parseCaptionResponse } from "./captionGenerator";
import type { ListingRow, ComparablesSummary } from "../types";

const LISTING: ListingRow = {
  id: "abc-123",
  title: "40k-Mile 2004 Porsche 911 GT3",
  year: 2004,
  make: "Porsche",
  model: "911",
  trim: "GT3",
  platform: "BRING_A_TRAILER",
  photos_count: 10,
  data_quality_score: 90,
  images: [],
  final_price: null,
  current_bid: 165000,
  engine: "3.6-Liter Mezger Flat-Six",
  transmission: "Six-Speed Manual Transaxle",
  mileage: 40000,
  color_exterior: "Cobalt Blue",
  color_interior: null,
  location: "United States",
  reserve_status: null,
  seller_notes: null,
  status: "active",
  created_at: "2026-04-15T00:00:00Z",
};

const COMPS: ComparablesSummary = {
  avg: 152000, low: 128000, high: 195000,
  sampleSize: 14, windowMonths: 12,
  thisPrice: 165000, deltaPct: 8.5,
};

describe("buildCaptionPrompt", () => {
  it("includes listing details and comparables", () => {
    const p = buildCaptionPrompt(LISTING, COMPS, "The 996.1 GT3 is...");
    expect(p).toContain("Mezger");
    expect(p).toContain("152000");
    expect(p).toContain("monzahaus.com");
  });

  it("works when comparables are null", () => {
    const p = buildCaptionPrompt(LISTING, null, "thesis");
    expect(p).toContain("Mezger");
    expect(p.toLowerCase()).toContain("no recent comparables");
  });
});

describe("parseCaptionResponse", () => {
  it("parses valid JSON", () => {
    const raw = '{"caption": "A Mezger GT3.\\n\\nClean example.\\n\\nFull report at monzahaus.com/cars/porsche/abc-123/report", "hashtags": ["mezger", "gt3"]}';
    const out = parseCaptionResponse(raw);
    expect(out.caption).toContain("Mezger");
    expect(out.hashtags).toEqual(["mezger", "gt3"]);
  });

  it("strips code fences", () => {
    const raw = '```json\n{"caption": "x", "hashtags": []}\n```';
    expect(parseCaptionResponse(raw).caption).toBe("x");
  });

  it("extracts JSON object from surrounding prose", () => {
    const raw = 'Here you go: {"caption": "foo", "hashtags": []} — enjoy!';
    expect(parseCaptionResponse(raw).caption).toBe("foo");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseCaptionResponse("bad")).toThrow();
  });
});
