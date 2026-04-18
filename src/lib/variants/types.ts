import type { PorscheModelPage } from "@/lib/models/types";

export interface VariantSpec {
  label: string;
  value: string;
}

export interface VariantFaq {
  question: string;
  answer: string;
}

export interface VariantPriceBand {
  label: string;
  range: string;
  note?: string;
}

export interface PorscheVariantPage {
  /** URL slug, e.g. "964-rs", "997-gt3-rs-40" */
  slug: string;
  /** Full display name, e.g. "Porsche 911 (964) RS" */
  fullName: string;
  /** Short name, e.g. "964 RS" */
  shortName: string;
  /** Parent model slug — for breadcrumb + navigation */
  parentModelSlug: PorscheModelPage["slug"];
  /** One-line positioning tagline */
  tagline: string;
  /** 3 paragraph intro */
  intro: string[];
  /** Years produced */
  yearRange: string;
  /** Exact production number, ideally with breakdown */
  production: string;
  /** Why this variant matters (1-2 paragraphs) — for Article schema description */
  significance: string[];
  /** Key technical specs */
  specs: VariantSpec[];
  /** What makes this spec identifiable (VIN, engine, body, unique traits) */
  identifiers: VariantSpec[];
  /** Notable options / sub-variants (e.g. RS NGT, 3.8 RS, RS America) */
  subVariants?: { name: string; yearRange: string; production?: string; note: string }[];
  /** Current market bands by condition */
  priceBands: VariantPriceBand[];
  /** 8-10 FAQ Q&A */
  faqs: VariantFaq[];
  /** 4-6 buyer-specific considerations */
  buyerConsiderations: string[];
  /** Short investment thesis */
  thesis: string;
  /** SEO keywords */
  keywords: string[];
}
