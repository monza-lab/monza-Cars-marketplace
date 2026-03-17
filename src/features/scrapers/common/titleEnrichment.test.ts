import { describe, it, expect } from "vitest";

import {
  parseEngineFromText,
  parseTransmissionFromText,
  parseBodyStyleFromText,
  parseTrimFromText,
} from "./titleEnrichment";

describe("titleEnrichment", () => {
  describe("parseEngineFromText", () => {
    it("should extract displacement + config", () => {
      expect(parseEngineFromText("2019 Porsche 911 3.0L Twin-Turbo")).toBe("3.0L Twin-Turbo");
    });
    it("should extract liter pattern with hyphen", () => {
      expect(parseEngineFromText("4.0-Liter Flat-Six")).toBe("4.0L Flat-Six");
    });
    it("should extract V8 pattern", () => {
      expect(parseEngineFromText("Ferrari 488 3.9L V8 Twin-Turbo")).toBe("3.9L V8 Twin-Turbo");
    });
    it("should extract flat-six without displacement", () => {
      expect(parseEngineFromText("Porsche 911 Flat-Six Engine")).toBe("Flat-Six");
    });
    it("should extract supercharged", () => {
      expect(parseEngineFromText("5.2L V10 Supercharged")).toBe("5.2L V10 Supercharged");
    });
    it("should return null for no engine info", () => {
      expect(parseEngineFromText("2020 Porsche Cayenne S")).toBeNull();
    });
    it("should not false-match on mileage text", () => {
      expect(parseEngineFromText("12,000 Miles")).toBeNull();
    });
  });

  describe("parseTransmissionFromText", () => {
    it("should extract N-speed manual", () => {
      expect(parseTransmissionFromText("6-Speed Manual")).toBe("6-Speed Manual");
    });
    it("should extract PDK", () => {
      expect(parseTransmissionFromText("7-Speed PDK")).toBe("7-Speed PDK");
    });
    it("should extract automatic", () => {
      expect(parseTransmissionFromText("8-Speed Automatic")).toBe("8-Speed Automatic");
    });
    it("should extract DCT", () => {
      expect(parseTransmissionFromText("7-Speed DCT")).toBe("7-Speed DCT");
    });
    it("should extract standalone manual/automatic", () => {
      expect(parseTransmissionFromText("Manual Transmission Porsche")).toBe("Manual");
    });
    it("should extract tiptronic", () => {
      expect(parseTransmissionFromText("5-Speed Tiptronic")).toBe("5-Speed Tiptronic");
    });
    it("should return null for no transmission", () => {
      expect(parseTransmissionFromText("2020 Porsche 911 Carrera")).toBeNull();
    });
  });

  describe("parseBodyStyleFromText", () => {
    it("should extract Coupe", () => {
      expect(parseBodyStyleFromText("2023 Porsche 911 Coupe")).toBe("Coupe");
    });
    it("should extract Cabriolet", () => {
      expect(parseBodyStyleFromText("911 Carrera Cabriolet")).toBe("Cabriolet");
    });
    it("should extract Targa", () => {
      expect(parseBodyStyleFromText("Porsche 911 Targa 4S")).toBe("Targa");
    });
    it("should extract Spider/Spyder", () => {
      expect(parseBodyStyleFromText("Ferrari 488 Spider")).toBe("Spider");
      expect(parseBodyStyleFromText("Porsche 718 Spyder")).toBe("Spyder");
    });
    it("should extract Convertible", () => {
      expect(parseBodyStyleFromText("BMW M4 Convertible")).toBe("Convertible");
    });
    it("should extract SUV", () => {
      expect(parseBodyStyleFromText("Porsche Cayenne SUV")).toBe("SUV");
    });
    it("should extract Sedan", () => {
      expect(parseBodyStyleFromText("Porsche Panamera Sedan")).toBe("Sedan");
    });
    it("should return null when no body style", () => {
      expect(parseBodyStyleFromText("2020 Porsche 911 Carrera 4S")).toBeNull();
    });
  });

  describe("parseTrimFromText", () => {
    it("should extract GT3 RS", () => {
      expect(parseTrimFromText("2023 Porsche 911 GT3 RS")).toBe("GT3 RS");
    });
    it("should extract GT3", () => {
      expect(parseTrimFromText("2022 Porsche 911 GT3")).toBe("GT3");
    });
    it("should extract Turbo S", () => {
      expect(parseTrimFromText("Porsche 911 Turbo S")).toBe("Turbo S");
    });
    it("should extract Turbo", () => {
      expect(parseTrimFromText("Porsche 911 Turbo")).toBe("Turbo");
    });
    it("should extract Carrera GTS", () => {
      expect(parseTrimFromText("2024 Porsche 911 Carrera GTS")).toBe("Carrera GTS");
    });
    it("should extract standalone GTS", () => {
      expect(parseTrimFromText("2024 Porsche Cayenne GTS")).toBe("GTS");
    });
    it("should extract Carrera 4S", () => {
      expect(parseTrimFromText("Porsche 911 Carrera 4S")).toBe("Carrera 4S");
    });
    it("should extract Carrera S", () => {
      expect(parseTrimFromText("Porsche 911 Carrera S")).toBe("Carrera S");
    });
    it("should extract GT4", () => {
      expect(parseTrimFromText("718 Cayman GT4")).toBe("GT4");
    });
    it("should return null for base model", () => {
      expect(parseTrimFromText("2023 Porsche Cayenne")).toBeNull();
    });
  });
});
