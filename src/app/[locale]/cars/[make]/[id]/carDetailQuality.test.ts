import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("car detail report teaser", () => {
  it("uses one consolidated explanation instead of repeating empty-section placeholders", () => {
    const source = readFileSync(resolve(__dirname, "CarDetailClient.tsx"), "utf8");
    expect(source.match(/What the Haus Report adds/g)).toHaveLength(1);
    expect(source).not.toContain("Included in the Haus Report");
  });
});
