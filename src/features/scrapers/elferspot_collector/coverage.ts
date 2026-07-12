export const ELFERSPOT_RESOLVED_NON_NUMERIC_PRICE_STATUSES = [
  "sold",
  "price_on_request",
  "hidden",
  "not_listed",
] as const;

const ELFERSPOT_RESOLVED_PRICE_STATUSES = new Set<string>([
  "numeric",
  ...ELFERSPOT_RESOLVED_NON_NUMERIC_PRICE_STATUSES,
]);

export function isElferspotPriceStatusResolved(status: string | null | undefined): boolean {
  return typeof status === "string" && ELFERSPOT_RESOLVED_PRICE_STATUSES.has(status);
}
