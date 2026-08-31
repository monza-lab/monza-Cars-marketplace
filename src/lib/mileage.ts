export type MileageUnit = "mi" | "km";

const KILOMETRES_PER_MILE = 1.609344;

export function normalizeMileageUnit(unit: string | null | undefined): MileageUnit | null {
  const normalized = unit?.trim().toLowerCase();
  if (normalized === "mi" || normalized === "mile" || normalized === "miles") return "mi";
  if (normalized === "km" || normalized === "kilometer" || normalized === "kilometers" || normalized === "kilometre" || normalized === "kilometres") return "km";
  return null;
}

export function mileageUnitForMarket(market: string | null | undefined): MileageUnit | null {
  if (market === "US" || market === "UK") return "mi";
  if (market === "EU" || market === "JP") return "km";
  return null;
}

export function toCanonicalMiles(
  value: number | null,
  sourceUnit: string | null | undefined,
): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const unit = normalizeMileageUnit(sourceUnit);
  if (unit === "mi") return value;
  if (unit === "km") return value / KILOMETRES_PER_MILE;
  return null;
}

export function getMileageForMarket(
  value: number,
  sourceUnit: string | null | undefined,
  market: string | null | undefined,
): { value: number; unit: MileageUnit | null } {
  const source = normalizeMileageUnit(sourceUnit);
  const target = mileageUnitForMarket(market) ?? source;
  if (!source || !target || source === target) return { value: Math.round(value), unit: source };
  return {
    value: Math.round(source === "mi" ? value * KILOMETRES_PER_MILE : value / KILOMETRES_PER_MILE),
    unit: target,
  };
}

export function formatMileageForMarket(
  value: number,
  sourceUnit: string | null | undefined,
  market: string | null | undefined,
  locale: string,
): string {
  const display = getMileageForMarket(value, sourceUnit, market);
  const formatted = display.value.toLocaleString(locale);
  return display.unit ? `${formatted} ${display.unit}` : `${formatted} · unit unknown`;
}

export function marketMileageLabel(market: string): string {
  const names: Record<string, string> = {
    US: "United States",
    UK: "United Kingdom",
    EU: "Europe",
    JP: "Japan",
  };
  const unit = mileageUnitForMarket(market);
  const convention = unit === "mi" ? "miles" : unit === "km" ? "kilometres" : "source units";
  return `${names[market] ?? market} market · mileage shown in ${convention}`;
}
