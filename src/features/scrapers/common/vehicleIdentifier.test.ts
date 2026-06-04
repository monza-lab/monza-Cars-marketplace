import { describe, expect, it } from "vitest";

import { classifyVehicleIdentifier, extractVehicleIdentifierFromText } from "./vehicleIdentifier";

describe("classifyVehicleIdentifier", () => {
  it("accepts a 17-character VIN candidate", () => {
    expect(classifyVehicleIdentifier("WP0AA299XYS123456")).toEqual({
      raw: "WP0AA299XYS123456",
      normalized: "WP0AA299XYS123456",
      kind: "vin_17",
      sourceLabel: null,
    });
  });

  it("normalizes lowercase VINs to uppercase", () => {
    expect(classifyVehicleIdentifier("wp0aa299xys123456")?.normalized).toBe("WP0AA299XYS123456");
    expect(classifyVehicleIdentifier("wp0aa299xys123456")?.kind).toBe("vin_17");
  });

  it("rejects 17-character candidates containing I, O, or Q", () => {
    expect(classifyVehicleIdentifier("WP0AA299QYS123456")).toBeNull();
  });

  it("accepts labeled shorter chassis identifiers", () => {
    expect(classifyVehicleIdentifier("WP0ZZZ99Z", "Chassis No.")).toEqual({
      raw: "WP0ZZZ99Z",
      normalized: "WP0ZZZ99Z",
      kind: "chassis_or_serial",
      sourceLabel: "Chassis No.",
    });
  });

  it("rejects unlabeled short values", () => {
    expect(classifyVehicleIdentifier("WP0ZZZ99Z")).toBeNull();
  });

  it("removes obvious separators while preserving raw value", () => {
    expect(classifyVehicleIdentifier(" wp0-zzz 99z ", "Frame")?.normalized).toBe("WP0ZZZ99Z");
  });
});

describe("extractVehicleIdentifierFromText", () => {
  it("extracts a labeled VIN from generic text", () => {
    const result = extractVehicleIdentifierFromText("Factory data VIN: WP0AA299XYS123456.");
    expect(result?.kind).toBe("vin_17");
    expect(result?.normalized).toBe("WP0AA299XYS123456");
    expect(result?.sourceLabel).toBe("VIN");
  });

  it("extracts a labeled chassis value from generic text", () => {
    const result = extractVehicleIdentifierFromText("Chassis number: WP0ZZZ99Z, matching engine.");
    expect(result).toEqual({
      raw: "WP0ZZZ99Z",
      normalized: "WP0ZZZ99Z",
      kind: "chassis_or_serial",
      sourceLabel: "Chassis number",
    });
  });

  it("extracts a punctuated chassis number label from generic text", () => {
    const result = extractVehicleIdentifierFromText("Chassis No.: 9113601234, matching engine.");
    expect(result).toEqual({
      raw: "9113601234",
      normalized: "9113601234",
      kind: "chassis_or_serial",
      sourceLabel: "Chassis No.",
    });
  });

  it("does not extract an unlabeled short identifier from body text", () => {
    expect(extractVehicleIdentifierFromText("Reference WP0ZZZ99Z is not labeled.")).toBeNull();
  });

  it("can fall back to an unlabeled 17-character VIN when enabled", () => {
    const result = extractVehicleIdentifierFromText("Listed with WP0AA299XYS123456 in the description.", {
      allowGenericVin: true,
    });
    expect(result?.normalized).toBe("WP0AA299XYS123456");
    expect(result?.sourceLabel).toBeNull();
  });
});
