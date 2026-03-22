import { describe, it, expect, vi } from "vitest";
import { parseAutoTraderHtml } from "./detail";

describe("parseAutoTraderHtml", () => {
  it("returns all-null for empty HTML", () => {
    const result = parseAutoTraderHtml("<html><body></body></html>");
    expect(result.title).toBeNull();
    expect(result.price).toBeNull();
    expect(result.engine).toBeNull();
    expect(result.vin).toBeNull();
  });

  it("extracts title from h1", () => {
    const html = '<html><body><h1>2023 Porsche 911 GT3</h1></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.title).toBe("2023 Porsche 911 GT3");
  });

  it("extracts price from data-testid", () => {
    const html = '<html><body><span data-testid="price">£85,000</span></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.price).toBe(85000);
  });

  it("extracts mileage and detects unit", () => {
    const html = '<html><body><span data-testid="mileage">12,500 miles</span></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.mileage).toBe(12500);
    expect(result.mileageUnit).toBe("miles");
  });

  it("extracts VIN from body text using word boundary", () => {
    const html = '<html><body><p>VIN: WP0ZZZ99ZTS392145</p></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.vin).toBe("WP0ZZZ99ZTS392145");
  });

  it("does not extract VIN from short strings", () => {
    const html = '<html><body><p>Reference: ABC123</p></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.vin).toBeNull();
  });

  it("extracts engine from data-testid", () => {
    const html = '<html><body><span data-testid="engine">3.0L</span></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.engine).toBe("3.0L");
  });

  it("extracts transmission from class selector", () => {
    const html = '<html><body><span class="spec-transmission">Automatic</span></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.transmission).toBe("Automatic");
  });

  it("always returns null for bodyStyle and interiorColor", () => {
    const html = '<html><body><h1>Test</h1></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.bodyStyle).toBeNull();
    expect(result.interiorColor).toBeNull();
  });
});
