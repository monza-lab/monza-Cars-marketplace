import type { ToolDef } from "@/lib/advisor/tools/registry"
import {
  getSeriesConfig,
  getSeriesThesis,
  getOwnershipCosts,
  getMarketDepth,
} from "@/lib/brandConfig"
import { KNOWLEDGE_ARTICLES, getKnowledgeArticle, searchKnowledgeArticles } from "@/lib/knowledge/registry"
import { getVariantFromCorpus } from "@/lib/knowledge/variants"
import { prePurchaseInspectionArticle } from "@/lib/knowledge/prePurchaseInspection"

function truncate(s: string, max = 500): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + "…"
}

// ─── get_series_profile ───

export const getSeriesProfile: ToolDef = {
  name: "get_series_profile",
  description:
    "Series config for a chassis: label, year range, family, thesis, ownership costs, market depth.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      seriesId: { type: "string" },
      make: { type: "string" },
    },
    required: ["seriesId"],
  },
  async handler(args) {
    const seriesId = typeof args.seriesId === "string" ? args.seriesId : ""
    const make = typeof args.make === "string" && args.make ? args.make : "Porsche"
    if (!seriesId) return { ok: false, error: "missing_arg:seriesId" }

    const config = getSeriesConfig(seriesId, make)
    if (!config) return { ok: false, error: `unknown_series:${seriesId}` }

    const thesis = getSeriesThesis(seriesId, make)
    const ownershipCosts = getOwnershipCosts(make)
    const marketDepth = getMarketDepth(make)

    const summary = truncate(
      `${config.label} (${config.yearRange[0]}–${config.yearRange[1]}), family ${config.family}. ` +
        (thesis ? `Thesis: ${thesis.slice(0, 220)}` : ""),
    )

    return {
      ok: true,
      data: {
        seriesId,
        make,
        label: config.label,
        family: config.family,
        yearRange: config.yearRange,
        thesis,
        ownershipCosts,
        marketDepth,
        variants: config.variants ?? [],
      },
      summary,
    }
  },
}

// ─── list_knowledge_topics ───

export const listKnowledgeTopics: ToolDef = {
  name: "list_knowledge_topics",
  description:
    "Search or browse curated MonzaHaus knowledge articles. Use the `query` parameter to find articles by topic keyword (e.g. 'IMS', 'Mezger', 'rust', 'paint codes', 'service intervals'). Categories: reliability, authentication, engine, ownership, market.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Keyword search across article titles, summaries, and keywords. Examples: 'IMS bearing', 'Mezger', 'rust', 'PPI', 'paint codes', 'air-cooled'. Preferred over category filter.",
      },
      category: {
        type: "string",
        enum: ["reliability", "authentication", "engine", "ownership", "market"],
        description: "Optional category filter. Prefer using `query` instead — articles may be in unexpected categories.",
      },
    },
  },
  async handler(args) {
    const queryStr = typeof args.query === "string" ? args.query.trim() : null
    const category = typeof args.category === "string" ? args.category : null

    let articles = queryStr ? searchKnowledgeArticles(queryStr) : KNOWLEDGE_ARTICLES
    if (category) {
      articles = articles.filter((a) => a.category === category)
    }

    const items = articles.map((a) => ({
      slug: a.slug,
      title: a.title,
      category: a.category,
      summary: a.summary,
      keywords: a.keywords,
    }))
    const filterDesc = [queryStr && `"${queryStr}"`, category && `category=${category}`].filter(Boolean).join(", ") || "all"
    const summary = truncate(
      `${items.length} article${items.length === 1 ? "" : "s"} matching ${filterDesc}: ${items
        .slice(0, 5)
        .map((i) => i.slug)
        .join(", ")}`,
    )
    return { ok: true, data: { articles: items, count: items.length }, summary }
  },
}

// ─── get_knowledge_article ───

export const getKnowledgeArticleTool: ToolDef = {
  name: "get_knowledge_article",
  description:
    "Full text of one curated knowledge article. Pass `slug` for exact lookup, or `keyword` to find the best-matching article by topic (e.g. 'IMS bearing', 'Mezger', 'rust inspection').",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      slug: { type: "string", description: "Exact article slug (e.g. 'ims-bearing', 'mezger-engine')." },
      keyword: { type: "string", description: "Topic keyword — returns the best-matching article. Use when you don't know the exact slug." },
    },
  },
  async handler(args) {
    const slug = typeof args.slug === "string" ? args.slug.trim() : ""
    const keyword = typeof args.keyword === "string" ? args.keyword.trim() : ""

    if (!slug && !keyword) return { ok: false, error: "missing_arg:slug_or_keyword" }

    // Exact slug lookup first
    if (slug) {
      const article = getKnowledgeArticle(slug)
      if (article) {
        const summary = truncate(`${article.title} — ${article.summary}`)
        return { ok: true, data: article, summary }
      }
    }

    // Keyword-based search fallback
    const searchTerm = keyword || slug
    const matches = searchKnowledgeArticles(searchTerm)
    if (matches.length === 0) {
      return { ok: false, error: `no_article_found_for:${searchTerm}` }
    }

    const article = matches[0]
    const summary = truncate(`${article.title} — ${article.summary}`)
    return { ok: true, data: article, summary }
  },
}

// ─── get_variant_details ───

export const getVariantDetails: ToolDef = {
  name: "get_variant_details",
  description:
    "Variant metadata (production numbers, option codes, chassis codes, known issues) for a series+variant.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      seriesId: { type: "string" },
      variantId: { type: "string" },
    },
    required: ["seriesId", "variantId"],
  },
  async handler(args) {
    const seriesId = typeof args.seriesId === "string" ? args.seriesId : ""
    const variantId = typeof args.variantId === "string" ? args.variantId : ""
    if (!seriesId) return { ok: false, error: "missing_arg:seriesId" }
    if (!variantId) return { ok: false, error: "missing_arg:variantId" }

    const details = getVariantFromCorpus(seriesId, variantId)
    if (!details) {
      return {
        ok: false,
        error: `variant_not_in_corpus: ${seriesId}/${variantId} is not yet authored (see spec §13)`,
      }
    }

    const summary = truncate(
      `${details.fullName} (${details.yearRange[0]}–${details.yearRange[1]})${
        details.productionTotal ? `, ~${details.productionTotal.toLocaleString()} produced` : ""
      }${details.knownIssues?.length ? `; ${details.knownIssues.length} known issues` : ""}`,
    )
    return { ok: true, data: details, summary }
  },
}

// ─── get_inspection_checklist ───
//
// Reuses the prePurchaseInspection article and filters its section bodies for
// mentions of the target seriesId so we can return a chassis-relevant subset.

export const getInspectionChecklist: ToolDef = {
  name: "get_inspection_checklist",
  description: "Pre-purchase inspection checklist, filtered to a chassis/series when available.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      seriesId: { type: "string", description: "Optional series id to narrow the checklist." },
    },
  },
  async handler(args) {
    const seriesId = typeof args.seriesId === "string" ? args.seriesId.toLowerCase() : null

    const sections = prePurchaseInspectionArticle.sections
    let filtered = sections
    if (seriesId) {
      filtered = sections.filter((s) => {
        const hay = `${s.heading}\n${s.body.join("\n")}`.toLowerCase()
        return hay.includes(seriesId) || /all generations|complete ppi|choose|what a complete/i.test(s.heading)
      })
      if (filtered.length === 0) filtered = sections
    }

    const checklist = filtered.flatMap((section) =>
      section.body.map((bullet, idx) => ({
        section: section.heading,
        index: idx,
        text: bullet,
      })),
    )

    const summary = truncate(
      `${checklist.length} inspection points${seriesId ? ` relevant to ${seriesId}` : ""} across ${filtered.length} sections`,
    )
    return {
      ok: true,
      data: {
        seriesId,
        sections: filtered.map((s) => ({ heading: s.heading, body: s.body })),
        checklist,
        sourceSlug: prePurchaseInspectionArticle.slug,
      },
      summary,
    }
  },
}

// ─── exports ───

export const knowledgeTools: ToolDef[] = [
  getSeriesProfile,
  listKnowledgeTopics,
  getKnowledgeArticleTool,
  getVariantDetails,
  getInspectionChecklist,
]
