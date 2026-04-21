import type { Country } from "./types";
import { DUTY_RULES } from "./duties";
import { TAX_RULES } from "./taxes";

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
