import { describe, it, expect } from "vitest";
import { parseVisionResponse, buildVisionPrompt } from "./visionScorer";

describe("buildVisionPrompt", () => {
  it("includes all scoring criteria", () => {
    const p = buildVisionPrompt(3);
    expect(p).toContain("framing");
    expect(p).toContain("lighting");
    expect(p).toContain("setting");
    expect(p).toContain("completeness");
    expect(p).toContain("watermarks");
    expect(p).toContain("JSON");
    expect(p).toContain("0-100");
  });
});

describe("parseVisionResponse", () => {
  it("parses valid JSON response", () => {
    const raw = '```json\n{"score": 85, "reasons": ["clean studio background", "sharp focus"], "best_photo_index": 0, "recommended_indices": [0, 2, 1]}\n```';
    const out = parseVisionResponse(raw, 5);
    expect(out.score).toBe(85);
    expect(out.best_photo_index).toBe(0);
    expect(out.recommended_indices).toEqual([0, 2, 1]);
  });

  it("parses JSON without code fences", () => {
    const raw = '{"score": 40, "reasons": ["blurry"], "best_photo_index": 0, "recommended_indices": [0]}';
    expect(parseVisionResponse(raw, 3).score).toBe(40);
  });

  it("clamps indices to image count", () => {
    const raw = '{"score": 80, "reasons": [], "best_photo_index": 99, "recommended_indices": [10, 20]}';
    const out = parseVisionResponse(raw, 5);
    expect(out.best_photo_index).toBeLessThan(5);
    expect(out.recommended_indices.every((i) => i < 5)).toBe(true);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseVisionResponse("not json", 3)).toThrow();
  });
});
