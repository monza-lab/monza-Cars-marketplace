export type Country = "US" | "DE" | "UK" | "JP";

export type OriginCountry = Country | "IT" | "BE" | "NL";

export type Currency = "USD" | "EUR" | "GBP" | "JPY";

export interface Money {
  amount: number;
  currency: Currency;
}

export interface Range {
  min: number;
  max: number;
  currency: Currency;
}

export interface Source {
  name: string;
  url?: string;
  lastReviewed: string;
}

export interface CarInput {
  priceUsd: number;
  year: number;
}

export interface ConsolidatedSources {
  duty: Source;
  tax: Source;
  shipping: Source[];
  marineInsurance: Source;
  portAndBroker: Source;
  registration: Source;
  lastReviewedOverall: string;
}

export interface LandedCostBreakdown {
  destination: Country;
  origin: OriginCountry;
  currency: Currency;

  carPriceLocal: Range;

  shipping: Range;
  marineInsurance: Range;
  customsDuty: Range;
  vatOrSalesTax: Range;
  portAndBroker: Range;
  registration: Range;

  importCosts: Range;

  landedCost: Range;

  notes: string[];

  usedProxyFor?: OriginCountry;

  sourcesUsed: ConsolidatedSources;
}
