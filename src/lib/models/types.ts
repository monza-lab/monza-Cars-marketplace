import type { AirCooledSeries } from "@/lib/index/airCooled911";
import type { WaterCooledSeries } from "@/lib/index/waterCooled911";

export type Porsche911Series =
  | Extract<AirCooledSeries, "964" | "993">
  | WaterCooledSeries;

export interface PorscheModelSpecs {
  yearRange: string;
  production: string;
  engine: string;
  power: string;
  transmission: string;
  zeroToSixty: string;
  topSpeed: string;
  curbWeight: string;
}

export interface PorscheModelFaq {
  question: string;
  answer: string;
}

export interface PorscheModelVariant {
  name: string;
  yearRange: string;
  note: string;
}

export interface PorscheModelPage {
  /** URL slug, matches brandConfig series id */
  slug: Porsche911Series;
  /** Short display name, e.g. "964" */
  shortName: string;
  /** Full display name, e.g. "Porsche 911 (964)" */
  fullName: string;
  /** One-line positioning tagline */
  tagline: string;
  /** 2-3 paragraph intro for SEO/AEO */
  intro: string[];
  /** Index slug this model lives inside ("air-cooled-911", etc.) */
  indexSlug: "air-cooled-911" | "water-cooled-911";
  /** Specs for the spec table */
  specs: PorscheModelSpecs;
  /** Notable variants (RS, Turbo, GT3, etc.) */
  variants: PorscheModelVariant[];
  /** 8-10 high-intent questions + concise answers */
  faqs: PorscheModelFaq[];
  /** 3-6 buyer considerations */
  buyerConsiderations: string[];
  /** Short investment thesis (neutral, factual) */
  thesis: string;
  /** SEO keywords for meta + Article schema */
  keywords: string[];
}
