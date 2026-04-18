import type { Metadata } from "next";
import {
  DatasetJsonLd,
  ArticleJsonLd,
  BreadcrumbJsonLd,
} from "@/components/seo/JsonLd";
import { IndexPageLayout } from "@/components/index/IndexPageLayout";
import {
  waterCooled911IndexConfig,
  getWaterCooled911Index,
} from "@/lib/index/waterCooled911";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";
const LOCALES = ["en", "es", "de", "ja"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const TITLES: Record<(typeof LOCALES)[number], string> = {
  en: "MonzaHaus Water-Cooled 911 Index — Live Market Values for Porsche 996, 997, 991 & 992",
  es: "MonzaHaus Water-Cooled 911 Index — Valores de Mercado en Vivo para Porsche 996, 997, 991 y 992",
  de: "MonzaHaus Water-Cooled 911 Index — Live-Marktwerte für Porsche 996, 997, 991 & 992",
  ja: "MonzaHaus 水冷911インデックス — Porsche 996, 997, 991 & 992のライブ市場相場",
};

const DESCRIPTIONS: Record<(typeof LOCALES)[number], string> = {
  en: "Live and historical market index for water-cooled Porsche 911 generations (996, 997, 991, 992). Quarterly median sale prices, YoY trends, and full dataset download.",
  es: "Índice de mercado en vivo e histórico para Porsche 911 refrigerados por agua (996, 997, 991, 992). Medianas trimestrales, tendencias anuales y descarga del dataset completo.",
  de: "Live- und historischer Marktindex für wassergekühlte Porsche 911 Generationen (996, 997, 991, 992). Quartalsweise Median-Verkaufspreise, YoY-Trends und vollständiger Datensatz.",
  ja: "水冷Porsche 911世代(996, 997, 991, 992)のライブおよび過去の市場インデックス。四半期ごとの中央値販売価格、前年同期比トレンド、データセット全体のダウンロード。",
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
  const url = `${BASE_URL}/${loc}/index/water-cooled-911`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/index/water-cooled-911`;
  languages["x-default"] = `${BASE_URL}/en/index/water-cooled-911`;

  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "website", siteName: "MonzaHaus" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function WaterCooled911IndexPage({ params }: PageProps) {
  const { locale } = await params;
  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const payload = await getWaterCooled911Index();
  const url = `${BASE_URL}/${loc}/index/water-cooled-911`;
  const csvUrl = `${BASE_URL}/${loc}/index/water-cooled-911.csv`;

  const oldestYear = payload.buckets.length > 0 ? payload.buckets[0].year : null;
  const newestYear =
    payload.buckets.length > 0 ? payload.buckets[payload.buckets.length - 1].year : null;
  const temporalCoverage =
    oldestYear && newestYear ? `${oldestYear}-01-01/${newestYear}-12-31` : undefined;

  return (
    <>
      <DatasetJsonLd
        name={waterCooled911IndexConfig.name}
        description={waterCooled911IndexConfig.description}
        url={url}
        keywords={waterCooled911IndexConfig.keywords}
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
          { name: "Water-Cooled 911 Index", url },
        ]}
      />

      <IndexPageLayout
        config={waterCooled911IndexConfig}
        payload={payload}
        csvUrl={csvUrl}
        title="Water-Cooled Porsche 911 Index"
        subtitle="Quarterly median sale prices for the four water-cooled generations of the Porsche 911 (996, 997, 991, 992), aggregated from public auction results. Tracks the shift from early water-cooled scepticism to GT3/Turbo S appreciation curves."
        methodology={
          <>
            <p>
              The MonzaHaus Water-Cooled 911 Index tracks median hammer prices of public
              auction sales across the four water-cooled 911 generations: 996 (1998–2005),
              997 (2005–2012), 991 (2012–2019), and 992 (2019–present). Each generation
              includes all sub-trims (Carrera, Targa, Turbo, GT3, GT2). For trim-specific
              curves (e.g. GT3-only), see the dedicated GT Index.
            </p>
            <p>
              Why water-cooled matters: the 996 has historically traded below air-cooled
              peers due to initial IMS bearing concerns, but clean examples and rare trims
              (996 GT3 RS, 996 Turbo S) are seeing strong recovery. The 997 is considered
              a near-peak collector era (Mezger engine, pre-PDK 6-speed). This index makes
              those generational dynamics visible at a glance.
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
