import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { stripHtml } from "@/lib/stripHtml";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";
const LOCALES = ["en", "es", "de", "ja"] as const;
type Locale = (typeof LOCALES)[number];

const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  de: "de_DE",
  ja: "ja_JP",
};

type CarInput = {
  title: string;
  make: string;
  model?: string | null;
  year?: number | string | null;
  thesis?: string | null;
  image?: string | null;
} | null;

function pathFor(locale: Locale, make: string, id: string) {
  return `${BASE_URL}/${locale}/cars/${make}/${id}`;
}

export async function buildCarDetailMetadata({
  locale,
  make,
  id,
  car,
}: {
  locale: Locale;
  make: string;
  id: string;
  car: CarInput;
}): Promise<Metadata> {
  if (!car) {
    return {
      title: "Not Found | MonzaHaus",
      robots: { index: false, follow: false },
    };
  }

  const t = await getTranslations({ locale, namespace: "seo.car" });

  const title = t("titleTemplate", {
    make: car.make,
    model: car.model ?? "",
    year: String(car.year ?? ""),
  })
    .replace(/\s+/g, " ")
    .trim();

  const rawThesis = car.thesis ? stripHtml(car.thesis) : "";
  const description = rawThesis
    ? rawThesis.slice(0, 160)
    : t("descriptionFallback", {
        make: car.make,
        model: car.model ?? "",
        year: String(car.year ?? ""),
      });

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = pathFor(l, make, id);
  languages["x-default"] = pathFor("en", make, id);

  return {
    title,
    description,
    alternates: {
      canonical: pathFor(locale, make, id),
      languages,
    },
    openGraph: {
      title,
      description,
      url: pathFor(locale, make, id),
      type: "website",
      locale: OG_LOCALE[locale],
      siteName: "MonzaHaus",
      images: car.image ? [{ url: car.image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: car.image ? [car.image] : undefined,
    },
  };
}
