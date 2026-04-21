import type { Country, Currency, Range, Source } from "./types";

export interface FeeSet {
  country: Country;
  currency: Currency;
  marineInsurancePctRange: { minPct: number; maxPct: number };
  portAndBroker: Range;
  registration: Range;
  sources: {
    marineInsurance: Source;
    portAndBroker: Source;
    registration: Source;
  };
}

const INSURANCE_NOTE_STD: Source = {
  name: "Industry standard 1.5–2.5% of CIF (Lloyds/classic-auto cargo carriers)",
  lastReviewed: "2026-04-20",
};

export const FEES: Record<Country, FeeSet> = {
  US: {
    country: "US",
    currency: "USD",
    marineInsurancePctRange: { minPct: 1.5, maxPct: 2.5 },
    portAndBroker: { min: 800, max: 1500, currency: "USD" },
    registration: { min: 200, max: 500, currency: "USD" },
    sources: {
      marineInsurance: INSURANCE_NOTE_STD,
      portAndBroker: {
        name: "US CBP broker schedule + LA/NY port handling averages",
        url: "https://www.cbp.gov/",
        lastReviewed: "2026-04-20",
      },
      registration: {
        name: "State DMV registration fee averages (CA/FL/NY/TX weighted)",
        lastReviewed: "2026-04-20",
      },
    },
  },
  DE: {
    country: "DE",
    currency: "EUR",
    marineInsurancePctRange: { minPct: 1.5, maxPct: 2.5 },
    portAndBroker: { min: 700, max: 1400, currency: "EUR" },
    registration: { min: 150, max: 400, currency: "EUR" },
    sources: {
      marineInsurance: INSURANCE_NOTE_STD,
      portAndBroker: {
        name: "Hamburg/Bremerhaven port handling + German broker (Zoll) fees",
        lastReviewed: "2026-04-20",
      },
      registration: {
        name: "KBA / Landeseinwohneramt registration fees",
        lastReviewed: "2026-04-20",
      },
    },
  },
  UK: {
    country: "UK",
    currency: "GBP",
    marineInsurancePctRange: { minPct: 1.5, maxPct: 2.5 },
    portAndBroker: { min: 600, max: 1200, currency: "GBP" },
    registration: { min: 150, max: 300, currency: "GBP" },
    sources: {
      marineInsurance: INSURANCE_NOTE_STD,
      portAndBroker: {
        name: "Southampton/Felixstowe port + HMRC broker fees",
        url: "https://www.gov.uk/guidance/import-customs-clearance",
        lastReviewed: "2026-04-20",
      },
      registration: {
        name: "DVLA first-registration fee + V55/5",
        url: "https://www.gov.uk/vehicle-registration",
        lastReviewed: "2026-04-20",
      },
    },
  },
  JP: {
    country: "JP",
    currency: "JPY",
    marineInsurancePctRange: { minPct: 1.5, maxPct: 2.5 },
    portAndBroker: { min: 80000, max: 150000, currency: "JPY" },
    registration: { min: 30000, max: 80000, currency: "JPY" },
    sources: {
      marineInsurance: INSURANCE_NOTE_STD,
      portAndBroker: {
        name: "Yokohama/Kobe port handling + Nippon Customs broker fees",
        url: "https://www.customs.go.jp/",
        lastReviewed: "2026-04-20",
      },
      registration: {
        name: "Rikuun (陸運局) new-vehicle registration",
        lastReviewed: "2026-04-20",
      },
    },
  },
};
