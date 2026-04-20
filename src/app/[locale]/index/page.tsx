import type { Metadata } from "next";
import Link from "next/link";
import {
  BreadcrumbJsonLd,
  CollectionPageJsonLd,
} from "@/components/seo/JsonLd";
import { INDEX_REGISTRY } from "@/lib/index/registry";
import { getSiteUrl } from "@/lib/seo/siteUrl";

const BASE_URL = getSiteUrl();
const LOCALES = ["en", "es", "de", "ja"] as const;

const TITLES: Record<(typeof LOCALES)[number], string> = {
  en: "MonzaHaus Index — Market Data for Collector Car Investors",
  es: "MonzaHaus Index — Datos de Mercado para Inversores de Autos de Colección",
  de: "MonzaHaus Index — Marktdaten für Sammlerfahrzeug-Investoren",
  ja: "MonzaHaus インデックス — コレクターカー投資家のための市場データ",
};

const DESCRIPTIONS: Record<(typeof LOCALES)[number], string> = {
  en: "Proprietary quarterly market indices for investment-grade collector cars. Median sale prices, YoY trends, and downloadable datasets — free, CC BY 4.0.",
  es: "Índices de mercado trimestrales propietarios para autos de colección grado inversión. Medianas, tendencias anuales y datasets descargables — gratis, CC BY 4.0.",
  de: "Proprietäre quartalsweise Marktindizes für Sammlerfahrzeuge in Investmentqualität. Median-Preise, YoY-Trends und ladbare Datensätze — kostenlos, CC BY 4.0.",
  ja: "投資グレードのコレクターカーのための独自四半期市場インデックス。中央値、前年同期比トレンド、ダウンロード可能なデータセット — CC BY 4.0で無料。",
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
  const url = `${BASE_URL}/${loc}/index`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/index`;
  languages["x-default"] = `${BASE_URL}/en/index`;

  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "website", siteName: "MonzaHaus" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function IndexHubPage({ params }: PageProps) {
  const { locale } = await params;
  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const url = `${BASE_URL}/${loc}/index`;
  const liveIndices = INDEX_REGISTRY.filter((i) => i.status === "live");
  const upcoming = INDEX_REGISTRY.filter((i) => i.status === "upcoming");

  return (
    <>
      <CollectionPageJsonLd
        name="MonzaHaus Index"
        description={DESCRIPTIONS[loc]}
        url={url}
        numberOfItems={liveIndices.length}
        inLanguage={loc}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: `${BASE_URL}/${loc}` },
          { name: "Index", url },
        ]}
      />

      <div className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto max-w-6xl px-6 py-16 space-y-12">
          <header className="space-y-6 max-w-3xl">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-500">
              MonzaHaus Index
            </p>
            <h1 className="text-4xl md:text-6xl font-serif leading-tight">
              Market data for collector car investors.
            </h1>
            <p className="text-lg text-zinc-400">
              Proprietary quarterly indices aggregating public auction results across
              Bring a Trailer, Cars &amp; Bids, Classic.com, Elferspot, RM Sotheby&apos;s
              and AutoScout24. Open data, CC BY 4.0. Updated hourly.
            </p>
          </header>

          <section>
            <h2 className="text-2xl font-serif mb-6">Live indices</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveIndices.map((idx) => (
                <Link
                  key={idx.slug}
                  href={`/${loc}/index/${idx.slug}`}
                  className="group border border-zinc-800 rounded-lg p-6 bg-zinc-950 hover:border-amber-600/50 transition"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs uppercase tracking-wider text-emerald-500">
                      Live
                    </span>
                  </div>
                  <h3 className="text-xl font-serif mb-2 group-hover:text-amber-400 transition">
                    {idx.name}
                  </h3>
                  <p className="text-sm text-zinc-400 mb-4">{idx.tagline}</p>
                  <span className="text-xs text-amber-500 group-hover:underline">
                    View index →
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-6">Coming soon</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map((idx) => (
                <div
                  key={idx.slug}
                  className="border border-zinc-800/50 rounded-lg p-6 bg-zinc-950/50"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-2 w-2 rounded-full bg-zinc-600" />
                    <span className="text-xs uppercase tracking-wider text-zinc-500">
                      Upcoming
                    </span>
                  </div>
                  <h3 className="text-xl font-serif mb-2 text-zinc-400">{idx.name}</h3>
                  <p className="text-sm text-zinc-500">{idx.tagline}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="prose prose-invert max-w-3xl text-zinc-400">
            <h2 className="text-xl font-serif text-zinc-100">About the MonzaHaus Index</h2>
            <p>
              Every index uses the same methodology: quarterly median hammer prices from
              public auction sales, grouped by generation or trim. Median over mean to
              reduce the effect of outlier concours sales. Sold listings only —
              no-sales and dealer retail asking prices are excluded.
            </p>
            <p>
              All data is free to use under{" "}
              <Link
                href="https://creativecommons.org/licenses/by/4.0/"
                className="text-amber-400 hover:underline"
              >
                CC BY 4.0
              </Link>
              . Attribution: &ldquo;MonzaHaus Index&rdquo; with link to the relevant
              index page. Downloadable CSV available on each index.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
