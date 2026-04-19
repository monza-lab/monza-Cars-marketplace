import type { PorscheModelPage } from "@/lib/models/types";

export interface ComparisonRow {
  label: string;
  leftValue: string;
  rightValue: string;
  /** Which side is "more collector-preferred" on this dimension, if any */
  favors?: "left" | "right" | "neither";
  /** One-line rationale for the favor, or neutral commentary */
  note?: string;
}

export interface ComparisonSection {
  heading: string;
  body: string[];
}

export interface ComparisonPage {
  /** URL slug, e.g. "964-vs-993" */
  slug: string;
  /** Left model slug (matches Porsche model registry) */
  leftModelSlug: PorscheModelPage["slug"];
  /** Right model slug */
  rightModelSlug: PorscheModelPage["slug"];
  /** SEO title */
  title: string;
  /** One-line tagline */
  tagline: string;
  /** 2-3 paragraph intro — answers the "which to buy" question head-on */
  intro: string[];
  /** Side-by-side spec comparison rows */
  rows: ComparisonRow[];
  /** Long-form sections — dynamics, driving character, reliability, investment */
  sections: ComparisonSection[];
  /** FAQ Q&A focused on comparison-specific high-intent queries */
  faqs: { question: string; answer: string }[];
  /** Bottom-line verdict — neutral, context-aware */
  verdict: string;
  /** SEO keywords */
  keywords: string[];
}
