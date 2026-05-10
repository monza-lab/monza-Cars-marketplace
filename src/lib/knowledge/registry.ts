import type { KnowledgeArticle } from "./types";
import { imsBearingArticle } from "./imsBearing";
import { porscheCoaArticle } from "./porscheCoa";
import { mezgerEngineArticle } from "./mezgerEngine";
import { prePurchaseInspectionArticle } from "./prePurchaseInspection";
import { paintCodesArticle } from "./paintCodes";
import { airCooledVsWaterCooledArticle } from "./airCooledVsWaterCooled";
import { porscheRustInspectionArticle } from "./porscheRustInspection";
import { porscheServiceIntervalsArticle } from "./porscheServiceIntervals";

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  imsBearingArticle,
  porscheCoaArticle,
  mezgerEngineArticle,
  prePurchaseInspectionArticle,
  paintCodesArticle,
  airCooledVsWaterCooledArticle,
  porscheRustInspectionArticle,
  porscheServiceIntervalsArticle,
];

export function getKnowledgeArticle(slug: string): KnowledgeArticle | null {
  return KNOWLEDGE_ARTICLES.find((a) => a.slug === slug) ?? null;
}

export function listKnowledgeSlugs(): string[] {
  return KNOWLEDGE_ARTICLES.map((a) => a.slug);
}

/**
 * Search articles by keyword — matches against title, summary, keywords, and slug.
 * Returns articles ranked by relevance (keyword match > title match > summary match).
 */
export function searchKnowledgeArticles(query: string): KnowledgeArticle[] {
  if (!query || !query.trim()) return KNOWLEDGE_ARTICLES;
  const q = query.toLowerCase().trim();
  const terms = q.split(/\s+/);

  const scored = KNOWLEDGE_ARTICLES.map((a) => {
    let score = 0;
    const keywordsLower = a.keywords.map((k) => k.toLowerCase());
    const titleLower = a.title.toLowerCase();
    const summaryLower = a.summary.toLowerCase();
    const slugLower = a.slug.toLowerCase();

    // Exact keyword match is strongest signal
    if (keywordsLower.some((k) => k.includes(q))) score += 10;
    // Slug contains query
    if (slugLower.includes(q.replace(/\s+/g, "-"))) score += 8;
    // Title contains full query
    if (titleLower.includes(q)) score += 6;
    // Summary contains full query
    if (summaryLower.includes(q)) score += 3;

    // Individual term matches
    for (const term of terms) {
      if (keywordsLower.some((k) => k.includes(term))) score += 4;
      if (titleLower.includes(term)) score += 2;
      if (summaryLower.includes(term)) score += 1;
    }

    return { article: a, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.article);
}
