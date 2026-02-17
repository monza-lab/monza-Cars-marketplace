export const DEFAULT_LIVE_MAKE = "Porsche";

const SUPPORTED_LIVE_MAKES = ["Porsche", "Ferrari"] as const;

export type SupportedLiveMake = (typeof SUPPORTED_LIVE_MAKES)[number];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function getSupportedLiveMakes(): SupportedLiveMake[] {
  return [...SUPPORTED_LIVE_MAKES];
}

export function normalizeSupportedMake(value: string | null | undefined): SupportedLiveMake | null {
  if (!value) return null;
  const normalized = normalize(value);
  const match = SUPPORTED_LIVE_MAKES.find((make) => normalize(make) === normalized);
  return match ?? null;
}

export function resolveRequestedMake(value: string | null | undefined): SupportedLiveMake {
  return normalizeSupportedMake(value) ?? DEFAULT_LIVE_MAKE;
}

export function isSupportedLiveMake(value: string | null | undefined): boolean {
  return normalizeSupportedMake(value) !== null;
}
