import type { Country, Range, Source } from "./types";

export const SHIPPING_RATES: Record<
  Country,
  Record<Country, Range | null>
> = {
  US: {
    US: null,
    DE: { min: 2500, max: 4800, currency: "EUR" },
    UK: { min: 2200, max: 4200, currency: "GBP" },
    JP: { min: 2500000, max: 4500000, currency: "JPY" },
  },
  DE: {
    US: { min: 2800, max: 5200, currency: "USD" },
    DE: null,
    UK: { min: 900, max: 1800, currency: "GBP" },
    JP: { min: 3000000, max: 5500000, currency: "JPY" },
  },
  UK: {
    US: { min: 2600, max: 4800, currency: "USD" },
    DE: { min: 1200, max: 2400, currency: "EUR" },
    UK: null,
    JP: { min: 3200000, max: 5800000, currency: "JPY" },
  },
  JP: {
    US: { min: 2200, max: 4500, currency: "USD" },
    DE: { min: 3200, max: 5500, currency: "EUR" },
    UK: { min: 2800, max: 4800, currency: "GBP" },
    JP: null,
  },
};

export const SHIPPING_SOURCES: Source[] = [
  {
    name: "West Coast Shipping",
    url: "https://www.westcoastshipping.com/",
    lastReviewed: "2026-04-20",
  },
  {
    name: "Schumacher Cargo Logistics",
    url: "https://www.schumachercargo.com/",
    lastReviewed: "2026-04-20",
  },
  {
    name: "Kayser Enterprises",
    lastReviewed: "2026-04-20",
  },
  {
    name: "CFR Classic",
    url: "https://www.cfrclassic.com/",
    lastReviewed: "2026-04-20",
  },
  {
    name: "Montway Auto Transport",
    url: "https://www.montway.com/",
    lastReviewed: "2026-04-20",
  },
];
