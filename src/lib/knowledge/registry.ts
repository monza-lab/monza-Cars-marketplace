import type { KnowledgeArticle } from "./types";
import { imsBearingArticle } from "./imsBearing";
import { porscheCoaArticle } from "./porscheCoa";
import { mezgerEngineArticle } from "./mezgerEngine";
import { prePurchaseInspectionArticle } from "./prePurchaseInspection";

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  imsBearingArticle,
  porscheCoaArticle,
  mezgerEngineArticle,
  prePurchaseInspectionArticle,
];

export function getKnowledgeArticle(slug: string): KnowledgeArticle | null {
  return KNOWLEDGE_ARTICLES.find((a) => a.slug === slug) ?? null;
}

export function listKnowledgeSlugs(): string[] {
  return KNOWLEDGE_ARTICLES.map((a) => a.slug);
}
