import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  DatasetJsonLd,
  ArticleJsonLd,
  BreadcrumbJsonLd,
} from "@/components/seo/JsonLd";
import { getAirCooled911Index } from "@/lib/index/airCooled911";
import { IndexChartClient } from "./IndexChartClient";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";
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
  const url = `${BASE_URL}/${loc}/index/air-cooled-911`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/index/air-cooled-911`;
  languages["x-default"] = `${BASE_URL}/en/index/air-cooled-911`;

  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "MonzaHaus",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function formatUsd(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function formatPct(n: number | null) {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export default async function AirCooled911IndexPage({ params }: PageProps) {
  const { locale } = await params;
  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const payload = await getAirCooled911Index();
  const url = `${BASE_URL}/${loc}/index/air-cooled-911`;
  const csvUrl = `${BASE_URL}/${loc}/index/air-cooled-911.csv`;

  const oldestYear = payload.buckets.length > 0 ? payload.buckets[0].year : null;
  const newestYear =
    payload.buckets.length > 0 ? payload.buckets[payload.buckets.length - 1].year : null;
  const temporalCoverage =
    oldestYear && newestYear ? `${oldestYear}-01-01/${newestYear}-12-31` : undefined;

  return (
    <>
      <DatasetJsonLd
        name="MonzaHaus Air-Cooled 911 Index"
        description="Quarterly median sale prices and trend data for air-cooled Porsche 911 models (993, 964, G-Body, 930, early 911), aggregated from public auction results."
        url={url}
        keywords={[
          "Porsche",
          "Porsche 911",
          "air-cooled",
          "993",
          "964",
          "G-Body",
          "930 Turbo",
          "collector car",
          "market data",
          "auction results",
          "investment grade",
        ]}
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
          { name: "Air-Cooled 911 Index", url },
        ]}
      />

      <div className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto max-w-6xl px-6 py-12 space-y-10">
          <header className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-500">
              MonzaHaus Index · v1
            </p>
            <h1 className="text-4xl md:text-5xl font-serif leading-tight">
              Air-Cooled Porsche 911 Index
            </h1>
            <p className="max-w-3xl text-zinc-400 text-lg">
              Quarterly median sale prices for the five air-cooled generations of the
              Porsche 911, aggregated from public auction results across Bring a Trailer,
              Cars & Bids, Classic.com, Elferspot, RM Sotheby&apos;s and AutoScout24.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
              <span>
                Last updated:{" "}
                <time dateTime={payload.generatedAt}>
                  {new Date(payload.generatedAt).toUTCString()}
                </time>
              </span>
              <span aria-hidden>·</span>
              <span>Sample size: {payload.sampleSize.toLocaleString()} sales</span>
              <span aria-hidden>·</span>
              <a href={csvUrl} className="text-amber-400 hover:underline">
                Download CSV
              </a>
            </div>
          </header>

          <section>
            <h2 className="text-xl font-serif mb-4">Current market snapshot</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {payload.summaries.map((s) => (
                <div
                  key={s.series}
                  className="border border-zinc-800 rounded-lg p-4 bg-zinc-950"
                >
                  <div className="text-xs text-zinc-500">{s.label}</div>
                  <div className="text-2xl font-serif mt-2">
                    {formatUsd(s.latestMedian)}
                  </div>
                  <div className="mt-1 text-xs space-x-2">
                    <span
                      className={
                        s.yoyChangePct == null
                          ? "text-zinc-600"
                          : s.yoyChangePct >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                      }
                    >
                      YoY {formatPct(s.yoyChangePct)}
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-500">
                      n = {s.sampleSize.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-serif mb-4">Quarterly median — historical</h2>
            <Suspense
              fallback={
                <div className="h-[420px] rounded-lg border border-zinc-800 bg-zinc-950 animate-pulse" />
              }
            >
              <IndexChartClient buckets={payload.buckets} />
            </Suspense>
          </section>

          <section className="prose prose-invert max-w-3xl text-zinc-400">
            <h2 className="text-xl font-serif text-zinc-100">Methodology</h2>
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
            <p>
              This index is published under{" "}
              <Link
                href="https://creativecommons.org/licenses/by/4.0/"
                className="text-amber-400 hover:underline"
              >
                CC BY 4.0
              </Link>
              . Attribution: &ldquo;MonzaHaus Air-Cooled 911 Index&rdquo; with link to
              this page.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
