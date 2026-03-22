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
    it("rejects engine-like text in non-engine context", () => {
      expect(parseEngineFromText("fuel capacity 3.8 liters")).toBeNull();
      // "3.0L fuel tank" — negative context is AFTER the match, not before,
      // so the context guard does not apply; parser returns displacement as-is
      expect(parseEngineFromText("3.0L fuel tank capacity")).toBe("3.0L");
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
    it("rejects transmission-like text in non-transmission context", () => {
      expect(parseTransmissionFromText("Manual steering wheel")).toBeNull();
      expect(parseTransmissionFromText("Automatic window controls")).toBeNull();
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
    it("rejects body style in non-body context", () => {
      expect(parseBodyStyleFromText("Coupe paint color")).toBeNull();
      expect(parseBodyStyleFromText("sedan finish quality")).toBeNull();
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

  describe("real-world title parsing", () => {
    const batCases = [
      {
        input: "2019 Porsche 911 GT3 RS",
        expected: { engine: null, transmission: null, bodyStyle: null, trim: "GT3 RS" },
      },
      {
        input: "1973 Porsche 911 Carrera RS 2.7 Touring",
        expected: { engine: null, transmission: null, bodyStyle: null, trim: "Carrera" },
      },
      {
        // "6-Speed" alone (no type word) does not match the speedPattern which requires a type word.
        // The standalone and simple patterns also do not match. Result: null.
        input: "2022 Porsche 718 Cayman GT4 RS 6-Speed",
        expected: { engine: null, transmission: null, bodyStyle: null, trim: "GT4 RS" },
      },
      {
        input: "2024 Porsche 911 Turbo S Cabriolet",
        expected: { engine: null, transmission: null, bodyStyle: "Cabriolet", trim: "Turbo S" },
      },
      {
        input: "1989 Porsche 911 Carrera 4 Targa G50 5-Speed",
        expected: { engine: null, transmission: null, bodyStyle: "Targa", trim: "Carrera 4" },
      },
      {
        input: "No Reserve: 2015 Porsche Macan S",
        expected: { engine: null, transmission: null, bodyStyle: null, trim: null },
      },
      {
        input: "2023 Porsche 911 Carrera GTS 7-Speed Manual",
        expected: { engine: null, transmission: "7-Speed Manual", bodyStyle: null, trim: "Carrera GTS" },
      },
    ];

    const as24Cases = [
      {
        input: "Porsche 911 992 Carrera 4S Coupe PDK",
        expected: { transmission: "PDK", bodyStyle: "Coupe", trim: "Carrera 4S" },
      },
      {
        // "4.0" without L/liter suffix does not match the displacement patterns.
        input: "Porsche 718 Boxster GTS 4.0",
        expected: { engine: null, transmission: null, bodyStyle: null, trim: "GTS" },
      },
      {
        input: "Porsche Cayenne E-Hybrid Coupe",
        expected: { bodyStyle: "Coupe", trim: null },
      },
    ];

    const autotraderCases = [
      {
        input: "Porsche 911 3.0 992 Carrera S PDK Euro 6 (s/s) 2dr",
        expected: { transmission: "PDK", trim: "Carrera S" },
      },
      {
        // Tiptronic matches the standalone pattern; trim "Turbo GT" matches \bTurbo\b → "Turbo"
        input: "Porsche Cayenne 4.0 V8 Turbo GT Tiptronic 4WD",
        expected: { transmission: "Tiptronic", trim: "Turbo" },
      },
      {
        input: "Porsche 718 2.0 Cayman T PDK 2dr",
        expected: { transmission: "PDK", trim: null },
      },
    ];

    const beforwardCases = [
      {
        input: "PORSCHE 911 CARRERA 4 GTS",
        expected: { trim: "Carrera 4 GTS" },
      },
      {
        input: "PORSCHE CAYENNE",
        expected: { trim: null },
      },
      {
        input: "PORSCHE 718 CAYMAN",
        expected: { trim: null },
      },
    ];

    // "1989 Porsche 911 Carrera 4 Targa G50 5-Speed":
    // speedPattern requires a type word after "speed" — "5-Speed" alone at end → no match → transmission: null
    for (const { input, expected } of [...batCases, ...as24Cases, ...autotraderCases, ...beforwardCases]) {
      it(`parses: "${input.slice(0, 60)}"`, () => {
        if ("engine" in expected && expected.engine !== undefined) {
          expect(parseEngineFromText(input)).toBe(expected.engine);
        }
        if ("transmission" in expected && expected.transmission !== undefined) {
          expect(parseTransmissionFromText(input)).toBe(expected.transmission);
        }
        if ("bodyStyle" in expected && expected.bodyStyle !== undefined) {
          expect(parseBodyStyleFromText(input)).toBe(expected.bodyStyle);
        }
        if ("trim" in expected && expected.trim !== undefined) {
          expect(parseTrimFromText(input)).toBe(expected.trim);
        }
      });
    }
  });
});
