import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FAQPageJsonLd,
  HowToJsonLd,
} from "@/components/seo/JsonLd";
import { ImportGuideLayout } from "@/components/import-guides/ImportGuideLayout";
import {
  getImportGuide,
  listImportGuideSlugs,
} from "@/lib/import-guides/registry";
import { getSiteUrl } from "@/lib/seo/siteUrl";

const BASE_URL = getSiteUrl();
const LOCALES = ["en", "es", "de", "ja"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: string; country: string }>;
}

export async function generateStaticParams() {
  const slugs = listImportGuideSlugs();
  return slugs.flatMap((country) =>
    LOCALES.map((locale) => ({ locale, country }))
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, country } = await params;
  const guide = getImportGuide(country);
  if (!guide) return { title: "Not Found | MonzaHaus", robots: { index: false, follow: false } };

  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const url = `${BASE_URL}/${loc}/guides/import/${country}`;
  const description = guide.intro[0].slice(0, 160);

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/guides/import/${country}`;
  languages["x-default"] = `${BASE_URL}/en/guides/import/${country}`;

  return {
    title: guide.title,
    description,
    keywords: guide.keywords,
    alternates: { canonical: url, languages },
    openGraph: { title: guide.title, description, url, type: "article", siteName: "MonzaHaus" },
    twitter: { card: "summary_large_image", title: guide.title, description },
  };
}

export default async function ImportGuidePage({ params }: PageProps) {
  const { locale, country } = await params;
  const guide = getImportGuide(country);
  if (!guide) notFound();

  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const url = `${BASE_URL}/${loc}/guides/import/${country}`;

  return (
    <>
      <ArticleJsonLd
        headline={guide.title}
        description={guide.intro[0]}
        url={url}
        datePublished="2026-04-18"
        dateModified={new Date().toISOString()}
        inLanguage={loc}
      />
      <HowToJsonLd
        name={`How to import a Porsche to ${guide.country}`}
        description={guide.tagline}
        steps={guide.steps.map((s) => ({ name: s.name, text: s.text, url: s.url }))}
      />
      <FAQPageJsonLd questions={guide.faqs} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: `${BASE_URL}/${loc}` },
          { name: "Guides", url: `${BASE_URL}/${loc}/guides` },
          { name: "Import", url: `${BASE_URL}/${loc}/guides/import` },
          { name: guide.country, url },
        ]}
      />

      <ImportGuideLayout guide={guide} locale={loc} />
    </>
  );
}
