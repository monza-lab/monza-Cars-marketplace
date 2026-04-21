import type { Country, Source } from "./types";

export interface DutyRule {
  country: Country;
  standardRatePct: number;
  ageExemption?: {
    yearsOld: number;
    ratePct: number;
    note: string;
  };
  source: Source;
}

export const DUTY_RULES: Record<Country, DutyRule> = {
  US: {
    country: "US",
    standardRatePct: 2.5,
    ageExemption: {
      yearsOld: 25,
      ratePct: 0,
      note: "25-year US import rule: 0% customs duty applied.",
    },
    source: {
      name: "US Harmonized Tariff Schedule, Heading 8703",
      url: "https://hts.usitc.gov/",
      lastReviewed: "2026-04-20",
    },
  },
  DE: {
    country: "DE",
    standardRatePct: 10,
    source: {
      name: "EU Combined Nomenclature code 8703",
      url: "https://taxation-customs.ec.europa.eu/",
      lastReviewed: "2026-04-20",
    },
  },
  UK: {
    country: "UK",
    standardRatePct: 10,
    ageExemption: {
      yearsOld: 30,
      ratePct: 5,
      note: "Historic vehicle (≥30 yrs): reduced 5% duty applied.",
    },
    source: {
      name: "UK Trade Tariff",
      url: "https://www.gov.uk/trade-tariff",
      lastReviewed: "2026-04-20",
    },
  },
  JP: {
    country: "JP",
    standardRatePct: 0,
    source: {
      name: "Japan Customs Tariff Schedule",
      url: "https://www.customs.go.jp/",
      lastReviewed: "2026-04-20",
    },
  },
};
