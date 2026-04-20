import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FAQPageJsonLd,
  VehicleJsonLd,
} from "@/components/seo/JsonLd";
import { VariantPageLayout } from "@/components/variants/VariantPageLayout";
import {
  getPorscheVariant,
  listPorscheVariantSlugs,
} from "@/lib/variants/registry";
import { getPorscheModel } from "@/lib/models/registry";
import { getSiteUrl } from "@/lib/seo/siteUrl";

const BASE_URL = getSiteUrl();
const LOCALES = ["en", "es", "de", "ja"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const slugs = listPorscheVariantSlugs();
  return slugs.flatMap((slug) =>
    LOCALES.map((locale) => ({ locale, slug }))
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const variant = getPorscheVariant(slug);
  if (!variant) return { title: "Not Found | MonzaHaus", robots: { index: false, follow: false } };

  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const title = `${variant.fullName} — Production, Specs, Values & Buyer's Guide | MonzaHaus`;
  const description = variant.intro[0].slice(0, 160);
  const url = `${BASE_URL}/${loc}/variants/porsche/${slug}`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/variants/porsche/${slug}`;
  languages["x-default"] = `${BASE_URL}/en/variants/porsche/${slug}`;

  return {
    title,
    description,
    keywords: variant.keywords,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "article", siteName: "MonzaHaus" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PorscheVariantPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const variant = getPorscheVariant(slug);
  if (!variant) notFound();

  const parentModel = getPorscheModel(variant.parentModelSlug);
  if (!parentModel) notFound();

  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const url = `${BASE_URL}/${loc}/variants/porsche/${slug}`;

  return (
    <>
      <ArticleJsonLd
        headline={`${variant.fullName} — Production, Specs, Values & Buyer's Guide`}
        description={variant.intro[0]}
        url={url}
        datePublished="2026-04-18"
        dateModified={new Date().toISOString()}
        inLanguage={loc}
      />
      <FAQPageJsonLd
        questions={variant.faqs.map((f) => ({ question: f.question, answer: f.answer }))}
      />
      <VehicleJsonLd
        name={variant.fullName}
        description={variant.intro[0].slice(0, 300)}
        url={url}
        brand="Porsche"
        model={variant.shortName}
        year={parseInt(variant.yearRange.split(/[–-]/)[0] ?? "1990", 10)}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: `${BASE_URL}/${loc}` },
          { name: "Porsche", url: `${BASE_URL}/${loc}/cars/porsche` },
          { name: parentModel.shortName, url: `${BASE_URL}/${loc}/models/porsche/${parentModel.slug}` },
          { name: variant.shortName, url },
        ]}
      />

      <VariantPageLayout variant={variant} parentModel={parentModel} />
    </>
  );
}
