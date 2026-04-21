import type { Country, Source } from "./types";

export interface TaxRule {
  country: Country;
  ratePct: number;
  label: string;
  ageReductionPct?: {
    yearsOld: number;
    ratePct: number;
    note: string;
  };
  source: Source;
}

export const TAX_RULES: Record<Country, TaxRule> = {
  US: {
    country: "US",
    ratePct: 6,
    label: "Sales tax (avg)",
    source: {
      name: "Avalara US state sales-tax averages",
      url: "https://www.avalara.com/us/en/learn/sales-tax/",
      lastReviewed: "2026-04-20",
    },
  },
  DE: {
    country: "DE",
    ratePct: 19,
    label: "VAT",
    ageReductionPct: {
      yearsOld: 30,
      ratePct: 7,
      note: "Historic (H-Kennzeichen eligible): reduced VAT applied.",
    },
    source: {
      name: "Bundesministerium der Finanzen — Umsatzsteuer",
      lastReviewed: "2026-04-20",
    },
  },
  UK: {
    country: "UK",
    ratePct: 20,
    label: "VAT",
    ageReductionPct: {
      yearsOld: 30,
      ratePct: 5,
      note: "Historic vehicle relief: reduced VAT applied.",
    },
    source: {
      name: "HMRC VAT rates",
      url: "https://www.gov.uk/vat-rates",
      lastReviewed: "2026-04-20",
    },
  },
  JP: {
    country: "JP",
    ratePct: 10,
    label: "Consumption tax",
    source: {
      name: "Japan National Tax Agency",
      url: "https://www.nta.go.jp/english/",
      lastReviewed: "2026-04-20",
    },
  },
};
