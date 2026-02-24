import { describe, expect, it } from "vitest";

import { canonicalizeUrl, deriveSourceId } from "./id";

describe("beforward_porsche_collector id", () => {
  it("canonicalizes URLs and strips tracking params", () => {
    const out = canonicalizeUrl("/porsche/911/cc227877/id/14244419/?utm_source=x#abc");
    expect(out).toBe("https://www.beforward.jp/porsche/911/cc227877/id/14244419/");
  });

  it("prefers ref no source id", () => {
    const out = deriveSourceId({
      refNo: "CC227877",
      sourceUrl: "https://www.beforward.jp/porsche/911/cc227877/id/14244419/",
    });
    expect(out).toBe("bf-CC227877");
  });

  it("falls back to vehicle id", () => {
    const out = deriveSourceId({
      refNo: null,
      sourceUrl: "https://www.beforward.jp/porsche/911/cc227877/id/14244419/",
    });
    expect(out).toBe("bf-id-14244419");
  });
});
