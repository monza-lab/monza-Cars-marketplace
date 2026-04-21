import type { Currency, Range } from "./types";

function formatter(currency: Currency, locale: string): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

export function formatLandedCost(range: Range, locale: string): string {
  const f = formatter(range.currency, locale);
  return `${f.format(range.min)} – ${f.format(range.max)}`;
}

export function formatPoint(
  amount: number,
  currency: Currency,
  locale: string,
): string {
  return `~${formatter(currency, locale).format(amount)}`;
}
