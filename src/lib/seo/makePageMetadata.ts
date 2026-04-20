import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSiteUrl } from "./siteUrl";

const BASE_URL = getSiteUrl();
const LOCALES = ["en", "es", "de", "ja"] as const;
type Locale = (typeof LOCALES)[number];

const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  de: "de_DE",
  ja: "ja_JP",
};

function capitalize(s: string) {
  return s
    .split(/[- ]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function pathFor(locale: Locale, make: string, series?: string) {
  const q = series ? `?series=${encodeURIComponent(series)}` : "";
  return `${BASE_URL}/${locale}/cars/${make}${q}`;
}

export async function buildMakePageMetadata({
  locale,
  make,
  series,
}: {
  locale: Locale;
  make: string;
  series?: string;
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "seo" });
  const makeName = capitalize(decodeURIComponent(make).replace(/-/g, " "));

  const title = series
    ? t("makeWithSeries.title", { make: makeName, series })
    : t("make.title", { make: makeName });
  const description = series
    ? t("makeWithSeries.description", { make: makeName, series })
    : t("make.description", { make: makeName });

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = pathFor(l, make, series);
  languages["x-default"] = pathFor("en", make, series);

  return {
    title,
    description,
    alternates: {
      canonical: pathFor(locale, make, series),
      languages,
    },
    openGraph: {
      title,
      description,
      url: pathFor(locale, make, series),
      type: "website",
      locale: OG_LOCALE[locale],
      siteName: "MonzaHaus",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
