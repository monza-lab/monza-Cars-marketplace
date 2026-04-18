import type { Metadata } from "next";
import Link from "next/link";
import {
  BreadcrumbJsonLd,
  CollectionPageJsonLd,
} from "@/components/seo/JsonLd";
import { KNOWLEDGE_ARTICLES } from "@/lib/knowledge/registry";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";
const LOCALES = ["en", "es", "de", "ja"] as const;

const TITLES: Record<(typeof LOCALES)[number], string> = {
  en: "MonzaHaus Knowledge Base — Porsche Authority Guides | MonzaHaus",
  es: "MonzaHaus Knowledge Base — Guías Autoritativas Porsche | MonzaHaus",
  de: "MonzaHaus Wissensdatenbank — Autoritative Porsche-Leitfäden | MonzaHaus",
  ja: "MonzaHaus ナレッジベース — Porscheの権威ある解説 | MonzaHaus",
};

const DESCRIPTIONS: Record<(typeof LOCALES)[number], string> = {
  en: "Deep-dive guides on the technical, authentication, and reliability topics every Porsche owner and buyer needs. IMS bearing, Mezger engine, Certificate of Authenticity, pre-purchase inspection, and more.",
  es: "Guías en profundidad sobre temas técnicos, de autenticidad y fiabilidad que todo propietario y comprador Porsche necesita. IMS bearing, motor Mezger, Certificate of Authenticity, inspección pre-compra y más.",
  de: "Vertiefte Leitfäden zu Technik-, Echtheits- und Zuverlässigkeitsthemen, die jeder Porsche-Besitzer und -Käufer braucht. IMS-Lager, Mezger-Motor, Certificate of Authenticity, Kaufinspektion und mehr.",
  ja: "Porscheオーナーおよび購入者が知るべき技術、認証、信頼性のトピックに関する詳細ガイド。IMSベアリング、Mezgerエンジン、認証書、購入前検査など。",
};

const CATEGORY_LABELS: Record<string, string> = {
  reliability: "Reliability",
  authentication: "Authentication",
  engine: "Engine",
  ownership: "Ownership",
  market: "Market",
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
  const url = `${BASE_URL}/${loc}/knowledge`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/knowledge`;
  languages["x-default"] = `${BASE_URL}/en/knowledge`;

  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "website", siteName: "MonzaHaus" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function KnowledgeHubPage({ params }: PageProps) {
  const { locale } = await params;
  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const url = `${BASE_URL}/${loc}/knowledge`;

  const byCategory = new Map<string, typeof KNOWLEDGE_ARTICLES>();
  for (const a of KNOWLEDGE_ARTICLES) {
    const arr = byCategory.get(a.category) ?? [];
    arr.push(a);
    byCategory.set(a.category, arr);
  }

  return (
    <>
      <CollectionPageJsonLd
        name="MonzaHaus Knowledge Base"
        description={DESCRIPTIONS[loc]}
        url={url}
        numberOfItems={KNOWLEDGE_ARTICLES.length}
        inLanguage={loc}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: `${BASE_URL}/${loc}` },
          { name: "Knowledge", url },
        ]}
      />

      <div className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto max-w-5xl px-6 py-16 space-y-12">
          <header className="space-y-6 max-w-3xl">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-500">
              MonzaHaus Knowledge
            </p>
            <h1 className="text-4xl md:text-6xl font-serif leading-tight">
              Authority guides for Porsche buyers &amp; owners.
            </h1>
            <p className="text-lg text-zinc-400">
              Deep-dive references on the technical, authentication, and reliability
              questions every Porsche collector needs answered. Factual, neutral, and
              cross-referenced to the MonzaHaus Index.
            </p>
          </header>

          {Array.from(byCategory.entries()).map(([category, articles]) => (
            <section key={category}>
              <h2 className="text-2xl font-serif mb-6">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {articles.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/${loc}/knowledge/${a.slug}`}
                    className="group border border-zinc-800 rounded-lg p-5 bg-zinc-950 hover:border-amber-600/40 transition"
                  >
                    <p className="text-xs uppercase tracking-wider text-zinc-500">
                      {CATEGORY_LABELS[a.category] ?? a.category}
                    </p>
                    <h3 className="text-xl font-serif mt-2 group-hover:text-amber-400 transition">
                      {a.title}
                    </h3>
                    <p className="text-sm text-zinc-400 mt-2 line-clamp-3">
                      {a.summary}
                    </p>
                    <span className="text-xs text-amber-500 mt-3 inline-block group-hover:underline">
                      Read the guide →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <section className="text-xs text-zinc-500 pt-8 border-t border-zinc-900">
            Content is informational and cross-referenced to primary sources where
            possible. MonzaHaus is an independent collector-intelligence platform —
            not affiliated with Porsche AG or its subsidiaries. For any
            transaction-specific advice, consult a Porsche-specialist shop, licensed
            customs broker, and tax professional.
          </section>
        </div>
      </div>
    </>
  );
}
