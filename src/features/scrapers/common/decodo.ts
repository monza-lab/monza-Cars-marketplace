export function buildDecodoBackconnectUsername(
  username: string | undefined,
  location: string | undefined,
): string | undefined {
  const trimmed = username?.trim();
  if (!trimmed) return undefined;

  const normalizedLocation = location?.trim().toLowerCase();
  const withPrefix = trimmed.startsWith("user-") ? trimmed : `user-${trimmed}`;

  if (!normalizedLocation) return withPrefix;

  const countryToken = `country-${normalizedLocation}`;
  if (withPrefix.includes(countryToken)) return withPrefix;

  return `${withPrefix}-${countryToken}`;
}
