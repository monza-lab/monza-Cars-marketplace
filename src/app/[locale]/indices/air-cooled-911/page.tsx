import type { Metadata } from "next";
import {
  DatasetJsonLd,
  ArticleJsonLd,
  BreadcrumbJsonLd,
} from "@/components/seo/JsonLd";
import { IndexPageLayout } from "@/components/index/IndexPageLayout";
import { airCooled911IndexConfig, getAirCooled911Index } from "@/lib/index/airCooled911";
import { getSiteUrl } from "@/lib/seo/siteUrl";

const BASE_URL = getSiteUrl();
const LOCALES = ["en", "es", "de", "ja"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const TITLES: Record<(typeof LOCALES)[number], string> = {
  en: "MonzaHaus Air-Cooled 911 Index — Live Market Values for Porsche 993, 964, SC & G-Body",
  es: "MonzaHaus Air-Cooled 911 Index — Valores de Mercado en Vivo para Porsche 993, 964, SC y G-Body",
  de: "MonzaHaus Air-Cooled 911 Index — Live-Marktwerte für Porsche 993, 964, SC & G-Body",
  ja: "MonzaHaus 空冷911インデックス — Porsche 993, 964, SC & G-Bodyのライブ市場相場",
};

const DESCRIPTIONS: Record<(typeof LOCALES)[number], string> = {
  en: "Live and historical market index for air-cooled Porsche 911 models (993, 964, G-Body, 930, early 911). Quarterly median sale prices, YoY trends, and full dataset download.",
  es: "Índice de mercado en vivo e histórico para Porsche 911 refrigerados por aire (993, 964, G-Body, 930, primeros 911). Medianas trimestrales, tendencias anuales y descarga del dataset completo.",
  de: "Live- und historischer Marktindex für luftgekühlte Porsche 911 Modelle (993, 964, G-Body, 930, frühe 911). Quartalsweise Median-Verkaufspreise, YoY-Trends und vollständiger Datensatz.",
  ja: "空冷Porsche 911モデル(993, 964, G-Body, 930, 初期911)のライブおよび過去の市場インデックス。四半期ごとの中央値販売価格、前年同期比トレンド、データセット全体のダウンロード。",
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
  const url = `${BASE_URL}/${loc}/indices/air-cooled-911`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/indices/air-cooled-911`;
  languages["x-default"] = `${BASE_URL}/en/indices/air-cooled-911`;

  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "website", siteName: "MonzaHaus" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function AirCooled911IndexPage({ params }: PageProps) {
  const { locale } = await params;
  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const payload = await getAirCooled911Index();
  const url = `${BASE_URL}/${loc}/indices/air-cooled-911`;
  const csvUrl = `${BASE_URL}/${loc}/indices/air-cooled-911.csv`;

  const oldestYear = payload.buckets.length > 0 ? payload.buckets[0].year : null;
  const newestYear =
    payload.buckets.length > 0 ? payload.buckets[payload.buckets.length - 1].year : null;
  const temporalCoverage =
    oldestYear && newestYear ? `${oldestYear}-01-01/${newestYear}-12-31` : undefined;

  return (
    <>
      <DatasetJsonLd
        name={airCooled911IndexConfig.name}
        description={airCooled911IndexConfig.description}
        url={url}
        keywords={airCooled911IndexConfig.keywords}
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
          { name: "Index", url: `${BASE_URL}/${loc}/indices` },
          { name: "Air-Cooled 911 Index", url },
        ]}
      />

      <IndexPageLayout
        config={airCooled911IndexConfig}
        payload={payload}
        csvUrl={csvUrl}
        title="Air-Cooled Porsche 911 Index"
        subtitle="Quarterly median sale prices for the five air-cooled generations of the Porsche 911, aggregated from public auction results across Bring a Trailer, Cars & Bids, Classic.com, Elferspot, RM Sotheby's and AutoScout24."
        methodology={
          <>
            <p>
              The MonzaHaus Air-Cooled 911 Index tracks median hammer prices of public
              auction sales, grouped by the five air-cooled generations of the 911:
              early 911 (1965–1973), G-Body / 911 SC &amp; 3.2 Carrera (1974–1989), 930
              Turbo (1975–1989), 964 (1989–1994), and 993 (1995–1998). We use median
              rather than mean to reduce the effect of outliers — a single concours-spec
              RS 2.7 should not distort the curve for a volume-produced Carrera.
            </p>
            <p>
              Data sources: Bring a Trailer, Cars &amp; Bids, Classic.com, Elferspot,
              RM Sotheby&apos;s, AutoScout24, Collecting Cars. All data reflects sold
              listings only (hammer-accepted transactions). Excluded: no-sales, private
              transactions, and dealer retail asking prices.
            </p>
          </>
        }
      />
    </>
  );
}
