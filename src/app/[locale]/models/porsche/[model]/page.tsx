import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FAQPageJsonLd,
} from "@/components/seo/JsonLd";
import { ModelPageLayout } from "@/components/models/ModelPageLayout";
import { getPorscheModel, listPorscheModelSlugs } from "@/lib/models/registry";
import { getAirCooled911Index } from "@/lib/index/airCooled911";
import { getWaterCooled911Index } from "@/lib/index/waterCooled911";
import type { IndexSummary } from "@/lib/index/factory";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";
const LOCALES = ["en", "es", "de", "ja"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string; model: string }>;
}

export async function generateStaticParams() {
  const slugs = listPorscheModelSlugs();
  return slugs.flatMap((slug) =>
    LOCALES.map((locale) => ({ locale, model: slug }))
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, model: slug } = await params;
  const model = getPorscheModel(slug);
  if (!model) return { title: "Not Found | MonzaHaus", robots: { index: false, follow: false } };

  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const title = `${model.fullName} — Buyer's Guide, Market Values & FAQ | MonzaHaus`;
  const description = model.intro[0].slice(0, 160);
  const url = `${BASE_URL}/${loc}/models/porsche/${slug}`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/models/porsche/${slug}`;
  languages["x-default"] = `${BASE_URL}/en/models/porsche/${slug}`;

  return {
    title,
    description,
    keywords: model.keywords,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "article", siteName: "MonzaHaus" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PorscheModelPage({ params }: PageProps) {
  const { locale, model: slug } = await params;
  const model = getPorscheModel(slug);
  if (!model) notFound();

  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const indexPayload =
    model.indexSlug === "air-cooled-911"
      ? await getAirCooled911Index()
      : await getWaterCooled911Index();

  const marketSummary =
    (indexPayload.summaries as IndexSummary<string>[]).find(
      (s) => s.series === model.slug
    ) ?? null;

  const url = `${BASE_URL}/${loc}/models/porsche/${slug}`;

  return (
    <>
      <ArticleJsonLd
        headline={`${model.fullName} — Buyer's Guide, Market Values & FAQ`}
        description={model.intro[0]}
        url={url}
        datePublished="2026-04-18"
        dateModified={indexPayload.generatedAt}
        inLanguage={loc}
      />
      <FAQPageJsonLd
        questions={model.faqs.map((f) => ({ question: f.question, answer: f.answer }))}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: `${BASE_URL}/${loc}` },
          { name: "Porsche", url: `${BASE_URL}/${loc}/cars/porsche` },
          { name: model.shortName, url },
        ]}
      />

      <ModelPageLayout model={model} marketSummary={marketSummary} locale={loc} />
    </>
  );
}
