import type { Country } from "./types";

const LOCALE_MAP: Record<string, Country> = {
  en: "US",
  "en-us": "US",
  de: "DE",
  "en-gb": "UK",
  ja: "JP",
};

export function localeToDestination(locale: string): Country {
  const normalized = locale.toLowerCase();
  const match = LOCALE_MAP[normalized];
  if (match) return match;
  console.warn(
    `[landedCost] Unknown locale "${locale}", defaulting destination to US.`,
  );
  return "US";
}
