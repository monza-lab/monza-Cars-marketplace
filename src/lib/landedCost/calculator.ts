import type {
  CarInput,
  ConsolidatedSources,
  Country,
  Currency,
  LandedCostBreakdown,
  OriginCountry,
} from "./types";
import { DUTY_RULES } from "./duties";
import { TAX_RULES } from "./taxes";
import { FEES } from "./fees";
import { SHIPPING_RATES, SHIPPING_SOURCES } from "./shipping";
import { getExchangeRates, fromUsd } from "@/lib/exchangeRates";

export interface RateResolution {
  ratePct: number;
  note: string | null;
}

export function resolveDutyRate(country: Country, ageYears: number): RateResolution {
  const rule = DUTY_RULES[country];
  if (rule.ageExemption && ageYears >= rule.ageExemption.yearsOld) {
    return { ratePct: rule.ageExemption.ratePct, note: rule.ageExemption.note };
  }
  return { ratePct: rule.standardRatePct, note: null };
}

export function resolveVatRate(country: Country, ageYears: number): RateResolution {
  const rule = TAX_RULES[country];
  if (rule.ageReductionPct && ageYears >= rule.ageReductionPct.yearsOld) {
    return { ratePct: rule.ageReductionPct.ratePct, note: rule.ageReductionPct.note };
  }
  return { ratePct: rule.ratePct, note: null };
}

export function consolidateSources(params: {
  destination: Country;
}): ConsolidatedSources {
  const duty = DUTY_RULES[params.destination].source;
  const tax = TAX_RULES[params.destination].source;
  const fees = FEES[params.destination];
  const marineInsurance = fees.sources.marineInsurance;
  const portAndBroker = fees.sources.portAndBroker;
  const registration = fees.sources.registration;
  const shipping = SHIPPING_SOURCES;

  const allDates = [
    duty.lastReviewed,
    tax.lastReviewed,
    marineInsurance.lastReviewed,
    portAndBroker.lastReviewed,
    registration.lastReviewed,
    ...shipping.map((s) => s.lastReviewed),
  ];
  const lastReviewedOverall = allDates.reduce((a, b) => (a > b ? a : b));

  return {
    duty,
    tax,
    shipping,
    marineInsurance,
    portAndBroker,
    registration,
    lastReviewedOverall,
  };
}

const DEST_CURRENCY: Record<Country, Currency> = {
  US: "USD",
  DE: "EUR",
  UK: "GBP",
  JP: "JPY",
};

const EU_PROXY_ORIGINS: OriginCountry[] = ["IT", "BE", "NL"];

function resolveEffectiveOrigin(origin: OriginCountry): {
  effective: Country;
  proxied: OriginCountry | undefined;
} {
  if (EU_PROXY_ORIGINS.includes(origin)) {
    return { effective: "DE", proxied: origin };
  }
  return { effective: origin as Country, proxied: undefined };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function calculateLandedCost(input: {
  car: CarInput;
  origin: OriginCountry;
  destination: Country;
}): Promise<LandedCostBreakdown | null> {
  const { car, origin, destination } = input;

  // Guard 1: invalid price.
  if (!car.priceUsd || car.priceUsd <= 0) return null;

  // Guard 2: invalid origin (not in OriginCountry union).
  const validOrigins: OriginCountry[] = ["US", "DE", "UK", "JP", "IT", "BE", "NL"];
  if (!validOrigins.includes(origin)) return null;

  // Guard 3: origin resolves to same country as destination → domestic.
  const { effective: effectiveOrigin, proxied } = resolveEffectiveOrigin(origin);
  if (effectiveOrigin === destination) return null;

  // Guard 4: shipping pair must exist.
  const shipping = SHIPPING_RATES[effectiveOrigin][destination];
  if (!shipping) return null;

  const rates = await getExchangeRates();
  const currency = DEST_CURRENCY[destination];

  // Convert price to destination currency.
  const priceLocal = Math.round(fromUsd(car.priceUsd, currency, rates));
  const notes: string[] = [];

  // Age.
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  let age = 0;
  if (!car.year || car.year <= 0) {
    notes.push("Year unknown; duty rate not optimized for age exemption.");
  } else {
    age = Math.max(0, currentYear - car.year);
  }

  // Proxy note.
  if (proxied) {
    notes.push(
      `Shipping estimated via Northern European hub (Bremerhaven); actual port of origin in ${proxied} may vary by ±10–15%.`,
    );
  }

  const fees = FEES[destination];

  // Insurance range = price × pct / 100.
  const insMin = round2(priceLocal * (fees.marineInsurancePctRange.minPct / 100));
  const insMax = round2(priceLocal * (fees.marineInsurancePctRange.maxPct / 100));

  // CIF.
  const cifMin = priceLocal + shipping.min + insMin;
  const cifMax = priceLocal + shipping.max + insMax;

  // Duty.
  const duty = resolveDutyRate(destination, age);
  if (duty.note) notes.push(duty.note);
  const dutyMin = round2((cifMin * duty.ratePct) / 100);
  const dutyMax = round2((cifMax * duty.ratePct) / 100);

  // VAT / sales tax.
  const vat = resolveVatRate(destination, age);
  if (vat.note) notes.push(vat.note);
  const vatMin = round2(((cifMin + dutyMin) * vat.ratePct) / 100);
  const vatMax = round2(((cifMax + dutyMax) * vat.ratePct) / 100);

  // Fees.
  const portMin = fees.portAndBroker.min;
  const portMax = fees.portAndBroker.max;
  const regMin = fees.registration.min;
  const regMax = fees.registration.max;

  // Import costs = sum of 6 components.
  const importMin = shipping.min + insMin + dutyMin + vatMin + portMin + regMin;
  const importMax = shipping.max + insMax + dutyMax + vatMax + portMax + regMax;

  const landedMin = priceLocal + importMin;
  const landedMax = priceLocal + importMax;

  return {
    destination,
    origin,
    currency,
    carPriceLocal: { min: priceLocal, max: priceLocal, currency },
    shipping: { min: shipping.min, max: shipping.max, currency },
    marineInsurance: { min: insMin, max: insMax, currency },
    customsDuty: { min: dutyMin, max: dutyMax, currency },
    vatOrSalesTax: { min: vatMin, max: vatMax, currency },
    portAndBroker: { min: portMin, max: portMax, currency },
    registration: { min: regMin, max: regMax, currency },
    importCosts: { min: importMin, max: importMax, currency },
    landedCost: { min: landedMin, max: landedMax, currency },
    notes,
    usedProxyFor: proxied,
    sourcesUsed: consolidateSources({ destination }),
  };
}
