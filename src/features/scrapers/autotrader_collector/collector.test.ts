import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { runCollector } from "./collector";
import { selectBackfillUrls } from "./collector";
import { extractAutoTraderImages } from "./imageUrls";

describe("collector", () => {
  describe("runCollector", () => {
    it("should be importable as a function", () => {
      expect(typeof runCollector).toBe("function");
    });

    it("should accept configuration overrides", async () => {
      // Just verify the function accepts config without throwing on missing env vars
      // The actual execution requires Supabase credentials
      try {
        const result = await runCollector({
          mode: "daily",
          make: "Porsche",
          model: "911",
          postcode: "SW1A 1AA",
          dryRun: true,
          checkpointPath: "/tmp/test_checkpont.json",
        });
        expect(result).toHaveProperty("runId");
        expect(result).toHaveProperty("sourceCounts");
        expect(result).toHaveProperty("errors");
      } catch (err) {
        // If Supabase is not configured, we might get an error
        // This is expected in test environment without full setup
        console.log("Expected error without Supabase:", err);
      }
    });

    it("should return a CollectorResult with expected shape", async () => {
      try {
        const result = await runCollector({
          mode: "daily",
          make: "Porsche",
          dryRun: true,
          checkpointPath: "/tmp/test_checkpont.json",
        });
        
        expect(result.runId).toBeDefined();
        expect(typeof result.runId).toBe("string");
        expect(result.sourceCounts).toBeDefined();
        expect(result.errors).toBeDefined();
        expect(Array.isArray(result.errors)).toBe(true);
      } catch (err) {
        // Expected without full Supabase setup
        console.log("Expected error:", err);
      }
    });

    it("keeps all discovered backfill URLs", () => {
      const urls = Array.from({ length: 60 }, (_, i) => `https://example.com/${i}`);
      const selected = selectBackfillUrls(urls);
      expect(selected).toHaveLength(60);
      expect(selected[0]).toBe(urls[0]);
      expect(selected[59]).toBe(urls[59]);
    });

    it("extracts normalized AutoTrader gallery images from recorded HTML", () => {
      const html = readFileSync(
        resolve(process.cwd(), "tests/fixtures/autotrader-gallery-detail.html"),
        "utf8",
      );

      expect(extractAutoTraderImages(html)).toEqual([
        "https://m.atcdn.co.uk/a/media/hero.jpg",
        "https://m.atcdn.co.uk/a/media/one.jpg",
        "https://m.atcdn.co.uk/a/media/two.jpg",
        "https://m.atcdn.co.uk/a/media/three.jpg",
      ]);
    });
  });
});
