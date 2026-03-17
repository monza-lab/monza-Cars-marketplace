import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  decodeVinBatch,
  mapNhtsaToListingFields,
  type NhtsaDecodedVin,
  type VinEnrichmentFields,
} from "./nhtsaVinDecoder";

describe("nhtsaVinDecoder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("decodeVinBatch", () => {
    it("should decode a batch of VINs via NHTSA API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Count: 2,
          Results: [
            {
              VIN: "WP0AB2A71KS123456",
              Make: "PORSCHE",
              Model: "911",
              ModelYear: "2019",
              BodyClass: "Coupe",
              DriveType: "RWD",
              DisplacementL: "3.0",
              EngineCylinders: "6",
              EngineConfiguration: "Horizontally Opposed",
              FuelTypePrimary: "Gasoline",
              TransmissionStyle: "Manual",
              Doors: "2",
              ErrorCode: "0",
              ErrorText: "",
            },
            {
              VIN: "WP0CA2A85FS123789",
              Make: "PORSCHE",
              Model: "Cayman",
              ModelYear: "2015",
              BodyClass: "Coupe",
              DriveType: "RWD",
              DisplacementL: "2.7",
              EngineCylinders: "6",
              FuelTypePrimary: "Gasoline",
              TransmissionStyle: "Dual-Clutch",
              ErrorCode: "0",
              ErrorText: "",
            },
          ],
        }),
      });

      const results = await decodeVinBatch(["WP0AB2A71KS123456", "WP0CA2A85FS123789"]);
      expect(results).toHaveLength(2);
      expect(results[0].VIN).toBe("WP0AB2A71KS123456");
      expect(results[0].Make).toBe("PORSCHE");
      expect(results[0].DisplacementL).toBe("3.0");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/");
      expect(opts.method).toBe("POST");
      expect(opts.body).toContain("WP0AB2A71KS123456");
      expect(opts.body).toContain("WP0CA2A85FS123789");
    });

    it("should handle empty VIN array", async () => {
      const results = await decodeVinBatch([]);
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Server Error" });
      const results = await decodeVinBatch(["WP0AB2A71KS123456"]);
      expect(results).toEqual([]);
    });

    it("should filter out results with error codes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Count: 1,
          Results: [
            {
              VIN: "INVALID12345678901",
              ErrorCode: "1",
              ErrorText: "1 - Check Digit (9th position) does not calculate properly",
              Make: "",
              Model: "",
            },
          ],
        }),
      });
      const results = await decodeVinBatch(["INVALID12345678901"]);
      expect(results).toEqual([]);
    });
  });

  describe("mapNhtsaToListingFields", () => {
    it("should map NHTSA response to listing fields", () => {
      const decoded: NhtsaDecodedVin = {
        VIN: "WP0AB2A71KS123456",
        Make: "PORSCHE",
        Model: "911",
        ModelYear: "2019",
        BodyClass: "Coupe",
        DriveType: "RWD",
        DisplacementL: "3.0",
        EngineCylinders: "6",
        EngineConfiguration: "Horizontally Opposed",
        FuelTypePrimary: "Gasoline",
        TransmissionStyle: "Manual",
        Doors: "2",
        ErrorCode: "0",
        ErrorText: "",
      };
      const fields = mapNhtsaToListingFields(decoded);
      expect(fields.engine).toBe("3.0L Horizontally Opposed 6-Cylinder");
      expect(fields.transmission).toBe("Manual");
      expect(fields.bodyStyle).toBe("Coupe");
      expect(fields.driveType).toBe("RWD");
    });

    it("should handle partial data", () => {
      const decoded: NhtsaDecodedVin = {
        VIN: "WP0AB2A71KS123456", Make: "PORSCHE", Model: "", ModelYear: "",
        BodyClass: "", DriveType: "", DisplacementL: "3.0", EngineCylinders: "6",
        EngineConfiguration: "", FuelTypePrimary: "", TransmissionStyle: "",
        Doors: "", ErrorCode: "0", ErrorText: "",
      };
      const fields = mapNhtsaToListingFields(decoded);
      expect(fields.engine).toBe("3.0L 6-Cylinder");
      expect(fields.transmission).toBeNull();
      expect(fields.bodyStyle).toBeNull();
    });
  });
});
