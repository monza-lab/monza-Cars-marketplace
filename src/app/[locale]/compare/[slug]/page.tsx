import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FAQPageJsonLd,
} from "@/components/seo/JsonLd";
import { ComparisonPageLayout } from "@/components/compare/ComparisonPageLayout";
import {
  getComparison,
  listComparisonSlugs,
} from "@/lib/compare/registry";
import { getPorscheModel } from "@/lib/models/registry";
import { getAirCooled911Index } from "@/lib/index/airCooled911";
import { getWaterCooled911Index } from "@/lib/index/waterCooled911";
import type { IndexSummary } from "@/lib/index/factory";
import { getSiteUrl } from "@/lib/seo/siteUrl";

const BASE_URL = getSiteUrl();
const LOCALES = ["en", "es", "de", "ja"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const slugs = listComparisonSlugs();
  return slugs.flatMap((slug) =>
    LOCALES.map((locale) => ({ locale, slug }))
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const comparison = getComparison(slug);
  if (!comparison) return { title: "Not Found | MonzaHaus", robots: { index: false, follow: false } };

  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const url = `${BASE_URL}/${loc}/compare/${slug}`;
  const description = comparison.intro[0].slice(0, 160);

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/compare/${slug}`;
  languages["x-default"] = `${BASE_URL}/en/compare/${slug}`;

  return {
    title: comparison.title,
    description,
    keywords: comparison.keywords,
    alternates: { canonical: url, languages },
    openGraph: { title: comparison.title, description, url, type: "article", siteName: "MonzaHaus" },
    twitter: { card: "summary_large_image", title: comparison.title, description },
  };
}

async function getMarketSummaryFor(modelSlug: string, indexSlug: "air-cooled-911" | "water-cooled-911") {
  const payload =
    indexSlug === "air-cooled-911" ? await getAirCooled911Index() : await getWaterCooled911Index();
  return (
    (payload.summaries as IndexSummary<string>[]).find((s) => s.series === modelSlug) ?? null
  );
}

export default async function ComparePage({ params }: PageProps) {
  const { locale, slug } = await params;
  const comparison = getComparison(slug);
  if (!comparison) notFound();

  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const leftModel = getPorscheModel(comparison.leftModelSlug);
  const rightModel = getPorscheModel(comparison.rightModelSlug);
  if (!leftModel || !rightModel) notFound();

  const [leftMarket, rightMarket] = await Promise.all([
    getMarketSummaryFor(leftModel.slug, leftModel.indexSlug),
    getMarketSummaryFor(rightModel.slug, rightModel.indexSlug),
  ]);

  const url = `${BASE_URL}/${loc}/compare/${slug}`;

  return (
    <>
      <ArticleJsonLd
        headline={comparison.title}
        description={comparison.intro[0]}
        url={url}
        datePublished="2026-04-18"
        dateModified={new Date().toISOString()}
        inLanguage={loc}
      />
      <FAQPageJsonLd
        questions={comparison.faqs.map((f) => ({ question: f.question, answer: f.answer }))}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: `${BASE_URL}/${loc}` },
          { name: "Compare", url: `${BASE_URL}/${loc}/compare` },
          { name: `${leftModel.shortName} vs ${rightModel.shortName}`, url },
        ]}
      />

      <ComparisonPageLayout
        comparison={comparison}
        leftModel={leftModel}
        rightModel={rightModel}
        leftMarket={leftMarket}
        rightMarket={rightMarket}
        locale={loc}
      />
    </>
  );
}
