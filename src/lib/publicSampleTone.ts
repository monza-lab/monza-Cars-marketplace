function sanitizeText(value: string): string {
  return value
    .replace(/Act decisively to secure this exceptional asset[.!]?/gi, "Review the evidence and verify condition before proceeding.")
    .replace(/\ban unmissable acquisition\b/gi, "a potential acquisition")
    .replace(/\bunmissable acquisition\b/gi, "potential acquisition")
    .replace(/This VIN falls in the 0th percentile[^.]*[.!]?/gi, "A verified percentile is unavailable for this VIN.")
    .replace(/\bexceptional opportunity\b/gi, "potential opportunity");
}

export function sanitizePublicSampleTone<T>(value: T): T {
  if (typeof value === "string") return sanitizeText(value) as T;
  if (Array.isArray(value)) return value.map(sanitizePublicSampleTone) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, sanitizePublicSampleTone(nested)]),
    ) as T;
  }
  return value;
}
