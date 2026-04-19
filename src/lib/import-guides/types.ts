export interface ImportStep {
  name: string;
  text: string;
  url?: string;
}

export interface ImportCostRow {
  label: string;
  estimate: string;
  note?: string;
}

export interface ImportGuide {
  /** URL slug, e.g. "us", "germany", "uk", "japan" */
  slug: "us" | "germany" | "uk" | "japan";
  /** Country display name */
  country: string;
  /** Country flag emoji for UI (optional, disabled by default) */
  tagline: string;
  /** SEO title */
  title: string;
  /** 3-4 paragraph intro positioning the guide */
  intro: string[];
  /** Summary of the regulatory regime */
  regulatoryContext: string[];
  /** Step-by-step import procedure */
  steps: ImportStep[];
  /** Cost breakdown */
  costs: ImportCostRow[];
  /** Edge cases, gotchas, and common pitfalls */
  pitfalls: string[];
  /** Typical timeline */
  timeline: string;
  /** 8-10 high-intent FAQs */
  faqs: { question: string; answer: string }[];
  /** SEO keywords */
  keywords: string[];
}
