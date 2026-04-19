import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FAQPageJsonLd,
  HowToJsonLd,
} from "@/components/seo/JsonLd";
import { KnowledgeArticleLayout } from "@/components/knowledge/KnowledgeArticleLayout";
import {
  getKnowledgeArticle,
  listKnowledgeSlugs,
} from "@/lib/knowledge/registry";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";
const LOCALES = ["en", "es", "de", "ja"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const slugs = listKnowledgeSlugs();
  return slugs.flatMap((slug) =>
    LOCALES.map((locale) => ({ locale, slug }))
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getKnowledgeArticle(slug);
  if (!article) return { title: "Not Found | MonzaHaus", robots: { index: false, follow: false } };

  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const url = `${BASE_URL}/${loc}/knowledge/${slug}`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/knowledge/${slug}`;
  languages["x-default"] = `${BASE_URL}/en/knowledge/${slug}`;

  return {
    title: article.seoTitle,
    description: article.summary,
    keywords: article.keywords,
    alternates: { canonical: url, languages },
    openGraph: {
      title: article.seoTitle,
      description: article.summary,
      url,
      type: "article",
      siteName: "MonzaHaus",
    },
    twitter: {
      card: "summary_large_image",
      title: article.seoTitle,
      description: article.summary,
    },
  };
}

export default async function KnowledgeArticlePage({ params }: PageProps) {
  const { locale, slug } = await params;
  const article = getKnowledgeArticle(slug);
  if (!article) notFound();

  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const url = `${BASE_URL}/${loc}/knowledge/${slug}`;

  return (
    <>
      <ArticleJsonLd
        headline={article.title}
        description={article.summary}
        url={url}
        datePublished="2026-04-18"
        dateModified={new Date().toISOString()}
        inLanguage={loc}
      />
      {article.howTo && (
        <HowToJsonLd
          name={article.howTo.name}
          description={article.howTo.description}
          steps={article.howTo.steps}
        />
      )}
      <FAQPageJsonLd questions={article.faqs} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: `${BASE_URL}/${loc}` },
          { name: "Knowledge", url: `${BASE_URL}/${loc}/knowledge` },
          { name: article.title, url },
        ]}
      />

      <KnowledgeArticleLayout article={article} locale={loc} />
    </>
  );
}
