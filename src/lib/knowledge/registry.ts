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
