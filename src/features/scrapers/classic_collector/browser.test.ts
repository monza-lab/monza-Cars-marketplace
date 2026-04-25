import { describe, it, expect } from "vitest";
import { buildLaunchOptions } from "./browser";

describe("classic_collector buildLaunchOptions", () => {
  it("returns headless launch options", () => {
    const opts = buildLaunchOptions({ headless: true });
    expect(opts.headless).toBe(true);
    expect(opts.args).toBeDefined();
  });
});
