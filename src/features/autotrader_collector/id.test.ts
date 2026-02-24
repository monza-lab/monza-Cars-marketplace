import { describe, it, expect } from "vitest";
import { canonicalizeUrl, deriveSourceId, truncateTo200 } from "./id";

describe("id", () => {
  describe("truncateTo200", () => {
    it("should return string unchanged if <= 200 chars", () => {
      expect(truncateTo200("short")).toBe("short");
      expect(truncateTo200("a".repeat(200))).toBe("a".repeat(200));
    });

    it("should truncate strings longer than 200 chars", () => {
      const long = "a".repeat(250);
      expect(truncateTo200(long)).toBe("a".repeat(200));
    });
  });

  describe("canonicalizeUrl", () => {
    it("should remove hash", () => {
      expect(canonicalizeUrl("https://example.com/page#section")).toBe("https://example.com/page");
    });

    it("should remove utm_ params", () => {
      const url = "https://example.com/page?utm_source=test&utm_medium=email";
      expect(canonicalizeUrl(url)).toBe("https://example.com/page");
    });

    it("should remove ref and fbclid", () => {
      const url = "https://example.com/page?ref=abc&fbclid=xyz";
      expect(canonicalizeUrl(url)).toBe("https://example.com/page");
    });

    it("should return invalid URL unchanged", () => {
      expect(canonicalizeUrl("not-a-url")).toBe("not-a-url");
    });

    it("should preserve other query params", () => {
      const url = "https://example.com/page?make=Porsche&model=911";
      expect(canonicalizeUrl(url)).toBe("https://example.com/page?make=Porsche&model=911");
    });
  });

  describe("deriveSourceId", () => {
    it("should use explicit sourceId if provided", () => {
      const result = deriveSourceId({
        source: "AutoTrader",
        sourceId: "explicit-id-123",
        sourceUrl: "https://www.autotrader.co.uk/car-details/123456789",
      });
      expect(result).toBe("explicit-id-123");
    });

    it("should extract ID from /car-details/ URL pattern", () => {
      const result = deriveSourceId({
        source: "AutoTrader",
        sourceUrl: "https://www.autotrader.co.uk/car-details/2023-Porsche-911/123456789",
      });
      expect(result).toBe("at-123456789");
    });

    it("should extract ID from /vehicle/ URL pattern", () => {
      const result = deriveSourceId({
        source: "AutoTrader",
        sourceUrl: "https://www.autotrader.co.uk/vehicle/2023-porsche-911-12345678",
      });
      expect(result).toBe("at-12345678");
    });

    it("should extract ID from /used-car/ URL pattern", () => {
      const result = deriveSourceId({
        source: "AutoTrader",
        sourceUrl: "https://www.autotrader.co.uk/used-car/porsche/911/12345678",
      });
      expect(result).toBe("at-12345678");
    });

    it("should use hash fallback for unknown URL patterns", () => {
      const result = deriveSourceId({
        source: "AutoTrader",
        sourceUrl: "https://www.autotrader.co.uk/unknown/123",
      });
      // Should be autotrader-{sha256 hash}
      expect(result).toMatch(/^autotrader-[a-f0-9]{32}$/);
    });

    it("should handle empty sourceId gracefully", () => {
      const result = deriveSourceId({
        source: "AutoTrader",
        sourceId: "",
        sourceUrl: "https://www.autotrader.co.uk/car-details/2023-Porsche-911/123456789",
      });
      expect(result).toBe("at-123456789");
    });

    it("should handle null sourceId", () => {
      const result = deriveSourceId({
        source: "AutoTrader",
        sourceId: null,
        sourceUrl: "https://www.autotrader.co.uk/car-details/2023-Porsche-911/123456789",
      });
      expect(result).toBe("at-123456789");
    });

    it("should truncate sourceId to 200 chars", () => {
      const result = deriveSourceId({
        source: "AutoTrader",
        sourceId: "a".repeat(250),
        sourceUrl: "https://www.autotrader.co.uk/car-details/123456789",
      });
      expect(result.length).toBe(200);
    });
  });
});
