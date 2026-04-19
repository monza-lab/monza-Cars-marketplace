import type { Metadata } from "next";
import {
  DatasetJsonLd,
  ArticleJsonLd,
  BreadcrumbJsonLd,
} from "@/components/seo/JsonLd";
import { IndexPageLayout } from "@/components/index/IndexPageLayout";
import { porscheGtIndexConfig, getPorscheGtIndex } from "@/lib/index/porscheGt";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";
const LOCALES = ["en", "es", "de", "ja"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const TITLES: Record<(typeof LOCALES)[number], string> = {
  en: "MonzaHaus Porsche GT Index — GT3, GT3 RS, GT2 RS, GT4 & Air-Cooled RS Market Values",
  es: "MonzaHaus Porsche GT Index — Valores de GT3, GT3 RS, GT2 RS, GT4 y RS Air-Cooled",
  de: "MonzaHaus Porsche GT Index — Marktwerte für GT3, GT3 RS, GT2 RS, GT4 und luftgekühlte RS",
  ja: "MonzaHaus Porsche GTインデックス — GT3, GT3 RS, GT2 RS, GT4, 空冷RSの市場相場",
};

const DESCRIPTIONS: Record<(typeof LOCALES)[number], string> = {
  en: "Cross-generational market index for Porsche GT lineage: GT3, GT3 RS, GT2, GT2 RS, GT4, and pre-GT air-cooled 964 RS / 993 RS. Median sale prices, YoY trends, CSV dataset.",
  es: "Índice cross-generación para el linaje GT de Porsche: GT3, GT3 RS, GT2 RS, GT4 y los RS air-cooled 964/993. Medianas de venta, tendencias y descarga CSV.",
  de: "Generationsübergreifender Marktindex für die Porsche GT-Linie: GT3, GT3 RS, GT2 RS, GT4 und die luftgekühlten 964 RS / 993 RS. Median-Preise und CSV-Datensatz.",
  ja: "Porsche GTラインのクロスジェネレーション市場インデックス：GT3、GT3 RS、GT2 RS、GT4、および空冷964 RS/993 RS。中央値価格とCSVデータセット。",
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
  const url = `${BASE_URL}/${loc}/index/porsche-gt`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/index/porsche-gt`;
  languages["x-default"] = `${BASE_URL}/en/index/porsche-gt`;

  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "website", siteName: "MonzaHaus" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PorscheGtIndexPage({ params }: PageProps) {
  const { locale } = await params;
  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const payload = await getPorscheGtIndex();
  const url = `${BASE_URL}/${loc}/index/porsche-gt`;
  const csvUrl = `${BASE_URL}/${loc}/index/porsche-gt.csv`;

  const oldestYear = payload.buckets.length > 0 ? payload.buckets[0].year : null;
  const newestYear =
    payload.buckets.length > 0 ? payload.buckets[payload.buckets.length - 1].year : null;
  const temporalCoverage =
    oldestYear && newestYear ? `${oldestYear}-01-01/${newestYear}-12-31` : undefined;

  return (
    <>
      <DatasetJsonLd
        name={porscheGtIndexConfig.name}
        description={porscheGtIndexConfig.description}
        url={url}
        keywords={porscheGtIndexConfig.keywords}
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
          { name: "Porsche GT Index", url },
        ]}
      />

      <IndexPageLayout
        config={porscheGtIndexConfig}
        payload={payload}
        csvUrl={csvUrl}
        title="Porsche GT Index"
        subtitle="The track-bred Porsche lineage. Median sale prices for GT2, GT3, GT3 RS, GT4 and the air-cooled RS progenitors (964 RS, 993 RS) — the cars Porsche built when they wanted to win races."
        methodology={
          <>
            <p>
              The MonzaHaus Porsche GT Index covers ten discrete series spanning the
              GT lineage: 964 RS, 993 RS, 996 GT3 / GT3 RS, 997 GT3 / GT3 RS / RS 4.0,
              991 GT3 / GT3 RS / R, 992 GT3 / GT3 RS, 996 GT2, 997 GT2 / GT2 RS, 991
              GT2 RS, and the 718 Cayman GT4 / GT4 RS.
            </p>
            <p>
              Why GT cars deserve their own index: these are the cars Porsche built for
              a racing homologation or track-focused brief. Their pricing dynamics
              differ from volume Turbos and Carreras — scarcity, production caps, and
              motorsport provenance drive a steeper appreciation curve. The GT3 RS 4.0
              (≈600 units), 997 GT2 RS (≈500 units), and 911 R (991 units) are treated
              as trophy assets and trade accordingly.
            </p>
            <p>
              Data sources: Bring a Trailer, Cars &amp; Bids, Classic.com, Elferspot,
              RM Sotheby&apos;s, AutoScout24, Collecting Cars. Sold listings only.
              Median over mean.
            </p>
          </>
        }
      />
    </>
  );
}
