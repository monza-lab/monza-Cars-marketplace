import type { Metadata } from "next";
import {
  DatasetJsonLd,
  ArticleJsonLd,
  BreadcrumbJsonLd,
} from "@/components/seo/JsonLd";
import { IndexPageLayout } from "@/components/index/IndexPageLayout";
import {
  porscheTurboIndexConfig,
  getPorscheTurboIndex,
} from "@/lib/index/porscheTurbo";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";
const LOCALES = ["en", "es", "de", "ja"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const TITLES: Record<(typeof LOCALES)[number], string> = {
  en: "MonzaHaus Porsche Turbo Index — 50 Years of 911 Turbo Market Values (930 through 992)",
  es: "MonzaHaus Porsche Turbo Index — 50 Años de Valores de Mercado del 911 Turbo (930 al 992)",
  de: "MonzaHaus Porsche Turbo Index — 50 Jahre 911 Turbo Marktwerte (930 bis 992)",
  ja: "MonzaHaus Porsche Turboインデックス — 50年の911 Turbo市場相場(930から992まで)",
};

const DESCRIPTIONS: Record<(typeof LOCALES)[number], string> = {
  en: "Cross-generation market index for Porsche 911 Turbo (930, 964, 993, 996, 997, 991, 992). Quarterly median sale prices, investment trends, and full dataset download.",
  es: "Índice cross-generación para Porsche 911 Turbo (930, 964, 993, 996, 997, 991, 992). Medianas trimestrales, tendencias de inversión y descarga del dataset completo.",
  de: "Generationsübergreifender Marktindex für Porsche 911 Turbo (930, 964, 993, 996, 997, 991, 992). Quartalsweise Median-Verkaufspreise und vollständiger Datensatz.",
  ja: "Porsche 911 Turbo(930, 964, 993, 996, 997, 991, 992)の世代横断市場インデックス。四半期中央値と完全データセット。",
};

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const title = TITLES[loc];
  const description = DESCRIPTIONS[loc];
  const url = `${BASE_URL}/${loc}/index/porsche-turbo`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/index/porsche-turbo`;
  languages["x-default"] = `${BASE_URL}/en/index/porsche-turbo`;

  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "website", siteName: "MonzaHaus" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PorscheTurboIndexPage({ params }: PageProps) {
  const { locale } = await params;
  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const payload = await getPorscheTurboIndex();
  const url = `${BASE_URL}/${loc}/index/porsche-turbo`;
  const csvUrl = `${BASE_URL}/${loc}/index/porsche-turbo.csv`;

  const oldestYear = payload.buckets.length > 0 ? payload.buckets[0].year : null;
  const newestYear =
    payload.buckets.length > 0 ? payload.buckets[payload.buckets.length - 1].year : null;
  const temporalCoverage =
    oldestYear && newestYear ? `${oldestYear}-01-01/${newestYear}-12-31` : undefined;

  return (
    <>
      <DatasetJsonLd
        name={porscheTurboIndexConfig.name}
        description={porscheTurboIndexConfig.description}
        url={url}
        keywords={porscheTurboIndexConfig.keywords}
        datePublished="2026-04-18"
        dateModified={payload.generatedAt}
        temporalCoverage={temporalCoverage}
        spatialCoverage="Global"
        distribution={[
          { contentUrl: csvUrl, encodingFormat: "text/csv" },
          { contentUrl: url, encodingFormat: "text/html" },
        ]}
      />
      <ArticleJsonLd
        headline={TITLES[loc]}
        description={DESCRIPTIONS[loc]}
        url={url}
        datePublished="2026-04-18"
        dateModified={payload.generatedAt}
        inLanguage={loc}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: `${BASE_URL}/${loc}` },
          { name: "Index", url: `${BASE_URL}/${loc}/index` },
          { name: "Porsche Turbo Index", url },
        ]}
      />

      <IndexPageLayout
        config={porscheTurboIndexConfig}
        payload={payload}
        csvUrl={csvUrl}
        title="Porsche 911 Turbo Index"
        subtitle="Fifty years of forced induction. Median sale prices for the Porsche 911 Turbo across seven generations — from the 930 widow-maker to the 992 Turbo S — in a single cross-generational curve."
        methodology={
          <>
            <p>
              The MonzaHaus Porsche Turbo Index tracks median hammer prices of Porsche
              911 Turbo and Turbo S sales across all seven generations: 930 (1975–1989),
              964 Turbo (1991–1994), 993 Turbo / Turbo S (1995–1998), 996 Turbo /
              Turbo S (2000–2005), 997 Turbo / Turbo S (2007–2012), 991 Turbo / Turbo S
              (2014–2019), and 992 Turbo / Turbo S (2020–present).
            </p>
            <p>
              GT2 and GT3 variants are excluded from this index and tracked separately
              in the forthcoming MonzaHaus GT Index — their racing pedigree and pricing
              dynamics differ enough to warrant their own series.
            </p>
            <p>
              Why a cross-generation index: the 911 Turbo is the only Porsche model line
              continuously produced for 50 years. Cross-generational comparison reveals
              which eras are over- or undervalued relative to their peers — essential
              context for both first-time buyers and experienced collectors sizing a
              position.
            </p>
            <p>
              Data sources: Bring a Trailer, Cars &amp; Bids, Classic.com, Elferspot,
              RM Sotheby&apos;s, AutoScout24, Collecting Cars. Sold listings only.
            </p>
          </>
        }
      />
    </>
  );
}
