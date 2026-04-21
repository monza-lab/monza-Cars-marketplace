import type { ConsolidatedSources, Country } from "./types";
import { DUTY_RULES } from "./duties";
import { TAX_RULES } from "./taxes";
import { FEES } from "./fees";
import { SHIPPING_SOURCES } from "./shipping";

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
